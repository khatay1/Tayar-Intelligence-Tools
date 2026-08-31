import { ChangeEvent, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Download,
  FileArchive,
  Images,
  Loader2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import { ToolField, ToolInputPanel, ToolOutputPanel, ToolShell, toolInputClass } from '../shared/ToolShell';
import { OUTPUT_FORMATS, ImageOutputFormat } from '../image-tools/image-types';
import { buildBatchZip, downloadBlob } from './batch-download';
import { processBatch, validateBatchFiles } from './batch-processing';
import { BatchImageResult, MAX_BATCH_FILES } from './batch-types';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function BatchImageTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<ImageOutputFormat>('image/webp');
  const [quality, setQuality] = useState(0.82);
  const [maxSide, setMaxSide] = useState(0);
  const [results, setResults] = useState<BatchImageResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState('');
  const [buildingZip, setBuildingZip] = useState(false);

  const totalInputBytes = useMemo(
    () => files.reduce((sum, file) => sum + file.size, 0),
    [files],
  );
  const totalOutputBytes = useMemo(
    () => results.reduce((sum, result) => sum + result.blob.size, 0),
    [results],
  );

  function resetResults() {
    setResults([]);
    setProgress({ completed: 0, total: 0 });
  }

  function addFiles(next: File[]) {
    setError('');
    resetResults();

    const combined = [...files, ...next].slice(0, MAX_BATCH_FILES);
    try {
      validateBatchFiles(combined);
      setFiles(combined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : l('Could not add these images.'));
    }
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files || []));
    event.target.value = '';
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    resetResults();
    setError('');
  }

  function moveFile(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= files.length) return;

    setFiles((current) => {
      const next = [...current];
      const item = next[index];
      next[index] = next[target];
      next[target] = item;
      return next;
    });
    resetResults();
  }

  async function runBatch() {
    if (!files.length) return;
    setProcessing(true);
    setError('');
    resetResults();

    try {
      const next = await processBatch(
        files,
        { format, quality, maxSide },
        (completed, total) => setProgress({ completed, total }),
      );
      setResults(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : l('Batch processing failed.'));
    } finally {
      setProcessing(false);
    }
  }

  async function downloadZip() {
    if (!results.length) return;
    setBuildingZip(true);
    setError('');

    try {
      const zip = await buildBatchZip(results);
      downloadBlob(zip, 'tayar-images.zip');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : l('Could not create the ZIP file.'));
    } finally {
      setBuildingZip(false);
    }
  }

  return (
    <ToolShell
      icon={Images}
      title={l('Batch Image Converter')}
      description={l('Convert and resize multiple images locally, then download them individually or as one ZIP.')}
      badge="Local batch"
    >
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex gap-3 text-sm text-emerald-100">
        <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">{l('Processed locally')}</div>
          <div className="text-emerald-200/60 text-xs mt-0.5">
            {l('Images and ZIP creation stay in your browser. Tayar does not upload files for this tool.')}
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[390px_minmax(0,1fr)] gap-6 items-start">
        <ToolInputPanel>
          <label className="block rounded-xl border border-dashed border-white/15 bg-white/[0.025] hover:bg-white/[0.05] p-5 text-center cursor-pointer transition-colors">
            <Images className="w-7 h-7 text-violet-400 mx-auto mb-2" />
            <div className="text-sm text-white font-medium">{l('Add JPEG, PNG or WebP images')}</div>
            <div className="text-xs text-gray-500 mt-1">
              {l('Up to 20 files · 80 MB combined source limit')}
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFiles}
              className="hidden"
            />
          </label>

          {files.length > 0 && (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-xs text-gray-400">
                {files.length} / {MAX_BATCH_FILES} {l('files')} · {formatBytes(totalInputBytes)}
              </div>

              <ToolField label={l('Output format')}>
                <select
                  value={format}
                  onChange={(event) => { setFormat(event.target.value as ImageOutputFormat); resetResults(); }}
                  className={toolInputClass}
                >
                  {OUTPUT_FORMATS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </ToolField>

              <ToolField label={l('Maximum side (0 keeps original size)')}>
                <input
                  type="number"
                  min="0"
                  max="6000"
                  step="100"
                  value={maxSide}
                  onChange={(event) => { setMaxSide(Math.max(0, Number(event.target.value) || 0)); resetResults(); }}
                  className={toolInputClass}
                />
              </ToolField>

              {format !== 'image/png' && (
                <ToolField label={`${l('Quality')} · ${Math.round(quality * 100)}%`}>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.01"
                    value={quality}
                    onChange={(event) => { setQuality(Number(event.target.value)); resetResults(); }}
                    className="w-full accent-violet-500"
                  />
                </ToolField>
              )}

              <button
                type="button"
                onClick={() => void runBatch()}
                disabled={processing}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Images className="w-4 h-4" />}
                {l(processing ? 'Processing...' : 'Process All')}
              </button>

              {processing && progress.total > 0 && (
                <div className="text-xs text-gray-500 text-center">
                  {progress.completed} / {progress.total}
                </div>
              )}
            </>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}
        </ToolInputPanel>

        <ToolOutputPanel
          loading={processing}
          hasContent={files.length > 0}
          empty={<div className="py-16 text-center text-sm text-gray-600">{l('Add multiple images to start.')}</div>}
        >
          {files.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-white font-semibold">{l(results.length ? 'Processed files' : 'Processing order')}</div>
                  <div className="text-xs text-gray-500">
                    {l(results.length ? `${results.length} outputs · ${formatBytes(totalOutputBytes)}` : 'Use the arrows to control output order.')}
                  </div>
                </div>

                {results.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void downloadZip()}
                    disabled={buildingZip}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
                  >
                    {buildingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4" />}
                    {l(buildingZip ? 'Building ZIP...' : 'Download All ZIP')}
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {(results.length ? results.map((result) => ({
                  name: result.sourceName,
                  output: result,
                })) : files.map((file) => ({ name: file.name, output: null }))).map((item, index) => (
                  <div
                    key={`${index}-${item.name}`}
                    className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3 flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                      <Images className="w-4 h-4 text-violet-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white truncate">{item.name}</div>
                      {item.output ? (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {item.output.width} × {item.output.height}px · {formatBytes(item.output.blob.size)}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-600 mt-0.5">{formatBytes(files[index].size)}</div>
                      )}
                    </div>

                    {item.output ? (
                      <button
                        type="button"
                        onClick={() => downloadBlob(item.output!.blob, item.output!.outputName)}
                        className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label={l('Download')}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveFile(index, -1)}
                          disabled={index === 0}
                          className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 disabled:opacity-25 transition-colors"
                          aria-label={l('Move up')}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFile(index, 1)}
                          disabled={index === files.length - 1}
                          className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 disabled:opacity-25 transition-colors"
                          aria-label={l('Move down')}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="p-2 rounded-lg text-gray-500 hover:text-red-300 hover:bg-white/10 transition-colors"
                          aria-label={l('Remove')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </ToolOutputPanel>
      </div>
    </ToolShell>
  );
}
