"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const MAX_LOG_LINES = 1000;
const logBuffer = [];
function addToBuffer(message) {
    logBuffer.push(message);
    if (logBuffer.length > MAX_LOG_LINES) {
        logBuffer.shift(); // Remove the oldest log
    }
}
function formatMessage(level, context, message, meta) {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}${metaStr}`;
}
exports.logger = {
    info(context, message, meta) {
        const formatted = formatMessage("info", context, message, meta);
        addToBuffer(formatted);
        console.log(formatted);
    },
    warn(context, message, meta) {
        const formatted = formatMessage("warn", context, message, meta);
        addToBuffer(formatted);
        console.warn(formatted);
    },
    error(context, message, meta) {
        const formatted = formatMessage("error", context, message, meta);
        addToBuffer(formatted);
        console.error(formatted);
    },
    debug(context, message, meta) {
        const formatted = formatMessage("debug", context, message, meta);
        addToBuffer(formatted);
        console.debug(formatted);
    },
    getLogs() {
        return [...logBuffer];
    }
};
//# sourceMappingURL=index.js.map