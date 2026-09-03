import { useState } from 'react';
import { Printer, ReceiptText, RotateCcw, Save } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import { usePreferences } from '@/context/PreferencesContext';
import { consumeToolAction } from '@/lib/tool-usage';
import {
  ToolField,
  ToolInputPanel,
  ToolOutputPanel,
  ToolShell,
  toolInputClass,
} from '../shared/ToolShell';
import InvoiceItemsEditor from './InvoiceItemsEditor';
import InvoicePreview from './InvoicePreview';
import {
  CURRENCIES,
  MAX_INVOICE_ITEMS,
  clearSavedDraft,
  createDefaultDraft,
  createInvoiceItem,
  loadDraft,
  saveDraft,
} from './invoice-model';
import { printableInvoiceHtml } from './invoice-print';
import { INVOICE_THEMES } from './invoice-themes';
import { InvoiceCurrency, InvoiceDraft, InvoiceItem, InvoiceThemeId } from './invoice-types';

export default function InvoiceGeneratorTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const { prefs } = usePreferences();
  const [draft, setDraft] = useState<InvoiceDraft>(loadDraft);
  const [message, setMessage] = useState('');
  const [printing, setPrinting] = useState(false);

  function updateDraft<K extends keyof InvoiceDraft>(key: K, value: InvoiceDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage('');
  }

  function updateItem(id: string, updates: Partial<InvoiceItem>) {
    setDraft((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, ...updates } : item) }));
    setMessage('');
  }

  function addItem() {
    setDraft((current) => ({ ...current, items: current.items.length >= MAX_INVOICE_ITEMS ? current.items : [...current.items, createInvoiceItem()] }));
  }

  function removeItem(id: string) {
    setDraft((current) => ({ ...current, items: current.items.length <= 1 ? current.items : current.items.filter((item) => item.id !== id) }));
  }

  function persistDraft() {
    try { saveDraft(draft); setMessage(l('Draft saved on this device.')); }
    catch { setMessage(l('Could not save this draft in browser storage.')); }
  }

  function resetDraft() {
    if (!window.confirm(l('Clear the current invoice draft?'))) return;
    setDraft(createDefaultDraft());
    setMessage('');
    try { clearSavedDraft(); } catch { /* storage can be unavailable */ }
  }

  async function printInvoice() {
    if (printing) return;
    // Open immediately inside the user gesture so mobile browsers do not block it.
    const printWindow = window.open('about:blank', '_blank');
    if (!printWindow) {
      setMessage(l('Pop-up blocked. Allow pop-ups and try Print / Save PDF again.'));
      return;
    }

    setPrinting(true);
    setMessage('');
    try {
      await consumeToolAction('invoice-generator', 'print-save-pdf');
      const html = printableInvoiceHtml(draft, prefs.language);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      printWindow.opener = null;
      printWindow.location.href = url;
      const cleanup = () => window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      printWindow.addEventListener('load', () => {
        printWindow.focus();
        printWindow.print();
        cleanup();
      }, { once: true });
    } catch (caught) {
      printWindow.close();
      setMessage(caught instanceof Error ? caught.message : l('Could not create invoice output.'));
    } finally {
      setPrinting(false);
    }
  }

  return (
    <ToolShell icon={ReceiptText} title={l('Invoice Generator')} description={l('Create a professional invoice, choose a design, calculate VAT, save a draft and print or save as PDF.')} badge="v1.1">
      <div className="grid min-w-0 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)] gap-4 sm:gap-6 items-start">
        <ToolInputPanel>
          <ToolField label={l('Invoice design')}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {INVOICE_THEMES.map((theme) => <button key={theme.id} type="button" onClick={() => updateDraft('theme', theme.id as InvoiceThemeId)} className={`min-w-0 rounded-xl border p-3 text-left transition-colors ${draft.theme === theme.id ? 'border-violet-400/40 bg-violet-500/10' : 'border-white/10 bg-white/[0.025] hover:bg-white/[0.05]'}`}><div className="text-xs font-semibold text-white break-words">{l(theme.label)}</div><div className="text-[10px] text-gray-600 mt-1 break-words">{l(theme.description)}</div></button>)}
            </div>
          </ToolField>

          <div className="grid sm:grid-cols-2 gap-4">
            <ToolField label={l('Your company')}><input value={draft.sellerName} maxLength={160} onChange={(e) => updateDraft('sellerName', e.target.value)} className={toolInputClass} placeholder={l('Tayar AB')} /></ToolField>
            <ToolField label={l('Customer')}><input value={draft.customerName} maxLength={160} onChange={(e) => updateDraft('customerName', e.target.value)} className={toolInputClass} placeholder={l('Customer name')} /></ToolField>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <ToolField label={l('Company details')}><textarea value={draft.sellerDetails} maxLength={2000} onChange={(e) => updateDraft('sellerDetails', e.target.value)} className={`${toolInputClass} min-h-[88px] resize-y`} placeholder={l('Address, organization number, email, payment details')} /></ToolField>
            <ToolField label={l('Customer details')}><textarea value={draft.customerDetails} maxLength={2000} onChange={(e) => updateDraft('customerDetails', e.target.value)} className={`${toolInputClass} min-h-[88px] resize-y`} placeholder={l('Address, email or reference')} /></ToolField>
          </div>

          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-4 gap-3">
            <ToolField label={l('Invoice number')}><input value={draft.invoiceNumber} maxLength={100} onChange={(e) => updateDraft('invoiceNumber', e.target.value)} className={toolInputClass} /></ToolField>
            <ToolField label={l('Issue date')}><input type="date" value={draft.issueDate} onChange={(e) => updateDraft('issueDate', e.target.value)} className={toolInputClass} /></ToolField>
            <ToolField label={l('Due date')}><input type="date" value={draft.dueDate} onChange={(e) => updateDraft('dueDate', e.target.value)} className={toolInputClass} /></ToolField>
            <ToolField label={l('Currency')}><select value={draft.currency} onChange={(e) => updateDraft('currency', e.target.value as InvoiceCurrency)} className={toolInputClass}>{CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></ToolField>
          </div>

          <InvoiceItemsEditor items={draft.items} onAdd={addItem} onRemove={removeItem} onUpdate={updateItem} label={l} />
          <ToolField label={l('Notes')}><textarea value={draft.notes} maxLength={3000} onChange={(e) => updateDraft('notes', e.target.value)} className={`${toolInputClass} min-h-[72px] resize-y`} placeholder={l('Payment terms, thank-you note or bank details')} /></ToolField>
          {message && <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-300 break-words">{message}</div>}

          <div className="grid sm:grid-cols-3 gap-2">
            <button type="button" onClick={persistDraft} className="min-h-11 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-medium px-4 py-2.5 transition-colors"><Save className="w-4 h-4" />{l('Save Draft')}</button>
            <button type="button" onClick={resetDraft} className="min-h-11 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium px-4 py-2.5 transition-colors"><RotateCcw className="w-4 h-4" />{l('Reset')}</button>
            <button type="button" onClick={() => void printInvoice()} disabled={printing} className="min-h-11 flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 transition-colors"><Printer className="w-4 h-4" />{l(printing ? 'Preparing...' : 'Print / Save PDF')}</button>
          </div>
        </ToolInputPanel>

        <ToolOutputPanel hasContent><div className="min-w-0 overflow-auto"><InvoicePreview draft={draft} label={l} /></div></ToolOutputPanel>
      </div>
    </ToolShell>
  );
}
