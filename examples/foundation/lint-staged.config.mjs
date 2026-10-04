export default {
  '*.{ts,tsx,js,mjs}': [
    'bun scripts/prepare-check.ts',
    'prettier --write',
    'eslint --no-warn-ignored --max-warnings 0',
  ],
  '*.{json,md,css,html,yml}': 'prettier --write',
};
