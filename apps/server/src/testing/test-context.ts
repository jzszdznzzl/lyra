import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadEnv } from '../config/env.ts';
import { IN_MEMORY, openDatabase } from '../db/index.ts';
import { MemoryMailer } from '../mail/index.ts';
import type { App } from '../app.ts';
import type { AppContext } from '../context.ts';

export const TEST_ORIGIN = 'http://localhost:44790';

export interface TestContext extends AppContext {
  mailer: MemoryMailer;
  advance: (ms: number) => void;
}

export function createTestContext(): TestContext {
  let now = Date.UTC(2026, 9, 27);
  const env = loadEnv({
    PORT: '39422',
    PUBLIC_URL: TEST_ORIGIN,
    SECRET_KEY: Buffer.alloc(32, 7).toString('base64'),
    MAIL_TRANSPORT: 'log',
    TRUST_PROXY: 'true',
    MAIL_FROM: 'Lyra <noreply@lyra.test>',
  });

  return {
    db: openDatabase(IN_MEMORY),
    env,
    mailer: new MemoryMailer(),
    secretKey: Buffer.from(env.SECRET_KEY, 'base64'),
    dataDir: mkdtempSync(join(tmpdir(), 'lyra-test-')),
    now: () => now,
    advance: (ms) => {
      now += ms;
    },
  };
}

/** Small cookie-keeping client over `app.handle`, so tests read like a browser session. */
export class TestClient {
  #app: App;
  #cookie = '';
  #userAgent: string;

  constructor(app: App, userAgent = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/141.0') {
    this.#app = app;
    this.#userAgent = userAgent;
  }

  get cookie() {
    return this.#cookie;
  }

  async request(method: string, path: string, body?: unknown) {
    const headers = new Headers({
      'user-agent': this.#userAgent,
      'cf-connecting-ip': '203.0.113.7',
      // Like a browser on the app's own page, which the origin guard expects.
      origin: TEST_ORIGIN,
    });

    if (this.#cookie) {
      headers.set('cookie', this.#cookie);
    }

    let payload: FormData | string | undefined;

    if (body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers.set('content-type', 'application/json');
      payload = JSON.stringify(body);
    }

    const response = await this.#app.handle(
      new Request(`${TEST_ORIGIN}/api${path}`, { method, headers, body: payload ?? null }),
    );
    const setCookie = response.headers.get('set-cookie');

    if (setCookie) {
      const [pair] = setCookie.split(';');
      this.#cookie = pair?.endsWith('=') ? '' : (pair ?? '');
    }

    const isJson = response.headers.get('content-type')?.includes('application/json') ?? false;
    const text = isJson ? await response.text() : '';

    return { status: response.status, body: text ? JSON.parse(text) : null };
  }
}

export function linkToken(text: string) {
  const match = /token=([\w-]+)/.exec(text);

  if (!match?.[1]) {
    throw new Error('No token link in mail');
  }

  return match[1];
}
