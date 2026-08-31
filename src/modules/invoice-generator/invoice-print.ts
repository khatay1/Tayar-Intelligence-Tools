import { calculateInvoiceTotals, formatMoney, lineTotal, safeAmount } from './invoice-model';
import { getInvoiceTheme } from './invoice-themes';
import { InvoiceDraft } from './invoice-types';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function printableInvoiceHtml(draft: InvoiceDraft) {
  const totals = calculateInvoiceTotals(draft);
  const theme = getInvoiceTheme(draft.theme);
  const rows = draft.items.map((item) => `
    <tr>
      <td>${escapeHtml(item.description || 'Item')}</td>
      <td class="num">${safeAmount(item.quantity)}</td>
      <td class="num">${escapeHtml(formatMoney(safeAmount(item.unitPrice), draft.currency))}</td>
      <td class="num">${safeAmount(item.vatRate)}%</td>
      <td class="num">${escapeHtml(formatMoney(lineTotal(item), draft.currency))}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(draft.invoiceNumber || 'Invoice')}</title>
<style>
*{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#151515;margin:0;background:#fff}
.page{width:100%;max-width:900px;margin:0 auto;padding:48px;border-top:6px solid ${theme.printCss.topRule}}
.top{display:flex;justify-content:space-between;gap:32px;align-items:flex-start}
h1{margin:0 0 8px;font-size:34px;color:${theme.printCss.headingColor}}
.muted{color:${theme.printCss.accent};white-space:pre-line;line-height:1.5}.meta{min-width:260px}
.meta-row{display:flex;justify-content:space-between;gap:24px;margin-bottom:8px}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin:46px 0 32px}
.label{color:${theme.printCss.accent};font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:7px}
.name{font-weight:700;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:14px}
th{text-align:left;background:${theme.printCss.tableHeadBg};color:${theme.printCss.tableHeadColor};padding:12px 10px;font-size:12px;text-transform:uppercase}
td{padding:13px 10px;border-bottom:1px solid #e8e8eb;vertical-align:top}.num{text-align:right;white-space:nowrap}
.totals{width:340px;margin:28px 0 0 auto}.total-row{display:flex;justify-content:space-between;padding:7px 0}
.grand{font-size:20px;font-weight:700;border-top:2px solid ${theme.printCss.totalBorder};margin-top:8px;padding-top:13px}
.notes{margin-top:44px;padding-top:18px;border-top:1px solid #ddd;white-space:pre-line;line-height:1.5}
@media print{.page{max-width:none;padding:20mm 16mm}}
</style>
</head>
<body><div class="page">
  <div class="top">
    <div><h1>Invoice</h1><div class="muted">${escapeHtml(draft.sellerName || 'Your company')}</div></div>
    <div class="meta">
      <div class="meta-row"><strong>Invoice</strong><span>${escapeHtml(draft.invoiceNumber || '-')}</span></div>
      <div class="meta-row"><strong>Issue date</strong><span>${escapeHtml(draft.issueDate || '-')}</span></div>
      <div class="meta-row"><strong>Due date</strong><span>${escapeHtml(draft.dueDate || '-')}</span></div>
      <div class="meta-row"><strong>Currency</strong><span>${escapeHtml(draft.currency)}</span></div>
    </div>
  </div>
  <div class="parties">
    <div><div class="label">From</div><div class="name">${escapeHtml(draft.sellerName || 'Your company')}</div><div class="muted">${escapeHtml(draft.sellerDetails)}</div></div>
    <div><div class="label">Bill to</div><div class="name">${escapeHtml(draft.customerName || 'Customer')}</div><div class="muted">${escapeHtml(draft.customerDetails)}</div></div>
  </div>
  <table><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">VAT</th><th class="num">Total</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="totals">
    <div class="total-row"><span>Subtotal</span><strong>${escapeHtml(formatMoney(totals.subtotal,draft.currency))}</strong></div>
    <div class="total-row"><span>VAT</span><strong>${escapeHtml(formatMoney(totals.vat,draft.currency))}</strong></div>
    <div class="total-row grand"><span>Total</span><span>${escapeHtml(formatMoney(totals.total,draft.currency))}</span></div>
  </div>
  ${draft.notes ? `<div class="notes"><div class="label">Notes</div>${escapeHtml(draft.notes)}</div>` : ''}
</div></body></html>`;
}
