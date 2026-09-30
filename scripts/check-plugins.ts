import { Validator } from '@cfworker/json-schema';
import { readFileSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
const root = resolve(import.meta.dir, '..');
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
function contained(base: string, value: string) {
  if (!value.startsWith('./') || value.split('/').includes('..')) throw new Error(`Invalid package path: ${value}`);
  const path = resolve(base, value);
  if (!existsSync(path)) throw new Error(`Missing package path: ${value}`);
  const rel = relative(realpathSync(base), realpathSync(path));
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Package escape: ${value}`);
  return path;
}
export function checkPlugin(base: string) {
  for (const name of ['plugin', 'mcp']) {
    const path = resolve(base, `${name}.json`);
    const schema = read(resolve(root, `scripts/schemas/${name}.schema.json`));
    const result = new Validator(schema, '2020-12').validate(read(path));
    if (!result.valid) throw new Error(`${path}: ${JSON.stringify(result.errors)}`);
  }
  for (const old of ['.codex-plugin/plugin.json', '.mcp.json']) {
    if (existsSync(resolve(base, old))) throw new Error(`Fallback format retained: ${base}/${old}`);
  }
  const manifest = read(resolve(base, 'plugin.json'));
  const ext = manifest.extensions?.['com.openai'];
  for (const key of ['apps', 'onboardingSkill']) if (ext?.[key]) contained(base, ext[key]);
  for (const key of ['composerIcon', 'logo', 'logoDark']) if (ext?.interface?.[key]) contained(base, ext.interface[key]);
  for (const value of ext?.interface?.screenshots ?? []) contained(base, value);
  for (const name of readdirSync(resolve(base, 'skills'))) contained(base, `./skills/${name}/SKILL.md`);
  const servers = read(resolve(base, 'mcp.json')).mcpServers ?? {};
  for (const server of Object.values(servers) as { type: string; command?: string; args?: string[] }[]) {
    for (const value of [server.command, ...(server.args ?? [])]) {
      if (value?.startsWith('${PLUGIN_ROOT}/')) contained(base, './' + value.slice('${PLUGIN_ROOT}/'.length));
    }
  }
  return manifest.name;
}
if (import.meta.main) {
  if (process.argv[2]) { checkPlugin(resolve(process.argv[2])); console.log('Portable artifact passes.'); process.exit(0); }
  const catalog = read(resolve(root, '.agents/plugins/marketplace.json'));
  for (const entry of catalog.plugins) {
    if (entry.source.source !== 'local') continue;
    const base = contained(root, entry.source.path);
    if (checkPlugin(base) !== entry.name) throw new Error('Marketplace identity differs from manifest');
  }
  console.log('Portable plugin schemas, package assets, skills and marketplace identities pass.');
}
