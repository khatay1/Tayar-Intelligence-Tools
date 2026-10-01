import type { MediaOperationId, MediaOperationSettings } from './types';
import type { MediaStudioTextKey } from './i18n';

interface Props {
  operation: MediaOperationId;
  settings: MediaOperationSettings;
  onChange: (next: MediaOperationSettings) => void;
  darkMode: boolean;
  t: (key: MediaStudioTextKey) => string;
}

const TIME_RANGE = new Set<MediaOperationId>(['trim-video', 'video-to-gif']);
const TIMESTAMP = new Set<MediaOperationId>(['create-thumbnail']);
const DURATION = new Set<MediaOperationId>(['split-video', 'images-to-video', 'freeze-frame']);
const FPS = new Set<MediaOperationId>(['video-to-gif', 'gif-to-video', 'images-to-video', 'change-fps']);
const DIMENSIONS = new Set<MediaOperationId>(['video-to-gif', 'gif-to-video', 'images-to-video', 'audio-image-to-video', 'compress-video', 'resize-video', 'change-aspect-ratio']);
const VIDEO_FORMAT = new Set<MediaOperationId>([
  'gif-to-video', 'images-to-video', 'audio-image-to-video', 'trim-video', 'merge-videos', 'compress-video', 'convert-video',
  'add-audio', 'replace-audio', 'change-volume', 'fade-audio', 'change-speed', 'reverse-video', 'rotate-video', 'flip-video',
  'resize-video', 'crop-video', 'change-aspect-ratio', 'change-fps', 'burn-subtitles', 'add-text-watermark', 'add-image-watermark',
  'loop-video', 'freeze-frame',
]);
const QUALITY = new Set<MediaOperationId>([
  'gif-to-video', 'images-to-video', 'audio-image-to-video', 'trim-video', 'merge-videos', 'compress-video', 'convert-video',
  'add-audio', 'change-volume', 'fade-audio', 'change-speed', 'reverse-video', 'rotate-video', 'flip-video', 'resize-video',
  'crop-video', 'change-aspect-ratio', 'change-fps', 'burn-subtitles', 'add-text-watermark', 'add-image-watermark', 'loop-video', 'freeze-frame',
]);

export default function MediaSettingsPanel({ operation, settings, onChange, darkMode, t }: Props) {
  const fieldClass = `h-11 w-full rounded-xl border px-3 text-sm outline-none transition ${darkMode ? 'border-white/10 bg-white/[0.04] text-white focus:border-violet-400/60' : 'border-gray-200 bg-white text-gray-900 focus:border-violet-500'}`;
  const labelClass = `mb-1.5 block text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`;
  const set = <K extends keyof MediaOperationSettings>(key: K, value: MediaOperationSettings[K]) => onChange({ ...settings, [key]: value });
  const number = (key: keyof MediaOperationSettings, fallback = 0) => Number(settings[key] ?? fallback);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {TIME_RANGE.has(operation) && <>
        <label><span className={labelClass}>{t('start')}</span><input className={fieldClass} type="number" min="0" step="0.1" value={number('startSeconds')} onChange={e => set('startSeconds', Number(e.target.value))} /></label>
        <label><span className={labelClass}>{t('end')}</span><input className={fieldClass} type="number" min="0" step="0.1" value={number('endSeconds', 10)} onChange={e => set('endSeconds', Number(e.target.value))} /></label>
      </>}

      {TIMESTAMP.has(operation) && <label><span className={labelClass}>{t('start')}</span><input className={fieldClass} type="number" min="0" step="0.1" value={number('startSeconds')} onChange={e => set('startSeconds', Number(e.target.value))} /></label>}

      {DURATION.has(operation) && <label><span className={labelClass}>{t('duration')}</span><input className={fieldClass} type="number" min="0.1" step="0.1" value={number('durationSeconds', operation === 'images-to-video' ? 2 : 3)} onChange={e => set('durationSeconds', Number(e.target.value))} /></label>}

      {operation === 'video-to-images' && <label><span className={labelClass}>{t('frameInterval')}</span><input className={fieldClass} type="number" min="0.05" step="0.05" value={number('frameIntervalSeconds', 1)} onChange={e => set('frameIntervalSeconds', Number(e.target.value))} /></label>}

      {FPS.has(operation) && <label><span className={labelClass}>{t('fps')}</span><input className={fieldClass} type="number" min="1" max="120" value={number('fps', operation === 'video-to-gif' ? 12 : 24)} onChange={e => set('fps', Number(e.target.value))} /></label>}

      {DIMENSIONS.has(operation) && <>
        <label><span className={labelClass}>{t('width')}</span><input className={fieldClass} type="number" min="64" step="2" value={number('width', 1280)} onChange={e => set('width', Number(e.target.value))} /></label>
        {operation !== 'video-to-gif' && operation !== 'change-aspect-ratio' && <label><span className={labelClass}>{t('height')}</span><input className={fieldClass} type="number" min="64" step="2" value={number('height', 720)} onChange={e => set('height', Number(e.target.value))} /></label>}
      </>}

      {VIDEO_FORMAT.has(operation) && <label><span className={labelClass}>{t('format')}</span><select className={fieldClass} value={settings.format || 'mp4'} onChange={e => set('format', e.target.value)}><option value="mp4">MP4</option><option value="webm">WebM</option><option value="mov">MOV</option><option value="mkv">MKV</option><option value="avi">AVI</option></select></label>}

      {operation === 'extract-audio' && <label><span className={labelClass}>{t('format')}</span><select className={fieldClass} value={settings.audioFormat || 'mp3'} onChange={e => set('audioFormat', e.target.value)}><option value="mp3">MP3</option><option value="wav">WAV</option><option value="aac">AAC</option><option value="m4a">M4A</option><option value="ogg">OGG</option><option value="flac">FLAC</option></select></label>}

      {(operation === 'video-to-images' || operation === 'create-thumbnail') && <label><span className={labelClass}>{t('imageFormat')}</span><select className={fieldClass} value={settings.imageFormat || 'png'} onChange={e => set('imageFormat', e.target.value as MediaOperationSettings['imageFormat'])}><option value="png">PNG</option><option value="jpg">JPG</option><option value="webp">WebP</option></select></label>}

      {QUALITY.has(operation) && <label className="sm:col-span-2 xl:col-span-1"><span className={labelClass}>{t('quality')} · {Math.round(number('quality', 75))}%</span><input className="h-11 w-full accent-violet-500" type="range" min="20" max="100" value={number('quality', 75)} onChange={e => set('quality', Number(e.target.value))} /></label>}

      {operation === 'change-speed' && <label><span className={labelClass}>{t('speed')}</span><select className={fieldClass} value={settings.speed || 1} onChange={e => set('speed', Number(e.target.value))}><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option><option value="3">3×</option><option value="4">4×</option></select></label>}

      {operation === 'change-volume' && <label className="sm:col-span-2"><span className={labelClass}>{t('volume')} · {Math.round(number('volume', 1) * 100)}%</span><input className="h-11 w-full accent-violet-500" type="range" min="0" max="4" step="0.05" value={number('volume', 1)} onChange={e => set('volume', Number(e.target.value))} /></label>}

      {operation === 'fade-audio' && <>
        <label><span className={labelClass}>{t('fadeIn')}</span><input className={fieldClass} type="number" min="0" step="0.1" value={number('fadeInSeconds', 1)} onChange={e => set('fadeInSeconds', Number(e.target.value))} /></label>
        <label><span className={labelClass}>{t('fadeOut')}</span><input className={fieldClass} type="number" min="0" step="0.1" value={number('fadeOutSeconds', 1)} onChange={e => set('fadeOutSeconds', Number(e.target.value))} /></label>
      </>}

      {operation === 'rotate-video' && <label><span className={labelClass}>{t('rotation')}</span><select className={fieldClass} value={settings.rotation || 90} onChange={e => set('rotation', Number(e.target.value) as 90 | 180 | 270)}><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label>}

      {operation === 'flip-video' && <label><span className={labelClass}>{t('flip')}</span><select className={fieldClass} value={settings.flip || 'horizontal'} onChange={e => set('flip', e.target.value as 'horizontal' | 'vertical')}><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label>}

      {operation === 'change-aspect-ratio' && <label><span className={labelClass}>{t('aspectRatio')}</span><select className={fieldClass} value={settings.aspectRatio || '16:9'} onChange={e => set('aspectRatio', e.target.value)}><option value="16:9">16:9</option><option value="9:16">9:16</option><option value="1:1">1:1</option><option value="4:5">4:5</option><option value="21:9">21:9</option></select></label>}

      {operation === 'crop-video' && <>
        <label><span className={labelClass}>X</span><input className={fieldClass} type="number" min="0" value={number('cropX')} onChange={e => set('cropX', Number(e.target.value))} /></label>
        <label><span className={labelClass}>Y</span><input className={fieldClass} type="number" min="0" value={number('cropY')} onChange={e => set('cropY', Number(e.target.value))} /></label>
        <label><span className={labelClass}>{t('width')}</span><input className={fieldClass} type="number" min="2" value={number('cropWidth', 1280)} onChange={e => set('cropWidth', Number(e.target.value))} /></label>
        <label><span className={labelClass}>{t('height')}</span><input className={fieldClass} type="number" min="2" value={number('cropHeight', 720)} onChange={e => set('cropHeight', Number(e.target.value))} /></label>
      </>}

      {(operation === 'add-text-watermark' || operation === 'add-image-watermark') && <>
        {operation === 'add-text-watermark' && <label className="sm:col-span-2"><span className={labelClass}>{t('text')}</span><input className={fieldClass} type="text" value={settings.text || 'Tayar'} onChange={e => set('text', e.target.value)} /></label>}
        <label><span className={labelClass}>{t('position')}</span><select className={fieldClass} value={settings.position || 'bottom-right'} onChange={e => set('position', e.target.value as MediaOperationSettings['position'])}><option value="top-left">Top left</option><option value="top-right">Top right</option><option value="center">Center</option><option value="bottom-left">Bottom left</option><option value="bottom-right">Bottom right</option></select></label>
        <label><span className={labelClass}>{t('opacity')} · {Math.round(number('opacity', 0.8) * 100)}%</span><input className="h-11 w-full accent-violet-500" type="range" min="0.05" max="1" step="0.05" value={number('opacity', 0.8)} onChange={e => set('opacity', Number(e.target.value))} /></label>
      </>}

      {operation === 'loop-video' && <label><span className={labelClass}>{t('loopCount')}</span><input className={fieldClass} type="number" min="2" max="100" value={number('loopCount', 2)} onChange={e => set('loopCount', Number(e.target.value))} /></label>}
    </div>
  );
}
