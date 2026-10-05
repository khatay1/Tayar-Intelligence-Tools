import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const root = process.env.TAYAR_AUDIT_ROOT || new URL('../', import.meta.url);
const read = p => fs.readFileSync(typeof root === 'string' ? `${root}/${p}` : new URL(p, root), 'utf8');
const sandboxPolicy = value => {
  assert.match(value || '', /(?:^|;)\s*sandbox(?:\s|;|$)/);
  assert.doesNotMatch(value, /allow-same-origin/);
};

// Test the public-storage branch of the real handler, without private-runtime dependencies.
const context = vm.createContext({ URL, Headers, Request, Response, Buffer, process,
  tryServePublishedApplication: async () => null,
  fetch: async () => new Response('<svg xmlns="http://www.w3.org/2000/svg"><script>void 0</script></svg>', { status: 200 }),
});
const api = read('api/published-site.js').replace(/^import .*;\n/gm, '').replace('export default async function handler', 'async function handler');
vm.runInContext(api + '\nglobalThis.handler = handler;', context);
const previous = process.env.SUPABASE_URL;
process.env.SUPABASE_URL = 'https://example.supabase.co';
try {
  if (!process.argv.includes('--preview-only')) for (const [path, type] of [
    ['index.html', 'text/html; charset=utf-8'],
    ['assets/untrusted.svg', 'image/svg+xml'],
    ['assets/document.xml', 'application/xml; charset=utf-8'],
    ['assets/site.css', 'text/css; charset=utf-8'],
  ]) {
    for (const prefix of ['/site/owner/project', '/preview/owner/project/token']) {
      const headers = new Map();
      const response = { statusCode: 0, setHeader: (k, v) => headers.set(k.toLowerCase(), String(v)), end() {} };
      await context.handler({ method: 'GET', url: `${prefix}/${path}`, headers: { host: 'tayar.se' } }, response);
      assert.equal(response.statusCode, 200);
      assert.equal(headers.get('content-type'), type);
      sandboxPolicy(headers.get('content-security-policy'));
    }
  }
} finally {
  if (previous === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = previous;
}

// This real sanitizer output is still active HTML; containment must not rely on its regexes.
const rendering = read('src/modules/website-builder/core/website-builder-rendering.ts');
const start = rendering.indexOf('export function sanitizeCustomHtml(');
const end = rendering.indexOf('\nexport function elementToHtml(', start);
const sanitizeContext = vm.createContext({});
vm.runInContext(stripTypeScriptTypes(rendering.slice(start, end).replace('export function', 'function')) + '\nglobalThis.sanitize = sanitizeCustomHtml;', sanitizeContext);
const payload = '<iframe srcdoc="&lt;script&gt;parent.__auditProbe=1&lt;/script&gt;"></iframe><style>body{display:none}</style>';
const sanitized = sanitizeContext.sanitize(payload);
assert.match(sanitized, /srcdoc=/);
assert.match(sanitized, /&lt;script&gt;/);
assert.match(sanitized, /<style>/);

const preview = read('src/modules/website-builder/components/ElementPreview.tsx');
const codeStart = preview.indexOf("if (element.type === 'code')");
const codeEnd = preview.indexOf("if (element.type === 'image')", codeStart);
const codePreview = preview.slice(codeStart, codeEnd);
assert.doesNotMatch(codePreview, /dangerouslySetInnerHTML/);
assert.match(codePreview, /<iframe\b/);
assert.match(codePreview, /sandbox=""/);
assert.match(codePreview, /srcDoc=\{sanitizeCustomHtml\(element.content\)\}/);
assert.match(codePreview, /tabIndex=\{-1\}/);
assert.doesNotMatch(codePreview, /allow-scripts|allow-same-origin/);
console.log('Published content isolation: 8 handler cases and unsafe Custom HTML containment contract passed.');
