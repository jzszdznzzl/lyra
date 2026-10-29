import { z } from 'zod';

import { AuthError, GoogleError, MusicError, SocialError, err, ok } from '@lyra/shared';
import type { Result } from '@lyra/shared';

export const ApiError = Object.freeze({
  ...AuthError,
  ...MusicError,
  ...GoogleError,
  ...SocialError,
  Validation: 'validation',
  Network: 'network',
  Unexpected: 'unexpected',
} as const);

export type ApiError = (typeof ApiError)[keyof typeof ApiError];

const ErrorBody = z.object({
  error: z.enum({ ...AuthError, ...MusicError, ...GoogleError, ...SocialError }),
});
const ValidationBody = z.object({ type: z.literal('validation') });

export const NoContent = z.null();

/** Thrown only inside React Query functions, which signal failure by throwing. */
export class ApiFailure extends Error {
  #code: ApiError;

  constructor(code: ApiError) {
    super(code);
    this.#code = code;
  }

  get code() {
    return this.#code;
  }
}

/** Calls the Lyra API and validates the response body against `schema`. */
export async function api<S extends z.ZodType>(
  method: string,
  path: string,
  schema: S,
  body?: unknown,
): Promise<Result<z.infer<S>, ApiError>> {
  const isForm = body instanceof FormData;
  let response: Response;

  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined || isForm ? {} : { 'content-type': 'application/json' },
      body: isForm ? body : body === undefined ? null : JSON.stringify(body),
    });
  } catch {
    return err(ApiError.Network);
  }

  const payload: unknown =
    response.status === 204 ? null : await response.json().catch(() => undefined);

  if (!response.ok) {
    const known = ErrorBody.safeParse(payload);

    if (known.success) {
      return err(known.data.error);
    }

    return err(
      ValidationBody.safeParse(payload).success ? ApiError.Validation : ApiError.Unexpected,
    );
  }

  const parsed = schema.safeParse(payload);

  return parsed.success ? ok(parsed.data) : err(ApiError.Unexpected);
}

export function unwrap<T>(result: Result<T, ApiError>): T {
  if (result.error !== null) {
    throw new ApiFailure(result.error);
  }

  return result.data;
}
