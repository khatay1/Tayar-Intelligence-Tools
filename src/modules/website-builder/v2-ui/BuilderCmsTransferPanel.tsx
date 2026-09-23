import { useRef, useState } from 'react';
import { Download, FileJson2, FileSpreadsheet, Upload } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import type { WebsiteCmsCollection, WebsiteCmsState } from '../core/website-cms';
import {
  applyWebsiteCmsCollectionImport,
  exportWebsiteCmsCollectionCsv,
  exportWebsiteCmsCollectionJson,
  previewWebsiteCmsCsvImport,
  previewWebsiteCmsJsonImport,
  type WebsiteCmsImportMode,
  type WebsiteCmsImportPreview,
  type WebsiteCmsTransferFormat,
} from '../core/website-cms-transfer';

interface BuilderCmsTransferPanelProps {
  cms: WebsiteCmsState;
  collection?: WebsiteCmsCollection;
  disabled?: boolean;
  onChange(cms: WebsiteCmsState, label: string): void;
  onImportedCollection?(collectionId: string): void;
}

const button = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-[11px] font-semibold text-gray-200 hover:border-violet-400/60 hover:text-white disabled:opacity-40';
const control = 'w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white outline-none focus:border-violet-400';

function downloadText(filename: string, mime: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function safeFilename(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'cms-collection';
}

export function BuilderCmsTransferPanel({ cms, collection, disabled, onChange, onImportedCollection }: BuilderCmsTransferPanelProps) {
  const l = useLocalizer();
  const fileRef = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState<WebsiteCmsTransferFormat>('json');
  const [mode, setMode] = useState<WebsiteCmsImportMode>('append');
  const [preview, setPreview] = useState<WebsiteCmsImportPreview>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const exportCollection = (nextFormat: WebsiteCmsTransferFormat) => {
    if (!collection) return;
    const base = safeFilename(collection.slug || collection.name);
    if (nextFormat === 'json') downloadText(`${base}.json`, 'application/json;charset=utf-8', exportWebsiteCmsCollectionJson(collection));
    else downloadText(`${base}.csv`, 'text/csv;charset=utf-8', exportWebsiteCmsCollectionCsv(collection));
  };

  const chooseFile = (nextFormat: WebsiteCmsTransferFormat) => {
    setFormat(nextFormat);
    setPreview(undefined);
    setError('');
    requestAnimationFrame(() => fileRef.current?.click());
  };

  const readFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error(l('Import file is too large'));
      const text = await file.text();
      const name = file.name.replace(/\.[^.]+$/, '') || l('Imported collection');
      const next = format === 'json' ? previewWebsiteCmsJsonImport(text, name) : previewWebsiteCmsCsvImport(text, name);
      setPreview(next);
    } catch (reason) {
      setPreview(undefined);
      setError(reason instanceof Error ? reason.message : l('Import validation failed'));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const applyImport = () => {
    if (!preview) return;
    try {
      const next = applyWebsiteCmsCollectionImport(cms, preview, mode, mode === 'replace' ? collection?.id : undefined);
      onChange(next, mode === 'replace' ? 'Replace CMS collection from import' : 'Import CMS collection');
      const importedId = mode === 'replace' && collection ? collection.id : preview.collection.id;
      onImportedCollection?.(importedId);
      setPreview(undefined);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : l('Import validation failed'));
    }
  };

  return <div className="space-y-2 rounded-xl border border-white/10 p-3" data-testid="builder-cms-transfer-panel">
    <div className="flex items-center justify-between gap-2"><strong className="text-[11px] text-white">{l('Import / Export')}</strong><span className="text-[9px] text-gray-500">JSON · CSV</span></div>
    <p className="text-[9px] leading-4 text-gray-500">{l('Preview and validate imported content before changing the project.')}</p>
    <div className="grid grid-cols-2 gap-2">
      <button type="button" className={button} onClick={() => exportCollection('json')} disabled={disabled || !collection}><FileJson2 size={13} />{l('Export JSON')}</button>
      <button type="button" className={button} onClick={() => exportCollection('csv')} disabled={disabled || !collection}><FileSpreadsheet size={13} />{l('Export CSV')}</button>
      <button type="button" className={button} onClick={() => chooseFile('json')} disabled={disabled || busy}><Upload size={13} />{l('Import JSON')}</button>
      <button type="button" className={button} onClick={() => chooseFile('csv')} disabled={disabled || busy}><Upload size={13} />{l('Import CSV')}</button>
    </div>
    <input ref={fileRef} className="hidden" type="file" accept={format === 'json' ? '.json,application/json' : '.csv,text/csv'} onChange={(event) => void readFile(event.target.files?.[0])} />
    {error && <div className="rounded-lg border border-red-400/20 bg-red-500/5 px-2 py-2 text-[10px] text-red-200" role="alert">{error}</div>}
    {preview && <div className="space-y-2 rounded-lg border border-violet-400/20 bg-violet-500/5 p-2" data-testid="cms-import-preview">
      <div className="flex items-center justify-between text-[10px]"><span className="font-semibold text-white">{l('Import preview')}</span><span className="text-violet-300">{preview.importedEntries} {l('Entries')}</span></div>
      <div className="text-[9px] text-gray-400">{preview.collection.fields.length} {l('Fields')} · {preview.collection.name}</div>
      {preview.warnings.map((warning) => <div key={warning} className="text-[9px] text-amber-200">• {warning}</div>)}
      <select className={control} value={mode} onChange={(event) => setMode(event.target.value as WebsiteCmsImportMode)}>
        <option value="append">{l('Import as new collection')}</option>
        <option value="replace" disabled={!collection}>{l('Replace collection')}</option>
      </select>
      <button type="button" className={`${button} w-full`} onClick={applyImport} disabled={disabled}><Download size={13} />{l('Apply import')}</button>
    </div>}
  </div>;
}
