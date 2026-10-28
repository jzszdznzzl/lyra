import nodemailer from 'nodemailer';

import { MailTransport } from '../config/env.ts';
import type { Env } from '../config/env.ts';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

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

export function createMailer(env: Env): Mailer {
  if (env.MAIL_TRANSPORT === MailTransport.Log) {
    return {
      send(mail) {
        console.info(`[mail] to=${mail.to} subject=${mail.subject}\n${mail.text}`);

        return Promise.resolve();
      },
    };
  }

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // Port 465 speaks TLS from the first byte; 587 upgrades with STARTTLS.
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  return {
    async send(mail) {
      await transport.sendMail({ from: env.MAIL_FROM, ...mail });
    },
  };
}
