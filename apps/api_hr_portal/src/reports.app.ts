import express from "express";
import cors from "cors";
import { env } from "@hr-portal/config";
import { logger } from "@hr-portal/logger";
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
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  };
}

app.use(cors(getCorsOptions()));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use((req, res, next) => {
  logger.info("ReportsApp", `${req.method} ${req.url}`);
  next();
});

// Simple API Cache for Reports Microservice
const reportsCache = new Map<string, { expiresAt: number; data: any }>();

function reportsCacheMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.method !== 'GET') {
    return next();
  }
  const cacheKey = `${req.originalUrl}::${req.headers.authorization || ''}`;
  const cached = reportsCache.get(cacheKey);
  
  if (cached && cached.expiresAt > Date.now()) {
    return res.status(200).json(cached.data);
  }

  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    if (res.statusCode === 200) {
      reportsCache.set(cacheKey, {
        expiresAt: Date.now() + 5000,
        data: body
      });
    }
    return originalJson(body);
  };
  next();
}

app.use(reportsCacheMiddleware);

app.use("/api/team", teamRoutes);
app.use("/api/reports", reportsRoutes);

export default app;
