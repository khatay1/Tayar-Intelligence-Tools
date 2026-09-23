import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const quality = read('src/modules/website-builder/core/editor-site-quality.ts');
const seo = read('src/modules/website-builder/core/editor-seo-model.ts');
const panel = read('src/modules/website-builder/v2-ui/BuilderSiteQualityPanel.tsx');
const seoPanel = read('src/modules/website-builder/v2-ui/BuilderPageSeoPanel.tsx');
const bridge = read('src/modules/website-builder/v2-ui/WebsiteBuilderV2Bridge.tsx');
const bridgeBase = read('src/modules/website-builder/v2-ui/WebsiteBuilderV2BridgeBase.tsx');
const bridgeSources = `${bridge}\n${bridgeBase}`;
const localization = read('src/modules/website-builder/core/editor-site-quality-localization.ts') + read('src/modules/website-builder/core/editor-seo-localization.ts');
const checks = [
  ['quality audit', quality.includes('auditEditorSiteQuality')],
  ['sitemap', quality.includes('buildEditorSitemapPaths')],
  ['robots', quality.includes('buildEditorRobotsPolicy')],
  ['broken links', quality.includes('broken-link')],
  ['accessibility', quality.includes("'accessibility'")],
  ['performance', quality.includes("'performance'")],
  ['structured data', seo.includes('buildEditorPageStructuredData') && seo.includes('https://schema.org')],
  ['open graph', seo.includes('openGraph')],
  ['twitter', seo.includes('twitter')],
  ['canonical', seo.includes('canonical')],
  ['quality dashboard', panel.includes('Fix with AI') && panel.includes('report.score')],
  ['page SEO editor', seoPanel.includes("action: 'update_page'") && seoPanel.includes('Save SEO')],
  ['bridge integration', bridgeSources.includes('BuilderSiteQualityPanel') && bridgeSources.includes('BuilderPageSeoPanel')],
  ['issue navigation', bridgeSources.includes('onSelectIssue=') && bridgeSources.includes('item.pageId||activePageId') && bridgeSources.includes('sectionId:item.sectionId') && bridgeSources.includes('elementId:item.elementId') && bridgeSources.includes('setInspectorOpen(true)')],
  ['AI fix contract', bridgeSources.includes('onFixSiteQualityWithAI')],
  ['Arabic localization', localization.includes('arSiteQuality') && localization.includes('arSeoPhrases')],
  ['Swedish localization', localization.includes('svSiteQuality') && localization.includes('svSeoPhrases')],
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) { console.error('SEO/Site Quality regression failed:', failed.map(([name]) => name).join(', ')); process.exit(1); }
console.log(`SEO/Site Quality MAX regression: ${checks.length}/${checks.length} passed`);
