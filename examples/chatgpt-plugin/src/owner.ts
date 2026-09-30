import { openSync, readFileSync, writeFileSync, closeSync, unlinkSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
// This file fixture has one owner. Production storage needs transactional leases.
export function acquireOwner(path: string): () => void {
  const lock = `${path}.lock`;
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  try {
    const fd = openSync(lock, 'wx', 0o600);
    writeFileSync(fd, String(process.pid)); closeSync(fd);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const pid = Number(readFileSync(lock, 'utf8'));
    if (!Number.isInteger(pid) || pid <= 0) throw new Error('Invalid owner lock; inspect it before removing it');
    try { process.kill(pid, 0); }
    catch (reason) {
      if ((reason as NodeJS.ErrnoException).code !== 'ESRCH') throw reason;
      throw new Error('Stale owner lock; stop all fixture servers, verify the PID is gone, then remove the lock manually');
    }
    throw new Error('Reference state already has an owning process');
  }
  let released = false;
  return () => { if (!released) { released = true; unlinkSync(lock); } };
}
