import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/modules/website-builder/core/website-cms-transfer.ts', import.meta.url), 'utf8');
const wrapper = fs.readFileSync(new URL('../src/modules/website-builder/v2-ui/BuilderCmsPanel.tsx', import.meta.url), 'utf8');
const transferPanel = fs.readFileSync(new URL('../src/modules/website-builder/v2-ui/BuilderCmsTransferPanel.tsx', import.meta.url), 'utf8');
const localization = fs.readFileSync(new URL('../src/lib/ui-localization-cms.ts', import.meta.url), 'utf8');
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
for (const token of ['BuilderCmsCorePanel', 'BuilderCmsTransferPanel', 'builder-cms-max-panel']) {
  if (!wrapper.includes(token)) throw new Error(`CMS transfer wrapper is unreachable: ${token}`);
}
for (const token of ['Export JSON', 'Export CSV', 'Import JSON', 'Import CSV', 'cms-import-preview', 'applyWebsiteCmsCollectionImport']) {
  if (!transferPanel.includes(token)) throw new Error(`CMS transfer UI missing: ${token}`);
}
for (const token of ['Preview and validate imported content before changing the project.', 'Import as new collection', 'Apply import']) {
  if (!localization.includes(token)) throw new Error(`CMS transfer localization missing: ${token}`);
}
console.log('Website CMS transfer core, UI reachability and localization smoke checks passed.');
