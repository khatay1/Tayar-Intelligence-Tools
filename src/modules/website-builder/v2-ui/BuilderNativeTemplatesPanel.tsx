import { useMemo, useState } from 'react';
import { usePreferences } from '@/context/PreferencesContext';
import { localizeEditorTemplate } from '../core/editor-template-localization';
import {
  EDITOR_TEMPLATE_LIBRARY,
  filterEditorTemplateLibrary,
  type EditorTemplateCategory,
  type EditorTemplateKind,
  type EditorTemplateLibraryItem,
} from '../core/editor-template-library';

export interface BuilderNativeTemplatesPanelProps {
  disabled?: boolean;
  onInsert?(template: EditorTemplateLibraryItem): void;
  onPreview?(template: EditorTemplateLibraryItem): void;
  onCustomizeWithAI?(template: EditorTemplateLibraryItem): void;
}

const KINDS: Array<{ id?: EditorTemplateKind; label: string }> = [
  { label: 'All' }, { id: 'section', label: 'Sections' }, { id: 'page', label: 'Pages' }, { id: 'site', label: 'Sites' },
];
const CATEGORIES: Array<{ id?: EditorTemplateCategory; label: string }> = [
  { label: 'All categories' }, { id: 'business', label: 'Business' }, { id: 'saas', label: 'SaaS' }, { id: 'portfolio', label: 'Portfolio' }, { id: 'commerce', label: 'Commerce' }, { id: 'content', label: 'Content' }, { id: 'launch', label: 'Launch' },
];

export function BuilderNativeTemplatesPanel({ disabled = false, onInsert, onPreview, onCustomizeWithAI }: BuilderNativeTemplatesPanelProps) {
  const { prefs } = usePreferences();
  const templateText = (text: string) => localizeEditorTemplate(text, prefs.language);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<EditorTemplateKind>();
  const [category, setCategory] = useState<EditorTemplateCategory>();
  const items = useMemo(() => filterEditorTemplateLibrary(query, kind, category), [query, kind, category]);

  return <section className="space-y-3 border-b border-white/10 p-3" aria-label={templateText('Website templates')}>
    <div><div className="text-sm font-semibold text-white">{templateText('Website templates')}</div><p className="mt-1 text-[11px] leading-4 text-gray-500">{templateText('Sections, pages and complete sites ready to insert.')}</p></div>
    <input type="search" value={query} onChange={event => setQuery(event.currentTarget.value)} placeholder={templateText('Search templates')} aria-label={templateText('Search templates')} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none" />
    <div className="grid grid-cols-4 gap-1 rounded-lg border border-white/10 bg-black/15 p-1" role="group" aria-label={templateText('Template type')}>
      {KINDS.map(item => <button key={item.id || 'all'} type="button" aria-pressed={kind === item.id || (!kind && !item.id)} onClick={() => setKind(item.id)} className="rounded-md px-2 py-1.5 text-[10px] text-gray-300 aria-pressed:bg-white/10 aria-pressed:text-white">{templateText(item.label)}</button>)}
    </div>
    <select value={category || ''} onChange={event => setCategory((event.currentTarget.value || undefined) as EditorTemplateCategory | undefined)} aria-label={templateText('Category')} className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs text-gray-300 outline-none">
      {CATEGORIES.map(item => <option key={item.id || 'all'} value={item.id || ''}>{templateText(item.label)}</option>)}
    </select>
    <div className="space-y-2">{items.map(item => <article key={item.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
      <div className="flex items-center justify-between gap-2"><strong className="text-xs text-gray-100">{templateText(item.name)}</strong><span className="rounded bg-white/5 px-1.5 py-1 text-[9px] uppercase text-gray-500">{templateText(item.kind === 'section' ? 'Sections' : item.kind === 'page' ? 'Pages' : 'Sites')}</span></div>
      <p className="mt-1 text-[10px] leading-4 text-gray-500">{templateText(item.description)}</p>
      <div className="mt-2 flex flex-wrap gap-1">{item.tags.slice(0, 4).map(tag => <span key={tag} className="rounded bg-white/5 px-1.5 py-1 text-[9px] text-gray-500">{tag}</span>)}</div>
      <div className="mt-3 grid grid-cols-3 gap-1"><button type="button" disabled={disabled || !onPreview} onClick={() => onPreview?.(item)} className="rounded border border-white/10 px-2 py-1.5 text-[10px] text-gray-300 disabled:opacity-40">{templateText('Preview')}</button><button type="button" disabled={disabled || !onInsert} onClick={() => onInsert?.(item)} className="rounded border border-white/10 px-2 py-1.5 text-[10px] text-gray-300 disabled:opacity-40">{templateText('Insert')}</button><button type="button" disabled={disabled || !item.aiCustomizable || !onCustomizeWithAI} onClick={() => onCustomizeWithAI?.(item)} className="rounded border border-cyan-500/20 px-2 py-1.5 text-[10px] text-cyan-300 disabled:opacity-40">{templateText('Customize with AI')}</button></div>
    </article>)}{!items.length && <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-gray-500">{templateText('No templates found')}</div>}</div>
    <div className="text-[10px] text-gray-600">{items.length.toLocaleString()} / {EDITOR_TEMPLATE_LIBRARY.length.toLocaleString()}</div>
  </section>;
}
