export default {
  '*.{ts,tsx,js,mjs}': ['prettier --write', 'eslint --max-warnings 0'],
  '*.{json,md,css,html,yml}': 'prettier --write',
};
