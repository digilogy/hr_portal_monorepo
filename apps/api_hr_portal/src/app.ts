import express from "express";
import cors from "cors";
import { env } from "@hr-portal/config";
import { logger } from "@hr-portal/logger";
import authRoutes from "./modules/auth/auth.routes";
import timesheetRoutes from "./modules/timesheet/timesheet.routes";
import adminRoutes from "./modules/admin/admin.routes";
import profileRoutes from "./modules/profile/profile.routes";
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

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/timesheets", timesheetRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/profile", profileRoutes);
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
