// Cloudflare Worker: halaman statis dari ../public, token disimpan di Durable Object
// (konsisten seketika, tidak seperti KV yang bisa telat sampai ~60 detik).
import { DurableObject } from 'cloudflare:workers';
import { handleApi, emptyState, makeLimiter, JSON_HEADERS } from '../../shared/core.js';

export class TokenStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.limiter = makeLimiter();
    this.store = {
      load: async () => (await ctx.storage.get('state')) || emptyState(),
      save: async (state) => ctx.storage.put('state', state),
    };
  }

  async fetch(request) {
    const out = await handleApi({
      method: request.method,
      pin: request.headers.get('X-Admin-Pin'),
      ip: request.headers.get('CF-Connecting-IP') || 'unknown',
      readBody: () => request.json(),
      store: this.store,
      adminPin: this.env.ADMIN_PIN,
      durationSec: Number(this.env.DURATION_SEC || 300),
      limiter: this.limiter,
    });
    return new Response(out.body === null ? null : JSON.stringify(out.body), {
      status: out.status,
      headers: JSON_HEADERS,
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/token') {
      const stub = env.TOKEN_STORE.get(env.TOKEN_STORE.idFromName('main'));
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
