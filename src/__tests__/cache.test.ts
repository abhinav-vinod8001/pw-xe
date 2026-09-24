/**
 * Unit Tests: In-Memory LRU Cache
 */

import { MemoryCache } from '../lib/cache';

describe('MemoryCache', () => {
  it('should generate stable DJB2 hashes for identical strings', () => {
    const hash1 = MemoryCache.hashKey('Contract Text A');
    const hash2 = MemoryCache.hashKey('Contract Text A');
    const hash3 = MemoryCache.hashKey('Contract Text B');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1.startsWith('lexar_')).toBe(true);
  });

  it('should set and get values accurately', () => {
    const cache = new MemoryCache<string>(5);
    cache.set('key1', 'result1');
    expect(cache.get('key1')).toBe('result1');
    expect(cache.has('key1')).toBe(true);
    expect(cache.has('nonexistent')).toBe(false);
  });

  it('should evict oldest entry when capacity is exceeded', () => {
    const cache = new MemoryCache<number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.size()).toBe(3);

    // Adding 4th entry should evict 'a'
    cache.set('d', 4);
    expect(cache.size()).toBe(3);
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('d')).toBe(4);
  });

  it('should respect TTL expiration', async () => {
    const shortCache = new MemoryCache<string>(5, 50); // 50ms TTL
    shortCache.set('temp', 'value');
    expect(shortCache.get('temp')).toBe('value');

    await new Promise(r => setTimeout(r, 60));
    expect(shortCache.get('temp')).toBeNull();
  });
});
