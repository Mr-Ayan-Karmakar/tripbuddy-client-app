import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const host = '127.0.0.1';
const port = Number(process.env.PORT ?? 7010);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', `http://${host}:${port}`);
    const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
    const file = await resolveFile(relativePath);

    if (!file) {
      await sendFile(path.join(root, '+not-found.html'), response, 404, request.method === 'HEAD');
      return;
    }

    await sendFile(file, response, 200, request.method === 'HEAD');
  } catch {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
  }
}).listen(port, host, () => {
  console.log(`TripBuddy production preview: http://${host}:${port}`);
});

async function resolveFile(relativePath) {
  const candidates = relativePath
    ? [
        path.join(root, relativePath),
        path.join(root, relativePath, 'index.html'),
        path.join(root, `${relativePath}.html`)
      ]
    : [path.join(root, 'index.html')];

  for (const candidate of candidates) {
    if (!isInsideRoot(candidate)) continue;
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Try the next clean-URL candidate.
    }
  }
  return undefined;
}

function isInsideRoot(file) {
  const resolved = path.resolve(file);
  return resolved === root || resolved.startsWith(`${root}${path.sep}`);
}

async function sendFile(file, response, status, headOnly) {
  const body = await readFile(file);
  response.writeHead(status, {
    'content-type': contentTypes[path.extname(file)] ?? 'application/octet-stream',
    'content-length': body.byteLength,
    'cache-control': 'no-store'
  });
  response.end(headOnly ? undefined : body);
}
