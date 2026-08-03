import { isRedisConnected } from "@hr-portal/queue";
import { logger } from "@hr-portal/logger";

const LOG_CONTEXT = "EchoConf";

export interface SanitizedConfig {
  nodeEnv: string;
  port: number | string;
  frontendUrl: string;
  redis: {
    host: string;
    port: number;
    connected: boolean;
  };
  email: {
    maxAttempts: number;
    retryBaseDelayMs: number;
    sendIntervalMs: number;
    awsRegion?: string;
    fromEmail?: string;
  };
  database: {
    host?: string;
    databaseName?: string;
  };
}

export function getSanitizedConfig(): SanitizedConfig {
  return {
    nodeEnv: process.env.NODE_ENV || "development",
    port: process.env.PORT || 5111,
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:3600",
    redis: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      connected: isRedisConnected,
    },
    email: {
      maxAttempts: parseInt(process.env.EMAIL_MAX_ATTEMPTS || "3", 10),
      retryBaseDelayMs: parseInt(process.env.EMAIL_RETRY_DELAY_MS || "5000", 10),
      sendIntervalMs: parseInt(process.env.EMAIL_SEND_INTERVAL_MS || "300", 10),
      awsRegion: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
      fromEmail: process.env.AWS_SES_FROM_EMAIL || process.env.SES_FROM_EMAIL,
    },
    database: {
      host: process.env.DB_HOST || "localhost",
      databaseName: process.env.DB_NAME || "hr_portal",
    },
  };
}

export function echoConfig(): void {
  const config = getSanitizedConfig();
  logger.info(LOG_CONTEXT, "=== Echoing Environment Configuration ===", {
    environment: config.nodeEnv,
    port: config.port,
    frontendUrl: config.frontendUrl,
    redisHost: config.redis.host,
    redisPort: config.redis.port,
    redisConnected: config.redis.connected,
    emailMaxAttempts: config.email.maxAttempts,
    emailRetryDelay: config.email.retryBaseDelayMs,
  });
}
