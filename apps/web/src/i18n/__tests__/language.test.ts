import { describe, expect, test } from 'vitest';

import { browserLanguage, changeLanguage, initI18n } from '../index.ts';

describe('language', () => {
  test('first visits follow the browser language when Lyra speaks it', () => {
    expect(browserLanguage(['es-CL', 'en-US'])).toBe('es');
    expect(browserLanguage(['pt-BR', 'en-GB'])).toBe('en');
    expect(browserLanguage(['pt-BR', 'fr'])).toBeNull();
  });

  test('the page declares the language it is shown in', async () => {
    await initI18n('es');
    expect(document.documentElement.lang).toBe('es');

    await changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
  });
});
