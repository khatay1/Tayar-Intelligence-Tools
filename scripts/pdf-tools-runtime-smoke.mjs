import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { PDFDocument } from '@pdfme/pdf-lib';

const root = process.cwd();
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'tayar-pdf-smoke-'));
const bundle = path.join(temp, 'pdf-engine.mjs');

function action(operation, files, patch = {}) {
  return {
    operation,
    files,
    pageSelection: '',
    pageOrder: '',
    rotation: 90,
    cropMm: { top: 5, right: 5, bottom: 5, left: 5 },
    position: 'bottom-center',
    startNumber: 1,
    text: 'Tayar',
    fontSize: 18,
    opacity: 0.2,
    signatureFile: null,
    signatureWidthPercent: 25,
    imageFormat: 'png',
    imageScale: 1,
    imageQuality: 0.8,
    compressionPreset: 'balanced',
    createPageSize: 'a4',
    createOrientation: 'portrait',
    createPageCount: 1,
    ...patch,
  };
}

async function pdfFile(name, pageSizes) {
  const document = await PDFDocument.create();
  for (const size of pageSizes) document.addPage(size);
  return new File([await document.save()], name, { type: 'application/pdf' });
}

async function loadResult(result) {
  assert.equal(result.kind, 'pdf');
  return PDFDocument.load(await result.blob.arrayBuffer());
}

try {
  await build({
    absWorkingDir: root,
    entryPoints: ['src/modules/pdf-tools/pdf-engine.ts'],
    outfile: bundle,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    external: ['./pdf-render'],
    logLevel: 'silent',
  });

  const { runPdfAction } = await import(`${pathToFileURL(bundle).href}?v=${Date.now()}`);
  const first = await pdfFile('first.pdf', [[200, 300], [400, 500]]);
  const second = await pdfFile('second.pdf', [[600, 700]]);

  let progress = null;
  const merged = await runPdfAction(action('merge', [first, second]), (value) => { progress = value; });
  assert.equal((await loadResult(merged)).getPageCount(), 3);
  assert.deepEqual(progress, { completed: 2, total: 2 });

  const split = await runPdfAction(action('split', [first]));
  const splitBytes = new Uint8Array(await split.blob.arrayBuffer());
  assert.equal(split.kind, 'zip');
  assert.deepEqual([...splitBytes.slice(0, 2)], [0x50, 0x4b]);

  const extracted = await loadResult(await runPdfAction(action('extract', [first], { pageSelection: '2,1' })));
  assert.equal(extracted.getPageCount(), 2);
  assert.equal(Math.round(extracted.getPage(0).getWidth()), 400);

  const arabicNamed = await pdfFile('وثيقة-عربية.pdf', [[200, 300], [400, 500]]);
  const arabicSelectionResult = await runPdfAction(action('extract', [arabicNamed], { pageSelection: '٢،١' }));
  const arabicSelection = await loadResult(arabicSelectionResult);
  assert.equal(Math.round(arabicSelection.getPage(0).getWidth()), 400);
  assert.match(arabicSelectionResult.filename, /^وثيقة-عربية-extracted\.pdf$/);

  const deleted = await loadResult(await runPdfAction(action('delete', [first], { pageSelection: '1' })));
  assert.equal(deleted.getPageCount(), 1);
  assert.equal(Math.round(deleted.getPage(0).getWidth()), 400);

  const reordered = await loadResult(await runPdfAction(action('reorder', [first], { pageOrder: '2,1' })));
  assert.equal(Math.round(reordered.getPage(0).getWidth()), 400);
  assert.equal(Math.round(reordered.getPage(1).getWidth()), 200);

  const rotated = await loadResult(await runPdfAction(action('rotate', [first], { pageSelection: '2', rotation: 90 })));
  assert.equal(rotated.getPage(0).getRotation().angle, 0);
  assert.equal(rotated.getPage(1).getRotation().angle, 90);

  const cropped = await loadResult(await runPdfAction(action('crop', [first], { pageSelection: '1' })));
  assert.ok(cropped.getPage(0).getCropBox().width < 200);
  assert.equal(Math.round(cropped.getPage(1).getCropBox().width), 400);

  const numbered = await loadResult(await runPdfAction(action('page-numbers', [first], { startNumber: 4 })));
  assert.equal(numbered.getPageCount(), 2);

  const created = await loadResult(await runPdfAction(action('create', [], { createPageCount: 3, createOrientation: 'landscape' })));
  assert.equal(created.getPageCount(), 3);
  assert.ok(created.getPage(0).getWidth() > created.getPage(0).getHeight());

  const formDocument = await PDFDocument.create();
  const formPage = formDocument.addPage([300, 300]);
  const field = formDocument.getForm().createTextField('name');
  field.addToPage(formPage, { x: 20, y: 240, width: 180, height: 24 });
  field.setText('Tayar');
  const formFile = new File([await formDocument.save()], 'form.pdf', { type: 'application/pdf' });
  const flattened = await loadResult(await runPdfAction(action('flatten', [formFile])));
  assert.equal(flattened.getForm().getFields().length, 0);

  const signatureBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZC1sAAAAASUVORK5CYII=', 'base64');
  const signature = new File([signatureBytes], 'signature.png', { type: 'image/png' });
  const signed = await loadResult(await runPdfAction(action('sign', [first], { signatureFile: signature, pageSelection: '2' })));
  assert.equal(signed.getPageCount(), 2);

  await assert.rejects(
    runPdfAction(action('extract', [first], { pageSelection: '3' })),
    /between 1 and 2/,
  );

  const tooManySplitPages = await pdfFile('many-pages.pdf', Array.from({ length: 101 }, () => [200, 300]));
  await assert.rejects(
    runPdfAction(action('split', [tooManySplitPages])),
    /up to 100 pages/,
  );

  console.log('PDF tools runtime smoke: 14 workflows passed');
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
