"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = exports.isRedisConnected = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("@hr-portal/logger");
const config_1 = require("@hr-portal/config");
const LOG_CONTEXT = "RedisConfig";
const REDIS_HOST = config_1.env.REDIS_HOST;
const REDIS_PORT = config_1.env.REDIS_PORT;
const REDIS_PASSWORD = config_1.env.REDIS_PASSWORD;
const useTls = config_1.env.REDIS_TLS === "true" || process.env.REDIS_TLS === "true" || (config_1.env.NODE_ENV === "production" && !REDIS_HOST.includes("localhost") && !REDIS_HOST.includes("redis"));
exports.isRedisConnected = false;
exports.redisClient = new ioredis_1.default({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    ...(useTls ? { tls: {} } : {}),
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy(times) {
        const delay = times > 20 ? 10000 : Math.min(times * 200, 5000);
        if (times <= 5 || times % 50 === 0) {
            logger_1.logger.warn(LOG_CONTEXT, `Retrying Redis connection (Attempt ${times}, next delay ${delay}ms)`);
        }
        return delay;
    },
});
let lastErrorLogTime = 0;
exports.redisClient.on("connect", () => {
    exports.isRedisConnected = true;
    logger_1.logger.info(LOG_CONTEXT, "Connected to Redis successfully");
});
exports.redisClient.on("ready", () => {
    exports.isRedisConnected = true;
});
exports.redisClient.on("error", (err) => {
    exports.isRedisConnected = false;
    const now = Date.now();
    if (now - lastErrorLogTime > 15000) {
        lastErrorLogTime = now;
        logger_1.logger.error(LOG_CONTEXT, "Redis Connection Error", { error: err.message, host: REDIS_HOST, port: REDIS_PORT });
    }
});
exports.redisClient.on("close", () => {
    if (exports.isRedisConnected) {
        exports.isRedisConnected = false;
        logger_1.logger.warn(LOG_CONTEXT, "Redis connection closed");
    }
});
// Attempt background connection without blocking startup
exports.redisClient.connect().catch((err) => {
    logger_1.logger.warn(LOG_CONTEXT, "Initial Redis connection attempt failed, will auto-retry in background", {
        error: err.message,
    });
});
//# sourceMappingURL=redis-connection.js.map