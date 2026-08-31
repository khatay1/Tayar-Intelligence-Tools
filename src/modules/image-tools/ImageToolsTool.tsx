import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Download, Image as ImageIcon, Lock, RefreshCw, ShieldCheck, Unlock } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import {
  ToolField,
  ToolInputPanel,
  ToolOutputPanel,
  ToolShell,
  toolInputClass,
} from '../shared/ToolShell';
import {
  ImageOutputFormat,
  ImageSourceInfo,
  OUTPUT_FORMATS,
} from './image-types';
import {
  inspectImage,
  processImage,
  safeOutputName,
} from './image-processing';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ImageToolsTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<ImageSourceInfo | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [outputUrl, setOutputUrl] = useState('');
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [format, setFormat] = useState<ImageOutputFormat>('image/webp');
  const [quality, setQuality] = useState(0.82);
  const [aspectLocked, setAspectLocked] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const selectedFormat = useMemo(
    () => OUTPUT_FORMATS.find((item) => item.value === format) || OUTPUT_FORMATS[2],
    [format],
  );

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => () => {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
  }, [outputUrl]);

  function clearOutput() {
    setOutputBlob(null);
    setOutputUrl('');
  }

  async function loadFile(nextFile: File | null) {
    if (!nextFile) return;
    setError('');
    clearOutput();

    try {
      const info = await inspectImage(nextFile);
      const nextPreviewUrl = URL.createObjectURL(nextFile);
      setFile(nextFile);
      setSource(info);
      setWidth(info.width);
      setHeight(info.height);
      setPreviewUrl(nextPreviewUrl);
    } catch (caught) {
      setFile(null);
      setSource(null);
      setPreviewUrl('');
      setError(caught instanceof Error ? caught.message : l('Could not read this image.'));
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    void loadFile(event.target.files?.[0] || null);
    event.target.value = '';
  }

  function changeWidth(nextWidth: number) {
    if (!source) return;
    const safeWidth = Math.max(1, Math.round(nextWidth || 1));
    setWidth(safeWidth);
    if (aspectLocked) {
      setHeight(Math.max(1, Math.round(safeWidth * source.height / source.width)));
    }
    clearOutput();
  }

  function changeHeight(nextHeight: number) {
    if (!source) return;
    const safeHeight = Math.max(1, Math.round(nextHeight || 1));
    setHeight(safeHeight);
    if (aspectLocked) {
      setWidth(Math.max(1, Math.round(safeHeight * source.width / source.height)));
    }
    clearOutput();
  }

  async function handleProcess() {
    if (!file || !source) return;
    setProcessing(true);
    setError('');
    clearOutput();

    try {
      const blob = await processImage(file, { width, height, format, quality });
      setOutputBlob(blob);
      setOutputUrl(URL.createObjectURL(blob));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : l('Image processing failed.'));
    } finally {
      setProcessing(false);
    }
  }

  function downloadResult() {
    if (!outputBlob || !outputUrl || !source) return;
    const anchor = document.createElement('a');
    anchor.href = outputUrl;
    anchor.download = safeOutputName(source.name, selectedFormat.extension);
    anchor.rel = 'noopener';
    anchor.click();
  }

  return (
    <ToolShell
      icon={ImageIcon}
      title={l('Image Tools')}
      description={l('Resize, compress and convert images directly in your browser.')}
      badge="Local processing"
    >
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex gap-3 text-sm text-emerald-100">
        <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">{l('Processed locally')}</div>
          <div className="text-emerald-200/60 text-xs mt-0.5">
            {l('Your image stays in this browser. Tayar does not upload it for these operations.')}
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-6 items-start">
        <ToolInputPanel>
          <ToolField label={l('Source image')}>
            <label className="block rounded-xl border border-dashed border-white/15 bg-white/[0.025] hover:bg-white/[0.05] p-5 text-center cursor-pointer transition-colors">
              <ImageIcon className="w-7 h-7 text-violet-400 mx-auto mb-2" />
              <div className="text-sm text-white font-medium">{l('Choose JPEG, PNG or WebP')}</div>
              <div className="text-xs text-gray-500 mt-1">{l('Maximum 20 MB · bounded pixel processing')}</div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </ToolField>

          {source && (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs text-gray-400">
                <div className="text-white font-medium truncate">{source.name}</div>
                <div className="mt-1">{source.width} × {source.height}px · {formatBytes(source.size)}</div>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                <ToolField label={l('Width')}>
                  <input
                    type="number"
                    min="1"
                    max="12000"
                    value={width}
                    onChange={(event) => changeWidth(Number(event.target.value))}
                    className={toolInputClass}
                  />
                </ToolField>
                <button
                  type="button"
                  onClick={() => setAspectLocked((locked) => !locked)}
                  className="mb-0.5 h-[42px] w-[42px] rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-300 transition-colors"
                  title={l(aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio')}
                >
                  {aspectLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </button>
                <ToolField label={l('Height')}>
                  <input
                    type="number"
                    min="1"
                    max="12000"
                    value={height}
                    onChange={(event) => changeHeight(Number(event.target.value))}
                    className={toolInputClass}
                  />
                </ToolField>
              </div>

              <ToolField label={l('Output format')}>
                <select
                  value={format}
                  onChange={(event) => {
                    setFormat(event.target.value as ImageOutputFormat);
                    clearOutput();
                  }}
                  className={toolInputClass}
                >
                  {OUTPUT_FORMATS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
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
                    onChange={(event) => {
                      setQuality(Number(event.target.value));
                      clearOutput();
                    }}
                    className="w-full accent-violet-500"
                  />
                </ToolField>
              )}

              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-200">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleProcess()}
                disabled={processing}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
                {l(processing ? 'Processing...' : 'Process Image')}
              </button>
            </>
          )}

          {!source && error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}
        </ToolInputPanel>

        <ToolOutputPanel
          loading={processing}
          hasContent={Boolean(source)}
          empty={<div className="py-16 text-center text-sm text-gray-600">{l('Choose an image to start.')}</div>}
        >
          {source && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">{l('Original')}</div>
                  <div className="rounded-xl overflow-hidden bg-black/20 border border-white/10 min-h-[220px] flex items-center justify-center">
                    {previewUrl && <img src={previewUrl} alt={l('Original preview')} className="max-h-[420px] max-w-full object-contain" />}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">{l('Result')}</div>
                  <div className="rounded-xl overflow-hidden bg-black/20 border border-white/10 min-h-[220px] flex items-center justify-center">
                    {outputUrl ? (
                      <img src={outputUrl} alt={l('Processed preview')} className="max-h-[420px] max-w-full object-contain" />
                    ) : (
                      <div className="text-xs text-gray-600 text-center px-6">{l('Process the image to preview the result.')}</div>
                    )}
                  </div>
                </div>
              </div>

              {outputBlob && (
                <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-sm">
                    <div className="text-white font-medium">{selectedFormat.label} · {width} × {height}px</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {formatBytes(outputBlob.size)}
                      {source.size > 0 && ` · ${Math.round((1 - outputBlob.size / source.size) * 100)}% size change`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={downloadResult}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    {l('Download')}
                  </button>
                </div>
              )}
            </div>
          )}
        </ToolOutputPanel>
      </div>
    </ToolShell>
  );
}
