import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 5174,
    host: true,
    allowedHosts: ['.monkeycode-ai.online', 'localhost'],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/agents': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
      '/pr': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/monitor-tasks': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/webhooks': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    outDir: 'dist',
  },
});