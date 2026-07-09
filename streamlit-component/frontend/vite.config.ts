import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// The '@' alias points at the main repo's src/ so the grid source is shared,
// not copied. Building this component always builds the latest grid code.
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../../src', import.meta.url)),
    },
  },
  build: {
    outDir: '../fancy_ui_grid/frontend_build',
    emptyOutDir: true,
  },
});
