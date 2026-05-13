import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const mastraServerUrl = process.env.MASTRA_SERVER_URL ?? 'http://localhost:4111';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5174,
    strictPort: true,
    watch: {
      ignored: ['**/.mastra/**', '**/dist/**'],
    },
    proxy: {
      '/chat': {
        target: mastraServerUrl,
        changeOrigin: true,
      },
    },
  },
});
