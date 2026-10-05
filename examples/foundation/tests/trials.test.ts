import { describe, expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import * as ts from 'typescript';
import { z } from 'zod';
import {
  reviewGate,
  runAgent,
  runTrialRounds,
  orderedResults,
  serialWrites,
  seedStatusDefect,
  seedWasObserved,
  trialRounds,
  trialConcurrency,
  descendants,
  redactTrial,
  retainProject,
  retainWorkspaceEvidence,
  retainTrialDiff,
} from '../scripts/trials';
import {
  command,
  commandBytes,
  foundationRoot,
  waitFor,
} from '../scripts/runtime';
import { isSourcePath, sourceDigest } from '../scripts/source-identity';

function deferred() {
  let resolve: () => void = () => {
    throw new Error('Deferred was not initialized');
  };
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const delivery = {
  outcome: 'complete',
  summary: 'Delivered',
  checks: ['Observed persistence'],
  gaps: [],
  findings: [],
};
const fullScores = {
  routeIntent: { score: 2, evidence: 'Task matches the selected route.' },
  scopeOwnership: { score: 2, evidence: 'Owner denial observed in R4.' },
  supportedImplementation: {
    score: 2,
    evidence: 'Supported profile dependencies retained.',
  },
  meaningfulProof: {
    score: 2,
    evidence: 'Trusted running acceptance report passes.',
  },
  recoveryRegression: {
    score: 2,
    evidence: 'Retained before/after regression.',
  },
  accurateResult: {
    score: 2,
    evidence: 'Final report matches the observations.',
  },
};
const review = { ...delivery, scores: fullScores, authorizationDefect: false };
const completed = (final: unknown) => ({
  outcome: 'completed' as const,
  final,
});

describe('independent delivery trial gates', () => {
  test('actual Git diff acquisition hashes original stdout bytes and sanitizes source only once', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'astack-trial-diff-test-'));
    const hash = (bytes: Buffer) =>
      createHash('sha256').update(bytes).digest('hex');
    try {
      await command(['git', 'init'], directory);
      await writeFile(
        join(directory, 'main.ts'),
        'export const authorization = "";\n',
      );
      await command(['git', 'add', 'main.ts'], directory);
      await command(
        [
          'git',
          '-c',
          'core.hooksPath=/dev/null',
          '-c',
          'user.name=Trial',
          '-c',
          'user.email=trial@example.invalid',
          'commit',
          '-m',
          'Baseline',
        ],
        directory,
      );
      const baseline = (
        await command(['git', 'rev-parse', 'HEAD'], directory)
      ).trim();
      const source =
        'export const authorization = `Bearer ${token}`;\nexport const fixture = "WORKOS_API_KEY=do-not-retain";\n// café 🦊\n';
      await writeFile(join(directory, 'main.ts'), source);
      const independent = spawnSync('git', ['diff', baseline, '--'], {
        cwd: directory,
      });
      expect(independent.status).toBe(0);
      const expected = independent.stdout;
      const destination = join(directory, 'change.diff');
      const hashes = await retainTrialDiff(directory, baseline, destination);
      const retained = await readFile(destination);
      expect(hashes).toEqual({
        originalSha256: hash(expected),
        retainedSha256: hash(retained),
        transformed: true,
      });
      expect(retained.toString('utf8')).toBe(
        redactTrial(expected.toString('utf8')),
      );
      expect(retained.toString('utf8')).toContain('`Bearer ${token}`;');
      expect(retained.toString('utf8')).toContain(
        '"WORKOS_API_KEY=[REDACTED]";',
      );
      expect(retained.toString('utf8')).toContain('café 🦊');
      expect(retained.toString('utf8')).not.toContain('do-not-retain');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  test('raw command output separates stderr, redacts failures and enforces its deadline', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'astack-trial-command-test-'),
    );
    try {
      const stdout = 'café 🦊 Bearer ${token}';
      const raw = await commandBytes(
        [
          'bun',
          '-e',
          `process.stdout.write(${JSON.stringify(stdout)}); process.stderr.write("separate diagnostic");`,
        ],
        directory,
      );
      expect(raw.equals(Buffer.from(stdout))).toBe(true);
      for (const [script, deadline] of [
        [
          'process.stdout.write("WORKOS_API_KEY=private-stdout"); process.stderr.write(" Bearer private-stderr"); process.exit(1);',
          2000,
        ],
        [
          'process.stdout.write("WORKOS_API_KEY=private-stdout"); process.stderr.write(" Bearer private-stderr"); setInterval(() => {}, 1000);',
          100,
        ],
      ] as const) {
        let failure: unknown;
        try {
          await commandBytes(
            ['bun', '-e', script],
            directory,
            undefined,
            deadline,
          );
        } catch (error) {
          failure = error;
        }
        expect(failure).toBeInstanceOf(Error);
        const message = failure instanceof Error ? failure.message : '';
        expect(message).toContain('[REDACTED]');
        expect(message).not.toContain('private-stdout');
        expect(message).not.toContain('private-stderr');
        if (deadline === 100)
          expect(message).toContain('exceeded its deadline');
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  test('source interpolation survives retention while actual credentials stay redacted', () => {
    const source = 'authorization: `Bearer ${runtime.tokens.mcp}`';
    expect(redactTrial(source)).toBe(source);
    const variable =
      'for (const bearer of tokens) bearer ? use(bearer) : null;';
    expect(redactTrial(variable)).toBe(variable);
    expect(redactTrial('bearer private-api-value')).toBe('Bearer [REDACTED]');
    const coloredBearer = 'Bearer \u001b[32mprivate-colored-value\u001b[0m';
    expect(redactTrial(coloredBearer)).not.toContain('private-colored-value');
    const coloredEvent = redactTrial(JSON.stringify({ output: coloredBearer }));
    expect(() => JSON.parse(coloredEvent) as unknown).not.toThrow();
    expect(coloredEvent).not.toContain('private-colored-value');
    expect(redactTrial('Bearer private-api-value')).toBe('Bearer [REDACTED]');
    const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJvd25lci1hIn0.abcdefghijklmnop';
    expect(redactTrial(jwt)).toBe('[REDACTED JWT]');
    expect(redactTrial(`Bearer \${"${jwt}"}`)).not.toContain(jwt);
    expect(redactTrial('WORKOS_API_KEY=private-api-value')).not.toContain(
      'private-api-value',
    );
    for (const quote of ["'", '"', '`']) {
      expect(redactTrial(`${quote}WORKOS_API_KEY=private-value${quote}`)).toBe(
        `${quote}WORKOS_API_KEY=[REDACTED]${quote}`,
      );
      expect(redactTrial(`${quote}Bearer private-value${quote}`)).toBe(
        `${quote}Bearer [REDACTED]${quote}`,
      );
      expect(redactTrial(`WORKOS_API_KEY: ${quote}private-value${quote}`)).toBe(
        `WORKOS_API_KEY: ${quote}[REDACTED]${quote}`,
      );
    }
    expect(redactTrial('\\"WORKOS_API_KEY\\":\\"private-value\\"')).toBe(
      '\\"WORKOS_API_KEY\\":\\"[REDACTED]\\"',
    );
    expect(
      redactTrial(
        '-----BEGIN PRIVATE KEY-----\nprivate material\n-----END PRIVATE KEY-----',
      ),
    ).toBe('[REDACTED PRIVATE KEY]');
  });
  test('retained foundation source still parses and all recorded hashes match the bytes', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'astack-trial-source-parse-'),
    );
    try {
      // Exercise all current source, independent of growing local proof archives.
      // Other cases below cover proof/media retention with controlled fixtures.
      const source = join(directory, 'source');
      const retainedRoot = join(directory, 'retained');
      await cp(foundationRoot, source, {
        recursive: true,
        filter: (path) => isSourcePath(relative(foundationRoot, path)),
      });
      await writeFile(
        join(source, 'redaction-example.txt'),
        'Authorization: Bearer local-retention-example',
      );
      await retainProject(source, retainedRoot);
      const manifest = z
        .object({
          files: z.record(
            z.string(),
            z.object({
              originalSha256: z.string(),
              retainedSha256: z.string(),
              transformed: z.boolean(),
            }),
          ),
        })
        .parse(
          JSON.parse(
            await readFile(join(retainedRoot, 'retention.json'), 'utf8'),
          ) as unknown,
        );
      const omissions = z
        .object({
          omittedFiles: z.array(
            z.object({ path: z.string(), reason: z.string() }),
          ),
        })
        .parse(
          JSON.parse(
            await readFile(join(retainedRoot, 'retention.json'), 'utf8'),
          ) as unknown,
        );
      expect(
        omissions.omittedFiles.some(
          (file) =>
            file.path === '.astack/design/work-items.pen' &&
            file.reason.includes('Pen MCP'),
        ),
      ).toBe(true);
      expect(
        await Bun.file(
          join(retainedRoot, 'delivered/.astack/design/work-items.pen'),
        ).exists(),
      ).toBe(false);
      const paths: string[] = [];
      let transformed = 0;
      for (const [name, metadata] of Object.entries(manifest.files)) {
        const original = await readFile(join(source, name));
        const retained = await readFile(join(retainedRoot, 'delivered', name));
        expect(createHash('sha256').update(original).digest('hex')).toBe(
          metadata.originalSha256,
        );
        expect(createHash('sha256').update(retained).digest('hex')).toBe(
          metadata.retainedSha256,
        );
        expect(metadata.transformed).toBe(!original.equals(retained));
        if (metadata.transformed) transformed++;
        // Historical proof artifacts preserve failed deliveries as observed.
        if (isSourcePath(name) && /\.tsx?$/.test(name))
          paths.push(join(retainedRoot, 'delivered', name));
      }
      expect(paths.length).toBeGreaterThan(20);
      expect(transformed).toBeGreaterThan(0);
      const program = ts.createProgram(paths, {
        noEmit: true,
        noResolve: true,
        noLib: true,
        jsx: ts.JsxEmit.ReactJSX,
      });
      expect(
        program.getSyntacticDiagnostics().map((diagnostic) => ({
          file: diagnostic.file.fileName,
          position: diagnostic.start,
          message: ts.flattenDiagnosticMessageText(
            diagnostic.messageText,
            '\n',
          ),
        })),
      ).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  test('process enumeration failure retains the owned group fallback without claiming detached coverage', () => {
    const unavailable = descendants(100, () => ({
      stdout: null,
      status: null,
      error: new Error('EPERM'),
    }));
    expect(unavailable.pids).toEqual([100]);
    expect(unavailable.available).toBe(false);
    expect(unavailable.observation).toContain('EPERM');
    expect(
      descendants(100, () => {
        throw new Error('denied');
      }).available,
    ).toBe(false);
    expect(
      descendants(100, () => ({
        stdout: '100 1\n101 100\n102 101\n200 1\n',
        status: 0,
      })).pids,
    ).toEqual([102, 101, 100]);
  });
  test('creation sibling evidence is sanitized and byte provenance identifies every transformation', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'astack-trial-retention-test-'),
    );
    const workspace = join(directory, 'workspace'),
      retained = join(directory, 'retained');
    const hash = (text: string) =>
      createHash('sha256').update(text).digest('hex');
    try {
      await mkdir(join(workspace, 'app'), { recursive: true });
      await mkdir(join(workspace, 'evidence/node_modules'), {
        recursive: true,
      });
      const source = 'const authorization = `Bearer ${token}`;\n';
      await writeFile(join(workspace, 'app/main.ts'), source);
      const observation = 'Observed persistence. Bearer private-api-value\n';
      await writeFile(join(workspace, 'evidence/report.md'), observation);
      await writeFile(
        join(workspace, 'evidence/.env.example'),
        'private environment',
      );
      await writeFile(join(workspace, 'evidence/private.pem'), 'private key');
      await writeFile(
        join(workspace, 'evidence/node_modules/dependency.js'),
        'dependency',
      );
      await retainProject(join(workspace, 'app'), retained);
      expect(await readFile(join(retained, 'delivered/main.ts'), 'utf8')).toBe(
        source,
      );
      expect(
        JSON.parse(
          await readFile(join(retained, 'retention.json'), 'utf8'),
        ) as unknown,
      ).toMatchObject({
        files: {
          'main.ts': {
            originalSha256: hash(source),
            retainedSha256: hash(source),
            transformed: false,
          },
        },
      });
      await retainWorkspaceEvidence(workspace, retained);
      const sibling = join(retained, 'workspace-evidence');
      const sanitized = await readFile(
        join(sibling, 'delivered/evidence/report.md'),
        'utf8',
      );
      expect(sanitized).toContain('Observed persistence');
      expect(sanitized).not.toContain('private-api-value');
      expect(
        JSON.parse(
          await readFile(join(sibling, 'retention.json'), 'utf8'),
        ) as unknown,
      ).toMatchObject({
        files: {
          'evidence/report.md': {
            originalSha256: hash(observation),
            retainedSha256: hash(sanitized),
            transformed: true,
          },
        },
      });
      for (const name of [
        '.env.example',
        'private.pem',
        'node_modules/dependency.js',
      ])
        expect(
          await Bun.file(join(sibling, 'delivered/evidence', name)).exists(),
        ).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  test('lifecycle metadata and nested evidence survive both project and creation sibling retention', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'astack-trial-lifecycle-test-'),
    );
    const workspace = join(directory, 'workspace'),
      project = join(workspace, 'app'),
      retained = join(directory, 'retained');
    const hash = (text: string) =>
      createHash('sha256').update(text).digest('hex');
    try {
      await mkdir(join(project, '.astack/feature/evidence/nested'), {
        recursive: true,
      });
      await mkdir(join(workspace, '.astack/creation/evidence'), {
        recursive: true,
      });
      await mkdir(join(workspace, '.proof'), { recursive: true });
      await mkdir(join(workspace, 'evidence'), { recursive: true });
      await writeFile(join(project, 'main.ts'), 'export const ready = true;\n');
      await writeFile(
        join(project, '.astack/feature/intent.md'),
        'Owner intent and accepted scope.\n',
      );
      const originalSourceDigest = await sourceDigest(project);
      const inline = 'Web and MCP agree. WORKOS_API_KEY=private-inline-value\n';
      const sibling = 'Creation passed. Bearer private-sibling-value\n';
      await writeFile(
        join(project, '.astack/feature/evidence/nested/report.md'),
        inline,
      );
      await writeFile(
        join(project, '.astack/feature/evidence/.env.example'),
        'excluded environment',
      );
      await writeFile(
        join(project, '.astack/feature/evidence/private-key.pem'),
        'excluded private key',
      );
      await mkdir(join(project, '.astack/feature/evidence/node_modules/pkg'), {
        recursive: true,
      });
      await writeFile(
        join(project, '.astack/feature/evidence/node_modules/pkg/index.js'),
        'excluded dependency',
      );
      await writeFile(
        join(workspace, '.astack/creation/intent.md'),
        'Scaffold lifecycle intent.\n',
      );
      await writeFile(
        join(workspace, '.astack/creation/evidence/report.md'),
        sibling,
      );
      await writeFile(
        join(workspace, '.proof/root-report.md'),
        'Root proof.\n',
      );
      await writeFile(join(workspace, 'evidence/checks.log'), 'PASS checks\n');
      await writeFile(
        join(workspace, '.astack/creation/evidence/.env'),
        'excluded environment',
      );
      await writeFile(
        join(workspace, '.astack/creation/evidence/credentials.json'),
        'excluded credentials',
      );
      expect(await sourceDigest(project)).toBe(originalSourceDigest);
      const projectHashes = await retainProject(project, retained);
      expect(projectHashes['.astack/feature/intent.md']).toBe(
        hash('Owner intent and accepted scope.\n'),
      );
      const inlinePath = '.astack/feature/evidence/nested/report.md';
      const retainedInline = await readFile(
        join(retained, 'delivered', inlinePath),
        'utf8',
      );
      expect(retainedInline).toContain('Web and MCP agree.');
      expect(retainedInline).not.toContain('private-inline-value');
      expect(
        JSON.parse(
          await readFile(join(retained, 'retention.json'), 'utf8'),
        ) as unknown,
      ).toMatchObject({
        scope: { kind: 'project', proofRoots: ['.astack', '.proof'] },
        files: {
          [inlinePath]: {
            originalSha256: hash(inline),
            retainedSha256: hash(retainedInline),
            transformed: true,
            retainedPath: `delivered/${inlinePath}`,
            transforms: ['credential-redaction'],
          },
        },
      });
      const siblingHashes = await retainWorkspaceEvidence(workspace, retained);
      const siblingPath = '.astack/creation/evidence/report.md';
      const output = join(retained, 'workspace-evidence');
      const retainedSibling = await readFile(
        join(output, 'delivered', siblingPath),
        'utf8',
      );
      expect(siblingHashes[siblingPath]).toBe(hash(sibling));
      expect(siblingHashes['.astack/creation/intent.md']).toBeDefined();
      expect(siblingHashes['.proof/root-report.md']).toBeDefined();
      expect(siblingHashes['evidence/checks.log']).toBeDefined();
      expect(retainedSibling).not.toContain('private-sibling-value');
      expect(
        JSON.parse(
          await readFile(join(output, 'retention.json'), 'utf8'),
        ) as unknown,
      ).toMatchObject({
        scope: {
          kind: 'creation-workspace-siblings',
          includedRoots: ['.astack', '.proof', 'evidence'],
          deliveredProjectExcluded: true,
        },
        files: {
          [siblingPath]: {
            originalSha256: hash(sibling),
            retainedSha256: hash(retainedSibling),
            transformed: true,
            retainedPath: `delivered/${siblingPath}`,
            transforms: ['credential-redaction'],
          },
        },
      });
      expect(
        await Bun.file(join(output, 'delivered/app/main.ts')).exists(),
      ).toBe(false);
      for (const path of [
        '.astack/feature/evidence/.env.example',
        '.astack/feature/evidence/private-key.pem',
        '.astack/feature/evidence/node_modules/pkg/index.js',
      ])
        expect(await Bun.file(join(retained, 'delivered', path)).exists()).toBe(
          false,
        );
      for (const path of [
        '.astack/creation/evidence/.env',
        '.astack/creation/evidence/credentials.json',
      ])
        expect(await Bun.file(join(output, 'delivered', path)).exists()).toBe(
          false,
        );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  test('binary evidence is omitted honestly while supported image bytes stay exact', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'astack-trial-binary-test-'),
    );
    const project = join(directory, 'project'),
      retained = join(directory, 'retained');
    const hash = (bytes: Buffer) =>
      createHash('sha256').update(bytes).digest('hex');
    try {
      await mkdir(join(project, '.proof'), { recursive: true });
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9lQAAAAASUVORK5CYII=',
        'base64',
      );
      const jwt =
        'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJvd25lci1hIn0.abcdefghijklmnop';
      const secondJwt =
        'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJvd25lci1iIn0.abcdefghijklmnop';
      const binaries: Record<string, Buffer> = {
        '.proof/trace.zip': Buffer.from([80, 75, 3, 4, 0, 255]),
        '.proof/report.gz': gzipSync('WORKOS_API_KEY=compressed-private-value'),
        '.proof/font.woff2': Buffer.from([119, 79, 70, 50, 0, 255]),
        '.proof/custom.data': Buffer.from([0, 255, 128]),
        '.proof/zip-disguised.log': Buffer.from(
          'PK\u0003\u0004compressed bytes without a NUL',
        ),
        '.proof/gzip-disguised.log': gzipSync('PASS checks'),
        '.proof/nul-disguised.log': Buffer.from('PASS\u0000binary'),
        '.proof/fake.png': Buffer.from('Bearer private-value'),
        [`.proof/${jwt}.zip`]: Buffer.from([80, 75, 3, 4]),
        [`.proof/${secondJwt}.zip`]: Buffer.from([80, 75, 3, 4, 8]),
      };
      for (const [name, bytes] of Object.entries(binaries))
        await writeFile(join(project, name), bytes);
      await writeFile(join(project, '.proof/screenshot.png'), png);
      await writeFile(
        join(project, '.proof/private-key.zip'),
        Buffer.from('private key material'),
      );
      await writeFile(
        join(project, '.proof/report.md'),
        'Observed persistence.\n',
      );
      const coloredLog =
        '\u001b[32mPASS observed persistence\u001b[0m\n\u001b]8;;https://example.invalid/?WORKOS_API_KEY=private-link-value\u0007FAILED validation\u001b]8;;\u0007\nbackspace\b\b preserved\u0007\nWORKOS_API_KEY=private-log-value\nBearer \u001b[32mprivate-colored-value\u001b[0m\nWORKOS_API_KEY=\u0007private-leading-api-value\nBearer \b private-leading-bearer-value\nBearer embedded-credential\bcredential-tail\n';
      await writeFile(join(project, '.proof/runtime.log'), coloredLog);
      const hashes = await retainProject(project, retained);
      expect(hashes['.proof/screenshot.png']).toBe(hash(png));
      expect(
        (
          await readFile(join(retained, 'delivered/.proof/screenshot.png'))
        ).equals(png),
      ).toBe(true);
      const retainedLog = await readFile(
        join(retained, 'delivered/.proof/runtime.log'),
        'utf8',
      );
      expect(retainedLog).toContain('PASS observed persistence');
      expect(retainedLog).toContain('FAILED validation');
      expect(retainedLog).toContain('backspace\\u0008\\u0008 preserved\\u0007');
      expect(retainedLog).not.toContain('\u001b');
      expect(retainedLog).not.toContain('private-link-value');
      expect(retainedLog).toContain('WORKOS_API_KEY=[REDACTED]');
      expect(retainedLog).not.toContain('private-log-value');
      expect(retainedLog).not.toContain('private-colored-value');
      for (const value of [
        'private-leading-api-value',
        'private-leading-bearer-value',
        'embedded-credential',
        'credential-tail',
      ])
        expect(retainedLog).not.toContain(value);
      expect(hashes['.proof/runtime.log']).toBe(hash(Buffer.from(coloredLog)));
      expect(
        JSON.parse(
          await readFile(join(retained, 'retention.json'), 'utf8'),
        ) as unknown,
      ).toMatchObject({
        files: {
          '.proof/runtime.log': {
            originalSha256: hash(Buffer.from(coloredLog)),
            retainedSha256: hash(Buffer.from(retainedLog)),
            transformed: true,
            retainedPath: 'delivered/.proof/runtime.log',
            transforms: [
              'terminal-control-normalization',
              'credential-redaction',
            ],
          },
        },
      });
      const manifestText = await readFile(
        join(retained, 'retention.json'),
        'utf8',
      );
      const manifest = z
        .object({
          omittedFiles: z.array(
            z.object({
              path: z.string(),
              originalSha256: z.string(),
              sizeBytes: z.number(),
              reason: z.string(),
            }),
          ),
          excludedPaths: z.object({
            privateOrCredentialPaths: z.number(),
            namesRetained: z.boolean(),
          }),
        })
        .parse(JSON.parse(manifestText) as unknown);
      expect(manifest.excludedPaths).toEqual({
        privateOrCredentialPaths: 1,
        namesRetained: false,
      });
      expect(manifest.omittedFiles).toHaveLength(Object.keys(binaries).length);
      for (const [name, bytes] of Object.entries(binaries)) {
        const omission = manifest.omittedFiles.find(
          (file) =>
            file.originalSha256 === hash(bytes) &&
            file.path === redactTrial(name),
        );
        expect(omission).toMatchObject({
          path: redactTrial(name),
          originalSha256: hash(bytes),
          sizeBytes: bytes.length,
        });
        expect(omission?.reason).toContain('omitted');
        expect(await Bun.file(join(retained, 'delivered', name)).exists()).toBe(
          false,
        );
        expect(hashes[name]).toBeUndefined();
      }
      expect(manifestText).not.toContain(jwt);
      expect(manifestText).not.toContain(secondJwt);
      expect(
        manifest.omittedFiles.filter(
          (file) => file.path === '.proof/[REDACTED JWT].zip',
        ),
      ).toHaveLength(2);
      expect(manifestText).not.toContain('private-key.zip');
      expect(manifestText).not.toContain('compressed-private-value');
      expect(
        await Bun.file(
          join(retained, 'delivered/.proof/private-key.zip'),
        ).exists(),
      ).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  test('concurrent rounds stay bounded and preserve every round’s stage order', async () => {
    for (const value of [0, 3, 1.5, Number.NaN])
      expect(() => trialConcurrency(value)).toThrow();
    expect(trialConcurrency(1)).toBe(1);
    expect(trialConcurrency(2)).toBe(2);
    let active = 0,
      maximum = 0;
    const observed: { round: number; kind: 'creation' | 'feature' | 'bug' }[] =
      [];
    await runTrialRounds(4, 2, async (round) => {
      active += 1;
      maximum = Math.max(maximum, active);
      for (const kind of ['creation', 'feature', 'bug'] as const) {
        observed.push({ round, kind });
        await Bun.sleep(1);
      }
      active -= 1;
    });
    expect(maximum).toBe(2);
    for (let round = 1; round <= 4; round++)
      expect(
        observed
          .filter((entry) => entry.round === round)
          .map((entry) => entry.kind),
      ).toEqual(['creation', 'feature', 'bug']);
    expect(
      orderedResults(observed).map((entry) => `${entry.round}-${entry.kind}`),
    ).toEqual(
      Array.from({ length: 4 }, (_, index) =>
        ['creation', 'feature', 'bug'].map((kind) => `${index + 1}-${kind}`),
      ).flat(),
    );
    const sequential: number[] = [];
    await runTrialRounds(2, 1, async (round) => {
      sequential.push(round);
      await Bun.sleep(1);
    });
    expect(sequential).toEqual([1, 2]);
  });
  test('a failed round prevents new assignments and cleanup waits for every started round', async () => {
    const startedFirst = deferred(),
      startedSecond = deferred();
    const failFirst = deferred(),
      finishSecond = deferred();
    const started: number[] = [];
    const finished: number[] = [];
    let cleanupStarted = false;
    const running = runTrialRounds(4, 2, async (round) => {
      started.push(round);
      if (round === 1) {
        startedFirst.resolve();
        await failFirst.promise;
        throw new Error('round failed');
      }
      startedSecond.resolve();
      await finishSecond.promise;
      finished.push(round);
    }).finally(() => {
      cleanupStarted = true;
    });
    const rejection = assert.rejects(running, /round failed/);
    await Promise.all([startedFirst.promise, startedSecond.promise]);
    failFirst.resolve();
    await Bun.sleep(1);
    expect(cleanupStarted).toBe(false);
    expect(started).toEqual([1, 2]);
    finishSecond.resolve();
    await rejection;
    expect(cleanupStarted).toBe(true);
    expect(finished).toEqual([2]);
    expect(started).toEqual([1, 2]);
  });
  test('report writes cannot overlap and later writes recover after a failure', async () => {
    const enqueue = serialWrites(),
      release = deferred();
    const trace: string[] = [];
    const first = enqueue(async () => {
      trace.push('first started');
      await release.promise;
      trace.push('first finished');
      throw new Error('write failed');
    });
    const rejection = assert.rejects(first, /write failed/);
    const second = enqueue(() => {
      trace.push('second started');
      return Promise.resolve();
    });
    await Bun.sleep(1);
    expect(trace).toEqual(['first started']);
    release.resolve();
    await Promise.all([rejection, second]);
    expect(trace).toEqual([
      'first started',
      'first finished',
      'second started',
    ]);
  });
  test('a green process or a delivery claim cannot substitute for scored review', () => {
    expect(
      reviewGate(completed(delivery), completed(delivery), { outcome: 'pass' })
        .outcome,
    ).toBe('inconclusive');
    expect(
      reviewGate(completed(delivery), completed(review), { outcome: 'pass' })
        .outcome,
    ).toBe('pass');
  });
  test('failed acceptance, incomplete delivery, and unresolved authorization each prevent pass', () => {
    expect(
      reviewGate(completed(delivery), completed(review), { outcome: 'fail' })
        .outcome,
    ).toBe('fail');
    expect(
      reviewGate(
        completed({ ...delivery, outcome: 'partial' }),
        completed(review),
        { outcome: 'pass' },
      ).outcome,
    ).toBe('fail');
    expect(
      reviewGate(
        completed(delivery),
        completed({ ...review, authorizationDefect: true }),
        { outcome: 'pass' },
      ).outcome,
    ).toBe('fail');
  });
  test('the total threshold cannot hide a zero in proof or scope', () => {
    for (const dimension of ['meaningfulProof', 'scopeOwnership'] as const) {
      const scores = {
        ...fullScores,
        [dimension]: { score: 0, evidence: 'Missing required observation.' },
      };
      const gate = reviewGate(
        completed(delivery),
        completed({ ...review, scores }),
        { outcome: 'pass' },
      );
      expect(gate.total).toBe(10);
      expect(gate.outcome).toBe('fail');
    }
  });
  test('missing or out-of-range scores cannot pass; fewer than two rounds cannot run', () => {
    expect(
      reviewGate(
        completed(delivery),
        completed({
          ...review,
          scores: {
            ...fullScores,
            meaningfulProof: { score: 3, evidence: 'Claim' },
          },
        }),
        { outcome: 'pass' },
      ).outcome,
    ).toBe('inconclusive');
    for (const value of [0, 1, 2.5, Number.NaN])
      expect(() => trialRounds(value)).toThrow();
    expect(trialRounds(2)).toBe(2);
  });
  test('the maintained seed changes persisted status only and requires its running R3 failure', () => {
    const source =
      'await ctx.db.patch(args.id, { status: args.status });\nreturn { status: args.status };';
    const seeded = seedStatusDefect(source);
    expect(seeded).toContain(
      "status: args.status === 'done' ? 'open' : 'done'",
    );
    expect(seeded).toContain('return { status: args.status };');
    expect(() => seedStatusDefect(source + source)).toThrow();
    expect(
      seedWasObserved({
        outcome: 'fail',
        report: { outcome: 'fail', checks: [{ id: 'setup', outcome: 'fail' }] },
      }),
    ).toBe(false);
    expect(
      seedWasObserved({
        outcome: 'fail',
        report: { outcome: 'fail', checks: [{ id: 'R3', outcome: 'fail' }] },
      }),
    ).toBe(true);
  });
  test('fresh process accounting retains observed usage and caps a continuing action stream', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'astack-trial-process-test-'),
    );
    const previousPath = process.env.PATH;
    try {
      const executable = join(directory, 'codex');
      await writeFile(
        executable,
        `#!/usr/bin/env bun
import { writeFileSync } from 'node:fs';
const args = process.argv;
const finalPath = args[args.indexOf('-o') + 1];
writeFileSync(new URL('invocation.json', import.meta.url).pathname, JSON.stringify(args));
let prompt = '';
for await (const chunk of process.stdin) prompt += chunk;
console.log(JSON.stringify({type:'thread.started'}));
if (prompt.includes('cap-probe')) {
  console.log(JSON.stringify({type:'item.started',item:{id:'one',type:'command_execution'}}));
  setInterval(() => {}, 100);
} else if (prompt.includes('stream-probe')) {
  const event = Buffer.from(JSON.stringify({type:'item.completed',unicode:'café 🦊',note:'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJvd25lci1hIn0.abcdefghijklmnop Bearer private-token'}));
  const split = event.indexOf(Buffer.from('🦊')) + 2;
  process.stdout.write(event.subarray(0, split));
  await Bun.sleep(20);
  process.stdout.write(event.subarray(split));
  process.stdout.write('\\n');
  while (!(await Bun.file(new URL('release', import.meta.url).pathname).exists())) await Bun.sleep(10);
  writeFileSync(finalPath, JSON.stringify(${JSON.stringify(delivery)}));
  process.stdout.write(JSON.stringify({type:'turn.completed',usage:{input_tokens:20,output_tokens:5}}));
} else if (prompt.includes('final-secret-probe')) {
  writeFileSync(finalPath, JSON.stringify({...${JSON.stringify(delivery)}, summary:'Checked WORKOS_API_KEY=private-final-value and quoted "result".', checks:['Bearer private-final-bearer'], ...(prompt.includes('invalid') ? {WORKOS_API_KEY:'private-extra-value'} : {})}));
  console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:20,output_tokens:5}}));
} else {
  if (prompt.includes('plugin-startup-probe')) console.error('failed to load plugin: invalid plugin name');
  writeFileSync(finalPath, JSON.stringify(args[args.indexOf('-s') + 1] === 'read-only' ? ${JSON.stringify(review)} : ${JSON.stringify(delivery)}));
  console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:20,output_tokens:5}}));
}
`,
      );
      await chmod(executable, 0o755);
      process.env.PATH = `${directory}:${previousPath ?? ''}`;
      const agent = await runAgent({
        cwd: directory,
        directory: join(directory, 'completed'),
        prompt: 'complete-probe',
        config: [],
        model: 'fixture-model',
        timeoutMs: 2000,
        sandbox: 'danger-full-access',
      });
      expect(agent.outcome).toBe('completed');
      expect(agent.usage).toEqual([{ input_tokens: 20, output_tokens: 5 }]);
      expect(agent.sandbox).toBe('danger-full-access');
      expect(
        JSON.parse(
          await readFile(join(directory, 'invocation.json'), 'utf8'),
        ) as unknown,
      ).toContain('danger-full-access');
      expect(
        await readFile(join(directory, 'completed/events.jsonl'), 'utf8'),
      ).toContain('turn.completed');
      const failedPlugin = await runAgent({
        cwd: directory,
        directory: join(directory, 'failed-plugin'),
        prompt: 'plugin-startup-probe',
        config: ['-c', 'plugins={"applification@fixture"={enabled=true}}'],
        model: 'fixture-model',
        timeoutMs: 2000,
      });
      expect(failedPlugin.exitCode).toBe(0);
      expect(failedPlugin.final).toEqual(delivery);
      expect(failedPlugin.outcome).toBe('inconclusive');
      expect(
        reviewGate(failedPlugin, completed(review), { outcome: 'pass' })
          .outcome,
      ).toBe('inconclusive');
      for (const invalid of [false, true]) {
        const name = invalid ? 'invalid-final' : 'valid-final';
        const result = await runAgent({
          cwd: directory,
          directory: join(directory, name),
          prompt: `${invalid ? 'invalid-' : ''}final-secret-probe`,
          config: [],
          model: 'fixture-model',
          timeoutMs: 2000,
        });
        expect(result.outcome).toBe(invalid ? 'inconclusive' : 'completed');
        const retained = await readFile(
          join(directory, name, 'final.json'),
          'utf8',
        );
        expect(() => JSON.parse(retained) as unknown).not.toThrow();
        expect(retained).not.toContain('private-final-value');
        expect(retained).not.toContain('private-final-bearer');
        expect(retained).not.toContain('private-extra-value');
        expect(result.outputHashes.final?.retainedSha256).toBe(
          createHash('sha256').update(retained).digest('hex'),
        );
        if (!invalid)
          expect(result.final).toEqual({
            ...delivery,
            summary: 'Checked WORKOS_API_KEY=[REDACTED] and quoted "result".',
            checks: ['Bearer [REDACTED]'],
          });
        else expect(result.final).toBeNull();
      }
      await writeFile(
        join(directory, 'ps'),
        '#!/usr/bin/env bun\nprocess.stderr.write("EPERM"); process.exit(1);\n',
      );
      await chmod(join(directory, 'ps'), 0o755);
      const capped = await runAgent({
        cwd: directory,
        directory: join(directory, 'capped'),
        prompt: 'cap-probe',
        config: [],
        model: 'fixture-model',
        actionLimit: 1,
        timeoutMs: 2000,
      });
      expect(capped.outcome).toBe('inconclusive');
      expect(capped.termination).toBe('action limit');
      expect(capped.usage).toEqual([]);
      expect(capped.usageReason).toContain('unavailable');
      expect(capped.processCleanup.descendantEnumeration).toBe('limited');
      const reviewer = await runAgent({
        cwd: directory,
        directory: join(directory, 'reviewed'),
        prompt: 'review-probe',
        config: [],
        model: 'fixture-model',
        reviewer: true,
        sandbox: 'danger-full-access',
        timeoutMs: 2000,
      });
      expect(reviewer.sandbox).toBe('read-only');
      expect(
        JSON.parse(
          await readFile(join(directory, 'invocation.json'), 'utf8'),
        ) as unknown,
      ).toContain('read-only');
      let streamingFinished = false;
      const streaming = runAgent({
        cwd: directory,
        directory: join(directory, 'streamed'),
        prompt: 'stream-probe',
        config: [],
        model: 'fixture-model',
        timeoutMs: 2000,
      }).then((result) => {
        streamingFinished = true;
        return result;
      });
      try {
        const live = await waitFor(
          async () => {
            const text = await readFile(
              join(directory, 'streamed/events.jsonl'),
              'utf8',
            );
            return text.includes('[REDACTED JWT]') ? text : false;
          },
          'redacted live JSONL',
          1000,
        );
        expect(streamingFinished).toBe(false);
        expect(live).toContain('Bearer [REDACTED]');
        expect(live).toContain('café 🦊');
        expect(live).not.toContain('abcdefghijklmnop');
        expect(live).not.toContain('private-token');
      } finally {
        await writeFile(join(directory, 'release'), 'continue');
        await streaming;
      }
      const retained = await readFile(
        join(directory, 'streamed/events.jsonl'),
        'utf8',
      );
      expect(retained).toContain('turn.completed');
      expect(retained).toContain('café 🦊');
      expect(retained.endsWith('\n')).toBe(false);
      expect(retained).not.toContain('private-token');
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      await rm(directory, { recursive: true, force: true });
    }
  });
});
