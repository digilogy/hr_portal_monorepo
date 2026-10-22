import { Router, Request, Response } from "express";
import { LiveLogService } from "../services/liveLog.service";
import { createRateLimiter } from "../middlewares/rateLimiter";

// Receives errors from the browser (React crashes, uncaught JS errors, failed API
// calls) and stores them alongside the server logs, tagged service "web".
// Unauthenticated on purpose: errors on the login page matter too. The rate limit
// and field truncation keep it from being used to flood the log store.

const router = Router();
const liveLogService = LiveLogService.getInstance();

const ERROR_TYPES = new Set(["render", "uncaught", "unhandledrejection", "api", "network"]);

function clip(value: unknown, max: number): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  return value.length > max ? value.slice(0, max) + "…" : value;
}

router.post(
  "/",
  createRateLimiter({ limit: 30, windowSeconds: 60, keyPrefix: "rate:client-errors" }),
  (req: Request, res: Response) => {
    const body = req.body ?? {};
    const message = clip(body.message, 500);
    if (!message) {
      return res.status(400).json({ message: "message is required" });
    }

    const type = ERROR_TYPES.has(body.type) ? body.type : "uncaught";

    liveLogService.recordLog({
      timestamp: new Date().toISOString(),
      level: "ERROR",
      context: `Frontend:${type}`,
      message,
      meta: {
        page: clip(body.page, 300),
        stack: clip(body.stack, 4000),
        digest: clip(body.digest, 100),
        apiPath: clip(body.apiPath, 300),
        apiStatus: typeof body.apiStatus === "number" ? body.apiStatus : undefined,
        user: clip(body.user, 200),
        userAgent: clip(req.headers["user-agent"], 300),
        ip: req.headers["x-forwarded-for"] || req.ip,
      },
      source: "frontend",
      service: "web",
    });

    return res.status(204).end();
  },
);

export default router;
