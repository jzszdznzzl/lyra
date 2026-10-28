import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';

import { schema } from '../db/index.ts';
import type { AppContext } from '../context.ts';

// Fields that hold a remote image URL in the shared DTOs.
const IMAGE_FIELDS = new Set(['thumbnail', 'photo']);
const ID_BYTES = 16;
const KNOWN_LIMIT = 50_000;

export const IMAGE_PATH = '/api/images/';

export function imageId(url: string) {
  return createHash('sha256').update(url).digest().subarray(0, ID_BYTES).toString('base64url');
}

function collect(value: unknown, found: { owner: object; key: string; url: string }[]) {
  if (Array.isArray(value)) {
    value.forEach((item) => collect(item, found));
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      if (IMAGE_FIELDS.has(key) && typeof child === 'string' && child.startsWith('https://')) {
        found.push({ owner: value, key, url: child });
      } else {
        collect(child, found);
      }
    }
  }
}

/**
 * Remote cover URLs never reach the browser: responses carry `/api/images/{id}` instead, and
 * only ids issued here can be fetched, so nobody can make the server download other URLs.
 */
export class ImageRegistry {
  #ctx: AppContext;
  // Ids already stored, to skip the database on repeated covers.
  #known = new Set<string>();

  constructor(ctx: AppContext) {
    this.#ctx = ctx;
  }

  /** Replaces every image URL inside `value` (in place) with its lyra path. */
  async rewrite(value: unknown) {
    const found: { owner: object; key: string; url: string }[] = [];
    collect(value, found);

    const fresh = new Map<string, string>();

    for (const { owner, key, url } of found) {
      const id = imageId(url);
      Reflect.set(owner, key, `${IMAGE_PATH}${id}`);

      if (!this.#known.has(id)) {
        fresh.set(id, url);
      }
    }

    if (fresh.size === 0) {
      return;
    }

    const now = this.#ctx.now();
    await this.#ctx.db
      .insert(schema.images)
      .values([...fresh].map(([id, url]) => ({ id, url, createdAt: now })))
      .onConflictDoNothing();

    if (this.#known.size > KNOWN_LIMIT) {
      this.#known.clear();
    }

    fresh.forEach((_, id) => this.#known.add(id));
  }

  async urlOf(id: string) {
    const [row] = await this.#ctx.db.select().from(schema.images).where(eq(schema.images.id, id));

    return row?.url ?? null;
  }
}
