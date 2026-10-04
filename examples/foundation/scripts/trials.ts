import { spawn, spawnSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { homedir, tmpdir, platform, release, arch } from 'node:os';
import { createHash } from 'node:crypto';
import { join, resolve, relative, extname } from 'node:path';
import { z } from 'zod';
import { command, foundationRoot, redact } from './runtime';
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
};
type Acceptance = {
  outcome: 'pass' | 'fail' | 'inconclusive';
  command: string[];
  durationMs: number;
  report: unknown;
  error?: string;
};
type Stage = 'creation' | 'feature' | 'bug';
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
function descendants(pid: number): number[] {
  const output = spawnSync('ps', ['-axo', 'pid=,ppid='], {
    encoding: 'utf8',
  }).stdout;
  const entries = output
    .trim()
    .split('\n')
    .map((line) => line.trim().split(/\s+/).map(Number));
  const owned = new Set<number>([pid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [child, parent] of entries)
      if (child && parent && owned.has(parent) && !owned.has(child)) {
        owned.add(child);
        changed = true;
      }
  }
  return [...owned].reverse();
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
}): Promise<AgentRun> {
  await mkdir(options.directory, { recursive: true });
  const schemaPath = join(options.directory, 'schema.json');
  const outputSchema = options.reviewer ? reviewSchema : deliverySchema;
  await writeFile(schemaPath, JSON.stringify(z.toJSONSchema(outputSchema)));
  await writeFile(join(options.directory, 'prompt.txt'), options.prompt);
  const finalPath = join(options.directory, 'final.json');
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
    options.reviewer ? 'read-only' : 'workspace-write',
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
    stdout = '',
    stderr = '',
    termination = 'normal';
  let escalation: ReturnType<typeof setTimeout> | undefined;
  let ownedChildren: number[] = [];
  const stop = (reason: string) => {
    if (termination !== 'normal') return;
    termination = reason;
    if (!child.pid) return;
    const pid = child.pid,
      owned = descendants(pid);
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
  child.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    stdout += text;
    lines += text;
    let newline: number;
    while ((newline = lines.indexOf('\n')) >= 0) {
      const line = lines.slice(0, newline);
      lines = lines.slice(newline + 1);
      try {
        events.accept(JSON.parse(line));
      } catch {}
      if (events.completed && child.pid) ownedChildren = descendants(child.pid);
      if (events.actionIds.size >= (options.actionLimit ?? 80))
        stop('action limit');
    }
  });
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
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
  if (lines.trim()) {
    try {
      events.accept(JSON.parse(lines));
    } catch {}
  }
  await writeFile(join(options.directory, 'events.jsonl'), redact(stdout));
  await writeFile(join(options.directory, 'stderr.log'), redact(stderr));
  let final: unknown = null;
  try {
    const finalText = redact(await readFile(finalPath, 'utf8'));
    await writeFile(finalPath, finalText);
    const parsed = outputSchema.safeParse(JSON.parse(finalText));
    if (parsed.success) final = parsed.data;
  } catch {}
  return {
    outcome:
      termination !== 'normal' || !events.started || !events.completed || !final
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
  };
}

const digest = (data: Buffer | string) =>
  createHash('sha256').update(data).digest('hex');
async function fileDigests(
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
async function installedCandidate(
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
async function retainProject(
  project: string,
  retained: string,
): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name),
        name = relative(project, path);
      const proof = name.startsWith('.proof/');
      if (!isSourcePath(name) && name !== '.proof' && !proof) continue;
      if (
        proof &&
        name
          .split('/')
          .some(
            (part) =>
              part.startsWith('.env') ||
              ['node_modules', '.git', '.convex'].includes(part),
          )
      )
        continue;
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        const bytes = await readFile(path);
        hashes[name] = digest(bytes);
        const destination = join(retained, 'delivered', name);
        await mkdir(resolve(destination, '..'), { recursive: true });
        const binaryImage = ['.png', '.jpg', '.jpeg', '.webp'].includes(
          extname(name),
        );
        await writeFile(
          destination,
          binaryImage ? bytes : redact(bytes.toString('utf8')),
        );
      }
      // Symlinks are not followed or copied into evidence.
    }
  }
  await visit(project);
  await writeFile(
    join(retained, 'delivered-files.json'),
    JSON.stringify(hashes, null, 2),
  );
  return hashes;
}

export function trialRounds(value: number): number {
  if (!Number.isInteger(value) || value < 2)
    throw new Error('At least two whole independent rounds are required.');
  return value;
}

/** Explicit invocation only. The trials grant no merge, publication or deployment authority. */
export async function runTrials(options: {
  candidate: string;
  rubric: string;
  output: string;
  rounds?: number;
  model: string;
  reasoning?: string | undefined;
}) {
  const rounds = trialRounds(options.rounds ?? 2);
  if (!options.model.trim())
    throw new Error(
      'Supply the configured model explicitly; user configuration is ignored for isolation.',
    );
  const repo = resolve(foundationRoot, '../..'),
    output = resolve(options.output);
  const candidate = (
    await command(['git', 'rev-parse', `${options.candidate}^{commit}`], repo)
  ).trim();
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
  const results: Record<string, unknown>[] = [],
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
  const writeReport = async () => {
    const completed = results.length === rounds * 3;
    const allPassed =
      completed &&
      results.every((result) => (result.gate as ReviewGate).outcome === 'pass');
    const conclusive =
      completed &&
      results.every(
        (result) => (result.gate as ReviewGate).outcome !== 'inconclusive',
      );
    await writeFile(
      join(output, 'report.json'),
      JSON.stringify(
        {
          format: 'astack-foundation-trials/v2',
          candidate,
          rubricDigest: digest(rubricText),
          rounds,
          requiredStages: ['creation', 'feature', 'bug'],
          model: options.model,
          reasoning: options.reasoning ?? null,
          outcome: allPassed ? 'pass' : conclusive ? 'fail' : 'inconclusive',
          limits: { taskMs: 20 * 60_000, reviewerMs: 20 * 60_000, actions: 80 },
          results,
          harness,
          interventionRecord: 'interventions.json',
          interpretation:
            'A pass requires every task in at least two independent rounds to complete trusted product acceptance and the predeclared scored independent review. Live WorkOS and installed ChatGPT remain separate proof gaps.',
        },
        null,
        2,
      ),
    );
  };
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
      `plugins."applification@${marketplace}".enabled=true`,
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
          rubricDigest: digest(rubricText),
          marketplace,
          installedDigest: verifiedInstall.digest,
          installedFiles: verifiedInstall.files,
          sourceFiles: expected,
          profileSourceDigest,
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
    for (let round = 1; round <= rounds; round++) {
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
        const diff = await command(['git', 'diff', baseline, '--'], workspace);
        await writeFile(join(retained, 'change.diff'), redact(diff));
        let deliveredFiles: Record<string, string> = {},
          deliveredSourceDigest: string | null = null;
        try {
          deliveredSourceDigest = await sourceDigest(project);
          deliveredFiles = await retainProject(project, retained);
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
          agent,
          reviewer,
          before,
          acceptance,
          gate,
        });
        await writeReport();
        await rm(workspace, { recursive: true, force: true });
      }
    }
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
  return results;
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
      'Usage: bun scripts/trials.ts --candidate COMMIT --rubric FILE --output NEW_DIRECTORY --model CONFIGURED_MODEL [--rounds 2] [--reasoning EFFORT]',
    );
  const results = await runTrials({
    candidate,
    rubric,
    output,
    model,
    rounds: Number(value('--rounds') ?? 2),
    reasoning: value('--reasoning'),
  });
  if (results.some((result) => (result.gate as ReviewGate).outcome !== 'pass'))
    process.exitCode = 1;
}
