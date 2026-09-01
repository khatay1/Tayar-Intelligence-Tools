import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Search, Table2 } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import { ToolShell, toolInputClass } from '../shared/ToolShell';
import { MirroredTemplateCard } from './MirroredTemplateCard';
import { searchTemplates } from './template-catalog';
import { downloadTemplateCsv } from './template-export';
import { useTemplateLibrary } from './use-template-library';

const LOCAL_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'finance', label: 'Finance' },
  { id: 'business', label: 'Business' },
  { id: 'productivity', label: 'Productivity' },
] as const;

const LIBRARY_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'spreadsheets', label: 'Spreadsheets' },
  { id: 'documents', label: 'Documents' },
  { id: 'presentations', label: 'Presentations' },
  { id: 'power-bi', label: 'Power BI' },
  { id: 'pdf', label: 'PDF' },
  { id: 'bundles', label: 'Bundles' },
  { id: 'images', label: 'Images' },
  { id: 'office-bundle', label: 'Office bundle' },
] as const;

const LIBRARY_FORMATS = [
  'all',
  'xlsx',
  'xls',
  'docx',
  'doc',
  'pptx',
  'ppt',
  'pdf',
  'pbix',
  'zip',
  'csv',
] as const;

type LibraryMode = 'library' | 'originals';

export default function TemplatesHubTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const [mode, setMode] = useState<LibraryMode>('library');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [format, setFormat] = useState('all');
  const [sort, setSort] = useState<'title' | 'newest' | 'size'>('title');
  const [page, setPage] = useState(1);

  const localTemplates = useMemo(
    () => searchTemplates(query, category),
    [query, category],
  );

  const library = useTemplateLibrary(
    {
      query,
      category,
      format,
      sort,
      page,
      pageSize: 36,
    },
    mode === 'library',
  );

  const categories = mode === 'library' ? LIBRARY_CATEGORIES : LOCAL_CATEGORIES;

  function changeMode(next: LibraryMode) {
    setMode(next);
    setCategory('all');
    setFormat('all');
    setSort('title');
    setPage(1);
  }

  function changeCategory(next: string) {
    setCategory(next);
    setPage(1);
  }

  function changeQuery(next: string) {
    setQuery(next);
    setPage(1);
  }

  return (
    <ToolShell
      icon={Table2}
      title={l('Templates Hub')}
      description={l('Browse Tayar-hosted office templates or use original Tayar starter files.')}
      badge={mode === 'library' ? l('Tayar Library') : l('Originals')}
    >
      <div className="grid sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => changeMode('library')}
          className={`rounded-xl border px-4 py-3 text-left transition-colors ${
            mode === 'library'
              ? 'bg-violet-500/15 border-violet-400/30 text-white'
              : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white'
          }`}
        >
          <div className="font-medium">{l('Tayar Library')}</div>
          <div className="text-xs mt-0.5 opacity-60">
            {l('Templates mirrored into Tayar storage for independent access.')}
          </div>
        </button>

        <button
          type="button"
          onClick={() => changeMode('originals')}
          className={`rounded-xl border px-4 py-3 text-left transition-colors ${
            mode === 'originals'
              ? 'bg-violet-500/15 border-violet-400/30 text-white'
              : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white'
          }`}
        >
          <div className="font-medium">{l('Tayar Originals')}</div>
          <div className="text-xs mt-0.5 opacity-60">
            {l('Small starter templates created directly by Tayar.')}
          </div>
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            className={`${toolInputClass} pl-10`}
            placeholder={l('Search templates')}
          />
        </div>

        {mode === 'library' && (
          <>
            <select
              value={format}
              onChange={(event) => {
                setFormat(event.target.value);
                setPage(1);
              }}
              className={`${toolInputClass} md:w-36`}
              aria-label={l('File format')}
            >
              {LIBRARY_FORMATS.map((item) => (
                <option key={item} value={item}>
                  {item === 'all' ? l('All formats') : item.toUpperCase()}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as 'title' | 'newest' | 'size');
                setPage(1);
              }}
              className={`${toolInputClass} md:w-40`}
              aria-label={l('Sort templates')}
            >
              <option value="title">{l('Name A–Z')}</option>
              <option value="newest">{l('Newest')}</option>
              <option value="size">{l('Largest files')}</option>
            </select>
          </>
        )}

        <div className="flex gap-2 flex-wrap">
          {categories.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => changeCategory(item.id)}
              className={`px-3 py-2 rounded-xl text-sm border transition-colors ${
                category === item.id
                  ? 'bg-violet-500/20 border-violet-400/30 text-violet-200'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              {l(item.label)}
            </button>
          ))}
        </div>
      </div>

      {mode === 'library' ? (
        <>
          <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
            <span>
              {library.loading
                ? l('Loading Tayar Library…')
                : l(`${library.total.toLocaleString()} templates available`)}
            </span>
            {library.totalPages > 1 && (
              <span>{l(`Page ${library.page} of ${library.totalPages}`)}</span>
            )}
          </div>

          {library.error && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
              <div className="font-medium">{l('Tayar Library is temporarily unavailable')}</div>
              <div className="text-xs mt-1 opacity-70">
                {l('Original Tayar templates remain available from the Originals tab.')}
              </div>
            </div>
          )}

          {!library.error && (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {library.items.map((asset) => (
                <MirroredTemplateCard key={asset.id} asset={asset} />
              ))}
            </div>
          )}

          {!library.loading && !library.error && library.items.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-16 text-center text-sm text-gray-600">
              {l('No mirrored templates match this search.')}
            </div>
          )}

          {!library.error && library.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={library.loading || library.page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                {l('Previous')}
              </button>
              <button
                type="button"
                disabled={library.loading || library.page >= library.totalPages}
                onClick={() => setPage((value) => Math.min(library.totalPages, value + 1))}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 disabled:opacity-40"
              >
                {l('Next')}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 text-sm text-violet-100">
            <div className="font-medium">{l('Original Tayar templates')}</div>
            <div className="text-violet-200/60 text-xs mt-0.5">
              {l('These starter files are built by Tayar and generated locally as CSV files.')}
            </div>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {localTemplates.map((template) => (
              <article
                key={template.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-col min-h-[230px]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                    <Table2 className="w-5 h-5 text-violet-400" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-white/5 text-gray-500">
                    {l(template.category)}
                  </span>
                </div>

                <h2 className="text-white font-semibold mt-4">{l(template.name)}</h2>
                <p className="text-gray-500 text-sm mt-1 leading-relaxed flex-1">
                  {l(template.description)}
                </p>

                <div className="flex flex-wrap gap-1.5 mt-4">
                  {template.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-gray-500">
                      {l(tag)}
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => downloadTemplateCsv(template)}
                  className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {l('Download CSV')}
                </button>
              </article>
            ))}
          </div>

          {localTemplates.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-16 text-center text-sm text-gray-600">
              {l('No templates match this search.')}
            </div>
          )}
        </>
      )}
    </ToolShell>
  );
}
