import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000';
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const enablePwa = nodeMajor >= 18;

  return {
    plugins: [
      react(),
      enablePwa
        ? VitePWA({
            registerType: 'autoUpdate',
            manifest: {
              name: 'KWDT Data Lens',
              short_name: 'Data Lens',
              description: 'Community and resource management for KWDT',
              theme_color: '#111111',
              background_color: '#111111',
              display: 'standalone',
              start_url: '/'
            },
            workbox: {
              navigateFallback: '/index.html',
              globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}']
            }
          })
        : undefined
    ].filter(Boolean),
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api/v1': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/health': {
          target: proxyTarget,
          changeOrigin: true
        }
      }
    }
  };
});
