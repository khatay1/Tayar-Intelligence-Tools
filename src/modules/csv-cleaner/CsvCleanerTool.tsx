import { ChangeEvent, useState } from 'react';
import { Download, FileSpreadsheet, ShieldCheck, Sparkles } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import {
  ToolInputPanel,
  ToolOutputPanel,
  ToolShell,
} from '../shared/ToolShell';
import { cleanCsvRows, csvStats, outputCsvName, serializeCsv } from './csv-cleaner';
import { readCsvFile } from './csv-parser';
import { CsvCleanOptions, CsvDocument } from './csv-types';

const DEFAULT_OPTIONS: CsvCleanOptions = {
  trimCells: true,
  removeBlankRows: true,
  removeDuplicateRows: false,
  spreadsheetSafe: true,
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function CsvCleanerTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const [document, setDocument] = useState<CsvDocument | null>(null);
  const [cleanedRows, setCleanedRows] = useState<string[][] | null>(null);
  const [options, setOptions] = useState<CsvCleanOptions>(DEFAULT_OPTIONS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sourceStats = document ? csvStats(document.rows) : null;
  const resultStats = cleanedRows ? csvStats(cleanedRows) : null;
  const previewRows = (cleanedRows || document?.rows || []).slice(0, 25);
  const previewColumns = Math.min(
    12,
    previewRows.reduce((max, row) => Math.max(max, row.length), 0),
  );

  async function loadFile(file: File | null) {
    if (!file) return;
    setLoading(true);
    setError('');
    setCleanedRows(null);

    try {
      const next = await readCsvFile(file);
      setDocument(next);
    } catch (caught) {
      setDocument(null);
      setError(caught instanceof Error ? caught.message : l('Could not read this file.'));
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    void loadFile(event.target.files?.[0] || null);
    event.target.value = '';
  }

  function toggleOption(key: keyof CsvCleanOptions) {
    setOptions((current) => ({ ...current, [key]: !current[key] }));
    setCleanedRows(null);
  }

  function cleanData() {
    if (!document) return;
    setCleanedRows(cleanCsvRows(document.rows, options));
  }

  function downloadCleaned() {
    if (!document || !cleanedRows) return;
    const content = serializeCsv(cleanedRows, document.delimiter, options.spreadsheetSafe);
    const blob = new Blob(['\ufeff', content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    try {
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = outputCsvName(document.name);
      anchor.rel = 'noopener';
      anchor.click();
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  return (
    <ToolShell
      icon={FileSpreadsheet}
      title={l('CSV Cleaner')}
      description={l('Clean and prepare CSV data safely without uploading it.')}
      badge="Local processing"
    >
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex gap-3 text-sm text-emerald-100">
        <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">{l('Processed locally')}</div>
          <div className="text-emerald-200/60 text-xs mt-0.5">
            {l('Your CSV stays in this browser. Spreadsheet-safe export is enabled by default.')}
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[360px_minmax(0,1fr)] gap-6 items-start">
        <ToolInputPanel>
          <label className="block rounded-xl border border-dashed border-white/15 bg-white/[0.025] hover:bg-white/[0.05] p-5 text-center cursor-pointer transition-colors">
            <FileSpreadsheet className="w-7 h-7 text-violet-400 mx-auto mb-2" />
            <div className="text-sm text-white font-medium">{l('Choose CSV, TSV or text data')}</div>
            <div className="text-xs text-gray-500 mt-1">{l('Maximum 10 MB · bounded rows, columns and cells')}</div>
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {document && sourceStats && (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs text-gray-400">
                <div className="text-white font-medium truncate">{document.name}</div>
                <div className="mt-1">
                  {sourceStats.rows.toLocaleString()} {l('rows')} · {sourceStats.columns} {l('columns')} · {formatBytes(document.size)}
                </div>
                <div className="mt-1">{l('Detected delimiter')}: {document.delimiter === '\t' ? l('Tab') : document.delimiter}</div>
              </div>

              <div className="space-y-2">
                {[
                  ['trimCells', 'Trim surrounding whitespace'],
                  ['removeBlankRows', 'Remove blank rows'],
                  ['removeDuplicateRows', 'Remove duplicate rows'],
                  ['spreadsheetSafe', 'Spreadsheet-safe export'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2.5 cursor-pointer">
                    <span className="text-sm text-gray-300">{l(label)}</span>
                    <input
                      type="checkbox"
                      checked={options[key as keyof CsvCleanOptions]}
                      onChange={() => toggleOption(key as keyof CsvCleanOptions)}
                      className="accent-violet-500"
                    />
                  </label>
                ))}
              </div>

              <button
                type="button"
                onClick={cleanData}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                {l('Clean CSV')}
              </button>

              {cleanedRows && resultStats && (
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-xs text-gray-300">
                  <div className="font-medium text-violet-200">{l('Cleaned result')}</div>
                  <div className="mt-1">
                    {resultStats.rows.toLocaleString()} {l('rows')} · {resultStats.columns} {l('columns')}
                  </div>
                  <div className="mt-1 text-gray-500">
                    {Math.max(0, sourceStats.rows - resultStats.rows).toLocaleString()} {l('rows removed')}
                  </div>
                </div>
              )}

              {cleanedRows && (
                <button
                  type="button"
                  onClick={downloadCleaned}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-medium px-4 py-2.5 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {l('Download Clean CSV')}
                </button>
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
          loading={loading}
          hasContent={Boolean(document)}
          empty={<div className="py-16 text-center text-sm text-gray-600">{l('Choose a file to preview its data.')}</div>}
        >
          {document && (
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-white text-sm font-semibold">{l(cleanedRows ? 'Cleaned preview' : 'Source preview')}</div>
                  <div className="text-xs text-gray-500">{l('Showing up to 25 rows and 12 columns')}</div>
                </div>
              </div>

              <div className="overflow-auto rounded-xl border border-white/10 max-h-[620px]">
                <table className="min-w-full text-xs">
                  <tbody>
                    {previewRows.map((row, rowIndex) => (
                      <tr key={rowIndex} className={rowIndex === 0 ? 'bg-white/[0.07]' : 'border-t border-white/5'}>
                        {Array.from({ length: previewColumns }, (_, columnIndex) => (
                          <td
                            key={columnIndex}
                            className="px-3 py-2.5 min-w-[120px] max-w-[260px] text-gray-300 truncate"
                            title={row[columnIndex] || ''}
                          >
                            {row[columnIndex] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {previewRows.length === 0 && (
                <div className="py-12 text-center text-sm text-gray-600">{l('No rows remain after cleaning.')}</div>
              )}
            </div>
          )}
        </ToolOutputPanel>
      </div>
    </ToolShell>
  );
}
