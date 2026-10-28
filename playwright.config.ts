import { defineConfig, devices } from '@playwright/test';
import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MIN_PORT = 20_000;
const PORT_RANGE = 40_000;

// The host has many ports taken, so each run picks free random ones instead of fixed defaults.
function freePort(taken: Set<number>) {
  const used = new Set(
    execSync('ss -ltnH')
      .toString()
      .split('\n')
      .map((line) => Number(line.trim().split(/\s+/)[3]?.split(':').at(-1))),
  );

  for (;;) {
    const port = MIN_PORT + Math.floor(Math.random() * PORT_RANGE);

    if (!used.has(port) && !taken.has(port)) {
      taken.add(port);

      return port;
    }
  }
}

const taken = new Set<number>();
const serverPort = process.env['E2E_SERVER_PORT'] ?? String(freePort(taken));
const webPort = process.env['E2E_WEB_PORT'] ?? String(freePort(taken));
const dataDir = process.env['E2E_DATA_DIR'] ?? mkdtempSync(join(tmpdir(), 'lyra-e2e-'));
const baseURL = `http://localhost:${webPort}`;

// Workers re-import this file; pinning the values keeps them on the same servers.
process.env['E2E_SERVER_PORT'] = serverPort;
process.env['E2E_WEB_PORT'] = webPort;
process.env['E2E_DATA_DIR'] = dataDir;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'bun apps/server/src/main.ts',
      url: `http://localhost:${serverPort}/api/health`,
      env: {
        PORT: serverPort,
        PUBLIC_URL: baseURL,
        DATA_DIR: dataDir,
        SECRET_KEY: Buffer.alloc(32, 9).toString('base64'),
        MAIL_TRANSPORT: 'file',
        MAIL_FROM: 'Lyra <noreply@lyra.test>',
      },
      reuseExistingServer: false,
    },
    {
      command: 'pnpm --filter @lyra/web exec vite',
      url: baseURL,
      env: { PORT: serverPort, WEB_PORT: webPort },
      reuseExistingServer: false,
    },
  ],
});
