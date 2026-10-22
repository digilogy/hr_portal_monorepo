import { redisClient, isRedisConnected } from "@hr-portal/queue";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export interface LogEntry {
  // Unique per entry; timestamp + message is not (identical requests in the same ms).
  id?: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  context: string;
  message: string;
  meta?: Record<string, unknown>;
  source?: string;
  // Which process wrote the entry (api / admin / reports / worker / web). All
  // processes share the same Redis list, so this is what tells them apart.
  service?: string;
}

const REDIS_LOG_KEY = "app:live_logs";
const MAX_LOGS_LIMIT = 2000;
const IN_MEMORY_BUFFER: LogEntry[] = [];
const MAX_IN_MEMORY = 1000;

const LEVEL_RANK: Record<LogEntry["level"], number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

export interface LiveLogInitOptions {
  service: string;
  // Entries below this level are not stored. The admin/reports services use WARN
  // because the gateway already records every request that is proxied to them.
  minLevel?: LogEntry["level"];
}

export class LiveLogService {
  private static instance: LiveLogService;
  private isInitialized = false;
  private service = "api";
  private minLevel: LogEntry["level"] = "DEBUG";

  private constructor() {}

  public static getInstance(): LiveLogService {
    if (!LiveLogService.instance) {
      LiveLogService.instance = new LiveLogService();
    }
    return LiveLogService.instance;
  }

  public init(options: LiveLogInitOptions = { service: "api" }) {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.service = options.service;
    this.minLevel = options.minLevel ?? "DEBUG";

    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalDebug = console.debug;

    console.log = (...args: any[]) => {
      originalLog(...args);
      this.handleConsoleCapture("INFO", args);
    };

    console.warn = (...args: any[]) => {
      originalWarn(...args);
      this.handleConsoleCapture("WARN", args);
    };

    console.error = (...args: any[]) => {
      originalError(...args);
      this.handleConsoleCapture("ERROR", args);
    };

    console.debug = (...args: any[]) => {
      originalDebug(...args);
      this.handleConsoleCapture("DEBUG", args);
    };

    this.recordLog({
      timestamp: new Date().toISOString(),
      level: "INFO",
      context: "LiveLogService",
      message: "Live logging subsystem initialized (Redis + in-memory store)",
      source: "system",
    });
  }

  private handleConsoleCapture(level: "INFO" | "WARN" | "ERROR" | "DEBUG", args: any[]) {
    try {
      if (args.length === 0) return;
      const first = typeof args[0] === "string" ? args[0] : JSON.stringify(args[0]);

      const loggerPattern = /^\[(.*?)\]\s*\[(INFO|WARN|ERROR|DEBUG)\]\s*\[(.*?)\]\s*(.*)$/;
      const match = first.match(loggerPattern);

      if (match) {
        const [, ts, lvl, ctx, msg] = match;
        let meta: Record<string, unknown> | undefined;
        let finalMsg = msg;

        const metaMatch = msg.match(/\s+(\{.*?\})$/);
        if (metaMatch) {
          try {
            meta = JSON.parse(metaMatch[1]);
            finalMsg = msg.substring(0, metaMatch.index).trim();
          } catch {}
        }

        this.recordLog({
          timestamp: ts || new Date().toISOString(),
          level: (lvl as any) || level,
          context: ctx,
          message: finalMsg,
          meta,
          source: "app",
        });
        return;
      }

      const rawMsg = args
        .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
        .join(" ");

      this.recordLog({
        timestamp: new Date().toISOString(),
        level,
        context: "Console",
        message: rawMsg,
        source: "console",
      });
    } catch {}
  }

  public static requestLogger() {
    const liveLog = LiveLogService.getInstance();

    return (req: Request, res: Response, next: NextFunction) => {
      if (
        req.path.includes("/logxz") ||
        req.path.includes("/client-errors") ||
        req.path.includes("/api/system/logs") ||
        req.headers["user-agent"]?.includes("k6")
      ) {
        return next();
      }

      const startTime = Date.now();
      const { method, originalUrl, ip } = req;

      res.on("finish", () => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        const level: "INFO" | "WARN" | "ERROR" =
          statusCode >= 500 ? "ERROR" : statusCode >= 400 ? "WARN" : "INFO";

        liveLog.recordLog({
          timestamp: new Date().toISOString(),
          level,
          context: "HTTP",
          message: `${method} ${originalUrl} ${statusCode} (${duration}ms)`,
          meta: {
            method,
            url: originalUrl,
            status: statusCode,
            durationMs: duration,
            ip: req.headers["x-forwarded-for"] || ip,
            userAgent: req.headers["user-agent"],
          },
          source: "http",
        });
      });

      next();
    };
  }

  public recordLog(entry: LogEntry) {
    if (LEVEL_RANK[entry.level] < LEVEL_RANK[this.minLevel]) return;
    if (!entry.service) entry.service = this.service;
    if (!entry.id) entry.id = randomUUID();

    IN_MEMORY_BUFFER.unshift(entry);
    if (IN_MEMORY_BUFFER.length > MAX_IN_MEMORY) {
      IN_MEMORY_BUFFER.length = MAX_IN_MEMORY;
    }

    if (isRedisConnected && redisClient) {
      try {
        const serialized = JSON.stringify(entry);
        redisClient
          .lpush(REDIS_LOG_KEY, serialized)
          .then(() => redisClient.ltrim(REDIS_LOG_KEY, 0, MAX_LOGS_LIMIT - 1))
          .catch(() => {});
      } catch {}
    }
  }

  public async getRecentLogs(
    limit = 200,
    filterLevel?: string,
    search?: string,
    filterService?: string,
  ): Promise<LogEntry[]> {
    let logs: LogEntry[] = [];

    if (isRedisConnected && redisClient) {
      try {
        // With a filter, matches can sit anywhere in the list (errors are rare among
        // request logs), so scan all of it — it is capped at MAX_LOGS_LIMIT — and
        // apply `limit` to the matches, not to how far back we look.
        const hasFilter =
          (filterLevel && filterLevel.toUpperCase() !== "ALL") ||
          (filterService && filterService.toLowerCase() !== "all") ||
          (search && search.trim() !== "");
        const rawLogs = await redisClient.lrange(REDIS_LOG_KEY, 0, hasFilter ? -1 : limit - 1);
        for (const raw of rawLogs) {
          try {
            logs.push(JSON.parse(raw));
          } catch {}
        }
      } catch {
        logs = [...IN_MEMORY_BUFFER];
      }
    }

    if (logs.length === 0) {
      logs = [...IN_MEMORY_BUFFER];
    }

    if (filterLevel && filterLevel.toUpperCase() !== "ALL") {
      const targetLevel = filterLevel.toUpperCase();
      logs = logs.filter((l) => l.level === targetLevel);
    }

    if (filterService && filterService.toLowerCase() !== "all") {
      const target = filterService.toLowerCase();
      // Entries written before service tagging existed came from the main API.
      logs = logs.filter((l) => (l.service || "api") === target);
    }

    if (search && search.trim() !== "") {
      const q = search.toLowerCase();
      logs = logs.filter(
        (l) =>
          l.message.toLowerCase().includes(q) ||
          l.context.toLowerCase().includes(q) ||
          (l.meta && JSON.stringify(l.meta).toLowerCase().includes(q))
      );
    }

    return logs.slice(0, limit);
  }

  public async clearLogs(): Promise<void> {
    IN_MEMORY_BUFFER.length = 0;
    if (isRedisConnected && redisClient) {
      try {
        await redisClient.del(REDIS_LOG_KEY);
      } catch {}
    }
  }
}
