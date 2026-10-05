import tseslint from "typescript-eslint";
import shadcn from "@shadcn/lint";
export default [
  {
    ignores: [
      "**/dist/**",
      "**/storybook-static/**",
      "**/_generated/**",
      "examples/**",
      "skills/**",
      "site/**",
      "scripts/**",
    ],
  },
  {
    files: ["apps/observatory/**/*.tsx", "packages/ui/**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { shadcn },
    settings: { shadcn: { ui: "@astack/ui" } },
    rules: {
      "shadcn/no-restyle": ["error", { allow: ["layout"] }],
      "shadcn/no-raw-colors": "error",
      "shadcn/no-arbitrary-values": ["error", { allow: ["layout"] }],
      "shadcn/no-inline-styles": "error",
      "shadcn/no-unknown-classes": "error",
      "shadcn/require-static-classes": "error",
    },
  },
  {
    files: ["packages/ui/src/**/*.tsx"],
    rules: {
      "shadcn/no-restyle": "off",
      "shadcn/no-arbitrary-values": "off",
      "shadcn/require-static-classes": "off",
    },
  },
];
