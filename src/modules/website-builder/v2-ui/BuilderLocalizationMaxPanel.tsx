import { useMemo, useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-localization-max';
import type { EditorPageLike } from '../core/editor-model';
import type { EditorLocalizationConfig, EditorLocaleDefinition, EditorLocalizedPageContent } from '../core/editor-localization';
import { buildEditorLocalizedPath, resolveEditorLocalizedPageContent } from '../core/editor-localization';

interface Props {
  config: EditorLocalizationConfig;
  pages: EditorPageLike[];
  activePageId: string;
  rootDomain?: string;
  onChange(config: EditorLocalizationConfig): void;
  onTranslatePage?(pageId: string, sourceLocale: string, targetLocale: string): void | Promise<void>;
}

export function BuilderLocalizationMaxPanel({ config, pages, activePageId, rootDomain, onChange, onTranslatePage }: Props) {
  const l = useLocalizer();
  const [localeCode, setLocaleCode] = useState(config.defaultLocale);
  const [translating, setTranslating] = useState(false);
  const locale = config.locales.find(item => item.code === localeCode) ?? config.locales[0];
  const page = pages.find(item => item.id === activePageId) ?? pages[0];
  const content = page && locale ? resolveEditorLocalizedPageContent(config, page.id, locale.code) : undefined;
  const enabled = useMemo(() => config.locales.filter(item => item.enabled), [config.locales]);

  const patchLocale = (code: string, patch: Partial<EditorLocaleDefinition>) => onChange({ ...config, locales: config.locales.map(item => item.code === code ? { ...item, ...patch } : item) });
  const patchContent = (patch: Partial<EditorLocalizedPageContent>) => {
    if (!page || !locale) return;
    const existing = config.pageContent[page.id]?.[locale.code] ?? { locale: locale.code, values: {} };
    onChange({ ...config, pageContent: { ...config.pageContent, [page.id]: { ...(config.pageContent[page.id] ?? {}), [locale.code]: { ...existing, ...patch, updatedAt: new Date().toISOString() } } } });
  };

  if (!locale || !page) return null;
  const localizedPath = buildEditorLocalizedPath(config, page.id, locale.code, String((page as EditorPageLike & { slug?: string }).slug || ''));
  const mappedHost = locale.domain || (locale.subdomain && rootDomain ? `${locale.subdomain}.${rootDomain}` : rootDomain);

  return <section className="builder-v2-card" data-testid="localization-max-panel">
    <div className="builder-v2-card__header"><div><strong>{l('Localization')}</strong><p>{l('Manage multilingual content, routes, SEO, RTL and locale domains.')}</p></div><span>{enabled.length}/{config.locales.length}</span></div>
    <label>{l('Editing language')}<select value={locale.code} onChange={event => setLocaleCode(event.target.value)}>{config.locales.map(item => <option key={item.code} value={item.code}>{item.nativeLabel} ({item.code})</option>)}</select></label>
    <div className="builder-v2-grid">
      <label>{l('Enabled')}<input type="checkbox" checked={locale.enabled} disabled={locale.code === config.defaultLocale} onChange={event => patchLocale(locale.code,{enabled:event.target.checked})}/></label>
      <label>{l('Default language')}<input type="radio" checked={locale.code === config.defaultLocale} onChange={() => onChange({...config,defaultLocale:locale.code,locales:config.locales.map(item=>item.code===locale.code?{...item,enabled:true}:item)})}/></label>
      <label>{l('Direction')}<select value={locale.direction} onChange={event=>patchLocale(locale.code,{direction:event.target.value as 'ltr'|'rtl'})}><option value="ltr">LTR</option><option value="rtl">RTL</option></select></label>
      <label>{l('Fallback language')}<select value={locale.fallbackLocale || ''} onChange={event=>patchLocale(locale.code,{fallbackLocale:event.target.value||undefined})}><option value="">—</option>{config.locales.filter(item=>item.code!==locale.code).map(item=><option key={item.code} value={item.code}>{item.nativeLabel}</option>)}</select></label>
    </div>
    <label>{l('Locale path prefix')}<input value={locale.slugPrefix || ''} placeholder={locale.code} onChange={event=>patchLocale(locale.code,{slugPrefix:event.target.value})}/></label>
    <div className="builder-v2-grid"><label>{l('Custom domain')}<input value={locale.domain || ''} placeholder="example.se" onChange={event=>patchLocale(locale.code,{domain:event.target.value,subdomain:event.target.value?'':locale.subdomain})}/></label><label>{l('Subdomain')}<input value={locale.subdomain || ''} placeholder="sv" onChange={event=>patchLocale(locale.code,{subdomain:event.target.value,domain:event.target.value?'':locale.domain})}/></label></div>
    <div className="builder-v2-card builder-v2-card--nested"><strong>{page.name} · {locale.nativeLabel}</strong><small dir="ltr">{mappedHost ? `https://${mappedHost}` : ''}{localizedPath}</small>
      <label>{l('Localized page name')}<input value={content?.name || ''} onChange={event=>patchContent({name:event.target.value})}/></label>
      <label>{l('Localized slug')}<input value={content?.slug || ''} onChange={event=>patchContent({slug:event.target.value})}/></label>
      <label>{l('SEO title')}<input value={content?.seo?.title || ''} onChange={event=>patchContent({seo:{...content?.seo,title:event.target.value}})}/></label>
      <label>{l('SEO description')}<textarea value={content?.seo?.description || ''} onChange={event=>patchContent({seo:{...content?.seo,description:event.target.value}})}/></label>
      <label>{l('Canonical URL')}<input dir="ltr" value={content?.seo?.canonical || ''} onChange={event=>patchContent({seo:{...content?.seo,canonical:event.target.value}})}/></label>
      {locale.code !== config.defaultLocale && onTranslatePage && <button type="button" disabled={translating} onClick={async()=>{setTranslating(true);try{await onTranslatePage(page.id,config.defaultLocale,locale.code);}finally{setTranslating(false);}}}>{translating?l('Translating…'):l('Translate page with AI')}</button>}
    </div>
  </section>;
}

export default BuilderLocalizationMaxPanel;
