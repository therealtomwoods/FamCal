import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isBuild = command === 'build';
  return {
    // In production build for GitHub Pages use '/FamCal/', in dev use '/'
    base: isBuild ? '/FamCal/' : '/',
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      cors: true,
    },
    preview: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      cors: true,
    },
    plugins: [
      react(),
      {
        name: 'stock-proxy-middleware',
        configureServer(server) {
          server.middlewares.use('/api/stock', async (req, res) => {
            try {
              const url = new URL(req.url || '', 'http://localhost');
              const symbol = (url.searchParams.get('symbol') || 'GOOGL').toUpperCase();
              const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
              const fetchRes = await fetch(targetUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                  'Accept': 'application/json',
                },
              });
              if (!fetchRes.ok) {
                res.statusCode = fetchRes.status;
                res.end(JSON.stringify({ error: `Yahoo returned HTTP ${fetchRes.status}` }));
                return;
              }
              const data = await fetchRes.text();
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(data);
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        },
      },
      legacy({
        targets: ['chrome >= 49', 'edge >= 15', 'firefox >= 50', 'safari >= 10', 'defaults'],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
        modernPolyfills: true,
      }),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'FamCal - Family Organizer',
          short_name: 'FamCal',
          description: 'Full-screen 9:16 portrait family organizer, calendar & photo slideshow',
          theme_color: '#0a0d14',
          background_color: '#0a0d14',
          display: 'standalone',
          orientation: 'portrait',
          start_url: isBuild ? '/FamCal/' : '/',
          scope: isBuild ? '/FamCal/' : '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    build: {
      cssTarget: 'chrome50'
    }
  };
});
