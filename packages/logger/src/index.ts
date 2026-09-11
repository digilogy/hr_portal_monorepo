type LogLevel = "info" | "warn" | "error" | "debug";

const MAX_LOG_LINES = 1000;
const logBuffer: string[] = [];

function addToBuffer(message: string) {
  logBuffer.push(message);
  if (logBuffer.length > MAX_LOG_LINES) {
    logBuffer.shift(); // Remove the oldest log
  }
}

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
    const formatted = formatMessage("info", context, message, meta);
    addToBuffer(formatted);
    console.log(formatted);
  },
  warn(context: string, message: string, meta?: Record<string, unknown>) {
    const formatted = formatMessage("warn", context, message, meta);
    addToBuffer(formatted);
    console.warn(formatted);
  },
  error(context: string, message: string, meta?: Record<string, unknown>) {
    const formatted = formatMessage("error", context, message, meta);
    addToBuffer(formatted);
    console.error(formatted);
  },
  debug(context: string, message: string, meta?: Record<string, unknown>) {
    const formatted = formatMessage("debug", context, message, meta);
    addToBuffer(formatted);
    console.debug(formatted);
  },
  getLogs(): string[] {
    return [...logBuffer];
  }
};
