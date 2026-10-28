import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';

import { BrowserViewport } from '@lyra/shared';
import type { BrowserClientMessage } from '@lyra/shared';

import { hasSessionCookie } from './verify-cookie.ts';

export interface RemoteLoginTarget {
  startUrl: string;
  // Sign-in is over once the page lands here and the session cookie exists.
  doneUrl: RegExp;
  cookieUrl: string;
}

export interface RemoteLoginHandlers {
  onFrame: (jpegBase64: string) => void;
  onCookie: (cookie: string) => void;
  onClosed: () => void;
}

export const GOOGLE_LOGIN_TARGET: RemoteLoginTarget = {
  startUrl:
    'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fmusic.youtube.com%2F',
  doneUrl: /^https:\/\/music\.youtube\.com\//,
  cookieUrl: 'https://music.youtube.com',
};

const SESSION_TIMEOUT_MS = 10 * 60 * 1000;
const FRAME_QUALITY = 70;
const SCALE = 2;
// Only keys needed to fill a sign-in form; anything else is ignored.
const ALLOWED_KEYS = new Set([
  'Enter',
  'Backspace',
  'Tab',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'Escape',
]);
const MOBILE_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';

/**
 * A headless Chromium the user drives through a canvas: frames go out, clicks and keys come in.
 * Only one runs at a time, since each holds a full browser in memory.
 */
export class RemoteLogin {
  #browser: Browser;
  #context: BrowserContext;
  #page: Page;
  #handlers: RemoteLoginHandlers;
  #target: RemoteLoginTarget;
  #timeout: ReturnType<typeof setTimeout>;
  #isClosed = false;

  static #active: RemoteLogin | null = null;

  constructor(
    browser: Browser,
    context: BrowserContext,
    page: Page,
    target: RemoteLoginTarget,
    handlers: RemoteLoginHandlers,
  ) {
    this.#browser = browser;
    this.#context = context;
    this.#page = page;
    this.#target = target;
    this.#handlers = handlers;
    this.#timeout = setTimeout(() => void this.close(), SESSION_TIMEOUT_MS);
  }

  async #checkSignedIn(url: string) {
    if (this.#isClosed || !this.#target.doneUrl.test(url)) {
      return;
    }

    const cookies = await this.#context.cookies(this.#target.cookieUrl);
    const header = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');

    if (hasSessionCookie(header)) {
      this.#handlers.onCookie(header);
      await this.close();
    }
  }

  static get isBusy() {
    return RemoteLogin.#active !== null;
  }

  async handle(message: BrowserClientMessage) {
    if (this.#isClosed) {
      return;
    }

    switch (message.type) {
      case 'click': {
        await this.#page.mouse.click(message.x, message.y);
        break;
      }
      case 'scroll': {
        await this.#page.mouse.wheel(0, message.deltaY);
        break;
      }
      case 'text': {
        await this.#page.keyboard.insertText(message.text);
        break;
      }
      case 'key': {
        if (ALLOWED_KEYS.has(message.key)) {
          await this.#page.keyboard.press(message.key);
        }

        break;
      }
      case 'cancel': {
        await this.close();
        break;
      }
      default: {
        break;
      }
    }
  }

  async close() {
    if (this.#isClosed) {
      return;
    }

    this.#isClosed = true;
    clearTimeout(this.#timeout);

    if (RemoteLogin.#active === this) {
      RemoteLogin.#active = null;
    }

    await this.#browser.close().catch(() => undefined);
    this.#handlers.onClosed();
  }

  /** Returns null when another sign-in is already running. */
  static async start(
    target: RemoteLoginTarget,
    handlers: RemoteLoginHandlers,
    executablePath?: string,
  ) {
    if (RemoteLogin.#active) {
      return null;
    }

    const browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      // Google refuses sign-in when the browser announces itself as automated.
      args: ['--disable-blink-features=AutomationControlled'],
    });
    const context = await browser.newContext({
      viewport: { width: BrowserViewport.Width, height: BrowserViewport.Height },
      deviceScaleFactor: SCALE,
      isMobile: true,
      userAgent: MOBILE_CHROME_UA,
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const session = new RemoteLogin(browser, context, page, target, handlers);

    RemoteLogin.#active = session;

    cdp.on('Page.screencastFrame', (frame) => {
      handlers.onFrame(frame.data);
      cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => undefined);
    });
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        session.#checkSignedIn(frame.url()).catch(() => undefined);
      }
    });

    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: FRAME_QUALITY,
      maxWidth: BrowserViewport.Width * SCALE,
      maxHeight: BrowserViewport.Height * SCALE,
    });
    await page.goto(target.startUrl).catch(() => undefined);

    return session;
  }
}
