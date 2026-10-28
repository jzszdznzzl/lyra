import type { ZxcvbnFactory } from '@zxcvbn-ts/core';

let factory: Promise<ZxcvbnFactory> | undefined;

// The dictionaries weigh about 1 MB, so they load only when a password field is used.
async function loadFactory() {
  const [{ ZxcvbnFactory }, common, english, spanish] = await Promise.all([
    import('@zxcvbn-ts/core'),
    import('@zxcvbn-ts/language-common'),
    import('@zxcvbn-ts/language-en'),
    import('@zxcvbn-ts/language-es-es'),
  ]);

  return new ZxcvbnFactory({
    dictionary: { ...common.dictionary, ...english.dictionary, ...spanish.dictionary },
    graphs: common.adjacencyGraphs,
  });
}

/** Same 0-4 score the server checks, so the meter and the server agree. */
export async function passwordScore(password: string, userInputs: string[]) {
  factory ??= loadFactory();

  return (await factory).check(password, userInputs).score;
}
