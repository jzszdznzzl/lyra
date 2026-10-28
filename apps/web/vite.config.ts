/// <reference types="vitest/config" />
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';

// Random high ports: the usual ones (3000, 8080…) are taken on the host machine.
const WEB_PORT = Number(process.env['WEB_PORT'] ?? 44_790);
const SERVER_PORT = Number(process.env['PORT'] ?? 39_422);
const BACKGROUND = '#0b0a0f';
const CHANGELOG_PATH = new URL('src/changelog.json', import.meta.url);

function git(args: string[]) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/**
 * The version is the last commit's date and hash ("2026.10.28-62fec70"): deploys build straight
 * from main, so nobody has to bump a number. The build time is when it was published.
 */
function buildInfo() {
  const commit = git(['rev-parse', '--short=7', 'HEAD']) ?? 'dev';
  const date = git(['log', '-1', '--format=%cd', '--date=format:%Y.%m.%d']) ?? 'dev';

  return { version: `${date}-${commit}`, commit, builtAt: new Date().toISOString() };
}

/**
 * Publishes version.json and changelog.json next to the app and the build info inside it, so a
 * running app can compare itself with what the server has now. JSON files stay out of the
 * service worker's precache, so they always come from the server.
 */
function versionPlugin(): Plugin {
  const info = buildInfo();
  const files = () => ({
    'version.json': JSON.stringify(info),
    'changelog.json': readFileSync(CHANGELOG_PATH, 'utf8'),
  });

  return {
    name: 'lyra-version',
    config: () => ({ define: { __LYRA_BUILD__: JSON.stringify(info) } }),
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const body = Object.entries(files()).find(([name]) => request.url === `/${name}`)?.[1];

        if (body === undefined) {
          next();

          return;
        }

        response.setHeader('content-type', 'application/json');
        response.end(body);
      });
    },
    generateBundle() {
      for (const [fileName, source] of Object.entries(files())) {
        this.emitFile({ type: 'asset', fileName, source });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    versionPlugin(),
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
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The share banner is only for link previews; no need to store it on every device.
        globIgnores: ['og.png'],
        sourcemap: false,
      },
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
  build: {
    // Explicit: shipping the original sources would publish the whole client code base.
    sourcemap: false,
  },
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
