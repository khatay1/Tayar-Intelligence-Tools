import { supabase } from '@/lib/supabase';
import type {
  MobileWebsiteContent,
  MobileWebsiteElement,
  MobileWebsitePage,
  MobileWebsiteProjectRow,
  MobileWebsiteSection,
} from '@/lib/website-builder';

type PublishedFile = {
  name: string;
  content: string;
  contentType: string;
};

type SnapshotFile = {
  body: ArrayBuffer;
  contentType: string;
};

type PublishedSnapshot = Map<string, SnapshotFile>;

const SUPPORTED_ELEMENT_TYPES = new Set([
  'heading',
  'text',
  'button',
  'image',
  'list',
  'divider',
  'spacer',
]);

const storage = supabase.storage.from('published-sites');

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function trimText(value: unknown, max = 5000) {
  return text(value).trim().slice(0, max);
}

function escapeHtml(value: unknown) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeColor(value: unknown, fallback: string) {
  const candidate = trimText(value, 32);
  return /^#[0-9a-f]{3,8}$/i.test(candidate) ? candidate : fallback;
}

function safeNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function safeSlug(value: unknown, fallback = 'page') {
  const slug = trimText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function safeHref(value: unknown, pages: MobileWebsitePage[]) {
  const href = trimText(value, 1000);
  if (!href) return '#';
  if (href.startsWith('#')) return href.replace(/[^#a-zA-Z0-9_-]/g, '');
  if (href.startsWith('page:')) {
    const slug = safeSlug(href.slice(5), 'home');
    const page = pages.find((candidate) => safeSlug(candidate.slug, 'home') === slug);
    if (!page) return '#';
    return safeSlug(page.slug, 'home') === 'home' ? 'index.html' : `${safeSlug(page.slug)}.html`;
  }
  if (/^(?:https?:\/\/|mailto:|tel:)/i.test(href)) return href;
  return '#';
}

function safeImageSrc(value: unknown) {
  const src = trimText(value, 3000);
  return /^https?:\/\//i.test(src) ? src : '';
}

function safeFont(value: unknown) {
  const family = trimText(value, 80).replace(/[^a-zA-Z0-9 ,.'"_-]/g, '');
  return family || 'Inter, Arial, sans-serif';
}

function styleObject(element: MobileWebsiteElement) {
  return element.style && typeof element.style === 'object' ? element.style as Record<string, unknown> : {};
}

function elementInlineStyle(element: MobileWebsiteElement, accent: string) {
  const style = styleObject(element);
  const parts = [
    `color:${safeColor(style.color, '#ffffff')}`,
    `font-size:${safeNumber(style.fontSize, element.type === 'heading' ? 36 : 16, 10, 96)}px`,
    `font-weight:${Math.round(safeNumber(style.fontWeight, element.type === 'heading' ? 800 : 400, 100, 900))}`,
    `text-align:${['left', 'center', 'right'].includes(String(style.textAlign)) ? String(style.textAlign) : 'center'}`,
    `opacity:${safeNumber(style.opacity, 1, 0, 1)}`,
  ];
  if (element.type === 'button') {
    parts.push(
      `background:${safeColor(style.backgroundColor, accent)}`,
      `padding:${safeNumber(style.padding, 12, 0, 60)}px ${safeNumber(style.padding, 12, 0, 60) * 1.5}px`,
      `border-radius:${safeNumber(style.borderRadius, 12, 0, 80)}px`,
    );
  }
  if (element.type === 'image') {
    parts.push(
      `width:${safeNumber(style.width, 100, 10, 100)}%`,
      `border-radius:${safeNumber(style.borderRadius, 16, 0, 80)}px`,
    );
  }
  if (element.type === 'spacer') parts.push(`height:${safeNumber(style.padding, 24, 0, 240)}px`);
  return parts.join(';');
}

function renderElement(element: MobileWebsiteElement, section: MobileWebsiteSection, pages: MobileWebsitePage[]) {
  const content = trimText(element.content, 10000);
  const style = elementInlineStyle(element, safeColor(section.accent, '#7c3aed'));
  if (element.type === 'heading') return `<h2 class="el heading" style="${style}">${escapeHtml(content)}</h2>`;
  if (element.type === 'text') return `<p class="el text" style="${style}">${escapeHtml(content)}</p>`;
  if (element.type === 'button') return `<a class="el button" style="${style}" href="${escapeHtml(safeHref(element.href, pages))}">${escapeHtml(content || 'Learn More')}</a>`;
  if (element.type === 'image') {
    const src = safeImageSrc(element.src);
    return src ? `<img class="el image" style="${style}" src="${escapeHtml(src)}" alt="${escapeHtml(content || 'Image')}" loading="lazy">` : '';
  }
  if (element.type === 'list') {
    const items = content.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 40);
    return `<ul class="el list" style="${style}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }
  if (element.type === 'divider') return `<div class="el divider" style="background:${safeColor(styleObject(element).backgroundColor, safeColor(section.accent, '#7c3aed'))}"></div>`;
  if (element.type === 'spacer') return `<div class="el spacer" style="${style}" aria-hidden="true"></div>`;
  return '';
}

function renderFormField(raw: Record<string, unknown>) {
  const name = trimText(raw.name, 80).replace(/[^a-zA-Z0-9_-]/g, '') || 'field';
  const label = trimText(raw.label, 120) || name;
  const placeholder = trimText(raw.placeholder, 200);
  const type = ['text', 'email', 'tel', 'number', 'textarea', 'select'].includes(String(raw.type)) ? String(raw.type) : 'text';
  const required = raw.required === true ? ' required' : '';
  if (type === 'textarea') {
    return `<label>${escapeHtml(label)}<textarea name="${escapeHtml(name)}" placeholder="${escapeHtml(placeholder)}" maxlength="2000"${required}></textarea></label>`;
  }
  if (type === 'select') {
    const options = Array.isArray(raw.options) ? raw.options.map((item) => trimText(item, 120)).filter(Boolean).slice(0, 40) : [];
    return `<label>${escapeHtml(label)}<select name="${escapeHtml(name)}"${required}><option value="">Select</option>${options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('')}</select></label>`;
  }
  return `<label>${escapeHtml(label)}<input name="${escapeHtml(name)}" type="${type}" placeholder="${escapeHtml(placeholder)}" maxlength="500"${required}></label>`;
}

function renderContactForm(section: MobileWebsiteSection, projectId: string, pages: MobileWebsitePage[]) {
  const fields = Array.isArray(section.formFields) && section.formFields.length
    ? section.formFields.filter((field): field is Record<string, unknown> => Boolean(field && typeof field === 'object' && !Array.isArray(field))).slice(0, 20)
    : [
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'message', label: 'Message', type: 'textarea', required: true },
      ];
  const submit = (section.elements || []).find((element) => element.type === 'button');
  const success = trimText(section.formSuccessMessage, 500) || 'Thanks! Your message has been sent.';
  const redirect = section.formSuccessAction === 'redirect' ? safeHref(section.formRedirectUrl, pages) : '';
  return `<form class="contact-form" data-tayar-lead-form data-success-message="${escapeHtml(success)}" data-redirect-url="${escapeHtml(redirect)}">
<label class="honeypot" aria-hidden="true">Company<input name="_tayar_company" tabindex="-1" autocomplete="off"></label>
${fields.map(renderFormField).join('\n')}
<button type="submit">${escapeHtml(trimText(submit?.content, 100) || section.buttonText || 'Send Message')}</button>
<p class="form-status" data-form-status aria-live="polite"></p>
</form>`;
}

function renderSection(section: MobileWebsiteSection, projectId: string, pages: MobileWebsitePage[]) {
  const background = safeColor(section.background, '#111827');
  const accent = safeColor(section.accent, '#7c3aed');
  const columns = section.layout === 'three-column' ? 3 : section.layout === 'two-column' ? 2 : 1;
  const elements = (section.elements || []).filter((element) => element.type !== 'button' || section.type !== 'contact');
  const body = elements.map((element) => renderElement(element, section, pages)).join('\n');
  const form = section.type === 'contact' ? renderContactForm(section, projectId, pages) : '';
  return `<section id="${escapeHtml(trimText(section.anchorId, 80) || section.type || section.id)}" class="section" style="background:${background};--accent:${accent};--columns:${columns};--gap:${safeNumber(section.layoutGap, 20, 0, 80)}px">
<div class="section-inner">${body}${form}</div>
</section>`;
}

function buildLeadScript(projectId: string) {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  if (!supabaseUrl || !publishableKey) return '';
  const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/submit_website_form`;
  return `<script>(()=>{const endpoint=${JSON.stringify(endpoint)};const key=${JSON.stringify(publishableKey)};const projectId=${JSON.stringify(projectId)};document.querySelectorAll('[data-tayar-lead-form]').forEach((form)=>{form.addEventListener('submit',async(event)=>{event.preventDefault();const status=form.querySelector('[data-form-status]');const button=form.querySelector('button[type="submit"]');const values={};new FormData(form).forEach((value,name)=>{if(typeof value==='string')values[name]=value.slice(0,2000)});if(button)button.disabled=true;if(status)status.textContent='Sending…';try{const response=await fetch(endpoint,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({p_project_id:projectId,p_form_data:values,p_page_path:(location.pathname+location.search).slice(0,500)})});if(!response.ok)throw new Error('Lead submission failed');if(status)status.textContent=form.dataset.successMessage||'Thanks! Your message has been sent.';form.reset();const redirect=form.dataset.redirectUrl||'';if(redirect&&redirect!=='#')setTimeout(()=>location.assign(redirect),500)}catch{if(status)status.textContent='Could not send your message. Please try again.'}finally{if(button)button.disabled=false}})})})();</script>`;
}

function pageFileName(page: MobileWebsitePage, homePageId: string) {
  return page.id === homePageId ? 'index.html' : `${safeSlug(page.slug, 'page')}.html`;
}

function buildPageHtml(content: MobileWebsiteContent, page: MobileWebsitePage, projectId: string) {
  const theme = content.theme && typeof content.theme === 'object' ? content.theme as Record<string, unknown> : {};
  const header = content.headerConfig && typeof content.headerConfig === 'object' ? content.headerConfig as Record<string, unknown> : {};
  const footer = content.footerConfig && typeof content.footerConfig === 'object' ? content.footerConfig as Record<string, unknown> : {};
  const title = trimText(page.seoTitle, 180) || trimText(content.seo.title, 180) || trimText(content.siteName, 120) || 'Website';
  const description = trimText(page.seoDescription, 500) || trimText(content.seo.description, 500);
  const primary = safeColor(theme.primaryColor, safeColor(content.brand.colors.primary, '#7c3aed'));
  const background = safeColor(theme.backgroundColor, '#020617');
  const foreground = safeColor(theme.textColor, '#ffffff');
  const muted = safeColor(theme.mutedTextColor, '#cbd5e1');
  const maxWidth = safeNumber(theme.contentWidth, 1120, 680, 1600);
  const buttonRadius = safeNumber(theme.buttonRadius, 12, 0, 80);
  const font = safeFont(theme.fontFamily);
  const brand = trimText(header.brandText, 120) || trimText(content.brand.name, 120) || trimText(content.siteName, 120);
  const nav = content.pages.filter((candidate) => candidate.showInNavigation !== false).map((candidate) => `<a href="${escapeHtml(pageFileName(candidate, content.homePageId))}">${escapeHtml(candidate.name)}</a>`).join('');
  const headerHtml = header.enabled === false ? '' : `<header><div class="topbar"><a class="brand" href="index.html">${escapeHtml(brand)}</a><nav>${nav}</nav></div></header>`;
  const footerText = trimText(footer.text, 500) || `© ${new Date().getFullYear()} ${brand}`;
  const footerHtml = footer.enabled === false ? '' : `<footer><div class="footer-inner"><strong>${escapeHtml(brand)}</strong><span>${escapeHtml(footerText)}</span></div></footer>`;
  const lang = trimText(page.language, 12) || trimText(content.language, 12) || 'en';
  const dir = lang.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr';
  return `<!doctype html><html lang="${escapeHtml(lang)}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><style>
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:${background};color:${foreground};font-family:${font};line-height:1.55}a{color:inherit}.topbar,.section-inner,.footer-inner{width:min(${maxWidth}px,calc(100% - 32px));margin:auto}.topbar{min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-weight:900;text-decoration:none}nav{display:flex;flex-wrap:wrap;gap:18px}nav a{text-decoration:none;color:${muted};font-size:14px}.section{padding:80px 0}.section-inner{display:grid;grid-template-columns:repeat(var(--columns),minmax(0,1fr));gap:var(--gap);align-items:center}.el{grid-column:1/-1;margin:0}.heading{line-height:1.08}.text{color:${muted}}.button{display:inline-block;justify-self:center;text-decoration:none;border:0}.image{display:block;max-width:100%;height:auto;margin:auto}.list{max-width:720px;margin:auto}.divider{height:1px;width:100%;opacity:.35}.contact-form{grid-column:1/-1;width:min(680px,100%);margin:20px auto 0;display:grid;gap:13px;padding:20px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04)}.contact-form label{display:grid;gap:6px;font-size:13px;color:${muted}}.contact-form input,.contact-form textarea,.contact-form select{width:100%;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(0,0,0,.18);color:${foreground};padding:12px;font:inherit}.contact-form textarea{min-height:120px;resize:vertical}.contact-form button{border:0;border-radius:${buttonRadius}px;background:${primary};color:#fff;padding:13px 18px;font-weight:800}.honeypot{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important}.form-status{min-height:20px;color:${muted};font-size:13px}footer{padding:28px 0;border-top:1px solid rgba(255,255,255,.1)}.footer-inner{display:flex;justify-content:space-between;gap:16px;color:${muted};font-size:13px}@media(max-width:720px){.topbar{align-items:flex-start;padding:16px 0;flex-direction:column}nav{gap:12px}.section{padding:52px 0}.section-inner{grid-template-columns:1fr!important}.footer-inner{flex-direction:column}}
</style></head><body>${headerHtml}<main>${page.sections.map((section) => renderSection(section, projectId, content.pages)).join('')}</main>${footerHtml}${buildLeadScript(projectId)}</body></html>`;
}

function assertPublishReady(content: MobileWebsiteContent) {
  if (!content.pages.length) throw new Error('Add at least one page before publishing.');
  const slugs = new Set<string>();
  let homeFound = false;
  for (const page of content.pages) {
    if (!page.id) throw new Error('A page has an invalid ID.');
    if (page.id === content.homePageId) homeFound = true;
    const slug = safeSlug(page.slug, '');
    if (!slug) throw new Error(`${page.name || 'Page'} needs a valid slug.`);
    if (slugs.has(slug)) throw new Error(`Duplicate page slug: ${slug}.`);
    slugs.add(slug);
    if (!page.sections.length) throw new Error(`${page.name || 'Page'} has no sections.`);
    for (const section of page.sections) {
      if (Array.isArray(section.containers) && section.containers.length) {
        throw new Error('This website uses advanced containers. Publish it from the web editor until native advanced-layout export is added.');
      }
      for (const element of section.elements || []) {
        if (!SUPPORTED_ELEMENT_TYPES.has(element.type)) {
          throw new Error(`The ${element.type || 'unknown'} element needs the advanced web renderer. Mobile publish was blocked to protect the live design.`);
        }
        if (!element.id) throw new Error('An element has an invalid ID.');
      }
    }
  }
  if (!homeFound) throw new Error('Choose a valid home page before publishing.');
}

function assertValidBundle(files: PublishedFile[]) {
  if (!files.length) throw new Error('Published website bundle is empty.');
  const seen = new Set<string>();
  let hasIndex = false;
  for (const file of files) {
    if (!file.name || file.name.startsWith('/') || file.name.includes('\\') || file.name.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('Published website bundle contains an invalid path.');
    if (seen.has(file.name)) throw new Error(`Published website bundle contains duplicate file: ${file.name}.`);
    seen.add(file.name);
    if (file.name === 'index.html') {
      hasIndex = true;
      if (!/^\s*<!doctype\s+html/i.test(file.content) && !/^\s*<html/i.test(file.content)) throw new Error('Published index.html is not valid HTML.');
    }
  }
  if (!hasIndex) throw new Error('Published website bundle is missing index.html.');
}

function buildBundle(project: MobileWebsiteProjectRow) {
  assertPublishReady(project.content);
  const files: PublishedFile[] = project.content.pages.map((page) => ({
    name: pageFileName(page, project.content.homePageId),
    content: buildPageHtml(project.content, page, project.id),
    contentType: 'text/html; charset=utf-8',
  }));
  const appOrigin = (process.env.EXPO_PUBLIC_APP_URL || 'https://tayar.se').replace(/\/+$/, '');
  const base = `${appOrigin}/site/${encodeURIComponent(project.user_id)}/${encodeURIComponent(project.id)}`;
  const sitemap = project.content.pages.filter((page) => page.noIndex !== true).map((page) => `  <url><loc>${escapeHtml(`${base}/${pageFileName(page, project.content.homePageId)}`)}</loc></url>`).join('\n');
  files.push(
    { name: '404.html', content: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found</title></head><body style="font-family:Arial;background:#07070f;color:#fff;display:grid;place-items:center;min-height:100vh"><main><h1>404</h1><p>Page not found.</p><a style="color:#c4b5fd" href="index.html">Back home</a></main></body></html>', contentType: 'text/html; charset=utf-8' },
    { name: 'sitemap.xml', content: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap}\n</urlset>`, contentType: 'application/xml; charset=utf-8' },
    { name: 'robots.txt', content: `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`, contentType: 'text/plain; charset=utf-8' },
  );
  assertValidBundle(files);
  return { files, base, publishedUrl: `${base}/index.html` };
}

async function listLiveFiles(folder: string) {
  const result: Array<{ name: string; id?: string | null }> = [];
  const pageSize = 100;
  for (let offset = 0; offset < 500; offset += pageSize) {
    const { data, error } = await storage.list(folder, { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`Published storage is unavailable: ${error.message}`);
    const batch = data || [];
    result.push(...batch.filter((item) => Boolean(item.id) && Boolean(item.name)).map((item) => ({ name: item.name, id: item.id })));
    if (batch.length < pageSize) return result;
  }
  throw new Error('Published-site folder contains too many files to process safely.');
}

async function snapshotLive(folder: string): Promise<PublishedSnapshot> {
  const entries = await listLiveFiles(folder);
  if (entries.length > 250) throw new Error('Published-site folder contains too many live files to replace safely.');
  const snapshot: PublishedSnapshot = new Map();
  for (const entry of entries) {
    const { data, error } = await storage.download(`${folder}/${entry.name}`);
    if (error || !data) throw new Error(`Could not create a safe pre-publish backup for ${entry.name}${error?.message ? `: ${error.message}` : '.'}`);
    snapshot.set(entry.name, { body: await data.arrayBuffer(), contentType: data.type || 'application/octet-stream' });
  }
  return snapshot;
}

async function uploadText(path: string, content: string, contentType: string) {
  const body = new TextEncoder().encode(content).buffer;
  const { error } = await storage.upload(path, body, { upsert: true, contentType, cacheControl: '0' });
  if (error) throw new Error(`Could not publish ${path.split('/').pop()}: ${error.message}`);
}

async function removePaths(paths: string[]) {
  if (!paths.length) return;
  const { error } = await storage.remove(paths);
  if (error) throw new Error(error.message || 'Published-site cleanup failed.');
}

async function restoreSnapshot(folder: string, snapshot: PublishedSnapshot) {
  const rollbackErrors: string[] = [];
  for (const [name, file] of snapshot) {
    const { error } = await storage.upload(`${folder}/${name}`, file.body, { upsert: true, contentType: file.contentType, cacheControl: '0' });
    if (error) rollbackErrors.push(`${name}: ${error.message}`);
  }
  try {
    const current = await listLiveFiles(folder);
    await removePaths(current.filter((item) => !snapshot.has(item.name)).map((item) => `${folder}/${item.name}`));
  } catch (error) {
    rollbackErrors.push(error instanceof Error ? error.message : 'new file cleanup failed');
  }
  if (rollbackErrors.length) throw new Error(rollbackErrors.join('; '));
}

async function replaceLive(folder: string, files: PublishedFile[], snapshot: PublishedSnapshot) {
  const liveNames = new Set(files.map((file) => file.name));
  try {
    for (const file of files) await uploadText(`${folder}/${file.name}`, file.content, file.contentType);
    const { data, error } = await storage.download(`${folder}/index.html`);
    if (error || !data || data.size <= 0) throw new Error(`Live index could not be verified${error?.message ? `: ${error.message}` : '.'}`);
    const html = await data.text();
    if (!/^\s*(?:<!doctype\s+html[^>]*>\s*)?<html\b/i.test(html.slice(0, 4096))) throw new Error('Uploaded index.html is not a valid HTML document.');
    const existing = await listLiveFiles(folder);
    await removePaths(existing.filter((item) => !liveNames.has(item.name)).map((item) => `${folder}/${item.name}`));
  } catch (error) {
    await restoreSnapshot(folder, snapshot);
    throw new Error(`${error instanceof Error ? error.message : 'Published-site replacement failed.'} The previous live website was restored automatically.`);
  }
}

async function verifyPublicRoute(url: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const separator = url.includes('?') ? '&' : '?';
      const response = await fetch(`${url}${separator}t=${Date.now()}`, { headers: { Accept: 'text/html' } });
      if (response.ok) {
        const html = await response.text();
        if (/^\s*(?:<!doctype\s+html[^>]*>\s*)?<html\b/i.test(html.slice(0, 4096))) return true;
      }
    } catch {
      // Retry below.
    }
    await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1)));
  }
  return false;
}

function fingerprint(content: MobileWebsiteContent) {
  const raw = JSON.stringify(content);
  let hash = 0x811c9dc5;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export async function publishMobileWebsiteProject(project: MobileWebsiteProjectRow, currentUserId: string) {
  if (!currentUserId || project.user_id !== currentUserId) throw new Error('Only the project owner can publish this website from mobile.');
  const { files, publishedUrl } = buildBundle(project);
  const folder = `${currentUserId}/${project.id}`;
  const savedAt = new Date().toISOString();
  const preSaveContent = { ...project.content, updatedAt: savedAt };
  const { error: saveError } = await supabase.from('projects').update({ title: project.title.trim().slice(0, 120) || 'Website', content: preSaveContent, updated_at: savedAt }).eq('id', project.id).eq('user_id', currentUserId);
  if (saveError) throw new Error(`The latest editor changes could not be synchronized before publishing: ${saveError.message}`);

  const snapshot = await snapshotLive(folder);
  let liveReplaced = false;
  try {
    await replaceLive(folder, files, snapshot);
    liveReplaced = true;
    if (!await verifyPublicRoute(publishedUrl)) throw new Error('The website files were uploaded, but the public renderer did not return a valid HTML page.');
    const publishedAt = new Date().toISOString();
    const projectContent: MobileWebsiteContent = {
      ...preSaveContent,
      publishedUrl,
      publishedAt,
      lastPublishedVersionId: null,
      lastPublishedFingerprint: fingerprint(preSaveContent),
      updatedAt: publishedAt,
    };
    const { error: projectError } = await supabase.from('projects').update({ content: projectContent, status: 'completed', updated_at: publishedAt }).eq('id', project.id).eq('user_id', currentUserId);
    if (projectError) throw new Error(`The site is uploaded, but the project publish state could not be saved: ${projectError.message}`);
    return { ...project, content: projectContent, status: 'completed', updated_at: publishedAt } satisfies MobileWebsiteProjectRow;
  } catch (error) {
    let message = error instanceof Error ? error.message : 'Could not publish this website.';
    if (liveReplaced) {
      try {
        await restoreSnapshot(folder, snapshot);
        message += ' The previous live website was restored automatically.';
      } catch (rollbackError) {
        message += ` Automatic rollback needs support review: ${rollbackError instanceof Error ? rollbackError.message : 'unknown rollback error'}`;
      }
    }
    throw new Error(message);
  }
}

export async function unpublishMobileWebsiteProject(project: MobileWebsiteProjectRow, currentUserId: string) {
  if (!currentUserId || project.user_id !== currentUserId) throw new Error('Only the project owner can unpublish this website from mobile.');
  const folder = `${currentUserId}/${project.id}`;
  const snapshot = await snapshotLive(folder);
  let removalStarted = false;
  try {
    const live = await listLiveFiles(folder);
    removalStarted = true;
    await removePaths(live.map((item) => `${folder}/${item.name}`));
    const updatedAt = new Date().toISOString();
    const projectContent: MobileWebsiteContent = {
      ...project.content,
      publishedUrl: '',
      publishedAt: null,
      lastPublishedVersionId: null,
      lastPublishedFingerprint: '',
      updatedAt,
    };
    const { error } = await supabase.from('projects').update({ content: projectContent, status: 'draft', updated_at: updatedAt }).eq('id', project.id).eq('user_id', currentUserId);
    if (error) throw error;
    return { ...project, content: projectContent, status: 'draft', updated_at: updatedAt } satisfies MobileWebsiteProjectRow;
  } catch (error) {
    let message = error instanceof Error ? error.message : 'Could not unpublish this website.';
    if (removalStarted) {
      try {
        await restoreSnapshot(folder, snapshot);
        message += ' The public website was restored automatically.';
      } catch (rollbackError) {
        message += ` Automatic rollback needs support review: ${rollbackError instanceof Error ? rollbackError.message : 'unknown rollback error'}`;
      }
    }
    throw new Error(message);
  }
}
