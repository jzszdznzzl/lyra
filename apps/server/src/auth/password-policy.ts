import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import * as common from '@zxcvbn-ts/language-common';
import * as english from '@zxcvbn-ts/language-en';
import * as spanish from '@zxcvbn-ts/language-es-es';

import { PASSWORD_MIN_SCORE } from '@lyra/shared';

const zxcvbn = new ZxcvbnFactory({
  dictionary: { ...common.dictionary, ...english.dictionary, ...spanish.dictionary },
  graphs: common.adjacencyGraphs,
});

/** True when the password resists guessing, also against the user's own email, name or username. */
export function isStrongPassword(password: string, userInputs: string[]) {
  return zxcvbn.check(password, userInputs).score >= PASSWORD_MIN_SCORE;
}

export function hashPassword(password: string) {
  return Bun.password.hash(password, { algorithm: 'argon2id' });
}

export function verifyPassword(password: string, hash: string) {
  return Bun.password.verify(password, hash);
}

// Verified against when the account does not exist, so both paths take the same time.
let dummyHash: Promise<string> | undefined;

export async function burnPasswordCheck(password: string) {
  dummyHash ??= hashPassword('lyra-dummy-password-for-timing');
  await verifyPassword(password, await dummyHash);
}
