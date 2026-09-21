import { useMemo, useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization';
import type { EditorSymbolLike } from '../core/editor-model';
import { useBuilderComponentsLocalizer } from './builder-components-localization';

export interface BuilderComponentsPanelProps {
  symbols: EditorSymbolLike[];
  canCreate?: boolean;
  canInsert?: boolean;
  canDetach?: boolean;
  onCreate?(): void;
  onDetach?(): void;
  onInsert?(symbolId: string): void;
  onDelete?(symbolId: string): void;
  onRename?(symbolId: string, name: string): void;
  onDuplicate?(symbolId: string): void;
  onCreateVariant?(symbolId: string, variantName: string): void;
  onUpdateMetadata?(symbolId: string, changes: Record<string, unknown>): void;
  onSelectInstance?(symbolId: string): void;
  activeSymbolId?: string;
  instanceCounts?: Record<string, number>;
  disabled?: boolean;
}

type MetadataDraft = { description: string; category: string; tags: string; variantName: string };

function metadataDraft(symbol: EditorSymbolLike): MetadataDraft {
  return {
    description: typeof symbol.description === 'string' ? symbol.description : '',
    category: typeof symbol.category === 'string' ? symbol.category : '',
    tags: Array.isArray(symbol.tags) ? symbol.tags.filter((tag): tag is string => typeof tag === 'string').join(', ') : '',
    variantName: typeof symbol.variantName === 'string' ? symbol.variantName : '',
  };
}

export function BuilderComponentsPanel({ symbols, canCreate, canInsert, canDetach, onCreate, onDetach, onInsert, onDelete, onRename, onDuplicate, onCreateVariant, onUpdateMetadata, onSelectInstance, activeSymbolId, instanceCounts = {}, disabled = false }: BuilderComponentsPanelProps) {
  const l = useLocalizer();
  const lc = useBuilderComponentsLocalizer();
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MetadataDraft>({ description: '', category: '', tags: '', variantName: '' });

  const visibleSymbols = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return symbols;
    return symbols.filter((symbol) => [symbol.name, symbol.category, symbol.variantName, symbol.description, ...(Array.isArray(symbol.tags) ? symbol.tags : [])].filter((value): value is string => typeof value === 'string').join(' ').toLocaleLowerCase().includes(normalizedQuery));
  }, [query, symbols]);

  const metrics = useMemo(() => ({
    totalInstances: symbols.reduce((sum, symbol) => sum + (instanceCounts[symbol.id] || 0), 0),
    variantGroups: new Set(symbols.map((symbol) => symbol.variantGroupId).filter(Boolean)).size,
    unused: symbols.filter((symbol) => !(instanceCounts[symbol.id] || 0)).length,
  }), [instanceCounts, symbols]);

  const renameSymbol = (symbol: EditorSymbolLike) => {
    if (!onRename || disabled) return;
    const nextName = window.prompt(l('Component name'), symbol.name || l('Component'))?.trim();
    if (nextName && nextName !== symbol.name) onRename(symbol.id, nextName.slice(0, 80));
  };
  const createVariant = (symbol: EditorSymbolLike) => {
    if (!onCreateVariant || disabled) return;
    const name = window.prompt(lc('Variant name'), lc('Variant'))?.trim();
    if (name) onCreateVariant(symbol.id, name.slice(0, 64));
  };
  const openMetadata = (symbol: EditorSymbolLike) => { setEditingId(symbol.id); setDraft(metadataDraft(symbol)); };
  const saveMetadata = () => {
    if (!editingId || !onUpdateMetadata || disabled) return;
    onUpdateMetadata(editingId, { description: draft.description, category: draft.category, tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean), variantName: draft.variantName });
    setEditingId(null);
  };

  return <div className="tayar-v2-components-panel" aria-busy={disabled}>
    <div className="tayar-v2-panel-heading"><strong>{l('Components')}</strong><span>{symbols.length}</span></div>
    <div className="tayar-v2-empty-panel">{l('Components are reusable linked elements. Create one from the selected element, insert it anywhere, and linked copies stay in sync. Detach makes only the selected copy independent.')}</div>
    {!!symbols.length && <div className="grid grid-cols-3 gap-1.5 text-center text-[9px] text-gray-400">
      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-1.5 py-2"><strong className="block text-xs text-white">{metrics.totalInstances}</strong>{l('instances')}</div>
      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-1.5 py-2"><strong className="block text-xs text-white">{metrics.variantGroups}</strong>{lc('variant groups')}</div>
      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-1.5 py-2"><strong className="block text-xs text-white">{metrics.unused}</strong>{lc('unused')}</div>
    </div>}
    <div className="tayar-v2-panel-actions">
      <button type="button" disabled={disabled || !canCreate || !onCreate} onClick={onCreate} title={canCreate ? l('Create a reusable linked component from the selected element') : l('Select a normal element first')}>{l('Create component')}</button>
      <button type="button" disabled={disabled || !canDetach || !onDetach} onClick={onDetach} title={canDetach ? l('Detach the selected linked instance') : l('Select a linked component instance first')}>{l('Detach selected')}</button>
    </div>
    {symbols.length > 4 && <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={l('Search components')} aria-label={l('Search components')} disabled={disabled} className="tayar-v2-component-search" />}
    <div className="tayar-v2-component-list">
      {visibleSymbols.map((symbol) => {
        const count = instanceCounts[symbol.id] || 0;
        const isEditing = editingId === symbol.id;
        return <div className="tayar-v2-component-row flex-wrap" key={symbol.id} data-active={activeSymbolId === symbol.id ? 'true' : 'false'}>
          <button type="button" className="tayar-v2-component-row__insert" disabled={disabled || !canInsert || !onInsert} onClick={() => onInsert?.(symbol.id)} title={canInsert ? l('Insert component into the selected section') : l('Select a section or element first')}>
            <span>◆</span><span className="tayar-v2-component-row__meta"><strong>{symbol.name || l('Component')}</strong><small>{count} {l('instances')}{symbol.variantName ? ` · ${symbol.variantName}` : ''}{symbol.category ? ` · ${symbol.category}` : ''}</small>{Array.isArray(symbol.tags) && symbol.tags.length > 0 && <small>{symbol.tags.slice(0, 4).join(' · ')}</small>}</span>
          </button>
          <button type="button" disabled={disabled || !onRename} onClick={() => renameSymbol(symbol)} title={l('Rename component')}>{l('REN')}</button>
          <button type="button" disabled={disabled || !onDuplicate} onClick={() => onDuplicate?.(symbol.id)} title={l('Duplicate component')}>{l('DUP')}</button>
          <button type="button" disabled={disabled || !onCreateVariant} onClick={() => createVariant(symbol)} title={lc('Create variant')}>{lc('VAR')}</button>
          <button type="button" disabled={disabled || !onSelectInstance || !count} onClick={() => onSelectInstance?.(symbol.id)} title={l('Find next instance')}>{l('FIND')}</button>
          <button type="button" disabled={disabled || !onUpdateMetadata} onClick={() => isEditing ? setEditingId(null) : openMetadata(symbol)} title={lc('Component details')}>{lc('INFO')}</button>
          <button type="button" className="is-danger" disabled={disabled || !onDelete} onClick={() => onDelete?.(symbol.id)} title={l('Delete component')}>{l('DEL')}</button>
          {isEditing && <div className="w-full space-y-2 rounded-lg border border-white/10 bg-black/10 p-2">
            <label className="block text-[9px] text-gray-400">{l('Description')}<textarea className="mt-1 min-h-16 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-white" maxLength={240} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
            <div className="grid grid-cols-2 gap-2"><label className="block text-[9px] text-gray-400">{l('Category')}<input className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-white" maxLength={48} value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} /></label><label className="block text-[9px] text-gray-400">{lc('Variant name')}<input className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-white" maxLength={64} value={draft.variantName} onChange={(event) => setDraft((current) => ({ ...current, variantName: event.target.value }))} disabled={!symbol.variantGroupId} /></label></div>
            <label className="block text-[9px] text-gray-400">{lc('Tags')}<input className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-white" value={draft.tags} onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))} placeholder={lc('Comma-separated tags')} /></label>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingId(null)}>{l('Cancel')}</button><button type="button" onClick={saveMetadata} disabled={disabled || !onUpdateMetadata}>{lc('Save details')}</button></div>
          </div>}
        </div>;
      })}
      {!symbols.length && <div className="tayar-v2-empty-panel">{l('Select an element on the canvas, then choose “Create component”.')}</div>}
      {symbols.length > 0 && !visibleSymbols.length && <div className="tayar-v2-empty-panel">{l('No matching components')}</div>}
      {symbols.length > 0 && !canInsert && <div className="tayar-v2-empty-panel">{l('Select a section or an element on the canvas before inserting a component.')}</div>}
    </div>
  </div>;
}

export default BuilderComponentsPanel;
