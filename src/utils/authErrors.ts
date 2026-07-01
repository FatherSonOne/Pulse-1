/**
 * Maps raw auth-backend error strings (Supabase / OAuth providers) to friendly,
 * human copy. Prevents technical noise like "AuthApiError: invalid grant" from
 * leaking into the login/reset UI, while preserving genuinely human messages the
 * backend already wrote well.
 *
 * Deliberately conservative: known codes map to clear copy; anything that looks
 * like a raw error object / class name falls back to a safe generic instead of
 * being shown verbatim.
 */
export function friendlyAuthError(raw?: string | null): string {
  const msg = (raw || '').toLowerCase().trim();
  if (!msg) return 'Something went wrong. Please try again.';

  if (
    msg.includes('invalid login') ||
    msg.includes('invalid grant') ||
    msg.includes('invalid credentials')
  ) {
    return "That email or password doesn't match our records.";
  }

  if (
    msg.includes('already registered') ||
    msg.includes('already exists') ||
    msg.includes('user already')
  ) {
    return 'An account with this email already exists. Try signing in instead.';
  }

  if (
    msg.includes('rate') ||
    msg.includes('too many') ||
    msg.includes('security purposes')
  ) {
    return 'Too many attempts. Please wait a moment, then try again.';
  }

  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('fetch')) {
    return 'Network trouble. Check your connection and try again.';
  }

  if (msg.includes('expired') || (msg.includes('token') && msg.includes('invalid'))) {
    return 'Your reset link has expired. Request a new one.';
  }

  if (msg.includes('password') && (msg.includes('6') || msg.includes('short') || msg.includes('least'))) {
    return 'Password must be at least 6 characters.';
  }

  if (msg.includes('popup') || msg.includes('cancel') || msg.includes('closed')) {
    return 'Sign-in was cancelled. Please try again.';
  }

  // Looks like a raw error object / class name / internals — never show verbatim.
  if (/error|exception|api|null|undefined|[{}[\]]|\bat\b/i.test(raw || '')) {
    return 'Something went wrong. Please try again.';
  }

  // Backend wrote a clean, human sentence — trust it.
  return raw as string;
}
