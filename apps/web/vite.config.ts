/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Random high ports: the usual ones (3000, 8080…) are taken on the host machine.
const WEB_PORT = 44_790;
const SERVER_PORT = Number(process.env['PORT'] ?? 39_422);

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
