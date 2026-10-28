import { z } from 'zod';

import { UpdateSettingsInput } from '@lyra/shared';
import type { AdminSettings } from '@lyra/shared';

import { decrypt, encrypt } from '../common/index.ts';
import { schema } from '../db/index.ts';
import type { Env } from '../config/env.ts';
import type { Database } from '../db/index.ts';

export interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
}

/** What the server runs with: the panel's values, falling back to the env file's. */
export interface EffectiveSettings {
  isRegistrationEnabled: boolean;
  streamFallbackUsername: string | null;
  mailFrom: string;
  smtp: SmtpSettings;
}

// One row per setting; each is checked on load, so a bad value falls back to the env file.
const Stored = z.object({
  isRegistrationEnabled: z.boolean(),
  streamFallbackUsername: z.string().nullable(),
  mailFrom: z.string(),
  smtpHost: z.string(),
  smtpPort: z.number().int(),
  smtpUser: z.string(),
  // Encrypted with SECRET_KEY, like the Google cookies.
  smtpPasswordEncrypted: z.string(),
});

type Stored = z.infer<typeof Stored>;

const STORED_KEYS: readonly string[] = Object.keys(Stored.shape);

function isStoredKey(key: string): key is keyof Stored {
  return STORED_KEYS.includes(key);
}

/**
 * Settings that admins change from the panel. Kept in memory and read on every use, so a change
 * applies at once without a restart. Values never set in the panel come from the env file.
 */
export class SettingsStore {
  #db: Database;
  #env: Env;
  #secretKey: Buffer;
  #now: () => number;
  #stored: Partial<Stored> = {};

  constructor(db: Database, env: Env, secretKey: Buffer, now: () => number) {
    this.#db = db;
    this.#env = env;
    this.#secretKey = secretKey;
    this.#now = now;
    this.#load();
  }

  #load() {
    const stored: Partial<Stored> = {};

    for (const row of this.#db.select().from(schema.settings).all()) {
      if (!isStoredKey(row.key)) {
        continue;
      }

      const parsed = Stored.shape[row.key].safeParse(row.value);

      if (parsed.success) {
        Object.assign(stored, { [row.key]: parsed.data });
      } else {
        console.warn(`[settings] ignoring an invalid stored value for ${row.key}`);
      }
    }

    this.#stored = stored;
  }

  #write(values: Partial<Stored>) {
    const updatedAt = this.#now();

    this.#db.transaction((tx) => {
      for (const [key, value] of Object.entries(values)) {
        tx.insert(schema.settings)
          .values({ key, value, updatedAt })
          .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt } })
          .run();
      }
    });

    this.#load();
  }

  get current(): EffectiveSettings {
    const stored = this.#stored;
    const env = this.#env;
    const password = stored.smtpPasswordEncrypted
      ? decrypt(stored.smtpPasswordEncrypted, this.#secretKey)
      : null;

    return {
      isRegistrationEnabled: stored.isRegistrationEnabled ?? env.REGISTRATION_ENABLED,
      streamFallbackUsername:
        stored.streamFallbackUsername === undefined
          ? (env.STREAM_FALLBACK_USERNAME ?? null)
          : stored.streamFallbackUsername,
      mailFrom: stored.mailFrom ?? env.MAIL_FROM,
      smtp: {
        host: stored.smtpHost ?? env.SMTP_HOST,
        port: stored.smtpPort ?? env.SMTP_PORT,
        user: stored.smtpUser ?? env.SMTP_USER,
        pass: password ?? env.SMTP_PASS,
      },
    };
  }

  /** The panel's view: everything but the SMTP password, which only says whether one is set. */
  forAdmin(): AdminSettings {
    const current = this.current;

    return {
      isRegistrationEnabled: current.isRegistrationEnabled,
      streamFallbackUsername: current.streamFallbackUsername,
      mailFrom: current.mailFrom,
      smtpHost: current.smtp.host,
      smtpPort: current.smtp.port,
      smtpUser: current.smtp.user,
      hasSmtpPassword: current.smtp.pass !== '',
      mailTransport: this.#env.MAIL_TRANSPORT,
    };
  }

  update(input: UpdateSettingsInput) {
    const { smtpPassword, streamFallbackUsername, ...rest } = UpdateSettingsInput.parse(input);

    this.#write({
      ...rest,
      // An empty name turns the fallback off, like leaving it out of the env file.
      ...(streamFallbackUsername === undefined
        ? {}
        : { streamFallbackUsername: streamFallbackUsername || null }),
      ...(smtpPassword === undefined
        ? {}
        : { smtpPasswordEncrypted: encrypt(smtpPassword, this.#secretKey) }),
    });
  }
}
