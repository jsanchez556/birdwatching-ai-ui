import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');
const port = Number(process.env.PORT) || 4173;
const host = '0.0.0.0';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

function log(level, message, metadata = {}) {
  console[level](JSON.stringify({
    level,
    message,
    service: 'birdwatching-ai-ui',
    timestamp: new Date().toISOString(),
    ...metadata,
  }));
}

async function resolveAsset(requestUrl) {
  const decodedPath = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  const requestedPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, '');
  const assetPath = path.join(distDir, requestedPath);

  if (!assetPath.startsWith(distDir)) {
    return path.join(distDir, 'index.html');
  }

  try {
    const assetStats = await stat(assetPath);
    if (assetStats.isFile()) {
      return assetPath;
    }
  } catch {
    return path.join(distDir, 'index.html');
  }

  return path.join(distDir, 'index.html');
}

const server = createServer(async (req, res) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    log('info', 'HTTP request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
    });
  });

  try {
    if (req.url === '/health') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        status: 'ok',
        services: {
          ui: 'ok',
        },
      }));
      return;
    }

    await access(distDir);
    const assetPath = await resolveAsset(req.url);
    const extension = path.extname(assetPath);

    res.setHeader('Content-Type', contentTypes[extension] || 'application/octet-stream');
    createReadStream(assetPath).pipe(res);
  } catch (error) {
    log('error', 'Failed to serve UI asset', {
      error: error.message,
      url: req.url,
    });
    res.statusCode = 500;
    res.end('Internal server error');
  }
});

server.listen(port, host, () => {
  log('info', 'UI server running', { port });
});

server.on('error', (error) => {
  log('error', 'UI server failed to start', {
    error: error.message,
    code: error.code,
  });
  process.exit(1);
});
