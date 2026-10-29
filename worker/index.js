/* The site is static files. This Worker only answers /api/: the Class app's
   files kept on the website (decks, pictures, plans, timings) in a private R2
   bucket. Cloudflare Access guards /api/class (Kyle's login), and every
   request is checked here too, so a missing Access rule never opens it up.

   Settings in the Cloudflare dashboard (never in this repo):
   - ACCESS_TEAM: the Zero Trust team domain, e.g. "name.cloudflareaccess.com"
   - ACCESS_AUD: the Access application's Audience (AUD) tag */

const KINDS = new Set(['decks', 'plans']);
const ID = /^[\w.-]{1,80}$/;
const HASH = /^[0-9a-f]{16,128}$/;
const TIMINGS = /^[\w-]{1,80}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/class/')) return env.ASSETS.fetch(request);
    if (!env.ACCESS_TEAM || !env.ACCESS_AUD || !env.CLASS_FILES) return reply({ error: 'not set up' }, 503);
    if (!(await signedIn(request, env))) return reply({ error: 'sign in' }, 401);
    try {
      return await classApi(request, env, url.pathname.slice('/api/class/'.length).split('/'));
    } catch (err) {
      return reply({ error: String(err && err.message || err) }, 500);
    }
  }
};

async function classApi(request, env, [what, id, extra]) {
  const bucket = env.CLASS_FILES;
  const method = request.method;
  if (extra !== undefined) return reply({ error: 'not found' }, 404);

  // Access sends you here after its login page; go back to the app.
  if (what === 'login' && !id) return Response.redirect(new URL('/class/', request.url).href, 302);

  if (what === 'state' && !id && method === 'GET') {
    const out = { decks: {}, plans: {}, media: [], timings: [] };
    for (const kind of KINDS) {
      for (const o of await listAll(bucket, kind + '/')) {
        const m = o.customMetadata || {};
        out[kind][o.key.slice(kind.length + 1)] = { u: Number(m.u) || 0, gone: m.gone === '1', name: m.n || '' };
      }
    }
    out.media = (await listAll(bucket, 'media/', false)).map((o) => o.key.slice(6));
    out.timings = (await listAll(bucket, 'timings/', false)).map((o) => o.key.slice(8));
    return reply(out);
  }

  if (KINDS.has(what) && id && ID.test(id)) {
    const key = what + '/' + id;
    if (method === 'GET') {
      const o = await bucket.get(key);
      if (!o || (o.customMetadata || {}).gone === '1') return reply({ error: 'not found' }, 404);
      return new Response(o.body, { headers: headers({ 'Content-Type': 'application/json' }) });
    }
    if (method === 'PUT' || method === 'DELETE') {
      // base: the version the device last had. Someone else saved since: 409, and the device sorts it out.
      const params = new URL(request.url).searchParams;
      const u = Number(params.get('u'));
      if (!u) return reply({ error: 'u needed' }, 400);
      const now = await bucket.head(key);
      const have = now ? Number((now.customMetadata || {}).u) || 0 : 0;
      if (have && String(have) !== params.get('base')) return reply({ u: have }, 409);
      if (method === 'DELETE') {
        await bucket.put(key, '', { customMetadata: { u: String(u), gone: '1' } });
      } else {
        const body = await request.text();
        const name = String(JSON.parse(body).name || '').slice(0, 200);
        await bucket.put(key, body, { httpMetadata: { contentType: 'application/json' }, customMetadata: { u: String(u), n: name } });
      }
      return reply({ u });
    }
  }

  if (what === 'media' && id && HASH.test(id)) {
    const key = 'media/' + id;
    if (method === 'GET') {
      const o = await bucket.get(key);
      if (!o) return reply({ error: 'not found' }, 404);
      const m = o.customMetadata || {};
      return new Response(o.body, { headers: headers({
        'Content-Type': (o.httpMetadata && o.httpMetadata.contentType) || 'application/octet-stream',
        'X-Rights': m.rights || 'classroom', 'X-Name': m.name || '' }) });
    }
    if (method === 'PUT') {
      // Pictures are named by a hash of their bytes, so one already there is the same picture.
      if (await bucket.head(key)) return reply({ ok: true });
      await bucket.put(key, await request.arrayBuffer(), {
        httpMetadata: { contentType: request.headers.get('Content-Type') || 'application/octet-stream' },
        customMetadata: { rights: (request.headers.get('X-Rights') || 'classroom').slice(0, 40),
                          name: (request.headers.get('X-Name') || '').slice(0, 200) } });
      return reply({ ok: true });
    }
  }

  // Timings come in batches, one file per upload, never changed after.
  if (what === 'timings' && id && TIMINGS.test(id)) {
    const key = 'timings/' + id;
    if (method === 'GET') {
      const o = await bucket.get(key);
      return o ? new Response(o.body, { headers: headers({ 'Content-Type': 'application/json' }) }) : reply({ error: 'not found' }, 404);
    }
    if (method === 'PUT') {
      const body = await request.text();
      if (!Array.isArray(JSON.parse(body))) return reply({ error: 'list needed' }, 400);
      await bucket.put(key, body, { httpMetadata: { contentType: 'application/json' } });
      return reply({ ok: true });
    }
  }

  return reply({ error: 'not found' }, 404);
}

async function listAll(bucket, prefix, meta = true) {
  const out = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix, cursor, limit: 1000, include: meta ? ['customMetadata'] : [] });
    out.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out;
}

function headers(extra) {
  return { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow', ...extra };
}

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers({ 'Content-Type': 'application/json' }) });
}

// ---- Cloudflare Access ------------------------------------------------------

let keyCache = null;                       // { team, at, keys }

async function accessKeys(team, fresh) {
  if (!fresh && keyCache && keyCache.team === team && Date.now() - keyCache.at < 3600e3) return keyCache.keys;
  const res = await fetch('https://' + team + '/cdn-cgi/access/certs');
  if (!res.ok) throw new Error('Access keys: ' + res.status);
  keyCache = { team, at: Date.now(), keys: (await res.json()).keys || [] };
  return keyCache.keys;
}

const b64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const part = (s) => JSON.parse(new TextDecoder().decode(b64(s)));

/** The Access login token on the request is genuine, current and for this application. */
export async function signedIn(request, env, keys = accessKeys) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return false;
  const team = String(env.ACCESS_TEAM).replace(/^https?:\/\//, '').replace(/\/+$/, '');
  try {
    const [h, p, s] = token.split('.');
    const head = part(h), body = part(p);
    if (head.alg !== 'RS256') return false;
    let jwk = (await keys(team)).find((k) => k.kid === head.kid);
    if (!jwk) jwk = (await keys(team, true)).find((k) => k.kid === head.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64(s), new TextEncoder().encode(h + '.' + p));
    const now = Date.now() / 1000;
    const aud = Array.isArray(body.aud) ? body.aud : [body.aud];
    return ok && aud.includes(env.ACCESS_AUD) && body.iss === 'https://' + team &&
      typeof body.exp === 'number' && body.exp > now && !(body.nbf > now + 60);
  } catch (e) {
    return false;
  }
}
