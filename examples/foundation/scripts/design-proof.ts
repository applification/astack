import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, type Browser } from 'playwright';
import { z } from 'zod';
import { foundationRoot, revisionIdentity } from './runtime';
import { sourceDigest } from './source-identity';

const bounds = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
const node = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  bounds,
  content: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fill: z.string().optional(),
});
const schema = z.object({
  format: z.literal('astack-pen-handoff/v1'),
  frames: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      story: z.string(),
      nodes: z.array(node),
    }),
  ),
});
const selectors: Record<string, string> = {
  'Workspace header': '.page-header',
  'MCP header': '.page-header',
  'Create work item': '.create-form',
  'Title input': '.input',
  'Add action': '.create-form .button',
  'All filters': '.filters',
  'All items filter': '.filters a[aria-current="page"]',
  'Open work item': '.work-item:nth-child(1)',
  'Completed work item': '.work-item:nth-child(2)',
  'MCP open work': '.work-item:nth-child(1)',
  'MCP completed work': '.work-item:nth-child(2)',
  'Empty work list': '.empty',
  'MCP empty list': '.empty',
  'Loading work list': '.notice',
  'Saving error': '.notice-error',
};
const textSelectors: Record<string, string> = {
  'Page title': 'main h1',
  'Product label': '.eyebrow',
  'Page subtitle': '.subtitle',
};
function rgb(hex: string): string {
  return `rgb(${[1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)).join(', ')})`;
}

/** A design-derived observation, separate from real persistence/authentication acceptance. */
export async function designProof(options: {
  url?: string;
  evidence: string;
  projectRoot?: string;
}) {
  const root = options.projectRoot ?? foundationRoot;
  const evidence = resolve(options.evidence);
  await mkdir(evidence, { recursive: true });
  const raw = await readFile(join(root, '.astack/design/spec.json'), 'utf8');
  const spec = schema.parse(JSON.parse(raw));
  const sourceSha256 = await sourceDigest(root);
  let server: ReturnType<typeof Bun.serve> | undefined;
  let url = options.url;
  if (!url) {
    const build = Bun.spawn(['bun', 'run', '--cwd', 'packages/ui', 'build'], {
      cwd: root,
      stdout: 'inherit',
      stderr: 'inherit',
    });
    assert.equal(await build.exited, 0, 'Storybook build failed');
    assert.equal(
      await sourceDigest(root),
      sourceSha256,
      'Source changed during build',
    );
    const directory = join(root, 'packages/ui/storybook-static');
    server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      async fetch(request) {
        const path = resolve(directory, '.' + new URL(request.url).pathname);
        if (!path.startsWith(directory + sep))
          return new Response('Not found', { status: 404 });
        const file = Bun.file(path);
        return (await file.exists())
          ? new Response(file)
          : new Response('Not found', { status: 404 });
      },
    });
    url = `http://127.0.0.1:${server.port}`;
  }
  const report = {
    format: 'astack-design-proof/v1',
    revision: await revisionIdentity(root),
    sourceSha256,
    server: options.url
      ? 'Caller-supplied URL; rendered server source identity is unverified.'
      : 'Fresh local Storybook build from the recorded project source digest.',
    designSha256: createHash('sha256').update(raw).digest('hex'),
    source: '.astack/design/work-items.pen',
    startedAt: new Date().toISOString(),
    tolerancePx: 4,
    scope:
      'Storybook fixture rendering; real web/MCP behavior is checked by readiness.',
    frames: [] as {
      id: string;
      story: string;
      outcome: string;
      observations: unknown[];
      screenshot: string;
      error?: string;
    }[],
    finishedAt: '',
    outcome: 'pass',
  };
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch();
    for (const frame of spec.frames) {
      const size = frame.nodes[0];
      assert.ok(size);
      const page = await browser.newPage({
        viewport: { width: size.bounds.width, height: size.bounds.height },
      });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const result: (typeof report.frames)[number] = {
        id: frame.id,
        story: frame.story,
        outcome: 'pass',
        observations: [],
        screenshot: `${frame.id}-story.png`,
      };
      try {
        await page.goto(`${url}/iframe.html?id=${frame.story}&viewMode=story`);
        await page.locator('main').waitFor();
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        const ground = await page
          .locator(frame.story.endsWith('mcp-dark') ? '.theme-dark' : 'html')
          .evaluate((element) => getComputedStyle(element).backgroundColor);
        result.observations.push({ ground, expected: size.fill });
        assert.equal(ground, rgb(size.fill ?? ''));
        for (const expected of frame.nodes) {
          const selector = selectors[expected.name];
          if (selector) {
            const actual = await page.locator(selector).boundingBox();
            result.observations.push({
              name: expected.name,
              expected: expected.bounds,
              actual,
            });
            assert.ok(actual, `Missing ${expected.name}`);
            for (const dimension of ['x', 'y', 'width', 'height'] as const)
              assert.ok(
                Math.abs(actual[dimension] - expected.bounds[dimension]) <=
                  report.tolerancePx,
                `${frame.name}: ${expected.name}.${dimension}: ${actual[dimension]} vs ${expected.bounds[dimension]}`,
              );
            if (expected.fill) {
              const background = await page
                .locator(selector)
                .evaluate(
                  (element) => getComputedStyle(element).backgroundColor,
                );
              assert.equal(
                background,
                rgb(expected.fill),
                `${expected.name} surface`,
              );
            }
          }
          const textSelector = textSelectors[expected.name];
          if (textSelector) {
            const actual = await page
              .locator(textSelector)
              .evaluate((element) => {
                const style = getComputedStyle(element);
                return {
                  text: element.textContent.trim(),
                  font: style.fontFamily,
                  size: Number.parseFloat(style.fontSize),
                  weight: style.fontWeight,
                  color: style.color,
                };
              });
            result.observations.push({
              name: expected.name,
              typography: actual,
            });
            assert.equal(actual.text, expected.content);
            assert.equal(actual.size, expected.fontSize);
            assert.equal(
              actual.weight,
              expected.fontWeight === 'normal' ? '400' : expected.fontWeight,
            );
            assert.ok(
              actual.font.includes('Inter Variable'),
              `Design font missing: ${actual.font}`,
            );
            assert.equal(actual.color, rgb(expected.fill ?? ''));
          }
        }
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          true,
          'Horizontal overflow',
        );
        if (frame.story.endsWith('mcp-saving')) {
          assert.equal(
            await page.getByRole('button', { name: 'Saving…' }).isDisabled(),
            true,
          );
          assert.equal(
            await page.getByRole('button', { name: 'Reopen' }).isDisabled(),
            true,
          );
        }
        if (frame.story.endsWith('mcp-error'))
          await page.getByRole('alert').waitFor();
        assert.deepEqual(errors, []);
      } catch (error) {
        result.outcome = 'fail';
        result.error = String(error);
        report.outcome = 'fail';
      } finally {
        await page.screenshot({ path: join(evidence, result.screenshot) });
        await page.close();
        report.frames.push(result);
      }
    }
    assert.equal(
      await sourceDigest(root),
      sourceSha256,
      'Source changed during rendered proof',
    );
  } catch (error) {
    report.outcome = 'inconclusive';
    report.frames.push({
      id: 'setup',
      story: '',
      outcome: 'inconclusive',
      observations: [],
      screenshot: '',
      error: String(error),
    });
  } finally {
    const cleanup = await Promise.allSettled([
      browser?.close(),
      server?.stop(true),
    ]);
    if (cleanup.some((result) => result.status === 'rejected'))
      report.outcome = 'inconclusive';
    report.finishedAt = new Date().toISOString();
    await writeFile(
      join(evidence, 'report.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
  }
  return report;
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      url: { type: 'string' },
      evidence: { type: 'string', default: '.proof/design' },
    },
  });
  const report = await designProof({
    ...(values.url ? { url: values.url } : {}),
    evidence: values.evidence,
  });
  console.log(
    JSON.stringify(
      {
        outcome: report.outcome,
        frames: report.frames.map(({ id, outcome, error }) => ({
          id,
          outcome,
          error,
        })),
      },
      null,
      2,
    ),
  );
  if (report.outcome !== 'pass') process.exitCode = 1;
}
