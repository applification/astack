import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactPlugin from "eslint-plugin-react";
import a11y from "eslint-plugin-jsx-a11y";
import ts from "typescript";
import { resolve, dirname, sep } from "node:path";
import { builtinModules } from "node:module";

const networkGlobals = ["fetch", "WebSocket", "XMLHttpRequest"];
const contains = (directory, filename) =>
  directory && (filename === directory || filename.startsWith(directory + sep));

const portableBoundary = {
  meta: {
    type: "problem",
    schema: [
      {
        type: "object",
        properties: {
          root: { type: "string" },
          ui: { type: "string" },
          domain: { type: "string" },
          backend: { type: "string" },
        },
        required: ["root"],
        additionalProperties: false,
      },
    ],
    messages: {
      violation:
        "Portable code cannot depend on {{name}}. Keep server, network and host access in adapters and pass typed data/callbacks to portable components.",
      dynamic:
        "Portable imports must be statically resolvable; pass a typed callback for application capabilities.",
    },
  },
  create(context) {
    const { root, ui, domain, backend } = context.options[0];
    const importer = resolve(context.filename);
    const uiPath = ui && resolve(root, ui);
    const domainPath = domain && resolve(root, domain);
    const backendPath = backend && resolve(root, backend);
    const inDomain = contains(domainPath, importer);
    const configFile = ts.findConfigFile(dirname(importer), ts.sys.fileExists);
    const options = configFile
      ? ts.parseJsonConfigFileContent(
          ts.readConfigFile(configFile, ts.sys.readFile).config,
          ts.sys,
          dirname(configFile),
        ).options
      : {
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          module: ts.ModuleKind.ESNext,
        };

    function inspect(node, source) {
      if (typeof source !== "string") {
        context.report({ node, messageId: "dynamic" });
        return;
      }
      const filename = resolve(
        ts.resolveModuleName(source, importer, options, ts.sys).resolvedModule
          ?.resolvedFileName ?? resolve(dirname(importer), source),
      );
      const forbidden =
        contains(backendPath, filename) ||
        source.startsWith("node:") ||
        builtinModules.includes(source) ||
        /^(?:convex(?:\/|$)|@workos(?:-inc)?\/|@convex-dev\/|@tanstack\/(?:react-router|react-query)(?:\/|$)|@modelcontextprotocol\/|axios(?:\/|$)|ky(?:\/|$)|undici(?:\/|$))/.test(
          source,
        ) ||
        (inDomain &&
          (contains(uiPath, filename) ||
            /^(?:react(?:\/|$)|react-dom(?:\/|$)|@tanstack\/react-|@radix-ui\/)/.test(
              source,
            )));
      if (forbidden)
        context.report({
          node,
          messageId: "violation",
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
      CallExpression: (node) => {
        if (node.callee.type === "Identifier" && node.callee.name === "require")
          inspect(node, node.arguments[0]?.value);
      },
      MemberExpression: (node) => {
        const name = node.computed ? node.property.value : node.property.name;
        const denied = inDomain
          ? [...networkGlobals, "window", "document"]
          : networkGlobals;
        if (
          node.object.type === "Identifier" &&
          ["globalThis", "window", "self"].includes(node.object.name) &&
          denied.includes(name)
        ) {
          context.report({
            node,
            messageId: "violation",
            data: { name: "direct host access" },
          });
        }
      },
    };
  },
};

export default function astack({ root = process.cwd() } = {}) {
  return tseslint.config(
    {
      ignores: [
        "**/node_modules/**",
        "**/dist/**",
        "**/storybook-static/**",
        "**/_generated/**",
        "**/generated/**",
        ".proof/**",
        "**/.convex/**",
        ".turbo/**",
        ".husky/**",
      ],
    },
    {
      ...js.configs.recommended,
      files: ["**/*.mjs"],
      languageOptions: {
        globals: { console: "readonly", process: "readonly" },
      },
    },
    ...tseslint.configs.strictTypeChecked.map((config) => ({
      ...config,
      files: ["**/*.{ts,tsx}"],
    })),
    {
      files: ["**/*.{ts,tsx}"],
      linterOptions: { reportUnusedDisableDirectives: "error" },
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir: root },
      },
      rules: {
        "@typescript-eslint/consistent-type-imports": "error",
        "@typescript-eslint/no-non-null-assertion": "error",
        "@typescript-eslint/no-floating-promises": [
          "error",
          { ignoreVoid: false },
        ],
        "@typescript-eslint/switch-exhaustiveness-check": "error",
        "@typescript-eslint/restrict-template-expressions": [
          "error",
          { allowNumber: true },
        ],
      },
    },
  );
}

export function react() {
  return {
    files: ["**/*.tsx"],
    plugins: {
      "react-hooks": reactHooks,
      react: reactPlugin,
      "jsx-a11y": a11y,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      ...a11y.flatConfigs.recommended.rules,
      "react/jsx-key": "error",
    },
  };
}

export function portableUi({ ui, domain, backend, root = process.cwd() }) {
  if (!ui && !domain)
    throw new Error("portableUi requires a ui or domain directory.");
  const files = [ui, domain]
    .filter(Boolean)
    .map(
      (directory) =>
        `${directory.replaceAll("\\", "/").replace(/\/$/, "")}/**/*.{ts,tsx}`,
    );
  const options = {
    root,
    ...(ui && { ui }),
    ...(domain && { domain }),
    ...(backend && { backend }),
  };
  return [
    {
      files,
      plugins: { astack: { rules: { "portable-ui": portableBoundary } } },
      rules: {
        "astack/portable-ui": ["error", options],
        "no-restricted-globals": ["error", ...networkGlobals],
      },
    },
    ...(domain
      ? [
          {
            files: [
              `${domain.replaceAll("\\", "/").replace(/\/$/, "")}/**/*.{ts,tsx}`,
            ],
            rules: {
              "no-restricted-globals": [
                "error",
                ...networkGlobals,
                {
                  name: "window",
                  message: "Browser capabilities belong in a host adapter.",
                },
                {
                  name: "document",
                  message: "Browser capabilities belong in a host adapter.",
                },
              ],
            },
          },
        ]
      : []),
  ];
}
