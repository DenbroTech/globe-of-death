import { defineConfig } from 'vite';

// host:true lets a phone on the same Wi-Fi open the dev server.
// build stamp shown in Settings, so it's easy to tell which version a phone is running
const BUILD = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  base: './',
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 1500 },
});
