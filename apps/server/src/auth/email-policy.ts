import { isValid } from 'mailchecker';

/** Rejects syntactically broken addresses and known throwaway providers. */
export function isAllowedEmail(email: string) {
  return isValid(email);
}
