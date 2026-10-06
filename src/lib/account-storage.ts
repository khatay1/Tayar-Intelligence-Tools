// Legacy unowned data stays in the guest namespace. Never adopt it into an account.
export function accountStorageKey(key: string, userId?: string | null): string {
  return userId ? `${key}:user:${encodeURIComponent(userId)}` : key;
}
