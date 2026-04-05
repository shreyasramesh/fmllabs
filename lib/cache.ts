/**
 * Lightweight in-process LRU-ish cache with TTL expiry.
 *
 * Each namespace gets its own Map so different domains (settings, habits, etc.)
 * don't compete for eviction slots. Memory is bounded per-namespace via maxSize.
 */

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const namespaces = new Map<string, Map<string, CacheEntry>>();

export interface CacheNamespace {
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown, ttlMs: number): void;
  invalidate(key: string): void;
  /** Delete every key that starts with `prefix`. */
  invalidatePrefix(prefix: string): void;
  /** Drop all entries in this namespace. */
  clear(): void;
}

export function getCache(namespace: string, maxSize = 500): CacheNamespace {
  if (!namespaces.has(namespace)) namespaces.set(namespace, new Map());
  const store = namespaces.get(namespace)!;

  return {
    get<T>(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
      }
      return entry.value as T;
    },

    set(key: string, value: unknown, ttlMs: number) {
      if (store.size >= maxSize) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },

    invalidate(key: string) {
      store.delete(key);
    },

    invalidatePrefix(prefix: string) {
      for (const k of store.keys()) {
        if (k.startsWith(prefix)) store.delete(k);
      }
    },

    clear() {
      store.clear();
    },
  };
}
