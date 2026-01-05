// Ultra-fast in-memory cache for analysis results
// Optimized for low-latency modal processing

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

class UltraFastCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize = 1000, ttlMs = 5 * 60 * 1000) { // 5 minutes default
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  // Generate optimized cache key
  generateKey(input: any, contentType: string): string {
    const hash = this.fastHash(JSON.stringify(input));
    return `${contentType}:${hash}`;
  }

  // Fast hash function for cache keys
  private fastHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count for LRU
    entry.hits++;
    return entry.data;
  }

  set(key: string, data: T): void {
    // Evict old entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 1
    });
  }

  private evictLRU(): void {
    let lruKey = '';
    let minHits = Infinity;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < minHits || (entry.hits === minHits && entry.timestamp < oldestTime)) {
        lruKey = key;
        minHits = entry.hits;
        oldestTime = entry.timestamp;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global cache instances for each content type
export const imageCache = new UltraFastCache(500, 10 * 60 * 1000); // 10 min for images
export const videoCache = new UltraFastCache(200, 15 * 60 * 1000); // 15 min for videos
export const audioCache = new UltraFastCache(300, 10 * 60 * 1000); // 10 min for audio
export const textCache = new UltraFastCache(1000, 5 * 60 * 1000);  // 5 min for text
export const urlCache = new UltraFastCache(800, 30 * 60 * 1000);   // 30 min for URLs