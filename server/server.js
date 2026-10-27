// Server lab: Node.js tanpa dependensi. Token disimpan di file JSON.
//   ADMIN_PIN=rahasia node server/server.js
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi, emptyState, makeLimiter, JSON_HEADERS } from '../shared/core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_PIN = process.env.ADMIN_PIN || '';
const DURATION_SEC = Number(process.env.DURATION_SEC || 600);
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, 'data', 'state.json');

if (ADMIN_PIN.length < 6) {
  console.error('ADMIN_PIN wajib diisi (minimal 6 karakter). Contoh: ADMIN_PIN=rahasia123 node server/server.js');
  process.exit(1);
}

// Penyimpanan file: tulis ke file sementara lalu rename, supaya tidak korup kalau listrik mati.
let cache = null;
const store = {
  async load() {
    if (cache) return cache;
    try { cache = JSON.parse(await fs.readFile(DATA_FILE, 'utf8')); }
    catch { cache = emptyState(); }
    return cache;
  },
  async save(state) {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const tmp = DATA_FILE + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(state, null, 2));
    await fs.rename(tmp, DATA_FILE);
    cache = state;
  },
};

const limiter = makeLimiter();

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};
const ROUTES = { '/': 'index.html', '/admin': 'admin.html', '/admin/': 'admin.html' };

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 4096) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

async function serveStatic(req, res, pathname) {
  const rel = ROUTES[pathname] || pathname.replace(/^\/+/, '');
  const file = path.join(PUBLIC_DIR, path.normalize(rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const buf = await fs.readFile(file);
    const ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.woff2' ? 'public, max-age=604800' : 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : buf);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Tidak ditemukan');
  }
}

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  try {
    if (pathname === '/api/token') {
      const out = await handleApi({
        method: req.method,
        pin: req.headers['x-admin-pin'],
        ip: req.socket.remoteAddress,
        readBody: () => readJson(req),
        store,
        adminPin: ADMIN_PIN,
        durationSec: DURATION_SEC,
        limiter,
      });
      res.writeHead(out.status, JSON_HEADERS);
      res.end(out.body === null ? undefined : JSON.stringify(out.body));
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    await serveStatic(req, res, pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500, JSON_HEADERS);
    res.end(JSON.stringify({ error: 'Kesalahan server.' }));
  }
}).listen(PORT, HOST, () => {
  console.log(`Token TKA berjalan di http://${HOST}:${PORT}  (admin: /admin)`);
});
