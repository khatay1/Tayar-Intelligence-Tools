export type EditorMediaKind = 'image' | 'video' | 'file';
export type EditorMediaOrigin = 'upload' | 'ai' | 'stock' | 'external';

export interface EditorMediaAsset {
  id: string;
  kind: EditorMediaKind;
  origin: EditorMediaOrigin;
  url: string;
  name: string;
  alt?: string;
  width?: number;
  height?: number;
  createdAt?: number;
  tags?: string[];
}

export interface EditorMediaFilter {
  query?: string;
  kind?: EditorMediaKind | 'all';
  origin?: EditorMediaOrigin | 'all';
}

export function sanitizeEditorMediaAsset(asset: EditorMediaAsset): EditorMediaAsset {
  const url = typeof asset.url === 'string' ? asset.url.trim() : '';
  if (!asset.id.trim()) throw new Error('Media asset id is required.');
  if (!url) throw new Error('Media asset URL is required.');
  return {
    ...asset,
    id: asset.id.trim(),
    name: asset.name.trim() || 'Untitled media',
    url,
    alt: asset.alt?.trim(),
    tags: asset.tags?.map((tag) => tag.trim()).filter(Boolean).slice(0, 30),
  };
}

export function filterEditorMediaAssets(assets: EditorMediaAsset[], filter: EditorMediaFilter = {}) {
  const query = filter.query?.trim().toLowerCase() || '';
  return assets.filter((asset) => {
    if (filter.kind && filter.kind !== 'all' && asset.kind !== filter.kind) return false;
    if (filter.origin && filter.origin !== 'all' && asset.origin !== filter.origin) return false;
    if (!query) return true;
    const haystack = [asset.name, asset.alt, ...(asset.tags || [])].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(query);
  });
}

export function mergeEditorMediaAssets(existing: EditorMediaAsset[], incoming: EditorMediaAsset[]) {
  const byId = new Map(existing.map((asset) => [asset.id, sanitizeEditorMediaAsset(asset)]));
  for (const asset of incoming) byId.set(asset.id, sanitizeEditorMediaAsset(asset));
  return Array.from(byId.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
