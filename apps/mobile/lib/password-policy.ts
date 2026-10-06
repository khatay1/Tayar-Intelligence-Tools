export type PasswordPolicyResult = { valid: true } | { valid: false; error: string };

export function validatePassword(password: string): PasswordPolicyResult {
  if (password.length < 8) return { valid: false, error: 'Password must be at least 8 characters.' };
  if (password.length > 128) return { valid: false, error: 'Password is too long.' };
  if (!/[a-z]/.test(password)) return { valid: false, error: 'Password must contain a lowercase letter.' };
  if (!/[A-Z]/.test(password)) return { valid: false, error: 'Password must contain an uppercase letter.' };
  if (!/\d/.test(password)) return { valid: false, error: 'Password must contain a number.' };
  return { valid: true };
}
