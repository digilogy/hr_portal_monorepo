import Redis from "ioredis";
import { logger } from "@hr-portal/logger";
import { env } from "@hr-portal/config";

const LOG_CONTEXT = "RedisConfig";

const REDIS_HOST = env.REDIS_HOST;
const REDIS_PORT = env.REDIS_PORT;
const REDIS_PASSWORD = env.REDIS_PASSWORD;
const useTls = env.REDIS_TLS === "true" || process.env.REDIS_TLS === "true" || (env.NODE_ENV === "production" && !REDIS_HOST.includes("localhost") && !REDIS_HOST.includes("redis"));

export let isRedisConnected = false;

export const redisClient = new Redis({
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
      logger.warn(LOG_CONTEXT, `Retrying Redis connection (Attempt ${times}, next delay ${delay}ms)`);
    }
    return delay;
  },
});

let lastErrorLogTime = 0;

redisClient.on("connect", () => {
  isRedisConnected = true;
  logger.info(LOG_CONTEXT, "Connected to Redis successfully");
});

redisClient.on("ready", () => {
  isRedisConnected = true;
});

redisClient.on("error", (err) => {
  isRedisConnected = false;
  const now = Date.now();
  if (now - lastErrorLogTime > 15000) {
    lastErrorLogTime = now;
    logger.error(LOG_CONTEXT, "Redis Connection Error", { error: err.message, host: REDIS_HOST, port: REDIS_PORT });
  }
});

redisClient.on("close", () => {
  if (isRedisConnected) {
    isRedisConnected = false;
    logger.warn(LOG_CONTEXT, "Redis connection closed");
  }
});

// Attempt background connection without blocking startup
redisClient.connect().catch((err) => {
  logger.warn(LOG_CONTEXT, "Initial Redis connection attempt failed, will auto-retry in background", {
    error: err.message,
  });
});
