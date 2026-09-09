import { Router, Request, Response } from "express";
import { LiveLogService } from "../services/liveLog.service";

const router = Router();
const liveLogService = LiveLogService.getInstance();

const AUTH_USER = "log";
const AUTH_PASS = "logxadmin";

// Basic Auth Middleware
function requireLogAuth(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Basic ")) {
    const base64Credentials = authHeader.split(" ")[1];
    const credentials = Buffer.from(base64Credentials, "base64").toString("ascii");
    const [username, password] = credentials.split(":");

    if (username === AUTH_USER && password === AUTH_PASS) {
      return next();
    }
  }

  // Allow query parameter shortcut (?key=logxadmin or ?pass=logxadmin)
  if (req.query.key === AUTH_PASS || req.query.pass === AUTH_PASS) {
    return next();
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="Timesheet Live Logs"');
  res.status(401).send("401 Unauthorized: Access to live logs requires authentication.");
}

router.use(requireLogAuth);

// Main Log Viewer Endpoint
router.get("/", async (req: Request, res: Response) => {
  const format = (req.query.format as string) || "html";
  const limit = Math.min(parseInt(req.query.limit as string) || 200, 1000);
  const level = req.query.level as string | undefined;
  const search = req.query.search as string | undefined;

  const logs = await liveLogService.getRecentLogs(limit, level, search);

  // JSON format
  if (format === "json") {
    return res.json({
      status: "OK",
      count: logs.length,
      logs,
    });
  }

  // Plain Text format
  if (format === "text") {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    const textLines = logs
      .map((l) => {
        const metaStr = l.meta ? " | " + JSON.stringify(l.meta) : "";
        return "[" + l.timestamp + "] [" + l.level.padEnd(5) + "] [" + l.context + "] " + l.message + metaStr;
      })
      .join("\n");
    return res.send(textLines || "No logs captured yet.");
  }

  // HTML Live Console Dashboard
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Timesheet Live Logs</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --text-muted: #8b949e;
      --info: #58a6ff;
      --warn: #d29922;
      --error: #f85149;
      --debug: #a371f7;
      --success: #3fb950;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
      padding: 16px;
      font-size: 13px;
    }
    header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
      gap: 12px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand h1 {
      font-size: 16px;
      font-weight: 600;
      color: #fff;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 12px;
      background: #238636;
      color: #fff;
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    input, select, button {
      background: var(--card-bg);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      outline: none;
    }
    input:focus, select:focus {
      border-color: var(--info);
    }
    button {
      cursor: pointer;
      font-weight: 500;
      transition: background 0.15s;
    }
    button:hover {
      background: #21262d;
    }
    .btn-primary {
      background: #238636;
      border-color: #2ea043;
      color: #fff;
    }
    .btn-primary:hover {
      background: #2ea043;
    }
    .btn-danger {
      background: #b62324;
      border-color: #d83a3e;
      color: #fff;
    }
    .btn-danger:hover {
      background: #d83a3e;
    }
    #log-container {
      margin-top: 14px;
      background: #090d13;
      border: 1px solid var(--border);
      border-radius: 6px;
      height: calc(100vh - 100px);
      overflow-y: auto;
      padding: 12px;
      font-family: "JetBrains Mono", Consolas, Menlo, monospace;
      font-size: 12px;
      line-height: 1.5;
    }
    .log-row {
      display: flex;
      gap: 8px;
      padding: 2px 4px;
      border-radius: 3px;
      word-break: break-all;
    }
    .log-row:hover {
      background: rgba(255, 255, 255, 0.04);
    }
    .log-ts { color: var(--text-muted); flex-shrink: 0; font-size: 11px; }
    .log-lvl { font-weight: bold; flex-shrink: 0; width: 48px; text-align: center; border-radius: 3px; padding: 0 4px; font-size: 10px; line-height: 18px; height: 18px; }
    .lvl-INFO { background: rgba(88, 166, 255, 0.15); color: var(--info); }
    .lvl-WARN { background: rgba(210, 153, 34, 0.15); color: var(--warn); }
    .lvl-ERROR { background: rgba(248, 81, 73, 0.2); color: var(--error); }
    .lvl-DEBUG { background: rgba(163, 113, 247, 0.15); color: var(--debug); }
    .log-ctx { color: #f0883e; font-weight: 500; flex-shrink: 0; }
    .log-msg { color: #e6edf3; flex-grow: 1; }
    .log-meta { color: #8b949e; font-size: 11px; margin-left: 6px; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <h1>Timesheet Live Application Logs</h1>
      <span class="badge" id="status-badge">LIVE (2s)</span>
      <span style="color: var(--text-muted); font-size: 12px;" id="count-badge">0 entries</span>
    </div>
    <div class="controls">
      <input type="text" id="search-input" placeholder="Search logs (text)..." size="28" />
      <select id="level-select">
        <option value="ALL">All Levels</option>
        <option value="INFO">INFO</option>
        <option value="WARN">WARN</option>
        <option value="ERROR">ERROR</option>
        <option value="DEBUG">DEBUG</option>
      </select>
      <select id="limit-select">
        <option value="100">100 logs</option>
        <option value="200" selected>200 logs</option>
        <option value="500">500 logs</option>
        <option value="1000">1000 logs</option>
      </select>
      <button id="toggle-poll-btn" class="btn-primary" onclick="togglePolling()">Pause</button>
      <button onclick="refreshLogs()">Refresh Now</button>
      <button class="btn-danger" onclick="clearLogs()">Clear</button>
      <a href="?format=text" target="_blank" style="color: var(--info); text-decoration: none; font-size: 12px; margin-left: 6px;">Raw Text</a>
      <a href="?format=json" target="_blank" style="color: var(--info); text-decoration: none; font-size: 12px; margin-left: 6px;">JSON</a>
    </div>
  </header>

  <div id="log-container">
    <div style="color: var(--text-muted); text-align: center; padding: 20px;">Loading live logs...</div>
  </div>

  <script>
    let isPolling = true;
    let pollInterval = null;
    let autoScroll = true;

    const container = document.getElementById("log-container");
    container.addEventListener("scroll", () => {
      const atBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
      autoScroll = atBottom;
    });

    async function fetchLogs() {
      const level = document.getElementById("level-select").value;
      const limit = document.getElementById("limit-select").value;
      const search = document.getElementById("search-input").value;

      try {
        const query = new URLSearchParams({ format: "json", limit, level, search });
        const res = await fetch(window.location.pathname + "?" + query.toString(), {
          headers: { "Accept": "application/json" }
        });
        if (!res.ok) throw new Error("Status " + res.status);
        const data = await res.json();
        renderLogs(data.logs || []);
        document.getElementById("count-badge").innerText = (data.logs ? data.logs.length : 0) + " entries";
      } catch (err) {
        console.error("Failed to fetch logs:", err);
      }
    }

    function renderLogs(logs) {
      if (logs.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">No logs match criteria.</div>';
        return;
      }

      const reversed = [...logs].reverse();
      const html = reversed.map(l => {
        const metaHtml = l.meta ? '<span class="log-meta">' + escapeHtml(JSON.stringify(l.meta)) + '</span>' : '';
        return '<div class="log-row">' +
          '<span class="log-ts">' + escapeHtml(l.timestamp.substring(11, 23)) + '</span>' +
          '<span class="log-lvl lvl-' + l.level + '">' + l.level + '</span>' +
          '<span class="log-ctx">[' + escapeHtml(l.context) + ']</span>' +
          '<span class="log-msg">' + escapeHtml(l.message) + metaHtml + '</span>' +
        '</div>';
      }).join('');

      container.innerHTML = html;
      if (autoScroll) {
        container.scrollTop = container.scrollHeight;
      }
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function togglePolling() {
      isPolling = !isPolling;
      const btn = document.getElementById("toggle-poll-btn");
      const badge = document.getElementById("status-badge");
      if (isPolling) {
        btn.innerText = "Pause";
        btn.className = "btn-primary";
        badge.innerText = "LIVE (2s)";
        badge.style.background = "#238636";
        startPolling();
      } else {
        btn.innerText = "Resume";
        btn.className = "";
        badge.innerText = "PAUSED";
        badge.style.background = "#6e7681";
        clearInterval(pollInterval);
      }
    }

    async function clearLogs() {
      if (!confirm("Are you sure you want to clear stored application logs?")) return;
      await fetch(window.location.pathname + "/clear", { method: "POST" });
      fetchLogs();
    }

    function refreshLogs() {
      fetchLogs();
    }

    function startPolling() {
      clearInterval(pollInterval);
      pollInterval = setInterval(fetchLogs, 2000);
    }

    document.getElementById("search-input").addEventListener("input", () => {
      fetchLogs();
    });
    document.getElementById("level-select").addEventListener("change", () => {
      fetchLogs();
    });
    document.getElementById("limit-select").addEventListener("change", () => {
      fetchLogs();
    });

    fetchLogs();
    startPolling();
  </script>
</body>
</html>`;

  return res.send(html);
});

// Clear logs endpoint
router.post("/clear", async (req: Request, res: Response) => {
  await liveLogService.clearLogs();
  return res.json({ status: "OK", message: "Logs cleared" });
});

export default router;
