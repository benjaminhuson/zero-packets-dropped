// Serves the built Stride front end from the same App Service as the API, so there is one origin,
// one sign-in, and no CORS. Unknown paths fall back to index.html (single-page app).
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { ServerResponse } from 'node:http';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export async function serveStatic(dir: string, pathname: string, res: ServerResponse): Promise<void> {
  const root = resolve(dir);
  const wanted = resolve(join(root, normalize(decodeURIComponent(pathname))));
  const inside = wanted === root || wanted.startsWith(root + sep);
  let file = join(root, 'index.html');
  if (inside) {
    const info = await stat(wanted).catch(() => null);
    if (info?.isFile()) file = wanted;
  }
  const body = await readFile(file);
  const hashed = file.includes(`${sep}assets${sep}`); // Vite puts content-hashed files in assets/
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  res.end(body);
}
