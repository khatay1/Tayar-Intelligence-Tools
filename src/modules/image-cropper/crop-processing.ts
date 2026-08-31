import {
  ALLOWED_IMAGE_TYPES,
  ImageOutputFormat,
  MAX_IMAGE_PIXELS,
} from '../image-tools/image-types';
import { inspectImage, safeOutputName, validateImageFile } from '../image-tools/image-processing';
import { CropExportOptions, CropRect } from './crop-types';

export async function initialCropRect(file: File): Promise<CropRect> {
  const info = await inspectImage(file);
  return { x: 0, y: 0, width: info.width, height: info.height };
}

export function cropForRatio(
  sourceWidth: number,
  sourceHeight: number,
  ratio: number,
): CropRect {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new Error('Crop ratio must be a positive number.');
  }

  const sourceRatio = sourceWidth / sourceHeight;
  let width = sourceWidth;
  let height = sourceHeight;

  if (sourceRatio > ratio) width = Math.max(1, Math.round(sourceHeight * ratio));
  else height = Math.max(1, Math.round(sourceWidth / ratio));

  return {
    x: Math.max(0, Math.round((sourceWidth - width) / 2)),
    y: Math.max(0, Math.round((sourceHeight - height) / 2)),
    width,
    height,
  };
}

export function validateCropRect(
  crop: CropRect,
  sourceWidth: number,
  sourceHeight: number,
) {
  const values = [crop.x, crop.y, crop.width, crop.height];
  if (values.some((value) => !Number.isInteger(value))) {
    throw new Error('Crop values must be whole pixels.');
  }
  if (crop.x < 0 || crop.y < 0 || crop.width < 1 || crop.height < 1) {
    throw new Error('Crop position and size are invalid.');
  }
  if (crop.x + crop.width > sourceWidth || crop.y + crop.height > sourceHeight) {
    throw new Error('Crop area extends outside the source image.');
  }
  if (crop.width * crop.height > MAX_IMAGE_PIXELS) {
    throw new Error('Crop output is too large to process safely.');
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ImageOutputFormat,
  quality: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('The browser could not encode this crop.')),
      format,
      Math.min(1, Math.max(0.1, quality)),
    );
  });
}

export async function cropImage(
  file: File,
  crop: CropRect,
  options: CropExportOptions,
): Promise<Blob> {
  validateImageFile(file);
  if (!ALLOWED_IMAGE_TYPES.has(options.format)) {
    throw new Error('Unsupported crop output format.');
  }

  const bitmap = await createImageBitmap(file);
  try {
    validateCropRect(crop, bitmap.width, bitmap.height);

    const canvas = document.createElement('canvas');
    canvas.width = crop.width;
    canvas.height = crop.height;

    const context = canvas.getContext('2d', { alpha: options.format !== 'image/jpeg' });
    if (!context) throw new Error('Canvas processing is not available in this browser.');

    if (options.format === 'image/jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.drawImage(
      bitmap,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height,
    );

    return await canvasToBlob(canvas, options.format, options.quality);
  } finally {
    bitmap.close();
  }
}

export function cropOutputName(sourceName: string, extension: string) {
  return safeOutputName(sourceName, extension).replace('-tayar.', '-crop-tayar.');
}
