import {
  InvoiceCurrency,
  InvoiceDraft,
  InvoiceItem,
  InvoiceThemeId,
  InvoiceTotals,
} from './invoice-types';

export const STORAGE_KEY = 'tayar.invoice-generator.draft.v2';
export const CURRENCIES: InvoiceCurrency[] = ['SEK', 'EUR', 'USD', 'GBP'];
export const THEME_IDS: InvoiceThemeId[] = ['classic', 'modern', 'minimal', 'bold'];
export const MAX_INVOICE_ITEMS = 50;

const TEXT_LIMITS = {
  party: 160,
  details: 2000,
  invoiceNumber: 100,
  notes: 3000,
  itemDescription: 500,
} as const;

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

export function boundedText(value: unknown, max: number) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

export function safeAmount(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function createInvoiceItem(): InvoiceItem {
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

export function createDefaultDraft(): InvoiceDraft {
  const now = new Date();
  return {
    sellerName: '',
    sellerDetails: '',
    customerName: '',
    customerDetails: '',
    invoiceNumber: `INV-${isoDate(now).replace(/-/g, '')}`,
    issueDate: isoDate(now),
    dueDate: isoDate(addDays(now, 30)),
    currency: 'SEK',
    theme: 'classic',
    notes: '',
    items: [createInvoiceItem()],
  };
}

function normalizeItem(value: unknown): InvoiceItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<InvoiceItem>;
  return {
    id: boundedText(item.id, 120) || createInvoiceItem().id,
    description: boundedText(item.description, TEXT_LIMITS.itemDescription),
    quantity: Number.isFinite(Number(item.quantity)) ? Math.min(1_000_000, safeAmount(Number(item.quantity))) : 1,
    unitPrice: Number.isFinite(Number(item.unitPrice)) ? Math.min(1_000_000_000, safeAmount(Number(item.unitPrice))) : 0,
    vatRate: Number.isFinite(Number(item.vatRate)) ? Math.min(100, safeAmount(Number(item.vatRate))) : 25,
  };
}

export function loadDraft(): InvoiceDraft {
  if (typeof window === 'undefined') return createDefaultDraft();

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<InvoiceDraft> | null;
    if (!parsed || typeof parsed !== 'object') return createDefaultDraft();

    const items = Array.isArray(parsed.items)
      ? parsed.items.slice(0, MAX_INVOICE_ITEMS).map(normalizeItem).filter((item): item is InvoiceItem => Boolean(item))
      : [];
    const currency = CURRENCIES.includes(parsed.currency as InvoiceCurrency)
      ? parsed.currency as InvoiceCurrency
      : 'SEK';
    const theme = THEME_IDS.includes(parsed.theme as InvoiceThemeId)
      ? parsed.theme as InvoiceThemeId
      : 'classic';

    return {
      sellerName: boundedText(parsed.sellerName, TEXT_LIMITS.party),
      sellerDetails: boundedText(parsed.sellerDetails, TEXT_LIMITS.details),
      customerName: boundedText(parsed.customerName, TEXT_LIMITS.party),
      customerDetails: boundedText(parsed.customerDetails, TEXT_LIMITS.details),
      invoiceNumber: boundedText(parsed.invoiceNumber, TEXT_LIMITS.invoiceNumber) || createDefaultDraft().invoiceNumber,
      issueDate: boundedText(parsed.issueDate, 20) || isoDate(),
      dueDate: boundedText(parsed.dueDate, 20) || isoDate(addDays(new Date(), 30)),
      currency,
      theme,
      notes: boundedText(parsed.notes, TEXT_LIMITS.notes),
      items: items.length ? items : [createInvoiceItem()],
    };
  } catch {
    return createDefaultDraft();
  }
}

export function saveDraft(draft: InvoiceDraft) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function clearSavedDraft() {
  localStorage.removeItem(STORAGE_KEY);
}

export function lineSubtotal(item: InvoiceItem) {
  return safeAmount(item.quantity) * safeAmount(item.unitPrice);
}

export function lineTotal(item: InvoiceItem) {
  const subtotal = lineSubtotal(item);
  return subtotal + subtotal * Math.min(100, safeAmount(item.vatRate)) / 100;
}

export function calculateInvoiceTotals(draft: InvoiceDraft): InvoiceTotals {
  const subtotal = draft.items.reduce((sum, item) => sum + lineSubtotal(item), 0);
  const vat = draft.items.reduce(
    (sum, item) => sum + lineSubtotal(item) * Math.min(100, safeAmount(item.vatRate)) / 100,
    0,
  );
  return { subtotal, vat, total: subtotal + vat };
}

export function formatMoney(value: number, currency: InvoiceCurrency) {
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
