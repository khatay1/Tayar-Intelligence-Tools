import { createApplicationDataRuntime } from '../core/application-data-runtime';
import type { ApplicationAuthScreenConfig } from '../core/application-auth-controller';
import type { ApplicationDefinition } from '../core/application-model';
import { applicationAuthCopy } from '../core/application-auth-copy';
import { createApplicationNavigator } from '../core/application-navigation';
import { compileApplicationCreateForm, createDurableApplicationFormSubmission } from '../core/application-form-runtime';
import type { PublishedApplicationForm } from '../core/application-published-forms';

const script = document.currentScript as HTMLScriptElement;
const config = JSON.parse(script.dataset.application!) as ApplicationAuthScreenConfig & { definition: ApplicationDefinition; paths: string[]; pageId: string; applicationForms: PublishedApplicationForm[] };
const copy = applicationAuthCopy[config.language] ?? applicationAuthCopy.en;
const formCopy = {
  en: { unavailable: 'This form is unavailable. Sign in and reload the page.', uncertain: 'The result is uncertain. Keep these values and try again to check the same request.' },
  ar: { unavailable: 'النموذج غير متاح. سجّل الدخول ثم أعد تحميل الصفحة.', uncertain: 'نتيجة الإرسال غير مؤكدة. احتفظ بالقيم وحاول مجدداً للتحقق من الطلب نفسه.' },
  sv: { unavailable: 'Formuläret är inte tillgängligt. Logga in och ladda om sidan.', uncertain: 'Resultatet är osäkert. Behåll uppgifterna och försök igen med samma begäran.' },
}[config.language] ?? { unavailable: 'This form is unavailable. Sign in and reload the page.', uncertain: 'The result is uncertain. Keep these values and try again to check the same request.' };
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
  const boundForms = new Map<HTMLFormElement, { controller: ReturnType<typeof createDurableApplicationFormSubmission>; userId: string }>();
  const submittingForms = new Set<HTMLFormElement>();
  const leadForms = Array.from(document.querySelectorAll<HTMLFormElement>('form[data-tayar-lead-form]'));
  const formStatus = (form: HTMLFormElement, value: string) => {
    const target = form.querySelector('[data-form-status]');
    if (target) target.textContent = value;
  };
  const stopForms = () => {
    boundForms.forEach(({ controller }) => controller.dispose()); boundForms.clear();
    leadForms.forEach(form => { const button = form.querySelector<HTMLButtonElement>('button[type="submit"]'); if (button) button.disabled = true; });
  };
  // Private application exports contain no platform lead-capture script. Capture
  // every contact submit, including an unbound/disabled form's Enter key.
  const submitForm = (event: Event) => {
    if (!(event.target instanceof HTMLFormElement) || !leadForms.includes(event.target)) return;
    event.preventDefault();
    const form = event.target, bound = boundForms.get(form);
    if (!bound || disposed || signingOut) { formStatus(form, formCopy.unavailable); return; }
    if (submittingForms.has(form)) return;
    submittingForms.add(form);
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (button) button.disabled = true;
    formStatus(form, form.dataset.sendingMessage || copy.loading);
    void (async () => {
      try {
        const user = await runtime.auth.currentUser();
        if (!user || user.is_anonymous || user.id !== bound.userId) throw new Error();
        const outcome = await bound.controller.submit(new FormData(form).entries());
        if (disposed || signingOut) return;
        if (outcome === 'confirmed') {
          form.reset(); bound.controller.resetConfirmed();
          formStatus(form, form.dataset.successMessage || 'Saved.');
        } else formStatus(form, formCopy.uncertain);
      } catch { if (!disposed && !signingOut) formStatus(form, form.dataset.errorMessage || formCopy.unavailable); }
      finally { submittingForms.delete(form); if (button && !disposed && !signingOut) button.disabled = false; }
    })();
  };
  document.addEventListener('submit', submitForm, true);
  const prepareForms = async () => {
    if (!Array.isArray(config.applicationForms) || !config.applicationForms.length) return;
    const user = await runtime.auth.currentUser();
    if (!user || user.is_anonymous || disposed || signingOut) return;
    const seen = new Set<string>();
    for (const item of config.applicationForms) {
      const sectionId = item.section.id;
      if (item.pageId !== config.pageId || seen.has(sectionId)) throw new Error('Application form page identity is invalid.');
      seen.add(sectionId);
      const form = leadForms.find(candidate => candidate.dataset.formId === sectionId
        && candidate.closest('[data-tayar-section-id]')?.getAttribute('data-tayar-section-id') === sectionId);
      if (!form || leadForms.filter(candidate => candidate.dataset.formId === sectionId).length !== 1) throw new Error('Application form markup is unavailable.');
      const compiled = compileApplicationCreateForm(config.definition, item.section, item.binding);
      const key = ['tayar-app-form', config.backend.projectRef, config.projectId, user.id, item.pageId, sectionId].join(':');
      const controller = createDurableApplicationFormSubmission(compiled, runtime, { key, storage: sessionStorage, crypto });
      boundForms.set(form, { controller, userId: user.id });
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (button) button.disabled = false;
      formStatus(form, '');
    }
  };
  void prepareForms().catch(() => { stopForms(); leadForms.forEach(form => formStatus(form, formCopy.unavailable)); });
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
    signingOut = true; stopForms(); logout.disabled = true; status.textContent = copy.loading;
    void runtime.auth.signOut().then(() => { if (!disposed) window.location.replace(account.href); }).catch(() => {
      if (!disposed) { status.textContent = copy.error; logout.disabled = false; signingOut = false; }
    });
  });
  const dispose = () => { if (disposed) return; disposed = true; stopForms(); navigator.dispose(); runtime.dispose(); document.removeEventListener('click', click); document.removeEventListener('submit', submitForm, true); };
  window.addEventListener('pagehide', dispose, { once: true });
  window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
  // Refresh cookie transport when opening a public page or after Auth refresh.
  // This is never a substitute for the server's next-page permission check.
  void runtime.auth.prepareNavigation().catch(() => { if (!disposed) status.textContent = copy.error; });
} catch { logout.disabled = true; status.textContent = copy.unavailable; }
