import assert from 'node:assert/strict';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, type Browser } from 'playwright';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { ConvexError } from 'convex/values';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { HttpTransport } from './http-transport';
import {
  command,
  foundationRoot,
  redact,
  revisionIdentity,
  startRuntime,
  waitFor,
  type Runtime,
} from './runtime';
import { startMcpHost } from './mcp-host';
import { startMcpPreview } from './mcp-preview';
import { verifyEmulateAuth } from './auth-proof';
import { emulatePassword, emulateUsers } from './workos-emulate';

type WorkItem = { id: string; title: string; status: 'open' | 'done' };
type Check = {
  id: string;
  surface: string;
  outcome: 'pass' | 'fail' | 'inconclusive' | 'skipped';
  observation: string;
};
export type ReadinessReport = {
  format: 'astack-foundation-readiness/v1';
  startedAt: string;
  finishedAt: string;
  revision: string;
  taskProfile: 'baseline' | 'title-edit';
  outcome: 'pass' | 'fail' | 'inconclusive';
  environment: Record<string, string>;
  checks: Check[];
  artifacts: string[];
  cleanup: 'complete' | 'failed';
  error?: string;
};
const list = makeFunctionReference<'query'>('workItems:list');
const setStatus = makeFunctionReference<'mutation'>('workItems:setStatus');
const workItemsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    status: z.enum(['open', 'done']),
  }),
);
export function items(value: unknown): WorkItem[] {
  return workItemsSchema.parse(value);
}
/** Only validated, successfully read state can establish a persistence mismatch. */
export async function expectPersistedStatus(
  read: () => Promise<unknown>,
  id: string,
  expected: 'open' | 'done',
  options: { timeoutMs?: number; pollMs?: number } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 5000,
    deadline = Date.now() + timeoutMs;
  const pollMs = options.pollMs ?? 100;
  let observed: WorkItem['status'] | undefined;
  for (;;) {
    const readBudget = deadline - Date.now();
    if (readBudget <= 0)
      throw new Error(
        'Backend status read deadline expired before a validated read',
      );
    // Transport and DTO errors propagate immediately; neither is seed evidence.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const readTimeout = () =>
      new Error(`Backend status read exceeded its ${timeoutMs}ms deadline`);
    const expired = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(readTimeout());
      }, readBudget);
    });
    try {
      const value = await Promise.race([read(), expired]);
      if (Date.now() >= deadline) throw readTimeout();
      observed = items(value).find((item) => item.id === id)?.status;
      if (Date.now() >= deadline) throw readTimeout();
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (observed === expected) return;
    const remaining = deadline - Date.now();
    // Avoid starting another network read with only a fraction of the polling
    // interval left. The last successfully validated wrong state stays evidence.
    if (remaining <= pollMs) {
      await new Promise<void>((done) =>
        setTimeout(done, Math.max(0, remaining)),
      );
      break;
    }
    await new Promise<void>((done) => setTimeout(done, pollMs));
  }
  assert.equal(
    observed,
    expected,
    `Fresh backend reads did not persist web status '${expected}' within ${timeoutMs}ms`,
  );
}
export function selfContainedResource(html: string): void {
  assert.ok(
    html.includes('<html') || html.includes('<!doctype'),
    'UI resource is not an HTML document',
  );
  assert.ok(
    !/<script\b[^>]*\bsrc\s*=/i.test(html),
    'UI depends on external script files',
  );
  assert.ok(
    !/<link\b[^>]*\brel\s*=\s*["']?stylesheet/i.test(html),
    'UI depends on external CSS files',
  );
  assert.ok(
    !/https?:\/\/[^\s"']+\.(?:js|css)(?:["'\s?]|$)/i.test(html),
    'UI depends on remote assets',
  );
}
type ExpectedDenial =
  | { kind: 'code'; code: 'FORBIDDEN' | 'UNAUTHENTICATED' | 'INVALID_TITLE' }
  | { kind: 'arguments'; tool: string; field: string }
  | { kind: 'jwt' };
const denialCodeSchema = z.object({ code: z.string() });
const toolErrorSchema = z.object({
  isError: z.literal(true),
  content: z.array(z.object({ type: z.literal('text'), text: z.string() })),
});
/** Accept only the expected application or validator denial, never a transport failure. */
export async function denied(
  operation: () => Promise<unknown>,
  expected: ExpectedDenial,
): Promise<void> {
  let value: unknown;
  let failure: unknown;
  try {
    value = await operation();
  } catch (error) {
    failure = error;
  }
  const toolError = toolErrorSchema.safeParse(value);
  if (failure === undefined && !toolError.success)
    assert.fail('Operation expected to be denied unexpectedly succeeded');
  let matched = false;
  let observation: string;
  if (failure !== undefined) {
    observation =
      failure instanceof Error ? failure.message : JSON.stringify(failure);
    if (expected.kind === 'code' && failure instanceof ConvexError) {
      const data = denialCodeSchema.safeParse(failure.data);
      matched = data.success && data.data.code === expected.code;
    } else if (expected.kind === 'jwt' && failure instanceof Error) {
      try {
        const data = z
          .object({ code: z.literal('NoAuthProvider'), message: z.string() })
          .parse(JSON.parse(failure.message));
        matched = data.message.includes(
          "JWT's issuer and audience match one of your configured providers:",
        );
      } catch {
        matched = false;
      }
    }
  } else {
    assert.ok(toolError.success);
    observation = toolError.data.content.map((part) => part.text).join('\n');
    if (expected.kind === 'code') {
      const serialized = /(?:Uncaught )?ConvexError: (\{[^\n]*\})/.exec(
        observation,
      )?.[1];
      if (serialized) {
        try {
          const data = denialCodeSchema.parse(JSON.parse(serialized));
          matched = data.code === expected.code;
        } catch {
          matched = false;
        }
      }
    } else if (expected.kind === 'arguments') {
      matched =
        observation.startsWith(
          `MCP error -32602: Input validation error: Invalid arguments for tool ${expected.tool}:`,
        ) && observation.endsWith(` at ${expected.field}`);
    }
  }
  if (!matched)
    throw new Error(
      `Expected denial ${JSON.stringify(expected)}; observed an unrelated failure: ${redact(observation)}`,
    );
}
async function connect(runtime: Runtime, bearer: string): Promise<Client> {
  const client = new Client({
    name: 'astack-foundation-proof',
    version: '1.0.0',
  });
  await client.connect(
    new HttpTransport(new URL(runtime.mcpUrl), {
      requestInit: { headers: { authorization: `Bearer ${bearer}` } },
    }),
  );
  return client;
}

export async function doctor(projectRoot = foundationRoot) {
  const results = await Promise.allSettled([
    command(['bun', '--version'], projectRoot),
    command(['node', '--version'], projectRoot),
    access(join(projectRoot, 'node_modules')),
    access(join(projectRoot, 'bun.lock')),
  ]);
  const observations = results.map((result, index) => {
    const detail =
      result.status === 'fulfilled'
        ? (result.value ?? 'present').trim()
        : redact(String(result.reason));
    const supported =
      result.status === 'fulfilled' &&
      (index === 0
        ? /^1\.4\./.test(detail)
        : index === 1
          ? /^v24\./.test(detail)
          : true);
    return {
      prerequisite: [
        'Bun',
        'Node',
        'installed dependencies',
        'frozen dependency lock',
      ][index],
      outcome: supported ? 'pass' : 'fail',
      detail,
      ...(index === 0
        ? { required: 'Bun 1.4.x' }
        : index === 1
          ? { required: 'Node 24.x' }
          : {}),
    };
  });
  return {
    checkout: resolve(projectRoot),
    revision: await revisionIdentity(projectRoot),
    ready: observations.every((observation) => observation.outcome === 'pass'),
    target: null,
    observations,
    scope:
      'Read-only checkout inspection. A live disposable target is created only by verify.',
  };
}

export async function verify(
  options: {
    projectRoot?: string;
    evidenceDirectory?: string | undefined;
    taskProfile?: 'baseline' | 'title-edit';
  } = {},
): Promise<ReadinessReport> {
  const projectRoot = options.projectRoot ?? foundationRoot;
  const evidence = resolve(
    options.evidenceDirectory ??
      join(
        projectRoot,
        '.proof',
        new Date().toISOString().replace(/[:.]/g, '-'),
      ),
  );
  await mkdir(evidence, { recursive: true });
  const report: ReadinessReport = {
    format: 'astack-foundation-readiness/v1',
    startedAt: new Date().toISOString(),
    finishedAt: '',
    revision: await revisionIdentity(projectRoot),
    taskProfile: options.taskProfile ?? 'baseline',
    outcome: 'inconclusive',
    environment: {},
    checks: [],
    artifacts: [],
    cleanup: 'complete',
  };
  let runtime: Runtime | undefined,
    browser: Browser | undefined,
    mcp: Client | undefined,
    otherMcp: Client | undefined;
  let host: Awaited<ReturnType<typeof startMcpHost>> | undefined;
  let preview: Awaited<ReturnType<typeof startMcpPreview>> | undefined;
  const check = async <T>(
    id: string,
    surface: string,
    observation: string,
    action: () => Promise<T>,
  ): Promise<T> => {
    try {
      const value = await action();
      report.checks.push({ id, surface, outcome: 'pass', observation });
      return value;
    } catch (error) {
      report.checks.push({
        id,
        surface,
        outcome:
          error instanceof assert.AssertionError ? 'fail' : 'inconclusive',
        observation: redact(String(error)),
      });
      throw error;
    }
  };
  try {
    runtime = await startRuntime({ projectRoot });
    const active = runtime;
    report.revision = active.buildId;
    report.environment = {
      kind: 'disposable local Convex + Vite + Chromium',
      buildId: runtime.buildId,
      web: runtime.webUrl,
      convex: runtime.convexUrl,
      mcp: runtime.mcpUrl,
      actors: 'Emulate seeded owner and other user',
      credentialPolicy:
        'WorkOS Emulate AuthKit/Connect tokens; synthetic expired/wrong-audience negative controls only; no credentials retained',
    };
    browser = await chromium.launch();
    const liveBrowser = browser;
    const page = await liveBrowser.newPage();
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await check(
      'R1',
      'identity',
      'Running backend health and web identify this revision and WorkOS Emulate environment.',
      async () => {
        const health = (await (
          await fetch(`${active.siteUrl}/health`)
        ).json()) as { buildId: string; resource: string; authMode: string };
        assert.equal(health.buildId, active.buildId);
        assert.equal(health.resource, active.mcpUrl);
        assert.equal(health.authMode, 'workos-emulate');
        await page.goto(active.webUrl);
        await page
          .getByRole('heading', { name: 'Work items', exact: true })
          .waitFor();
        await page.locator(`[data-build-id="${active.buildId}"]`).waitFor();
      },
    );
    await check(
      'R10',
      'WorkOS Emulate AuthKit/session',
      'SDK login, linked identity, refresh rotation, replay denial and session revocation pass in Emulate; browser uses the official AuthKit/Convex adapter.',
      async () => {
        await verifyEmulateAuth(active.auth);
        await page
          .getByRole('button', { name: 'Sign in', exact: true })
          .click();
        await page
          .getByLabel('Email', { exact: true })
          .fill(emulateUsers[0].email);
        await page
          .getByRole('button', { name: 'Continue', exact: true })
          .click();
        await page
          .getByLabel('Password', { exact: true })
          .fill(emulatePassword);
        await page
          .getByRole('button', { name: 'Continue', exact: true })
          .click();
        await page.getByLabel('Title', { exact: true }).waitFor();
      },
    );
    const title = `Proof item ${Date.now()}`;
    const owner = new ConvexHttpClient(runtime.convexUrl);
    owner.setAuth(runtime.tokens.web);
    const item = await check(
      'R2',
      'web → persistence',
      'Creating through the web is visible in a fresh authenticated Convex read.',
      async () => {
        await page.getByLabel('Title', { exact: true }).fill(title);
        await page
          .getByRole('button', { name: 'Add work item', exact: true })
          .click();
        await page.getByText(title, { exact: true }).waitFor();
        return waitFor(
          async () =>
            items(await owner.query(list, {})).find(
              (item) => item.title === title,
            ) ?? false,
          'persisted web item',
        );
      },
    );
    mcp = await connect(runtime, runtime.tokens.mcp);
    const ownerMcp = mcp;
    await check(
      'R3',
      'web ↔ MCP status persistence',
      'Web done/reopen actions survive independent reads; MCP observes reopened status, and MCP done survives a web reload.',
      async () => {
        const tools = await ownerMcp.listTools();
        for (const name of [
          'work_items_list',
          'work_items_create',
          'work_items_set_status',
          'work_items_delete',
        ])
          assert.ok(
            tools.tools.some((tool) => tool.name === name),
            `Missing ${name}`,
          );
        await page
          .getByRole('button', { name: 'Mark done', exact: true })
          .click();
        const settledControl = page.getByRole('button', {
          name: /^(Mark done|Reopen)$/,
        });
        await waitFor(
          async () =>
            (await settledControl.count()) === 1 &&
            (await settledControl.isEnabled()),
          'web status mutation to settle',
          10_000,
        );
        await expectPersistedStatus(
          () => owner.query(list, {}),
          item.id,
          'done',
        );
        await page
          .getByRole('button', { name: 'Reopen', exact: true })
          .waitFor();
        await page.getByRole('button', { name: 'Reopen', exact: true }).click();
        await waitFor(
          async () =>
            (await settledControl.count()) === 1 &&
            (await settledControl.isEnabled()),
          'web reopen mutation to settle',
          10_000,
        );
        await expectPersistedStatus(
          () => owner.query(list, {}),
          item.id,
          'open',
        );
        await page
          .getByRole('button', { name: 'Mark done', exact: true })
          .waitFor();
        const reopened = await ownerMcp.callTool({
          name: 'work_items_list',
          arguments: {},
        });
        assert.notEqual(reopened.isError, true);
        const content = z
          .object({ items: workItemsSchema })
          .parse(reopened.structuredContent);
        assert.equal(
          content.items.find((value) => value.id === item.id)?.status,
          'open',
        );
        const result = await ownerMcp.callTool({
          name: 'work_items_set_status',
          arguments: { id: item.id, status: 'done' },
        });
        assert.notEqual(result.isError, true);
        assert.equal(
          items(await owner.query(list, {})).find(
            (value) => value.id === item.id,
          )?.status,
          'done',
        );
        await page.reload();
        await page.getByText(title, { exact: true }).waitFor();
        await page
          .getByRole('button', { name: 'Reopen', exact: true })
          .waitFor();
      },
    );
    await check(
      'R4',
      'authorization',
      'Another signed user cannot read or mutate the first user’s item through Convex or MCP.',
      async () => {
        const other = new ConvexHttpClient(active.convexUrl);
        other.setAuth(active.tokens.otherWeb);
        assert.equal(
          items(await other.query(list, {})).some(
            (value) => value.id === item.id,
          ),
          false,
        );
        await denied(
          () => other.mutation(setStatus, { id: item.id, status: 'open' }),
          { kind: 'code', code: 'FORBIDDEN' },
        );
        const secondMcp = await connect(active, active.tokens.otherMcp);
        otherMcp = secondMcp;
        const otherRead = await secondMcp.callTool({
          name: 'work_items_list',
          arguments: {},
        });
        assert.notEqual(otherRead.isError, true);
        const otherItems = z
          .object({ items: workItemsSchema })
          .parse(otherRead.structuredContent).items;
        assert.equal(
          otherItems.some((value) => value.id === item.id),
          false,
          'Another signed MCP user read the owner’s item',
        );
        await denied(
          () =>
            secondMcp.callTool({
              name: 'work_items_set_status',
              arguments: { id: item.id, status: 'open' },
            }),
          { kind: 'code', code: 'FORBIDDEN' },
        );
        await denied(
          () =>
            secondMcp.callTool({
              name: 'work_items_delete',
              arguments: { id: item.id },
            }),
          { kind: 'code', code: 'FORBIDDEN' },
        );
        assert.equal(
          items(await owner.query(list, {})).find(
            (value) => value.id === item.id,
          )?.status,
          'done',
        );
      },
    );
    await check(
      'R5',
      'authentication',
      'MCP denies anonymous, web-audience, wrong-audience and expired credentials; Convex denies anonymous/wrong-audience reads.',
      async () => {
        for (const bearer of [
          undefined,
          active.tokens.web,
          active.tokens.wrongAudience,
          active.tokens.expired,
        ]) {
          const response = await fetch(active.mcpUrl, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              accept: 'application/json, text/event-stream',
              ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'initialize',
              params: {
                protocolVersion: '2025-03-26',
                capabilities: {},
                clientInfo: { name: 'negative-proof', version: '1' },
              },
            }),
          });
          assert.equal(
            response.status,
            401,
            'MCP did not reject invalid identity',
          );
        }
        await denied(
          () => new ConvexHttpClient(active.convexUrl).query(list, {}),
          { kind: 'code', code: 'UNAUTHENTICATED' },
        );
        const wrong = new ConvexHttpClient(active.convexUrl);
        wrong.setAuth(active.tokens.wrongAudience);
        await denied(() => wrong.query(list, {}), { kind: 'jwt' });
      },
    );
    await check(
      'R6',
      'MCP contracts',
      'Malformed status arguments are rejected and the UI resource contains its required JS/CSS.',
      async () => {
        for (const method of ['GET', 'DELETE']) {
          const response = await fetch(active.mcpUrl, {
            method,
            headers: { authorization: `Bearer ${active.tokens.mcp}` },
          });
          assert.equal(response.status, 405);
          assert.equal(response.headers.get('allow'), 'POST');
        }
        await denied(
          () =>
            ownerMcp.callTool({
              name: 'work_items_set_status',
              arguments: { id: item.id, status: 'unknown' },
            }),
          { kind: 'arguments', tool: 'work_items_set_status', field: 'status' },
        );
        const resource = await ownerMcp.readResource({
          uri: 'ui://foundation/work-items.html',
        });
        const content = resource.contents[0];
        assert.ok(content && 'text' in content);
        assert.equal(content.mimeType, 'text/html;profile=mcp-app');
        selfContainedResource(content.text);
      },
    );
    await page.screenshot({
      path: join(evidence, 'web-persisted.png'),
      fullPage: true,
    });
    report.artifacts.push('web-persisted.png');
    await check(
      'R7',
      'local MCP App host',
      'The MCP resource applies initial and updated host styles, acknowledges teardown, remounts, and changes persisted status through AppBridge and web reloads.',
      async () => {
        host = await startMcpHost(active);
        const forbiddenProxy = await fetch(`${host.url}/mcp`, {
          method: 'POST',
          headers: { origin: 'http://foreign.invalid' },
          body: '{}',
        });
        assert.equal(forbiddenProxy.status, 403);
        const appPage = await liveBrowser.newPage();
        const hostMessages: string[] = [];
        const uncaughtAppErrors: string[] = [];
        appPage.on('pageerror', (error) => {
          uncaughtAppErrors.push(error.message);
          hostMessages.push(error.message);
        });
        appPage.on('console', (message) => {
          if (message.type() === 'error') hostMessages.push(message.text());
        });
        appPage.on('requestfailed', (request) => {
          hostMessages.push(
            `${request.url()}: ${request.failure()?.errorText ?? 'failed'}`,
          );
        });
        try {
          await appPage.goto(host.url);
          await appPage
            .getByRole('status')
            .filter({ hasText: 'Connected to the running MCP server' })
            .waitFor();
          await appPage
            .frameLocator('#app')
            .getByText(title, { exact: true })
            .waitFor();
          const styles = () =>
            appPage
              .frameLocator('#app')
              .locator('html')
              .evaluate((element) => {
                const computed = getComputedStyle(element);
                return {
                  theme: element.getAttribute('data-theme'),
                  colorScheme: computed.colorScheme,
                  background: computed.backgroundColor,
                  color: computed.color,
                  font: computed.fontFamily,
                  fontCss:
                    document.getElementById('__mcp-host-fonts')?.textContent ??
                    '',
                };
              });
          const initialStyles = await waitFor(async () => {
            const observed = await styles();
            return observed.theme === 'dark' ? observed : false;
          }, 'initial host theme');
          assert.equal(initialStyles.colorScheme, 'dark');
          assert.equal(initialStyles.background, 'rgb(19, 27, 39)');
          assert.equal(initialStyles.color, 'rgb(241, 245, 249)');
          assert.ok(initialStyles.font.includes('Astack Proof Sans'));
          assert.ok(initialStyles.fontCss.includes('Astack Proof Sans'));
          await appPage
            .frameLocator('#app')
            .getByRole('button', { name: 'Reopen', exact: true })
            .click();
          await waitFor(
            async () =>
              items(await owner.query(list, {})).find(
                (value) => value.id === item.id,
              )?.status === 'open'
                ? true
                : false,
            'persisted MCP App status change',
          );
          await page.reload();
          await page.getByText(title, { exact: true }).waitFor();
          await page
            .getByRole('button', { name: 'Mark done', exact: true })
            .waitFor();
          await appPage
            .frameLocator('#app')
            .getByRole('button', { name: 'Mark done', exact: true })
            .waitFor();
          await appPage
            .getByRole('button', { name: 'Update host palette', exact: true })
            .click();
          const updatedStyles = await waitFor(async () => {
            const observed = await styles();
            return observed.theme === 'light' ? observed : false;
          }, 'updated host theme');
          assert.equal(updatedStyles.colorScheme, 'light');
          assert.equal(updatedStyles.background, 'rgb(255, 244, 219)');
          assert.equal(updatedStyles.color, 'rgb(53, 35, 14)');
          assert.ok(updatedStyles.font.includes('Astack Proof Serif'));
          assert.ok(updatedStyles.fontCss.includes('Astack Proof Serif'));
          assert.equal(
            updatedStyles.fontCss.includes('Astack Proof Sans'),
            false,
          );
          await appPage
            .getByRole('button', { name: 'Teardown and remount', exact: true })
            .click();
          await appPage
            .getByRole('status')
            .filter({ hasText: 'Remounted after teardown acknowledgement' })
            .waitFor();
          assert.equal(
            await appPage.locator('body').getAttribute('data-mounts'),
            '2',
          );
          assert.equal(
            await appPage
              .locator('body')
              .getAttribute('data-teardown-acknowledgements'),
            '1',
          );
          assert.equal(
            await appPage
              .locator('body')
              .getAttribute('data-closed-connections'),
            '2',
          );
          await appPage
            .frameLocator('#app')
            .getByText(title, { exact: true })
            .waitFor();
          const remountedStyles = await styles();
          assert.deepEqual(remountedStyles, updatedStyles);
          await appPage
            .frameLocator('#app')
            .getByRole('button', { name: 'Mark done', exact: true })
            .click();
          await waitFor(
            async () =>
              items(await owner.query(list, {})).find(
                (value) => value.id === item.id,
              )?.status === 'done'
                ? true
                : false,
            'persisted remounted App status change',
          );
          await page.reload();
          await page.getByText(title, { exact: true }).waitFor();
          await page
            .getByRole('button', { name: 'Reopen', exact: true })
            .waitFor();
          await appPage
            .frameLocator('#app')
            .getByRole('button', { name: 'Reopen', exact: true })
            .waitFor();
          await appPage.screenshot({
            path: join(evidence, 'mcp-app-host.png'),
            fullPage: true,
          });
          report.artifacts.push('mcp-app-host.png');
          await appPage
            .getByRole('button', { name: 'Close App', exact: true })
            .click();
          await appPage
            .getByRole('status')
            .filter({ hasText: 'App closed after teardown acknowledgement' })
            .waitFor();
          assert.equal(await appPage.locator('#app').count(), 0);
          assert.equal(
            await appPage
              .locator('body')
              .getAttribute('data-teardown-acknowledgements'),
            '2',
          );
          assert.equal(
            await appPage
              .locator('body')
              .getAttribute('data-closed-connections'),
            '4',
          );
          assert.deepEqual(uncaughtAppErrors, []);
          await writeFile(
            join(evidence, 'mcp-host-observations.json'),
            JSON.stringify(
              {
                initialStyles,
                updatedStyles,
                remountedStyles,
                mounts: 2,
                teardownAcknowledgements: 2,
                closedOwnedConnections: 4,
                uncaughtAppErrors,
                browserMessages: hostMessages,
              },
              null,
              2,
            ) + '\n',
          );
          report.artifacts.push('mcp-host-observations.json');
        } catch (error) {
          hostMessages.push(await appPage.getByRole('status').innerText());
          await appPage.screenshot({
            path: join(evidence, 'mcp-app-host-failure.png'),
            fullPage: true,
          });
          await writeFile(
            join(evidence, 'mcp-host.log'),
            redact(hostMessages.join('\n')),
          );
          report.artifacts.push('mcp-app-host-failure.png', 'mcp-host.log');
          throw error;
        } finally {
          await appPage.close();
        }
      },
    );
    if (report.taskProfile === 'title-edit') {
      await check(
        'F0',
        'title edit contract',
        'The requested title-edit MCP tool is available.',
        async () => {
          const tools = await ownerMcp.listTools();
          assert.ok(
            tools.tools.some((tool) => tool.name === 'work_items_update_title'),
            'Missing requested work_items_update_title tool',
          );
        },
      );
      const webEditedTitle = `${title} edited in web`;
      const mcpEditedTitle = `${title} edited through MCP`;
      await check(
        'F1',
        'web title edit → persistence → MCP',
        'A title edited through the web is independently visible through Convex and MCP.',
        async () => {
          await page
            .getByRole('button', { name: `Edit ${title}`, exact: true })
            .click();
          const dialog = page.getByRole('dialog', {
            name: 'Edit work item',
            exact: true,
          });
          await dialog
            .getByRole('textbox', { name: 'Title', exact: true })
            .fill(webEditedTitle);
          await dialog
            .getByRole('button', { name: 'Save changes', exact: true })
            .click();
          await page.getByText(webEditedTitle, { exact: true }).waitFor();
          assert.equal(
            items(await owner.query(list, {})).find(
              (value) => value.id === item.id,
            )?.title,
            webEditedTitle,
          );
          const result = await ownerMcp.callTool({
            name: 'work_items_list',
            arguments: {},
          });
          assert.notEqual(result.isError, true);
          const content = z
            .object({ items: workItemsSchema })
            .parse(result.structuredContent);
          assert.equal(
            content.items.find((value) => value.id === item.id)?.title,
            webEditedTitle,
          );
        },
      );
      await check(
        'F2',
        'MCP title edit → persistence → web',
        'A title edited through MCP survives an independent Convex read and a web reload.',
        async () => {
          const result = await ownerMcp.callTool({
            name: 'work_items_update_title',
            arguments: { id: item.id, title: mcpEditedTitle },
          });
          assert.notEqual(result.isError, true);
          assert.equal(
            items(await owner.query(list, {})).find(
              (value) => value.id === item.id,
            )?.title,
            mcpEditedTitle,
          );
          await page.reload();
          await page.getByText(mcpEditedTitle, { exact: true }).waitFor();
        },
      );
      await check(
        'F3',
        'title validation and ownership',
        'Empty titles and another user’s title edit are specifically denied; the owner’s persisted title stays unchanged.',
        async () => {
          const updateTitle = makeFunctionReference<'mutation'>(
            'workItems:updateTitle',
          );
          await denied(
            () => owner.mutation(updateTitle, { id: item.id, title: '' }),
            { kind: 'code', code: 'INVALID_TITLE' },
          );
          await denied(
            () =>
              ownerMcp.callTool({
                name: 'work_items_update_title',
                arguments: { id: item.id, title: '   ' },
              }),
            { kind: 'code', code: 'INVALID_TITLE' },
          );
          const other = new ConvexHttpClient(active.convexUrl);
          other.setAuth(active.tokens.otherWeb);
          await denied(
            () =>
              other.mutation(updateTitle, {
                id: item.id,
                title: 'Intruder edit',
              }),
            { kind: 'code', code: 'FORBIDDEN' },
          );
          const secondMcp = otherMcp;
          assert.ok(secondMcp);
          await denied(
            () =>
              secondMcp.callTool({
                name: 'work_items_update_title',
                arguments: { id: item.id, title: 'Intruder edit' },
              }),
            { kind: 'code', code: 'FORBIDDEN' },
          );
          await page
            .getByRole('button', {
              name: `Edit ${mcpEditedTitle}`,
              exact: true,
            })
            .click();
          const dialog = page.getByRole('dialog', {
            name: 'Edit work item',
            exact: true,
          });
          const input = dialog.getByRole('textbox', {
            name: 'Title',
            exact: true,
          });
          const save = dialog.getByRole('button', {
            name: 'Save changes',
            exact: true,
          });
          await input.fill('');
          if (await save.isEnabled()) await save.click();
          await waitFor(
            async () =>
              !(await save.isEnabled()) ||
              (await input.evaluate(
                (element) =>
                  element instanceof HTMLInputElement &&
                  !element.validity.valid,
              )) ||
              (await dialog
                .locator('[role="alert"], [aria-invalid="true"]')
                .count()) > 0
                ? true
                : false,
            'visible empty-title validation',
          );
          assert.equal(
            items(await owner.query(list, {})).find(
              (value) => value.id === item.id,
            )?.title,
            mcpEditedTitle,
          );
          await page.screenshot({
            path: join(evidence, 'title-edit.png'),
            fullPage: true,
          });
          report.artifacts.push('title-edit.png');
        },
      );
    }
    await check(
      'R8',
      'web runtime',
      'No uncaught web JavaScript error was observed during the create/reload journey.',
      () =>
        Promise.resolve().then(() => {
          assert.deepEqual(consoleErrors, []);
        }),
    );
    await check(
      'R9',
      'standalone MCP development preview',
      'Opening the development URL shows a connection action without host errors; an Emulate-issued token loads the actual MCP resource, changes persisted status, refreshes and disconnects. OAuth state mismatch is rejected. Live WorkOS remains separate.',
      async () => {
        preview = await startMcpPreview(active);
        const errors: string[] = [];
        const previewPage = await liveBrowser.newPage();
        previewPage.on('pageerror', (error) => errors.push(error.message));
        await previewPage.goto(preview.url);
        await previewPage
          .getByRole('button', { name: 'Connect with WorkOS', exact: true })
          .waitFor();
        assert.ok(
          !(await previewPage.locator('body').innerText()).includes(
            'Method not found',
          ),
        );
        assert.ok(
          !(await previewPage.locator('body').innerText()).includes(
            'Waiting for the host',
          ),
        );
        const foreign = await fetch(`${preview.url}/__mcp/mcp`, {
          method: 'POST',
          headers: { origin: 'http://foreign.invalid' },
          body: '{}',
        });
        assert.equal(foreign.status, 403);
        await previewPage.goto(
          `${preview.url}/?code=untrusted-callback&state=wrong`,
        );
        await previewPage
          .getByRole('status')
          .filter({ hasText: 'Sign-in state did not match' })
          .waitFor();
        assert.equal(new URL(previewPage.url()).search, '');
        await previewPage.evaluate(
          ({ endpoint, token }) => {
            sessionStorage.setItem(
              `astack-mcp-preview:${endpoint}:tokens`,
              JSON.stringify({ access_token: token, token_type: 'Bearer' }),
            );
          },
          { endpoint: active.mcpUrl, token: active.tokens.mcp },
        );
        await previewPage.reload();
        await previewPage
          .getByRole('status')
          .filter({ hasText: 'Connected to local Convex through MCP' })
          .waitFor();
        const frame = previewPage.frameLocator('iframe');
        const before = items(await owner.query(list, {})).find(
          (value) => value.id === item.id,
        );
        assert.ok(before);
        await frame.getByText(before.title, { exact: true }).waitFor();
        await frame
          .getByRole('button', {
            name: before.status === 'open' ? 'Mark done' : 'Reopen',
            exact: true,
          })
          .click();
        await waitFor(
          async () =>
            items(await owner.query(list, {})).find(
              (value) => value.id === item.id,
            )?.status === (before.status === 'open' ? 'done' : 'open')
              ? true
              : false,
          'persisted standalone preview change',
        );
        await previewPage
          .getByRole('button', { name: 'Refresh work items', exact: true })
          .click();
        await frame
          .getByRole('button', {
            name: before.status === 'open' ? 'Reopen' : 'Mark done',
            exact: true,
          })
          .waitFor();
        await previewPage.screenshot({
          path: join(evidence, 'development-mcp-preview.png'),
          fullPage: true,
        });
        report.artifacts.push('development-mcp-preview.png');
        await previewPage
          .getByRole('button', { name: 'Disconnect', exact: true })
          .click();
        await previewPage
          .getByRole('status')
          .filter({ hasText: 'Disconnected.' })
          .waitFor();
        assert.equal(await previewPage.locator('iframe').count(), 0);
        assert.deepEqual(errors, []);
        await previewPage.close();
      },
    );
    await check(
      'R11',
      'Emulate development preview',
      'Connect with Emulate loads persisted work, renews local tokens on reconnect and enforces same-origin/method/content-type guards. It does not exercise real OAuth consent.',
      async () => {
        await preview?.stop();
        preview = await startMcpPreview(active, { emulate: true });
        const tokenRoute = `${preview.url}/__emulate/mcp-token`;
        assert.equal(
          (
            await fetch(tokenRoute, {
              method: 'POST',
              headers: {
                origin: 'http://foreign.invalid',
                'Content-Type': 'application/json',
              },
              body: '{}',
            })
          ).status,
          403,
        );
        assert.equal((await fetch(tokenRoute)).status, 404);
        assert.equal(
          (
            await fetch(tokenRoute, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },
              body: '{}',
            })
          ).status,
          404,
        );
        const previewPage = await liveBrowser.newPage();
        await previewPage.goto(preview.url);
        await previewPage
          .getByRole('button', { name: 'Connect with Emulate', exact: true })
          .click();
        const frame = previewPage.frameLocator('iframe');
        await frame.getByText(item.title, { exact: true }).waitFor();
        const before = items(await owner.query(list, {})).find(
          (value) => value.id === item.id,
        );
        assert.ok(before);
        await frame
          .getByRole('button', {
            name: before.status === 'open' ? 'Mark done' : 'Reopen',
            exact: true,
          })
          .click();
        await expectPersistedStatus(
          () => owner.query(list, {}),
          item.id,
          before.status === 'open' ? 'done' : 'open',
        );
        await previewPage
          .getByRole('button', { name: 'Disconnect', exact: true })
          .click();
        await previewPage.locator('iframe').waitFor({ state: 'detached' });
        await previewPage
          .getByRole('button', { name: 'Connect with Emulate', exact: true })
          .click();
        await previewPage
          .frameLocator('iframe')
          .getByText(item.title, { exact: true })
          .waitFor();
        await previewPage.screenshot({
          path: join(evidence, 'emulate-mcp-preview.png'),
          fullPage: true,
        });
        report.artifacts.push('emulate-mcp-preview.png');
        await previewPage.close();
      },
    );
    report.checks.push(
      {
        id: 'G1',
        surface: 'WorkOS',
        outcome: 'skipped',
        observation:
          'Emulate proves local AuthKit behavior. Manual Hosted AuthKit login/redirect/refresh/subject continuity requires a temporary astack Staging identity. Real staging SDK proof is a separate auth:staging run.',
      },
      {
        id: 'G2',
        surface: 'real MCP OAuth',
        outcome: 'skipped',
        observation:
          'Real MCP consent, exact-resource issuance and same WorkOS identity across web/MCP require manual staging acceptance. Emulate Connect has no DCR/PKCE/consent/refresh coverage.',
      },
      {
        id: 'H1',
        surface: 'installed ChatGPT host',
        outcome: 'skipped',
        observation:
          'The local AppBridge host passed. Installed ChatGPT OAuth, tool selection and App behavior require a separate authorized host acceptance run and public HTTPS resource.',
      },
    );
    report.outcome = 'pass';
  } catch (error) {
    report.error = redact(String(error));
    report.outcome = report.checks.some((check) => check.outcome === 'fail')
      ? 'fail'
      : 'inconclusive';
    if (!runtime)
      report.checks.push({
        id: 'setup',
        surface: 'runtime',
        outcome: 'inconclusive',
        observation: report.error,
      });
  } finally {
    const cleanupErrors: unknown[] = [];
    for (const cleanup of [
      () => otherMcp?.close(),
      () => mcp?.close(),
      () => host?.stop(),
      () => preview?.stop(),
      () => browser?.close(),
      () => runtime?.stop(),
    ]) {
      try {
        await cleanup();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (cleanupErrors.length) {
      report.cleanup = 'failed';
      report.outcome = 'inconclusive';
      report.error = `${report.error ?? ''}\nCleanup: ${cleanupErrors.map((error) => redact(String(error))).join('\n')}`;
    }
    if (runtime) {
      await writeFile(
        join(evidence, 'runtime.log'),
        redact(runtime.logs.join('')),
      );
      report.artifacts.push('runtime.log');
    }
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
      doctor: { type: 'boolean' },
      evidence: { type: 'string' },
      'project-root': { type: 'string' },
      'task-profile': { type: 'string', default: 'baseline' },
    },
  });
  const projectRoot = values['project-root'] ?? foundationRoot;
  if (values.doctor) {
    console.log(JSON.stringify(await doctor(projectRoot), null, 2));
  } else {
    const report = await verify({
      projectRoot,
      evidenceDirectory: values.evidence,
      taskProfile: z
        .enum(['baseline', 'title-edit'])
        .parse(values['task-profile']),
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.outcome !== 'pass') process.exitCode = 1;
  }
}
