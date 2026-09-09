import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 500;
const MAX_CHUNKS = 256;
const META_SUFFIX = 'meta';
const VERSION_RE = /^[a-z0-9]{6,32}$/;

let secureAvailablePromise: Promise<boolean> | null = null;

function secureAvailable() {
  if (!secureAvailablePromise) {
    secureAvailablePromise = SecureStore.isAvailableAsync().catch(() => false);
  }
  return secureAvailablePromise;
}

function stableKeyId(key: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `tayar.auth.${(hash >>> 0).toString(16)}.${key.length}`;
}

function metaKey(key: string) {
  return `${stableKeyId(key)}.${META_SUFFIX}`;
}

function chunkKey(key: string, version: string, index: number) {
  return `${stableKeyId(key)}.${version}.${index}`;
}

type SecureMeta = {
  version: string;
  count: number;
};

function parseMeta(value: string | null): SecureMeta | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<SecureMeta>;
    if (!VERSION_RE.test(String(parsed.version || ''))) return null;
    const count = Number(parsed.count);
    if (!Number.isInteger(count) || count < 1 || count > MAX_CHUNKS) return null;
    return { version: String(parsed.version), count };
  } catch {
    return null;
  }
}

function splitValue(value: string) {
  const chunks: string[] = [];
  for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
    chunks.push(value.slice(offset, offset + CHUNK_SIZE));
  }
  if (!chunks.length) chunks.push('');
  if (chunks.length > MAX_CHUNKS) {
    throw new Error('The mobile auth session is too large to store securely.');
  }
  return chunks;
}

async function readMeta(key: string) {
  return parseMeta(await SecureStore.getItemAsync(metaKey(key)));
}

async function removeChunks(key: string, meta: SecureMeta | null) {
  if (!meta) return;
  await Promise.all(
    Array.from({ length: meta.count }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, meta.version, index)).catch(() => undefined),
    ),
  );
}

async function readSecureValue(key: string, meta: SecureMeta) {
  const chunks = await Promise.all(
    Array.from({ length: meta.count }, (_, index) =>
      SecureStore.getItemAsync(chunkKey(key, meta.version, index)),
    ),
  );
  if (chunks.some((chunk) => chunk === null)) return null;
  return chunks.join('');
}

async function writeSecureValue(key: string, value: string) {
  const previousMeta = await readMeta(key);
  const chunks = splitValue(value);
  const version = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.slice(0, 24);
  const nextMeta: SecureMeta = { version, count: chunks.length };

  try {
    for (let index = 0; index < chunks.length; index += 1) {
      await SecureStore.setItemAsync(chunkKey(key, version, index), chunks[index]);
    }
    await SecureStore.setItemAsync(metaKey(key), JSON.stringify(nextMeta));
  } catch (error) {
    await removeChunks(key, nextMeta);
    throw error;
  }

  if (previousMeta && previousMeta.version !== version) {
    await removeChunks(key, previousMeta);
  }
  await AsyncStorage.removeItem(key).catch(() => undefined);
}

export const nativeAuthStorage = {
  async getItem(key: string) {
    if (!await secureAvailable()) return AsyncStorage.getItem(key);

    const meta = await readMeta(key);
    if (meta) {
      const secureValue = await readSecureValue(key, meta);
      if (secureValue !== null) return secureValue;
      await SecureStore.deleteItemAsync(metaKey(key)).catch(() => undefined);
      await removeChunks(key, meta);
    }

    const legacyValue = await AsyncStorage.getItem(key);
    if (legacyValue === null) return null;

    try {
      await writeSecureValue(key, legacyValue);
    } catch {
      // Keep the legacy value readable for this session and retry migration later.
    }
    return legacyValue;
  },

  async setItem(key: string, value: string) {
    if (!await secureAvailable()) {
      await AsyncStorage.setItem(key, value);
      return;
    }
    await writeSecureValue(key, value);
  },

  async removeItem(key: string) {
    if (await secureAvailable()) {
      const meta = await readMeta(key);
      await SecureStore.deleteItemAsync(metaKey(key)).catch(() => undefined);
      await removeChunks(key, meta);
    }
    await AsyncStorage.removeItem(key);
  },
};
