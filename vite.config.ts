import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  // Use /FamCal/ on GitHub Pages, fallback to ./ for local preview
  base: process.env.NODE_ENV === 'production' ? '/FamCal/' : './',
  plugins: [
    react(),
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
        start_url: '/FamCal/',
        scope: '/FamCal/',
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
});
