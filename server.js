import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
const port = Number(process.env.PORT) || 3000;
const host = "0.0.0.0";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

function log(level, message, details = {}) {
  const entry = {
    level,
    message,
    service: "birdwatching-ai-ui",
    timestamp: new Date().toISOString(),
    ...details
  };

  const output = JSON.stringify(entry);
  if (level === "error") {
    console.error(output);
    return;
  }

  console.log(output);
}

function safePathFromUrl(url) {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const requestedPath = path.normalize(path.join(distDir, pathname));

  if (!requestedPath.startsWith(distDir)) {
    return null;
  }

  return requestedPath;
}

async function resolveStaticPath(url) {
  const requestedPath = safePathFromUrl(url);
  if (!requestedPath) {
    return null;
  }

  if (existsSync(requestedPath) && (await stat(requestedPath)).isFile()) {
    return requestedPath;
  }

  const indexPath = path.join(distDir, "index.html");
  if (existsSync(indexPath)) {
    return indexPath;
  }

  return null;
}

const server = createServer(async (req, res) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    log("info", "request completed", {
      method: req.method,
      path: req.url,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2))
    });
  });

  try {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Method Not Allowed");
      return;
    }

    const filePath = await resolveStaticPath(req.url);
    if (!filePath) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const headers = {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream"
    };

    res.writeHead(200, headers);
    if (req.method === "HEAD") {
      res.end();
      return;
    }

    createReadStream(filePath).pipe(res);
  } catch (error) {
    log("error", "request failed", {
      method: req.method,
      path: req.url,
      error: error.message
    });
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal Server Error");
  }
});

server.listen(port, host, () => {
  log("info", "server started", {
    host,
    port,
    distDir
  });
});

server.on("error", (error) => {
  log("error", "server failed", { error: error.message });
  process.exitCode = 1;
});
