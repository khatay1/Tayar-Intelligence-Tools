import { useEffect, useState } from 'react';
import { Copy, Database, FilePlus2, Link2, Plus, Trash2, Unlink } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import { normalizeSlug } from '../core/project-identifiers';
import {
  createWebsiteCmsCollection,
  createWebsiteCmsEntry,
  queryWebsiteCmsEntries,
  WEBSITE_CMS_LIMITS,
  type WebsiteCmsCollection,
  type WebsiteCmsField,
  type WebsiteCmsFilter,
  type WebsiteCmsFilterOperator,
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
  onSetPageTemplate(template?: WebsitePage['cmsTemplate']): void;
}

const FIELD_TYPES: WebsiteCmsFieldType[] = ['text', 'rich-text', 'number', 'boolean', 'date', 'image', 'url', 'reference'];
const FILTER_OPERATORS: WebsiteCmsFilterOperator[] = ['equals', 'not-equals', 'contains', 'truthy'];
const control = 'w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white outline-none focus:border-violet-400';
const button = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-[11px] font-semibold text-gray-200 hover:border-violet-400/60 hover:text-white disabled:opacity-40';

function uid(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function updateCollection(cms: WebsiteCmsState, collectionId: string, updater: (collection: WebsiteCmsCollection) => WebsiteCmsCollection): WebsiteCmsState {
  return { ...cms, collections: cms.collections.map((collection) => collection.id === collectionId ? updater(collection) : collection) };
}

function toLocalDateTimeInput(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultFilterValue(field?: WebsiteCmsField): WebsiteCmsValue {
  if (field?.type === 'boolean') return false;
  if (field?.type === 'number') return 0;
  return '';
}

export function BuilderCmsPanel({ cms, activePage, selectedElement, disabled, issues = [], onChange, onBindElement, onSetPageTemplate }: BuilderCmsPanelProps) {
  const l = useLocalizer();
  const [collectionId, setCollectionId] = useState(cms.collections[0]?.id || '');
  const [entryId, setEntryId] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<WebsiteCmsFieldType>('text');
  const [referenceCollectionId, setReferenceCollectionId] = useState('');
  const [newViewName, setNewViewName] = useState('');
  const collection = cms.collections.find((item) => item.id === collectionId) || cms.collections[0];
  const entry = collection?.entries.find((item) => item.id === entryId) || collection?.entries[0];

  useEffect(() => {
    if (collection && collection.id !== collectionId) setCollectionId(collection.id);
    if (collection && (!entryId || !collection.entries.some((item) => item.id === entryId))) setEntryId(collection.entries[0]?.id || '');
  }, [collection, collectionId, entryId]);

  const binding = selectedElement?.cmsBinding;
  const boundField = collection?.fields.find((field) => field.key === binding?.fieldKey);
  const boundReferenceCollection = cms.collections.find((item) => item.id === boundField?.referenceCollectionId);
  const referenceTargets = collection ? cms.collections.filter((item) => item.id !== collection.id) : [];
  const collectionReferenceOwners = collection ? cms.collections.filter((candidate) => candidate.id !== collection.id && candidate.fields.some((field) => field.referenceCollectionId === collection.id)) : [];
  const entryReferenceCount = entry ? cms.collections.reduce((count, candidate) => count + candidate.entries.reduce((entryCount, candidateEntry) => entryCount + Object.values(candidateEntry.values).filter((value) => value === entry.id).length, 0), 0) : 0;
  const slugCandidates = collection?.fields.filter((field) => !['boolean', 'image', 'reference'].includes(field.type)) || [];

  const commitCollection = (updater: (current: WebsiteCmsCollection) => WebsiteCmsCollection, label: string) => {
    if (!collection) return;
    onChange(updateCollection(cms, collection.id, updater), label);
  };

  const addCollection = () => {
    const name = newCollectionName.trim();
    if (!name || cms.collections.length >= WEBSITE_CMS_LIMITS.collections) return;
    const next = createWebsiteCmsCollection(name, uid('collection'));
    onChange({ ...cms, collections: [...cms.collections, next] }, 'Add CMS collection');
    setCollectionId(next.id);
    setNewCollectionName('');
  };

  const addField = () => {
    const name = newFieldName.trim();
    if (!collection || !name || collection.fields.length >= WEBSITE_CMS_LIMITS.fields) return;
    const targetCollectionId = referenceCollectionId || referenceTargets[0]?.id;
    if (newFieldType === 'reference' && !targetCollectionId) return;
    const baseKey = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `field_${collection.fields.length + 1}`;
    let key = baseKey;
    let index = 2;
    while (collection.fields.some((field) => field.key === key)) key = `${baseKey}_${index++}`;
    commitCollection((current) => ({
      ...current,
      fields: [...current.fields, {
        id: uid('field'),
        name,
        key,
        type: newFieldType,
        required: false,
        referenceCollectionId: newFieldType === 'reference' ? targetCollectionId : undefined,
      }],
    }), 'Add CMS field');
    setNewFieldName('');
  };

  const deleteField = (field: WebsiteCmsField) => {
    if (!collection || collection.fields.length <= 1) return;
    commitCollection((current) => {
      const fields = current.fields.filter((item) => item.id !== field.id);
      const fallbackSlugField = fields.find((item) => item.key === 'slug')?.key || fields[0]?.key || current.slugField;
      return {
        ...current,
        slugField: current.slugField === field.key ? fallbackSlugField : current.slugField,
        fields,
        entries: current.entries.map((item) => ({ ...item, values: Object.fromEntries(Object.entries(item.values).filter(([key]) => key !== field.key)) })),
        views: current.views.map((view) => ({
          ...view,
          sortField: view.sortField === field.key ? undefined : view.sortField,
          filters: view.filters.filter((filter) => filter.fieldKey !== field.key),
        })),
      };
    }, 'Delete CMS field');
  };

  const addEntry = () => {
    if (!collection || collection.entries.length >= WEBSITE_CMS_LIMITS.entries) return;
    const next = createWebsiteCmsEntry(collection, uid('entry'));
    commitCollection((current) => ({ ...current, entries: [...current.entries, next] }), 'Add CMS entry');
    setEntryId(next.id);
  };

  const duplicateEntry = () => {
    if (!collection || !entry || collection.entries.length >= WEBSITE_CMS_LIMITS.entries) return;
    const duplicate = {
      ...entry,
      id: uid('entry'),
      draft: true,
      publishAt: undefined,
      unpublishAt: undefined,
      values: { ...entry.values, [collection.slugField]: '' },
    };
    commitCollection((current) => ({ ...current, entries: [...current.entries, duplicate] }), 'Duplicate CMS entry');
    setEntryId(duplicate.id);
  };

  const updateEntryValue = (key: string, value: WebsiteCmsValue) => {
    if (!entry) return;
    commitCollection((current) => ({ ...current, entries: current.entries.map((item) => item.id === entry.id ? { ...item, values: { ...item.values, [key]: value } } : item) }), 'Edit CMS entry');
  };

  const updateEntrySchedule = (key: 'publishAt' | 'unpublishAt', value: string) => {
    if (!entry) return;
    const timestamp = value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
    commitCollection((current) => ({ ...current, entries: current.entries.map((item) => item.id === entry.id ? { ...item, [key]: timestamp } : item) }), 'Schedule CMS entry');
  };

  const addView = () => {
    const name = newViewName.trim();
    if (!collection || !name || collection.views.length >= WEBSITE_CMS_LIMITS.views) return;
    commitCollection((current) => ({ ...current, views: [...current.views, { id: uid('view'), name, filters: [], sortDirection: 'asc' }] }), 'Add CMS view');
    setNewViewName('');
  };

  const renderFilterValueControl = (filter: WebsiteCmsFilter, onUpdate: (next: WebsiteCmsFilter) => void) => {
    if (!collection || filter.operator === 'truthy') return null;
    const field = collection.fields.find((candidate) => candidate.key === filter.fieldKey);
    if (field?.type === 'boolean') {
      return <select className={control} value={String(filter.value ?? false)} onChange={(event) => onUpdate({ ...filter, value: event.target.value === 'true' })}><option value="true">true</option><option value="false">false</option></select>;
    }
    if (field?.type === 'reference') {
      const targetCollection = cms.collections.find((candidate) => candidate.id === field.referenceCollectionId);
      return <select className={control} value={String(filter.value ?? '')} onChange={(event) => onUpdate({ ...filter, value: event.target.value })}><option value="">{l('Not connected')}</option>{targetCollection?.entries.map((target, index) => <option key={target.id} value={target.id}>{String(target.values.title || target.values.name || `${l('Entry')} ${index + 1}`)}</option>)}</select>;
    }
    return <input className={control} type={field?.type === 'number' ? 'number' : field?.type === 'date' ? 'date' : 'text'} value={String(filter.value ?? '')} onChange={(event) => onUpdate({ ...filter, value: field?.type === 'number' ? Number(event.target.value) : event.target.value })} placeholder={l('Filter value')} />;
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
          {collection && <button type="button" className={`${button} text-red-300`} title={collectionReferenceOwners.length ? `${l('Referenced by')}: ${collectionReferenceOwners.map((item) => item.name).join(', ')}` : l('Delete collection')} onClick={() => { onChange({ ...cms, collections: cms.collections.filter((item) => item.id !== collection.id) }, 'Delete CMS collection'); setCollectionId(''); }} disabled={disabled || collectionReferenceOwners.length > 0}><Trash2 size={14} /></button>}
        </div>
        <div className="flex gap-2">
          <input className={control} value={newCollectionName} onChange={(event) => setNewCollectionName(event.target.value)} placeholder={l('Collection name')} maxLength={80} />
          <button type="button" className={button} onClick={addCollection} disabled={disabled || !newCollectionName.trim() || cms.collections.length >= WEBSITE_CMS_LIMITS.collections} title={l('Add collection')}><Plus size={14} /></button>
        </div>
      </div>

      {collection && <>
        <div className="space-y-2 rounded-xl border border-white/10 p-3">
          <strong className="text-[11px] text-white">{l('Collection settings')}</strong>
          <label className="block text-[9px] text-gray-400">{l('Collection name')}<input className={`${control} mt-1`} value={collection.name} onChange={(event) => commitCollection((current) => ({ ...current, name: event.target.value.slice(0, 80) }), 'Rename CMS collection')} maxLength={80} /></label>
          <label className="block text-[9px] text-gray-400">{l('Collection slug')}<input className={`${control} mt-1`} value={collection.slug} onChange={(event) => commitCollection((current) => ({ ...current, slug: normalizeSlug(event.target.value) }), 'Update CMS collection slug')} maxLength={120} /></label>
          <label className="block text-[9px] text-gray-400">{l('Entry slug field')}<select className={`${control} mt-1`} value={collection.slugField} onChange={(event) => commitCollection((current) => ({ ...current, slugField: event.target.value }), 'Update CMS slug field')}>{slugCandidates.map((field) => <option key={field.id} value={field.key}>{field.name}</option>)}</select></label>
        </div>

        <div className="space-y-2 rounded-xl border border-white/10 p-3">
          <div className="flex items-center justify-between"><strong className="text-[11px] text-white">{l('Fields')}</strong><span className="text-[9px] text-gray-500">{collection.fields.length}/{WEBSITE_CMS_LIMITS.fields}</span></div>
          {collection.fields.map((field) => <div key={field.id} className="space-y-1.5 rounded-lg bg-white/[0.04] px-2 py-2">
            <div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-[10px] text-gray-200">{field.name} <small className="text-gray-500">{field.key}</small></span><span className="flex shrink-0 items-center gap-1 text-[9px] uppercase text-violet-300">{field.type}<button type="button" title={l('Delete field')} className="rounded p-1 text-red-300 hover:bg-red-500/10" onClick={() => deleteField(field)} disabled={disabled || collection.fields.length <= 1}><Trash2 size={11} /></button></span></div>
            <label className="flex items-center justify-between text-[9px] text-gray-400"><span>{l('Required')}</span><input type="checkbox" checked={field.required} onChange={(event) => commitCollection((current) => ({ ...current, fields: current.fields.map((item) => item.id === field.id ? { ...item, required: event.target.checked } : item) }), 'Update CMS field')} disabled={disabled} /></label>
            {field.type === 'reference' && <div className="text-[9px] text-gray-500">{l('Referenced collection')}: <span className="text-gray-300">{cms.collections.find((item) => item.id === field.referenceCollectionId)?.name || l('Missing')}</span></div>}
          </div>)}
          <div className="grid grid-cols-[1fr_88px_auto] gap-1.5">
            <input className={control} value={newFieldName} onChange={(event) => setNewFieldName(event.target.value)} placeholder={l('New field')} maxLength={80} />
            <select className={control} value={newFieldType} onChange={(event) => setNewFieldType(event.target.value as WebsiteCmsFieldType)}>{FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>
            <button type="button" className={button} onClick={addField} disabled={disabled || !newFieldName.trim() || collection.fields.length >= WEBSITE_CMS_LIMITS.fields || (newFieldType === 'reference' && referenceTargets.length === 0)}><Plus size={14} /></button>
          </div>
          {newFieldType === 'reference' && <select className={control} value={referenceCollectionId} onChange={(event) => setReferenceCollectionId(event.target.value)} disabled={!referenceTargets.length}>
            <option value="">{l('Choose referenced collection')}</option>
            {referenceTargets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>}
        </div>

        <div className="space-y-2 rounded-xl border border-white/10 p-3">
          <div className="flex items-center justify-between"><strong className="text-[11px] text-white">{l('Entries')}</strong><span className="text-[9px] text-gray-500">{collection.entries.length}/{WEBSITE_CMS_LIMITS.entries}</span></div>
          <button type="button" className={`${button} w-full`} onClick={addEntry} disabled={disabled || collection.entries.length >= WEBSITE_CMS_LIMITS.entries}><FilePlus2 size={13} />{l('Add entry')}</button>
          {collection.entries.length > 0 && <select className={control} value={entry?.id || ''} onChange={(event) => setEntryId(event.target.value)}>{collection.entries.map((item, index) => <option key={item.id} value={item.id}>{String(item.values.title || item.values.name || `${l('Entry')} ${index + 1}`)}{item.draft ? ` · ${l('Draft')}` : ''}</option>)}</select>}
          {entry && <div className="space-y-2">
            <label className="flex items-center justify-between rounded-lg bg-white/[0.04] px-2 py-2 text-[10px]"><span>{l('Draft')}</span><input type="checkbox" checked={entry.draft} onChange={(event) => commitCollection((current) => ({ ...current, entries: current.entries.map((item) => item.id === entry.id ? { ...item, draft: event.target.checked } : item) }), 'Update CMS publishing state')} /></label>
            {!entry.draft && <div className="grid grid-cols-2 gap-2">
              <label className="text-[9px] text-gray-400">{l('Publish at')}<input className={`${control} mt-1`} type="datetime-local" value={toLocalDateTimeInput(entry.publishAt)} onChange={(event) => updateEntrySchedule('publishAt', event.target.value)} /></label>
              <label className="text-[9px] text-gray-400">{l('Unpublish at')}<input className={`${control} mt-1`} type="datetime-local" value={toLocalDateTimeInput(entry.unpublishAt)} onChange={(event) => updateEntrySchedule('unpublishAt', event.target.value)} /></label>
            </div>}
            {collection.fields.map((field) => <label key={field.id} className="block text-[10px] text-gray-400">{field.name}{field.required ? ' *' : ''}
              {field.type === 'boolean' ? <input className="ml-2" type="checkbox" checked={entry.values[field.key] === true} onChange={(event) => updateEntryValue(field.key, event.target.checked)} /> : field.type === 'reference' ? <select className={`${control} mt-1`} value={String(entry.values[field.key] ?? '')} onChange={(event) => updateEntryValue(field.key, event.target.value)}><option value="">{l('Not connected')}</option>{cms.collections.find((item) => item.id === field.referenceCollectionId)?.entries.map((target, index) => <option key={target.id} value={target.id}>{String(target.values.title || target.values.name || `${l('Entry')} ${index + 1}`)}</option>)}</select> : field.type === 'rich-text' ? <textarea className={`${control} mt-1 min-h-20`} value={String(entry.values[field.key] ?? '')} onChange={(event) => updateEntryValue(field.key, event.target.value)} /> : <input className={`${control} mt-1`} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'url' || field.type === 'image' ? 'url' : 'text'} value={String(entry.values[field.key] ?? '')} onChange={(event) => updateEntryValue(field.key, field.type === 'number' ? Number(event.target.value) : event.target.value)} />}
            </label>)}
            <div className="grid grid-cols-2 gap-2"><button type="button" className={button} onClick={duplicateEntry} disabled={disabled || collection.entries.length >= WEBSITE_CMS_LIMITS.entries}><Copy size={13} />{l('Duplicate entry')}</button><button type="button" className={`${button} text-red-300`} title={entryReferenceCount > 0 ? l('This entry is referenced by other CMS content') : l('Delete entry')} onClick={() => { commitCollection((current) => ({ ...current, entries: current.entries.filter((item) => item.id !== entry.id) }), 'Delete CMS entry'); setEntryId(''); }} disabled={disabled || entryReferenceCount > 0}><Trash2 size={13} />{l('Delete entry')}</button></div>
          </div>}
        </div>

        <div className="space-y-2 rounded-xl border border-white/10 p-3">
          <div className="flex items-center justify-between"><strong className="text-[11px] text-white">{l('Reusable views')}</strong><span className="text-[9px] text-gray-500">{collection.views.length}/{WEBSITE_CMS_LIMITS.views}</span></div>
          <p className="text-[9px] leading-4 text-gray-500">{l('Reuse filters, sorting, and limits across dynamic pages.')}</p>
          {collection.views.map((view) => {
            const updateView = (changes: Partial<typeof view>) => commitCollection((current) => ({ ...current, views: current.views.map((item) => item.id === view.id ? { ...item, ...changes } : item) }), 'Update CMS view');
            const updateFilter = (filterIndex: number, next: WebsiteCmsFilter) => updateView({ filters: view.filters.map((filter, index) => index === filterIndex ? next : filter) });
            const matchedEntries = queryWebsiteCmsEntries(collection, view.id).length;
            return <div key={view.id} className="space-y-2 rounded-lg bg-white/[0.04] p-2">
              <div className="flex items-center gap-1.5"><input className={control} value={view.name} onChange={(event) => updateView({ name: event.target.value })} /><button type="button" className="rounded p-1 text-red-300" title={l('Delete view')} onClick={() => commitCollection((current) => ({ ...current, views: current.views.filter((item) => item.id !== view.id) }), 'Delete CMS view')}><Trash2 size={12} /></button></div>
              <div className="flex items-center justify-between text-[9px] text-gray-500"><span>{l('Matching published entries')}</span><span className="font-semibold text-violet-300">{matchedEntries}</span></div>
              <div className="grid grid-cols-2 gap-1.5"><select className={control} value={view.sortField || ''} onChange={(event) => updateView({ sortField: event.target.value || undefined })}><option value="">{l('No sorting')}</option>{collection.fields.map((field) => <option key={field.id} value={field.key}>{field.name}</option>)}</select><select className={control} value={view.sortDirection} onChange={(event) => updateView({ sortDirection: event.target.value as 'asc' | 'desc' })}><option value="asc">{l('Ascending')}</option><option value="desc">{l('Descending')}</option></select></div>
              <div className="space-y-1.5">{view.filters.map((filter, filterIndex) => {
                const filterField = collection.fields.find((field) => field.key === filter.fieldKey);
                return <div key={`${view.id}-filter-${filterIndex}`} className="space-y-1.5 rounded-lg border border-white/10 p-2">
                  <div className="grid grid-cols-[1fr_108px_auto] gap-1.5"><select className={control} value={filter.fieldKey} onChange={(event) => { const nextField = collection.fields.find((field) => field.key === event.target.value); updateFilter(filterIndex, { fieldKey: event.target.value, operator: filter.operator, value: defaultFilterValue(nextField) }); }}>{collection.fields.map((field) => <option key={field.id} value={field.key}>{field.name}</option>)}</select><select className={control} value={filter.operator} onChange={(event) => { const operator = event.target.value as WebsiteCmsFilterOperator; updateFilter(filterIndex, { ...filter, operator, value: operator === 'truthy' ? undefined : filter.value ?? defaultFilterValue(filterField) }); }}>{FILTER_OPERATORS.map((operator) => <option key={operator} value={operator}>{l(operator)}</option>)}</select><button type="button" className="rounded p-1 text-red-300" title={l('Remove filter')} onClick={() => updateView({ filters: view.filters.filter((_, index) => index !== filterIndex) })}><Trash2 size={12} /></button></div>
                  {renderFilterValueControl(filter, (next) => updateFilter(filterIndex, next))}
                </div>;
              })}</div>
              <button type="button" className={`${button} w-full`} onClick={() => { const field = collection.fields[0]; if (field) updateView({ filters: [...view.filters, { fieldKey: field.key, operator: 'equals', value: defaultFilterValue(field) }] }); }} disabled={disabled || !collection.fields.length || view.filters.length >= WEBSITE_CMS_LIMITS.filters}><Plus size={13} />{l('Add filter')} {view.filters.length}/{WEBSITE_CMS_LIMITS.filters}</button>
              <input className={control} type="number" min={1} max={500} value={view.limit || ''} onChange={(event) => updateView({ limit: event.target.value ? Number(event.target.value) : undefined })} placeholder={l('Entry limit')} />
            </div>;
          })}
          <div className="flex gap-2"><input className={control} value={newViewName} onChange={(event) => setNewViewName(event.target.value)} placeholder={l('View name')} maxLength={80} /><button type="button" className={button} onClick={addView} disabled={disabled || !newViewName.trim() || collection.views.length >= WEBSITE_CMS_LIMITS.views}><Plus size={14} /></button></div>
        </div>

        <div className="space-y-2 rounded-xl border border-white/10 p-3">
          <strong className="text-[11px] text-white">{l('Dynamic page')}</strong>
          <p className="text-[9px] leading-4 text-gray-500">{l('Publish the active page once for every published entry in this collection.')}</p>
          {activePage?.cmsTemplate?.collectionId === collection.id && <>
            <label className="block text-[9px] text-gray-400">{l('Reusable view')}<select className={`${control} mt-1`} value={activePage.cmsTemplate.viewId || ''} onChange={(event) => onSetPageTemplate({ ...activePage.cmsTemplate!, viewId: event.target.value || undefined })}><option value="">{l('All published entries')}</option>{collection.views.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}</select></label>
            <label className="block text-[9px] text-gray-400">{l('Route pattern')}<input className={`${control} mt-1`} value={activePage.cmsTemplate.routePattern || `${collection.slug}-{slug}`} onChange={(event) => onSetPageTemplate({ ...activePage.cmsTemplate!, routePattern: event.target.value })} placeholder="{collection}-{slug}" /></label>
          </>}
          <button type="button" className={`${button} w-full`} onClick={() => onSetPageTemplate(activePage?.cmsTemplate?.collectionId === collection.id ? undefined : { collectionId: collection.id, routePattern: `${collection.slug}-{slug}` })} disabled={disabled || !activePage}>
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
            {boundField?.type === 'reference' && <select className={control} value={binding?.referenceFieldKey || ''} onChange={(event) => binding && onBindElement({ ...binding, referenceFieldKey: event.target.value || undefined })}><option value="">{l('Referenced entry ID')}</option>{boundReferenceCollection?.fields.map((field) => <option key={field.id} value={field.key}>{field.name}</option>)}</select>}
            {selectedElement.type === 'button' && binding && <select className={control} value={binding.target} onChange={(event) => onBindElement({ ...binding, target: event.target.value as WebsiteCmsBinding['target'] })}><option value="content">{l('Button label')}</option><option value="href">{l('Button link')}</option></select>}
            {binding && <button type="button" className={`${button} w-full`} onClick={() => onBindElement(undefined)} disabled={disabled}><Unlink size={13} />{l('Remove binding')}</button>}
          </>}
        </div>
      </>}
    </div>
  );
}
