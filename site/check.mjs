import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const skill = read('skills/astack/SKILL.md');
const html = read('site/index.html');
const app = read('site/app.js');
const scenarios = JSON.parse(read('site/scenarios.json'));

const workflowSources = {
  Feature: 'implement', 'Bug fix': 'bug-fix', Refactor: 'refactor',
  Performance: 'performance', Investigation: 'investigate', 'Pull request': 'pr',
  'App control': 'app-control',
};
const uniqueRoutes = Object.keys(workflowSources);
for (const [route, folder] of Object.entries(workflowSources)) {
  if (!existsSync(path.join(root, `skills/${folder}/SKILL.md`)) ||
      !skill.includes(`../${folder}/SKILL.md`)) throw new Error(`Missing workflow source for ${route}`);
}
const routeKeys = { Feature: 'feature', 'Bug fix': 'bug', Refactor: 'refactor', Performance: 'performance', Investigation: 'investigation', 'Pull request': 'pr', 'App control': 'control', 'Project setup': 'setup' };
for (const name of [...uniqueRoutes, 'Project setup']) {
  const key = routeKeys[name];
  if (!html.includes(`data-map-route="${key}"`) || !app.includes(`name: '${name}'`)) {
    throw new Error('Site is missing a current route: ' + name);
  }
}
for (const [index, scenario] of scenarios.entries()) {
  if (!scenario.request || !scenario.decision) throw new Error(`Routing example ${index + 1} is incomplete.`);
  if (!Object.values(routeKeys).includes(scenario.route)) throw new Error(`Unknown route for routing example ${index + 1}.`);
}

for (const match of html.matchAll(/https:\/\/github\.com\/applification\/astack\/blob\/main\/([^"]+)/g)) {
  const target = decodeURIComponent(match[1]);
  if (!existsSync(path.join(root, target))) throw new Error('Broken repository link: ' + target);
}
for (const asset of ['styles.css', 'app.js', 'scenarios.json', 'favicon.svg']) {
  if (!existsSync(path.join(root, 'site', asset))) throw new Error('Missing site asset: ' + asset);
}

for (const folder of readdirSync(path.join(root, 'skills')).filter((name) => name.startsWith('principle-'))) {
  if (!skill.includes(`../${folder}/SKILL.md`) || !html.includes(`skills/${folder}/SKILL.md`)) {
    throw new Error(`Principle leaf is missing from the coordinator or site index: ${folder}`);
  }
}

for (const loop of readdirSync(path.join(root, 'loops')).filter((name) => name.endsWith('.md'))) {
  if (!html.includes(`loops/${loop}`)) throw new Error(`Loop is missing from the site: ${loop}`);
}

const readme = read('README.md').replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '');
for (const match of readme.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
  const url = match[1];
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('#')) continue;
  if (!existsSync(path.resolve(root, decodeURIComponent(url.split('#')[0])))) throw new Error(`Broken README link: ${url}`);
}
console.log(`Site routes, ${scenarios.length} routing examples, principle and loop indexes, and README links match this checkout.`);
