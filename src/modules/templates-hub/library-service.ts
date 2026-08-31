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

export async function listMirroredTemplates(limit = 200): Promise<MirroredTemplateAsset[]> {
  const safeLimit = Math.max(1, Math.min(500, Math.round(limit)));

  const { data, error } = await supabase
    .from('template_assets')
    .select('id,title,category,format,original_filename,storage_path,mime_type,file_size_bytes,sha256,source_page_url')
    .eq('status', 'ready')
    .eq('is_public', true)
    .not('storage_path', 'is', null)
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) throw error;

  return (data || []).map((asset) => ({
    id: String(asset.id),
    title: String(asset.title || ''),
    category: String(asset.category || 'uncategorized'),
    format: String(asset.format || 'file'),
    originalFilename: String(asset.original_filename || ''),
    storagePath: String(asset.storage_path || ''),
    mimeType: asset.mime_type ? String(asset.mime_type) : null,
    fileSizeBytes: Number.isFinite(Number(asset.file_size_bytes)) ? Number(asset.file_size_bytes) : null,
    sha256: asset.sha256 ? String(asset.sha256) : null,
    sourcePageUrl: asset.source_page_url ? String(asset.source_page_url) : null,
  }));
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
