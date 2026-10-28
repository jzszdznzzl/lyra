/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Random high ports: the usual ones (3000, 8080…) are taken on the host machine.
const WEB_PORT = Number(process.env['WEB_PORT'] ?? 44_790);
const SERVER_PORT = Number(process.env['PORT'] ?? 39_422);
const BACKGROUND = '#0b0a0f';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // A hand-written worker: offline songs need range requests served from the cache.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // 'prompt': the app decides when to switch (never mid-song), see app/updates.ts.
      registerType: 'prompt',
      injectRegister: false,
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
      manifest: {
        name: 'Lyra',
        short_name: 'Lyra',
        description: 'Your music, everywhere you are.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: BACKGROUND,
        theme_color: BACKGROUND,
        categories: ['music', 'entertainment'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    port: WEB_PORT,
    strictPort: true,
    proxy: {
      '/api': { target: `http://localhost:${SERVER_PORT}`, ws: true },
    },
  },
  test: {
    environment: 'happy-dom',
  },
});
