import { redisClient, isRedisConnected } from "@hr-portal/queue";
import { logger } from "@hr-portal/logger";

const LOG_CONTEXT = "RedisService";

export class RedisService {
  /**
   * Atomic GET and DELETE using Lua Script. Guarantees single-use token invalidation under high concurrency.
   */
  static async getAndDelete(key: string): Promise<string | null> {
    if (!isRedisConnected) {
      logger.warn(LOG_CONTEXT, "Redis not connected during getAndDelete", { key });
      return null;
    }
    try {
      const luaScript = `
        local val = redis.call('GET', KEYS[1])
        if val then
          redis.call('DEL', KEYS[1])
        end
        return val
      `;
      const result = await redisClient.eval(luaScript, 1, key);
      return typeof result === "string" ? result : null;
    } catch (err: any) {
      logger.error(LOG_CONTEXT, "Error executing getAndDelete Lua script", { key, error: err.message });
      return null;
    }
  }

  /**
   * Retrieves string value by key with safe fallback if Redis is unreachable.
   */
  static async get(key: string): Promise<string | null> {
    if (!isRedisConnected) return null;
    try {
      return await redisClient.get(key);
    } catch (err: any) {
      logger.error(LOG_CONTEXT, "Redis GET error", { key, error: err.message });
      return null;
    }
  }

  /**
   * Sets key with TTL in seconds.
   */
  static async setWithTTL(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (!isRedisConnected) return false;
    try {
      await redisClient.set(key, value, "EX", ttlSeconds);
      return true;
    } catch (err: any) {
      logger.error(LOG_CONTEXT, "Redis SET error", { key, error: err.message });
      return false;
    }
  }

  /**
   * Deletes a key from Redis.
   */
  static async delete(key: string): Promise<boolean> {
    if (!isRedisConnected) return false;
    try {
      await redisClient.del(key);
      return true;
    } catch (err: any) {
      logger.error(LOG_CONTEXT, "Redis DEL error", { key, error: err.message });
      return false;
    }
  }

  /**
   * Sliding window counter for login throttling and rate limiting.
   * Returns true if request limit is exceeded.
   */
  static async isRateLimited(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    if (!isRedisConnected) return false; // Fallback to allow request if Redis offline
    try {
      const current = await redisClient.incr(key);
      if (current === 1) {
        await redisClient.expire(key, windowSeconds);
      }
      return current > limit;
    } catch (err: any) {
      logger.error(LOG_CONTEXT, "Redis rate limiting error", { key, error: err.message });
      return false;
    }
  }
}
