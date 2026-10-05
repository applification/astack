import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const skill = read('plugins/applification/skills/astack/SKILL.md');
const html = read('site/index.html');
const app = read('site/app.js');
const scenarios = JSON.parse(read('site/scenarios.json'));
const evals = read('evals/routing.md');

const workflowSources = {
  Feature: 'implement', 'Bug fix': 'bug-fix', Refactor: 'refactor',
  Performance: 'performance', Investigation: 'investigate', 'Pull request': 'pr',
  'App control': 'app-control',
};
const uniqueRoutes = Object.keys(workflowSources);
for (const [route, folder] of Object.entries(workflowSources)) {
  if (!existsSync(path.join(root, `plugins/applification/skills/${folder}/SKILL.md`)) ||
      !skill.includes(`../${folder}/SKILL.md`)) throw new Error(`Missing workflow source for ${route}`);
}
const routeKeys = { Feature: 'feature', 'Bug fix': 'bug', Refactor: 'refactor', Performance: 'performance', Investigation: 'investigation', 'Pull request': 'pr', 'App control': 'control', 'Project setup': 'setup' };
for (const name of [...uniqueRoutes, 'Project setup']) {
  const key = routeKeys[name];
  if (!html.includes(`data-map-route="${key}"`) || !app.includes(`name: '${name}'`)) {
    throw new Error('Site is missing a current route: ' + name);
  }
}
const evalCases = [...evals.matchAll(/^\| "([^"]+)" \| (.*) \|$/gm)]
  .map((match) => ({ request: match[1], decision: match[2] }));
if (scenarios.length !== evalCases.length) throw new Error('Site eval examples are out of date.');
for (const [index, scenario] of scenarios.entries()) {
  if (scenario.request !== evalCases[index].request || scenario.decision !== evalCases[index].decision) {
    throw new Error(`Site eval example ${index + 1} differs from evals/routing.md.`);
  }
  if (!Object.values(routeKeys).includes(scenario.route)) throw new Error(`Unknown route for eval example ${index + 1}.`);
}

for (const match of html.matchAll(/https:\/\/github\.com\/applification\/astack\/blob\/main\/([^"]+)/g)) {
  const target = decodeURIComponent(match[1]);
  if (!existsSync(path.join(root, target))) throw new Error('Broken repository link: ' + target);
}
for (const asset of ['styles.css', 'app.js', 'scenarios.json', 'favicon.svg']) {
  if (!existsSync(path.join(root, 'site', asset))) throw new Error('Missing site asset: ' + asset);
}
console.log(`Site routes, ${scenarios.length} eval examples, and source links match this checkout.`);
