/**
 * Client-Side In-Memory LRU Analysis Cache
 * 
 * Hashes scrubbed contract text using DJB2 to cache analysis responses in memory.
 * Prevents duplicate external LLM requests, saves API tokens, and speeds up 
 * re-renders to 0ms latency.
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

export class MemoryCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries = 20, ttlMs = 1000 * 60 * 30) { // 30 min default TTL
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  /**
   * Fast, collision-resistant DJB2 string hash
   */
  static hashKey(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
      hash = hash & hash; // Convert to 32bit integer
    }
    return `lexar_${Math.abs(hash).toString(36)}`;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    // Check expiration
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.store.delete(key);
      return null;
    }

    // Refresh LRU order (delete & re-insert)
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      // Evict oldest entry
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }

    this.store.set(key, { value, timestamp: Date.now() });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

// Global analysis singleton cache
export const analysisCache = new MemoryCache<any>(25, 1000 * 60 * 60);
