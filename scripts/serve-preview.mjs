import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, relative, resolve } from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const scriptsDir = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(scriptsDir, '..');
const defaultPort = Number(process.env.PORT || 4173);
const requestedPort = Number(process.argv[2] || defaultPort);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp',
};

function resolveRequest(url) {
  const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  const target = pathname === '/' ? '/preview/index.html' : pathname;
  const absolute = normalize(join(projectRoot, target));
  const relation = relative(projectRoot, absolute);
  if (relation.startsWith('..') || relation.includes(`..${process.platform === 'win32' ? '\\' : '/'}`)) return null;
  if (existsSync(absolute) && statSync(absolute).isDirectory()) return join(absolute, 'index.html');
  return absolute;
}

const server = createServer((request, response) => {
  if (request.url === '/__preview_health') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ service: 'qingchuang-pinpin-preview', pid: process.pid }));
    return;
  }
  const filePath = resolveRequest(request.url || '/');
  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('404 - File not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  createReadStream(filePath).pipe(response);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[preview] Port ${requestedPort} is already in use. Try: node scripts/serve-preview.mjs ${requestedPort + 1}`);
    process.exitCode = 1;
    return;
  }
  throw error;
});

server.listen(requestedPort, '127.0.0.1', () => {
  const threePath = join(projectRoot, 'preview', 'vendor', 'three.module.js');
  console.log(`[preview] Qingchuang Pinpin is running at http://127.0.0.1:${requestedPort}/preview/`);
  if (!existsSync(threePath)) {
    console.warn('[preview] Missing preview/vendor/three.module.js. Restore the vendored ESM build before opening the preview.');
  }
});
