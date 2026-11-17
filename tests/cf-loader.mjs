/* Lets Node load worker/index.js for the tests: stands in for the two cloudflare: modules it
   imports, and reads the file as an ES module (the repo has no package.json to say so). */
const STUBS = {
  'cloudflare:workers': 'export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }',
  'cloudflare:email': 'export class EmailMessage { constructor(from, to, raw) { Object.assign(this, { from, to, raw }); } }'
};

export async function resolve(specifier, context, next) {
  if (STUBS[specifier]) return { url: 'stub:' + specifier, shortCircuit: true };
  const r = await next(specifier, context);
  if (r.url.endsWith('/worker/index.js')) return { ...r, format: 'module' };
  return r;
}

export async function load(url, context, next) {
  if (url.startsWith('stub:')) {
    return { format: 'module', source: STUBS[url.slice(5)], shortCircuit: true };
  }
  if (url.endsWith('/worker/index.js')) return next(url, { ...context, format: 'module' });
  return next(url, context);
}
