import "reflect-metadata";
import { config } from "dotenv";
import { env } from "@hr-portal/config";
import { logger } from "@hr-portal/logger";
import { initializeDatabase } from "@hr-portal/database";
import app from "./reports.app";

config();

const PORT = env.PORT ? env.PORT + 1 : 5112; // Reports will run on 5112

async function bootstrap() {
  try {
    await initializeDatabase();
    logger.info("ReportsApp", "Database connected");

    const server = app.listen(PORT, "0.0.0.0", 10000, () => {
      logger.info("ReportsApp", `Reports service running on port ${PORT}`);
    });
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
  } catch (error) {
    logger.error("ReportsApp", "Failed to start reports service", { error });
    process.exit(1);
  }
}

bootstrap();
