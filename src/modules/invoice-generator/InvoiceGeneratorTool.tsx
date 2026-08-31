import { useState } from 'react';
import {
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import {
  ToolField,
  ToolInputPanel,
  ToolOutputPanel,
  ToolShell,
  toolInputClass,
} from '../shared/ToolShell';

type InvoiceCurrency = 'SEK' | 'EUR' | 'USD' | 'GBP';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

interface InvoiceDraft {
  sellerName: string;
  sellerDetails: string;
  customerName: string;
  customerDetails: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: InvoiceCurrency;
  notes: string;
  items: InvoiceItem[];
}

const STORAGE_KEY = 'tayar.invoice-generator.draft.v1';
const CURRENCIES: InvoiceCurrency[] = ['SEK', 'EUR', 'USD', 'GBP'];

function isoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function createItem(): InvoiceItem {
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: '',
    quantity: 1,
    unitPrice: 0,
    vatRate: 25,
  };
}

function createDefaultDraft(): InvoiceDraft {
  const now = new Date();
  return {
    sellerName: '',
    sellerDetails: '',
    customerName: '',
    customerDetails: '',
    invoiceNumber: `INV-${isoDate(now).replaceAll('-', '')}`,
    issueDate: isoDate(now),
    dueDate: isoDate(addDays(now, 30)),
    currency: 'SEK',
    notes: '',
    items: [createItem()],
  };
}

function loadDraft(): InvoiceDraft {
  if (typeof window === 'undefined') return createDefaultDraft();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<InvoiceDraft> | null;
    if (!parsed || typeof parsed !== 'object') return createDefaultDraft();
    const items = Array.isArray(parsed.items)
      ? parsed.items
          .filter((item) => item && typeof item === 'object')
          .slice(0, 50)
          .map((item) => ({
            id: typeof item.id === 'string' ? item.id : createItem().id,
            description: typeof item.description === 'string' ? item.description : '',
            quantity: Number.isFinite(Number(item.quantity)) ? Math.max(0, Number(item.quantity)) : 1,
            unitPrice: Number.isFinite(Number(item.unitPrice)) ? Math.max(0, Number(item.unitPrice)) : 0,
            vatRate: Number.isFinite(Number(item.vatRate)) ? Math.max(0, Math.min(100, Number(item.vatRate))) : 25,
          }))
      : [];

    const currency = CURRENCIES.includes(parsed.currency as InvoiceCurrency)
      ? parsed.currency as InvoiceCurrency
      : 'SEK';

    return {
      ...createDefaultDraft(),
      ...parsed,
      currency,
      items: items.length ? items : [createItem()],
    } as InvoiceDraft;
  } catch {
    return createDefaultDraft();
  }
}

function safeAmount(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function formatMoney(value: number, currency: InvoiceCurrency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function printableInvoiceHtml(draft: InvoiceDraft) {
  const subtotal = draft.items.reduce(
    (sum, item) => sum + safeAmount(item.quantity) * safeAmount(item.unitPrice),
    0,
  );
  const vat = draft.items.reduce((sum, item) => {
    const line = safeAmount(item.quantity) * safeAmount(item.unitPrice);
    return sum + line * Math.max(0, Math.min(100, safeAmount(item.vatRate))) / 100;
  }, 0);
  const total = subtotal + vat;

  const rows = draft.items.map((item) => {
    const lineSubtotal = safeAmount(item.quantity) * safeAmount(item.unitPrice);
    const lineVat = lineSubtotal * Math.max(0, Math.min(100, safeAmount(item.vatRate))) / 100;
    return `
      <tr>
        <td>${escapeHtml(item.description || 'Item')}</td>
        <td class="num">${safeAmount(item.quantity)}</td>
        <td class="num">${escapeHtml(formatMoney(safeAmount(item.unitPrice), draft.currency))}</td>
        <td class="num">${safeAmount(item.vatRate)}%</td>
        <td class="num">${escapeHtml(formatMoney(lineSubtotal + lineVat, draft.currency))}</td>
      </tr>
    `;
  }).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(draft.invoiceNumber || 'Invoice')}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #151515; margin: 0; background: #fff; }
  .page { width: 100%; max-width: 900px; margin: 0 auto; padding: 48px; }
  .top { display: flex; justify-content: space-between; gap: 32px; align-items: flex-start; }
  h1 { margin: 0 0 8px; font-size: 34px; }
  .muted { color: #666; white-space: pre-line; line-height: 1.5; }
  .meta { min-width: 260px; }
  .meta-row { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 8px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin: 46px 0 32px; }
  .label { color: #777; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 7px; }
  .name { font-weight: 700; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; }
  th { text-align: left; background: #f3f3f5; padding: 12px 10px; font-size: 12px; text-transform: uppercase; }
  td { padding: 13px 10px; border-bottom: 1px solid #e8e8eb; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .totals { width: 340px; margin: 28px 0 0 auto; }
  .total-row { display: flex; justify-content: space-between; padding: 7px 0; }
  .grand { font-size: 20px; font-weight: 700; border-top: 2px solid #151515; margin-top: 8px; padding-top: 13px; }
  .notes { margin-top: 44px; padding-top: 18px; border-top: 1px solid #ddd; white-space: pre-line; line-height: 1.5; }
  @media print {
    .page { max-width: none; padding: 20mm 16mm; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="top">
      <div>
        <h1>Invoice</h1>
        <div class="muted">${escapeHtml(draft.sellerName || 'Your company')}</div>
      </div>
      <div class="meta">
        <div class="meta-row"><strong>Invoice</strong><span>${escapeHtml(draft.invoiceNumber || '-')}</span></div>
        <div class="meta-row"><strong>Issue date</strong><span>${escapeHtml(draft.issueDate || '-')}</span></div>
        <div class="meta-row"><strong>Due date</strong><span>${escapeHtml(draft.dueDate || '-')}</span></div>
        <div class="meta-row"><strong>Currency</strong><span>${escapeHtml(draft.currency)}</span></div>
      </div>
    </div>

    <div class="parties">
      <div>
        <div class="label">From</div>
        <div class="name">${escapeHtml(draft.sellerName || 'Your company')}</div>
        <div class="muted">${escapeHtml(draft.sellerDetails)}</div>
      </div>
      <div>
        <div class="label">Bill to</div>
        <div class="name">${escapeHtml(draft.customerName || 'Customer')}</div>
        <div class="muted">${escapeHtml(draft.customerDetails)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Qty</th>
          <th class="num">Unit price</th>
          <th class="num">VAT</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div class="total-row"><span>Subtotal</span><strong>${escapeHtml(formatMoney(subtotal, draft.currency))}</strong></div>
      <div class="total-row"><span>VAT</span><strong>${escapeHtml(formatMoney(vat, draft.currency))}</strong></div>
      <div class="total-row grand"><span>Total</span><span>${escapeHtml(formatMoney(total, draft.currency))}</span></div>
    </div>

    ${draft.notes ? `<div class="notes"><div class="label">Notes</div>${escapeHtml(draft.notes)}</div>` : ''}
  </div>
</body>
</html>`;
}

export default function InvoiceGeneratorTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const [draft, setDraft] = useState<InvoiceDraft>(loadDraft);
  const [message, setMessage] = useState('');

  const subtotal = draft.items.reduce(
    (sum, item) => sum + safeAmount(item.quantity) * safeAmount(item.unitPrice),
    0,
  );
  const vat = draft.items.reduce((sum, item) => {
    const line = safeAmount(item.quantity) * safeAmount(item.unitPrice);
    return sum + line * Math.max(0, Math.min(100, safeAmount(item.vatRate))) / 100;
  }, 0);
  const total = subtotal + vat;

  function updateDraft<K extends keyof InvoiceDraft>(key: K, value: InvoiceDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage('');
  }

  function updateItem(id: string, updates: Partial<InvoiceItem>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id ? { ...item, ...updates } : item),
    }));
    setMessage('');
  }

  function addItem() {
    setDraft((current) => ({
      ...current,
      items: current.items.length >= 50 ? current.items : [...current.items, createItem()],
    }));
  }

  function removeItem(id: string) {
    setDraft((current) => ({
      ...current,
      items: current.items.length <= 1
        ? current.items
        : current.items.filter((item) => item.id !== id),
    }));
  }

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      setMessage(l('Draft saved on this device.'));
    } catch {
      setMessage(l('Could not save this draft in browser storage.'));
    }
  }

  function resetDraft() {
    if (!window.confirm(l('Clear the current invoice draft?'))) return;
    const next = createDefaultDraft();
    setDraft(next);
    setMessage('');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Browser storage can be unavailable without blocking the tool.
    }
  }

  function printInvoice() {
    const html = printableInvoiceHtml(draft);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank', 'noopener,noreferrer');

    if (!printWindow) {
      URL.revokeObjectURL(url);
      setMessage(l('Pop-up blocked. Allow pop-ups and try Print / Save PDF again.'));
      return;
    }

    const cleanup = () => window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    printWindow.addEventListener('load', () => {
      printWindow.focus();
      printWindow.print();
      cleanup();
    }, { once: true });
  }

  return (
    <ToolShell
      icon={ReceiptText}
      title={l('Invoice Generator')}
      description={l('Create a professional invoice, calculate VAT automatically, save a draft and print or save it as PDF.')}
      badge="v1.0"
    >
      <div className="grid xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)] gap-6 items-start">
        <ToolInputPanel>
          <div className="grid md:grid-cols-2 gap-4">
            <ToolField label={l('Your company')}>
              <input
                value={draft.sellerName}
                onChange={(event) => updateDraft('sellerName', event.target.value)}
                className={toolInputClass}
                placeholder={l('Tayar AB')}
              />
            </ToolField>
            <ToolField label={l('Customer')}>
              <input
                value={draft.customerName}
                onChange={(event) => updateDraft('customerName', event.target.value)}
                className={toolInputClass}
                placeholder={l('Customer name')}
              />
            </ToolField>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <ToolField label={l('Company details')}>
              <textarea
                value={draft.sellerDetails}
                onChange={(event) => updateDraft('sellerDetails', event.target.value)}
                className={`${toolInputClass} min-h-[88px] resize-y`}
                placeholder={l('Address, organization number, email, payment details')}
              />
            </ToolField>
            <ToolField label={l('Customer details')}>
              <textarea
                value={draft.customerDetails}
                onChange={(event) => updateDraft('customerDetails', event.target.value)}
                className={`${toolInputClass} min-h-[88px] resize-y`}
                placeholder={l('Address, email or reference')}
              />
            </ToolField>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ToolField label={l('Invoice number')}>
              <input
                value={draft.invoiceNumber}
                onChange={(event) => updateDraft('invoiceNumber', event.target.value)}
                className={toolInputClass}
              />
            </ToolField>
            <ToolField label={l('Issue date')}>
              <input
                type="date"
                value={draft.issueDate}
                onChange={(event) => updateDraft('issueDate', event.target.value)}
                className={toolInputClass}
              />
            </ToolField>
            <ToolField label={l('Due date')}>
              <input
                type="date"
                value={draft.dueDate}
                onChange={(event) => updateDraft('dueDate', event.target.value)}
                className={toolInputClass}
              />
            </ToolField>
            <ToolField label={l('Currency')}>
              <select
                value={draft.currency}
                onChange={(event) => updateDraft('currency', event.target.value as InvoiceCurrency)}
                className={toolInputClass}
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>{currency}</option>
                ))}
              </select>
            </ToolField>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-white text-sm font-semibold">{l('Invoice items')}</h2>
                <p className="text-gray-500 text-xs">{l('VAT is calculated per line.')}</p>
              </div>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 hover:bg-violet-500/20 text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {l('Add item')}
              </button>
            </div>

            <div className="space-y-3">
              {draft.items.map((item, index) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs text-gray-500">{l('Item')} {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={draft.items.length <= 1}
                      className="p-1.5 text-gray-500 hover:text-red-300 disabled:opacity-30 transition-colors"
                      aria-label={l('Remove item')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid md:grid-cols-[minmax(180px,1fr)_90px_120px_90px] gap-2">
                    <input
                      value={item.description}
                      onChange={(event) => updateItem(item.id, { description: event.target.value })}
                      className={toolInputClass}
                      placeholder={l('Description')}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.quantity}
                      onChange={(event) => updateItem(item.id, { quantity: safeAmount(Number(event.target.value)) })}
                      className={toolInputClass}
                      aria-label={l('Quantity')}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(event) => updateItem(item.id, { unitPrice: safeAmount(Number(event.target.value)) })}
                      className={toolInputClass}
                      aria-label={l('Unit price')}
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={item.vatRate}
                      onChange={(event) => updateItem(item.id, { vatRate: Math.min(100, safeAmount(Number(event.target.value))) })}
                      className={toolInputClass}
                      aria-label={l('VAT rate')}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <ToolField label={l('Notes')}>
            <textarea
              value={draft.notes}
              onChange={(event) => updateDraft('notes', event.target.value)}
              className={`${toolInputClass} min-h-[72px] resize-y`}
              placeholder={l('Payment terms, thank-you note or bank details')}
            />
          </ToolField>

          {message && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-300">
              {message}
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={saveDraft}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-medium px-4 py-2.5 transition-colors"
            >
              <Save className="w-4 h-4" />
              {l('Save Draft')}
            </button>
            <button
              type="button"
              onClick={resetDraft}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium px-4 py-2.5 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              {l('Reset')}
            </button>
            <button
              type="button"
              onClick={printInvoice}
              className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              {l('Print / Save PDF')}
            </button>
          </div>
        </ToolInputPanel>

        <ToolOutputPanel hasContent>
          <div className="bg-white text-gray-900 rounded-xl shadow-2xl overflow-hidden min-h-[660px]">
            <div className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <div className="text-3xl font-bold tracking-tight">{l('Invoice')}</div>
                  <div className="text-sm text-gray-500 mt-1">{draft.sellerName || l('Your company')}</div>
                </div>
                <div className="text-xs text-right space-y-1 text-gray-600">
                  <div><span className="font-semibold text-gray-900">{l('Invoice')}:</span> {draft.invoiceNumber || '-'}</div>
                  <div><span className="font-semibold text-gray-900">{l('Issue')}:</span> {draft.issueDate || '-'}</div>
                  <div><span className="font-semibold text-gray-900">{l('Due')}:</span> {draft.dueDate || '-'}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mt-10 mb-8">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">{l('From')}</div>
                  <div className="font-semibold text-sm">{draft.sellerName || l('Your company')}</div>
                  <div className="text-xs text-gray-500 whitespace-pre-line mt-1">{draft.sellerDetails}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">{l('Bill to')}</div>
                  <div className="font-semibold text-sm">{draft.customerName || l('Customer')}</div>
                  <div className="text-xs text-gray-500 whitespace-pre-line mt-1">{draft.customerDetails}</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100 text-gray-500 uppercase tracking-wide">
                      <th className="text-left px-3 py-2.5">{l('Description')}</th>
                      <th className="text-right px-3 py-2.5">{l('Qty')}</th>
                      <th className="text-right px-3 py-2.5">{l('Price')}</th>
                      <th className="text-right px-3 py-2.5">{l('VAT')}</th>
                      <th className="text-right px-3 py-2.5">{l('Total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.items.map((item) => {
                      const lineSubtotal = safeAmount(item.quantity) * safeAmount(item.unitPrice);
                      const lineTotal = lineSubtotal + lineSubtotal * safeAmount(item.vatRate) / 100;
                      return (
                        <tr key={item.id} className="border-b border-gray-100">
                          <td className="px-3 py-3">{item.description || l('Item')}</td>
                          <td className="px-3 py-3 text-right">{safeAmount(item.quantity)}</td>
                          <td className="px-3 py-3 text-right">{formatMoney(safeAmount(item.unitPrice), draft.currency)}</td>
                          <td className="px-3 py-3 text-right">{safeAmount(item.vatRate)}%</td>
                          <td className="px-3 py-3 text-right font-medium">{formatMoney(lineTotal, draft.currency)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="w-full max-w-xs ml-auto mt-7 text-sm">
                <div className="flex justify-between py-1.5 text-gray-500">
                  <span>{l('Subtotal')}</span>
                  <span>{formatMoney(subtotal, draft.currency)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-gray-500">
                  <span>{l('VAT')}</span>
                  <span>{formatMoney(vat, draft.currency)}</span>
                </div>
                <div className="flex justify-between py-3 mt-2 border-t-2 border-gray-900 text-lg font-bold">
                  <span>{l('Total')}</span>
                  <span>{formatMoney(total, draft.currency)}</span>
                </div>
              </div>

              {draft.notes && (
                <div className="mt-10 border-t border-gray-200 pt-5">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">{l('Notes')}</div>
                  <div className="text-xs text-gray-600 whitespace-pre-line">{draft.notes}</div>
                </div>
              )}
            </div>
          </div>
        </ToolOutputPanel>
      </div>
    </ToolShell>
  );
}
