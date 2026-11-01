import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained HTML file (code, CSS and crowd atlas inlined) for quick phone tests.
// build stamp shown in Settings, so it's easy to tell which version a phone is running
const BUILD = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2020', outDir: 'dist-single', assetsInlineLimit: 100000000, chunkSizeWarningLimit: 5000 },
});
