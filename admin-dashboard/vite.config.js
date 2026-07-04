import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@services': path.resolve(__dirname, './src/services'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@auth': path.resolve(__dirname, './src/auth'),
      '@layouts': path.resolve(__dirname, './src/layouts'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      /** Même cible pour tous les préfixes API Nest (dev sans VITE_API_URL). */
      '/admin': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/tenant': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/tickets': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/housing': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/invoice': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/notifications': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/users': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/landlords': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/agents': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/dashboard': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/stats': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/audit-logs': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/admins': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/housings': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/payments': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ai-diagnostics': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/lia-lab': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/doctrine-ledger': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
