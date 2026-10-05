import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const sourceRoot = process.env.TAYAR_AUDIT_ROOT;
const source = fs.readFileSync(sourceRoot ? `${sourceRoot}/supabase/functions/website-form-submit/index.ts` : new URL('../supabase/functions/website-form-submit/index.ts', import.meta.url), 'utf8');
const counters = new Map();
const rateKeys = [];
const definition = { fields: [{ name: 'email', label: 'Email', type: 'email', required: true }], automations: [] };
const admin = {
  from(table) {
    const query = {
      select() { return this; },
      eq() { return this; },
      async maybeSingle() { return { data: { definition, user_id: 'owner', name: 'Contact' }, error: null }; },
      async insert() { return { error: null }; },
      then(resolve) { resolve({ count: 0, error: null }); },
    };
    assert.ok(['website_forms', 'website_leads'].includes(table));
    return query;
  },
  async rpc(name, args) {
    if (name === 'website_public_ingestion_limit') return { data: 1000, error: null };
    assert.equal(name, 'enforce_website_public_rate_limit');
    rateKeys.push(args.p_client_key);
    const key = `${args.p_project_id}|${args.p_bucket}|${args.p_client_key}`;
    const hits = (counters.get(key) || 0) + 1;
    counters.set(key, hits);
    return { error: hits > args.p_limit ? { message: 'Too many requests' } : null };
  },
};
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const context = vm.createContext({ Request, Response, FormData, File, URL, Date, console, crypto,
  createAdminClient: () => admin, HttpError,
  validWebsiteWebhookDestination: () => false,
  deliverSignedWebsiteWebhook: () => { throw new Error('Unexpected network call'); },
  Deno: { env: { get: () => undefined }, serve: fn => { context.handler = fn; } },
});
const code = source.replace(/^import .*;\n/gm, '');
vm.runInContext(stripTypeScriptTypes(code), context);
async function submit(email, ip = '203.0.113.7') {
  const body = new FormData();
  body.set('_tayar_project_id', '11111111-1111-4111-8111-111111111111');
  body.set('_tayar_form_id', 'contact');
  body.set('_tayar_started_at', new Date(Date.now() - 10_000).toISOString());
  body.set('_tayar_context', JSON.stringify({ email }));
  return context.handler(new Request('https://example.supabase.co/functions/v1/website-form-submit', {
    method: 'POST', headers: { 'cf-connecting-ip': ip }, body,
  }));
}
for (let n = 0; n < 8; n++) assert.equal((await submit(`visitor${n}@example.com`)).status, 200);
assert.equal((await submit('different@example.com')).status, 429, 'rotating submitted email must not reset the same visitor limit');
assert.equal(new Set(rateKeys.slice(0, 9)).size, 1);
assert.equal((await submit('different@example.com', '203.0.113.8')).status, 200, 'a distinct visitor must retain an independent limit');
console.log('Website form rate limit: rotating email blocked on request 9; distinct IP remains allowed.');
