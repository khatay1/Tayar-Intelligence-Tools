export const AUTH_STORAGE_KEY = 'tayar-auth';
const MODE_KEY = 'tayar-auth-remember';
type AuthStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createAuthSessionStorage(persistent: AuthStorage, tab: AuthStorage) {
  function remembered() {
    const mode = tab.getItem(MODE_KEY);
    // Keep existing remembered logins until an explicit new sign-in choice.
    return mode === 'true' || (mode === null && persistent.getItem(AUTH_STORAGE_KEY) !== null);
  }
  return {
    setRememberSession(value: boolean) { tab.setItem(MODE_KEY, String(value)); },
    getItem(key: string) { return (remembered() ? persistent : tab).getItem(key); },
    setItem(key: string, value: string) {
      const keep = remembered();
      (keep ? persistent : tab).setItem(key, value);
      (keep ? tab : persistent).removeItem(key);
    },
    removeItem(key: string) { persistent.removeItem(key); tab.removeItem(key); },
    containsUser(userId: string) {
      try { return JSON.parse(this.getItem(AUTH_STORAGE_KEY) || 'null')?.user?.id === userId; }
      catch { return false; }
    },
  };
}

function availableStorage(kind: 'localStorage' | 'sessionStorage'): AuthStorage {
  try {
    const storage = window[kind];
    const probe = `${MODE_KEY}-probe`;
    storage.setItem(probe, '1'); storage.removeItem(probe);
    return storage;
  } catch {
    // Never fall back to persistent storage for a non-remembered login.
    const memory = new Map<string, string>();
    return {
      getItem: key => memory.get(key) ?? null,
      setItem: (key, value) => { memory.set(key, value); },
      removeItem: key => { memory.delete(key); },
    };
  }
}

export const authSessionStorage = createAuthSessionStorage(
  availableStorage('localStorage'), availableStorage('sessionStorage'),
);
