import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@wormhole/shared': resolve(__dirname, '../shared/dist/index.js'),
    },
  },
  server: {
    port: 3000,
  },
});