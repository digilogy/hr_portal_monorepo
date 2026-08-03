import { Request, Response, NextFunction } from "express";
import { redisClient, isRedisConnected } from "@hr-portal/queue";

export interface RateLimiterOptions {
  limit: number;          // Maximum requests allowed per window
  windowSeconds: number;  // Window duration in seconds
  keyPrefix?: string;     // Custom Redis key prefix
  useAccountKey?: boolean;// Combine IP + Target Email identifier for corporate NAT/proxy networks
}

/**
 * Enterprise Redis Rate Limiter supporting Corporate NAT/Proxy IP environments.
 * Allows 5,000+ concurrent employees behind a shared office Gateway IP to log in without blocking each other.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const prefix = options.keyPrefix || "rate";

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Fail open gracefully if Redis is disconnected
    if (!isRedisConnected) {
      next();
      return;
    }

    const clientIp = (req.headers["x-forwarded-for"] as string || req.ip || "127.0.0.1").split(",")[0].trim();

    // Extract target email if present (for corporate NAT proxy compatibility)
    let accountId = "";
    if (options.useAccountKey && req.body?.email && typeof req.body.email === "string") {
      accountId = `:${req.body.email.trim().toLowerCase()}`;
    }

    const redisKey = `${prefix}:${req.path.replace(/\//g, "_")}${accountId}:${clientIp}`;

    try {
      const current = await redisClient.incr(redisKey);
      if (current === 1) {
        await redisClient.expire(redisKey, options.windowSeconds);
      }

      const ttl = await redisClient.ttl(redisKey);
      const remaining = Math.max(0, options.limit - current);

      res.setHeader("X-RateLimit-Limit", options.limit);
      res.setHeader("X-RateLimit-Remaining", remaining);
      res.setHeader("Retry-After", ttl > 0 ? ttl : options.windowSeconds);

      if (current > options.limit) {
        res.status(429).json({
          message: "Too many attempts for this user/IP. Please try again later.",
          retryAfterSeconds: ttl > 0 ? ttl : options.windowSeconds,
        });
        return;
      }

      next();
    } catch {
      next();
    }
  };
}

// Enterprise Account-Aware Rate Limiters (Supports 5,000+ Concurrent Office NAT/Proxy Users)
export const authRequestAccessLimiter = createRateLimiter({
  limit: parseInt(process.env.RATE_LIMIT_ACCESS_MAX || "10", 10),
  windowSeconds: 60,
  keyPrefix: "rate:auth:access",
  useAccountKey: true, // Keyed by email + IP so 5k corporate office users don't block each other
});

export const authForgotPinLimiter = createRateLimiter({
  limit: parseInt(process.env.RATE_LIMIT_FORGOT_MAX || "5", 10),
  windowSeconds: 60,
  keyPrefix: "rate:auth:forgot",
  useAccountKey: true,
});

export const authLoginLimiter = createRateLimiter({
  limit: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || "10", 10),
  windowSeconds: 60,
  keyPrefix: "rate:auth:login",
  useAccountKey: true, // Keyed by target user email + IP
});
