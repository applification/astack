import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';

type Note = {
  id: string;
  actor: string;
  title: string;
  done: boolean;
  archived: boolean;
  operationId: string;
};
const dataFile = resolve(
  process.env.NOTEBOOK_DATA_FILE ?? '.notebook/notes.json',
);
mkdirSync(dirname(dataFile), { recursive: true });
if (!existsSync(dataFile))
  writeFileSync(dataFile, JSON.stringify({ notes: [] }));
function readNotes(): Note[] {
  const value: unknown = JSON.parse(readFileSync(dataFile, 'utf8'));
  if (
    !record(value) ||
    !Array.isArray(value.notes) ||
    !value.notes.every(isNote)
  )
    throw new Error('Invalid notebook disk data');
  return value.notes;
}
function isNote(value: unknown): value is Note {
  return (
    record(value) &&
    typeof value.id === 'string' &&
    typeof value.actor === 'string' &&
    typeof value.title === 'string' &&
    typeof value.done === 'boolean' &&
    typeof value.archived === 'boolean' &&
    typeof value.operationId === 'string'
  );
}
function saveNotes(notes: Note[]): void {
  writeFileSync(dataFile + '.tmp', JSON.stringify({ notes }, null, 2));
  renameSync(dataFile + '.tmp', dataFile);
}
const publicNote = ({ id, title, done, archived }: Note) => ({
  id,
  title,
  done,
  archived,
});
const response = (body: unknown, status = 200) =>
  Response.json(body, { status });
const invalid = () => response({ error: 'invalid input' }, 400);
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function title(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.trim().length <= 120
  );
}

Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.NOTEBOOK_PORT ?? 3000),
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/' && request.method === 'GET')
      return new Response(Bun.file(resolve(import.meta.dir, 'index.html')), {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    if (!path.startsWith('/api/')) return response({ error: 'not found' }, 404);
    const actor = request.headers.get('x-actor');
    if (actor !== 'alice' && actor !== 'bob')
      return response({ error: 'unauthorized' }, 401);
    if (path === '/api/notes' && request.method === 'GET')
      return response({
        notes: readNotes()
          .filter((note) => note.actor === actor)
          .map(publicNote),
      });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalid();
    }
    if (!record(body)) return invalid();
    if (path === '/api/notes' && request.method === 'POST') {
      if (
        Object.keys(body).sort().join(',') !== 'operationId,title' ||
        !title(body.title) ||
        typeof body.operationId !== 'string' ||
        !/^[A-Za-z0-9_-]{1,64}$/.test(body.operationId)
      )
        return invalid();
      const notes = readNotes();
      const previous = notes.find(
        (note) => note.actor === actor && note.operationId === body.operationId,
      );
      if (previous)
        return previous.title === body.title.trim()
          ? response({ note: publicNote(previous) })
          : response({ error: 'operation conflict' }, 409);
      const note: Note = {
        id: randomUUID(),
        actor,
        title: body.title.trim(),
        done: false,
        archived: false,
        operationId: body.operationId,
      };
      notes.push(note);
      saveNotes(notes);
      return response({ note: publicNote(note) }, 201);
    }
    if (path.startsWith('/api/notes/') && request.method === 'PATCH') {
      const notes = readNotes();
      const note = notes.find(
        (entry) =>
          entry.id === decodeURIComponent(path.slice('/api/notes/'.length)) &&
          entry.actor === actor,
      );
      if (!note) return response({ error: 'not found' }, 404);
      if (
        Object.keys(body).join(',') !== 'done' ||
        typeof body.done !== 'boolean'
      )
        return invalid();
      note.done = !body.done;
      saveNotes(notes);
      return response({ note: publicNote(note) });
    }
    return response({ error: 'not found' }, 404);
  },
});
