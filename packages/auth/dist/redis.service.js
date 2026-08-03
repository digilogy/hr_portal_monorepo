"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const queue_1 = require("@hr-portal/queue");
const logger_1 = require("@hr-portal/logger");
const LOG_CONTEXT = "RedisService";
class RedisService {
    /**
     * Atomic GET and DELETE using Lua Script. Guarantees single-use token invalidation under high concurrency.
     */
    static async getAndDelete(key) {
        if (!queue_1.isRedisConnected) {
            logger_1.logger.warn(LOG_CONTEXT, "Redis not connected during getAndDelete", { key });
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
            const result = await queue_1.redisClient.eval(luaScript, 1, key);
            return typeof result === "string" ? result : null;
        }
        catch (err) {
            logger_1.logger.error(LOG_CONTEXT, "Error executing getAndDelete Lua script", { key, error: err.message });
            return null;
        }
    }
    /**
     * Retrieves string value by key with safe fallback if Redis is unreachable.
     */
    static async get(key) {
        if (!queue_1.isRedisConnected)
            return null;
        try {
            return await queue_1.redisClient.get(key);
        }
        catch (err) {
            logger_1.logger.error(LOG_CONTEXT, "Redis GET error", { key, error: err.message });
            return null;
        }
    }
    /**
     * Sets key with TTL in seconds.
     */
    static async setWithTTL(key, value, ttlSeconds) {
        if (!queue_1.isRedisConnected)
            return false;
        try {
            await queue_1.redisClient.set(key, value, "EX", ttlSeconds);
            return true;
        }
        catch (err) {
            logger_1.logger.error(LOG_CONTEXT, "Redis SET error", { key, error: err.message });
            return false;
        }
    }
    /**
     * Deletes a key from Redis.
     */
    static async delete(key) {
        if (!queue_1.isRedisConnected)
            return false;
        try {
            await queue_1.redisClient.del(key);
            return true;
        }
        catch (err) {
            logger_1.logger.error(LOG_CONTEXT, "Redis DEL error", { key, error: err.message });
            return false;
        }
    }
    /**
     * Sliding window counter for login throttling and rate limiting.
     * Returns true if request limit is exceeded.
     */
    static async isRateLimited(key, limit, windowSeconds) {
        if (!queue_1.isRedisConnected)
            return false; // Fallback to allow request if Redis offline
        try {
            const current = await queue_1.redisClient.incr(key);
            if (current === 1) {
                await queue_1.redisClient.expire(key, windowSeconds);
            }
            return current > limit;
        }
        catch (err) {
            logger_1.logger.error(LOG_CONTEXT, "Redis rate limiting error", { key, error: err.message });
            return false;
        }
    }
}
exports.RedisService = RedisService;
//# sourceMappingURL=redis.service.js.map