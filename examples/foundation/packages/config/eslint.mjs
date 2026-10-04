import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import react from 'eslint-plugin-react';
import a11y from 'eslint-plugin-jsx-a11y';
import ts from 'typescript';
import { resolve, dirname } from 'node:path';
import { builtinModules } from 'node:module';

const portableBoundary = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      violation:
        'UI 01: invalid package dependency {{name}}. Keep UI/domain portable, use public package exports, and move backend, identity, navigation or host access to app adapters with typed props/callbacks. See packages/ui/src/index.tsx and README.md.',
      dynamic:
        'UI 01: portable UI imports must be statically resolvable; use a typed callback for application capabilities.',
    },
  },
  create(context) {
    const importer = context.filename;
    const portable = /\/packages\/(?:ui|domain)\//.test(importer);
    const domain = /\/packages\/domain\//.test(importer);
    const importerPackage = importer.match(/\/(?:apps|packages)\/[^/]+\//)?.[0];
    function inspect(node, source) {
      if (typeof source !== 'string') {
        if (portable) context.report({ node, messageId: 'dynamic' });
        return;
      }
      const configFile = ts.findConfigFile(
        dirname(importer),
        ts.sys.fileExists,
      );
      const options = configFile
        ? ts.parseJsonConfigFileContent(
            ts.readConfigFile(configFile, ts.sys.readFile).config,
            ts.sys,
            dirname(configFile),
          ).options
        : {
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            module: ts.ModuleKind.ESNext,
            allowImportingTsExtensions: true,
          };
      const filename =
        ts.resolveModuleName(source, importer, options, ts.sys).resolvedModule
          ?.resolvedFileName ?? resolve(importer, '..', source);
      const targetPackage = filename.match(/\/(?:apps|packages)\/[^/]+\//)?.[0];
      const privateCrossing =
        importerPackage &&
        targetPackage &&
        importerPackage !== targetPackage &&
        !source.startsWith('@foundation/');
      const forbidden =
        privateCrossing ||
        (domain &&
          (/\/packages\/ui\//.test(filename) ||
            /^(?:react(?:\/|$)|react-dom(?:\/|$)|@tanstack\/react-|@radix-ui\/)/.test(
              source,
            ))) ||
        (portable &&
          (/(?:^|\/)(?:apps|packages\/backend)\//.test(filename) ||
            /^(?:convex|@workos|@convex-dev|@tanstack\/(?:react-router|react-query)|@modelcontextprotocol|node:|axios|ky|undici)/.test(
              source,
            ) ||
            builtinModules.includes(source)));
      if (forbidden)
        context.report({
          node,
          messageId: 'violation',
          data: { name: source },
        });
    }
    return {
      ImportDeclaration: (node) => inspect(node, node.source.value),
      ExportNamedDeclaration: (node) => {
        if (node.source) inspect(node, node.source.value);
      },
      ExportAllDeclaration: (node) => inspect(node, node.source.value),
      ImportExpression: (node) => inspect(node, node.source.value),
      MemberExpression: (node) => {
        const name = node.computed ? node.property.value : node.property.name;
        if (
          portable &&
          node.object.type === 'Identifier' &&
          ['globalThis', 'window', 'self'].includes(node.object.name) &&
          ['fetch', 'WebSocket', 'XMLHttpRequest'].includes(name)
        )
          context.report({
            node,
            messageId: 'violation',
            data: { name: 'direct network access' },
          });
      },
      CallExpression: (node) => {
        if (
          node.callee.type === 'Identifier' &&
          ['require', 'fetch'].includes(node.callee.name)
        ) {
          if (node.callee.name === 'fetch') {
            if (portable)
              context.report({
                node,
                messageId: 'violation',
                data: { name: 'direct network access' },
              });
          } else inspect(node, node.arguments[0]?.value);
        }
      },
    };
  },
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/storybook-static/**',
      '**/_generated/**',
      '**/generated/**',
      '.proof/**',
      '**/.convex/**',
      '.turbo/**',
      '.husky/**',
    ],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly' } },
  },
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: process.cwd() },
    },
    plugins: { foundation: { rules: { 'portable-ui': portableBoundary } } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-floating-promises': [
        'error',
        { ignoreVoid: false },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],
      'foundation/portable-ui': 'error',
    },
  },
  {
    files: ['packages/domain/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message: 'DATA 01: browser capabilities belong in an app adapter.',
        },
        {
          name: 'document',
          message: 'DATA 01: browser capabilities belong in an app adapter.',
        },
      ],
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': reactHooks, react, 'jsx-a11y': a11y },
    settings: {
      react: { version: '19.3' },
      'jsx-a11y': { components: { Button: 'button', Input: 'input' } },
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      ...a11y.flatConfigs.recommended.rules,
      'react/jsx-key': 'error',
    },
  },
);
