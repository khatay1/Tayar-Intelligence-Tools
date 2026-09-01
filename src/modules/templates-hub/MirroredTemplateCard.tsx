import { Download, FileSpreadsheet } from 'lucide-react';
import { useMemo } from 'react';
import { useLocalizer } from '@/lib/ui-localization';
import {
  formatTemplateBytes,
  MirroredTemplateAsset,
  publicTemplateUrl,
} from './library-service';

export function MirroredTemplateCard({ asset }: { asset: MirroredTemplateAsset }) {
  const l = useLocalizer();

  const href = useMemo(() => {
    try {
      return publicTemplateUrl(asset.storagePath);
    } catch {
      return '';
    }
  }, [asset.storagePath]);

  const size = formatTemplateBytes(asset.fileSizeBytes);

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-col min-h-[220px]">
      <div className="flex items-start justify-between gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <FileSpreadsheet className="w-5 h-5 text-violet-400" />
        </div>
        <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-white/5 text-gray-500">
          {asset.format}
        </span>
      </div>

      <h2 className="text-white font-semibold mt-4 line-clamp-2">{asset.title}</h2>
      <p className="text-gray-500 text-xs mt-2 line-clamp-2 break-all">
        {asset.originalFilename}
      </p>

      <div className="flex flex-wrap gap-1.5 mt-4">
        <span className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-gray-500">
          {l(asset.category)}
        </span>
        {size && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-gray-500">
            {size}
          </span>
        )}
      </div>

      <div className="flex-1" />

      <a
        href={href || undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!href}
        className={`mt-4 w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold px-4 py-2.5 transition-colors ${
          href
            ? 'bg-violet-600 hover:bg-violet-500 text-white'
            : 'bg-white/5 text-gray-600 pointer-events-none'
        }`}
      >
        <Download className="w-4 h-4" />
        {l('Open / Download')}
      </a>
    </article>
  );
}
