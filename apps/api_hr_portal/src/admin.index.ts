import "reflect-metadata";
import { config } from "dotenv";
import { env } from "@hr-portal/config";
import { logger } from "@hr-portal/logger";
import { initializeDatabase } from "@hr-portal/database";
import app from "./admin.app";

config();

const rawPort = process.env.PORT ? Number(process.env.PORT) : env.PORT;
const PORT = rawPort === 5111 ? 5113 : (rawPort || 5113);

async function bootstrap() {
  try {
    await initializeDatabase();
    logger.info("AdminApp", "Database connected");

    const server = app.listen(PORT, "0.0.0.0", 10000, () => {
      logger.info("AdminApp", `Admin service running on port ${PORT}`);
    });
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
  } catch (error) {
    logger.error("AdminApp", "Failed to start admin service", { error });
    process.exit(1);
  }
}

bootstrap();
