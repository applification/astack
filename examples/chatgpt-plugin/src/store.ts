import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
export class FileStore<T> {
  private value: T;
  constructor(private path: string, initial: T) {
    try { this.value = JSON.parse(readFileSync(path, 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; this.value = initial; }
  }
  read(): T { return structuredClone(this.value); }
  update<R>(change: (state: T) => R): R {
    const next = this.read();
    const result = change(next);
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    const temp = `${this.path}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify(next), { mode: 0o600 });
    renameSync(temp, this.path);
    this.value = next;
    return result;
  }
}
