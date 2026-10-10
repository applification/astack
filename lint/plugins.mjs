import { Validator } from '@cfworker/json-schema';
import { readFileSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { roles } from '../skills/setup-astack/scripts/models.mjs';
const root = resolve(import.meta.dir, '..');
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function record(value) {
  return isRecord(value) ? value : {};
}
function prose(source) {
  // Code samples describe the adopting project, not files in this package.
  return source.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '');
}
function contained(base, value) {
  if (!value.startsWith('./') || value.split('/').includes('..')) throw new Error(`Invalid package path: ${value}`);
  const path = resolve(base, value);
  if (!existsSync(path)) throw new Error(`Missing package path: ${value}`);
  const rel = relative(realpathSync(base), realpathSync(path));
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Package escape: ${value}`);
  return path;
}
function checkSkills(base) {
  const skills = resolve(base, 'skills');
  const names = new Set();
  for (const folder of readdirSync(skills)) {
    const entry = contained(base, `./skills/${folder}/SKILL.md`);
    const source = readFileSync(entry, 'utf8');
    const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
    const metadata = record(frontmatter ? Bun.YAML.parse(frontmatter) : null);
    const name = metadata?.name;
    const description = metadata?.description;
    if (typeof name !== 'string' || !/^[a-z0-9-]+$/.test(name) || typeof description !== 'string' || !description.trim() || description.length > 1024) throw new Error(`Missing or invalid skill identity: ${entry}`);
    if (names.has(name)) throw new Error(`Duplicate skill name: ${name}`);
    names.add(name);
    if (name !== folder) throw new Error(`Skill name differs from folder: ${folder}/${name}`);
    // These are astack's authoring requirements; the portable format allows
    // UI metadata to be optional. Validate parsed YAML, not matching headings.
    const short = record(metadata.metadata)['short-description'];
    if (typeof short !== 'string' || short.length < 25 || short.length > 64) throw new Error(`Invalid skill short description: ${entry}`);
    const agentPath = contained(base, `./skills/${folder}/agents/openai.yaml`);
    const agent = record(Bun.YAML.parse(readFileSync(agentPath, 'utf8')));
    const ui = record(agent.interface);
    if (typeof ui?.display_name !== 'string' || !ui.display_name.trim() || ui.short_description !== short) throw new Error(`Invalid skill UI metadata: ${agentPath}`);
    const identity = `${name}`;
    const prompt = ui.default_prompt;
    if (typeof prompt !== 'string' || !new RegExp(`\\$(?:${read(resolve(base, 'plugin.json')).name}:)?${identity}(?![a-z0-9-])`).test(prompt)) throw new Error(`Skill invocation prompt differs from identity: ${agentPath}`);
    if (typeof record(agent.policy).allow_implicit_invocation !== 'boolean') throw new Error(`Invalid skill invocation policy: ${agentPath}`);
  }
  function links(directory) {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const file = resolve(directory, item.name);
      if (item.isDirectory()) { links(file); continue; }
      if (!item.name.endsWith('.md')) continue;
      for (const match of prose(readFileSync(file, 'utf8')).matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
        const url = match[1];
        if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('#')) continue;
        const target = resolve(dirname(file), decodeURIComponent(url.split('#')[0]));
        if (!existsSync(target)) throw new Error(`Missing skill link: ${file} -> ${url}`);
        const rel = relative(realpathSync(base), realpathSync(target));
        if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Skill link escapes package: ${file} -> ${url}`);
        const anchor = url.split('#')[1];
        if (anchor && target.endsWith('.md')) {
          const headings = [...prose(readFileSync(target, 'utf8')).matchAll(/^#{1,6}\s+(.+)$/gm)]
            .map((heading) => heading[1].toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu, '').replace(/ /g, '-'));
          if (!headings.includes(decodeURIComponent(anchor))) throw new Error(`Missing skill anchor: ${file} -> ${url}`);
        }
      }
    }
  }
  links(skills);
  const playbooks = resolve(skills, 'astack/playbooks');
  const routes = new Set();
  for (const file of readdirSync(playbooks)) {
    if (!file.endsWith('.md')) continue;
    const source = readFileSync(resolve(playbooks, file), 'utf8');
    const metadata = record(Bun.YAML.parse(source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ''));
    if (metadata.name !== file.slice(0, -3) || typeof metadata.route !== 'string' || routes.has(metadata.route)) {
      throw new Error(`Invalid or duplicate playbook identity: ${file}`);
    }
    routes.add(metadata.route);
    const steps = [...prose(source).matchAll(/^(\d+)\. (.+)$/gm)].map((step) => ({ number: Number(step[1]), role: step[2].match(/^\*\*([^*]+)\*\*:/)?.[1], text: step[2] }));
    if (!steps.length || steps.some((step, index) => step.number !== index + 1 || ![...roles, 'lead'].includes(step.role))) throw new Error(`Invalid playbook role or order: ${file}`);
    if (steps.at(-1).role !== 'lead' || steps.some((step) => step.role !== 'lead' && /\]\([^)]*\/pr\/SKILL\.md\)/.test(step.text))) throw new Error(`Invalid playbook delivery owner: ${file}`);
    if (steps.some((step) => step.role === 'review' && !step.text.includes('/code-review/SKILL.md'))) throw new Error(`Missing playbook diff review: ${file}`);
  }
}
export function checkPlugin(base) {
  for (const name of ['plugin', 'mcp']) {
    const path = resolve(base, `${name}.json`);
    const schema = read(resolve(root, `lint/schemas/${name}.schema.json`));
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
  checkSkills(base);
  const servers = read(resolve(base, 'mcp.json')).mcpServers ?? {};
  for (const server of Object.values(servers)) {
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
