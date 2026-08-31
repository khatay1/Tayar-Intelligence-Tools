import { Plus, Trash2 } from 'lucide-react';
import { toolInputClass } from '../shared/ToolShell';
import { MAX_INVOICE_ITEMS, safeAmount } from './invoice-model';
import { InvoiceItem } from './invoice-types';

interface InvoiceItemsEditorProps {
  items: InvoiceItem[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<InvoiceItem>) => void;
  label: (value: string) => string;
}

export default function InvoiceItemsEditor({
  items,
  onAdd,
  onRemove,
  onUpdate,
  label,
}: InvoiceItemsEditorProps) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-white text-sm font-semibold">{label('Invoice items')}</h2>
          <p className="text-gray-500 text-xs">{label('VAT is calculated per line.')}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={items.length >= MAX_INVOICE_ITEMS}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 hover:bg-violet-500/20 disabled:opacity-40 text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {label('Add item')}
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs text-gray-500">{label('Item')} {index + 1}</span>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                disabled={items.length <= 1}
                className="p-1.5 text-gray-500 hover:text-red-300 disabled:opacity-30 transition-colors"
                aria-label={label('Remove item')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid md:grid-cols-[minmax(180px,1fr)_90px_120px_90px] gap-2">
              <input
                value={item.description}
                maxLength={500}
                onChange={(event) => onUpdate(item.id, { description: event.target.value })}
                className={toolInputClass}
                placeholder={label('Description')}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.quantity}
                onChange={(event) => onUpdate(item.id, { quantity: Math.min(1_000_000, safeAmount(Number(event.target.value))) })}
                className={toolInputClass}
                aria-label={label('Quantity')}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.unitPrice}
                onChange={(event) => onUpdate(item.id, { unitPrice: Math.min(1_000_000_000, safeAmount(Number(event.target.value))) })}
                className={toolInputClass}
                aria-label={label('Unit price')}
              />
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={item.vatRate}
                onChange={(event) => onUpdate(item.id, { vatRate: Math.min(100, safeAmount(Number(event.target.value))) })}
                className={toolInputClass}
                aria-label={label('VAT rate')}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
