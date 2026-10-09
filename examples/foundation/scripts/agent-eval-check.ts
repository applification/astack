import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { freePort } from './runtime';
import {
  json,
  newDirectory,
  projectIdentity,
  regularFile,
  sha256,
  suiteIdentity,
  writeJson,
  type Task,
} from './agent-eval-fixture';

const outcome = z.enum(['pass', 'fail', 'inconclusive']);
const observationSchema = z
  .object({
    format: z.literal('notebook-observations/v1'),
    checks: z.array(
      z
        .object({
          id: z.string(),
          expected: z.unknown(),
          actual: z.unknown(),
          outcome: z.enum(['pass', 'fail']),
        })
        .strict(),
    ),
    requests: z.array(
      z
        .object({
          actor: z.string().nullable(),
          method: z.string(),
          path: z.string(),
          body: z.unknown(),
          status: z.number(),
          response: z.unknown(),
        })
        .strict(),
    ),
    disk: z.array(
      z
        .object({ phase: z.string(), bytes: z.string(), sha256: z.string() })
        .strict(),
    ),
  })
  .strict();
const reportSchema = z
  .object({
    format: z.literal('notebook-check/v1'),
    outcome,
    observationsSha256: z.string(),
    sourceDigest: z.string(),
    suiteDigest: z.string(),
  })
  .loose();
export type CheckReport = {
  format: 'notebook-check/v1';
  outcome: z.infer<typeof outcome>;
  task: Task;
  observationsSha256: string;
  sourceDigest: string;
  suiteDigest: string;
  [key: string]: unknown;
};
export async function verifyEvidence(
  directory: string,
  expected: CheckReport,
): Promise<z.infer<typeof outcome>> {
  try {
    const bytes = await readFile(join(directory, 'observations.json'));
    const report = reportSchema.parse(
      JSON.parse(await readFile(join(directory, 'report.json'), 'utf8')),
    );
    const observations = observationSchema.parse(
      JSON.parse(bytes.toString('utf8')),
    );
    if (
      sha256(bytes) !== report.observationsSha256 ||
      !isDeepStrictEqual(JSON.parse(json(expected)), report)
    )
      return 'inconclusive';
    if (observations.disk.some((entry) => sha256(entry.bytes) !== entry.sha256))
      return 'inconclusive';
    if (
      observations.checks.some(
        (check) =>
          (check.outcome === 'pass') !==
          isDeepStrictEqual(check.actual, check.expected),
      )
    )
      return 'inconclusive';
    if (
      report.outcome === 'pass' &&
      (observations.checks.length === 0 ||
        observations.checks.some((check) => check.outcome !== 'pass'))
    )
      return 'inconclusive';
    return report.outcome;
  } catch {
    return 'inconclusive';
  }
}

const seedNotes = [
  {
    id: 'own-seeded',
    actor: 'alice',
    title: 'Plan the weekend',
    done: false,
    archived: false,
    operationId: 'seed-alice',
  },
  {
    id: 'adjacent-seeded',
    actor: 'alice',
    title: 'Keep this note',
    done: true,
    archived: false,
    operationId: 'seed-adjacent',
  },
  {
    id: 'other-seeded',
    actor: 'bob',
    title: 'Bob private note',
    done: false,
    archived: false,
    operationId: 'seed-bob',
  },
];
const noteSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    done: z.boolean(),
    archived: z.boolean(),
  })
  .strict();
const mutationSchema = z.object({ note: noteSchema }).strict();
class ProductFailure extends Error {}

/** The oracle is this runner's source; no delivered test, script or report is trusted. */
export async function checkNotebook(options: {
  project: string;
  task: Task;
  output: string;
  startupMs?: number;
}): Promise<CheckReport> {
  const output = await newDirectory(options.output, options.project);
  const observations: z.infer<typeof observationSchema> = {
    format: 'notebook-observations/v1',
    checks: [],
    requests: [],
    disk: [],
  };
  const suite = await suiteIdentity();
  let identity: Awaited<ReturnType<typeof projectIdentity>> | null = null;
  let sourceDigest = '',
    result: z.infer<typeof outcome> = 'inconclusive',
    error: string | null = null;
  let temporary: string | null = null,
    child: ChildProcess | null = null;
  const processLogs: { phase: string; stdout: string; stderr: string }[] = [];
  let command: string[] = [],
    context: unknown = null;
  const expect = (id: string, actual: unknown, expected: unknown) => {
    observations.checks.push({
      id,
      actual,
      expected,
      outcome: isDeepStrictEqual(actual, expected) ? 'pass' : 'fail',
    });
  };
  const stop = async () => {
    if (!child) return;
    const owned = child;
    child = null;
    const alreadyExited = owned.exitCode !== null || owned.signalCode !== null;
    const closed = alreadyExited
      ? Promise.resolve()
      : new Promise<void>((done) => {
          owned.once('close', () => {
            done();
          });
        });
    // Only the service's owned process group is signaled.
    if (owned.pid) {
      try {
        process.kill(-owned.pid, 'SIGTERM');
      } catch {}
    }
    if (alreadyExited) {
      // Descendants can retain the owned group after the service itself exited.
      if (owned.pid) {
        try {
          process.kill(-owned.pid, 'SIGKILL');
        } catch {}
      }
      return;
    }
    const timer = setTimeout(() => {
      if (owned.pid) {
        try {
          process.kill(-owned.pid, 'SIGKILL');
        } catch {}
      }
    }, 1000);
    await closed;
    clearTimeout(timer);
  };
  try {
    identity = await projectIdentity(options.project);
    sourceDigest = identity.sourceDigest;
    await regularFile(join(options.project, 'server.ts'));
    temporary = await mkdtemp(join(tmpdir(), 'notebook-oracle-'));
    const dataFile = join(temporary, 'notes.json');
    await writeFile(dataFile, json({ notes: seedNotes }));
    const port = await freePort(),
      url = `http://127.0.0.1:${port}`;
    command = [process.execPath, join(options.project, 'server.ts')];
    const env = {
      PATH: process.env.PATH ?? '',
      TMPDIR: temporary,
      NOTEBOOK_PORT: String(port),
      NOTEBOOK_DATA_FILE: dataFile,
    };
    context = {
      command,
      cwd: options.project,
      env,
      actors: ['alice', 'bob'],
      authentication:
        'simulated x-actor identity; no live authentication proof',
      fixture: { notes: seedNotes },
      port,
    };
    const start = async (phase: string) => {
      const logs = { phase, stdout: '', stderr: '' };
      processLogs.push(logs);
      const owned = spawn(command[0] ?? process.execPath, command.slice(1), {
        cwd: options.project,
        env,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child = owned;
      let spawnError: Error | undefined;
      owned.on('error', (caught: Error) => {
        spawnError = caught;
      });
      owned.stdout.on('data', (chunk: Buffer) => {
        logs.stdout += chunk.toString('utf8');
      });
      owned.stderr.on('data', (chunk: Buffer) => {
        logs.stderr += chunk.toString('utf8');
      });
      const deadline = Date.now() + (options.startupMs ?? 5000);
      while (Date.now() < deadline) {
        if (spawnError || owned.exitCode !== null || owned.signalCode !== null)
          throw new Error(
            `Service unavailable: ${spawnError?.message ?? logs.stderr}`,
          );
        try {
          if (
            (await fetch(url + '/', { signal: AbortSignal.timeout(200) }))
              .status === 200
          )
            return;
        } catch {}
        await Bun.sleep(25);
      }
      throw new Error('Service unavailable within startup deadline');
    };
    const request = async (
      actor: string | null,
      method: string,
      path: string,
      body?: unknown,
      raw = false,
    ) => {
      const response = await fetch(url + path, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(actor ? { 'x-actor': actor } : {}),
        },
        ...(body === undefined
          ? {}
          : {
              body:
                raw && typeof body === 'string' ? body : JSON.stringify(body),
            }),
        signal: AbortSignal.timeout(1500),
      });
      const text = await response.text();
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch {
        value = text;
      }
      observations.requests.push({
        actor,
        method,
        path,
        body: body ?? null,
        status: response.status,
        response: value,
      });
      return { status: response.status, body: value };
    };
    const disk = async (phase: string) => {
      const bytes = await readFile(dataFile, 'utf8');
      observations.disk.push({ phase, bytes, sha256: sha256(bytes) });
      try {
        return JSON.parse(bytes) as unknown;
      } catch {
        throw new ProductFailure('Service wrote invalid disk JSON');
      }
    };
    const publicNotes = (entries: typeof seedNotes) =>
      entries.map(({ id, title, done, archived }) => ({
        id,
        title,
        done,
        archived,
      }));
    await start('initial');
    expect('initial-alice', await request('alice', 'GET', '/api/notes'), {
      status: 200,
      body: { notes: publicNotes(seedNotes.slice(0, 2)) },
    });
    expect('initial-bob', await request('bob', 'GET', '/api/notes'), {
      status: 200,
      body: { notes: publicNotes(seedNotes.slice(2)) },
    });
    expect('missing-actor', await request(null, 'GET', '/api/notes'), {
      status: 401,
      body: { error: 'unauthorized' },
    });
    expect('unknown-actor', await request('mallory', 'GET', '/api/notes'), {
      status: 401,
      body: { error: 'unauthorized' },
    });
    const target = '/api/notes/own-seeded';
    const field =
      options.task === 'bug'
        ? 'done'
        : options.task === 'feature'
          ? 'title'
          : 'archived';
    const firstValue =
      options.task === 'feature' ? '  Edited notebook  ' : true;
    expect(
      'cross-owner',
      await request('bob', 'PATCH', target, { [field]: firstValue }),
      { status: 404, body: { error: 'not found' } },
    );
    expect(
      'unknown-row',
      await request('alice', 'PATCH', '/api/notes/absent', {
        [field]: firstValue,
      }),
      { status: 404, body: { error: 'not found' } },
    );
    expect(
      'missing-actor-write',
      await request(null, 'PATCH', target, { [field]: firstValue }),
      { status: 401, body: { error: 'unauthorized' } },
    );
    for (const [index, body] of [
      null,
      [],
      {},
      { [field]: 1 },
      { [field]: null },
      { [field]: firstValue, extra: true },
      { done: false, title: 'Mixed' },
      ...(options.task === 'feature'
        ? [{ title: '' }, { title: ' \t ' }, { title: 'x'.repeat(121) }]
        : []),
    ].entries())
      expect(
        `invalid-patch-${index}`,
        await request('alice', 'PATCH', target, body),
        { status: 400, body: { error: 'invalid input' } },
      );
    expect('invalid-json', await request('alice', 'PATCH', target, '{', true), {
      status: 400,
      body: { error: 'invalid input' },
    });
    expect('rejections-preserve-disk', await disk('after-rejections'), {
      notes: seedNotes,
    });
    const firstNote = {
      id: 'own-seeded',
      title:
        options.task === 'feature' ? 'Edited notebook' : 'Plan the weekend',
      done: options.task === 'bug',
      archived: options.task === 'followup',
    };
    expect(
      'requested-change',
      await request('alice', 'PATCH', target, { [field]: firstValue }),
      { status: 200, body: { note: firstNote } },
    );
    expect('fresh-read-change', await request('alice', 'GET', '/api/notes'), {
      status: 200,
      body: {
        notes:
          options.task === 'followup'
            ? publicNotes(seedNotes.slice(1, 2))
            : [firstNote, ...publicNotes(seedNotes.slice(1, 2))],
      },
    });
    const changedSeed = seedNotes.map((note) =>
      note.id === 'own-seeded' ? { ...note, ...firstNote } : note,
    );
    expect('disk-change', await disk('after-change'), { notes: changedSeed });
    await stop();
    await start('restart-after-change');
    expect(
      'restart-change',
      await request(
        'alice',
        'GET',
        '/api/notes' +
          (options.task === 'followup' ? '?includeArchived=true' : ''),
      ),
      {
        status: 200,
        body: { notes: [firstNote, ...publicNotes(seedNotes.slice(1, 2))] },
      },
    );
    const finalNote = {
      id: 'own-seeded',
      title: options.task === 'feature' ? 'Z'.repeat(120) : 'Plan the weekend',
      done: false,
      archived: false,
    };
    expect(
      'second-change-boundary',
      await request('alice', 'PATCH', target, {
        [field]: options.task === 'feature' ? 'Z'.repeat(120) : false,
      }),
      { status: 200, body: { note: finalNote } },
    );
    for (const [index, body] of [
      { title: '', operationId: 'bad' },
      { title: '  ', operationId: 'bad' },
      { title: 'x'.repeat(121), operationId: 'bad' },
      { title: 3, operationId: 'bad' },
      { title: 'Valid', operationId: '' },
      { title: 'Valid', operationId: 'x'.repeat(65) },
      { title: 'Valid', operationId: 'bad space' },
      { title: 'Valid', operationId: 'bad', extra: true },
    ].entries())
      expect(
        `invalid-create-${index}`,
        await request('alice', 'POST', '/api/notes', body),
        { status: 400, body: { error: 'invalid input' } },
      );
    const created = await request('alice', 'POST', '/api/notes', {
      title: '  Durable new note  ',
      operationId: 'oracle-operation',
    });
    const parsed = mutationSchema.safeParse(created.body);
    expect('create-status', created.status, 201);
    if (!parsed.success)
      throw new ProductFailure('Create response lacks a complete note');
    const id = parsed.data.note.id;
    expect(
      'create-id',
      /^[a-f0-9-]{36}$/.test(id) && !seedNotes.some((note) => note.id === id),
      true,
    );
    const newNote = {
      id,
      title: 'Durable new note',
      done: false,
      archived: false,
    };
    expect('create-note', created.body, { note: newNote });
    const repeats = await Promise.all([
      request('alice', 'POST', '/api/notes', {
        title: 'Durable new note',
        operationId: 'oracle-operation',
      }),
      request('alice', 'POST', '/api/notes', {
        title: 'Durable new note',
        operationId: 'oracle-operation',
      }),
    ]);
    expect('repeated-operation', repeats, [
      { status: 200, body: { note: newNote } },
      { status: 200, body: { note: newNote } },
    ]);
    expect(
      'operation-conflict',
      await request('alice', 'POST', '/api/notes', {
        title: 'Different',
        operationId: 'oracle-operation',
      }),
      { status: 409, body: { error: 'operation conflict' } },
    );
    // Same operation ID belongs to a different actor's separate identity.
    const bobCreated = await request('bob', 'POST', '/api/notes', {
      title: 'Bob second note',
      operationId: 'oracle-operation',
    });
    const bobParsed = mutationSchema.safeParse(bobCreated.body);
    expect('actor-operation-status', bobCreated.status, 201);
    if (!bobParsed.success)
      throw new ProductFailure('Other actor create response lacks a note');
    const bobId = bobParsed.data.note.id;
    expect(
      'actor-operation-distinct',
      bobId !== id && /^[a-f0-9-]{36}$/.test(bobId),
      true,
    );
    const bobNote = {
      id: bobId,
      title: 'Bob second note',
      done: false,
      archived: false,
    };
    expect('actor-operation-note', bobCreated.body, { note: bobNote });
    const finalDisk = {
      notes: [
        ...seedNotes.map((note) =>
          note.id === 'own-seeded' ? { ...note, ...finalNote } : note,
        ),
        { ...newNote, actor: 'alice', operationId: 'oracle-operation' },
        { ...bobNote, actor: 'bob', operationId: 'oracle-operation' },
      ],
    };
    expect('final-disk', await disk('final'), finalDisk);
    await stop();
    await start('final-restart');
    expect('final-alice-restart', await request('alice', 'GET', '/api/notes'), {
      status: 200,
      body: {
        notes: [finalNote, ...publicNotes(seedNotes.slice(1, 2)), newNote],
      },
    });
    expect('final-bob-restart', await request('bob', 'GET', '/api/notes'), {
      status: 200,
      body: { notes: [...publicNotes(seedNotes.slice(2)), bobNote] },
    });
    expect('final-disk-restart', await disk('final-restart'), finalDisk);
    result = observations.checks.every((check) => check.outcome === 'pass')
      ? 'pass'
      : 'fail';
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
    result = caught instanceof ProductFailure ? 'fail' : 'inconclusive';
  } finally {
    try {
      await stop();
      if (temporary) await rm(temporary, { recursive: true, force: true });
    } catch (caught) {
      result = 'inconclusive';
      error = `Cleanup failed: ${String(caught)}`;
    }
  }
  try {
    if (
      !identity ||
      !isDeepStrictEqual(identity, await projectIdentity(options.project)) ||
      !isDeepStrictEqual(suite, await suiteIdentity())
    ) {
      result = 'inconclusive';
      error =
        'Delivered source/configuration or fixed suite changed during checking';
    }
  } catch (caught) {
    result = 'inconclusive';
    error = `Identity recheck failed: ${String(caught)}`;
  }
  const observationBytes = json(observations);
  await writeFile(join(output, 'observations.json'), observationBytes);
  await writeJson(join(output, 'service-logs.json'), processLogs);
  const report: CheckReport = {
    format: 'notebook-check/v1',
    outcome: result,
    task: options.task,
    observationsSha256: sha256(observationBytes),
    sourceDigest,
    suiteDigest: suite.digest,
    suite,
    identity,
    context,
    error,
    cleanup: 'owned service and disposable data only; evidence retained',
    coverage:
      'HTTP service, fresh reads, restart and disk. Browser interaction remains manual acceptance.',
  };
  await writeJson(join(output, 'report.json'), report);
  const verified = await verifyEvidence(output, report);
  if (verified !== report.outcome) {
    report.outcome = 'inconclusive';
    report.error = 'Retained artifact inspection failed';
    await writeJson(join(output, 'report.json'), report);
  }
  return report;
}
