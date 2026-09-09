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
    
    app.listen(PORT, () => {
      logger.info("Server", "API listening", { port: PORT });
      
      // Run queue recovery in the background so it doesn't block the healthcheck port binding
      EmailQueueService.recoverPendingJobs().catch(err => {
        logger.error("Server", "Failed to recover pending jobs", { error: err?.message });
      });
    });
  })
  .catch((error: any) => {
    console.error("Error connecting to the database", error);
  });

