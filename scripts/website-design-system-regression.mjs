import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const temp = await mkdtemp(join(tmpdir(), 'tayar-design-system-'));
let passed = 0;
const check = (name, test) => { test(); passed += 1; console.log(`PASS ${name}`); };

try {
  const outfile = join(temp, 'design-system.mjs');
  await build({ entryPoints: ['src/modules/website-builder/core/website-design-system.ts'], bundle: true, platform: 'node', format: 'esm', outfile });
  const design = await import(pathToFileURL(outfile));
  const weakTheme = { primaryColor: '#777777', secondaryColor: '#eeeeee', backgroundColor: '#ffffff', textColor: '#eeeeee', mutedTextColor: '#dddddd', fontFamily: 'Inter', contentWidth: 1173, buttonRadius: 13, sectionSpacing: 83 };
  const pages = [{ id: 'home', name: 'Home', slug: 'home', showInNavigation: true, sections: [{ id: 'hero', type: 'hero', background: '#fefefe', accent: '#abcdef', elements: [
    { id: 'tiny', type: 'text', content: 'Tiny', style: { fontSize: 10, lineHeight: 1.05, padding: 7, color: '#123456' } },
    ...Array.from({ length: 9 }, (_, index) => ({ id: `t-${index}`, type: 'text', content: 'Type', style: { fontSize: 14 + index, borderRadius: index } })),
  ] }] }];

  check('contrast ratio matches WCAG black-on-white baseline', () => assert.equal(design.contrastRatio('#000000', '#ffffff'), 21));
  check('weak theme produces deterministic critical findings', () => {
    const report = design.analyzeWebsiteDesignSystem(weakTheme, pages);
    assert.ok(report.score < 70);
    assert.ok(report.issues.some((issue) => issue.code.startsWith('contrast-') && issue.severity === 'warning'));
    assert.ok(report.issues.some((issue) => issue.code === 'tiny-text'));
  });
  check('repair raises global text contrast and snaps tokens', () => {
    const repaired = design.repairWebsiteDesignTheme(weakTheme);
    assert.ok(design.contrastRatio(repaired.textColor, repaired.backgroundColor) >= 4.5);
    assert.ok([1080, 1120, 1200].includes(repaired.contentWidth));
    assert.equal(repaired.buttonRadius, 12);
    assert.equal(repaired.sectionSpacing, 80);
  });
  check('all presets pass body-text contrast', () => {
    assert.equal(design.WEBSITE_DESIGN_SYSTEM_PRESETS.length, 4);
    for (const preset of design.WEBSITE_DESIGN_SYSTEM_PRESETS) assert.ok(design.contrastRatio(preset.theme.textColor, preset.theme.backgroundColor) >= 4.5, preset.id);
  });
  check('actual button contrast is caught even when theme tokens pass', () => {
    const theme = design.WEBSITE_DESIGN_SYSTEM_PRESETS.find((preset) => preset.id === 'bold').theme;
    const pages = [{ id: 'p', sections: [{ id: 's', background: theme.backgroundColor, elements: [{ id: 'cta', type: 'button', content: 'Go', style: { color: '#fff', backgroundColor: theme.primaryColor, fontSize: 16 } }] }] }];
    assert.ok(design.analyzeWebsiteDesignSystem(theme, pages).issues.some((issue) => issue.code.startsWith('element-contrast-') && issue.severity === 'critical'));
  });
  check('hidden text, images and unknown CSS colors do not invent blocking findings', () => {
    const theme = design.WEBSITE_DESIGN_SYSTEM_PRESETS[0].theme;
    const pages = [{ id: 'p', sections: [{ id: 's', background: '#fff', elements: [
      { id: 'hidden', type: 'text', content: 'Hidden', style: { hidden: true, fontSize: 8, color: '#fff' } },
      { id: 'image', type: 'image', content: 'image.png', style: { fontSize: 8 } },
      { id: 'css', type: 'text', content: 'CSS', style: { color: 'var(--text)', fontSize: 16 } },
    ] }] }];
    assert.ok(!design.analyzeWebsiteDesignSystem(theme, pages).issues.some((issue) => issue.severity === 'critical'));
    assert.ok(Number.isNaN(design.contrastRatio('transparent', '#fff')));
  });
  check('token repair keeps custom backgrounds, spacing and colors, and is idempotent', () => {
    const source = [{ id: 'p', sections: [{ id: 's', background: '#123456', sectionPaddingX: 37, elements: [
      { id: 'custom', type: 'text', content: 'Custom', style: { color: '#abcdef', padding: 13 } },
      { id: 'bound', type: 'text', content: 'Bound', style: { color: weakTheme.textColor } },
    ] }] }];
    const before = structuredClone(source);
    const repaired = design.repairWebsiteDesignTokens(weakTheme, source);
    assert.equal(repaired.pages[0].sections[0].background, '#123456');
    assert.equal(repaired.pages[0].sections[0].sectionPaddingX, 37);
    assert.deepEqual(repaired.pages[0].sections[0].elements[0], source[0].sections[0].elements[0]);
    assert.deepEqual(source, before);
    assert.deepEqual(design.repairWebsiteDesignTokens(repaired.theme, repaired.pages), repaired);
  });
  console.log(`Design system regression: ${passed} behavioral scenarios passed.`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
