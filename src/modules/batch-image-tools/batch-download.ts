import { BatchImageResult } from './batch-types';
import { createStoreOnlyZip } from './zip-writer';

export async function buildBatchZip(results: BatchImageResult[]) {
  const entries = await Promise.all(
    results.map(async (result) => ({
      name: result.outputName,
      data: new Uint8Array(await result.blob.arrayBuffer()),
    })),
  );

  return createStoreOnlyZip(entries);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
