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
    assert.ok(report.issues.some((issue) => issue.code.startsWith('contrast-') && issue.severity === 'critical'));
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
  console.log(`Design system regression: ${passed} behavioral scenarios passed.`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
