import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import { MailTransport } from '../config/env.ts';
import { moduleLogger } from '../logger.ts';
import type { Env } from '../config/env.ts';
import type { SettingsStore } from '../settings/settings.ts';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

const log = moduleLogger('mail');

/** Keeps sent mails in memory; tests read `sent` to follow links. */
export class MemoryMailer implements Mailer {
  #sent: Mail[] = [];

  get sent(): readonly Mail[] {
    return this.#sent;
  }

  send(mail: Mail) {
    this.#sent.push(mail);

    return Promise.resolve();
  }
}

/** Sends with the SMTP settings current at send time, so changes from the panel apply at once. */
export function createMailer(env: Env, settings: SettingsStore): Mailer {
  if (env.MAIL_TRANSPORT === MailTransport.File) {
    const outbox = join(env.DATA_DIR, 'outbox');

    return {
      async send(mail) {
        await mkdir(outbox, { recursive: true });
        await Bun.write(
          join(outbox, `${Date.now()}-${crypto.randomUUID()}.json`),
          JSON.stringify(mail),
        );
      },
    };
  }

  if (env.MAIL_TRANSPORT === MailTransport.Log) {
    return {
      send(mail) {
        log.info(`to=${mail.to} subject=${mail.subject}\n${mail.text}`);

        return Promise.resolve();
      },
    };
  }

  let cached: { key: string; transport: Transporter } | null = null;

  return {
    async send(mail) {
      const { smtp, mailFrom } = settings.current;
      const key = JSON.stringify(smtp);

      if (cached?.key !== key) {
        cached?.transport.close();
        cached = {
          key,
          transport: nodemailer.createTransport({
            host: smtp.host,
            port: smtp.port,
            // Port 465 speaks TLS from the first byte; 587 upgrades with STARTTLS.
            secure: smtp.port === 465,
            auth: { user: smtp.user, pass: smtp.pass },
          }),
        };
      }

      await cached.transport.sendMail({ from: mailFrom, ...mail });
    },
  };
}
