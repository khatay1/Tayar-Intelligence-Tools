import { ChangeEvent, useEffect, useState } from 'react';
import { Download, Eraser, Loader2, ShieldAlert } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import { ToolInputPanel, ToolOutputPanel, ToolShell } from '../shared/ToolShell';
import {
  downloadRemoteResult,
  removeImageBackground,
  validateBackgroundFile,
} from './background-remover-client';
import {
  BackgroundRemovalResult,
  MAX_BACKGROUND_IMAGE_BYTES,
} from './background-remover-types';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function safeName(sourceName: string) {
  const base = sourceName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'image';
  return `${base}-no-background.png`;
}

export default function BackgroundRemoverTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [result, setResult] = useState<BackgroundRemovalResult | null>(null);
  const [cropToBbox, setCropToBbox] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);

  function loadFile(nextFile: File | null) {
    if (!nextFile) return;
    setError('');
    setResult(null);

    try {
      validateBackgroundFile(nextFile);
      setFile(nextFile);
      setSourceUrl(URL.createObjectURL(nextFile));
    } catch (caught) {
      setFile(null);
      setSourceUrl('');
      setError(caught instanceof Error ? caught.message : l('Could not use this image.'));
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    loadFile(event.target.files?.[0] || null);
    event.target.value = '';
  }

  async function removeBackground() {
    if (!file) return;
    setProcessing(true);
    setError('');
    setResult(null);

    try {
      setResult(await removeImageBackground(file, cropToBbox));
    } catch (caught) {
      setError(caught instanceof Error ? l(caught.message) : l('Background removal failed.'));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <ToolShell
      icon={Eraser}
      title={l('Background Remover')}
      description={l('Remove image backgrounds using Tayar’s secured server-side image service.')}
      badge={l('AI image utility')}
    >
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex gap-3 text-sm text-amber-100">
        <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">{l('External processing')}</div>
          <div className="text-amber-200/60 text-xs mt-0.5">
            {l('For this tool, your selected image is sent through Tayar’s authenticated server to fal.ai for background removal. Your API key is never exposed in the browser.')}
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[390px_minmax(0,1fr)] gap-6 items-start">
        <ToolInputPanel>
          <label className="block rounded-xl border border-dashed border-white/15 bg-white/[0.025] hover:bg-white/[0.05] p-5 text-center cursor-pointer transition-colors">
            <Eraser className="w-7 h-7 text-violet-400 mx-auto mb-2" />
            <div className="text-sm text-white font-medium">{l('Choose JPEG, PNG or WebP')}</div>
            <div className="text-xs text-gray-500 mt-1">
              {l(`Maximum ${Math.round(MAX_BACKGROUND_IMAGE_BYTES / 1024 / 1024)} MB for secured processing`)}
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFile}
              className="hidden"
            />
          </label>

          {file && (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs text-gray-400">
                <div className="text-white font-medium truncate">{file.name}</div>
                <div className="mt-1">{formatBytes(file.size)}</div>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2.5 cursor-pointer">
                <div>
                  <div className="text-sm text-gray-300">{l('Crop tightly around subject')}</div>
                  <div className="text-[11px] text-gray-600 mt-0.5">{l('Optional provider bounding-box crop')}</div>
                </div>
                <input
                  type="checkbox"
                  checked={cropToBbox}
                  onChange={(event) => setCropToBbox(event.target.checked)}
                  className="accent-violet-500"
                />
              </label>

              <button
                type="button"
                onClick={() => void removeBackground()}
                disabled={processing}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eraser className="w-4 h-4" />}
                {l(processing ? 'Removing Background...' : 'Remove Background')}
              </button>
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
          hasContent={Boolean(file)}
          empty={<div className="py-16 text-center text-sm text-gray-600">{l('Choose an image to remove its background.')}</div>}
        >
          {file && (
            <div className="space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">{l('Original')}</div>
                  <div className="rounded-xl overflow-hidden bg-black/20 border border-white/10 min-h-[260px] flex items-center justify-center">
                    {sourceUrl && <img src={sourceUrl} alt={l('Original')} className="max-h-[520px] max-w-full object-contain" />}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">{l('Transparent result')}</div>
                  <div
                    className="rounded-xl overflow-hidden border border-white/10 min-h-[260px] flex items-center justify-center"
                    style={{
                      backgroundImage: 'linear-gradient(45deg,#161622 25%,transparent 25%),linear-gradient(-45deg,#161622 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#161622 75%),linear-gradient(-45deg,transparent 75%,#161622 75%)',
                      backgroundSize: '20px 20px',
                      backgroundPosition: '0 0,0 10px,10px -10px,-10px 0px',
                    }}
                  >
                    {result ? (
                      <img src={result.url} alt={l('Background removed')} className="max-h-[520px] max-w-full object-contain" />
                    ) : (
                      <div className="text-xs text-gray-600 px-6 text-center">{l('Your result will appear here after processing.')}</div>
                    )}
                  </div>
                </div>
              </div>

              {result && (
                <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <div className="text-white font-medium">
                      PNG{result.width && result.height ? ` · ${result.width} × ${result.height}px` : ''}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {result.fileSize ? formatBytes(result.fileSize) : l('Transparent output')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void downloadRemoteResult(result.url, safeName(file.name))}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    {l('Download PNG')}
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
