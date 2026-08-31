import { useMemo, useState } from 'react';
import { Download, Search, Table2 } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import { ToolShell, toolInputClass } from '../shared/ToolShell';
import { searchTemplates } from './template-catalog';
import { downloadTemplateCsv } from './template-export';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'finance', label: 'Finance' },
  { id: 'business', label: 'Business' },
  { id: 'productivity', label: 'Productivity' },
] as const;

export default function TemplatesHubTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const templates = useMemo(
    () => searchTemplates(query, category),
    [query, category],
  );

  return (
    <ToolShell
      icon={Table2}
      title={l('Templates Hub')}
      description={l('Original Tayar templates for finance, business and productivity workflows.')}
      badge="Starter library"
    >
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 text-sm text-violet-100">
        <div className="font-medium">{l('Original Tayar templates')}</div>
        <div className="text-violet-200/60 text-xs mt-0.5">
          {l('These starter files are built by Tayar. No third-party template files, macros or remote assets are bundled.')}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`${toolInputClass} pl-10`}
            placeholder={l('Search templates')}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
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

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.map((template) => (
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
            <p className="text-gray-500 text-sm mt-1 leading-relaxed flex-1">{l(template.description)}</p>

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

      {templates.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-16 text-center text-sm text-gray-600">
          {l('No templates match this search.')}
        </div>
      )}
    </ToolShell>
  );
}
