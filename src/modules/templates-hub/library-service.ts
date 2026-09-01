import { supabase } from '@/lib/supabase';

export interface MirroredTemplateAsset {
  id: string;
  title: string;
  category: string;
  format: string;
  originalFilename: string;
  storagePath: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  sha256: string | null;
  sourcePageUrl: string | null;
}

export interface MirroredTemplateQuery {
  query?: string;
  category?: string;
  format?: string;
  page?: number;
  pageSize?: number;
}

export interface MirroredTemplatePage {
  items: MirroredTemplateAsset[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const MAX_PAGE_SIZE = 100;

function normalizeAsset(asset: Record<string, unknown>): MirroredTemplateAsset {
  return {
    id: String(asset.id),
    title: String(asset.title || ''),
    category: String(asset.category || 'uncategorized'),
    format: String(asset.format || 'file'),
    originalFilename: String(asset.original_filename || ''),
    storagePath: String(asset.storage_path || ''),
    mimeType: asset.mime_type ? String(asset.mime_type) : null,
    fileSizeBytes: Number.isFinite(Number(asset.file_size_bytes))
      ? Number(asset.file_size_bytes)
      : null,
    sha256: asset.sha256 ? String(asset.sha256) : null,
    sourcePageUrl: asset.source_page_url ? String(asset.source_page_url) : null,
  };
}

export async function listMirroredTemplates(
  options: MirroredTemplateQuery = {},
): Promise<MirroredTemplatePage> {
  const page = Math.max(1, Math.round(options.page || 1));
  const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, Math.round(options.pageSize || 36)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const query = String(options.query || '').trim().slice(0, 120);
  const category = String(options.category || '').trim().slice(0, 80);
  const format = String(options.format || '').trim().slice(0, 24).toLowerCase();

  let request = supabase
    .from('template_assets')
    .select(
      'id,title,category,format,original_filename,storage_path,mime_type,file_size_bytes,sha256,source_page_url',
      { count: 'exact' },
    )
    .eq('status', 'ready')
    .eq('is_public', true)
    .not('storage_path', 'is', null);

  if (query) request = request.ilike('title', `%${query}%`);
  if (category && category !== 'all') request = request.eq('category', category);
  if (format && format !== 'all') request = request.eq('format', format);

  const { data, error, count } = await request
    .order('title', { ascending: true })
    .range(from, to);

  if (error) throw error;

  const total = Math.max(0, Number(count || 0));

  return {
    items: ((data || []) as Record<string, unknown>[]).map(normalizeAsset),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function publicTemplateUrl(storagePath: string) {
  if (!storagePath || storagePath.includes('..') || storagePath.startsWith('/')) {
    throw new Error('Invalid template storage path.');
  }

  const { data } = supabase.storage
    .from('template-library')
    .getPublicUrl(storagePath);

  if (!data.publicUrl) throw new Error('Template URL is unavailable.');
  return data.publicUrl;
}

export function formatTemplateBytes(bytes: number | null) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
