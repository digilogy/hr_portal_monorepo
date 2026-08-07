import app from "./app";
import { initializeDatabase } from "@hr-portal/database";
import { EmailQueueService } from "./services/emailQueue.service";
import { logger } from "@hr-portal/logger";
import { echoConfig } from "./utils/echoconf";
import { env } from "@hr-portal/config";

const PORT = env.PORT;

initializeDatabase()
  .then(async () => {
    console.log("Database connected successfully");
    echoConfig();
    await EmailQueueService.recoverPendingJobs();
    app.listen(PORT, () => {
      logger.info("Server", "API listening", { port: PORT });
    });
  })
  .catch((error) => {
    console.error("Error connecting to the database", error);
  });

