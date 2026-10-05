import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { previewProxy } from '../../scripts/mcp-preview-proxy.ts';
export default defineConfig({
  plugins: [previewProxy(), react(), tailwind(), viteSingleFile()],
});
