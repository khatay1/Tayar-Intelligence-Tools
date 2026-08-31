import { ArrowDown, ArrowUp, Image as ImageIcon, Trash2 } from 'lucide-react';

interface ImageQueueProps {
  files: File[];
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
  formatBytes: (bytes: number) => string;
  label: (value: string) => string;
}

export default function ImageQueue({
  files,
  onMove,
  onRemove,
  disabled,
  formatBytes,
  label,
}: ImageQueueProps) {
  return (
    <div className="space-y-2">
      {files.map((file, index) => (
        <div
          key={`${index}-${file.name}-${file.size}`}
          className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3 flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
            <ImageIcon className="w-4 h-4 text-violet-400" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm text-white truncate">{file.name}</div>
            <div className="text-xs text-gray-600 mt-0.5">{formatBytes(file.size)}</div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onMove(index, -1)}
              disabled={disabled || index === 0}
              className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 disabled:opacity-25 transition-colors"
              aria-label={label('Move up')}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onMove(index, 1)}
              disabled={disabled || index === files.length - 1}
              className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 disabled:opacity-25 transition-colors"
              aria-label={label('Move down')}
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onRemove(index)}
              disabled={disabled}
              className="p-2 rounded-lg text-gray-500 hover:text-red-300 hover:bg-white/10 disabled:opacity-25 transition-colors"
              aria-label={label('Remove')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
