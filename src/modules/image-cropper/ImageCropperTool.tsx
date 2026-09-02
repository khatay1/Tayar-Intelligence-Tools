import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Crop, Download, ShieldCheck } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import {
  ToolField,
  ToolInputPanel,
  ToolOutputPanel,
  ToolShell,
  toolInputClass,
} from '../shared/ToolShell';
import { OUTPUT_FORMATS, ImageOutputFormat, ImageSourceInfo } from '../image-tools/image-types';
import { inspectImage } from '../image-tools/image-processing';
import CropPreview from './CropPreview';
import {
  cropForRatio,
  cropImage,
  cropOutputName,
  initialCropRect,
  validateCropRect,
} from './crop-processing';
import { CROP_PRESETS, CropPresetId, CropRect } from './crop-types';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ImageCropperTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<ImageSourceInfo | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 1, height: 1 });
  const [preset, setPreset] = useState<CropPresetId>('free');
  const [format, setFormat] = useState<ImageOutputFormat>('image/png');
  const [quality, setQuality] = useState(0.9);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const selectedFormat = useMemo(
    () => OUTPUT_FORMATS.find((item) => item.value === format) || OUTPUT_FORMATS[1],
    [format],
  );

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);

  useEffect(() => () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  }, [resultUrl]);

  function clearResult() {
    setResultBlob(null);
    setResultUrl('');
  }

  async function loadFile(nextFile: File | null) {
    if (!nextFile) return;
    setError('');
    clearResult();

    try {
      const info = await inspectImage(nextFile);
      const initial = await initialCropRect(nextFile);
      const nextUrl = URL.createObjectURL(nextFile);
      setFile(nextFile);
      setSource(info);
      setSourceUrl(nextUrl);
      setCrop(initial);
      setPreset('free');
    } catch (caught) {
      setFile(null);
      setSource(null);
      setSourceUrl('');
      setError(caught instanceof Error ? caught.message : l('Could not read this image.'));
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    void loadFile(event.target.files?.[0] || null);
    event.target.value = '';
  }

  function applyPreset(nextPreset: CropPresetId) {
    if (!source) return;
    setPreset(nextPreset);
    const item = CROP_PRESETS.find((entry) => entry.id === nextPreset);
    setCrop(item?.ratio ? cropForRatio(source.width, source.height, item.ratio) : {
      x: 0,
      y: 0,
      width: source.width,
      height: source.height,
    });
    clearResult();
  }

  function updateCrop(key: keyof CropRect, value: number) {
    if (!source) return;
    const next = { ...crop, [key]: Math.max(key === 'width' || key === 'height' ? 1 : 0, Math.round(value || 0)) };
    setCrop(next);
    setPreset('free');
    clearResult();

    try {
      validateCropRect(next, source.width, source.height);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : l('Invalid crop area.'));
    }
  }

  async function exportCrop() {
    if (!file || !source) return;
    setProcessing(true);
    setError('');
    clearResult();

    try {
      validateCropRect(crop, source.width, source.height);
      const blob = await cropImage(file, crop, { format, quality });
      setResultBlob(blob);
      setResultUrl(URL.createObjectURL(blob));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : l('Could not crop this image.'));
    } finally {
      setProcessing(false);
    }
  }

  function downloadResult() {
    if (!resultBlob || !resultUrl || !source) return;
    const anchor = document.createElement('a');
    anchor.href = resultUrl;
    anchor.download = cropOutputName(source.name, selectedFormat.extension);
    anchor.rel = 'noopener';
    anchor.click();
  }

  return (
    <ToolShell
      icon={Crop}
      title={l('Image Cropper')}
      description={l('Crop images locally with precise coordinates or common aspect ratios.')}
      badge={l('Local processing')}
    >
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex gap-3 text-sm text-emerald-100">
        <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">{l('Processed locally')}</div>
          <div className="text-emerald-200/60 text-xs mt-0.5">
            {l('The source image and crop result stay inside your browser.')}
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[390px_minmax(0,1fr)] gap-6 items-start">
        <ToolInputPanel>
          <label className="block rounded-xl border border-dashed border-white/15 bg-white/[0.025] hover:bg-white/[0.05] p-5 text-center cursor-pointer transition-colors">
            <Crop className="w-7 h-7 text-violet-400 mx-auto mb-2" />
            <div className="text-sm text-white font-medium">{l('Choose JPEG, PNG or WebP')}</div>
            <div className="text-xs text-gray-500 mt-1">{l('Maximum 20 MB')}</div>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} className="hidden" />
          </label>

          {source && (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs text-gray-400">
                <div className="text-white font-medium truncate">{source.name}</div>
                <div className="mt-1">{source.width} × {source.height}px · {formatBytes(source.size)}</div>
              </div>

              <ToolField label={l('Aspect ratio')}>
                <div className="grid grid-cols-3 gap-2">
                  {CROP_PRESETS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => applyPreset(item.id)}
                      className={`rounded-lg border px-2 py-2 text-xs transition-colors ${
                        preset === item.id
                          ? 'border-violet-400/40 bg-violet-500/15 text-violet-200'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      {l(item.label)}
                    </button>
                  ))}
                </div>
              </ToolField>

              <div className="grid grid-cols-2 gap-3">
                {(['x', 'y', 'width', 'height'] as Array<keyof CropRect>).map((key) => (
                  <ToolField key={key} label={l(key.toUpperCase())}>
                    <input
                      type="number"
                      min={key === 'width' || key === 'height' ? 1 : 0}
                      value={crop[key]}
                      onChange={(event) => updateCrop(key, Number(event.target.value))}
                      className={toolInputClass}
                    />
                  </ToolField>
                ))}
              </div>

              <ToolField label={l('Output format')}>
                <select
                  value={format}
                  onChange={(event) => { setFormat(event.target.value as ImageOutputFormat); clearResult(); }}
                  className={toolInputClass}
                >
                  {OUTPUT_FORMATS.map((item) => <option key={item.value} value={item.value}>{l(item.label)}</option>)}
                </select>
              </ToolField>

              {format !== 'image/png' && (
                <ToolField label={`${l('Quality')} · ${Math.round(quality * 100)}%`}>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.01"
                    value={quality}
                    onChange={(event) => { setQuality(Number(event.target.value)); clearResult(); }}
                    className="w-full accent-violet-500"
                  />
                </ToolField>
              )}

              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-200">{error}</div>
              )}

              <button
                type="button"
                onClick={() => void exportCrop()}
                disabled={processing || Boolean(error)}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                <Crop className="w-4 h-4" />
                {l(processing ? 'Cropping...' : 'Crop Image')}
              </button>
            </>
          )}

          {!source && error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-200">{error}</div>
          )}
        </ToolInputPanel>

        <ToolOutputPanel
          loading={processing}
          hasContent={Boolean(source)}
          empty={<div className="py-16 text-center text-sm text-gray-600">{l('Choose an image to start cropping.')}</div>}
        >
          {source && sourceUrl && (
            <div className="space-y-5">
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">{l('Crop preview')}</div>
                <div className="flex justify-center">
                  <CropPreview
                    imageUrl={sourceUrl}
                    sourceWidth={source.width}
                    sourceHeight={source.height}
                    crop={crop}
                    alt={l('Crop preview')}
                  />
                </div>
              </div>

              {resultUrl && resultBlob && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">{l('Result')}</div>
                  <div className="rounded-xl overflow-hidden bg-black/20 border border-white/10 min-h-[220px] flex items-center justify-center">
                    <img src={resultUrl} alt={l('Cropped result')} className="max-h-[520px] max-w-full object-contain" />
                  </div>
                  <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm">
                      <div className="text-white font-medium">{crop.width} × {crop.height}px · {l(selectedFormat.label)}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{formatBytes(resultBlob.size)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={downloadResult}
                      className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      {l('Download')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </ToolOutputPanel>
      </div>
    </ToolShell>
  );
}
