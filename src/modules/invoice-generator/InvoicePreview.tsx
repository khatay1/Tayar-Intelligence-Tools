import { calculateInvoiceTotals, formatMoney, lineTotal, safeAmount } from './invoice-model';
import { getInvoiceTheme } from './invoice-themes';
import { InvoiceDraft } from './invoice-types';

interface InvoicePreviewProps {
  draft: InvoiceDraft;
  label: (value: string) => string;
}

export default function InvoicePreview({ draft, label }: InvoicePreviewProps) {
  const totals = calculateInvoiceTotals(draft);
  const theme = getInvoiceTheme(draft.theme);

  return (
    <div className={`${theme.preview.shell} rounded-xl shadow-2xl overflow-hidden min-h-[660px]`}>
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-5">
          <div>
            <div className={`text-3xl font-bold tracking-tight ${theme.preview.title}`}>{label('Invoice')}</div>
            <div className={`text-sm mt-1 ${theme.preview.accent}`}>{draft.sellerName || label('Your company')}</div>
          </div>
          <div className="text-xs text-right space-y-1 text-gray-600">
            <div><span className="font-semibold text-gray-900">{label('Invoice')}:</span> {draft.invoiceNumber || '-'}</div>
            <div><span className="font-semibold text-gray-900">{label('Issue')}:</span> {draft.issueDate || '-'}</div>
            <div><span className="font-semibold text-gray-900">{label('Due')}:</span> {draft.dueDate || '-'}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mt-10 mb-8">
          <div>
            <div className={`text-[10px] uppercase tracking-wider mb-1 ${theme.preview.accent}`}>{label('From')}</div>
            <div className="font-semibold text-sm">{draft.sellerName || label('Your company')}</div>
            <div className="text-xs text-gray-500 whitespace-pre-line mt-1">{draft.sellerDetails}</div>
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-wider mb-1 ${theme.preview.accent}`}>{label('Bill to')}</div>
            <div className="font-semibold text-sm">{draft.customerName || label('Customer')}</div>
            <div className="text-xs text-gray-500 whitespace-pre-line mt-1">{draft.customerDetails}</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={`${theme.preview.tableHead} uppercase tracking-wide`}>
                <th className="text-left px-3 py-2.5">{label('Description')}</th>
                <th className="text-right px-3 py-2.5">{label('Qty')}</th>
                <th className="text-right px-3 py-2.5">{label('Price')}</th>
                <th className="text-right px-3 py-2.5">{label('VAT')}</th>
                <th className="text-right px-3 py-2.5">{label('Total')}</th>
              </tr>
            </thead>
            <tbody>
              {draft.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="px-3 py-3">{item.description || label('Item')}</td>
                  <td className="px-3 py-3 text-right">{safeAmount(item.quantity)}</td>
                  <td className="px-3 py-3 text-right">{formatMoney(safeAmount(item.unitPrice), draft.currency)}</td>
                  <td className="px-3 py-3 text-right">{safeAmount(item.vatRate)}%</td>
                  <td className="px-3 py-3 text-right font-medium">{formatMoney(lineTotal(item), draft.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="w-full max-w-xs ml-auto mt-7 text-sm">
          <div className="flex justify-between py-1.5 text-gray-500"><span>{label('Subtotal')}</span><span>{formatMoney(totals.subtotal, draft.currency)}</span></div>
          <div className="flex justify-between py-1.5 text-gray-500"><span>{label('VAT')}</span><span>{formatMoney(totals.vat, draft.currency)}</span></div>
          <div className={`flex justify-between py-3 mt-2 border-t-2 ${theme.preview.totalBorder} text-lg font-bold`}>
            <span>{label('Total')}</span><span>{formatMoney(totals.total, draft.currency)}</span>
          </div>
        </div>

        {draft.notes && (
          <div className="mt-10 border-t border-gray-200 pt-5">
            <div className={`text-[10px] uppercase tracking-wider mb-2 ${theme.preview.accent}`}>{label('Notes')}</div>
            <div className="text-xs text-gray-600 whitespace-pre-line">{draft.notes}</div>
          </div>
        )}
      </div>
    </div>
  );
}
