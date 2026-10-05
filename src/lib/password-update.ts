import type { UserAttributes } from '@supabase/supabase-js';

// The pinned SDK forwards all attributes to Auth. Its older type omits the
// current_password field supported by the server; keep the extension explicit.
export function passwordUpdateAttributes(password: string, currentPassword?: string, nonce?: string): UserAttributes & { current_password?: string } {
  return { password, ...(currentPassword ? { current_password: currentPassword } : {}), ...(nonce?.trim() ? { nonce: nonce.trim() } : {}) };
}
