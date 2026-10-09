import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:net';

test('creates, lists and retains a note across a restart', async () => {
  const scratch = join(import.meta.dir, '.notebook');
  await mkdir(scratch, { recursive: true });
  const directory = await mkdtemp(join(scratch, 'dev-test-'));
  const listener = createServer();
  await new Promise<void>((resolve) =>
    listener.listen(0, '127.0.0.1', resolve),
  );
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('No port');
  const port = address.port;
  await new Promise<void>((resolve) => {
    listener.close(() => {
      resolve();
    });
  });
  const start = () =>
    Bun.spawn([process.execPath, 'server.ts'], {
      cwd: import.meta.dir,
      env: {
        ...process.env,
        NOTEBOOK_PORT: String(port),
        NOTEBOOK_DATA_FILE: join(directory, 'notes.json'),
      },
      stdout: 'ignore',
      stderr: 'pipe',
    });
  let child = start();
  const url = `http://127.0.0.1:${port}/api/notes`;
  const headers = { 'x-actor': 'alice', 'content-type': 'application/json' };
  const ready = async () => {
    for (let n = 0; n < 100; n++) {
      try {
        if ((await fetch(url, { headers })).ok) return;
      } catch {}
      await Bun.sleep(20);
    }
    throw new Error('Server unavailable');
  };
  try {
    await ready();
    const created = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Read a book', operationId: 'dev-1' }),
    });
    expect(created.status).toBe(201);
    const value: unknown = await created.json();
    if (
      !value ||
      typeof value !== 'object' ||
      !('note' in value) ||
      !value.note ||
      typeof value.note !== 'object' ||
      !('title' in value.note)
    )
      throw new Error('Invalid create response');
    const note = value.note;
    expect(note.title).toBe('Read a book');
    child.kill();
    await child.exited;
    child = start();
    await ready();
    expect(await (await fetch(url, { headers })).json()).toEqual({
      notes: [note],
    });
    expect(
      await (await fetch(url, { headers: { 'x-actor': 'bob' } })).json(),
    ).toEqual({ notes: [] });
  } finally {
    child.kill();
    await child.exited;
    await rm(directory, { recursive: true, force: true });
  }
});
