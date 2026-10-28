import { Language } from '@lyra/shared';

import type { Mail } from './mailer.ts';

interface ActionMail {
  subject: string;
  intro: string;
  action: string;
  outro: string;
}

const VERIFY_EMAIL: Record<Language, ActionMail> = {
  [Language.English]: {
    subject: 'Confirm your email for Lyra',
    intro: 'Welcome to Lyra! Confirm your email address to activate your account.',
    action: 'Confirm email',
    outro: 'The link expires in 24 hours. If you did not create an account, ignore this email.',
  },
  [Language.Spanish]: {
    subject: 'Confirma tu correo para Lyra',
    intro: '¡Bienvenido a Lyra! Confirma tu correo para activar tu cuenta.',
    action: 'Confirmar correo',
    outro: 'El enlace caduca en 24 horas. Si no creaste una cuenta, ignora este correo.',
  },
};

const RESET_PASSWORD: Record<Language, ActionMail> = {
  [Language.English]: {
    subject: 'Reset your Lyra password',
    intro: 'Someone asked to reset the password of your Lyra account.',
    action: 'Choose a new password',
    outro:
      'The link expires in 1 hour. If it was not you, ignore this email; your password stays the same.',
  },
  [Language.Spanish]: {
    subject: 'Restablece tu contraseña de Lyra',
    intro: 'Alguien pidió restablecer la contraseña de tu cuenta de Lyra.',
    action: 'Elegir una contraseña nueva',
    outro:
      'El enlace caduca en 1 hora. Si no fuiste tú, ignora este correo; tu contraseña no cambia.',
  },
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function render(to: string, name: string, copy: ActionMail, url: string): Mail {
  const greeting = `${name},`;

  return {
    to,
    subject: copy.subject,
    text: `${greeting}\n\n${copy.intro}\n\n${copy.action}: ${url}\n\n${copy.outro}\n`,
    html: `<!doctype html><html><body style="margin:0;background:#0b0a0f;font-family:Manrope,Segoe UI,Arial,sans-serif;color:#f4f1f6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#17151d;border-radius:16px;padding:32px">
<tr><td style="font-size:22px;font-weight:800;padding-bottom:20px;color:#e0457b">lyra</td></tr>
<tr><td style="font-size:15px;line-height:1.6">${escapeHtml(greeting)}<br><br>${escapeHtml(copy.intro)}</td></tr>
<tr><td style="padding:28px 0"><a href="${escapeHtml(url)}" style="background:#e0457b;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;display:inline-block">${escapeHtml(copy.action)}</a></td></tr>
<tr><td style="font-size:13px;line-height:1.6;color:#a39cab">${escapeHtml(copy.outro)}</td></tr>
</table></td></tr></table></body></html>`,
  };
}

export function verifyEmailMail(to: string, name: string, language: Language, url: string) {
  return render(to, name, VERIFY_EMAIL[language], url);
}

export function resetPasswordMail(to: string, name: string, language: Language, url: string) {
  return render(to, name, RESET_PASSWORD[language], url);
}
