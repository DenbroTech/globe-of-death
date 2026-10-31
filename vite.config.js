import { defineConfig } from 'vite';

// host:true lets a phone on the same Wi-Fi open the dev server.
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 1500 },
});
