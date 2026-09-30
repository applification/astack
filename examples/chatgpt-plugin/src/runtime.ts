import { resolve } from 'node:path';
import { FileStore } from './store';
import { Events, freshState } from './events';
import { acquireOwner } from './owner';
export function createRuntime() {
  const path = process.env.REFERENCE_DATA ?? resolve('.data/events.json');
  const release = acquireOwner(path);
  let events: Events;
  try { events = new Events(new FileStore(path, freshState())); } catch (error) { release(); throw error; }
  process.once('exit', release);
  let pending: Promise<unknown> | undefined;
  const timer = setInterval(() => {
    if (!pending) pending = events.deliver().catch(() => console.error('Reference delivery failed; queued work retained.')).finally(() => { pending = undefined; });
  }, 1000);
  timer.unref();
  let closed = false;
  return { events, async close() { if (closed) return; closed = true; clearInterval(timer); await pending; release(); process.removeListener('exit', release); } };
}
