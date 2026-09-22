import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/modules/website-builder/core/website-cms-transfer.ts', import.meta.url), 'utf8');
const required = [
  'parseWebsiteCmsCsv',
  'exportWebsiteCmsCollectionJson',
  'exportWebsiteCmsCollectionCsv',
  'previewWebsiteCmsJsonImport',
  'previewWebsiteCmsCsvImport',
  'applyWebsiteCmsCollectionImport',
  'WEBSITE_CMS_LIMITS.fields',
  'WEBSITE_CMS_LIMITS.entries',
  "WebsiteCmsImportMode = 'append' | 'replace'",
  "CSV contains an unterminated quoted value.",
];
for (const token of required) {
  if (!source.includes(token)) throw new Error(`CMS transfer smoke missing: ${token}`);
}
if (!source.includes("text.replace(/\"/g, '\"\"')")) throw new Error('CSV escaping is not RFC-style quote safe.');
console.log('Website CMS transfer smoke checks passed.');
