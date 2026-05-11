import { defineConfig } from 'vite';

export default defineConfig({
  base: '/equilibrium-lost/', // GitHub Pages project-site path; change if repo is renamed
  build: { outDir: 'dist', sourcemap: true },
  server: { open: true }
});
