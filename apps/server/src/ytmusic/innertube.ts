import vm from 'node:vm';
import { join } from 'node:path';
import { Innertube, Log, Platform, UniversalCache } from 'youtubei.js';

import type { Language } from '@lyra/shared';

const EVAL_TIMEOUT_MS = 2000;

let isEvaluatorInstalled = false;

/**
 * youtubei.js needs to run YouTube's player script to decipher stream URLs. It runs in a bare
 * VM context: the script gets no `process`, `require` or network, only the values it decodes.
 */
function installEvaluator() {
  if (isEvaluatorInstalled) {
    return;
  }

  isEvaluatorInstalled = true;
  // youtubei.js logs every unknown node YouTube adds; only real errors matter here.
  Log.setLevel(Log.Level.ERROR);
  Platform.shim.eval = (data, env) => {
    const code = `(function () {\n${data.output}\nreturn process(env.n, env.sp, env.sig);\n})()`;
    const result: unknown = vm.runInNewContext(code, { env }, { timeout: EVAL_TIMEOUT_MS });

    return typeof result === 'object' && result !== null ? { ...result } : undefined;
  };
}

interface PoolKey {
  userId: string | null;
  cookie: string | null;
  language: Language;
}

/** One Innertube client per user and language; creating one costs a few network round trips. */
export class InnertubePool {
  #clients = new Map<string, Promise<Innertube>>();
  #cache: UniversalCache;

  constructor(dataDir: string) {
    installEvaluator();
    // Persists the deciphered player between restarts, so the first song after boot starts fast.
    this.#cache = new UniversalCache(true, join(dataDir, 'yt-cache'));
  }

  get({ userId, cookie, language }: PoolKey) {
    const key = `${userId ?? 'anonymous'}:${language}`;
    let client = this.#clients.get(key);

    if (!client) {
      client = Innertube.create({
        ...(cookie ? { cookie } : {}),
        lang: language,
        cache: this.#cache,
        retrieve_player: true,
      });
      // A failed creation must not stay cached, or the user would be stuck until a restart.
      client.catch(() => this.#clients.delete(key));
      this.#clients.set(key, client);
    }

    return client;
  }

  /** Drops the user's clients, e.g. after linking or unlinking Google. */
  forget(userId: string) {
    for (const key of this.#clients.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.#clients.delete(key);
      }
    }
  }
}
