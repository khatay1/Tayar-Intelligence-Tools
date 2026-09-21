import { useEffect, useState } from 'react';
import { usePreferences } from '@/context/PreferencesContext';
import type { EditorPageLike } from '../core/editor-model';
import { normalizeEditorPageSeo, readEditorPageSeo, type EditorPageSeo } from '../core/editor-seo-model';
import { localizeEditorSeo } from '../core/editor-seo-localization';
import type { EditorNativeOperation } from '../core/editor-native-operation';

export interface BuilderPageSeoPanelProps { page?: EditorPageLike; onApplyOperations(operations: EditorNativeOperation[]): void; }
const schemaOptions: Array<{ value: EditorPageSeo['schemaType']; label: string }> = [
  { value: 'WebPage', label: 'Web page' }, { value: 'AboutPage', label: 'About page' }, { value: 'ContactPage', label: 'Contact page' },
  { value: 'Article', label: 'Article' }, { value: 'Product', label: 'Product' }, { value: 'FAQPage', label: 'FAQ page' },
];
export function BuilderPageSeoPanel({ page, onApplyOperations }: BuilderPageSeoPanelProps) {
  const { prefs } = usePreferences();
  const t = (value: string) => localizeEditorSeo(value, prefs.language);
  const [draft, setDraft] = useState<EditorPageSeo>(() => normalizeEditorPageSeo(page ? readEditorPageSeo(page) : {}));
  useEffect(() => { setDraft(normalizeEditorPageSeo(page ? readEditorPageSeo(page) : {})); }, [page]);
  if (!page) return null;
  const update = <K extends keyof EditorPageSeo>(key: K, value: EditorPageSeo[K]) => setDraft(current => ({ ...current, [key]: value }));
  const save = () => { const seo = normalizeEditorPageSeo(draft); onApplyOperations([{ action: 'update_page', source: 'manual', pageId: page.id, changes: { seo } }]); };
  return <div className="tayar-v2-page-seo">
    <div className="tayar-v2-panel-heading"><div><strong>{t('Page SEO')}</strong><div className="tayar-v2-muted">{t('Search, social sharing and structured data')}</div></div></div>
    <label>{t('SEO title')}<input value={draft.title} maxLength={200} onChange={event => update('title', event.target.value)} /><small>{draft.title.length}/60 {t('recommended')}</small></label>
    <label>{t('Meta description')}<textarea value={draft.description} maxLength={500} onChange={event => update('description', event.target.value)} /><small>{draft.description.length}/160 {t('recommended')}</small></label>
    <label>{t('Canonical URL')}<input type="url" value={draft.canonical} onChange={event => update('canonical', event.target.value)} placeholder="https://example.com/page" /></label>
    <label>{t('Open Graph title')}<input value={draft.ogTitle} onChange={event => update('ogTitle', event.target.value)} /></label>
    <label>{t('Open Graph description')}<textarea value={draft.ogDescription} onChange={event => update('ogDescription', event.target.value)} /></label>
    <label>{t('Open Graph image')}<input type="url" value={draft.ogImage} onChange={event => update('ogImage', event.target.value)} /></label>
    <label>{t('Schema type')}<select value={draft.schemaType} onChange={event => update('schemaType', event.target.value as EditorPageSeo['schemaType'])}>{schemaOptions.map(option => <option key={option.value} value={option.value}>{t(option.label)}</option>)}</select></label>
    <label>{t('Twitter card')}<select value={draft.twitterCard} onChange={event => update('twitterCard', event.target.value as EditorPageSeo['twitterCard'])}><option value="summary_large_image">{t('Large image')}</option><option value="summary">{t('Summary')}</option></select></label>
    <label><input type="checkbox" checked={draft.noIndex} onChange={event => update('noIndex', event.target.checked)} /> {t('Prevent search indexing')}</label>
    <label><input type="checkbox" checked={draft.noFollow} onChange={event => update('noFollow', event.target.checked)} /> {t('Do not follow links')}</label>
    <button type="button" className="tayar-v2-primary-action" onClick={save}>{t('Save SEO')}</button>
  </div>;
}
export default BuilderPageSeoPanel;
