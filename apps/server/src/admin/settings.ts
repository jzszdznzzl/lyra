import { eq } from 'drizzle-orm';

import { FallbackStatus } from '@lyra/shared';
import type { AdminSettingsView } from '@lyra/shared';

import { schema } from '../db/index.ts';
import { isGoogleLinked } from '../google/accounts.ts';
import type { User } from '../auth/sessions.ts';
import type { AppContext } from '../context.ts';
import type { Mail } from '../mail/index.ts';

async function fallbackStatus(ctx: AppContext): Promise<FallbackStatus> {
  const username = ctx.settings.current.streamFallbackUsername;

  if (!username) {
    return FallbackStatus.Off;
  }

  const [user] = await ctx.db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.username, username));

  if (!user) {
    return FallbackStatus.UnknownUser;
  }

  return (await isGoogleLinked(ctx, user.id)) ? FallbackStatus.Ready : FallbackStatus.NotLinked;
}

export async function settingsView(ctx: AppContext): Promise<AdminSettingsView> {
  return { ...ctx.settings.forAdmin(), fallbackStatus: await fallbackStatus(ctx) };
}

/** A short mail to the admin, to check the SMTP settings without waiting for a sign-up. */
export function testMail(user: User): Mail {
  const text =
    user.language === 'es'
      ? 'Si lees esto, Lyra puede enviar correos con la configuración actual.'
      : 'If you are reading this, Lyra can send mail with the current settings.';

  return {
    to: user.email,
    subject: user.language === 'es' ? 'Lyra: correo de prueba' : 'Lyra: test email',
    text,
    html: `<p>${text}</p>`,
  };
}
