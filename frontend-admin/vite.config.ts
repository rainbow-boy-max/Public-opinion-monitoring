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
      '/knowledge': {
        target: 'http://localhost:3000',
        changeOrigin: true,
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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('/element-plus/') ||
              id.includes('/element-plus/') ||
              id.includes('@element-plus/icons-vue')
            ) {
              return 'vendor-element-plus';
            }
            if (id.includes('/echarts/')) {
              return 'vendor-echarts';
            }
            if (
              id.includes('/vue/') ||
              id.includes('/vue-router/') ||
              id.includes('/pinia/')
            ) {
              return 'vendor-vue';
            }
          }
          return undefined;
        },
      },
    },
  },
});
