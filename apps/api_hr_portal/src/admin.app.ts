import express from "express";
import cors from "cors";
import { env } from "@hr-portal/config";
import { logger } from "@hr-portal/logger";
import adminRoutes from "./modules/admin/admin.routes";

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
  logger.info("AdminApp", `${req.method} ${req.url}`);
  next();
});

app.use("/api/admin", adminRoutes);

export default app;
