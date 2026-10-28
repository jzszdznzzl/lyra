import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { expect } from '@playwright/test';

/** Waits for the newest mail sent to `to` and returns the path+query of its link. */
export async function latestLink(to: string) {
  const outbox = join(process.env['E2E_DATA_DIR'] ?? '', 'outbox');
  let link: string | null = null;

  await expect
    .poll(async () => {
      const files = (await readdir(outbox).catch(() => [])).sort((a, b) => b.localeCompare(a));

      for (const file of files) {
        const mail: unknown = JSON.parse(await readFile(join(outbox, file), 'utf8'));

        if (
          typeof mail === 'object' &&
          mail !== null &&
          'to' in mail &&
          mail.to === to &&
          'text' in mail &&
          typeof mail.text === 'string'
        ) {
          const match = /https?:\/\/[^\s]+/.exec(mail.text);
          link = match ? new URL(match[0]).pathname + new URL(match[0]).search : null;

          return link;
        }
      }

      return null;
    })
    .not.toBeNull();

  return link ?? '';
}
