import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { pipeline } from "node:stream";
import { createBrotliCompress, createGzip } from "node:zlib";

const moduleDir = process.cwd();
const modulePath = path.join(moduleDir, "server.js");
const defaultDistDir = path.join(moduleDir, "dist");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

const compressibleTypes = new Set([".css", ".html", ".js", ".json", ".svg", ".txt"]);

function log(level, message, details = {}) {
  const output = JSON.stringify({
    level,
    message,
    service: "birdwatching-ai-ui",
    timestamp: new Date().toISOString(),
    ...details,
  });
  (level === "error" ? console.error : console.log)(output);
}

function pathnameFromUrl(url = "/") {
  try {
    return decodeURIComponent(new URL(url, "http://localhost").pathname);
  } catch {
    return null;
  }
}

function safePathFromUrl(url, distDir = defaultDistDir) {
  const pathname = pathnameFromUrl(url);
  if (!pathname) return null;
  const requestedPath = path.resolve(distDir, `.${pathname}`);
  const relativePath = path.relative(distDir, requestedPath);
  return relativePath.startsWith("..") || path.isAbsolute(relativePath)
    ? null
    : requestedPath;
}

async function isFile(filePath) {
  return existsSync(filePath) && (await stat(filePath)).isFile();
}

async function resolveStaticPath(req, distDir = defaultDistDir) {
  const requestedPath = safePathFromUrl(req.url, distDir);
  if (!requestedPath) return null;
  if (await isFile(requestedPath)) {
    return { filePath: requestedPath, spaFallback: false };
  }

  const pathname = pathnameFromUrl(req.url);
  const acceptsHtml = String(req.headers.accept || "").includes("text/html");
  const isNavigation = acceptsHtml && !path.extname(pathname || "");
  const indexPath = path.join(distDir, "index.html");
  return isNavigation && await isFile(indexPath)
    ? { filePath: indexPath, spaFallback: true }
    : null;
}

function selectEncoding(req, extension, size) {
  if (size < 1024 || !compressibleTypes.has(extension)) return null;
  const accepted = String(req.headers["accept-encoding"] || "");
  if (accepted.includes("br")) return "br";
  if (accepted.includes("gzip")) return "gzip";
  return null;
}

function cacheControlFor(filePath, spaFallback) {
  if (spaFallback || path.extname(filePath) === ".html") {
    return "no-cache";
  }
  return /[/\\]assets[/\\].+-[A-Za-z0-9_-]{8,}\./.test(filePath)
    ? "public, max-age=31536000, immutable"
    : "public, max-age=3600";
}

function positiveEnvironmentNumber(name, fallback) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === "") return fallback;
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return value;
}

function createStaticAppServer({
  distDir = defaultDistDir,
  requestLogger = log,
} = {}) {
  let shuttingDown = false;
  const sockets = new Set();

  const server = createServer(async (req, res) => {
    const startedAt = process.hrtime.bigint();
    const requestPath = pathnameFromUrl(req.url) || "invalid";
    const route = requestPath.startsWith("/assets/")
      ? "/assets/*"
      : requestPath.startsWith("/health")
        ? requestPath
        : "navigation";

    res.on("finish", () => {
      requestLogger("info", "request completed", {
        method: req.method,
        route,
        status: res.statusCode,
        durationMs: Number((Number(process.hrtime.bigint() - startedAt) / 1_000_000).toFixed(2)),
      });
    });

    try {
      if (requestPath === "/health" || requestPath === "/health/live") {
        res.writeHead(200, {
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }
      if (requestPath === "/health/ready") {
        res.writeHead(shuttingDown ? 503 : 200, {
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(JSON.stringify({ status: shuttingDown ? "unavailable" : "ok" }));
        return;
      }

      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Method Not Allowed");
        return;
      }

      const resolved = await resolveStaticPath(req, distDir);
      if (!resolved) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not Found");
        return;
      }

      const fileStats = await stat(resolved.filePath);
      const extension = path.extname(resolved.filePath);
      const encoding = selectEncoding(req, extension, fileStats.size);
      const headers = {
        "Cache-Control": cacheControlFor(resolved.filePath, resolved.spaFallback),
        "Content-Type": contentTypes[extension] || "application/octet-stream",
        "Vary": "Accept-Encoding",
        "X-Content-Type-Options": "nosniff",
      };
      if (encoding) headers["Content-Encoding"] = encoding;
      else headers["Content-Length"] = String(fileStats.size);

      res.writeHead(200, headers);
      if (req.method === "HEAD") {
        res.end();
        return;
      }

      const source = createReadStream(resolved.filePath);
      if (encoding === "br") pipeline(source, createBrotliCompress(), res, () => {});
      else if (encoding === "gzip") pipeline(source, createGzip(), res, () => {});
      else pipeline(source, res, () => {});
    } catch {
      requestLogger("error", "request failed", {
        method: req.method,
        route,
      });
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      }
      res.end("Internal Server Error");
    }
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  let shutdownPromise = null;
  function shutdown({ graceMs = 10000, hardTimeoutMs = 15000 } = {}) {
    if (shutdownPromise) return shutdownPromise;
    shuttingDown = true;

    shutdownPromise = new Promise((resolve) => {
      let forced = false;
      const graceTimer = setTimeout(() => {
        forced = true;
        server.closeAllConnections?.();
        for (const socket of sockets) socket.destroy();
      }, graceMs);
      graceTimer.unref?.();
      const hardTimer = setTimeout(() => {
        forced = true;
        for (const socket of sockets) socket.destroy();
        resolve({ exitCode: 1, forced });
      }, hardTimeoutMs);
      hardTimer.unref?.();

      server.close((error) => {
        clearTimeout(graceTimer);
        clearTimeout(hardTimer);
        resolve({ exitCode: error ? 1 : 0, forced });
      });
      server.closeIdleConnections?.();
    });

    return shutdownPromise;
  }

  return { server, shutdown };
}

function startStaticServer({
  port = Number(process.env.PORT) || 3000,
  host = "0.0.0.0",
} = {}) {
  const graceMs = positiveEnvironmentNumber("STATIC_SERVER_GRACE_MS", 10000);
  const hardTimeoutMs = positiveEnvironmentNumber("STATIC_SERVER_HARD_TIMEOUT_MS", 15000);
  if (hardTimeoutMs <= graceMs) {
    throw new Error("STATIC_SERVER_HARD_TIMEOUT_MS must exceed STATIC_SERVER_GRACE_MS");
  }
  const runtime = createStaticAppServer();
  runtime.server.listen(port, host, () => log("info", "server started", {
    host,
    port,
    distDir: defaultDistDir,
  }));
  runtime.server.on("error", () => {
    log("error", "server failed");
    process.exitCode = 1;
  });
  let signalHandled = false;
  const handleSignal = (signal) => {
    if (signalHandled) return;
    signalHandled = true;
    log("info", "server shutdown started", { signal });
    runtime.shutdown({ graceMs, hardTimeoutMs })
      .then(({ exitCode }) => process.exit(exitCode));
  };
  process.once("SIGTERM", handleSignal);
  process.once("SIGINT", handleSignal);
  return runtime;
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  startStaticServer();
}

export {
  cacheControlFor,
  createStaticAppServer,
  positiveEnvironmentNumber,
  resolveStaticPath,
  safePathFromUrl,
  selectEncoding,
  startStaticServer,
};
