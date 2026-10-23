// Logika bersama untuk server Node (lab) dan Cloudflare Worker.
// Yang berbeda per host hanya penyimpanan state-nya.

export const KEYS = ['smk', 'sma'];
export const TOKEN_RE = /^[A-Z]{6}$/;

export function emptyState() {
  return { smk: null, sma: null };
}

// body: { key: 'smk' | 'sma', token: 'ABCDEF' | null }
// token null = kosongkan token tersebut.
export function applyUpdate(state, body, now) {
  if (!body || typeof body !== 'object') return { error: 'Format permintaan tidak valid.' };
  const key = String(body.key || '').toLowerCase();
  if (!KEYS.includes(key)) return { error: 'Jenjang harus smk atau sma.' };

  const next = { ...emptyState(), ...state };
  if (body.token === null) {
    next[key] = null;
    return { state: next };
  }
  const token = String(body.token || '').trim().toUpperCase();
  if (!TOKEN_RE.test(token)) return { error: 'Token harus 6 huruf kapital (A–Z).' };
  next[key] = { token, updatedAt: now };
  return { state: next };
}

export function publicView(state, durationSec, now) {
  const s = { ...emptyState(), ...state };
  return { smk: s.smk, sma: s.sma, durationSec, serverTime: now };
}

// Perbandingan PIN yang tidak berhenti di karakter pertama yang beda.
export function pinMatches(given, expected) {
  if (typeof given !== 'string' || typeof expected !== 'string' || !expected) return false;
  let diff = given.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) {
    diff |= (given.charCodeAt(i % (given.length || 1)) || 0) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// Pembatas percobaan PIN salah per IP: maks 10 kali per 10 menit.
export function makeLimiter(max = 10, windowMs = 10 * 60 * 1000) {
  const hits = new Map();
  return {
    blocked(ip, now) {
      const h = hits.get(ip);
      if (!h) return false;
      if (now - h.start > windowMs) { hits.delete(ip); return false; }
      return h.count >= max;
    },
    fail(ip, now) {
      const h = hits.get(ip);
      if (!h || now - h.start > windowMs) hits.set(ip, { start: now, count: 1 });
      else h.count++;
    },
    reset(ip) { hits.delete(ip); },
  };
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Pin',
  'Access-Control-Max-Age': '600',
};

export const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  ...CORS_HEADERS,
};

// Menangani /api/token secara generik. Dipakai kedua host.
// store: { load(): Promise<state>, save(state): Promise<void> }
export async function handleApi({ method, pin, ip, readBody, store, adminPin, durationSec, limiter }) {
  const now = Date.now();
  if (method === 'OPTIONS') return { status: 204, body: null };

  if (method === 'GET') {
    return { status: 200, body: publicView(await store.load(), durationSec, now) };
  }

  if (method === 'POST') {
    if (limiter.blocked(ip, now)) {
      return { status: 429, body: { error: 'Terlalu banyak PIN salah. Coba lagi dalam 10 menit.' } };
    }
    if (!pinMatches(pin, adminPin)) {
      limiter.fail(ip, now);
      return { status: 401, body: { error: 'PIN salah.' } };
    }
    limiter.reset(ip);
    let body;
    try { body = await readBody(); } catch { return { status: 400, body: { error: 'JSON tidak valid.' } }; }
    const res = applyUpdate(await store.load(), body, now);
    if (res.error) return { status: 400, body: { error: res.error } };
    await store.save(res.state);
    return { status: 200, body: publicView(res.state, durationSec, now) };
  }

  return { status: 405, body: { error: 'Metode tidak didukung.' } };
}
