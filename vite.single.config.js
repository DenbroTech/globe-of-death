import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained HTML file (code, CSS and crowd atlas inlined) for quick phone tests.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2020', outDir: 'dist-single', assetsInlineLimit: 100000000, chunkSizeWarningLimit: 5000 },
});
