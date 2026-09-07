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

function pageFileName(page: MobileWebsitePage, homePageId: string) {
  return page.id === homePageId ? 'index.html' : `${safeSlug(page.slug, 'page')}.html`;
}

function safeHttpUrl(value: unknown) {
  const url = trimText(value, 3000);
  return /^https?:\/\/[^\s<>"']+$/i.test(url) ? url : '';
}

function safeHref(value: unknown, pages: MobileWebsitePage[], homePageId: string) {
  const href = trimText(value, 1000);
  if (!href) return '#';
  if (href.startsWith('#')) return href.replace(/[^#a-zA-Z0-9_-]/g, '');
  if (href.startsWith('page:')) {
    const slug = safeSlug(href.slice(5), 'home');
    const page = pages.find((candidate) => safeSlug(candidate.slug, 'home') === slug);
    if (!page) return '#';
    return pageFileName(page, homePageId);
  }
  if (/^(?:https?:\/\/|mailto:|tel:)/i.test(href)) return href;
  return '#';
}

function safeImageSrc(value: unknown) {
  return safeHttpUrl(value);
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

function renderElement(element: MobileWebsiteElement, section: MobileWebsiteSection, pages: MobileWebsitePage[], homePageId: string) {
  const content = trimText(element.content, 10000);
  const style = elementInlineStyle(element, safeColor(section.accent, '#7c3aed'));
  if (element.type === 'heading') return `<h2 class="el heading" style="${style}">${escapeHtml(content)}</h2>`;
  if (element.type === 'text') return `<p class="el text" style="${style}">${escapeHtml(content)}</p>`;
  if (element.type === 'button') return `<a class="el button" style="${style}" href="${escapeHtml(safeHref(element.href, pages, homePageId))}">${escapeHtml(content || 'Learn More')}</a>`;
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

function renderContactForm(section: MobileWebsiteSection, projectId: string, pages: MobileWebsitePage[], homePageId: string) {
  const fields = Array.isArray(section.formFields) && section.formFields.length
    ? section.formFields.filter((field): field is Record<string, unknown> => Boolean(field && typeof field === 'object' && !Array.isArray(field))).slice(0, 20)
    : [
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'message', label: 'Message', type: 'textarea', required: true },
      ];
  const submit = (section.elements || []).find((element) => element.type === 'button');
  const success = trimText(section.formSuccessMessage, 500) || 'Thanks! Your message has been sent.';
  const redirect = section.formSuccessAction === 'redirect' ? safeHref(section.formRedirectUrl, pages, homePageId) : '';
  return `<form class="contact-form" data-tayar-lead-form data-success-message="${escapeHtml(success)}" data-redirect-url="${escapeHtml(redirect)}">
<label class="honeypot" aria-hidden="true">Company<input name="_tayar_company" tabindex="-1" autocomplete="off"></label>
${fields.map(renderFormField).join('\n')}
<button type="submit">${escapeHtml(trimText(submit?.content, 100) || section.buttonText || 'Send Message')}</button>
<p class="form-status" data-form-status aria-live="polite"></p>
</form>`;
}

function renderSection(section: MobileWebsiteSection, projectId: string, pages: MobileWebsitePage[], homePageId: string) {
  const background = safeColor(section.background, '#111827');
  const accent = safeColor(section.accent, '#7c3aed');
  const columns = section.layout === 'three-column' ? 3 : section.layout === 'two-column' ? 2 : 1;
  const elements = (section.elements || []).filter((element) => element.type !== 'button' || section.type !== 'contact');
  const body = elements.map((element) => renderElement(element, section, pages, homePageId)).join('\n');
  const form = section.type === 'contact' ? renderContactForm(section, projectId, pages, homePageId) : '';
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

function publishedPageUrl(page: MobileWebsitePage, homePageId: string, base: string) {
  return `${base}/${pageFileName(page, homePageId)}`;
}

function canonicalPageUrl(page: MobileWebsitePage, homePageId: string, base: string) {
  return safeHttpUrl(page.canonicalUrl) || publishedPageUrl(page, homePageId, base);
}

function buildPageHtml(content: MobileWebsiteContent, page: MobileWebsitePage, projectId: string, pageUrl: string) {
  const theme = content.theme && typeof content.theme === 'object' ? content.theme as Record<string, unknown> : {};
  const header = content.headerConfig && typeof content.headerConfig === 'object' ? content.headerConfig as Record<string, unknown> : {};
  const footer = content.footerConfig && typeof content.footerConfig === 'object' ? content.footerConfig as Record<string, unknown> : {};
  const title = trimText(page.seoTitle, 180) || trimText(content.seo.title, 180) || trimText(content.siteName, 120) || 'Website';
  const description = trimText(page.seoDescription, 500) || trimText(content.seo.description, 500);
  const keywords = Array.isArray(content.seo.keywords) ? content.seo.keywords.map((value) => trimText(value, 80)).filter(Boolean).slice(0, 30) : [];
  const primary = safeColor(theme.primaryColor, safeColor(content.brand.colors.primary, '#7c3aed'));
  const background = safeColor(theme.backgroundColor, '#020617');
  const foreground = safeColor(theme.textColor, '#ffffff');
  const muted = safeColor(theme.mutedTextColor, '#cbd5e1');
  const maxWidth = safeNumber(theme.contentWidth, 1120, 680, 1600);
  const buttonRadius = safeNumber(theme.buttonRadius, 12, 0, 80);
  const font = safeFont(theme.fontFamily);
  const brand = trimText(header.brandText, 120) || trimText(content.brand.name, 120) || trimText(content.siteName, 120);
  const logo = safeImageSrc(header.logoUrl);
  const favicon = safeImageSrc(content.faviconUrl);
  const socialImage = safeImageSrc(page.socialImage);
  const canonical = safeHttpUrl(page.canonicalUrl) || pageUrl;
  const nav = content.pages.filter((candidate) => candidate.showInNavigation !== false).map((candidate) => `<a href="${escapeHtml(pageFileName(candidate, content.homePageId))}">${escapeHtml(candidate.name)}</a>`).join('');
  const ctaLabel = trimText(header.ctaLabel, 120);
  const ctaHref = safeHref(header.ctaHref, content.pages, content.homePageId);
  const cta = header.showCta === false || !ctaLabel ? '' : `<a class="header-cta" href="${escapeHtml(ctaHref)}">${escapeHtml(ctaLabel)}</a>`;
  const brandMarkup = `${logo ? `<img class="brand-logo" src="${escapeHtml(logo)}" alt="">` : ''}<span>${escapeHtml(brand)}</span>`;
  const headerHtml = header.enabled === false ? '' : `<header class="site-header"><div class="topbar"><a class="brand" href="index.html">${brandMarkup}</a><div class="header-actions"><nav>${nav}</nav>${cta}</div></div></header>`;
  const footerText = trimText(footer.text, 500) || `© ${new Date().getFullYear()} ${brand}`;
  const footerNav = footer.showNavigation === false ? '' : `<nav class="footer-nav">${nav}</nav>`;
  const socialLinks = [
    ['Facebook', footer.facebookUrl],
    ['Instagram', footer.instagramUrl],
    ['LinkedIn', footer.linkedinUrl],
    ['X', footer.xUrl],
  ].map(([label, raw]) => {
    const url = safeHttpUrl(raw);
    return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : '';
  }).filter(Boolean).join('');
  const footerSocial = socialLinks ? `<div class="footer-social">${socialLinks}</div>` : '';
  const footerHtml = footer.enabled === false ? '' : `<footer><div class="footer-inner"><div class="footer-brand"><strong>${escapeHtml(brand)}</strong><span>${escapeHtml(footerText)}</span></div><div class="footer-links">${footerNav}${footerSocial}</div></div></footer>`;
  const lang = trimText(page.language, 12) || trimText(content.language, 12) || 'en';
  const dir = lang.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr';
  const headerBackground = safeColor(header.backgroundColor, background);
  const headerText = safeColor(header.textColor, foreground);
  const headerBorder = safeColor(header.borderColor, '#ffffff18');
  const headerCtaBackground = safeColor(header.ctaBackgroundColor, primary);
  const headerCtaText = safeColor(header.ctaTextColor, '#ffffff');
  const headerSticky = header.sticky === true ? 'position:sticky;top:0;z-index:20;' : '';
  const navGap = safeNumber(header.navGap, 18, 4, 64);
  const navSize = safeNumber(header.navSize, 14, 10, 28);
  const brandSize = safeNumber(header.brandSize, 20, 12, 44);
  const metadata = [
    `<meta name="description" content="${escapeHtml(description)}">`,
    keywords.length ? `<meta name="keywords" content="${escapeHtml(keywords.join(', '))}">` : '',
    page.noIndex === true ? '<meta name="robots" content="noindex,follow">' : '',
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    favicon ? `<link rel="icon" href="${escapeHtml(favicon)}">` : '',
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta property="og:site_name" content="${escapeHtml(content.siteName || brand)}">`,
    socialImage ? `<meta property="og:image" content="${escapeHtml(socialImage)}">` : '',
    `<meta name="twitter:card" content="${socialImage ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    socialImage ? `<meta name="twitter:image" content="${escapeHtml(socialImage)}">` : '',
  ].filter(Boolean).join('');
  return `<!doctype html><html lang="${escapeHtml(lang)}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>${metadata}<style>
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:${background};color:${foreground};font-family:${font};line-height:1.55}a{color:inherit}.site-header{${headerSticky}background:${headerBackground};color:${headerText};border-bottom:1px solid ${headerBorder};backdrop-filter:blur(12px)}.topbar,.section-inner,.footer-inner{width:min(${maxWidth}px,calc(100% - 32px));margin:auto}.topbar{min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:10px;font-size:${brandSize}px;font-weight:900;text-decoration:none}.brand-logo{width:34px;height:34px;object-fit:contain;border-radius:8px}.header-actions{display:flex;align-items:center;gap:18px}nav{display:flex;flex-wrap:wrap;gap:${navGap}px}nav a{text-decoration:none;color:${muted};font-size:${navSize}px}.header-cta{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border-radius:${buttonRadius}px;background:${headerCtaBackground};color:${headerCtaText};padding:10px 16px;font-weight:800;white-space:nowrap}.section{padding:80px 0}.section-inner{display:grid;grid-template-columns:repeat(var(--columns),minmax(0,1fr));gap:var(--gap);align-items:center}.el{grid-column:1/-1;margin:0}.heading{line-height:1.08}.text{color:${muted}}.button{display:inline-block;justify-self:center;text-decoration:none;border:0}.image{display:block;max-width:100%;height:auto;margin:auto}.list{max-width:720px;margin:auto}.divider{height:1px;width:100%;opacity:.35}.contact-form{grid-column:1/-1;width:min(680px,100%);margin:20px auto 0;display:grid;gap:13px;padding:20px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04)}.contact-form label{display:grid;gap:6px;font-size:13px;color:${muted}}.contact-form input,.contact-form textarea,.contact-form select{width:100%;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(0,0,0,.18);color:${foreground};padding:12px;font:inherit}.contact-form textarea{min-height:120px;resize:vertical}.contact-form button{border:0;border-radius:${buttonRadius}px;background:${primary};color:#fff;padding:13px 18px;font-weight:800}.honeypot{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important}.form-status{min-height:20px;color:${muted};font-size:13px}footer{padding:28px 0;border-top:1px solid rgba(255,255,255,.1)}.footer-inner{display:flex;justify-content:space-between;gap:24px;color:${muted};font-size:13px}.footer-brand,.footer-links{display:flex;flex-direction:column;gap:10px}.footer-nav,.footer-social{display:flex;flex-wrap:wrap;gap:14px}.footer-nav a,.footer-social a{text-decoration:none;color:${muted};font-size:13px}@media(max-width:720px){.topbar{align-items:flex-start;padding:16px 0;flex-direction:column}.header-actions{width:100%;align-items:flex-start;flex-direction:column}nav{gap:12px}.header-cta{width:100%}.section{padding:52px 0}.section-inner{grid-template-columns:1fr!important}.footer-inner{flex-direction:column}}
</style></head><body>${headerHtml}<main>${page.sections.map((section) => renderSection(section, projectId, content.pages, content.homePageId)).join('')}</main>${footerHtml}${buildLeadScript(projectId)}</body></html>`;
}

function hasMeaningfulObjectValues(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).some((entry) => {
    if (entry === undefined || entry === null || entry === '') return false;
    if (typeof entry === 'object' && !Array.isArray(entry)) return hasMeaningfulObjectValues(entry);
    return true;
  });
}

function numericValue(value: unknown): number | null {
  if (value === undefined || value === null || value === '' || typeof value === 'boolean') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nonZeroNumber(value: unknown) {
  const parsed = numericValue(value);
  return parsed !== null && Math.abs(parsed) > 0.0001;
}

function unsupportedSectionFeature(section: MobileWebsiteSection) {
  const source = section as Record<string, unknown>;
  const backgroundMode = trimText(source.backgroundMode, 20).toLowerCase();
  if (backgroundMode && backgroundMode !== 'color') return `${backgroundMode} section background`;
  if (hasMeaningfulObjectValues(source.responsive)) return 'responsive section overrides';
  if (section.layout !== 'stack') return `${section.layout} column layout`;
  if (section.layoutAlign && section.layoutAlign !== 'center') return `${section.layoutAlign} layout alignment`;
  if (source.contentWidth === 'full') return 'full-width section content';
  if ((numericValue(source.minHeight) || 0) > 0) return 'custom section minimum height';
  if (numericValue(source.sectionPaddingY) !== null) return 'custom vertical section padding';
  if (numericValue(source.sectionPaddingX) !== null) return 'custom horizontal section padding';
  if ((numericValue(source.sectionRadius) || 0) > 0) return 'section corner radius';
  if (nonZeroNumber(source.overlayOpacity)) return 'section background overlay';
  return '';
}

function unsupportedElementFeature(element: MobileWebsiteElement) {
  const source = element as Record<string, unknown>;
  const style = styleObject(element);
  if (hasMeaningfulObjectValues(source.responsive)) return 'responsive element overrides';
  if (nonZeroNumber(source.layoutColumn)) return 'explicit column placement';
  if (trimText(source.containerId, 120)) return 'container placement';
  if (trimText(source.symbolId, 120)) return 'symbol/component binding';
  if (style.hidden === true) return 'hidden-state styling';
  if (numericValue(style.maxWidth) !== null) return 'custom maximum width';
  if ([style.marginTop, style.marginRight, style.marginBottom, style.marginLeft].some(nonZeroNumber)) return 'custom margins';
  if ([style.positionX, style.positionY].some(nonZeroNumber)) return 'free-position coordinates';
  if (nonZeroNumber(style.order)) return 'custom element ordering';
  if (trimText(style.alignSelf, 20) && trimText(style.alignSelf, 20) !== 'auto') return 'custom self-alignment';
  if ((numericValue(style.columnSpan) || 0) > 1) return 'multi-column span';
  if (numericValue(style.lineHeight) !== null) return 'custom line height';
  if (nonZeroNumber(style.letterSpacing)) return 'custom letter spacing';
  if (nonZeroNumber(style.rotate)) return 'rotation';
  if ((numericValue(style.borderWidth) || 0) > 0) return 'custom border';
  if (trimText(style.shadow, 20) && trimText(style.shadow, 20) !== 'none') return 'box shadow';
  const hoverScale = numericValue(style.hoverScale);
  if (hoverScale !== null && Math.abs(hoverScale - 1) > 0.0001) return 'hover scale';
  const hoverOpacity = numericValue(style.hoverOpacity);
  if (hoverOpacity !== null && Math.abs(hoverOpacity - 1) > 0.0001) return 'hover opacity';
  if (trimText(style.hoverBackgroundColor, 32) || trimText(style.hoverColor, 32)) return 'hover colors';
  if (trimText(style.hoverShadow, 20) && trimText(style.hoverShadow, 20) !== 'none') return 'hover shadow';
  if (trimText(style.animation, 30) && trimText(style.animation, 30) !== 'none') return 'element animation';

  const width = numericValue(style.width);
  if (width !== null && element.type !== 'image' && !(element.type === 'divider' && Math.abs(width - 100) < 0.0001)) return 'custom element width';
  const padding = numericValue(style.padding);
  if (padding !== null && Math.abs(padding) > 0.0001 && element.type !== 'button' && element.type !== 'spacer') return 'custom element padding';
  const radius = numericValue(style.borderRadius);
  if (radius !== null && radius > 0 && element.type !== 'button' && element.type !== 'image') return 'custom corner radius';
  if (trimText(style.backgroundColor, 32) && element.type !== 'button' && element.type !== 'divider') return 'custom element background';
  const opacity = numericValue(style.opacity);
  if (element.type === 'divider' && opacity !== null && Math.abs(opacity - 0.35) > 0.0001) return 'custom divider opacity';
  return '';
}

function unsupportedFormFeature(section: MobileWebsiteSection) {
  if (!Array.isArray(section.formFields)) return '';
  for (const field of section.formFields) {
    const type = trimText(field?.type, 30).toLowerCase();
    if (type === 'checkbox') return 'checkbox form fields';
  }
  return '';
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
      const sectionFeature = unsupportedSectionFeature(section);
      if (sectionFeature) {
        throw new Error(`Mobile publish stopped to protect the live design: ${page.name || 'Page'} / ${section.type} uses ${sectionFeature}. Publish this version from the web editor.`);
      }
      const formFeature = unsupportedFormFeature(section);
      if (formFeature) {
        throw new Error(`Mobile publish stopped to protect the live design: ${page.name || 'Page'} / ${section.type} uses ${formFeature}. Publish this version from the web editor.`);
      }
      for (const element of section.elements || []) {
        if (!SUPPORTED_ELEMENT_TYPES.has(element.type)) {
          throw new Error(`The ${element.type || 'unknown'} element needs the advanced web renderer. Mobile publish was blocked to protect the live design.`);
        }
        if (!element.id) throw new Error('An element has an invalid ID.');
        const elementFeature = unsupportedElementFeature(element);
        if (elementFeature) {
          throw new Error(`Mobile publish stopped to protect the live design: ${page.name || 'Page'} / ${section.type} / ${element.type} uses ${elementFeature}. Publish this version from the web editor.`);
        }
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
  const appOrigin = (process.env.EXPO_PUBLIC_APP_URL || 'https://tayar.se').replace(/\/+$/, '');
  const base = `${appOrigin}/site/${encodeURIComponent(project.user_id)}/${encodeURIComponent(project.id)}`;
  const files: PublishedFile[] = project.content.pages.map((page) => ({
    name: pageFileName(page, project.content.homePageId),
    content: buildPageHtml(project.content, page, project.id, canonicalPageUrl(page, project.content.homePageId, base)),
    contentType: 'text/html; charset=utf-8',
  }));
  const sitemap = project.content.pages.filter((page) => page.noIndex !== true).map((page) => `  <url><loc>${escapeHtml(canonicalPageUrl(page, project.content.homePageId, base))}</loc></url>`).join('\n');
  files.push(
    { name: '404.html', content: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not found</title></head><body style="font-family:Arial;background:#07070f;color:#fff;display:grid;place-items:center;min-height:100vh"><main><h1>404</h1><p>Page not found.</p><a style="color:#c4b5fd" href="index.html">Back home</a></main></body></html>', contentType: 'text/html; charset=utf-8' },
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

function editableFingerprint(content: MobileWebsiteContent) {
  return JSON.stringify({
    siteName: content.siteName,
    siteUrl: content.siteUrl,
    faviconUrl: content.faviconUrl,
    homePageId: content.homePageId,
    pages: content.pages,
    brand: content.brand,
    theme: content.theme,
    headerConfig: content.headerConfig,
    footerConfig: content.footerConfig,
    siteEnhancements: content.siteEnhancements,
    productionConfig: content.productionConfig,
    symbols: content.symbols,
    seo: content.seo,
    language: content.language,
  });
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
      lastPublishedFingerprint: editableFingerprint(preSaveContent),
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
