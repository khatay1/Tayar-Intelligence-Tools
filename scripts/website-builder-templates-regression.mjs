import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const catalog = read('src/modules/website-builder/core/editor-template-library.ts');
const operations = read('src/modules/website-builder/core/editor-template-operations.ts');
const nativePanel = read('src/modules/website-builder/v2-ui/BuilderNativeTemplatesPanel.tsx');
const router = read('src/modules/website-builder/v2-ui/BuilderPanelRouter.tsx');
const bridge = read('src/modules/website-builder/v2-ui/BuilderV2NativeBridge.tsx');
const localization = read('src/modules/website-builder/core/editor-template-localization.ts');

const failures = [];
const check = (label, condition) => { if (!condition) failures.push(label); };

check('catalog exposes section templates', /kind:\s*'section'/.test(catalog));
check('catalog exposes page templates', /kind:\s*'page'/.test(catalog));
check('catalog exposes site templates', /kind:\s*'site'/.test(catalog));
check('catalog supports search filtering', catalog.includes('filterEditorTemplateLibrary'));
check('catalog supports AI customization metadata', catalog.includes('aiCustomizable'));
check('planner creates native sections', operations.includes("action: 'add_section'"));
check('planner creates native pages', operations.includes("action: 'add_page'"));
check('planner generates collision-resistant ids', operations.includes('randomUUID'));
check('native panel supports preview', nativePanel.includes('onPreview'));
check('native panel supports insertion', nativePanel.includes('onInsert'));
check('native panel supports AI customization', nativePanel.includes('onCustomizeWithAI'));
check('native panel supports search', nativePanel.includes("type=\"search\""));
check('native panel supports categories', nativePanel.includes('CATEGORIES'));
check('router combines native and imported libraries', router.includes('BuilderNativeTemplatesPanel') && router.includes('BuilderTemplateLibraryPanel'));
check('router forwards template insertion', router.includes('onInsertTemplate'));
check('bridge executes planner output', bridge.includes('planEditorTemplateInsert') && bridge.includes('handleTemplateInsert'));
check('bridge forwards preview callback', bridge.includes('onPreviewTemplate'));
check('bridge forwards AI callback', bridge.includes('onCustomizeTemplateWithAI'));
check('Arabic localization exists', localization.includes('arTemplatePhrases'));
check('Swedish localization exists', localization.includes('svTemplatePhrases'));
check('template localization covers AI action', localization.includes("'Customize with AI'"));

if (failures.length) {
  console.error(`Templates Library MAX regression failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Templates Library MAX regression passed.');
