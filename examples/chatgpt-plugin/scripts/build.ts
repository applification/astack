import { mkdir, writeFile, readFile, cp } from 'node:fs/promises';
const ui = await Bun.build({ entrypoints: [new URL('../src/ui/app.tsx', import.meta.url).pathname], target: 'browser', format: 'esm', minify: true });
if (!ui.success) throw new AggregateError(ui.logs, 'UI bundle failed');
const js = await ui.outputs.find(output => output.path.endsWith('.js'))!.text();
const css = (await Promise.all(ui.outputs.filter(output => output.path.endsWith('.css')).map(output => output.text()))).join('\n');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script type="module">${js.replaceAll('</script', '<\\/script')}</script></html>`;
await mkdir(new URL('../dist', import.meta.url), { recursive: true });
await writeFile(new URL('../dist/records.html', import.meta.url), html);
const plugin = new URL('../dist/plugin/', import.meta.url);
await mkdir(plugin, { recursive: true });
for (const file of ['plugin.json', 'mcp.json']) await cp(new URL(`../plugin/${file}`, import.meta.url), new URL(file, plugin));
await cp(new URL('../plugin/skills', import.meta.url), new URL('skills', plugin), { recursive: true });
await writeFile(new URL('records.html', plugin), html);
for (const name of ['ui', 'events']) {
  const result = await Bun.build({ entrypoints: [new URL(`../src/${name}-stdio.ts`, import.meta.url).pathname], target: 'node', format: 'esm', minify: false });
  if (!result.success) throw new AggregateError(result.logs, `${name} bundle failed`);
  let code = await result.outputs[0].text();
  if (name === 'ui') code = code.replace('../dist/records.html', './records.html');
  await writeFile(new URL(`${name}.mjs`, plugin), code);
}
console.log('Built self-contained UI and portable plugin in dist/plugin.');

await cp(new URL('../../../LICENSE', import.meta.url), new URL('LICENSE', plugin));
const modules = new URL('../node_modules/', import.meta.url);
const notices: string[] = [];
const licenseFiles = new Bun.Glob('**/{LICENSE*,LICENCE*,license*,licence*,COPYING*}');
for await (const path of licenseFiles.scan({ cwd: modules.pathname, onlyFiles: true })) {
  notices.push(`\n--- ${path} ---\n${await readFile(new URL(path, modules), 'utf8')}`);
}
await writeFile(new URL('THIRD_PARTY_NOTICES.txt', plugin), notices.sort().join('\n'));
