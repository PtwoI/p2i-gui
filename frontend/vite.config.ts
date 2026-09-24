import { defineConfig } from 'vite';
export default defineConfig({
  build: { outDir: '../src/p2i_gui/static', emptyOutDir: true },
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } }
});
