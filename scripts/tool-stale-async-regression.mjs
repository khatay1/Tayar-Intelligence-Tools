import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from '../node_modules/typescript/lib/typescript.js';

function removeImports(source, name) {
  const parsed = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
  for (const node of [...parsed.statements].reverse()) {
    if (ts.isImportDeclaration(node)) source = source.slice(0, node.pos) + source.slice(node.end);
  }
  return source;
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function componentHarness(file, name, handlers, extras) {
  let source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  source = removeImports(source, file);
  source = source.slice(0, source.indexOf('\n  return ('));
  source = source.replace(`export default function ${name}`, `function ${name}`);
  source += `\nreturn {${handlers.join(',')}};}globalThis.render=()=>${name}({darkMode:true});`;
  const state = [];
  let cursor = 0;
  const context = vm.createContext({
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useRef: (initial) => ({ current: initial }),
    useEffect() {},
    useMemo: (factory) => factory(),
    useLocalizer: () => (value) => value,
    URL: { createObjectURL: () => 'blob:fixture', revokeObjectURL() {} },
    ...extras,
  });
  vm.runInContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText, context);
  return { state, render() { cursor = 0; return context.render(); } };
}

{
  const firstRead = deferred();
  const secondRead = deferred();
  const harness = componentHarness('src/modules/csv-cleaner/CsvCleanerTool.tsx', 'CsvCleanerTool', ['loadFile'], {
    csvStats: () => null,
    readCsvFile: (file) => file.name === 'A' ? firstRead.promise : secondRead.promise,
  });
  const ui = harness.render();
  const first = ui.loadFile({ name: 'A' });
  const second = ui.loadFile({ name: 'B' });
  secondRead.resolve({ name: 'B', rows: [] });
  await second;
  firstRead.resolve({ name: 'A', rows: [] });
  await first;
  assert.equal(harness.state[0].name, 'B');
}

{
  const firstRead = deferred();
  const secondRead = deferred();
  const harness = componentHarness('src/modules/image-tools/ImageToolsTool.tsx', 'ImageToolsTool', ['loadFile'], {
    OUTPUT_FORMATS: [{ value: 'image/webp' }],
    inspectImage: (file) => file.name === 'A' ? firstRead.promise : secondRead.promise,
  });
  const ui = harness.render();
  const first = ui.loadFile({ name: 'A' });
  const second = ui.loadFile({ name: 'B' });
  secondRead.resolve({ name: 'B', width: 1, height: 1 });
  await second;
  firstRead.resolve({ name: 'A', width: 1, height: 1 });
  await first;
  assert.equal(harness.state[0].name, 'B');
}

{
  const work = deferred();
  const harness = componentHarness('src/modules/background-remover/BackgroundRemoverTool.tsx', 'BackgroundRemoverTool', ['loadFile', 'removeBackground'], {
    validateBackgroundFile() {},
    removeImageBackground: () => work.promise,
  });
  let ui = harness.render();
  ui.loadFile({ name: 'A' });
  ui = harness.render();
  const pending = ui.removeBackground();
  ui.loadFile({ name: 'B' });
  work.resolve({ url: 'blob:A', blob: {} });
  await pending;
  assert.equal(harness.state[0].name, 'B');
  assert.equal(harness.state[2], null);
}

{
  const work = deferred();
  const harness = componentHarness('src/modules/image-to-pdf/ImageToPdfTool.tsx', 'ImageToPdfTool', ['addFiles', 'createPdf'], {
    MAX_PDF_IMAGES: 20,
    validatePdfImages() {},
    completeMeteredLocalAction: async (_tool, _action, action) => action(),
    imagesToPdf: () => work.promise,
  });
  let ui = harness.render();
  ui.addFiles([{ name: 'A' }]);
  ui = harness.render();
  const pending = ui.createPdf();
  ui.addFiles([{ name: 'B' }]);
  work.resolve({ name: 'PDF-A' });
  await pending;
  assert.equal(harness.state[0].length, 2);
  assert.equal(harness.state[4], null);
}

console.log('tool stale async regression: PASS (4 cases)');
