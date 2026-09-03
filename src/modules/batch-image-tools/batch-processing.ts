import { completeMeteredLocalAction } from '@/lib/tool-usage';
import { inspectImage, processImage, safeOutputName } from '../image-tools/image-processing';
import { OUTPUT_FORMATS } from '../image-tools/image-types';
import {
  BatchImageOptions,
  BatchImageResult,
  MAX_BATCH_FILES,
  MAX_BATCH_INPUT_BYTES,
  MAX_BATCH_OUTPUT_BYTES,
  MAX_BATCH_SIDE,
} from './batch-types';

export function validateBatchFiles(files: File[]) {
  if (!files.length) throw new Error('Choose at least one image.');
  if (files.length > MAX_BATCH_FILES) {
    throw new Error(`Choose no more than ${MAX_BATCH_FILES} images at once.`);
  }

  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_BATCH_INPUT_BYTES) {
    throw new Error('Combined source files exceed the 80 MB batch limit.');
  }
}

function targetSize(width: number, height: number, maxSide: number) {
  if (!maxSide || Math.max(width, height) <= maxSide) return { width, height };
  const scale = maxSide / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function processBatch(
  files: File[],
  options: BatchImageOptions,
  onProgress?: (completed: number, total: number) => void,
): Promise<BatchImageResult[]> {
  validateBatchFiles(files);

  if (!Number.isFinite(options.maxSide) || options.maxSide < 0 || options.maxSide > MAX_BATCH_SIDE) {
    throw new Error(`Maximum side must be between 0 and ${MAX_BATCH_SIDE} pixels.`);
  }

  const outputFormat = OUTPUT_FORMATS.find((item) => item.value === options.format);
  if (!outputFormat) throw new Error('Unsupported output format.');

  return completeMeteredLocalAction('batch-image-tools', 'process-batch', async () => {
    const results: BatchImageResult[] = [];
    let totalOutputBytes = 0;

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const info = await inspectImage(file);
      const size = targetSize(info.width, info.height, Math.round(options.maxSide));
      const blob = await processImage(file, {
        width: size.width,
        height: size.height,
        format: options.format,
        quality: options.quality,
      });

      totalOutputBytes += blob.size;
      if (totalOutputBytes > MAX_BATCH_OUTPUT_BYTES) {
        throw new Error('Processed images exceed the 120 MB batch output safety limit.');
      }

      results.push({
        sourceName: file.name,
        outputName: `${String(index + 1).padStart(2, '0')}-${safeOutputName(file.name, outputFormat.extension)}`,
        blob,
        width: size.width,
        height: size.height,
      });
      onProgress?.(index + 1, files.length);
    }

    return results;
  });
}
