import Redis from "ioredis";
import { logger } from "@hr-portal/logger";
import { env } from "@hr-portal/config";

const LOG_CONTEXT = "RedisConfig";

const REDIS_HOST = env.REDIS_HOST;
const REDIS_PORT = env.REDIS_PORT;
const REDIS_PASSWORD = env.REDIS_PASSWORD;

export let isRedisConnected = false;

export const redisClient = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    logger.warn(LOG_CONTEXT, `Retrying Redis connection (Attempt ${times}, delay ${delay}ms)`);
    return delay;
  },
});

redisClient.on("connect", () => {
  isRedisConnected = true;
  logger.info(LOG_CONTEXT, "Connected to Redis successfully");
});

redisClient.on("ready", () => {
  isRedisConnected = true;
});

redisClient.on("error", (err) => {
  isRedisConnected = false;
  logger.error(LOG_CONTEXT, "Redis Connection Error", { error: err.message });
});

redisClient.on("close", () => {
  isRedisConnected = false;
  logger.warn(LOG_CONTEXT, "Redis connection closed");
});

// Attempt background connection without blocking startup
redisClient.connect().catch((err) => {
  logger.warn(LOG_CONTEXT, "Initial Redis connection attempt failed, will auto-retry in background", {
    error: err.message,
  });
});
