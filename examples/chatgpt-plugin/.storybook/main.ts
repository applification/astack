import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/ui/*.stories.tsx'],
  framework: '@storybook/react-vite',
  viteFinal: (config) => ({
    ...config,
    optimizeDeps: {
      ...config.optimizeDeps,
      // The renderer imports these CommonJS roots outside the story scan.
      include: [...(config.optimizeDeps?.include ?? []), 'react', 'react-dom'],
    },
  }),
};
export default config;
