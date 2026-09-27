import type { ApplicationAuthScreenConfig } from '../core/application-auth-controller';
import { applicationAuthCopy } from '../core/application-auth-copy';
import { applicationAuthScript } from '../browser/generated/application-auth-script';

/** Trusted account shell, never the private page contents. Config contains only
 * public backend settings and server-derived scope; no user/refresh/service token. */
export function applicationAuthScreenResponse(config: ApplicationAuthScreenConfig, status: 200 | 401): Response {
  const copy = applicationAuthCopy[config.language];
  const json = JSON.stringify(config).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  const button = (value: string, label: string, hidden = false) => `<button disabled type="submit" name="action" value="${value}"${hidden ? ' hidden' : ''}>${label}</button>`;
  const html = `<!doctype html><html lang="${config.language}" dir="${config.language === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${copy.title}</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#101827;color:#f1f5f9;font:16px/1.5 system-ui,sans-serif;padding:24px}main{width:100%;max-width:440px;background:#182338;border:1px solid #42516b;border-radius:20px;padding:32px}h1{margin-top:0}label{display:block;margin:16px 0 6px}input{width:100%;font:inherit;border:1px solid #8391a8;border-radius:8px;padding:12px;background:#0f172a;color:#fff}button{font:inherit;padding:10px 14px;margin:12px 4px 0 0;border:1px solid #8391a8;border-radius:8px;background:#e2e8f0;color:#101827;cursor:pointer}button:disabled{opacity:.55;cursor:wait}:focus-visible{outline:3px solid #67e8f9;outline-offset:3px}[hidden]{display:none!important}#account-status{min-height:48px;color:#cbd5e1}
</style></head><body><main><h1>${copy.title}</h1><p id="account-status" role="status" aria-live="polite">${copy.loading}</p><form id="account-form" method="post" aria-busy="true">
<div id="email-field"><label for="account-email">${copy.email}</label><input id="account-email" name="email" type="email" autocomplete="email" maxlength="320" required></div>
<div id="password-field"><label for="account-password">${copy.password}</label><input id="account-password" name="password" type="password" autocomplete="current-password" maxlength="4096" required></div>
<div id="confirm-field" hidden><label for="account-confirm">${copy.confirm}</label><input id="account-confirm" type="password" autocomplete="new-password" maxlength="4096"></div>
${button('signIn', copy.signIn)}${button('signUp', copy.signUp, !config.signUpEnabled)}<button disabled id="account-reset" type="button" value="reset">${copy.reset}</button>${button('update', copy.update, true)}${button('proceed', copy.proceed, true)}${button('signOut', copy.signOut, true)}
</form><noscript>${copy.noscript}</noscript></main><script id="application-auth-config" type="application/json">${json}</script><script>${applicationAuthScript.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
  return new Response(html, { status, headers: {
    'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store', 'cdn-cache-control': 'no-store', 'vercel-cdn-cache-control': 'no-store',
    vary: 'Authorization, Cookie, Accept', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
    'content-security-policy': `sandbox allow-same-origin allow-scripts allow-forms; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' ${config.backend.url}; base-uri 'none'; form-action 'none'; frame-ancestors 'none';`,
  } });
}
