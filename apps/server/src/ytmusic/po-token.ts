import { BotGuardClient } from 'bgutils-js/botguard';
import { GOOG_API_KEY, base64ToU8, buildURL, u8ToBase64 } from 'bgutils-js/utils';
import { JSDOM, VirtualConsole } from 'jsdom';
import { z } from 'zod';
import type { WebPoSignalOutput } from 'bgutils-js/shared-types';
import type { Innertube } from 'youtubei.js';

type MintFunction = (contentBinding: Uint8Array) => Promise<Uint8Array | undefined>;

interface Minter {
  mint: MintFunction;
  dom: JSDOM;
  expiresAt: number;
}

// [integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken]
const IntegrityTokenResponse = z.tuple([z.string(), z.number()]).rest(z.unknown());

// The key YouTube's web player uses when asking Google for an integrity token.
const REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo';
// Renew a little before Google's estimate, so a token never dies mid-song.
const EXPIRY_MARGIN_MS = 10 * 60 * 1000;
// After a failure, wait before trying again instead of hitting Google on every song.
const RETRY_DELAY_MS = 60 * 1000;
const BLANK_PAGE = '<!doctype html><html><head></head><body></body></html>';

/**
 * Mints Proof of Origin tokens with Google's BotGuard. Without one, googlevideo stops serving
 * web-client streams after the first MiB, so songs die a few seconds in.
 *
 * BotGuard's script runs inside jsdom's own context, which has no access to `process`, `require`
 * or the server's globals. jsdom is pinned to 27: on 30 the script throws on an EventTarget check
 * and Google answers without an integrity token.
 */
export class PoTokenMinter {
  #minter: Promise<Minter | null> | null = null;
  #retryAt = 0;
  #now: () => number;

  constructor(now: () => number) {
    this.#now = now;
  }

  async #create(yt: Innertube): Promise<Minter | null> {
    const challenge = (await yt.getAttestationChallenge('ENGAGEMENT_TYPE_UNBOUND')).bg_challenge;
    const interpreterUrl =
      challenge?.interpreter_url.private_do_not_access_or_else_trusted_resource_url_wrapped_value;

    if (!challenge || !interpreterUrl) {
      throw new Error('YouTube sent no BotGuard challenge');
    }

    const script = await (await fetch(`https:${interpreterUrl}`)).text();
    const dom = new JSDOM(BLANK_PAGE, {
      url: 'https://www.youtube.com/',
      runScripts: 'outside-only',
      pretendToBeVisual: true,
      // BotGuard probes browser APIs jsdom lacks (canvas); the warnings are expected noise.
      virtualConsole: new VirtualConsole(),
    });

    try {
      dom.window.eval(script);
      const botguard = await BotGuardClient.create({
        program: challenge.program,
        globalName: challenge.global_name,
        globalObject: dom.window,
      });
      const signals: WebPoSignalOutput = [];
      const snapshot = await botguard.snapshot({ webPoSignalOutput: signals });
      const response = await fetch(buildURL('GenerateIT', true), {
        method: 'POST',
        headers: {
          'content-type': 'application/json+protobuf',
          'x-goog-api-key': GOOG_API_KEY,
          'x-user-agent': 'grpc-web-javascript/0.1',
        },
        body: JSON.stringify([REQUEST_KEY, snapshot]),
      });
      const parsed = IntegrityTokenResponse.safeParse(await response.json());
      const getMinter = signals[0];

      if (!parsed.success || !getMinter) {
        throw new Error(`no integrity token (HTTP ${response.status})`);
      }

      const [integrityToken, ttlSeconds] = parsed.data;

      return {
        mint: await getMinter(base64ToU8(integrityToken)),
        dom,
        expiresAt: this.#now() + ttlSeconds * 1000 - EXPIRY_MARGIN_MS,
      };
    } catch (error) {
      dom.window.close();
      throw error;
    }
  }

  async #current(yt: Innertube) {
    const existing = await this.#minter;

    if (existing && existing.expiresAt > this.#now()) {
      return existing;
    }

    if (!existing && this.#minter && this.#now() < this.#retryAt) {
      return null;
    }

    existing?.dom.window.close();
    this.#minter = this.#create(yt).catch((error: unknown) => {
      console.warn(
        `[po-token] ${error instanceof Error ? error.message : String(error)}; retrying later`,
      );
      this.#retryAt = this.#now() + RETRY_DELAY_MS;

      return null;
    });

    return this.#minter;
  }

  /**
   * A token bound to `videoId`, or null when BotGuard is unavailable; playback then falls back
   * to clients that do not need one. `yt` is only used to fetch the challenge.
   */
  async mint(yt: Innertube, videoId: string): Promise<string | null> {
    const minter = await this.#current(yt);

    if (!minter) {
      return null;
    }

    try {
      const bytes = await minter.mint(new TextEncoder().encode(videoId));

      // The bytes come from jsdom's realm, where `instanceof Uint8Array` is false.
      return bytes && ArrayBuffer.isView(bytes)
        ? u8ToBase64(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), true)
        : null;
    } catch {
      return null;
    }
  }
}
