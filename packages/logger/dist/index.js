"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
function formatMessage(level, context, message, meta) {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}${metaStr}`;
}
exports.logger = {
    info(context, message, meta) {
        console.log(formatMessage("info", context, message, meta));
    },
    warn(context, message, meta) {
        console.warn(formatMessage("warn", context, message, meta));
    },
    error(context, message, meta) {
        console.error(formatMessage("error", context, message, meta));
    },
    debug(context, message, meta) {
        console.debug(formatMessage("debug", context, message, meta));
    },
};
//# sourceMappingURL=index.js.map