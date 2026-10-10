import { expect, test } from "bun:test";
import { ESLint } from "eslint";
import { resolve } from "node:path";
import astack, { react, portableUi } from "./eslint.mjs";

const root = resolve(import.meta.dir, "fixture");
const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: true,
  overrideConfig: [
    ...astack({ root }),
    react(),
    ...portableUi({ root, ui: "views", domain: "model", backend: "server" }),
  ],
});

const base = new ESLint({
  cwd: root,
  overrideConfigFile: true,
  overrideConfig: astack({ root }),
});

const ui = "views/probe.tsx";
const domain = "model/probe.ts";
const domainTsx = "model/probe-view.tsx";

async function rules(file: string, code: string, config = eslint) {
  const [result] = await config.lintText(code, {
    filePath: resolve(root, file),
  });
  return result?.messages.map((message) => message.ruleId) ?? [];
}

test("accepts portable composition", async () => {
  expect(
    await rules(
      ui,
      "import type { ReactNode } from 'react'; export function View({ children }: {children: ReactNode}) {return <section>{children}</section>;}\n",
    ),
  ).toEqual([]);
});

test.each([
  [
    "unowned promise",
    ui,
    "export function unsafe() { Promise.resolve('write'); }\n",
    "@typescript-eslint/no-floating-promises",
  ],
  [
    "unsafe any boundary",
    ui,
    "export function unsafe(value: any): string { return value.title; }\n",
    "@typescript-eslint/no-unsafe-member-access",
  ],
  [
    "missing accessible name",
    ui,
    "export function View() { return <img src='record.png' />; }\n",
    "jsx-a11y/alt-text",
  ],
  [
    "conditional hook call",
    ui,
    "import { useState } from 'react'; export function View({ active }: {active:boolean}) { if (active) useState(0); return <p>Hi</p>; }\n",
    "react-hooks/rules-of-hooks",
  ],
  [
    "UI imports public backend export",
    ui,
    "export { api } from '@fixture/backend/api';\n",
    "astack/portable-ui",
  ],
  [
    "UI imports backend by relative path",
    ui,
    "export { list } from '../server/workItems';\n",
    "astack/portable-ui",
  ],
  [
    "UI imports backend through a tsconfig alias",
    ui,
    "export { list } from '@private-backend';\n",
    "astack/portable-ui",
  ],
  [
    "UI imports the WorkOS identity integration",
    ui,
    "export { AuthKitProvider } from '@workos-inc/authkit-react';\n",
    "astack/portable-ui",
  ],
  [
    "UI imports a Node builtin without the node: prefix",
    ui,
    "export { readFile } from 'fs/promises';\n",
    "astack/portable-ui",
  ],
  [
    "UI aliases global network access",
    ui,
    "export const fetchItems = globalThis.fetch;\n",
    "astack/portable-ui",
  ],
  [
    "domain imports React",
    domain,
    "export { useState } from 'react';\n",
    "astack/portable-ui",
  ],
  [
    "domain imports presentation",
    domain,
    "export { WorkItemList } from '@fixture/ui';\n",
    "astack/portable-ui",
  ],
  [
    "domain uses document",
    domain,
    "export const browser = document;\n",
    "no-restricted-globals",
  ],
  [
    "domain TSX uses window",
    domainTsx,
    "export const browser = window;\n",
    "no-restricted-globals",
  ],
  [
    "domain TSX uses document",
    domainTsx,
    "export const browser = document;\n",
    "no-restricted-globals",
  ],
])("rejects %s", async (_name, file, code, rule) => {
  expect(await rules(file, code)).toContain(rule);
});

test("base accepts backend integration without an architecture opt-in", async () => {
  expect(
    await rules(ui, "export { api } from '@fixture/backend/api';", base),
  ).toEqual([]);
});

test("base does not enforce React conventions", async () => {
  expect(
    await rules(
      ui,
      "export function View() { return <img src='item.png' />; }",
      base,
    ),
  ).toEqual([]);
});

test("portable UI accepts an injected callback named fetch", async () => {
  expect(
    await rules(ui, "export function refresh(fetch: () => void) { fetch(); }"),
  ).toEqual([]);
});

test("portable UI still rejects the browser fetch global", async () => {
  expect(await rules(ui, "export const load = fetch;")).toContain(
    "no-restricted-globals",
  );
});
