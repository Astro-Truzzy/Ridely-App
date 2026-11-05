export interface AuthErrorCopy {
  title: string;
  message: string;
}

const normalized = (message: string): string => message.toLowerCase();

function includesAny(message: string, ...needles: string[]): boolean {
  const lower = normalized(message);
  return needles.some((needle) => lower.includes(needle));
}

/**
 * Friendly copy for sign-in failures caused by wrong credentials.
 * Returns null for errors that need a different flow (unconfirmed email)
 * or that aren't credential problems.
 */
export function getSignInErrorCopy(message: string): AuthErrorCopy | null {
  if (!message) return null;

  if (includesAny(message, 'invalid login credentials', 'invalid email or password')) {
    return {
      title: 'Incorrect email or password',
      message:
        "That email and password combination doesn't match our records. Check for typos and try again.",
    };
  }

  if (includesAny(message, 'email not confirmed', 'confirm your email')) {
    // Handled by the unconfirmed-email alert flow instead.
    return null;
  }

  if (
    includesAny(
      message,
      'network',
      'fetch',
      'timeout',
      'connection',
      'failed to sign in'
    ) &&
    !includesAny(message, 'invalid')
  ) {
    return {
      title: "Can't reach Ridely right now",
      message: 'Check your internet connection and try signing in again.',
    };
  }

  return {
    title: 'Sign in failed',
    message,
  };
}

export function isUnconfirmedEmailError(message: string): boolean {
  return includesAny(message, 'email not confirmed', 'confirm your email');
}

/**
 * Matches every "this email is taken" variant thrown by AuthContext.signUp
 * (ACCOUNT_EXISTS sentinel, Supabase "already registered", RLS 23505 path).
 */
export function isAccountExistsError(message: string): boolean {
  if (!message) return false;
  if (message.includes('ACCOUNT_EXISTS')) return true;
  return includesAny(
    message,
    'already registered',
    'user already exists',
    'email already registered',
    'already exists. please try signing in',
    'already exists. please sign in'
  );
}

export function getAccountExistsCopy(): AuthErrorCopy {
  return {
    title: 'Email already in use',
    message:
      'An account with this email already exists. Sign in to continue, or use a different email.',
  };
}
