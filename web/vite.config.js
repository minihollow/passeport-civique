import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development: progress stays in the browser (never the installed app's file),
// and /ollama is proxied straight to Ollama.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: '../launcher/dist', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
  server: { proxy: { '/ollama': { target: 'http://localhost:11434', rewrite: (p) => p.replace(/^\/ollama/, '') } } },
});
