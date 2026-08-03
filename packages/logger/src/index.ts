type LogLevel = "info" | "warn" | "error" | "debug";

function formatMessage(
  level: LogLevel,
  context: string,
  message: string,
  meta?: Record<string, unknown>,
): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}${metaStr}`;
}

export const logger = {
  info(context: string, message: string, meta?: Record<string, unknown>) {
    console.log(formatMessage("info", context, message, meta));
  },
  warn(context: string, message: string, meta?: Record<string, unknown>) {
    console.warn(formatMessage("warn", context, message, meta));
  },
  error(context: string, message: string, meta?: Record<string, unknown>) {
    console.error(formatMessage("error", context, message, meta));
  },
  debug(context: string, message: string, meta?: Record<string, unknown>) {
    console.debug(formatMessage("debug", context, message, meta));
  },
};
