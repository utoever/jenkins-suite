import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        extension: './src/extension.ts',
      },
      external: ['vscode']
    },
  },
});
