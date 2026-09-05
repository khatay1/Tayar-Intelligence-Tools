import { ChangeEvent, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Combine,
  Copy,
  Crop,
  Download,
  FileArchive,
  FileOutput,
  FilePlus2,
  FileStack,
  Hash,
  Images,
  Layers,
  Loader2,
  Minimize2,
  PenTool,
  RotateCw,
  ScanText,
  Scissors,
  ShieldCheck,
  Stamp,
  Trash2,
  Type,
  UploadCloud,
  X,
} from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import { completeMeteredLocalAction } from '@/lib/tool-usage';
import {
  ToolField,
  ToolInputPanel,
  ToolOutputPanel,
  ToolShell,
  toolInputClass,
} from '../shared/ToolShell';
import { runPdfAction } from './pdf-engine';
import {
  PDF_OPERATION_GROUPS,
  PDF_OPERATIONS,
  PdfActionOptions,
  PdfOperationGroup,
  PdfOperationId,
  PdfPosition,
  PdfProcessResult,
  PdfSourceInfo,
} from './pdf-types';
import {
  downloadBlob,
  inspectPdfFile,
  validatePdfFiles,
} from './pdf-utils';

const OPERATION_ICONS: Record<PdfOperationId, LucideIcon> = {
  merge: Combine,
  split: Scissors,
  extract: FileOutput,
  delete: Trash2,
  reorder: ArrowUpDown,
  rotate: RotateCw,
  crop: Crop,
  'page-numbers': Hash,
  watermark: Stamp,
  'add-text': Type,
  sign: PenTool,
  create: FilePlus2,
  'to-images': Images,
  'extract-text': ScanText,
  compress: Minimize2,
  flatten: Layers,
};

const PAGE_SELECTION_OPERATIONS = new Set<PdfOperationId>([
  'extract',
  'delete',
  'rotate',
  'crop',
  'page-numbers',
  'watermark',
  'add-text',
  'sign',
]);

const REQUIRED_PAGE_SELECTION_OPERATIONS = new Set<PdfOperationId>(['extract', 'delete']);

const POSITIONS: Array<{ value: PdfPosition; label: string }> = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-center', label: 'Top center' },
  { value: 'top-right', label: 'Top right' },
  { value: 'center', label: 'Center' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-center', label: 'Bottom center' },
  { value: 'bottom-right', label: 'Bottom right' },
];

function initialOptions(): PdfActionOptions {
  return {
    operation: 'merge',
    files: [],
    pageSelection: '',
    pageOrder: '',
    rotation: 90,
    cropMm: { top: 5, right: 5, bottom: 5, left: 5 },
    position: 'bottom-center',
    startNumber: 1,
    text: '',
    fontSize: 24,
    opacity: 0.2,
    signatureFile: null,
    signatureWidthPercent: 25,
    imageFormat: 'png',
    imageScale: 1.5,
    imageQuality: 0.82,
    compressionPreset: 'balanced',
    createPageSize: 'a4',
    createOrientation: 'portrait',
    createPageCount: 1,
  };
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function localizePdfError(error: unknown, l: (text: string) => string) {
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('Page numbers must be between')) return l('Page numbers must be within the document range.');
  if (message.startsWith('Enter every page exactly once')) return l('Enter every page exactly once in the new order.');
  const known = [
    'Choose a PDF file first.',
    'Choose one PDF file for this tool.',
    'Choose no more than 12 PDF files.',
    'Choose at least two PDF files to merge.',
    'The merged PDF cannot exceed 150 pages.',
    'The selected PDF files exceed the 120 MB combined safety limit.',
    'PDF files must be larger than 0 bytes and no more than 50 MB each.',
    'This file is not a valid PDF document.',
    'PDF page count must be between 1 and 150 pages.',
    'This PDF is damaged or uses an unsupported format.',
    'This PDF exceeded the safe decompression limit.',
    'Password-protected PDFs must be unlocked before using this local tool.',
    'Password-protected PDFs must be unlocked before conversion.',
    'Enter pages like 1-3,5,8.',
    'Enter at least one page number.',
    'You cannot delete every page from the PDF.',
    'Crop margins must be between 0 and 100 millimetres.',
    'Crop margins leave no usable page area.',
    'Enter the text you want to add.',
    'Text size must be between 8 and 120 points.',
    'Canvas processing is not available in this browser.',
    'The browser could not create the text layer.',
    'The browser could not encode this PDF page.',
    'Choose a signature image first.',
    'Use a PNG, JPEG, or WebP signature image.',
    'Signature images must be no more than 10 MB.',
    'Signature image dimensions are too large to process safely.',
    'Blank PDFs can contain between 1 and 20 pages.',
    'Image and text conversion supports PDFs up to 60 pages.',
    'Splitting supports PDFs up to 100 pages per ZIP.',
    'No selectable text was found. This PDF may require OCR.',
    'This PDF does not contain interactive form fields.',
    'This PDF could not be rendered safely in the browser.',
  ];
  return known.includes(message) ? l(message) : message || l('PDF processing failed.');
}

function PositionSelect({ value, onChange, l }: {
  value: PdfPosition;
  onChange: (value: PdfPosition) => void;
  l: (text: string) => string;
}) {
  return (
    <ToolField label={l('Position')}>
      <select value={value} onChange={(event) => onChange(event.target.value as PdfPosition)} className={toolInputClass}>
        {POSITIONS.map((position) => <option key={position.value} value={position.value}>{l(position.label)}</option>)}
      </select>
    </ToolField>
  );
}

function useObjectUrl(blob: Blob | null) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!blob) {
      setUrl('');
      return undefined;
    }

    const nextUrl = URL.createObjectURL(blob);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [blob]);

  return url;
}

export default function PdfToolsTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const [activeGroup, setActiveGroup] = useState<PdfOperationGroup>('organize');
  const [options, setOptions] = useState<PdfActionOptions>(initialOptions);
  const [sourceInfo, setSourceInfo] = useState<PdfSourceInfo[]>([]);
  const [inspecting, setInspecting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [result, setResult] = useState<PdfProcessResult | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const operation = PDF_OPERATIONS.find((item) => item.id === options.operation) || PDF_OPERATIONS[0];
  const ActiveOperationIcon = OPERATION_ICONS[operation.id];
  const pageCount = sourceInfo[0]?.pageCount || 0;
  const groupOperations = PDF_OPERATIONS.filter((item) => item.group === activeGroup);
  const totalInputBytes = options.files.reduce((sum, file) => sum + file.size, 0);

  const sourcePreviewUrl = useObjectUrl(options.files.length === 1 ? options.files[0] : null);
  const resultPreviewUrl = useObjectUrl(result?.kind === 'pdf' ? result.blob : null);

  function patchOptions(patch: Partial<PdfActionOptions>) {
    setOptions((current) => ({ ...current, ...patch }));
    setResult(null);
    setError('');
  }

  function chooseGroup(group: PdfOperationGroup) {
    if (group === activeGroup) return;
    setActiveGroup(group);
    const first = PDF_OPERATIONS.find((item) => item.group === group);
    if (first) chooseOperation(first.id);
  }

  function chooseOperation(id: PdfOperationId) {
    if (id === options.operation) return;
    const nextOperation = PDF_OPERATIONS.find((item) => item.id === id);
    if (!nextOperation) return;
    setActiveGroup(nextOperation.group);
    setOptions((current) => {
      const files = nextOperation.multiple ? current.files : current.files.slice(0, 1);
      const pageSelection = id === 'sign' && sourceInfo[0]?.pageCount
        ? String(sourceInfo[0].pageCount)
        : '';
      return {
        ...current,
        operation: id,
        files,
        pageSelection,
        position: id === 'watermark' ? 'center' : id === 'sign' ? 'bottom-right' : current.position,
        fontSize: id === 'watermark' ? 48 : id === 'page-numbers' ? 12 : 24,
      };
    });
    if (!nextOperation.multiple && sourceInfo.length > 1) setSourceInfo((current) => current.slice(0, 1));
    setResult(null);
    setProgress({ completed: 0, total: 0 });
    setError('');
  }

  async function addPdfFiles(nextFiles: File[]) {
    if (!nextFiles.length) return;
    setInspecting(true);
    setError('');
    setResult(null);
    try {
      const candidate = operation.multiple
        ? [...options.files, ...nextFiles]
        : [nextFiles[0]];
      validatePdfFiles(candidate, Boolean(operation.multiple));
      const info: PdfSourceInfo[] = [];
      for (const file of candidate) info.push(await inspectPdfFile(file));
      if (operation.multiple && info.reduce((sum, item) => sum + item.pageCount, 0) > 150) {
        throw new Error('The merged PDF cannot exceed 150 pages.');
      }
      setSourceInfo(info);
      setOptions((current) => ({
        ...current,
        files: candidate,
        pageOrder: candidate.length === 1
          ? Array.from({ length: info[0].pageCount }, (_, index) => index + 1).join(',')
          : '',
        pageSelection: current.operation === 'sign' ? String(info[0].pageCount) : current.pageSelection,
      }));
    } catch (caught) {
      setError(localizePdfError(caught, l));
    } finally {
      setInspecting(false);
    }
  }

  function handlePdfFiles(event: ChangeEvent<HTMLInputElement>) {
    void addPdfFiles(Array.from(event.target.files || []));
    event.target.value = '';
  }

  function removePdf(index: number) {
    setOptions((current) => ({ ...current, files: current.files.filter((_, itemIndex) => itemIndex !== index) }));
    setSourceInfo((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setResult(null);
    setError('');
  }

  function movePdf(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= options.files.length) return;
    setOptions((current) => {
      const files = [...current.files];
      [files[index], files[target]] = [files[target], files[index]];
      return { ...current, files };
    });
    setSourceInfo((current) => {
      const info = [...current];
      [info[index], info[target]] = [info[target], info[index]];
      return info;
    });
    setResult(null);
  }

  async function processPdf() {
    if (processing || inspecting) return;
    setProcessing(true);
    setProgress({ completed: 0, total: 0 });
    setResult(null);
    setError('');
    try {
      const output = await completeMeteredLocalAction(
        'pdf-tools',
        options.operation,
        () => runPdfAction(options, setProgress),
      );
      setResult(output);
    } catch (caught) {
      setError(localizePdfError(caught, l));
    } finally {
      setProcessing(false);
    }
  }

  async function copyText() {
    if (result?.kind !== 'text') return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const requiresFile = operation.requiresFile !== false;
  const canProcess = !processing
    && !inspecting
    && (!requiresFile || options.files.length > 0)
    && (options.operation !== 'merge' || options.files.length >= 2)
    && (options.operation !== 'sign' || Boolean(options.signatureFile));

  return (
    <ToolShell
      icon={FileStack}
      title={l('PDF Studio')}
      description={l('Organize, edit, convert and optimize PDF files directly in your browser.')}
      badge={l('16 local tools')}
    >
      <div className="flex min-w-0 gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-100">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
        <div className="min-w-0">
          <div className="font-medium">{l('Private browser processing')}</div>
          <div className="mt-0.5 text-xs leading-5 text-emerald-200/60">{l('Your PDF files stay on this device. Tayar does not upload them for these tools.')}</div>
        </div>
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex min-w-0 gap-2 overflow-x-auto pb-1" role="group" aria-label={l('PDF tool categories')}>
          {PDF_OPERATION_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              aria-pressed={activeGroup === group.id}
              onClick={() => chooseGroup(group.id)}
              className={`min-h-11 shrink-0 rounded-xl border px-4 text-sm font-medium transition-colors ${activeGroup === group.id ? 'border-violet-400/40 bg-violet-500/20 text-violet-200' : 'border-white/10 bg-white/[0.025] text-gray-400 hover:bg-white/[0.06] hover:text-white'}`}
            >
              {l(group.label)}
            </button>
          ))}
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
          {groupOperations.map((item) => {
            const Icon = OPERATION_ICONS[item.id];
            const selected = options.operation === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => chooseOperation(item.id)}
                className={`min-h-[76px] min-w-0 rounded-xl border p-3 text-left transition-all ${selected ? 'border-violet-400/50 bg-violet-500/15 shadow-[0_0_24px_rgba(139,92,246,0.08)]' : 'border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]'}`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className={`h-4 w-4 shrink-0 ${selected ? 'text-violet-300' : 'text-gray-500'}`} />
                  <span className={`truncate text-sm font-semibold ${selected ? 'text-white' : 'text-gray-300'}`}>{l(item.label)}</span>
                </div>
                <div className="mt-1 line-clamp-2 text-xs leading-4 text-gray-500">{l(item.description)}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,410px)_minmax(0,1fr)] sm:gap-6">
        <ToolInputPanel>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ActiveOperationIcon className="h-5 w-5 shrink-0 text-violet-400" />
              <div className="min-w-0">
                <div className="break-words font-semibold text-white">{l(operation.label)}</div>
                <div className="mt-0.5 break-words text-xs leading-5 text-gray-500">{l(operation.description)}</div>
              </div>
            </div>
          </div>

          {requiresFile && (
            <label className="block cursor-pointer rounded-xl border border-dashed border-white/15 bg-white/[0.025] p-4 text-center transition-colors hover:bg-white/[0.05] sm:p-5">
              {inspecting ? <Loader2 className="mx-auto mb-2 h-7 w-7 animate-spin text-violet-400" /> : <UploadCloud className="mx-auto mb-2 h-7 w-7 text-violet-400" />}
              <div className="text-sm font-medium text-white">{l(operation.multiple ? 'Add PDF files' : options.files.length ? 'Replace PDF file' : 'Choose a PDF file')}</div>
              <div className="mt-1 text-xs text-gray-500">{l(operation.multiple ? 'Up to 12 files · 120 MB combined' : 'Up to 50 MB · 150 pages')}</div>
              <input type="file" accept="application/pdf,.pdf" multiple={Boolean(operation.multiple)} onChange={handlePdfFiles} className="hidden" />
            </label>
          )}

          {options.files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                <span>{options.files.length} {l(options.files.length === 1 ? 'file' : 'files')} · {formatBytes(totalInputBytes)}</span>
                <button type="button" onClick={() => { patchOptions({ files: [] }); setSourceInfo([]); }} className="min-h-9 rounded-lg px-2 text-gray-400 hover:bg-white/5 hover:text-white">{l('Clear')}</button>
              </div>
              {options.files.map((file, index) => (
                <div key={`${file.name}-${file.lastModified}-${index}`} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-2.5">
                  <FileStack className="h-4 w-4 shrink-0 text-violet-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-gray-200">{file.name}</div>
                    <div className="mt-0.5 text-xs text-gray-600">{sourceInfo[index]?.pageCount || '—'} {l('pages')} · {formatBytes(file.size)}</div>
                  </div>
                  {operation.multiple && (
                    <div className="flex shrink-0">
                      <button type="button" onClick={() => movePdf(index, -1)} disabled={index === 0} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-white/5 hover:text-white disabled:opacity-25" aria-label={l('Move up')}><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" onClick={() => movePdf(index, 1)} disabled={index === options.files.length - 1} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-white/5 hover:text-white disabled:opacity-25" aria-label={l('Move down')}><ArrowDown className="h-4 w-4" /></button>
                    </div>
                  )}
                  <button type="button" onClick={() => removePdf(index)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-red-500/10 hover:text-red-300" aria-label={l('Remove file')}><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}

          {PAGE_SELECTION_OPERATIONS.has(options.operation) && pageCount > 0 && (
            <ToolField label={l(REQUIRED_PAGE_SELECTION_OPERATIONS.has(options.operation) ? 'Pages' : 'Pages (optional)')}>
              <input
                value={options.pageSelection}
                onChange={(event) => patchOptions({ pageSelection: event.target.value })}
                placeholder={l(REQUIRED_PAGE_SELECTION_OPERATIONS.has(options.operation) ? 'Example: 1-3,5,8' : 'Leave empty for all pages')}
                inputMode="text"
                className={toolInputClass}
              />
              <div className="mt-1.5 text-xs text-gray-600">{pageCount} {l('pages in this PDF')}</div>
            </ToolField>
          )}

          {options.operation === 'reorder' && pageCount > 0 && (
            <ToolField label={l('New page order')}>
              <textarea value={options.pageOrder} onChange={(event) => patchOptions({ pageOrder: event.target.value })} rows={3} className={`${toolInputClass} resize-y`} />
              <div className="mt-1.5 text-xs leading-5 text-gray-600">{l('Enter every page once, separated by commas. Example: 3,1,2,4')}</div>
            </ToolField>
          )}

          {options.operation === 'rotate' && (
            <ToolField label={l('Rotation')}>
              <select value={options.rotation} onChange={(event) => patchOptions({ rotation: Number(event.target.value) as 90 | 180 | 270 })} className={toolInputClass}>
                <option value={90}>90°</option><option value={180}>180°</option><option value={270}>270°</option>
              </select>
            </ToolField>
          )}

          {options.operation === 'crop' && (
            <div className="grid grid-cols-2 gap-3">
              {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
                <ToolField key={side} label={`${l(side[0].toUpperCase() + side.slice(1))} · mm`}>
                  <input type="number" min="0" max="100" step="1" value={options.cropMm[side]} onChange={(event) => patchOptions({ cropMm: { ...options.cropMm, [side]: Math.max(0, Number(event.target.value) || 0) } })} className={toolInputClass} />
                </ToolField>
              ))}
            </div>
          )}

          {options.operation === 'page-numbers' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <ToolField label={l('Start number')}><input type="number" min="-9999" max="9999" value={options.startNumber} onChange={(event) => patchOptions({ startNumber: Number(event.target.value) || 0 })} className={toolInputClass} /></ToolField>
                <ToolField label={l('Text size')}><input type="number" min="8" max="28" value={options.fontSize} onChange={(event) => patchOptions({ fontSize: Number(event.target.value) || 12 })} className={toolInputClass} /></ToolField>
              </div>
              <PositionSelect value={options.position} onChange={(position) => patchOptions({ position })} l={l} />
            </>
          )}

          {(options.operation === 'watermark' || options.operation === 'add-text') && (
            <>
              <ToolField label={l('Text')}><textarea value={options.text} onChange={(event) => patchOptions({ text: event.target.value.slice(0, 500) })} rows={3} placeholder={l(options.operation === 'watermark' ? 'CONFIDENTIAL' : 'Enter text to place on the PDF')} className={`${toolInputClass} resize-y`} /></ToolField>
              <ToolField label={`${l('Text size')} · ${options.fontSize}`}><input type="range" min="8" max="120" step="1" value={options.fontSize} onChange={(event) => patchOptions({ fontSize: Number(event.target.value) })} className="w-full accent-violet-500" /></ToolField>
              {options.operation === 'watermark' && <ToolField label={`${l('Opacity')} · ${Math.round(options.opacity * 100)}%`}><input type="range" min="0.05" max="0.8" step="0.05" value={options.opacity} onChange={(event) => patchOptions({ opacity: Number(event.target.value) })} className="w-full accent-violet-500" /></ToolField>}
              <PositionSelect value={options.position} onChange={(position) => patchOptions({ position })} l={l} />
            </>
          )}

          {options.operation === 'sign' && (
            <>
              <ToolField label={l('Signature image')}>
                <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-gray-300 hover:bg-white/10">
                  <PenTool className="h-4 w-4" />
                  <span className="max-w-[240px] truncate">{options.signatureFile?.name || l('Choose signature image')}</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { patchOptions({ signatureFile: event.target.files?.[0] || null }); event.target.value = ''; }} className="hidden" />
                </label>
              </ToolField>
              <ToolField label={`${l('Signature width')} · ${options.signatureWidthPercent}%`}><input type="range" min="10" max="60" step="1" value={options.signatureWidthPercent} onChange={(event) => patchOptions({ signatureWidthPercent: Number(event.target.value) })} className="w-full accent-violet-500" /></ToolField>
              <PositionSelect value={options.position} onChange={(position) => patchOptions({ position })} l={l} />
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-amber-100/70">{l('This places a visual signature. It does not create a certificate-based digital signature.')}</div>
            </>
          )}

          {options.operation === 'create' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <ToolField label={l('Page size')}><select value={options.createPageSize} onChange={(event) => patchOptions({ createPageSize: event.target.value as 'a4' | 'letter' })} className={toolInputClass}><option value="a4">A4</option><option value="letter">{l('Letter')}</option></select></ToolField>
                <ToolField label={l('Orientation')}><select value={options.createOrientation} onChange={(event) => patchOptions({ createOrientation: event.target.value as 'portrait' | 'landscape' })} className={toolInputClass}><option value="portrait">{l('Portrait')}</option><option value="landscape">{l('Landscape')}</option></select></ToolField>
              </div>
              <ToolField label={l('Page count')}><input type="number" min="1" max="20" value={options.createPageCount} onChange={(event) => patchOptions({ createPageCount: Math.max(1, Math.min(20, Number(event.target.value) || 1)) })} className={toolInputClass} /></ToolField>
            </>
          )}

          {options.operation === 'to-images' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <ToolField label={l('Image format')}><select value={options.imageFormat} onChange={(event) => patchOptions({ imageFormat: event.target.value as 'png' | 'jpeg' })} className={toolInputClass}><option value="png">PNG</option><option value="jpeg">JPEG</option></select></ToolField>
                <ToolField label={l('Resolution')}><select value={options.imageScale} onChange={(event) => patchOptions({ imageScale: Number(event.target.value) })} className={toolInputClass}><option value={1}>{l('Standard')}</option><option value={1.5}>{l('High')}</option><option value={2}>{l('Very high')}</option></select></ToolField>
              </div>
              {options.imageFormat === 'jpeg' && <ToolField label={`${l('Image quality')} · ${Math.round(options.imageQuality * 100)}%`}><input type="range" min="0.4" max="0.95" step="0.05" value={options.imageQuality} onChange={(event) => patchOptions({ imageQuality: Number(event.target.value) })} className="w-full accent-violet-500" /></ToolField>}
            </>
          )}

          {options.operation === 'compress' && (
            <>
              <ToolField label={l('Compression level')}><select value={options.compressionPreset} onChange={(event) => patchOptions({ compressionPreset: event.target.value as 'quality' | 'balanced' | 'small' })} className={toolInputClass}><option value="quality">{l('Best quality')}</option><option value="balanced">{l('Balanced')}</option><option value="small">{l('Smallest file')}</option></select></ToolField>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-amber-100/70">{l('Strong compression rebuilds each page as an image. Links and selectable text will be flattened.')}</div>
            </>
          )}

          {options.operation === 'split' && pageCount > 0 && <div className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-xs leading-5 text-gray-500">{l('The ZIP will contain one PDF for each page.')} · {pageCount} {l('files')}</div>}
          {options.operation === 'flatten' && <div className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-xs leading-5 text-gray-500">{l('Flattening makes completed form fields non-editable in the output copy.')}</div>}

          {error && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs leading-5 text-red-200">{error}</div>}

          <button type="button" onClick={() => void processPdf()} disabled={!canProcess} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-45">
            {processing || inspecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ActiveOperationIcon className="h-4 w-4" />}
            {l(processing ? 'Processing PDF...' : inspecting ? 'Reading PDF...' : operation.label)}
          </button>
          {processing && progress.total > 0 && <div className="text-center text-xs text-gray-500">{progress.completed} / {progress.total}</div>}
        </ToolInputPanel>

        <ToolOutputPanel
          loading={processing}
          hasContent={Boolean(result || sourcePreviewUrl || options.operation === 'create')}
          empty={<div className="py-16 text-center text-sm text-gray-600">{l('Choose a PDF tool and add your file.')}</div>}
        >
          {result ? (
            <div className="min-w-0 space-y-4">
              <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                    {result.kind === 'zip' ? <FileArchive className="h-5 w-5 text-emerald-400" /> : result.kind === 'text' ? <ScanText className="h-5 w-5 text-emerald-400" /> : <Check className="h-5 w-5 text-emerald-400" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{result.filename}</div>
                    <div className="mt-0.5 text-xs text-emerald-100/55">{l('Ready to download')} · {formatBytes(result.blob.size)}{result.itemCount ? ` · ${result.itemCount}` : ''}</div>
                  </div>
                </div>
                <button type="button" onClick={() => downloadBlob(result.blob, result.filename)} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500"><Download className="h-4 w-4" />{l('Download')}</button>
              </div>

              {result.kind === 'pdf' && resultPreviewUrl && <div className="min-h-[420px] overflow-hidden rounded-xl border border-white/10 bg-white sm:min-h-[620px]"><iframe src={resultPreviewUrl} title={l('PDF result preview')} className="h-[520px] w-full border-0 sm:h-[700px]" /></div>}

              {result.kind === 'text' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3"><div className="text-sm font-semibold text-white">{l('Extracted text')}</div><button type="button" onClick={() => void copyText()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-gray-300 hover:bg-white/10">{copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}{l(copied ? 'Copied' : 'Copy')}</button></div>
                  <textarea readOnly value={result.text} className="min-h-[360px] w-full resize-y rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-gray-200 outline-none" />
                </div>
              )}

              {result.kind === 'zip' && <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center"><FileArchive className="mb-3 h-12 w-12 text-violet-400" /><div className="font-semibold text-white">{l('ZIP package ready')}</div><div className="mt-1 max-w-sm text-sm leading-6 text-gray-500">{l('Download the ZIP to access every generated file.')}</div></div>}
            </div>
          ) : sourcePreviewUrl ? (
            <div className="min-w-0 space-y-3">
              <div><div className="font-semibold text-white">{l('Original PDF')}</div><div className="mt-0.5 text-xs text-gray-500">{sourceInfo[0]?.pageCount || 0} {l('pages')} · {formatBytes(options.files[0]?.size || 0)}</div></div>
              <div className="min-h-[420px] overflow-hidden rounded-xl border border-white/10 bg-white sm:min-h-[620px]"><iframe src={sourcePreviewUrl} title={l('Original PDF preview')} className="h-[520px] w-full border-0 sm:h-[700px]" /></div>
            </div>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
              <FilePlus2 className="mb-3 h-12 w-12 text-violet-400" />
              <div className="font-semibold text-white">{l('Create a new PDF')}</div>
              <div className="mt-1 max-w-sm text-sm leading-6 text-gray-500">{l('Choose the page settings, then create and download your blank document.')}</div>
            </div>
          )}
        </ToolOutputPanel>
      </div>
    </ToolShell>
  );
}
