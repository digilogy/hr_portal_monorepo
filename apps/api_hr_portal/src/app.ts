import express from "express";
import cors from "cors";
import { env } from "@hr-portal/config";
import { logger } from "@hr-portal/logger";
import authRoutes from "./modules/auth/auth.routes";
import timesheetRoutes from "./modules/timesheet/timesheet.routes";
import profileRoutes from "./modules/profile/profile.routes";
import adminRoutes from "./modules/admin/admin.routes";
import teamRoutes from "./modules/reports/team.routes";
import reportsRoutes from "./modules/reports/reports.routes";

const app = express();

function getCorsOptions(): cors.CorsOptions {
  const allowedOrigins = new Set<string>();

  for (const value of env.ALLOWED_ORIGINS.split(",")) {
    const origin = value.trim().replace(/\/$/, "");
    if (origin) allowedOrigins.add(origin);
  }

  const frontendUrl = env.FRONTEND_URL.trim().replace(/\/$/, "");
  if (frontendUrl) allowedOrigins.add(frontendUrl);

  if (env.NODE_ENV !== "production") {
    allowedOrigins.add("http://localhost:3661");
    allowedOrigins.add("http://localhost:3600");
    allowedOrigins.add("http://localhost:3000");
    allowedOrigins.add("http://localhost:3001");
  } else {
    allowedOrigins.add("https://timesheet.cgworkflow.com");
  }

  const origins = [...allowedOrigins];

  if (origins.length === 0) {
    return { credentials: true };
  }

  return {
    origin(origin, callback) {
      if (!origin || origins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
  };
}

// Middleware
app.use(cors(getCorsOptions()));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import { LiveLogService } from "./services/liveLog.service";
import logxzRoutes from "./routes/logxz.routes";
import { getSanitizedConfig } from "./utils/echoconf";

// Initialize live log console capture & request logger across all endpoints
LiveLogService.getInstance().init();
app.use(LiveLogService.requestLogger());

// Live Logs Endpoints (exposed at /logxz and /api/logxz)
app.use("/logxz", logxzRoutes);
app.use("/api/logxz", logxzRoutes);

// Simple API Gateway Cache with Thundering Herd Coalescing
const apiCache = new Map<string, { expiresAt: number; data: any; isRawText?: boolean }>();
const apiInflight = new Map<string, express.Response[]>();

function apiCacheMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.method !== 'GET') {
    return next();
  }
  const cacheKey = `${req.originalUrl}::${req.headers.authorization || ''}`;
  const cached = apiCache.get(cacheKey);
  
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.isRawText) {
      return res.type('json').status(200).send(cached.data);
    }
    return res.status(200).json(cached.data);
  }

  // Gateway Thundering Herd Coalescing
  if (apiInflight.has(cacheKey)) {
    apiInflight.get(cacheKey)!.push(res);
    return; // Wait for the first request to resolve
  }

  apiInflight.set(cacheKey, []);

  // Intercept response to cache it and notify waiting requests
  const originalSend = res.send.bind(res);
  
  res.send = (body: any) => {
    if (apiInflight.has(cacheKey)) {
      const waiting = apiInflight.get(cacheKey) || [];
      apiInflight.delete(cacheKey);

      if (res.statusCode === 200 && String(res.get('Content-Type')).includes('json')) {
        const rawString = typeof body === "string" ? body : JSON.stringify(body);
        
        apiCache.set(cacheKey, {
          expiresAt: Date.now() + 5000, // 5 seconds TTL
          data: rawString,
          isRawText: true
        });

        // Drain inflight requests in chunks to yield event loop
        let index = 0;
        const chunkSize = 200;
        const drain = () => {
          const end = Math.min(index + chunkSize, waiting.length);
          for (; index < end; index++) {
            const waitingRes = waiting[index];
            if (!waitingRes.headersSent) waitingRes.type('json').status(200).send(rawString);
          }
          if (index < waiting.length) setImmediate(drain);
        };
        setImmediate(drain);

        return originalSend(rawString);
      } else {
        // If not 200 OK or not JSON, just forward the raw response to all waiting clients
        let index = 0;
        const chunkSize = 200;
        const drain = () => {
          const end = Math.min(index + chunkSize, waiting.length);
          for (; index < end; index++) {
            const waitingRes = waiting[index];
            if (!waitingRes.headersSent) waitingRes.status(res.statusCode).send(body);
          }
          if (index < waiting.length) setImmediate(drain);
        };
        setImmediate(drain);
      }
    }
    return originalSend(body);
  };

  next();
}

app.use(apiCacheMiddleware);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/timesheets", timesheetRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/reports", reportsRoutes);

// Diagnostics & Echo Config
app.get("/api/echoconf", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    config: getSanitizedConfig(),
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Server is running" });
});

// Safety-net error handler. Every controller already catches its own errors and
// responds with { message }, so this only ever engages for something that slipped
// past that (an unhandled throw / rejected promise) — previously that would have
// fallen through to Express's default HTML error page instead of JSON.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error("GlobalErrorHandler", "Unhandled error", {
    path: req.path,
    method: req.method,
    error: err?.message,
  });

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = typeof err?.statusCode === "number" ? err.statusCode : 500;
  const message = statusCode === 500 ? "An unexpected server error occurred" : err?.message || "Request failed";
  res.status(statusCode).json({ message });
});

export default app;
