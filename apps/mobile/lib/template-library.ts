import { Directory, File, Paths } from 'expo-file-system';
import { supabase } from './supabase';

export type MobileTemplateAsset = {
  id: string;
  title: string;
  category: string;
  format: string;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
};

const TEMPLATE_BASE_URL = 'https://templates.tayar.se';
const TEMPLATE_PREFIX = '24billions/';

function safeStoragePath(value: unknown) {
  const path = String(value || '').trim();
  if (!path.startsWith(TEMPLATE_PREFIX) || path.startsWith('/') || path.includes('\\') || path.split('/').some((part) => part === '.' || part === '..')) {
    throw new Error('Template storage path is invalid.');
  }
  return path;
}

export function templateDownloadUrl(storagePath: string) {
  return `${TEMPLATE_BASE_URL}/${safeStoragePath(storagePath).split('/').map(encodeURIComponent).join('/')}`;
}

export async function listMobileTemplates(options: { query?: string; category?: string; format?: string; page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, Math.round(options.page || 1));
  const pageSize = Math.max(1, Math.min(40, Math.round(options.pageSize || 24)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const query = String(options.query || '').trim().slice(0, 100);
  const category = String(options.category || '').trim().slice(0, 80);
  const format = String(options.format || '').trim().toLowerCase().slice(0, 24);

  let request = supabase
    .from('template_assets')
    .select('id,title,category,format,original_filename,storage_path,mime_type,file_size_bytes', { count: 'exact' })
    .eq('status', 'ready')
    .eq('is_public', true)
    .not('storage_path', 'is', null);

  if (query) request = request.ilike('title', `%${query}%`);
  if (category && category !== 'all') request = request.eq('category', category);
  if (format && format !== 'all') request = request.eq('format', format);

  const { data, error, count } = await request.order('title', { ascending: true }).range(from, to);
  if (error) throw error;

  const items: MobileTemplateAsset[] = ((data || []) as Record<string, unknown>[]).map((asset) => ({
    id: String(asset.id || ''),
    title: String(asset.title || asset.original_filename || 'Template'),
    category: String(asset.category || 'uncategorized'),
    format: String(asset.format || 'file').toLowerCase(),
    originalFilename: String(asset.original_filename || 'template'),
    storagePath: safeStoragePath(asset.storage_path),
    mimeType: String(asset.mime_type || 'application/octet-stream'),
    fileSizeBytes: Math.max(0, Number(asset.file_size_bytes) || 0),
  }));
  const total = Math.max(0, Number(count || 0));
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

function safeFilename(name: string) {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120);
  return cleaned || 'template-file';
}

export async function downloadTemplateToWorkspace(asset: MobileTemplateAsset) {
  if (asset.fileSizeBytes > 50 * 1024 * 1024) throw new Error('This template is larger than the 50 MB mobile download limit.');
  const response = await fetch(templateDownloadUrl(asset.storagePath));
  if (!response.ok) throw new Error(`Template download failed (${response.status}).`);
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > 50 * 1024 * 1024) throw new Error('This template is larger than the 50 MB mobile download limit.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 50 * 1024 * 1024) throw new Error('This template is larger than the 50 MB mobile download limit.');

  const directory = new Directory(Paths.document, 'tayar-files');
  directory.create({ idempotent: true, intermediates: true });
  const file = new File(directory, `${Date.now()}-0-${safeFilename(asset.originalFilename || asset.title)}`);
  file.create();
  file.write(bytes);
  return file;
}

export function templateSize(bytes: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
