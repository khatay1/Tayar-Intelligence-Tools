import { normalizeSlug } from './project-identifiers';
import { WEBSITE_CMS_LIMITS, type WebsiteCmsCollection, type WebsiteCmsEntry, type WebsiteCmsField, type WebsiteCmsState, type WebsiteCmsValue } from './website-cms';

export type WebsiteCmsImportMode = 'append' | 'replace';
export type WebsiteCmsTransferFormat = 'json' | 'csv';

export interface WebsiteCmsImportPreview {
  collection: WebsiteCmsCollection;
  warnings: string[];
  importedEntries: number;
  skippedEntries: number;
}

const FIELD_TYPES = new Set(['text', 'rich-text', 'number', 'boolean', 'date', 'image', 'url', 'reference']);
const RESERVED_COLUMNS = new Set(['id', '_draft', '_publishAt', '_unpublishAt']);

function uid(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

function safeKey(value: string, index: number): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `field_${index + 1}`;
}

function inferValue(value: string): WebsiteCmsValue {
  const trimmed = value.trim();
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === 'true';
  if (trimmed !== '' && Number.isFinite(Number(trimmed))) return Number(trimmed);
  return value;
}

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function parseWebsiteCmsCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { value += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(value); value = ''; }
    else if (char === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
    else value += char;
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted value.');
  if (value.length || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); }
  return rows.filter((candidate) => candidate.some((cell) => cell.trim() !== ''));
}

export function exportWebsiteCmsCollectionJson(collection: WebsiteCmsCollection): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), collection }, null, 2);
}

export function exportWebsiteCmsCollectionCsv(collection: WebsiteCmsCollection): string {
  const headers = ['id', ...collection.fields.map((field) => field.key), '_draft', '_publishAt', '_unpublishAt'];
  const rows = collection.entries.map((entry) => [entry.id, ...collection.fields.map((field) => entry.values[field.key] ?? ''), entry.draft, entry.publishAt ?? '', entry.unpublishAt ?? '']);
  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

function normalizeImportedCollection(raw: unknown, fallbackName: string): WebsiteCmsImportPreview {
  if (!raw || typeof raw !== 'object') throw new Error('Import file does not contain a CMS collection.');
  const source = ('collection' in raw && (raw as { collection?: unknown }).collection) || raw;
  if (!source || typeof source !== 'object') throw new Error('Import file does not contain a CMS collection.');
  const candidate = source as Partial<WebsiteCmsCollection>;
  const warnings: string[] = [];
  const fields: WebsiteCmsField[] = Array.isArray(candidate.fields) ? candidate.fields.slice(0, WEBSITE_CMS_LIMITS.fields).flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const field = item as Partial<WebsiteCmsField>;
    const type = FIELD_TYPES.has(String(field.type)) ? field.type as WebsiteCmsField['type'] : 'text';
    const key = safeKey(String(field.key || field.name || ''), index);
    return [{ id: uid('field'), name: String(field.name || key).slice(0, 80), key, type, required: Boolean(field.required), referenceCollectionId: type === 'reference' && field.referenceCollectionId ? String(field.referenceCollectionId) : undefined }];
  }) : [];
  if (!fields.length) throw new Error('Imported collection has no valid fields.');
  if (Array.isArray(candidate.fields) && candidate.fields.length > fields.length) warnings.push('Some fields were skipped because the collection field limit was reached.');
  const keys = new Set<string>();
  for (const field of fields) {
    let key = field.key;
    let suffix = 2;
    while (keys.has(key)) key = `${field.key}_${suffix++}`;
    field.key = key;
    keys.add(key);
  }
  const rawEntries = Array.isArray(candidate.entries) ? candidate.entries : [];
  const entries: WebsiteCmsEntry[] = rawEntries.slice(0, WEBSITE_CMS_LIMITS.entries).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const entry = item as Partial<WebsiteCmsEntry>;
    const rawValues = entry.values && typeof entry.values === 'object' ? entry.values : {};
    const values = Object.fromEntries(fields.map((field) => [field.key, (rawValues as Record<string, WebsiteCmsValue>)[field.key] ?? (field.type === 'boolean' ? false : field.type === 'number' ? 0 : '')]));
    return [{ id: uid('entry'), values, draft: entry.draft !== false, publishAt: typeof entry.publishAt === 'string' ? entry.publishAt : undefined, unpublishAt: typeof entry.unpublishAt === 'string' ? entry.unpublishAt : undefined }];
  });
  if (rawEntries.length > entries.length) warnings.push('Some entries were skipped because the collection entry limit was reached.');
  const slugField = fields.some((field) => field.key === candidate.slugField) ? String(candidate.slugField) : fields.find((field) => field.key === 'slug')?.key || fields[0].key;
  return { collection: { id: uid('collection'), name: String(candidate.name || fallbackName).slice(0, 80), slug: normalizeSlug(String(candidate.slug || fallbackName)) || `collection-${Date.now()}`, slugField, fields, entries, views: [] }, warnings, importedEntries: entries.length, skippedEntries: Math.max(0, rawEntries.length - entries.length) };
}

export function previewWebsiteCmsJsonImport(input: string, fallbackName = 'Imported collection'): WebsiteCmsImportPreview {
  return normalizeImportedCollection(JSON.parse(input), fallbackName);
}

export function previewWebsiteCmsCsvImport(input: string, fallbackName = 'Imported collection'): WebsiteCmsImportPreview {
  const rows = parseWebsiteCmsCsv(input);
  if (rows.length < 1) throw new Error('CSV file is empty.');
  const rawHeaders = rows[0].map((header) => header.trim());
  const used = new Set<string>();
  const fieldColumns = rawHeaders.map((header, index) => ({ header, index })).filter(({ header }) => header && !RESERVED_COLUMNS.has(header)).slice(0, WEBSITE_CMS_LIMITS.fields);
  const fields: WebsiteCmsField[] = fieldColumns.map(({ header }, index) => {
    const base = safeKey(header, index); let key = base; let suffix = 2; while (used.has(key)) key = `${base}_${suffix++}`; used.add(key);
    const sample = rows.slice(1, 21).map((row) => row[fieldColumns[index].index] || '').filter(Boolean);
    const type: WebsiteCmsField['type'] = sample.length && sample.every((value) => /^(true|false)$/i.test(value.trim())) ? 'boolean' : sample.length && sample.every((value) => Number.isFinite(Number(value))) ? 'number' : 'text';
    return { id: uid('field'), name: header.slice(0, 80), key, type, required: false };
  });
  if (!fields.length) throw new Error('CSV file has no usable field columns.');
  const warnings: string[] = [];
  if (fieldColumns.length < rawHeaders.filter((header) => header && !RESERVED_COLUMNS.has(header)).length) warnings.push('Some columns were skipped because the collection field limit was reached.');
  const dataRows = rows.slice(1);
  const entries = dataRows.slice(0, WEBSITE_CMS_LIMITS.entries).map((row) => {
    const values = Object.fromEntries(fieldColumns.map(({ index }, fieldIndex) => [fields[fieldIndex].key, inferValue(row[index] || '')]));
    const draftIndex = rawHeaders.indexOf('_draft');
    const publishIndex = rawHeaders.indexOf('_publishAt');
    const unpublishIndex = rawHeaders.indexOf('_unpublishAt');
    return { id: uid('entry'), values, draft: draftIndex < 0 ? true : row[draftIndex] !== 'false', publishAt: publishIndex >= 0 && row[publishIndex] ? row[publishIndex] : undefined, unpublishAt: unpublishIndex >= 0 && row[unpublishIndex] ? row[unpublishIndex] : undefined } satisfies WebsiteCmsEntry;
  });
  if (dataRows.length > entries.length) warnings.push('Some entries were skipped because the collection entry limit was reached.');
  const slugField = fields.find((field) => field.key === 'slug')?.key || fields[0].key;
  return { collection: { id: uid('collection'), name: fallbackName.slice(0, 80), slug: normalizeSlug(fallbackName) || `collection-${Date.now()}`, slugField, fields, entries, views: [] }, warnings, importedEntries: entries.length, skippedEntries: Math.max(0, dataRows.length - entries.length) };
}

export function applyWebsiteCmsCollectionImport(cms: WebsiteCmsState, preview: WebsiteCmsImportPreview, mode: WebsiteCmsImportMode, replaceCollectionId?: string): WebsiteCmsState {
  if (mode === 'replace' && replaceCollectionId) return { ...cms, collections: cms.collections.map((collection) => collection.id === replaceCollectionId ? { ...preview.collection, id: collection.id } : collection) };
  if (cms.collections.length >= WEBSITE_CMS_LIMITS.collections) throw new Error('CMS collection limit reached.');
  return { ...cms, collections: [...cms.collections, preview.collection] };
}
