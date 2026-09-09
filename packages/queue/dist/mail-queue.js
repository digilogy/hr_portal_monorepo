"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUEUE_PREFIX = exports.MAIL_QUEUE_NAME = void 0;
exports.getBullMailQueue = getBullMailQueue;
const bullmq_1 = require("bullmq");
const config_1 = require("@hr-portal/config");
const logger_1 = require("@hr-portal/logger");
const redis_connection_1 = require("./redis-connection");
const LOG_CONTEXT = "MailQueue";
exports.MAIL_QUEUE_NAME = "mail-queue";
exports.QUEUE_PREFIX = "{bull}";
let bullMailQueue = null;
function getBullMailQueue() {
    if (!bullMailQueue) {
        try {
            bullMailQueue = new bullmq_1.Queue(exports.MAIL_QUEUE_NAME, {
                prefix: exports.QUEUE_PREFIX,
                connection: redis_connection_1.redisClient,
                defaultJobOptions: {
                    attempts: config_1.env.EMAIL_MAX_ATTEMPTS,
                    backoff: {
                        type: "exponential",
                        delay: config_1.env.EMAIL_RETRY_DELAY_MS,
                    },
                    removeOnComplete: { age: 86400, count: 1000 },
                    removeOnFail: { age: 604800, count: 5000 },
                },
            });
        }
        catch (err) {
            logger_1.logger.error(LOG_CONTEXT, "Failed to initialize BullMQ queue", { error: err.message });
            bullMailQueue = null;
        }
    }
    return bullMailQueue;
}
//# sourceMappingURL=mail-queue.js.map