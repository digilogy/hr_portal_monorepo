import express from "express";
import { logger } from "@hr-portal/logger";

// Give the Redis log write a moment to flush before a crashing process exits.
const CRASH_FLUSH_MS = 500;

function describeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { error: err.message, name: err.name, stack: err.stack };
  }
  return { error: String(err) };
}

/**
 * Logs errors that escape every try/catch (outside of a request, e.g. in a timer,
 * queue callback or a promise nobody awaited) so they reach /logxz instead of only
 * the process's stdout.
 *
 * An uncaught exception leaves the process in an unknown state, so it still exits
 * (pm2 / the container restarts it). An unhandled rejection is logged and the
 * process keeps serving requests.
 */
export function registerProcessErrorHandlers(context: string) {
  process.on("uncaughtException", (err) => {
    logger.error(context, "Uncaught exception, process will exit", describeError(err));
    setTimeout(() => process.exit(1), CRASH_FLUSH_MS).unref();
  });

  process.on("unhandledRejection", (reason) => {
    logger.error(context, "Unhandled promise rejection", describeError(reason));
  });
}

// Safety-net error handler. Every controller already catches its own errors and
// responds with { message }, so this only ever engages for something that slipped
// past that (an unhandled throw / rejected promise) — without it that would fall
// through to Express's default HTML error page instead of JSON.
export function createErrorHandler(context: string): express.ErrorRequestHandler {
  return (err, req, res, next) => {
    logger.error(context, "Unhandled error", {
      path: req.path,
      method: req.method,
      ...describeError(err),
    });

    if (res.headersSent) {
      return next(err);
    }

    const statusCode = typeof err?.statusCode === "number" ? err.statusCode : 500;
    const message = statusCode === 500 ? "An unexpected server error occurred" : err?.message || "Request failed";
    res.status(statusCode).json({ message });
  };
}
