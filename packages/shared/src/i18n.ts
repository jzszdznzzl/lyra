export const Language = Object.freeze({
  English: 'en',
  Spanish: 'es',
} as const);

export type Language = (typeof Language)[keyof typeof Language];

export const DEFAULT_LANGUAGE: Language = Language.English;
