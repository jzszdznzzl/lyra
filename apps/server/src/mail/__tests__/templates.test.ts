import { describe, expect, test } from 'bun:test';

import { verifyEmailMail } from '../templates.ts';

describe('mail templates', () => {
  test('verification mail carries the link and escapes the name', () => {
    const mail = verifyEmailMail('a@b.dev', '<Ana>', 'es', 'https://lyra.test/verify?token=x');

    expect(mail.subject).toBe('Confirma tu correo para Lyra');
    expect(mail.text).toContain('https://lyra.test/verify?token=x');
    expect(mail.html).toContain('&lt;Ana&gt;');
    expect(mail.html).not.toContain('<Ana>');
  });
});
