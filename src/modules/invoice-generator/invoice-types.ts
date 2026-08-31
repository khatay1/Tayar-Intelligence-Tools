export type InvoiceCurrency = 'SEK' | 'EUR' | 'USD' | 'GBP';
export type InvoiceThemeId = 'classic' | 'modern' | 'minimal' | 'bold';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

export interface InvoiceDraft {
  sellerName: string;
  sellerDetails: string;
  customerName: string;
  customerDetails: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: InvoiceCurrency;
  theme: InvoiceThemeId;
  notes: string;
  items: InvoiceItem[];
}

export interface InvoiceTotals {
  subtotal: number;
  vat: number;
  total: number;
}
