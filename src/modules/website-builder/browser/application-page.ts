import { createApplicationDataRuntime } from '../core/application-data-runtime';
import type { ApplicationAuthScreenConfig } from '../core/application-auth-controller';
import type { ApplicationDefinition } from '../core/application-model';
import { applicationAuthCopy } from '../core/application-auth-copy';
import { createApplicationNavigator } from '../core/application-navigation';

const script = document.currentScript as HTMLScriptElement;
const config = JSON.parse(script.dataset.application!) as ApplicationAuthScreenConfig & { definition: ApplicationDefinition; paths: string[] };
const copy = applicationAuthCopy[config.language] ?? applicationAuthCopy.en;
const account = new URL(config.returnPath, config.applicationOrigin);
account.searchParams.set('applicationAuth', '1');
// Keep account controls in a shadow root so authored styles do not accidentally
// hide them. All text is assigned as textContent, never interpolated user HTML.
const host = document.createElement('aside');
host.setAttribute('aria-label', copy.title);
host.style.cssText = 'position:fixed;bottom:16px;inset-inline-end:16px;z-index:2147483647';
const root = host.attachShadow({ mode: 'open' });
const style = document.createElement('style');
style.textContent = ':host{font:14px/1.5 system-ui,sans-serif}nav{padding:10px;background:#101827;color:#fff;border:1px solid #64748b;border-radius:12px;max-width:300px}a,button{font:inherit;color:#fff;background:transparent;border:1px solid #94a3b8;border-radius:6px;padding:6px 10px;text-decoration:none;cursor:pointer;margin:2px}button:disabled{opacity:.5}a:focus-visible,button:focus-visible{outline:3px solid #67e8f9;outline-offset:2px}p{margin:6px;overflow-wrap:anywhere}p:empty{display:none}';
const nav = document.createElement('nav');
nav.dir = config.language === 'ar' ? 'rtl' : 'ltr';
nav.setAttribute('aria-label', copy.title);
const link = document.createElement('a'); link.href = account.href; link.textContent = copy.title;
const logout = document.createElement('button'); logout.type = 'button'; logout.textContent = copy.signOut;
const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
nav.append(link, logout, status); root.append(style, nav); document.body.append(host);
try {
  const runtime = createApplicationDataRuntime(config.definition, config.backend, config.platformUrl, config);
  const navigator = createApplicationNavigator({ paths: config.paths, currentUrl: () => window.location.href,
    synchronize: () => runtime.auth.prepareNavigation(), navigate: url => { if (!signingOut) window.location.assign(url); },
  });
  let disposed = false, signingOut = false;
  const click = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || signingOut) return;
    const anchor = event.composedPath().find(item => item instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined;
    if (!anchor || anchor === link || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
    const target = navigator.target(anchor.href);
    if (!target) return;
    event.preventDefault();
    status.textContent = copy.loading;
    void navigator.go(target).then(() => { if (!disposed) status.textContent = ''; }).catch(() => { if (!disposed) status.textContent = copy.error; });
  };
  document.addEventListener('click', click);
  logout.addEventListener('click', () => {
    if (signingOut || disposed) return;
    signingOut = true; logout.disabled = true; status.textContent = copy.loading;
    void runtime.auth.signOut().then(() => { if (!disposed) window.location.replace(account.href); }).catch(() => {
      if (!disposed) { status.textContent = copy.error; logout.disabled = false; signingOut = false; }
    });
  });
  const dispose = () => { if (disposed) return; disposed = true; navigator.dispose(); runtime.dispose(); document.removeEventListener('click', click); };
  window.addEventListener('pagehide', dispose, { once: true });
  window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
  // Refresh cookie transport when opening a public page or after Auth refresh.
  // This is never a substitute for the server's next-page permission check.
  void runtime.auth.prepareNavigation().catch(() => { if (!disposed) status.textContent = copy.error; });
} catch { logout.disabled = true; status.textContent = copy.unavailable; }
