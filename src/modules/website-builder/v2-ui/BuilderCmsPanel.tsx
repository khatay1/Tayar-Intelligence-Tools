import { useEffect, useState } from 'react';
import { Database, FilePlus2, Link2, Plus, Trash2, Unlink } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import {
  createWebsiteCmsCollection,
  createWebsiteCmsEntry,
  type WebsiteCmsCollection,
  type WebsiteCmsFieldType,
  type WebsiteCmsState,
  type WebsiteCmsValue,
} from '../core/website-cms';
import type { WebsiteCmsBinding, WebsiteElement } from '../core/types';
import type { WebsitePage } from '../core/website-builder-model';

interface BuilderCmsPanelProps {
  cms: WebsiteCmsState;
  activePage?: WebsitePage;
  selectedElement?: WebsiteElement;
  disabled?: boolean;
  issues?: string[];
  onChange(cms: WebsiteCmsState, label: string): void;
  onBindElement(binding?: WebsiteCmsBinding): void;
  onSetPageTemplate(collectionId?: string): void;
}

const FIELD_TYPES: WebsiteCmsFieldType[] = ['text', 'rich-text', 'number', 'boolean', 'date', 'image', 'url'];
const control = 'w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white outline-none focus:border-violet-400';
const button = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-[11px] font-semibold text-gray-200 hover:border-violet-400/60 hover:text-white disabled:opacity-40';

function uid(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function updateCollection(cms: WebsiteCmsState, collectionId: string, updater: (collection: WebsiteCmsCollection) => WebsiteCmsCollection): WebsiteCmsState {
  return { ...cms, collections: cms.collections.map((collection) => collection.id === collectionId ? updater(collection) : collection) };
}

export function BuilderCmsPanel({ cms, activePage, selectedElement, disabled, issues = [], onChange, onBindElement, onSetPageTemplate }: BuilderCmsPanelProps) {
  const l = useLocalizer();
  const [collectionId, setCollectionId] = useState(cms.collections[0]?.id || '');
  const [entryId, setEntryId] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<WebsiteCmsFieldType>('text');
  const collection = cms.collections.find((item) => item.id === collectionId) || cms.collections[0];
  const entry = collection?.entries.find((item) => item.id === entryId) || collection?.entries[0];

  useEffect(() => {
    if (collection && collection.id !== collectionId) setCollectionId(collection.id);
    if (collection && (!entryId || !collection.entries.some((item) => item.id === entryId))) setEntryId(collection.entries[0]?.id || '');
  }, [collection, collectionId, entryId]);

  const binding = selectedElement?.cmsBinding;

  const commitCollection = (updater: (current: WebsiteCmsCollection) => WebsiteCmsCollection, label: string) => {
    if (!collection) return;
    onChange(updateCollection(cms, collection.id, updater), label);
  };

  const addCollection = () => {
    const name = newCollectionName.trim();
    if (!name) return;
    const next = createWebsiteCmsCollection(name, uid('collection'));
    onChange({ ...cms, collections: [...cms.collections, next] }, 'Add CMS collection');
    setCollectionId(next.id);
    setNewCollectionName('');
  };

  const addField = () => {
    const name = newFieldName.trim();
    if (!collection || !name) return;
    const baseKey = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `field_${collection.fields.length + 1}`;
    let key = baseKey;
    let index = 2;
    while (collection.fields.some((field) => field.key === key)) key = `${baseKey}_${index++}`;
    commitCollection((current) => ({ ...current, fields: [...current.fields, { id: uid('field'), name, key, type: newFieldType, required: false }] }), 'Add CMS field');
    setNewFieldName('');
  };

  const addEntry = () => {
    if (!collection) return;
    const next = createWebsiteCmsEntry(collection, uid('entry'));
    commitCollection((current) => ({ ...current, entries: [...current.entries, next] }), 'Add CMS entry');
    setEntryId(next.id);
  };

  const updateEntryValue = (key: string, value: WebsiteCmsValue) => {
    if (!entry) return;
    commitCollection((current) => ({ ...current, entries: current.entries.map((item) => item.id === entry.id ? { ...item, values: { ...item.values, [key]: value } } : item) }), 'Edit CMS entry');
  };

  return (
    <div className="space-y-4 p-3 text-gray-200" data-testid="builder-cms-panel">
      <div className="rounded-xl border border-violet-400/20 bg-violet-500/5 p-3">
        <div className="flex items-center gap-2 text-xs font-bold text-white"><Database size={15} />{l('CMS & Dynamic Content')}</div>
        <p className="mt-1 text-[10px] leading-4 text-gray-400">{l('Model content once, bind it to elements, and publish one page per entry.')}</p>
      </div>
      {issues.length > 0 && <div className="rounded-xl border border-red-400/20 bg-red-500/5 p-3 text-[10px] leading-4 text-red-200" role="alert">{issues.slice(0, 4).map((issue) => <p key={issue}>• {issue}</p>)}</div>}

      <div className="space-y-2">
        <div className="flex gap-2"><select className={control} value={collection?.id || ''} onChange={(event) => setCollectionId(event.target.value)} disabled={disabled || !cms.collections.length}>
            {!cms.collections.length && <option value="">{l('No collections yet')}</option>}
            {cms.collections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {collection && <button type="button" className={`${button} text-red-300`} title={l('Delete collection')} onClick={() => { onChange({ ...cms, collections: cms.collections.filter((item) => item.id !== collection.id) }, 'Delete CMS collection'); setCollectionId(''); }} disabled={disabled}><Trash2 size={14} /></button>}
        </div>
        <div className="flex gap-2">
          <input className={control} value={newCollectionName} onChange={(event) => setNewCollectionName(event.target.value)} placeholder={l('Collection name')} maxLength={80} />
          <button type="button" className={button} onClick={addCollection} disabled={disabled || !newCollectionName.trim()} title={l('Add collection')}><Plus size={14} /></button>
        </div>
      </div>

      {collection && <>
        <div className="space-y-2 rounded-xl border border-white/10 p-3">
          <div className="flex items-center justify-between"><strong className="text-[11px] text-white">{l('Fields')}</strong><span className="text-[9px] text-gray-500">{collection.fields.length}/30</span></div>
          {collection.fields.map((field) => <div key={field.id} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-2 py-1.5"><span className="text-[10px] text-gray-200">{field.name} <small className="text-gray-500">{field.key}</small></span><span className="flex items-center gap-1 text-[9px] uppercase text-violet-300">{field.type}<button type="button" title={l('Delete field')} className="rounded p-1 text-red-300 hover:bg-red-500/10" onClick={() => commitCollection((current) => ({ ...current, fields: current.fields.filter((item) => item.id !== field.id), entries: current.entries.map((item) => ({ ...item, values: Object.fromEntries(Object.entries(item.values).filter(([key]) => key !== field.key)) })) }), 'Delete CMS field')} disabled={disabled || collection.fields.length <= 1}><Trash2 size={11} /></button></span></div>)}
          <div className="grid grid-cols-[1fr_88px_auto] gap-1.5">
            <input className={control} value={newFieldName} onChange={(event) => setNewFieldName(event.target.value)} placeholder={l('New field')} maxLength={80} />
            <select className={control} value={newFieldType} onChange={(event) => setNewFieldType(event.target.value as WebsiteCmsFieldType)}>{FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>
            <button type="button" className={button} onClick={addField} disabled={disabled || !newFieldName.trim()}><Plus size={14} /></button>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-white/10 p-3">
          <div className="flex items-center justify-between"><strong className="text-[11px] text-white">{l('Entries')}</strong><button type="button" className={button} onClick={addEntry} disabled={disabled}><FilePlus2 size={13} />{l('Add entry')}</button></div>
          {collection.entries.length > 0 && <select className={control} value={entry?.id || ''} onChange={(event) => setEntryId(event.target.value)}>{collection.entries.map((item, index) => <option key={item.id} value={item.id}>{String(item.values.title || item.values.name || `${l('Entry')} ${index + 1}`)}{item.draft ? ` · ${l('Draft')}` : ''}</option>)}</select>}
          {entry && <div className="space-y-2">
            <label className="flex items-center justify-between rounded-lg bg-white/[0.04] px-2 py-2 text-[10px]"><span>{l('Draft')}</span><input type="checkbox" checked={entry.draft} onChange={(event) => commitCollection((current) => ({ ...current, entries: current.entries.map((item) => item.id === entry.id ? { ...item, draft: event.target.checked } : item) }), 'Update CMS publishing state')} /></label>
            {collection.fields.map((field) => <label key={field.id} className="block text-[10px] text-gray-400">{field.name}{field.required ? ' *' : ''}
              {field.type === 'boolean' ? <input className="ml-2" type="checkbox" checked={entry.values[field.key] === true} onChange={(event) => updateEntryValue(field.key, event.target.checked)} /> : field.type === 'rich-text' ? <textarea className={`${control} mt-1 min-h-20`} value={String(entry.values[field.key] ?? '')} onChange={(event) => updateEntryValue(field.key, event.target.value)} /> : <input className={`${control} mt-1`} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'url' || field.type === 'image' ? 'url' : 'text'} value={String(entry.values[field.key] ?? '')} onChange={(event) => updateEntryValue(field.key, field.type === 'number' ? Number(event.target.value) : event.target.value)} />}
            </label>)}
            <button type="button" className={`${button} w-full text-red-300`} onClick={() => { commitCollection((current) => ({ ...current, entries: current.entries.filter((item) => item.id !== entry.id) }), 'Delete CMS entry'); setEntryId(''); }} disabled={disabled}><Trash2 size={13} />{l('Delete entry')}</button>
          </div>}
        </div>

        <div className="space-y-2 rounded-xl border border-white/10 p-3">
          <strong className="text-[11px] text-white">{l('Dynamic page')}</strong>
          <p className="text-[9px] leading-4 text-gray-500">{l('Publish the active page once for every published entry in this collection.')}</p>
          <button type="button" className={`${button} w-full`} onClick={() => onSetPageTemplate(activePage?.cmsTemplate?.collectionId === collection.id ? undefined : collection.id)} disabled={disabled || !activePage}>
            {activePage?.cmsTemplate?.collectionId === collection.id ? <><Unlink size={13} />{l('Disconnect dynamic page')}</> : <><Link2 size={13} />{l('Use active page as template')}</>}
          </button>
        </div>

        <div className="space-y-2 rounded-xl border border-white/10 p-3">
          <strong className="text-[11px] text-white">{l('Element binding')}</strong>
          {!selectedElement ? <p className="text-[10px] text-gray-500">{l('Select an element on the canvas to bind it.')}</p> : <>
            <select className={control} value={binding?.fieldKey || ''} onChange={(event) => event.target.value ? onBindElement({ collectionId: collection.id, fieldKey: event.target.value, entryId: activePage?.cmsTemplate ? undefined : entry?.id, target: selectedElement.type === 'image' || selectedElement.type === 'video' ? 'src' : selectedElement.type === 'button' && binding?.target === 'href' ? 'href' : 'content' }) : onBindElement(undefined)}>
              <option value="">{l('Not connected')}</option>
              {collection.fields.map((field) => <option key={field.id} value={field.key}>{field.name}</option>)}
            </select>
            {selectedElement.type === 'button' && binding && <select className={control} value={binding.target} onChange={(event) => onBindElement({ ...binding, target: event.target.value as WebsiteCmsBinding['target'] })}><option value="content">{l('Button label')}</option><option value="href">{l('Button link')}</option></select>}
            {binding && <button type="button" className={`${button} w-full`} onClick={() => onBindElement(undefined)} disabled={disabled}><Unlink size={13} />{l('Remove binding')}</button>}
          </>}
        </div>
      </>}
    </div>
  );
}
