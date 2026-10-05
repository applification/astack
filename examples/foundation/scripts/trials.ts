import { spawn, spawnSync } from 'node:child_process';
import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { homedir, tmpdir, platform, release, arch } from 'node:os';
import { createHash } from 'node:crypto';
import { isUtf8 } from 'node:buffer';
import { join, resolve, relative, extname } from 'node:path';
import { z } from 'zod';
import { StringDecoder } from 'node:string_decoder';
import { stripVTControlCharacters } from 'node:util';
import { command, commandBytes, foundationRoot, redact } from './runtime';
import { isSourcePath, sourceDigest } from './source-identity';

type Usage = {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  [key: string]: unknown;
};
export class TrialEvents {
  actionIds = new Set<string>();
  usage: Usage[] = [];
  started = false;
  completed = false;
  failed = false;
  accept(event: unknown): void {
    if (!event || typeof event !== 'object') return;
    const value = event as {
      type?: string;
      item?: { id?: string; type?: string };
      usage?: Usage;
    };
    if (value.type === 'thread.started') this.started = true;
    if (value.type === 'turn.completed') {
      this.completed = true;
      if (value.usage) this.usage.push(value.usage);
    }
    if (value.type === 'turn.failed' || value.type === 'error')
      this.failed = true;
    if (
      value.type === 'item.started' &&
      value.item?.id &&
      !['agent_message', 'reasoning'].includes(value.item.type ?? '')
    )
      this.actionIds.add(value.item.id);
  }
}

const finding = z
  .object({
    title: z.string(),
    file: z.string(),
    line: z.number().int().positive(),
    priority: z.number().int().min(0).max(3),
    explanation: z.string(),
  })
  .strict();
const deliverySchema = z
  .object({
    outcome: z.enum(['complete', 'partial', 'blocked']),
    summary: z.string(),
    checks: z.array(z.string()),
    gaps: z.array(z.string()),
    findings: z.array(finding),
  })
  .strict();
export const dimensions = [
  'routeIntent',
  'scopeOwnership',
  'supportedImplementation',
  'meaningfulProof',
  'recoveryRegression',
  'accurateResult',
] as const;
const score = z
  .object({
    score: z.number().int().min(0).max(2),
    evidence: z.string().min(1),
  })
  .strict();
export const reviewSchema = deliverySchema
  .extend({
    scores: z
      .object({
        routeIntent: score,
        scopeOwnership: score,
        supportedImplementation: score,
        meaningfulProof: score,
        recoveryRegression: score,
        accurateResult: score,
      })
      .strict(),
    authorizationDefect: z.boolean(),
  })
  .strict();
type AgentRun = {
  outcome: 'completed' | 'failed' | 'inconclusive';
  exitCode: number | null;
  durationMs: number;
  actionCount: number;
  usage: Usage[];
  usageReason: string;
  cost: null;
  costReason: string;
  termination: string;
  final: unknown;
  model: string;
  reasoning: string | null;
  sandbox: 'read-only' | 'workspace-write' | 'danger-full-access';
  sandboxPurpose: string;
  outputHashes: Record<
    'events' | 'stderr',
    { originalSha256: string; retainedSha256: string }
  > & { final: { originalSha256: string; retainedSha256: string } | null };
  processCleanup: {
    descendantEnumeration: 'available' | 'limited' | 'not-observed';
    observations: string[];
    coverage: string;
  };
};
type Acceptance = {
  outcome: 'pass' | 'fail' | 'inconclusive';
  command: string[];
  durationMs: number;
  report: unknown;
  error?: string;
};
type Stage = 'creation' | 'feature' | 'bug';
type StageResult = Record<string, unknown> & {
  round: number;
  kind: Stage;
  gate: ReviewGate;
};
type ReviewGate = {
  outcome: 'pass' | 'fail' | 'inconclusive';
  total: number | null;
  scores: z.infer<typeof reviewSchema>['scores'] | null;
  reasons: string[];
};

/** A process finishing or returning “complete” does not establish rubric success. */
export function reviewGate(
  agent: Pick<AgentRun, 'outcome' | 'final'>,
  reviewer: Pick<AgentRun, 'outcome' | 'final'>,
  acceptance: Pick<Acceptance, 'outcome'>,
): ReviewGate {
  const delivery = deliverySchema.safeParse(agent.final);
  const review = reviewSchema.safeParse(reviewer.final);
  const reasons: string[] = [];
  if (
    agent.outcome !== 'completed' ||
    !delivery.success ||
    delivery.data.outcome !== 'complete'
  )
    reasons.push(
      'Delivery did not complete within its limits with a valid complete report.',
    );
  if (acceptance.outcome !== 'pass')
    reasons.push(`Trusted acceptance was ${acceptance.outcome}.`);
  if (
    reviewer.outcome !== 'completed' ||
    !review.success ||
    review.data.outcome !== 'complete'
  )
    reasons.push(
      'Independent scored review did not complete within its limits.',
    );
  const scores = review.success ? review.data.scores : null;
  const total = scores
    ? dimensions.reduce((sum, dimension) => sum + scores[dimension].score, 0)
    : null;
  if (total !== null && total < 10)
    reasons.push(`Rubric score ${total}/12 is below 10.`);
  if (scores?.meaningfulProof.score === 0)
    reasons.push('Meaningful proof scored zero.');
  if (scores?.scopeOwnership.score === 0)
    reasons.push('Scope and ownership scored zero.');
  if (review.success && review.data.authorizationDefect)
    reasons.push('Reviewer found an unresolved authorization defect.');
  return {
    outcome:
      reasons.length === 0
        ? 'pass'
        : agent.outcome === 'inconclusive' ||
            reviewer.outcome === 'inconclusive' ||
            acceptance.outcome === 'inconclusive' ||
            !review.success
          ? 'inconclusive'
          : 'fail',
    total,
    scores,
    reasons,
  };
}

/** Include detached descendants; escalate so a limit cannot wait forever on ignored SIGTERM. */
type ProcessTable = {
  stdout: string | null;
  status: number | null;
  error?: Error | undefined;
};
export function descendants(
  pid: number,
  inspect: () => ProcessTable = () =>
    spawnSync('ps', ['-axo', 'pid=,ppid='], { encoding: 'utf8' }),
): { pids: number[]; available: boolean; observation: string } {
  let table: ProcessTable;
  try {
    table = inspect();
  } catch (error) {
    return {
      pids: [pid],
      available: false,
      observation: `Process enumeration threw: ${redact(error instanceof Error ? error.message : JSON.stringify(error))}`,
    };
  }
  if (table.error || table.status !== 0 || typeof table.stdout !== 'string')
    return {
      pids: [pid],
      available: false,
      observation: `Process enumeration unavailable: status=${String(table.status)}, ${redact(table.error?.message ?? 'no stdout')}`,
    };
  const output = table.stdout;
  const entries = output
    .trim()
    .split('\n')
    .map((line) => line.trim().split(/\s+/).map(Number));
  const owned = new Set<number>([pid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [child, parent] of entries)
      if (
        child &&
        parent &&
        child > 0 &&
        parent > 0 &&
        Number.isInteger(child) &&
        Number.isInteger(parent) &&
        owned.has(parent) &&
        !owned.has(child)
      ) {
        owned.add(child);
        changed = true;
      }
  }
  return {
    pids: [...owned].reverse(),
    available: true,
    observation: `Derived ${owned.size - 1} descendant process IDs from a ps snapshot; the CLI process ID is separately known.`,
  };
}
function signalOwned(
  pid: number,
  owned: number[],
  signal: NodeJS.Signals,
): void {
  // spawn(detached) owns this process group; never signal the caller's group.
  try {
    process.kill(-pid, signal);
  } catch {}
  for (const child of owned) {
    try {
      process.kill(child, signal);
    } catch {}
  }
}

export async function runAgent(options: {
  cwd: string;
  directory: string;
  prompt: string;
  config: string[];
  reviewer?: boolean;
  timeoutMs?: number;
  actionLimit?: number;
  model: string;
  reasoning?: string | undefined;
  sandbox?: 'workspace-write' | 'danger-full-access';
}): Promise<AgentRun> {
  await mkdir(options.directory, { recursive: true });
  const schemaPath = join(options.directory, 'schema.json');
  const outputSchema = options.reviewer ? reviewSchema : deliverySchema;
  await writeFile(schemaPath, JSON.stringify(z.toJSONSchema(outputSchema)));
  await writeFile(join(options.directory, 'prompt.txt'), options.prompt);
  const finalPath = join(options.directory, 'final.json');
  const sandbox = options.reviewer
    ? 'read-only'
    : (options.sandbox ?? 'workspace-write');
  const eventsPath = join(options.directory, 'events.jsonl');
  const stderrPath = join(options.directory, 'stderr.log');
  await Promise.all([writeFile(eventsPath, ''), writeFile(stderrPath, '')]);
  const args = [
    'exec',
    '--ephemeral',
    '--ignore-user-config',
    '--json',
    '-C',
    options.cwd,
    '-c',
    'approval_policy="never"',
    '-c',
    'agents.enabled=false',
    '-s',
    sandbox,
    '-c',
    'sandbox_workspace_write.network_access=true',
    '--output-schema',
    schemaPath,
    '-o',
    finalPath,
    '-m',
    options.model,
    ...options.config,
  ];
  if (options.reasoning)
    args.push(
      '-c',
      `model_reasoning_effort=${JSON.stringify(options.reasoning)}`,
    );
  args.push('-');
  const child = spawn('codex', args, {
    cwd: options.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: true,
  });
  const startedAt = Date.now(),
    events = new TrialEvents();
  let lines = '',
    stderrLines = '',
    stdout = '',
    stderr = '',
    termination = 'normal';
  let escalation: ReturnType<typeof setTimeout> | undefined;
  let ownedChildren: number[] = [];
  const enumerations: ReturnType<typeof descendants>[] = [];
  const enumerate = (pid: number) => {
    const observed = descendants(pid);
    enumerations.push(observed);
    return observed.pids;
  };
  const stop = (reason: string) => {
    if (termination !== 'normal') return;
    termination = reason;
    if (!child.pid) return;
    const pid = child.pid,
      owned = enumerate(pid);
    ownedChildren = owned;
    signalOwned(pid, owned, 'SIGTERM');
    escalation = setTimeout(() => {
      signalOwned(pid, owned, 'SIGKILL');
    }, 5000);
  };
  const timer = setTimeout(
    () => {
      stop('wall-clock limit');
    },
    options.timeoutMs ?? 20 * 60_000,
  );
  const writeEvidence = serialWrites();
  const stdoutDecoder = new StringDecoder('utf8');
  const stderrDecoder = new StringDecoder('utf8');
  let pendingEvidence = Promise.resolve();
  let evidenceFailure: unknown;
  const retain = (path: string, completeLines: string) => {
    pendingEvidence = writeEvidence(() =>
      appendFile(path, redactTrial(completeLines)),
    ).catch((error: unknown) => {
      evidenceFailure = error;
      stop('evidence retention failure');
    });
  };
  child.stdout.on('data', (chunk: Buffer) => {
    const text = stdoutDecoder.write(chunk);
    stdout += text;
    lines += text;
    let completeLines = '';
    let newline: number;
    while ((newline = lines.indexOf('\n')) >= 0) {
      const line = lines.slice(0, newline);
      lines = lines.slice(newline + 1);
      completeLines += line + '\n';
      try {
        events.accept(JSON.parse(line));
      } catch {}
      if (events.completed && child.pid) ownedChildren = enumerate(child.pid);
      if (events.actionIds.size >= (options.actionLimit ?? 80))
        stop('action limit');
    }
    if (completeLines) retain(eventsPath, completeLines);
  });
  child.stderr.on('data', (chunk: Buffer) => {
    const text = stderrDecoder.write(chunk);
    stderr += text;
    stderrLines += text;
    const newline = stderrLines.lastIndexOf('\n');
    if (newline >= 0) {
      retain(stderrPath, stderrLines.slice(0, newline + 1));
      stderrLines = stderrLines.slice(newline + 1);
    }
  });
  child.stdin.end(options.prompt);
  let exitCode: number | null = null;
  try {
    exitCode = await new Promise<number | null>((done) => {
      child.once('error', (error) => {
        stderr += String(error);
        events.failed = true;
        done(null);
      });
      child.once('close', done);
    });
  } finally {
    clearTimeout(timer);
    if (child.pid && ownedChildren.length) {
      // The CLI may close while a detached dev server is still alive.
      signalOwned(
        child.pid,
        ownedChildren.filter((pid) => pid !== child.pid),
        'SIGKILL',
      );
    }
    if (escalation) clearTimeout(escalation);
  }
  // Parse a final JSONL line even if the CLI ended without a trailing newline.
  const stdoutTail = stdoutDecoder.end(),
    stderrTail = stderrDecoder.end();
  stdout += stdoutTail;
  lines += stdoutTail;
  stderr += stderrTail;
  stderrLines += stderrTail;
  if (lines.trim()) {
    try {
      events.accept(JSON.parse(lines));
    } catch {}
  }
  if (lines) retain(eventsPath, lines);
  if (stderrLines) retain(stderrPath, stderrLines);
  await pendingEvidence;
  if (evidenceFailure !== undefined)
    stderr += `\nLive evidence retention failed: ${redact(evidenceFailure instanceof Error ? evidenceFailure.message : JSON.stringify(evidenceFailure))}\n`;
  // Keep all emitted output, including malformed JSONL and the final partial line.
  // Waiting for queued appends prevents them from overwriting final retention.
  const retainedEvents = redactTrial(stdout);
  const retainedStderr = redact(stderr);
  await writeFile(eventsPath, retainedEvents);
  await writeFile(stderrPath, retainedStderr);
  let final: unknown = null;
  let finalHashes: AgentRun['outputHashes']['final'] = null;
  try {
    const originalBytes = await readFile(finalPath);
    let retainedText: string;
    let validatedFinal: unknown = null;
    try {
      const original: unknown = JSON.parse(originalBytes.toString('utf8'));
      const sanitized = sanitizeTrialJson(original);
      retainedText = JSON.stringify(sanitized, null, 2);
      const originalParsed = outputSchema.safeParse(original);
      const retainedParsed = outputSchema.safeParse(sanitized);
      if (originalParsed.success && retainedParsed.success)
        validatedFinal = retainedParsed.data;
    } catch {
      // Malformed output cannot complete a trial, but must still be sanitized.
      retainedText = redactTrial(originalBytes.toString('utf8'));
    }
    await writeFile(finalPath, retainedText);
    final = validatedFinal;
    finalHashes = {
      originalSha256: digest(originalBytes),
      retainedSha256: digest(retainedText),
    };
  } catch {}
  return {
    outcome:
      termination !== 'normal' ||
      !events.started ||
      !events.completed ||
      !final ||
      (options.config.some((entry) => entry.startsWith('plugins')) &&
        stderr.includes('failed to load plugin'))
        ? 'inconclusive'
        : exitCode === 0 && !events.failed
          ? 'completed'
          : 'failed',
    exitCode,
    durationMs: Date.now() - startedAt,
    actionCount: events.actionIds.size,
    usage: events.usage,
    usageReason: events.usage.length
      ? 'Observed turn.completed JSONL usage.'
      : 'CLI emitted no turn.completed usage; unavailable, not zero.',
    cost: null,
    costReason:
      'Codex JSONL did not return a monetary cost; no price-based estimate is substituted.',
    termination,
    final,
    model: options.model,
    reasoning: options.reasoning ?? null,
    sandbox,
    sandboxPurpose: options.reviewer
      ? 'Independent reviewer may inspect evidence and source but cannot edit the disposable project.'
      : sandbox === 'danger-full-access'
        ? 'Explicitly selected controlled local environment: Chromium launch, process inspection and Git metadata operations are required for running product proof.'
        : 'Delivery can edit its workspace; host restrictions may prevent browser, process or Git proof and are reported without automatic sandbox fallback.',
    outputHashes: {
      events: {
        originalSha256: digest(stdout),
        retainedSha256: digest(retainedEvents),
      },
      stderr: {
        originalSha256: digest(stderr),
        retainedSha256: digest(retainedStderr),
      },
      final: finalHashes,
    },
    processCleanup: {
      descendantEnumeration: enumerations.some((entry) => !entry.available)
        ? 'limited'
        : enumerations.length
          ? 'available'
          : 'not-observed',
      observations: enumerations.map((entry) => entry.observation),
      coverage:
        'Owned detached CLI process-group signaling does not depend on ps. Separately detached descendants are covered only when present in an available process-table snapshot; unavailable enumeration cannot establish full descendant cleanup.',
    },
  };
}

const digest = (data: Buffer | string) =>
  createHash('sha256').update(data).digest('hex');

/** Preserve symbolic source templates while still masking actual credentials. */
export function redactTrial(text: string): string {
  const safe = text
    .replace(
      /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
      '[REDACTED JWT]',
    )
    .replace(
      /((?:CONVEX_SELF_HOSTED_ADMIN_KEY|CONVEX_DEPLOY_KEY|WORKOS_API_KEY)(?:\\?["'`])?\s*[=:]\s*)((?:\\?["'`])?)([^\s"'`\\,;)}\]]+)/gi,
      (_match: string, prefix: string, quote: string) =>
        `${prefix}${quote}[REDACTED]`,
    )
    .replace(
      /-----BEGIN (?:[A-Z ]*PRIVATE KEY)-----[\s\S]*?-----END (?:[A-Z ]*PRIVATE KEY)-----/g,
      '[REDACTED PRIVATE KEY]',
    );
  const symbolic: string[] = [];
  const protectedText = safe.replace(
    /Bearer\s+\$\{[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\}/g,
    (expression) => {
      const index = symbolic.push(expression) - 1;
      return `\u0000astack-symbolic-bearer-${index}\u0000`;
    },
  );
  return (
    protectedText
      // Credentials start with a token character. Excluding JavaScript loop
      // keywords also preserves `for (const bearer of ...)` in archived source.
      // ANSI SGR can precede a colored token directly or escaped in JSON/source.
      .replace(
        /Bearer\s+(?:(?:\u001b|\\+u001b|\\+x1b)\[[\d;:]*m)*(?!of\b|in\b)[A-Za-z0-9_~+/.\-][^\s"'`\\,;)}\]]*/gi,
        'Bearer [REDACTED]',
      )
      .replace(
        /\u0000astack-symbolic-bearer-(\d+)\u0000/g,
        (marker: string, index: string) => symbolic[Number(index)] ?? marker,
      )
  );
}
/** Sanitize decoded JSON values, then serialize; replacement cannot break JSON syntax. */
function sanitizeTrialJson(value: unknown): unknown {
  if (typeof value === 'string') return redactTrial(value);
  if (Array.isArray(value)) return value.map(sanitizeTrialJson);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        redactTrial(key),
        /^(?:CONVEX_SELF_HOSTED_ADMIN_KEY|CONVEX_DEPLOY_KEY|WORKOS_API_KEY)$/i.test(
          key,
        )
          ? '[REDACTED]'
          : sanitizeTrialJson(child),
      ]),
    );
  return value;
}

/** Acquire Git stdout as bytes privately and retain a single source-safe redaction. */
export async function retainTrialDiff(
  project: string,
  baseline: string,
  destination: string,
) {
  const original = await commandBytes(['git', 'diff', baseline, '--'], project);
  const retained = Buffer.from(redactTrial(original.toString('utf8')));
  await writeFile(destination, retained);
  return {
    originalSha256: digest(original),
    retainedSha256: digest(retained),
    transformed: !original.equals(retained),
  };
}
export async function fileDigests(
  directory: string,
  prefix = '',
): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory())
      Object.assign(
        hashes,
        await fileDigests(join(directory, entry.name), name),
      );
    else if (entry.isFile())
      hashes[name] = digest(await readFile(join(directory, entry.name)));
    else throw new Error(`Unsupported candidate entry: ${name}`);
  }
  return hashes;
}
export async function installedCandidate(
  marketplace: string,
  expected: Record<string, string>,
) {
  const base = join(
    process.env.CODEX_HOME ?? join(homedir(), '.codex'),
    'plugins/cache',
    marketplace,
    'applification',
  );
  for (const entry of await readdir(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(base, entry.name),
      actual = await fileDigests(path);
    if (
      Object.keys(actual).length === Object.keys(expected).length &&
      Object.entries(expected).every(([file, hash]) => actual[file] === hash)
    )
      return { path, digest: digest(JSON.stringify(actual)), files: actual };
  }
  throw new Error(
    'Installed candidate files do not exactly match the committed candidate snapshot',
  );
}

const gitIdentity = [
  '-c',
  'user.name=astack trial',
  '-c',
  'user.email=trial@invalid.example',
];
async function commit(project: string, message: string): Promise<string> {
  await command(['git', 'add', '.'], project);
  await command(
    ['git', ...gitIdentity, 'commit', '--allow-empty', '-m', message],
    project,
  );
  return (await command(['git', 'rev-parse', 'HEAD'], project)).trim();
}
export function seedStatusDefect(source: string): string {
  const marker = 'await ctx.db.patch(args.id, { status: args.status });';
  if (source.split(marker).length !== 2)
    throw new Error(
      'Seed statement changed or is ambiguous; update the maintained defect fixture before running trials.',
    );
  return source.replace(
    marker,
    "await ctx.db.patch(args.id, { status: args.status === 'done' ? 'open' : 'done' });",
  );
}
export function seedWasObserved(
  acceptance: Pick<Acceptance, 'outcome' | 'report'>,
): boolean {
  if (acceptance.outcome !== 'fail') return false;
  const parsed = z
    .object({
      outcome: z.literal('fail'),
      checks: z.array(z.object({ id: z.string(), outcome: z.string() })),
    })
    .safeParse(acceptance.report);
  return (
    parsed.success &&
    parsed.data.checks.some(
      (check) => check.id === 'R3' && check.outcome === 'fail',
    )
  );
}

/** Invoke the committed verifier, not a command or verifier mutable by the delivery agent. */
async function trustedAcceptance(
  snapshot: string,
  project: string,
  evidence: string,
  stage: Stage,
): Promise<Acceptance> {
  const args = [
    'bun',
    join(snapshot, 'examples/foundation/scripts/readiness.ts'),
    '--project-root',
    project,
    '--task-profile',
    stage === 'feature' ? 'title-edit' : 'baseline',
    '--evidence',
    evidence,
  ];
  await mkdir(evidence, { recursive: true });
  const startedAt = Date.now();
  let error: string | undefined;
  try {
    await writeFile(
      join(evidence, 'command.log'),
      await command(args, snapshot, undefined, 8 * 60_000),
    );
  } catch (caught) {
    error = redact(String(caught));
    await writeFile(join(evidence, 'command.log'), error);
  }
  let report: unknown = null;
  try {
    report = JSON.parse(
      await readFile(join(evidence, 'report.json'), 'utf8'),
    ) as unknown;
  } catch {}
  const parsed = z
    .object({
      outcome: z.enum(['pass', 'fail', 'inconclusive']),
      cleanup: z.enum(['complete', 'failed']),
    })
    .safeParse(report);
  return {
    outcome:
      parsed.success &&
      parsed.data.cleanup === 'complete' &&
      (!error || parsed.data.outcome === 'fail')
        ? parsed.data.outcome
        : 'inconclusive',
    command: args,
    durationMs: Date.now() - startedAt,
    report,
    ...(error ? { error } : {}),
  };
}

/** Keep delivered source and local product evidence before disposing its running project. */
export async function retainProject(
  project: string,
  retained: string,
  proofArtifacts = false,
  includeRoots?: readonly string[],
): Promise<Record<string, string>> {
  await mkdir(retained, { recursive: true });
  const hashes: Record<string, string> = {};
  const retainedHashes: Record<
    string,
    {
      originalSha256: string;
      retainedSha256: string;
      transformed: boolean;
      retainedPath: string;
      transforms: string[];
    }
  > = {};
  const omittedFiles: {
    path: string;
    originalSha256: string;
    sizeBytes: number;
    reason: string;
  }[] = [];
  let privateOrCredentialPaths = 0;
  async function visit(directory: string): Promise<void> {
    for (const entry of (
      await readdir(directory, { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name),
        name = relative(project, path);
      if (includeRoots && !includeRoots.includes(name.split('/')[0] ?? ''))
        continue;
      const proof =
        proofArtifacts ||
        ['.proof', '.astack'].some(
          (root) => name === root || name.startsWith(`${root}/`),
        );
      if (
        name
          .split('/')
          .some(
            (part) =>
              /(?:^|[._-])(?:private(?:[-_]?key)?|credentials?|secrets?)(?:[._-]|$)/i.test(
                part,
              ) ||
              /\.(?:pem|key|p12|pfx)$/i.test(part) ||
              /^id_(?:rsa|ed25519)$/.test(part),
          )
      ) {
        privateOrCredentialPaths++;
        continue;
      }
      if (!isSourcePath(name) && name !== '.proof' && !proof) continue;
      if (
        proof &&
        name
          .split('/')
          .some(
            (part) =>
              part === '.auth-fixtures' ||
              part.startsWith('.env') ||
              ['node_modules', '.git', '.convex'].includes(part),
          )
      )
        continue;
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        const bytes = await readFile(path);
        const extension = extname(name).toLowerCase();
        if (extension === '.pen') {
          omittedFiles.push({
            path: redactTrial(name),
            originalSha256: digest(bytes),
            sizeBytes: bytes.length,
            reason:
              'Opaque Pen design; omitted from text sanitization. Read or edit the native source through Pen MCP.',
          });
          continue;
        }
        const binaryImage =
          extension === '.png'
            ? bytes
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : extension === '.jpg' || extension === '.jpeg'
              ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
              : extension === '.webp' &&
                bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
                bytes.subarray(8, 12).toString('ascii') === 'WEBP';
        const imageExtension = ['.png', '.jpg', '.jpeg', '.webp'].includes(
          extension,
        );
        const terminalLog =
          extension === '.log' && isUtf8(bytes) && !bytes.includes(0);
        const archiveDisguisedAsLog =
          terminalLog &&
          (['PK\u0003\u0004', 'PK\u0005\u0006', 'PK\u0007\u0008'].includes(
            bytes.subarray(0, 4).toString('latin1'),
          ) ||
            /^BZh[1-9]/.test(bytes.subarray(0, 4).toString('ascii')));
        const unsupported =
          /\.(?:zip|gz|gzip|bz2|xz|7z|rar|tar|pdf|woff2?|ttf|otf|eot|wasm|db|sqlite|mp[34]|mov|webm|wav)$/i.test(
            name,
          ) ||
          archiveDisguisedAsLog ||
          !isUtf8(bytes) ||
          bytes.includes(0) ||
          // ANSI ESC is expected in terminal logs; other binary controls are not.
          (!terminalLog &&
            /[\u0000-\u0008\u000b\u000c\u000e-\u001a\u001c-\u001f\u007f]/.test(
              bytes.toString('utf8'),
            ));
        if (!binaryImage && (imageExtension || unsupported)) {
          omittedFiles.push({
            path: redactTrial(name),
            originalSha256: digest(bytes),
            sizeBytes: bytes.length,
            reason: imageExtension
              ? 'Image bytes do not match a supported image format; omitted without decoding.'
              : 'Unsupported binary or compressed artifact; omitted without decoding or copying because its contents cannot be safely sanitized.',
          });
          continue;
        }
        hashes[name] = digest(bytes);
        const destination = join(retained, 'delivered', name);
        await mkdir(resolve(destination, '..'), { recursive: true });
        const sourceText = binaryImage ? '' : bytes.toString('utf8');
        const normalized = terminalLog
          ? stripVTControlCharacters(sourceText).replace(
              /(Bearer\s+|(?:CONVEX_SELF_HOSTED_ADMIN_KEY|CONVEX_DEPLOY_KEY|WORKOS_API_KEY)\s*[=:]\s*)[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f \t]+/gi,
              '$1',
            )
          : sourceText;
        const redacted = binaryImage ? '' : redactTrial(normalized);
        // Exposing controls before redaction would split an opaque credential
        // at the newly introduced backslash. Mask first, then show controls.
        const sanitized = terminalLog
          ? redacted.replace(
              /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,
              (control) =>
                `\\u${control.charCodeAt(0).toString(16).padStart(4, '0')}`,
            )
          : redacted;
        const retainedBytes = binaryImage ? bytes : Buffer.from(sanitized);
        retainedHashes[name] = {
          originalSha256: hashes[name] ?? digest(bytes),
          retainedSha256: digest(retainedBytes),
          transformed: !retainedBytes.equals(bytes),
          retainedPath: `delivered/${name}`,
          transforms: [
            ...(normalized !== sourceText || sanitized !== redacted
              ? ['terminal-control-normalization']
              : []),
            ...(redacted !== normalized ? ['credential-redaction'] : []),
          ],
        };
        await writeFile(destination, retainedBytes);
      }
      // Symlinks are not followed or copied into evidence.
    }
  }
  await visit(project);
  await writeFile(
    join(retained, 'delivered-files.json'),
    JSON.stringify(hashes, null, 2),
  );
  await writeFile(
    join(retained, 'retention.json'),
    JSON.stringify(
      {
        format: 'astack-trial-retention/v1',
        scope: includeRoots
          ? {
              kind: 'creation-workspace-siblings',
              includedRoots: includeRoots,
              deliveredProjectExcluded: true,
            }
          : {
              kind: 'project',
              sourceSelection: 'isSourcePath',
              proofRoots: ['.astack', '.proof'],
            },
        files: retainedHashes,
        omittedFiles,
        excludedPaths: { privateOrCredentialPaths, namesRetained: false },
        policy:
          'Source digest selection is unchanged. Lifecycle metadata/docs and nested proof under .astack/.proof are additionally retained as evidence. Original/retained byte digests and observed transforms describe every artifact. UTF-8 non-NUL .log output has VT sequences removed before credential redaction and remaining controls displayed as Unicode escapes; other source text is unchanged except credential redaction. PNG/JPEG/WebP images remain byte-exact. Unsupported binaries/archives are omitted with hashes/reasons and sanitized display paths, including proof trace ZIPs. Separate omission entries preserve colliding display paths. Credential/private paths are excluded without names; environments, dependencies and symlinks are excluded.',
      },
      null,
      2,
    ),
  );
  return hashes;
}

export async function retainWorkspaceEvidence(
  workspace: string,
  retained: string,
): Promise<Record<string, string>> {
  return retainProject(workspace, join(retained, 'workspace-evidence'), true, [
    '.astack',
    '.proof',
    'evidence',
  ]);
}

export function trialRounds(value: number): number {
  if (!Number.isInteger(value) || value < 2)
    throw new Error('At least two whole independent rounds are required.');
  return value;
}

export function trialConcurrency(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 2)
    throw new Error('Trial concurrency must be one or two independent rounds.');
  return value;
}

/** Stop assigning rounds after a failure, but drain every round already started. */
export async function runTrialRounds(
  rounds: number,
  concurrency: number,
  runRound: (round: number) => Promise<void>,
): Promise<void> {
  trialRounds(rounds);
  trialConcurrency(concurrency);
  let nextRound = 1;
  const failures: unknown[] = [];
  const worker = async () => {
    while (failures.length === 0 && nextRound <= rounds) {
      const round = nextRound++;
      try {
        await runRound(round);
      } catch (error) {
        failures.push(error);
      }
    }
  };
  await Promise.allSettled(
    Array.from({ length: Math.min(rounds, concurrency) }, () => worker()),
  );
  if (failures.length) throw failures[0];
}

/** Serializes report replacement and live evidence writes; one failure does not poison later writes. */
export function serialWrites(): (write: () => Promise<void>) => Promise<void> {
  let tail = Promise.resolve();
  return (write) => {
    const next = tail.then(write);
    tail = next.catch(() => undefined);
    return next;
  };
}

export function orderedResults<T extends { round: number; kind: Stage }>(
  results: readonly T[],
): T[] {
  const rank: Record<Stage, number> = { creation: 0, feature: 1, bug: 2 };
  return [...results].sort(
    (a, b) => a.round - b.round || rank[a.kind] - rank[b.kind],
  );
}

/** Explicit invocation only. The trials grant no merge, publication or deployment authority. */
export async function runTrials(options: {
  candidate: string;
  rubric: string;
  output: string;
  rounds?: number;
  concurrency?: number;
  deliverySandbox?: 'workspace-write' | 'danger-full-access';
  model: string;
  reasoning?: string | undefined;
}) {
  const rounds = trialRounds(options.rounds ?? 2);
  const concurrency = trialConcurrency(options.concurrency ?? 1);
  const deliverySandbox = z
    .enum(['workspace-write', 'danger-full-access'])
    .parse(options.deliverySandbox ?? 'workspace-write');
  if (!options.model.trim())
    throw new Error(
      'Supply the configured model explicitly; user configuration is ignored for isolation.',
    );
  const repo = resolve(foundationRoot, '../..'),
    output = resolve(options.output);
  const candidate = (
    await command(['git', 'rev-parse', `${options.candidate}^{commit}`], repo)
  ).trim();
  const harnessIdentity = {
    repositoryRevision: (
      await command(['git', 'rev-parse', 'HEAD'], repo)
    ).trim(),
    sourceDigest: await sourceDigest(foundationRoot),
    orchestrationDigest: digest(await readFile(import.meta.path)),
    sourceScope:
      'Executing foundation source, including untracked inputs, excluding credentials and generated/proof outputs.',
    trustedAcceptance:
      'Candidate snapshot verifier; orchestration changes do not replace the candidate acceptance oracle.',
  };
  const rubricPath = resolve(options.rubric),
    rubricText = await readFile(rubricPath, 'utf8');
  if (!rubricText.trim()) throw new Error('Trial rubric is empty');
  // Fail rather than mixing a new rubric with an old source revision.
  const rubricRelative = relative(repo, rubricPath);
  if (rubricRelative.startsWith('..'))
    throw new Error('Rubric must belong to the candidate repository.');
  const committedRubric = await command(
    ['git', 'show', `${candidate}:${rubricRelative}`],
    repo,
  );
  if (committedRubric !== rubricText)
    throw new Error('Rubric must exactly match the committed candidate.');
  await mkdir(resolve(output, '..'), { recursive: true });
  await mkdir(output, { recursive: false });
  await writeFile(join(output, 'rubric.md'), rubricText);
  await writeFile(
    join(output, 'interventions.json'),
    JSON.stringify(
      { classification: 'none recorded', human: [], harness: [] },
      null,
      2,
    ),
  );
  const temporary = await mkdtemp(join(tmpdir(), 'astack-trials-')),
    snapshot = join(temporary, 'candidate');
  const results: StageResult[] = [],
    harness: Record<string, unknown>[] = [];
  const event = (action: string, stage?: string) =>
    harness.push({
      at: new Date().toISOString(),
      action,
      ...(stage ? { stage } : {}),
    });
  let installed = false,
    marketplace = '',
    config: string[] = [];
  const reportWrites = serialWrites();
  const writeReport = () =>
    reportWrites(async () => {
      const completed = results.length === rounds * 3;
      const allPassed =
        completed && results.every((result) => result.gate.outcome === 'pass');
      const conclusive =
        completed &&
        results.every((result) => result.gate.outcome !== 'inconclusive');
      const temporaryReport = join(output, '.report.json.tmp');
      await writeFile(
        temporaryReport,
        JSON.stringify(
          {
            format: 'astack-foundation-trials/v2',
            candidate,
            harnessIdentity,
            rubricDigest: digest(rubricText),
            rounds,
            concurrency,
            deliverySandbox,
            reviewerSandbox: 'read-only',
            requiredStages: ['creation', 'feature', 'bug'],
            model: options.model,
            reasoning: options.reasoning ?? null,
            outcome: allPassed ? 'pass' : conclusive ? 'fail' : 'inconclusive',
            limits: {
              taskMs: 20 * 60_000,
              reviewerMs: 20 * 60_000,
              actions: 80,
            },
            results: orderedResults(results),
            harness,
            interventionRecord: 'interventions.json',
            interpretation:
              'A pass requires every task in at least two independent rounds to complete trusted product acceptance and the predeclared scored independent review. Live WorkOS and installed ChatGPT remain separate proof gaps.',
          },
          null,
          2,
        ),
      );
      await rename(temporaryReport, join(output, 'report.json'));
    });
  try {
    await mkdir(snapshot, { recursive: true });
    const archive = join(temporary, 'candidate.tar');
    await command(
      ['git', 'archive', '--format=tar', '-o', archive, candidate],
      repo,
    );
    await command(['tar', '-xf', archive, '-C', snapshot], repo);
    // Preserve revision identity inside an archive without inventing a Git checkout.
    await writeFile(
      join(snapshot, '.astack/candidate-revision'),
      candidate + '\n',
    );
    marketplace = `astack-trial-${candidate.slice(0, 8)}-${Date.now()}`;
    await writeFile(
      join(snapshot, '.agents/plugins/marketplace.json'),
      JSON.stringify({
        name: marketplace,
        plugins: [
          {
            name: 'applification',
            source: { source: 'local', path: './plugins/applification' },
            policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
          },
        ],
      }),
    );
    config = [
      '-c',
      `marketplaces.${marketplace}.source_type="local"`,
      '-c',
      `marketplaces.${marketplace}.source=${JSON.stringify(snapshot)}`,
      '-c',
      `plugins={"applification@${marketplace}"={enabled=true}}`,
    ];
    const expected = await fileDigests(join(snapshot, 'plugins/applification'));
    const versionEntries = await Promise.all(
      ['codex', 'bun', 'node'].map(async (tool) => [
        tool,
        (await command([tool, '--version'], snapshot)).trim(),
      ]),
    );
    const versions: Record<string, string> = {};
    for (const [tool, version] of versionEntries)
      if (tool && version) versions[tool] = version;
    const profileSourceDigest = await sourceDigest(
      join(snapshot, 'examples/foundation'),
    );
    const install = await command(
      [
        'codex',
        'plugin',
        'add',
        `applification@${marketplace}`,
        '--json',
        ...config,
      ],
      snapshot,
      process.env,
    );
    installed = true;
    const verifiedInstall = await installedCandidate(marketplace, expected);
    event('Installed exact committed candidate plugin.');
    await command(
      ['bun', 'install', '--frozen-lockfile'],
      join(snapshot, 'examples/foundation'),
    );
    event('Installed frozen dependencies for the trusted candidate verifier.');
    await writeFile(
      join(output, 'candidate.json'),
      JSON.stringify(
        {
          candidate,
          harnessIdentity,
          rubricDigest: digest(rubricText),
          marketplace,
          installedDigest: verifiedInstall.digest,
          installedFiles: verifiedInstall.files,
          sourceFiles: expected,
          profileSourceDigest,
          deliverySandbox,
          reviewerSandbox: 'read-only',
          versions,
          host: { platform: platform(), release: release(), arch: arch() },
          model: options.model,
          reasoning: options.reasoning ?? null,
          install: JSON.parse(install) as unknown,
          isolation:
            'Fresh ephemeral delivery and reviewer processes, separate disposable Git projects per stage; no conversation reuse or recursive delegation. User config ignored, explicit configured model, CLI authentication reused. Personal skills/system instructions may remain available.',
        },
        null,
        2,
      ),
    );
    await writeReport();
    await runTrialRounds(rounds, concurrency, async (round) => {
      event('Started independent round.', `round-${round}`);
      for (const kind of ['creation', 'feature', 'bug'] as const) {
        const name = `round-${round}-${kind}`,
          workspace = join(temporary, name),
          retained = join(output, name);
        let project = workspace;
        await mkdir(retained, { recursive: true });
        if (kind === 'creation') {
          await mkdir(workspace);
          await command(['git', 'init'], workspace);
          await commit(workspace, 'Empty disposable creation workspace');
          project = join(workspace, 'app');
        } else {
          await command(
            ['bun', join(snapshot, 'scripts/create-foundation.ts'), project],
            snapshot,
          );
          await command(['git', 'init'], project);
          await command(['bun', 'install', '--frozen-lockfile'], project);
          await commit(project, 'Disposable trial baseline');
        }
        event(
          kind === 'creation'
            ? 'Prepared empty Git workspace; candidate must scaffold app/.'
            : 'Prepared independent scaffolded Git project with frozen dependencies.',
          name,
        );
        let before: Acceptance | null = null;
        if (kind === 'bug') {
          const path = join(project, 'packages/backend/convex/workItems.ts');
          await writeFile(path, seedStatusDefect(await readFile(path, 'utf8')));
          await commit(project, 'Seed status regression');
          before = await trustedAcceptance(
            snapshot,
            project,
            join(retained, 'before'),
            kind,
          );
          event(
            'Seeded status mutation and ran trusted before-fix acceptance.',
            name,
          );
          if (!seedWasObserved(before)) {
            await writeFile(
              join(retained, 'seed-error.json'),
              JSON.stringify(before, null, 2),
            );
            throw new Error(
              'Seeded regression was not observed at the persisted status R3 check; trial is inconclusive.',
            );
          }
        }
        const baseline = (
          await command(['git', 'rev-parse', 'HEAD'], workspace)
        ).trim();
        const task =
          kind === 'creation'
            ? `Create the supported Convex + WorkOS + MCP foundation in app/ from this empty Git workspace. Invoke the candidate scaffold at ${join(snapshot, 'scripts/create-foundation.ts')} with the new app/ destination. Install the frozen lock, establish project checks, and demonstrate the local running web/MCP readiness flow. Retain the generated project and evidence; use the existing workspace Git repository.`
            : kind === 'feature'
              ? 'Add title editing for an existing work item through the web and MCP. Preserve ownership checks and validate non-empty titles. The stable contract is MCP tool work_items_update_title({id,title}) and Convex workItems:updateTitle({id,title}). Web row action has accessible button `Edit <current title>`, dialog `Edit work item`, exact textbox `Title`, and button `Save changes`. Prove web edits survive a fresh backend/MCP read, MCP edits survive a fresh backend/web read, empty titles are rejected, and another user cannot edit the owner’s item. Preserve baseline behavior.'
              : 'Marking a work item done leaves it open, and reopening can leave it done. Reproduce the defect through the running product before fixing it. Fix the persisted status mutation, retain a meaningful regression, and prove done and reopen changes agree across web, fresh backend reads, and MCP. Preserve ownership and validation boundaries.';
        await writeFile(join(retained, 'task.txt'), task);
        const agent = await runAgent({
          cwd: workspace,
          directory: join(retained, 'task'),
          config,
          model: options.model,
          sandbox: deliverySandbox,
          reasoning: options.reasoning,
          prompt: `$applification:astack ${task}\n\nThis is an authorized disposable local trial. Complete changes and proof; do not publish a PR, push, merge, delegate recursively, weaken checks or contact anyone. Use the project scripts, skill and feature map. Do not inspect the trial harness or evaluator rubric. Keep credentials out of evidence. Report observed checks and material gaps honestly. The caller enforces a 20-minute deadline and 80-action cap. Return structured final output; findings may be empty.`,
        });
        event(
          'Fresh delivery process completed or reached its enforced limit.',
          name,
        );
        const acceptance = await trustedAcceptance(
          snapshot,
          project,
          join(retained, 'acceptance'),
          kind,
        );
        event(
          'Ran committed task-specific acceptance against delivered source before review.',
          name,
        );
        await writeFile(
          join(retained, 'acceptance.json'),
          JSON.stringify(acceptance, null, 2),
        );
        await command(['git', 'add', '-N', '.'], workspace);
        const diffHashes = await retainTrialDiff(
          workspace,
          baseline,
          join(retained, 'change.diff'),
        );
        let deliveredFiles: Record<string, string> = {},
          workspaceEvidence: Record<string, string> = {},
          retentionManifest: string | null = null,
          workspaceEvidenceManifest: string | null = null,
          deliveredSourceDigest: string | null = null;
        try {
          deliveredSourceDigest = await sourceDigest(project);
          deliveredFiles = await retainProject(project, retained);
          retentionManifest = `${name}/retention.json`;
          if (kind === 'creation') {
            workspaceEvidence = await retainWorkspaceEvidence(
              workspace,
              retained,
            );
            workspaceEvidenceManifest = `${name}/workspace-evidence/retention.json`;
          }
        } catch (error) {
          await writeFile(
            join(retained, 'retention-error.txt'),
            redact(String(error)),
          );
        }
        const reviewer = await runAgent({
          cwd: workspace,
          directory: join(retained, 'review'),
          config,
          model: options.model,
          reasoning: options.reasoning,
          reviewer: true,
          prompt: `Independently review this disposable project against baseline ${baseline}. Intended task: ${task}\n\nPredeclared rubric:\n${rubricText}\n\nTrusted acceptance command/result (observed before review):\n${JSON.stringify(acceptance, null, 2)}\n\n${before ? `Trusted seeded before-fix observation:\n${JSON.stringify(before, null, 2)}\n\n` : ''}Delivery report:\n${JSON.stringify(agent.final, null, 2)}\n\nRetained task-specific evidence is at ${retained}; inspect product observations and project proof files, not just the agent's claims. Score each of the six named dimensions 0–2 and cite actual commands, files or observations in its evidence. A pass requires at least 10/12, no zero in meaningfulProof or scopeOwnership, and no unresolved authorization defect. The rubric must score an incomplete task honestly. Inspect correctness, authorization, supported patterns, proof claims and meaningful regressions. Set authorizationDefect=true for any unresolved authentication/ownership defect. Do not edit, publish, delegate or contact anyone. Findings must be actionable with verified file and line. Return the scored structured review, outcome complete when the review itself is complete.`,
        });
        event(
          'Fresh independent scored reviewer completed or reached its enforced limit.',
          name,
        );
        const gate = reviewGate(agent, reviewer, acceptance);
        results.push({
          round,
          kind,
          candidate,
          baseline,
          deliveredSourceDigest,
          deliveredFiles,
          retentionManifest,
          workspaceEvidence,
          workspaceEvidenceManifest,
          diffHashes,
          agent,
          reviewer,
          before,
          acceptance,
          gate,
        });
        await writeReport();
        await rm(workspace, { recursive: true, force: true });
      }
      event('Finished independent round.', `round-${round}`);
      await writeReport();
    });
  } catch (error) {
    event(`Harness interruption: ${redact(String(error))}`);
    await writeReport();
    throw error;
  } finally {
    if (installed) {
      await command(
        [
          'codex',
          'plugin',
          'remove',
          `applification@${marketplace}`,
          ...config,
        ],
        snapshot,
        process.env,
      ).then(
        () => {
          event('Removed temporary candidate plugin.');
        },
        (error: unknown) => {
          event(`Candidate cleanup failed: ${redact(String(error))}`);
        },
      );
    }
    // Retention happens per stage; incomplete harness work is preserved before cleanup.
    for (const entry of await readdir(temporary, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('round-')) continue;
      const workspace = join(temporary, entry.name);
      await retainProject(
        workspace,
        join(output, entry.name, 'interrupted'),
      ).catch(() => undefined);
      if (entry.name.endsWith('-creation'))
        await retainWorkspaceEvidence(
          workspace,
          join(output, entry.name, 'interrupted'),
        ).catch(() => undefined);
    }
    await rm(temporary, { recursive: true, force: true });
    const interventionFile = join(output, 'interventions.json');
    const interventions = z
      .object({ classification: z.string(), human: z.array(z.unknown()) })
      .parse(JSON.parse(await readFile(interventionFile, 'utf8')));
    await writeFile(
      interventionFile,
      JSON.stringify(
        { ...interventions, humanCount: interventions.human.length, harness },
        null,
        2,
      ),
    );
    await writeReport();
  }
  return orderedResults(results);
}

if (import.meta.main) {
  const value = (flag: string) => {
    const index = process.argv.indexOf(flag);
    return index < 0 ? undefined : process.argv[index + 1];
  };
  const candidate = value('--candidate'),
    rubric = value('--rubric'),
    output = value('--output'),
    model = value('--model');
  if (!candidate || !rubric || !output || !model)
    throw new Error(
      'Usage: bun scripts/trials.ts --candidate COMMIT --rubric FILE --output NEW_DIRECTORY --model CONFIGURED_MODEL [--rounds 2] [--concurrency 1|2] [--delivery-sandbox workspace-write|danger-full-access] [--reasoning EFFORT]',
    );
  const results = await runTrials({
    candidate,
    rubric,
    output,
    model,
    rounds: Number(value('--rounds') ?? 2),
    concurrency: Number(value('--concurrency') ?? 1),
    deliverySandbox: z
      .enum(['workspace-write', 'danger-full-access'])
      .parse(value('--delivery-sandbox') ?? 'workspace-write'),
    reasoning: value('--reasoning'),
  });
  if (results.some((result) => result.gate.outcome !== 'pass'))
    process.exitCode = 1;
}
