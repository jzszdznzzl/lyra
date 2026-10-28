import { AuthError } from '@lyra/shared';

const AUTH_ERROR_STATUS = {
  [AuthError.InvalidCredentials]: 401,
  [AuthError.Unauthorized]: 401,
  [AuthError.EmailNotVerified]: 403,
  [AuthError.NotFound]: 404,
  [AuthError.EmailTaken]: 409,
  [AuthError.UsernameTaken]: 409,
  [AuthError.DisposableEmail]: 422,
  [AuthError.WeakPassword]: 422,
  [AuthError.InvalidToken]: 422,
  [AuthError.PasskeyFailed]: 422,
  [AuthError.InvalidImage]: 422,
  [AuthError.TooManyRequests]: 429,
} as const satisfies Record<AuthError, number>;

export function authErrorStatus(error: AuthError) {
  return AUTH_ERROR_STATUS[error];
}
