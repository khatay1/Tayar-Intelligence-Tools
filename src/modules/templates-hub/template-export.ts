import { TayarTemplate } from './template-types';

export function sanitizeSpreadsheetCell(value: string) {
  const trimmed = value.replace(/^\s+/, '');
  if (
    trimmed.startsWith('=') ||
    trimmed.startsWith('+') ||
    trimmed.startsWith('-') ||
    trimmed.startsWith('@') ||
    trimmed.startsWith('\t') ||
    trimmed.startsWith('\r')
  ) {
    return `'${value}`;
  }
  return value;
}

function encodeCell(value: string) {
  const safe = sanitizeSpreadsheetCell(value);
  if (safe.includes('"') || safe.includes(',') || safe.includes('\n') || safe.includes('\r')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function templateToCsv(template: TayarTemplate) {
  return [template.columns, ...template.sampleRows]
    .map((row) => row.map(encodeCell).join(','))
    .join('\r\n');
}

export function downloadTemplateCsv(template: TayarTemplate) {
  const blob = new Blob(['\ufeff', templateToCsv(template)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${template.id}.csv`;
    anchor.rel = 'noopener';
    anchor.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
