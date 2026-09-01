import { supabase } from '@/lib/supabase';

export const TEMPLATE_LIBRARY_PAGE_SIZE = 36;
export const TEMPLATE_LIBRARY_MAX_PAGE_SIZE = 60;

export type TemplateLibraryUsageMode = 'builder-native' | 'download-reference';

export type TemplateLibraryAssetKind =
  | 'spreadsheet'
  | 'document'
  | 'presentation'
  | 'pdf'
  | 'image'
  | 'data'
  | 'archive'
  | 'text'
  | 'builder-native'
  | 'other';

export interface TemplateLibraryAsset {
  id: string;
  title: string;
  category: string;
  format: string;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  sourceUrl: string;
  kind: TemplateLibraryAssetKind;
  usageMode: TemplateLibraryUsageMode;
  updatedAt: string | null;
}

export interface TemplateLibraryFilters {
  search?: string;
  category?: string;
  format?: string;
  offset?: number;
  limit?: number;
  signal?: AbortSignal;
}

export interface TemplateLibraryPage {
  assets: TemplateLibraryAsset[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

type TemplateAssetRow = {
  id: string;
  title?: string | null;
  category?: string | null;
  format?: string | null;
  original_filename?: string | null;
  storage_path?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  source_download_url?: string | null;
  updated_at?: string | null;
  metadata?: unknown;
};

const BUILDER_NATIVE_FORMATS = new Set(['tayar', 'tayar-json', 'website-json']);
const SPREADSHEET_FORMATS = new Set(['xlsx', 'xls', 'csv']);
const DOCUMENT_FORMATS = new Set(['docx', 'doc']);
const PRESENTATION_FORMATS = new Set(['pptx', 'ppt']);
const IMAGE_FORMATS = new Set(['png', 'jpg', 'jpeg']);

function normalizeText(value: unknown, maxLength = 300) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeFormat(value: unknown) {
  return normalizeText(value, 32).toLowerCase().replace(/[^a-z0-9-]+/g, '');
}

function normalizeOffset(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function normalizeLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return TEMPLATE_LIBRARY_PAGE_SIZE;
  return Math.min(TEMPLATE_LIBRARY_MAX_PAGE_SIZE, Math.floor(parsed));
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, match => `\\${match}`);
}

export function getTemplateLibraryAssetKind(formatInput: string): TemplateLibraryAssetKind {
  const format = normalizeFormat(formatInput);
  if (BUILDER_NATIVE_FORMATS.has(format)) return 'builder-native';
  if (SPREADSHEET_FORMATS.has(format)) return 'spreadsheet';
  if (DOCUMENT_FORMATS.has(format)) return 'document';
  if (PRESENTATION_FORMATS.has(format)) return 'presentation';
  if (format === 'pdf') return 'pdf';
  if (IMAGE_FORMATS.has(format)) return 'image';
  if (format === 'pbix') return 'data';
  if (format === 'zip') return 'archive';
  if (format === 'txt') return 'text';
  return 'other';
}

export function getTemplateLibraryUsageMode(formatInput: string): TemplateLibraryUsageMode {
  return BUILDER_NATIVE_FORMATS.has(normalizeFormat(formatInput))
    ? 'builder-native'
    : 'download-reference';
}

function mapTemplateAsset(row: TemplateAssetRow): TemplateLibraryAsset {
  const format = normalizeFormat(row.format);
  return {
    id: String(row.id),
    title: normalizeText(row.title) || normalizeText(row.original_filename) || 'Untitled template',
    category: normalizeText(row.category, 80) || 'uncategorized',
    format,
    originalFilename: normalizeText(row.original_filename) || 'template',
    storagePath: normalizeText(row.storage_path, 1200),
    mimeType: normalizeText(row.mime_type, 160) || 'application/octet-stream',
    fileSizeBytes: Math.max(0, Number(row.file_size_bytes) || 0),
    sourceUrl: normalizeText(row.source_download_url, 3000),
    kind: getTemplateLibraryAssetKind(format),
    usageMode: getTemplateLibraryUsageMode(format),
    updatedAt: normalizeText(row.updated_at, 80) || null,
  };
}

export async function listTemplateLibraryAssets(filters: TemplateLibraryFilters = {}): Promise<TemplateLibraryPage> {
  const offset = normalizeOffset(filters.offset);
  const limit = normalizeLimit(filters.limit);
  const search = normalizeText(filters.search, 120);
  const category = normalizeText(filters.category, 80);
  const format = normalizeFormat(filters.format);

  let query = supabase
    .from('template_assets')
    .select(
      'id,title,category,format,original_filename,storage_path,mime_type,file_size_bytes,source_download_url,updated_at,metadata',
      { count: 'exact' },
    )
    .eq('status', 'ready')
    .eq('is_public', true)
    .not('storage_path', 'is', null)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (search) query = query.ilike('title', `%${escapeLikePattern(search)}%`);
  if (category && category !== 'all') query = query.eq('category', category);
  if (format && format !== 'all') query = query.eq('format', format);

  if (filters.signal) query = query.abortSignal(filters.signal);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message || 'Could not load template library.');

  const assets = (Array.isArray(data) ? data : []).map(row => mapTemplateAsset(row as TemplateAssetRow));
  const total = Math.max(0, Number(count) || 0);

  return {
    assets,
    total,
    offset,
    limit,
    hasMore: offset + assets.length < total,
  };
}

export async function createTemplateLibraryDownloadUrl(
  asset: Pick<TemplateLibraryAsset, 'storagePath'>,
  expiresInSeconds = 300,
) {
  const storagePath = normalizeText(asset.storagePath, 1200);
  if (!storagePath || !storagePath.startsWith('24billions/')) {
    throw new Error('Template storage path is invalid.');
  }

  const safeExpiry = Math.max(60, Math.min(900, Math.floor(Number(expiresInSeconds) || 300)));
  const { data, error } = await supabase.storage
    .from('template-library')
    .createSignedUrl(storagePath, safeExpiry, { download: true });

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Could not create template download link.');
  }

  return data.signedUrl;
}
