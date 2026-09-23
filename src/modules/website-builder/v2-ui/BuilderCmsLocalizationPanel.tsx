import { useEffect, useMemo, useState } from 'react';
import { Languages, RotateCcw } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import { PAGE_LANGUAGE_LABELS } from '../core/project-identifiers';
import { WEBSITE_CMS_LANGUAGES, type WebsiteCmsCollection, type WebsiteCmsEntry, type WebsiteCmsState, type WebsiteCmsValue } from '../core/website-cms';
import type { Language } from '@/context/PreferencesContext';

interface BuilderCmsLocalizationPanelProps {
  cms: WebsiteCmsState;
  disabled?: boolean;
  onChange(cms: WebsiteCmsState, label: string): void;
}

const control = 'w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white outline-none focus:border-violet-400';
const button = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-[11px] font-semibold text-gray-200 hover:border-violet-400/60 hover:text-white disabled:opacity-40';
const LOCALIZABLE_FIELD_TYPES = new Set(['text', 'rich-text', 'date', 'image', 'url']);

function updateCollection(cms: WebsiteCmsState, collectionId: string, updater: (collection: WebsiteCmsCollection) => WebsiteCmsCollection): WebsiteCmsState {
  return { ...cms, collections: cms.collections.map((collection) => collection.id === collectionId ? updater(collection) : collection) };
}

function updateLocalizedEntryValue(entry: WebsiteCmsEntry, language: Language, fieldKey: string, value: WebsiteCmsValue | undefined): WebsiteCmsEntry {
  const localizedValues = { ...(entry.localizedValues || {}) };
  const languageValues = { ...(localizedValues[language] || {}) };
  if (value === undefined || value === '') delete languageValues[fieldKey];
  else languageValues[fieldKey] = value;
  if (Object.keys(languageValues).length) localizedValues[language] = languageValues;
  else delete localizedValues[language];
  return { ...entry, localizedValues: Object.keys(localizedValues).length ? localizedValues : undefined };
}

export function BuilderCmsLocalizationPanel({ cms, disabled, onChange }: BuilderCmsLocalizationPanelProps) {
  const l = useLocalizer();
  const [collectionId, setCollectionId] = useState(cms.collections[0]?.id || '');
  const [entryId, setEntryId] = useState('');
  const [language, setLanguage] = useState<Language>('sv');
  const collection = cms.collections.find((item) => item.id === collectionId) || cms.collections[0];
  const entry = collection?.entries.find((item) => item.id === entryId) || collection?.entries[0];
  const localizableFields = useMemo(() => collection?.fields.filter((field) => LOCALIZABLE_FIELD_TYPES.has(field.type)) || [], [collection]);
  const translatedCount = entry ? localizableFields.filter((field) => {
    const value = entry.localizedValues?.[language]?.[field.key];
    return value !== undefined && value !== '';
  }).length : 0;

  useEffect(() => {
    if (collection && collection.id !== collectionId) setCollectionId(collection.id);
    if (collection && (!entryId || !collection.entries.some((item) => item.id === entryId))) setEntryId(collection.entries[0]?.id || '');
  }, [collection, collectionId, entryId]);

  if (!cms.collections.length) return null;

  const commitEntry = (updater: (current: WebsiteCmsEntry) => WebsiteCmsEntry, label: string) => {
    if (!collection || !entry) return;
    onChange(updateCollection(cms, collection.id, (current) => ({
      ...current,
      entries: current.entries.map((candidate) => candidate.id === entry.id ? updater(candidate) : candidate),
    })), label);
  };

  const copyDefaults = () => {
    if (!entry) return;
    commitEntry((current) => {
      let next = current;
      for (const field of localizableFields) {
        const value = current.values[field.key];
        if (value !== undefined && value !== '') next = updateLocalizedEntryValue(next, language, field.key, value);
      }
      return next;
    }, `Copy CMS defaults to ${language.toUpperCase()}`);
  };

  const clearLanguage = () => {
    if (!entry?.localizedValues?.[language]) return;
    commitEntry((current) => {
      const localizedValues = { ...(current.localizedValues || {}) };
      delete localizedValues[language];
      return { ...current, localizedValues: Object.keys(localizedValues).length ? localizedValues : undefined };
    }, `Clear CMS ${language.toUpperCase()} overrides`);
  };

  return <div className="space-y-2 rounded-xl border border-violet-400/20 bg-violet-500/5 p-3" data-testid="builder-cms-localization-panel">
    <div className="flex items-center justify-between gap-2">
      <strong className="inline-flex items-center gap-1.5 text-[11px] text-white"><Languages size={13} />{l('Multilingual CMS content')}</strong>
      <span className="text-[9px] text-violet-300">{translatedCount}/{localizableFields.length}</span>
    </div>
    <p className="text-[9px] leading-4 text-gray-400">{l('Add language-specific values and slugs. Missing translations automatically use the default CMS value.')}</p>
    <div className="grid grid-cols-2 gap-2">
      <select className={control} value={collection?.id || ''} onChange={(event) => { setCollectionId(event.target.value); setEntryId(''); }} disabled={disabled} aria-label={l('CMS collection')}>
        {cms.collections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <select className={control} value={language} onChange={(event) => setLanguage(event.target.value as Language)} disabled={disabled} aria-label={l('Content language')}>
        {WEBSITE_CMS_LANGUAGES.map((item) => <option key={item} value={item}>{PAGE_LANGUAGE_LABELS[item]}</option>)}
      </select>
    </div>
    {collection?.entries.length ? <select className={control} value={entry?.id || ''} onChange={(event) => setEntryId(event.target.value)} disabled={disabled} aria-label={l('CMS entry')}>
      {collection.entries.map((item, index) => <option key={item.id} value={item.id}>{String(item.values.title || item.values.name || `${l('Entry')} ${index + 1}`)}</option>)}
    </select> : <div className="rounded-lg border border-white/10 px-2 py-2 text-[9px] text-gray-500">{l('Add an entry before creating translations.')}</div>}

    {entry && <>
      <div className="flex gap-2">
        <button type="button" className={`${button} flex-1`} onClick={copyDefaults} disabled={disabled || !localizableFields.length}>{l('Copy default values')}</button>
        <button type="button" className={button} onClick={clearLanguage} disabled={disabled || !entry.localizedValues?.[language]} title={l('Use default fallback for every field')}><RotateCcw size={12} /></button>
      </div>
      <div className="space-y-2" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        {localizableFields.map((field) => {
          const override = entry.localizedValues?.[language]?.[field.key];
          const fallback = entry.values[field.key];
          const sharedProps = {
            className: `${control} mt-1`,
            value: String(override ?? ''),
            placeholder: fallback == null ? '' : String(fallback),
            disabled,
          };
          return <div key={field.id} className="rounded-lg border border-white/10 bg-black/10 p-2">
            <div className="flex items-center justify-between gap-2 text-[9px] text-gray-300">
              <span>{field.name}{field.key === collection.slugField ? ` · ${l('Localized slug')}` : ''}</span>
              {override !== undefined && override !== '' && <button type="button" className="text-violet-300 hover:text-white" onClick={() => commitEntry((current) => updateLocalizedEntryValue(current, language, field.key, undefined), `Use CMS fallback for ${field.name}`)} disabled={disabled}>{l('Use fallback')}</button>}
            </div>
            {field.type === 'rich-text'
              ? <textarea {...sharedProps} className={`${sharedProps.className} min-h-20`} onChange={(event) => commitEntry((current) => updateLocalizedEntryValue(current, language, field.key, event.target.value), `Translate CMS ${field.name}`)} />
              : <input {...sharedProps} type={field.type === 'date' ? 'date' : field.type === 'image' || field.type === 'url' ? 'url' : 'text'} onChange={(event) => commitEntry((current) => updateLocalizedEntryValue(current, language, field.key, event.target.value), `Translate CMS ${field.name}`)} />}
            <div className="mt-1 text-[8px] text-gray-500">{l('Fallback')}: {fallback == null || fallback === '' ? l('Empty') : String(fallback).slice(0, 120)}</div>
          </div>;
        })}
      </div>
      {!localizableFields.length && <div className="text-[9px] text-gray-500">{l('This collection has no localizable fields.')}</div>}
    </>}
  </div>;
}
