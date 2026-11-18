/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Never inline assets as data: URIs beyond what the CSP allows; keep everything as same-origin files.
    assetsInlineLimit: 0,
    sourcemap: false,
  },
  test: {
    include: ['src/**/*.test.ts', 'fixtures/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['src/storage/test-setup.ts'],
  },
});
