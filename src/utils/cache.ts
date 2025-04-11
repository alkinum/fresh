/**
 * Simple LRU Cache implementation for in-memory caching
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;
  private readonly ttl: number;
  private timestamps = new Map<K, number>();

  constructor(maxSize = 100, ttlMs = 1000 * 60 * 5) {
    this.maxSize = maxSize;
    this.ttl = ttlMs;
  }

  /**
   * Get a value from cache
   */
  get(key: K): V | undefined {
    const timestamp = this.timestamps.get(key);
    const now = Date.now();

    // Check if the value exists and isn't expired
    if (timestamp && now - timestamp < this.ttl) {
      // Item exists and is not expired
      const value = this.cache.get(key);
      
      // Update position in LRU (delete and re-add for freshness)
      if (value !== undefined) {
        this.cache.delete(key);
        this.cache.set(key, value);
        this.timestamps.set(key, now);
        return value;
      }
    } else if (timestamp) {
      // Item exists but is expired
      this.delete(key);
    }

    return undefined;
  }

  /**
   * Set a value in cache
   */
  set(key: K, value: V): void {
    // If cache is at max size, remove oldest item
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.delete(oldestKey);
      }
    }

    // Add new item
    this.cache.set(key, value);
    this.timestamps.set(key, Date.now());
  }

  /**
   * Delete a value from cache
   */
  delete(key: K): void {
    this.cache.delete(key);
    this.timestamps.delete(key);
  }

  /**
   * Check if cache has a non-expired key
   */
  has(key: K): boolean {
    const timestamp = this.timestamps.get(key);
    if (!timestamp) return false;
    
    const now = Date.now();
    if (now - timestamp >= this.ttl) {
      this.delete(key);
      return false;
    }

    return this.cache.has(key);
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.timestamps.clear();
  }

  /**
   * Get the size of the cache
   */
  get size(): number {
    return this.cache.size;
  }
}

/**
 * Cache service for managing caching with namespacing
 */
export class CacheService {
  private cache: LRUCache<string, unknown>;
  private prefix: string;

  constructor(prefix: string, maxSize = 100, ttlMs = 1000 * 60 * 5) {
    this.cache = new LRUCache(maxSize, ttlMs);
    this.prefix = prefix;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | undefined> {
    const prefixedKey = this.getPrefixedKey(key);
    return this.cache.get(prefixedKey) as T | undefined;
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T): Promise<void> {
    const prefixedKey = this.getPrefixedKey(key);
    this.cache.set(prefixedKey, value);
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    const prefixedKey = this.getPrefixedKey(key);
    this.cache.delete(prefixedKey);
  }

  /**
   * Check if cache has a key
   */
  async has(key: string): Promise<boolean> {
    const prefixedKey = this.getPrefixedKey(key);
    return this.cache.has(prefixedKey);
  }

  /**
   * Clear all values for this cache namespace
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Generate a namespaced key
   */
  private getPrefixedKey(key: string): string {
    return `${this.prefix}:${key}`;
  }
} 