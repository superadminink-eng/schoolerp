interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class RbacCache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  clearUser(userId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`perm:${userId}:`) || key.startsWith(`status:${userId}`)) {
        this.cache.delete(key);
      }
    }
  }
}

export const rbacCache = new RbacCache();
export const CACHE_TTLS = {
  PERMISSION: 30000, // 30 seconds
  USER_STATUS: 10000, // 10 seconds (rapid revocation check)
};
