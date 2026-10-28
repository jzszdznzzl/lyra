import type { User } from '../auth/sessions.ts';
import type { AppContext } from '../context.ts';

/**
 * Admins are listed by email in ADMIN_EMAILS and count only once that email is verified, so
 * nobody can claim the role by signing up with an admin's address before they do.
 */
export function isAdmin(ctx: AppContext, user: User) {
  return user.emailVerifiedAt !== null && ctx.env.ADMIN_EMAILS.includes(user.email.toLowerCase());
}
