export declare class RedisService {
    /**
     * Atomic GET and DELETE using Lua Script. Guarantees single-use token invalidation under high concurrency.
     */
    static getAndDelete(key: string): Promise<string | null>;
    /**
     * Retrieves string value by key with safe fallback if Redis is unreachable.
     */
    static get(key: string): Promise<string | null>;
    /**
     * Sets key with TTL in seconds.
     */
    static setWithTTL(key: string, value: string, ttlSeconds: number): Promise<boolean>;
    /**
     * Deletes a key from Redis.
     */
    static delete(key: string): Promise<boolean>;
    /**
     * Sliding window counter for login throttling and rate limiting.
     * Returns true if request limit is exceeded.
     */
    static isRateLimited(key: string, limit: number, windowSeconds: number): Promise<boolean>;
}
//# sourceMappingURL=redis.service.d.ts.map