import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Download, FileStack, Loader2, ShieldCheck } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import {
  ToolField,
  ToolInputPanel,
  ToolOutputPanel,
  ToolShell,
  toolInputClass,
} from '../shared/ToolShell';
import ImageQueue from './ImageQueue';
import { downloadPdf, imagesToPdf, validatePdfImages } from './image-to-pdf';
import { MAX_PDF_IMAGES, PdfPageSize } from './pdf-types';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ImageToPdfTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const [files, setFiles] = useState<File[]>([]);
  const [pageSize, setPageSize] = useState<PdfPageSize>('a4');
  const [marginPt, setMarginPt] = useState(18);
  const [jpegQuality, setJpegQuality] = useState(0.92);
  const [pdf, setPdf] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState('');

  const totalBytes = useMemo(
    () => files.reduce((sum, file) => sum + file.size, 0),
    [files],
  );

  useEffect(() => () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);

  function clearPdf() {
    setPdf(null);
    setPdfUrl('');
    setProgress({ completed: 0, total: 0 });
  }

  function addFiles(nextFiles: File[]) {
    setError('');
    clearPdf();

    const combined = [...files, ...nextFiles].slice(0, MAX_PDF_IMAGES);
    try {
      validatePdfImages(combined);
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
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
    clearPdf();
    setError('');
  }

  function moveFile(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= files.length) return;

    setFiles((current) => {
      const next = [...current];
      const currentFile = next[index];
      next[index] = next[target];
      next[target] = currentFile;
      return next;
    });
    clearPdf();
  }

  async function createPdf() {
    if (!files.length) return;
    setProcessing(true);
    setError('');
    clearPdf();

    try {
      const nextPdf = await imagesToPdf(
        files,
        { pageSize, marginPt, jpegQuality },
        (completed, total) => setProgress({ completed, total }),
      );
      setPdf(nextPdf);
      setPdfUrl(URL.createObjectURL(nextPdf));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : l('Could not create this PDF.'));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <ToolShell
      icon={FileStack}
      title={l('Image to PDF')}
      description={l('Combine JPEG, PNG and WebP images into one PDF directly in your browser.')}
      badge={l('Local PDF')}
    >
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex gap-3 text-sm text-emerald-100">
        <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">{l('Processed locally')}</div>
          <div className="text-emerald-200/60 text-xs mt-0.5">
            {l('Images stay in your browser. Tayar creates a new PDF and never parses an uploaded PDF in this tool.')}
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[390px_minmax(0,1fr)] gap-6 items-start">
        <ToolInputPanel>
          <label className="block rounded-xl border border-dashed border-white/15 bg-white/[0.025] hover:bg-white/[0.05] p-5 text-center cursor-pointer transition-colors">
            <FileStack className="w-7 h-7 text-violet-400 mx-auto mb-2" />
            <div className="text-sm text-white font-medium">{l('Add JPEG, PNG or WebP images')}</div>
            <div className="text-xs text-gray-500 mt-1">
              {l('Up to 20 images · 80 MB combined source limit')}
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
                {files.length} / {MAX_PDF_IMAGES} {l('pages')} · {formatBytes(totalBytes)}
              </div>

              <ToolField label={l('Page size')}>
                <select
                  value={pageSize}
                  onChange={(event) => { setPageSize(event.target.value as PdfPageSize); clearPdf(); }}
                  className={toolInputClass}
                >
                  <option value="a4">{l('A4 · auto orientation')}</option>
                  <option value="letter">{l('Letter · auto orientation')}</option>
                  <option value="auto">{l('Fit page to image')}</option>
                </select>
              </ToolField>

              {pageSize !== 'auto' && (
                <ToolField label={l('Margin')}>
                  <select
                    value={marginPt}
                    onChange={(event) => { setMarginPt(Number(event.target.value)); clearPdf(); }}
                    className={toolInputClass}
                  >
                    <option value={0}>{l('None')}</option>
                    <option value={18}>{l('Small')}</option>
                    <option value={36}>{l('Normal')}</option>
                  </select>
                </ToolField>
              )}

              <ToolField label={`${l('Image quality')} · ${Math.round(jpegQuality * 100)}%`}>
                <input
                  type="range"
                  min="0.6"
                  max="1"
                  step="0.01"
                  value={jpegQuality}
                  onChange={(event) => { setJpegQuality(Number(event.target.value)); clearPdf(); }}
                  className="w-full accent-violet-500"
                />
              </ToolField>

              <div className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-xs text-gray-500">
                {l('Transparent PNG/WebP pixels are flattened onto white when embedded as JPEG inside the PDF.')}
              </div>

              <button
                type="button"
                onClick={() => void createPdf()}
                disabled={processing}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileStack className="w-4 h-4" />}
                {l(processing ? 'Creating PDF...' : 'Create PDF')}
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
          empty={<div className="py-16 text-center text-sm text-gray-600">{l('Add images to build a PDF.')}</div>}
        >
          {files.length > 0 && (
            <div className="space-y-5">
              <div>
                <div className="text-white font-semibold">{l(pdf ? 'PDF ready' : 'Page order')}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {l(pdf ? `${files.length} pages · ${formatBytes(pdf.size)}` : 'Use the arrows to arrange pages before creating the PDF.')}
                </div>
              </div>

              {!pdf && (
                <ImageQueue
                  files={files}
                  onMove={moveFile}
                  onRemove={removeFile}
                  disabled={processing}
                  formatBytes={formatBytes}
                  label={l}
                />
              )}

              {pdf && pdfUrl && (
                <>
                  <div className="rounded-xl overflow-hidden border border-white/10 bg-white min-h-[520px]">
                    <iframe src={pdfUrl} title={l('Generated PDF preview')} className="w-full h-[620px] border-0" />
                  </div>

                  <button
                    type="button"
                    onClick={() => downloadPdf(pdf)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    {l('Download PDF')}
                  </button>
                </>
              )}
            </div>
          )}
        </ToolOutputPanel>
      </div>
    </ToolShell>
  );
}
