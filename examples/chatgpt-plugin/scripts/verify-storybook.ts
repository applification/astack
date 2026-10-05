import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve, join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { chromium } from 'playwright';

const root = resolve(import.meta.dir, '..');
const mode = process.argv[2] ?? 'dev';
if (!['dev', 'built'].includes(mode) || process.argv.length > 3)
  throw new Error('Usage: bun run verify:storybook [dev|built]');
const output = join(root, '.proof/storybook', `${mode}-${Date.now()}`);
await mkdir(output, { recursive: true });
const files = [
  '.storybook/main.ts',
  '.storybook/preview.ts',
  'src/ui/RecordList.tsx',
  'src/ui/RecordList.stories.tsx',
  'src/ui/style.css',
  'src/records.ts',
  'tsconfig.json',
  'package.json',
  'bun.lock',
  'scripts/verify-storybook.ts',
];
const hash = createHash('sha256');
for (const file of files.sort())
  hash.update(file + '\0').update(await readFile(join(root, file)));
const report = {
  mode,
  sourceSha256: hash.digest('hex'),
  revision: Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: root })
    .stdout.toString()
    .trim(),
  dirty: Boolean(
    Bun.spawnSync(['git', 'status', '--porcelain'], { cwd: root }).stdout
      .length,
  ),
  scope:
    'Chromium Storybook rendering and story selection; no MCP or installed-host claim.',
  outcome: 'inconclusive',
  cleanup: 'pending',
  stories: [] as { id: string; outcome: string; screenshot: string }[],
  errors: [] as string[],
};
const logs: string[] = [];
let server: ChildProcess | undefined;
let closed: Promise<void> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let checkingStories = false;
try {
  if (mode === 'built') {
    const build = Bun.spawn(['bun', 'run', 'build:storybook'], {
      cwd: root,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: '1' },
    });
    const [code, stdout, stderr] = await Promise.all([
      build.exited,
      new Response(build.stdout).text(),
      new Response(build.stderr).text(),
    ]);
    logs.push(stdout, stderr);
    assert.equal(code, 0, 'Storybook build failed');
  }
  const allocator = createServer();
  await new Promise<void>((done, fail) => {
    allocator.once('error', fail);
    allocator.listen(0, '127.0.0.1', done);
  });
  const address = allocator.address();
  assert(address && typeof address !== 'string');
  const port = address.port;
  await new Promise<void>((done, fail) =>
    allocator.close((error) => (error ? fail(error) : done())),
  );
  const args =
    mode === 'dev'
      ? [
          'storybook',
          'dev',
          '--host',
          '127.0.0.1',
          '--port',
          String(port),
          '--ci',
          '--no-open',
        ]
      : [
          'vite',
          'preview',
          '--outDir',
          'storybook-static',
          '--host',
          '127.0.0.1',
          '--port',
          String(port),
          '--strictPort',
        ];
  server = spawn('bunx', ['--no-install', ...args], {
    cwd: root,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: '1' },
  });
  const child = server;
  closed = new Promise((done) => child.once('close', () => done()));
  let startupError: Error | undefined;
  child.once('error', (error) => {
    startupError = error;
  });
  child.stdout?.on('data', (data: Buffer) => logs.push(data.toString()));
  child.stderr?.on('data', (data: Buffer) => logs.push(data.toString()));
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 90_000;
  while (true) {
    if (startupError) throw startupError;
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error('Storybook server exited before readiness.');
    const ready = await fetch(`${base}/index.json`).then(
      (response) => response.ok,
      () => false,
    );
    if (ready) break;
    if (Date.now() >= deadline) throw new Error('Storybook startup timed out.');
    await new Promise((done) => setTimeout(done, 100));
  }
  browser = await chromium.launch();
  checkingStories = true;
  for (const story of ['normal', 'selected', 'empty', 'error']) {
    const id = `reference-records--${story}`;
    const page = await browser.newPage();
    page.on('pageerror', (error) =>
      report.errors.push(`${id}: ${error.message}`),
    );
    page.on('console', (message) => {
      if (message.type() === 'error')
        report.errors.push(`${id}: ${message.text()}`);
    });
    await page.goto(`${base}/iframe.html?id=${id}&viewMode=story`);
    await page
      .getByRole('heading', { name: 'Reference records', exact: true })
      .waitFor({ timeout: 15_000 });
    if (story === 'empty') {
      await page.getByText('No records found.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button').count(), 0);
    } else {
      assert.equal(await page.getByRole('button').count(), 2);
      const first = page.getByRole('button', { name: /First record/ });
      assert.equal(
        await first.getAttribute('aria-pressed'),
        story === 'selected' ? 'true' : 'false',
      );
      if (story === 'error')
        assert.equal(
          await page.getByRole('alert').innerText(),
          'Unable to load the latest records.',
        );
    }
    const screenshot = `${story}.png`;
    await page.screenshot({ path: join(output, screenshot), fullPage: true });
    if (story === 'normal' || story === 'selected') {
      await page.getByRole('button', { name: /First record/ }).click();
      await page
        .locator('button[aria-pressed="true"]')
        .filter({ hasText: 'First record' })
        .waitFor();
      await page.getByRole('button', { name: /Second record/ }).click();
      await page
        .locator('button[aria-pressed="true"]')
        .filter({ hasText: 'Second record' })
        .waitFor();
      assert.equal(
        await page
          .getByRole('button', { name: /First record/ })
          .getAttribute('aria-pressed'),
        'false',
      );
    }
    assert.deepEqual(
      report.errors,
      [],
      'Storybook reported a browser runtime error',
    );
    report.stories.push({ id, outcome: 'pass', screenshot });
    await page.close();
  }
  report.outcome = 'pass';
} catch (error) {
  report.outcome = checkingStories ? 'fail' : 'inconclusive';
  report.errors.push(String(error));
} finally {
  try {
    await browser?.close();
    if (server?.pid) {
      try {
        process.kill(-server.pid, 'SIGTERM');
      } catch {}
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        closed,
        new Promise<void>((done) => {
          timer = setTimeout(done, 5_000);
        }),
      ]);
      clearTimeout(timer);
      try {
        process.kill(-server.pid, 'SIGKILL');
      } catch {}
      await closed;
    }
    report.cleanup = 'complete';
  } catch (error) {
    report.cleanup = 'failed';
    report.outcome = 'inconclusive';
    report.errors.push(String(error));
  }
  await writeFile(
    join(output, 'runtime.log'),
    stripVTControlCharacters(logs.join('')),
  );
  await writeFile(
    join(output, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}
console.log(
  `Storybook ${mode}: ${report.outcome}. Report: ${output}/report.json`,
);
if (report.outcome !== 'pass') process.exitCode = 1;
