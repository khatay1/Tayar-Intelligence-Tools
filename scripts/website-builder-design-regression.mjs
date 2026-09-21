import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const temp = await mkdtemp(join(tmpdir(), 'tayar-design-'));
let passed = 0;
const check = (name, test) => { test(); passed++; console.log(`PASS ${name}`); };
try {
  const outfile = join(temp, 'design.mjs');
  await build({
    stdin: { contents: [
      'editor-arrangement', 'editor-design-commands', 'editor-command', 'editor-history',
      'editor-inspector-model', 'editor-inspector-operation', 'editor-value-safety',
      'editor-layout-style', 'editor-motion', 'editor-ai-plan-coverage', 'defaults',
    ].map((name) => `export * from './src/modules/website-builder/core/${name}.ts';`).join('\n'), resolveDir: process.cwd() },
    bundle: true, platform: 'node', format: 'esm', outfile,
    alias: { '@': join(process.cwd(), 'src') },
  });
  const { settledCanvasElementRect, arrangeCanvasElements: arrange, commandRepairResponsive: repair, commandRestyleSite: restyle,
    runEditorCommand: run, createEditorHistory: history, undoEditorHistory: undo, redoEditorHistory: redo,
    buildEditorInspectorFields: inspectorFields, buildEditorInspectorOperation: inspectorOperation,
    inspectEditorContainerSemantic: inspectContainer, containerLayoutCss, elementConstraintCss, normalizeSection,
    elementAnimationTransform, normalizeElementAnimation, elementAnimationEasing,
    evaluateAIWebsitePlanCoverage } = await import(pathToFileURL(outfile));
  const box = (id, left, top, width = 20, height = 20, x = 0, y = 0) => ({ id, rect: { left, top, width, height }, x, y });
  check('all six alignments use the selection bounds', () => {
    const items = [box('a', 10, 20), box('b', 110, 120, 40, 40)];
    const expected = { left: ['b', 'x', -100], center: ['a', 'x', 60], right: ['a', 'x', 120],
      top: ['b', 'y', -100], middle: ['a', 'y', 60], bottom: ['a', 'y', 120] };
    for (const [action, [id, axis, value]] of Object.entries(expected)) assert.equal(arrange(items, action, 1).get(id)[axis], value);
  });
  check('zoom converts viewport movement into document movement', () => {
    for (const scale of [0.5, 0.75, 1, 1.5]) {
      const items = [box('a', 10 * scale, 0), box('b', 110 * scale, 0, 20, 20, 7)];
      assert.equal(arrange(items, 'left', scale).get('b').x, -93);
    }
  });
  check('already aligned fractional offsets produce no history candidate', () => {
    assert.equal(arrange([box('a', 10, 0, 20, 20, 0.25), box('b', 10, 50)], 'left', 1).size, 0);
  });
  check('horizontal distribution preserves both anchors and equal gaps', () => {
    const items = [box('c', 180, 0, 40), box('a', 0, 0, 30), box('b', 60, 0, 20)];
    const positions = arrange(items, 'distribute-horizontal', 1);
    assert.equal(positions.get('a').x, 0); assert.equal(positions.get('c').x, 0);
    assert.equal(positions.get('b').x, 35);
    assert.equal(95 - 30, 180 - (95 + 20));
  });
  check('overlapping unequal widths never move the last anchor', () => {
    const positions = arrange([box('a', 0, 0, 400), box('b', 80, 0), box('c', 100, 0)], 'distribute-horizontal', 1);
    assert.equal(positions.get('a').x, 0); assert.equal(positions.get('c').x, 0);
    assert.equal(positions.get('b').x, 160);
  });
  check('vertical distribution changes only Y and keeps fractional anchors', () => {
    const positions = arrange([box('a', 0, 0, 20, 20, 4, 0.25), box('b', 0, 30), box('c', 0, 100)], 'distribute-vertical', 1);
    assert.deepEqual(positions.get('a'), { y: 0.25 }); assert.deepEqual(positions.get('b'), { y: 20 });
  });
  check('invalid measurements and duplicate identities are rejected', () => {
    const items = [box('a', 0, 0), box('b', 20, 20)];
    for (const scale of [0, -1, NaN, Infinity]) assert.equal(arrange(items, 'left', scale).size, 0);
    assert.equal(arrange([items[0], items[0]], 'left', 1).size, 0);
    assert.equal(arrange([items[0], box('b', NaN, 0)], 'left', 1).size, 0);
    assert.equal(arrange(items, 'distribute-horizontal', 1).size, 0);
  });
  check('offsets stay inside document limits', () => {
    assert.equal(arrange([box('a', 0, 0), box('b', 9000, 0)], 'left', 0.5).get('b').x, -4000);
  });
  check('measurement finishes only active transform transitions', () => {
    let moving = true;
    const target = { left: 120, top: 0, width: 20, height: 20 };
    const node = {
      getAnimations: () => [
        { transitionProperty: 'transform', playState: 'running', finish: () => { moving = false; } },
        { transitionProperty: 'opacity', playState: 'running', finish: () => { throw Error('opacity transition changed'); } },
        { playState: 'running', finish: () => { throw Error('keyframe animation changed'); } },
      ],
      getBoundingClientRect: () => moving ? { ...target, left: 60 } : target,
    };
    assert.deepEqual(settledCanvasElementRect(node), target);
  });
  const project = () => ({ pages: [{ id: 'p', sections: [{ id: 's', sectionPaddingX: 80,
    elements: [{ id: 'e', type: 'heading', style: { fontSize: 80, marginLeft: -100, positionX: 200 },
      responsive: { desktop: { fontSize: 90 }, mobile: { fontSize: 27, hidden: true } } }] }] }] });
  check('repair preserves desktop and intentional overrides, including zero', () => {
    const input = project(); input.pages[0].sections[0].elements[0].responsive.tablet = { padding: 0 };
    const result = run(input, repair('p'), { history: history() });
    assert.equal(result.transaction.ok, true);
    const element = result.project.pages[0].sections[0].elements[0];
    assert.deepEqual(element.style, input.pages[0].sections[0].elements[0].style);
    assert.deepEqual(element.responsive.desktop, { fontSize: 90 });
    assert.equal(element.responsive.mobile.fontSize, 27); assert.equal(element.responsive.mobile.hidden, true);
    assert.equal(element.responsive.tablet.padding, 0); assert.equal(element.responsive.tablet.fontSize, 48);
    assert.equal(element.responsive.mobile.marginLeft, -24); assert.equal(element.responsive.mobile.positionX, 0);
    assert.equal(input.pages[0].sections[0].elements[0].responsive.mobile.positionX, undefined);
  });
  check('second responsive repair is a true no-op', () => {
    const once = run(project(), repair('p'), { history: history() });
    const twice = run(once.project, repair('p'), { history: once.history });
    assert.equal(twice.transaction.changed, false); assert.equal(twice.history.past.length, 1);
  });
  check('no-op repair preserves existing empty device records', () => {
    const input = { pages: [{ id: 'p', sections: [{ id: 's', elements: [{ id: 'e', responsive: { mobile: {} } }] }] }] };
    assert.equal(run(input, repair('p'), { history: history() }).transaction.changed, false);
  });
  check('no-op repair never overwrites another linked instance', () => {
    const element = { id: 'e', type: 'heading', symbolId: 'sym', content: 'First', style: { fontSize: 80 }, responsive: { tablet: { fontSize: 40 }, mobile: { fontSize: 30 } } };
    const input = { pages: [{ id: 'p', sections: [{ id: 's', elements: [element, { ...structuredClone(element), id: 'other', content: 'Second' }] }] }], symbols: [{ id: 'sym', element: { ...structuredClone(element), id: 'template' } }] };
    const result = run(input, repair('p'), { history: history() });
    assert.equal(result.transaction.changed, false); assert.deepEqual(result.project, input);
  });
  check('restyling does not synchronize untouched image components', () => {
    const first = { id: 'image', type: 'image', symbolId: 'sym', alt: 'First' };
    const input = { pages: [{ id: 'p', sections: [{ id: 's', elements: [first, { ...first, id: 'other', alt: 'Second' }] }] }], symbols: [{ id: 'sym', element: { ...first, id: 'template' } }] };
    const result = run(input, restyle({ primaryColor: '#123456' }), { history: history() });
    assert.equal(result.transaction.ok, true);
    assert.deepEqual(result.project.pages, input.pages); assert.deepEqual(result.project.symbols, input.symbols);
  });
  check('repair rejects unknown pages atomically', () => {
    const input = project(); const result = run(input, repair('missing'), { history: history() });
    assert.equal(result.transaction.ok, false); assert.deepEqual(result.project, input); assert.equal(result.history.past.length, 0);
  });
  check('repair supports full undo and redo', () => {
    const input = project(); const result = run(input, repair('p'), { history: history() });
    const back = undo(result.project, result.history);
    assert.deepEqual(back.value, input);
    const forward = redo(back.value, back.history);
    assert.deepEqual(forward.value, result.project);
  });
  check('grid and flex container controls normalize and render safely', () => {
    const section = normalizeSection({ id: 's-grid', type: 'features', containers: [{
      id: 'c', name: 'Cards', layout: 'grid', gap: 24, rowGap: 32, columns: 99, wrap: false,
      align: 'stretch', justify: 'between', backgroundColor: '#111111', padding: 12,
      borderRadius: 8, borderWidth: 1, borderColor: '#222222', shadow: 'sm',
    }], elements: [{ id: 'e', type: 'text', content: 'Card', containerId: 'c', style: {} }] });
    const container = section.containers[0];
    assert.equal(container.columns, 12);
    assert.equal(inspectContainer(container).ok, true);
    const css = containerLayoutCss(container).join(';');
    assert.match(css, /display:grid/); assert.match(css, /repeat\(12,minmax\(0,1fr\)\)/);
    assert.match(css, /row-gap:32px/); assert.match(css, /justify-content:space-between/);
  });
  check('element constraints are emitted for published output', () => {
    const css = elementConstraintCss({ width: 72.5, minWidth: 160, maxWidth: 960, height: 320,
      minHeight: 120, maxHeight: 640, aspectRatio: 1.5, flexGrow: 2, flexShrink: 0 });
    const output = css.join(';');
    assert.match(output, /width:72.5%/); assert.match(output, /min-width:160px/);
    assert.match(output, /height:320px/); assert.match(output, /aspect-ratio:1.5/);
  });
  check('responsive inspector exposes inherited precision and reset removes override', () => {
    const input = { pages: [{ id: 'p', sections: [{ id: 's', elements: [{ id: 'e', type: 'heading',
      style: { width: 88, positionX: 14 }, responsive: { mobile: { width: 60, positionX: 0 } } }] }] }] };
    const selection = { pageId: 'p', sectionId: 's', elementId: 'e' };
    const fields = inspectorFields(input, selection);
    const width = fields.find((item) => item.key === 'responsive.mobile.width');
    assert.equal(width.unit, '%'); assert.equal(width.inheritedValue, 88); assert.equal(width.overridden, true);
    const operation = inspectorOperation(input, selection, 'responsive.mobile.width', undefined);
    assert.equal(operation.action, 'update_element');
    assert.equal(operation.changes.responsive.mobile.width, undefined);
    assert.equal(Object.hasOwn(operation.changes.responsive.mobile, 'width'), false);
    assert.equal(operation.changes.responsive.mobile.positionX, 0);
  });
  check('motion presets normalize safely and expose deterministic easing', () => {
    assert.equal(normalizeElementAnimation('bounce-in'), 'bounce-in');
    assert.equal(normalizeElementAnimation('unsafe-motion'), 'none');
    assert.equal(elementAnimationTransform('slide-left', 48), 'translate3d(48px,0,0)');
    assert.equal(elementAnimationTransform('flip-in', 48), 'perspective(900px) rotateX(-18deg)');
    assert.equal(elementAnimationEasing('spring'), 'cubic-bezier(.34,1.56,.64,1)');
  });
  check('responsive inspector exposes inherited motion overrides', () => {
    const input = { pages: [{ id: 'p', sections: [{ id: 's', elements: [{ id: 'e', type: 'heading',
      style: { animation: 'fade-up', animationDuration: 700, parallaxSpeed: .2 },
      responsive: { mobile: { animation: 'none', parallaxSpeed: 0 } } }] }] }] };
    const fields = inspectorFields(input, { pageId: 'p', sectionId: 's', elementId: 'e' });
    const animation = fields.find((item) => item.key === 'responsive.mobile.animation');
    const parallax = fields.find((item) => item.key === 'responsive.mobile.parallaxSpeed');
    assert.equal(animation.value, 'none'); assert.equal(animation.inheritedValue, 'fade-up');
    assert.equal(parallax.value, 0); assert.equal(parallax.overridden, true);
  });
  check('agent plan coverage reports missing unknown and unassigned work', () => {
    const steps = [{ id: 'step-1', title: 'Hero' }, { id: 'step-2', title: 'Mobile' }];
    const result = evaluateAIWebsitePlanCoverage(steps, [
      { action: 'update_section', planStepId: 'step-1' },
      { action: 'update_element', planStepId: 'missing-step' },
      { action: 'update_seo' },
    ]);
    assert.equal(result.percent, 50);
    assert.deepEqual(result.coveredStepIds, ['step-1']);
    assert.deepEqual(result.uncoveredStepIds, ['step-2']);
    assert.deepEqual(result.unknownStepIds, ['missing-step']);
    assert.equal(result.unassignedOperationCount, 1);
    assert.equal(result.warnings.length, 3);
  });
  console.log(`Design regression: ${passed} behavioral scenarios passed.`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
