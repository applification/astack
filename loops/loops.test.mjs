import { expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const loops = readdirSync(import.meta.dir).filter((file) => file.endsWith('.md'));

test.each(loops)('%s names itself and only skills that exist', (file) => {
  const text = readFileSync(join(import.meta.dir, file), 'utf8');
  expect(text.match(/^name: (.+)$/m)?.[1]).toBe(file.replace(/\.md$/, ''));
  expect(text).toMatch(/^trigger: .+$/m);
  const declared = text.match(/^skills: \[(.+)\]$/m)?.[1]?.split(', ') ?? [];
  expect(declared.length).toBeGreaterThan(0);
  const mentioned = [...text.matchAll(/applification `([a-z-]+)` skill/g)].map((match) => match[1]);
  expect(mentioned.sort()).toEqual([...declared].sort());
  for (const skill of declared) expect(existsSync(join(root, 'skills', skill, 'SKILL.md'))).toBe(true);
});
