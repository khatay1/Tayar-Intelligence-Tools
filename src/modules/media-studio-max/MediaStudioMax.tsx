import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Download,
  FileVideo,
  Image as ImageIcon,
  Loader2,
  Music,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { usePreferences } from '@/context/PreferencesContext';
import { MEDIA_GROUPS, MEDIA_OPERATIONS, getMediaOperation } from './catalog';
import { acceptForKinds, createMediaSource, disposeSources, formatBytes } from './file-utils';
import { mediaEngine } from './media-engine';
import { mediaStudioText, type MediaStudioTextKey } from './i18n';
import { getLocalizedOperation } from './operation-i18n';
import MediaSettingsPanel from './MediaSettingsPanel';
import { createMediaResultsZip } from './zip-results';
import type {
  MediaInputKind,
  MediaOperationGroup,
  MediaOperationId,
  MediaOperationSettings,
  MediaResult,
  MediaSourceFile,
} from './types';

interface Props {
  darkMode: boolean;
}

type GroupFilter = 'all' | MediaOperationGroup;

function matchesKind(source: MediaSourceFile, required: MediaInputKind) {
  if (required === 'videos') return source.kind === 'video';
  if (required === 'images') return source.kind === 'image' || source.kind === 'gif';
  if (required === 'image') return source.kind === 'image' || source.kind === 'gif';
  return source.kind === required;
}

function orderedSources(operationId: MediaOperationId, sources: MediaSourceFile[]) {
  const operation = getMediaOperation(operationId);
  if (!operation) return sources;
  if (operation.input.includes('videos')) return sources.filter(source => source.kind === 'video');
  if (operation.input.includes('images')) return sources.filter(source => source.kind === 'image' || source.kind === 'gif');

  const used = new Set<string>();
  const ordered: MediaSourceFile[] = [];
  for (const required of operation.input) {
    const match = sources.find(source => !used.has(source.id) && matchesKind(source, required));
    if (match) {
      used.add(match.id);
      ordered.push(match);
    }
  }
  return ordered;
}

function localizedValidation(language: 'en' | 'ar' | 'sv', operationId: MediaOperationId, sources: MediaSourceFile[]) {
  const operation = getMediaOperation(operationId);
  if (!operation) return language === 'ar' ? 'الأداة غير معروفة.' : language === 'sv' ? 'Okänt verktyg.' : 'Unknown tool.';
  if (operation.input.includes('videos') && sources.filter(source => source.kind === 'video').length < 2) {
    return language === 'ar' ? 'اختر فيديوهين على الأقل.' : language === 'sv' ? 'Välj minst två videor.' : 'Choose at least two videos.';
  }
  if (operation.input.includes('images') && sources.filter(source => source.kind === 'image' || source.kind === 'gif').length < 2) {
    return language === 'ar' ? 'اختر صورتين على الأقل.' : language === 'sv' ? 'Välj minst två bilder.' : 'Choose at least two images.';
  }
  for (const required of operation.input.filter(kind => kind !== 'videos' && kind !== 'images')) {
    if (!sources.some(source => matchesKind(source, required))) {
      const labels = {
        en: { video: 'video', audio: 'audio file', image: 'image', gif: 'GIF', subtitle: 'subtitle file' },
        ar: { video: 'فيديو', audio: 'ملف صوت', image: 'صورة', gif: 'GIF', subtitle: 'ملف ترجمة' },
        sv: { video: 'video', audio: 'ljudfil', image: 'bild', gif: 'GIF', subtitle: 'undertextfil' },
      } as const;
      const label = labels[language][required as keyof typeof labels.en] || required;
      return language === 'ar' ? `اختر ${label} مطلوبًا لهذه العملية.` : language === 'sv' ? `Välj en ${label} som krävs för verktyget.` : `Choose the required ${label}.`;
    }
  }
  return null;
}

function defaultSettings(operation: MediaOperationId): MediaOperationSettings {
  return {
    startSeconds: 0,
    endSeconds: 10,
    durationSeconds: operation === 'images-to-video' ? 2 : 3,
    fps: operation === 'video-to-gif' ? 12 : 24,
    width: 1280,
    height: 720,
    quality: 75,
    speed: 1,
    volume: 1,
    format: 'mp4',
    audioFormat: 'mp3',
    imageFormat: 'png',
    frameIntervalSeconds: 1,
    loopCount: 2,
    rotation: 90,
    flip: 'horizontal',
    aspectRatio: '16:9',
    position: 'bottom-right',
    opacity: 0.8,
    fadeInSeconds: 1,
    fadeOutSeconds: 1,
  };
}

function downloadResult(result: MediaResult) {
  const anchor = document.createElement('a');
  anchor.href = result.previewUrl;
  anchor.download = result.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export default function MediaStudioMax({ darkMode }: Props) {
  const { prefs } = usePreferences();
  const language = prefs.language;
  const t = (key: MediaStudioTextKey) => mediaStudioText(language, key);
  const [operationId, setOperationId] = useState<MediaOperationId>('video-to-gif');
  const [group, setGroup] = useState<GroupFilter>('all');
  const [query, setQuery] = useState('');
  const [sources, setSources] = useState<MediaSourceFile[]>([]);
  const [settings, setSettings] = useState<MediaOperationSettings>(() => defaultSettings('video-to-gif'));
  const [results, setResults] = useState<MediaResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [engineStatus, setEngineStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourcesRef = useRef<MediaSourceFile[]>([]);
  const resultsRef = useRef<MediaResult[]>([]);

  const operation = getMediaOperation(operationId)!;
  const localizedOperation = getLocalizedOperation(operationId, language);

  const filteredOperations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(language);
    return MEDIA_OPERATIONS.filter(item => {
      if (group !== 'all' && item.group !== group) return false;
      if (!normalized) return true;
      const copy = getLocalizedOperation(item.id, language);
      return `${copy.name} ${copy.description} ${item.id}`.toLocaleLowerCase(language).includes(normalized);
    });
  }, [group, query, language]);

  useEffect(() => { sourcesRef.current = sources; }, [sources]);
  useEffect(() => { resultsRef.current = results; }, [results]);
  useEffect(() => () => {
    disposeSources(sourcesRef.current);
    resultsRef.current.forEach(result => URL.revokeObjectURL(result.previewUrl));
  }, []);

  function clearResults() {
    setResults(current => {
      current.forEach(result => URL.revokeObjectURL(result.previewUrl));
      return [];
    });
    setProgress(0);
  }

  function chooseOperation(next: MediaOperationId) {
    if (processing) return;
    disposeSources(sources);
    setSources([]);
    clearResults();
    setError(null);
    setOperationId(next);
    setSettings(defaultSettings(next));
  }

  async function addFiles(files: File[]) {
    if (!files.length || processing) return;
    setError(null);
    clearResults();
    const created = await Promise.all(files.map(createMediaSource));
    if (operation.acceptsMultiple || operation.input.length > 1) {
      setSources(current => [...current, ...created]);
      return;
    }
    const [first, ...unused] = created;
    disposeSources(unused);
    setSources(current => {
      disposeSources(current);
      return first ? [first] : [];
    });
  }

  function removeSource(id: string) {
    if (processing) return;
    setSources(current => {
      const removed = current.find(source => source.id === id);
      if (removed) URL.revokeObjectURL(removed.objectUrl);
      return current.filter(source => source.id !== id);
    });
    clearResults();
  }

  function clearSources() {
    if (processing) return;
    disposeSources(sources);
    setSources([]);
    clearResults();
    setError(null);
  }

  async function processMedia() {
    const validation = localizedValidation(language, operationId, sources);
    if (validation) {
      setError(validation);
      return;
    }

    const prepared = orderedSources(operationId, sources);
    setProcessing(true);
    setProgress(0);
    setError(null);
    clearResults();

    try {
      setEngineStatus(mediaEngine.isLoaded() ? 'ready' : 'loading');
      await mediaEngine.load({ onProgress: value => setProgress(value) });
      setEngineStatus('ready');
      const nextResults = await mediaEngine.process(operationId, prepared, settings, {
        onProgress: value => setProgress(value),
      });
      setResults(nextResults);
      setProgress(1);
    } catch (cause) {
      setEngineStatus(mediaEngine.isLoaded() ? 'ready' : 'failed');
      const message = cause instanceof Error ? cause.message : t('operationFailed');
      setError(message === 'Selected video has no audio track.' ? t('noAudioTrack') : message);
    } finally {
      setProcessing(false);
    }
  }

  async function downloadAllResults() {
    try {
      setError(null);
      const entries = await Promise.all(results.map(async result => ({
        name: result.name,
        data: new Uint8Array(await result.blob.arrayBuffer()),
      })));
      const zip = createMediaResultsZip(entries);
      const url = URL.createObjectURL(zip);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `tayar-media-${operationId}-results.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('operationFailed'));
    }
  }

  function cancelProcessing() {
    mediaEngine.cancel();
    setProcessing(false);
    setProgress(0);
    setEngineStatus('idle');
  }

  const card = darkMode ? 'border-white/10 bg-white/[0.035]' : 'border-gray-200 bg-white';
  const muted = darkMode ? 'text-gray-400' : 'text-gray-600';

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="mx-auto max-w-[1500px] space-y-5 pb-12">
      <section className={`relative overflow-hidden rounded-3xl border p-5 sm:p-7 ${card}`}>
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300"><Sparkles className="h-3.5 w-3.5" /> MAX</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" /> {t('privacy')}</span>
            </div>
            <h1 className={`text-2xl font-black tracking-tight sm:text-3xl ${darkMode ? 'text-white' : 'text-gray-950'}`}>{t('title')}</h1>
            <p className={`mt-2 max-w-2xl text-sm leading-6 sm:text-base ${muted}`}>{t('subtitle')}</p>
          </div>
          <div className={`min-w-0 rounded-2xl border px-4 py-3 text-sm ${darkMode ? 'border-white/10 bg-black/20' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4 text-emerald-400" /> {t('local')}</div>
            <p className={`mt-1 max-w-md text-xs leading-5 ${muted}`}>{t('privacyNote')}</p>
          </div>
        </div>
      </section>

      <section className={`rounded-3xl border p-4 sm:p-5 ${card}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <Search className={`pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('search')} className={`h-11 w-full rounded-xl border bg-transparent ps-10 pe-3 text-sm outline-none ${darkMode ? 'border-white/10 text-white placeholder:text-gray-600 focus:border-violet-400/60' : 'border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-violet-500'}`} />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
            {(['all', ...MEDIA_GROUPS.map(item => item.id)] as GroupFilter[]).map(id => (
              <button key={id} type="button" onClick={() => setGroup(id)} className={`h-10 shrink-0 rounded-xl px-3 text-xs font-semibold transition ${group === id ? 'bg-violet-600 text-white' : darkMode ? 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {id === 'all' ? t('all') : t(id)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid max-h-[390px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredOperations.map(item => {
            const copy = getLocalizedOperation(item.id, language);
            const active = item.id === operationId;
            return (
              <button key={item.id} type="button" disabled={processing} onClick={() => chooseOperation(item.id)} className={`min-h-28 rounded-2xl border p-4 text-start transition ${active ? 'border-violet-400/60 bg-violet-500/15 shadow-[0_0_28px_rgba(139,92,246,0.08)]' : darkMode ? 'border-white/8 bg-black/10 hover:border-white/20 hover:bg-white/[0.05]' : 'border-gray-200 bg-gray-50 hover:border-violet-300 hover:bg-white'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-violet-500/20 text-violet-300' : darkMode ? 'bg-white/5 text-gray-400' : 'bg-white text-gray-500'}`}><Video className="h-4 w-4" /></div>
                  {item.recommended && <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400">{t('recommended')}</span>}
                </div>
                <div className={`mt-3 text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{copy.name}</div>
                <p className={`mt-1 line-clamp-2 text-xs leading-5 ${muted}`}>{copy.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={`rounded-3xl border p-4 sm:p-5 ${card}`}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-400">{t('chooseTool')}</p>
              <h2 className={`mt-1 text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-950'}`}>{localizedOperation.name}</h2>
              <p className={`mt-1 text-sm leading-6 ${muted}`}>{localizedOperation.description}</p>
            </div>
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${darkMode ? 'bg-violet-500/10 text-violet-300' : 'bg-violet-50 text-violet-600'}`}><FileVideo className="h-5 w-5" /></div>
          </div>

          <input ref={fileInputRef} type="file" className="hidden" accept={acceptForKinds(operation.input)} multiple={Boolean(operation.acceptsMultiple || operation.input.length > 1)} onChange={event => { void addFiles(Array.from(event.target.files || [])); event.currentTarget.value = ''; }} />
          <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void addFiles(Array.from(event.dataTransfer.files)); }} className={`rounded-2xl border border-dashed p-6 text-center transition ${darkMode ? 'border-violet-400/25 bg-violet-500/[0.04]' : 'border-violet-200 bg-violet-50/50'}`}>
            <Upload className="mx-auto h-8 w-8 text-violet-400" />
            <p className={`mt-3 text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t('drop')}</p>
            <p className={`mt-1 text-xs ${muted}`}>{t('inputHint')}</p>
            <button type="button" disabled={processing} onClick={() => fileInputRef.current?.click()} className="mt-4 min-h-11 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50">{sources.length ? t('addFiles') : t('chooseFiles')}</button>
          </div>

          {sources.length > 0 && <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-3"><h3 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t('selectedFiles')} · {sources.length}</h3><button type="button" disabled={processing} onClick={clearSources} className="min-h-10 px-2 text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50">{t('clear')}</button></div>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {sources.map(source => (
                <div key={source.id} className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 ${darkMode ? 'border-white/8 bg-black/15' : 'border-gray-200 bg-gray-50'}`}>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${darkMode ? 'bg-white/5' : 'bg-white'}`}>{source.kind === 'audio' ? <Music className="h-4 w-4 text-fuchsia-400" /> : source.kind === 'image' || source.kind === 'gif' ? <ImageIcon className="h-4 w-4 text-cyan-400" /> : <Video className="h-4 w-4 text-violet-400" />}</div>
                  <div className="min-w-0 flex-1"><div className={`truncate text-xs font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{source.file.name}</div><div className={`mt-0.5 text-[11px] ${muted}`}>{formatBytes(source.file.size)}{source.duration ? ` · ${source.duration.toFixed(1)}s` : ''}{source.width && source.height ? ` · ${source.width}×${source.height}` : ''}</div></div>
                  <button type="button" disabled={processing} onClick={() => removeSource(source.id)} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${darkMode ? 'text-gray-500 hover:bg-white/5 hover:text-white' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </div>}
        </div>

        <div className={`rounded-3xl border p-4 sm:p-5 ${card}`}>
          <div className="mb-4 flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-violet-400" /><h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-950'}`}>{t('settings')}</h2></div>
          <MediaSettingsPanel operation={operationId} settings={settings} onChange={setSettings} darkMode={darkMode} t={t} />

          <div className={`mt-5 rounded-2xl border p-3.5 ${darkMode ? 'border-amber-400/10 bg-amber-500/[0.04]' : 'border-amber-200 bg-amber-50'}`}><p className={`text-xs leading-5 ${darkMode ? 'text-amber-200/80' : 'text-amber-800'}`}>{t('memoryNote')}</p></div>

          {error && <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-words">{error}</span></div>}

          {processing && <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className={muted}>{engineStatus === 'loading' ? t('engineLoading') : t('processing')}</span><span className="font-semibold text-violet-400">{Math.round(progress * 100)}%</span></div>
            <div className={`h-2 overflow-hidden rounded-full ${darkMode ? 'bg-white/5' : 'bg-gray-100'}`}><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all" style={{ width: `${Math.max(2, progress * 100)}%` }} /></div>
          </div>}

          <div className="mt-5 flex gap-3">
            <button type="button" disabled={processing || !sources.length} onClick={() => void processMedia()} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 text-sm font-bold text-white shadow-lg shadow-violet-900/20 transition hover:from-violet-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-40">{processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{processing ? t('processing') : t('process')}</button>
            {processing && <button type="button" onClick={cancelProcessing} className={`min-h-12 rounded-xl border px-4 text-sm font-semibold ${darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>{t('cancel')}</button>}
          </div>
        </div>
      </section>

      <section className={`rounded-3xl border p-4 sm:p-5 ${card}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-400">{results.length > 1 ? t('results') : t('result')}</p>
            <h2 className={`mt-1 text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-950'}`}>{results.length ? `${t('done')} · ${results.length}` : t('outputPreview')}</h2>
          </div>
          <div className="flex items-center gap-2">
            {results.length > 1 && <button type="button" onClick={() => void downloadAllResults()} className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition ${darkMode ? 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}><Archive className="h-4 w-4" /> {t('downloadAll')}</button>}
            {results.length > 0 && <CheckCircle2 className="h-6 w-6 text-emerald-400" />}
          </div>
        </div>

        {!results.length ? <div className={`mt-4 flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed ${darkMode ? 'border-white/8 bg-black/10' : 'border-gray-200 bg-gray-50'}`}><FileVideo className={`h-8 w-8 ${darkMode ? 'text-gray-700' : 'text-gray-300'}`} /><p className={`mt-3 text-sm ${muted}`}>{t('noResult')}</p></div> : <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {results.map(result => (
            <article key={result.previewUrl} className={`overflow-hidden rounded-2xl border ${darkMode ? 'border-white/8 bg-black/20' : 'border-gray-200 bg-gray-50'}`}>
              <div className={`flex min-h-40 items-center justify-center overflow-hidden ${darkMode ? 'bg-black/30' : 'bg-gray-100'}`}>
                {result.mimeType.startsWith('video/') ? <video src={result.previewUrl} controls className="max-h-72 w-full" /> : result.mimeType.startsWith('image/') ? <img src={result.previewUrl} alt="" className="max-h-72 w-full object-contain" /> : result.mimeType.startsWith('audio/') ? <audio src={result.previewUrl} controls className="w-[90%]" /> : <FileVideo className="h-10 w-10 text-violet-400" />}
              </div>
              <div className="flex min-w-0 items-center gap-3 p-3"><div className="min-w-0 flex-1"><p className={`truncate text-xs font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{result.name}</p><p className={`mt-0.5 text-[11px] ${muted}`}>{formatBytes(result.blob.size)}</p></div><button type="button" onClick={() => downloadResult(result)} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-500"><Download className="h-3.5 w-3.5" /> {t('download')}</button></div>
            </article>
          ))}
        </div>}
      </section>
    </div>
  );
}
