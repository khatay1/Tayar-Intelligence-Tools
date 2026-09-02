import { useLocalizer } from '@/lib/ui-localization';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock3,
  Download,
  FileArchive,
  FileImage,
  FileText,
  Heart,
  Loader2,
  Presentation,
  RefreshCw,
  Search,
  Sheet,
} from 'lucide-react';
import {
  TEMPLATE_LIBRARY_PAGE_SIZE,
  createTemplateLibraryDownloadUrl,
  createTemplateLibraryPreviewUrl,
  listTemplateLibraryAssets,
  type TemplateLibraryAsset,
  type TemplateLibraryAssetKind,
} from '../services/templateLibraryService';

const FAVORITES_KEY = 'tayar-template-library-favorites-v1';
const RECENT_KEY = 'tayar-template-library-recent-v1';
const RECENT_LIMIT = 24;

const FORMAT_OPTIONS = [
  ['all', 'All'],
  ['xlsx', 'Excel'],
  ['xls', 'Legacy Excel'],
  ['docx', 'Word'],
  ['pptx', 'PowerPoint'],
  ['pdf', 'PDF'],
  ['png', 'PNG'],
  ['jpg', 'JPG'],
  ['pbix', 'Power BI'],
  ['zip', 'ZIP'],
] as const;

type LibraryView = 'all' | 'favorites' | 'recent';

function readStoredIds(key: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string').slice(0, 100)
      : [];
  } catch {
    return [];
  }
}

function writeStoredIds(key: string, ids: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Local persistence is optional; browsing must remain usable if storage is blocked.
  }
}

function iconForKind(kind: TemplateLibraryAssetKind) {
  if (kind === 'spreadsheet') return Sheet;
  if (kind === 'presentation') return Presentation;
  if (kind === 'image') return FileImage;
  if (kind === 'archive') return FileArchive;
  return FileText;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function BuilderTemplateLibraryPanel() {
  const l = useLocalizer();
const [assets, setAssets] = useState<TemplateLibraryAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [format, setFormat] = useState('all');
  const [view, setView] = useState<LibraryView>('all');
  const [favorites, setFavorites] = useState<string[]>(() => readStoredIds(FAVORITES_KEY));
  const [recent, setRecent] = useState<string[]>(() => readStoredIds(RECENT_KEY));
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadPage = useCallback(async (offset: number, append: boolean) => {
    const requestId = ++requestRef.current;
    if (append) setLoadingMore(true);
    else setLoading(true);
    if (!append) setError(null);

    try {
      const page = await listTemplateLibraryAssets({
        search: debouncedSearch,
        format,
        offset,
        limit: TEMPLATE_LIBRARY_PAGE_SIZE,
      });

      if (requestRef.current !== requestId) return;
      setAssets(current => append ? [...current, ...page.assets] : page.assets);
      setTotal(page.total);
    } catch (loadError) {
      if (requestRef.current !== requestId) return;
      setError(loadError instanceof Error ? loadError.message : 'Could not load templates.');
      if (!append) {
        setAssets([]);
        setTotal(0);
      }
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [debouncedSearch, format]);

  useEffect(() => {
    void loadPage(0, false);
    return () => {
      requestRef.current += 1;
    };
  }, [loadPage]);

  useEffect(() => {
    let cancelled = false;
    const imageAssets = assets.filter(asset => asset.kind === 'image' && !previewUrls[asset.id]).slice(0, 12);
    if (!imageAssets.length) return undefined;

    void Promise.all(
      imageAssets.map(async asset => [asset.id, await createTemplateLibraryPreviewUrl(asset)] as const),
    ).then(entries => {
      if (cancelled) return;
      const resolved = entries.reduce<Record<string, string>>((next, [id, url]) => {
        if (url) next[id] = url;
        return next;
      }, {});
      if (Object.keys(resolved).length) {
        setPreviewUrls(current => ({ ...current, ...resolved }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [assets, previewUrls]);

  const visibleAssets = useMemo(() => {
    if (view === 'all') return assets;
    const order = view === 'favorites' ? favorites : recent;
    const byId = new Map(assets.map(asset => [asset.id, asset]));
    return order.map(id => byId.get(id)).filter((asset): asset is TemplateLibraryAsset => Boolean(asset));
  }, [assets, favorites, recent, view]);

  const hasMore = view === 'all' && assets.length < total;
  const summary = useMemo(() => {
    if (loading && assets.length === 0) return 'Loading library…';
    if (view === 'favorites') return `${visibleAssets.length} saved favorite${visibleAssets.length === 1 ? '' : 's'}`;
    if (view === 'recent') return `${visibleAssets.length} recent template${visibleAssets.length === 1 ? '' : 's'}`;
    if (!total) return 'No matching templates';
    return `${assets.length.toLocaleString()} of ${total.toLocaleString()} templates`;
  }, [assets.length, loading, total, view, visibleAssets.length]);

  function toggleFavorite(assetId: string) {
    setFavorites(current => {
      const next = current.includes(assetId)
        ? current.filter(id => id !== assetId)
        : [assetId, ...current].slice(0, 100);
      writeStoredIds(FAVORITES_KEY, next);
      return next;
    });
  }

  function markRecent(assetId: string) {
    setRecent(current => {
      const next = [assetId, ...current.filter(id => id !== assetId)].slice(0, RECENT_LIMIT);
      writeStoredIds(RECENT_KEY, next);
      return next;
    });
  }

  async function downloadAsset(asset: TemplateLibraryAsset) {
    if (downloadId) return;
    setDownloadId(asset.id);
    setError(null);

    try {
      const url = await createTemplateLibraryDownloadUrl(asset);
      markRecent(asset.id);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.rel = 'noopener noreferrer';
      anchor.target = '_blank';
      anchor.click();
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Could not download template.');
    } finally {
      setDownloadId(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div>
        <div className="text-sm font-semibold text-white">{l('Template Library')}</div>
        <p className="mt-1 text-[11px] leading-4 text-gray-500">
          Browse imported assets safely. Office, PDF and archive files download as references; Tayar-native website formats can be opened directly when available.
        </p>
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search templates"
          className="w-full rounded-lg border border-white/10 bg-black/20 py-2 pl-8 pr-3 text-xs text-white outline-none placeholder:text-gray-600 focus:border-cyan-500/50"
        />
      </label>

      <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-black/15 p-1">
        {([
          ['all', 'All'],
          ['favorites', 'Favorites'],
          ['recent', 'Recent'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setView(value)}
            className={`rounded-md px-2 py-1.5 text-[10px] font-medium ${
              view === value ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <select
          value={format}
          onChange={event => setFormat(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs text-gray-300 outline-none"
        >
          {FORMAT_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void loadPage(0, false)}
          disabled={loading || loadingMore}
          title="Refresh library"
          className="rounded-lg border border-white/10 p-2 text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-600">
        <span>{summary}</span>
        <span>{format === 'all' ? 'All formats' : format.toUpperCase()}</span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-[11px] text-red-300">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {loading && assets.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
          </div>
        ) : visibleAssets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-gray-500">
            {view === 'favorites'
              ? 'No favorites yet.'
              : view === 'recent'
                ? 'Templates you download will appear here.'
                : 'No templates match this search.'}
          </div>
        ) : (
          visibleAssets.map(asset => {
            const Icon = iconForKind(asset.kind);
            const downloading = downloadId === asset.id;
            const favorite = favorites.includes(asset.id);
            const previewUrl = previewUrls[asset.id];

            return (
              <article key={asset.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
                {previewUrl && (
                  <div className="aspect-[16/9] overflow-hidden border-b border-white/10 bg-black/20">
                    <img
                      src={previewUrl}
                      alt={asset.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                <div className="p-3">
                  <div className="flex items-start gap-2.5">
                    <div className="rounded-lg bg-white/5 p-2 text-cyan-300">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-gray-200" title={asset.title}>{asset.title}</div>
                      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-gray-600">
                        <span>{asset.format.toUpperCase() || 'FILE'}</span>
                        <span>{formatBytes(asset.fileSizeBytes)}</span>
                        <span>{asset.category}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFavorite(asset.id)}
                      aria-label={l(favorite ? 'Remove from favorites' : 'Add to favorites')}
                      title={l(favorite ? 'Remove from favorites' : 'Add to favorites')}
                      className={`rounded-md p-1.5 ${favorite ? 'text-pink-300' : 'text-gray-600 hover:text-gray-300'}`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${favorite ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  {recent.includes(asset.id) && (
                    <div className="mt-2 inline-flex items-center gap-1 text-[9px] text-gray-600">
                      <Clock3 className="h-3 w-3" /> {l('Recently used')}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => void downloadAsset(asset)}
                    disabled={Boolean(downloadId)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-medium text-gray-300 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                  >
                    {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    {asset.usageMode === 'builder-native' ? 'Open template' : 'Download template'}
                  </button>
                </div>
              </article>
            );
          })
        )}

        {hasMore && (
          <button
            type="button"
            onClick={() => void loadPage(assets.length, true)}
            disabled={loadingMore || loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-40"
          >
            {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Load more
          </button>
        )}
      </div>
    </div>
  );
}
