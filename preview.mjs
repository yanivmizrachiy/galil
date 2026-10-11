// Local preview server for the Galil workbook (SOURCE_OF_TRUTH.md §19: ongoing preview).
// Usage: node preview.mjs [port]   → http://127.0.0.1:<port>/  (default 8787)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const rootReal = fs.realpathSync(root);
const port = Number(process.argv[2] || process.env.PORT || 8787);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.pdf': 'application/pdf', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.normalize(path.join(root, pathname));
    // Serve only files inside the preview root. Compare against root + path.sep so a sibling
    // directory that merely shares the textual prefix (e.g. "galil-private") is rejected, not served.
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end('403'); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('404 ' + pathname); return; }
    // Resolve symlinks and re-check, so a link inside the root cannot point outside it.
    const real = fs.realpathSync(file);
    if (real !== rootReal && !real.startsWith(rootReal + path.sep)) { res.writeHead(403); res.end('403'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  } catch (err) { res.writeHead(500); res.end(String(err)); }
}).listen(port, '127.0.0.1', () => console.log(`Galil preview: http://127.0.0.1:${port}/`));
