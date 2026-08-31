import {
  ALLOWED_IMAGE_TYPES,
  ImageProcessOptions,
  ImageSourceInfo,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  MIN_IMAGE_DIMENSION,
} from './image-types';

function assertDimension(value: number, label: string) {
  if (!Number.isInteger(value) || value < MIN_IMAGE_DIMENSION || value > MAX_IMAGE_DIMENSION) {
    throw new Error(`${label} must be between ${MIN_IMAGE_DIMENSION} and ${MAX_IMAGE_DIMENSION} pixels.`);
  }
}

export function validateImageFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Unsupported image type. Use JPEG, PNG, or WebP.');
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image must be larger than 0 bytes and no more than 20 MB.');
  }
}

async function decodeBitmap(file: File) {
  validateImageFile(file);
  const bitmap = await createImageBitmap(file);
  const pixels = bitmap.width * bitmap.height;

  if (
    bitmap.width < MIN_IMAGE_DIMENSION ||
    bitmap.height < MIN_IMAGE_DIMENSION ||
    bitmap.width > MAX_IMAGE_DIMENSION ||
    bitmap.height > MAX_IMAGE_DIMENSION ||
    pixels > MAX_IMAGE_PIXELS
  ) {
    bitmap.close();
    throw new Error('Image dimensions are too large to process safely.');
  }

  return bitmap;
}

export async function inspectImage(file: File): Promise<ImageSourceInfo> {
  const bitmap = await decodeBitmap(file);
  try {
    return {
      width: bitmap.width,
      height: bitmap.height,
      size: file.size,
      type: file.type,
      name: file.name,
    };
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('The browser could not encode this image.')),
      type,
      quality,
    );
  });
}

export async function processImage(file: File, options: ImageProcessOptions): Promise<Blob> {
  assertDimension(options.width, 'Width');
  assertDimension(options.height, 'Height');

  if (options.width * options.height > MAX_IMAGE_PIXELS) {
    throw new Error('Requested output is too large to process safely.');
  }
  if (!ALLOWED_IMAGE_TYPES.has(options.format)) {
    throw new Error('Unsupported output image type.');
  }

  const bitmap = await decodeBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = options.width;
    canvas.height = options.height;

    const context = canvas.getContext('2d', { alpha: options.format !== 'image/jpeg' });
    if (!context) throw new Error('Canvas processing is not available in this browser.');

    if (options.format === 'image/jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, options.width, options.height);

    const quality = Math.min(1, Math.max(0.1, options.quality));
    return await canvasToBlob(canvas, options.format, quality);
  } finally {
    bitmap.close();
  }
}

export function safeOutputName(sourceName: string, extension: string) {
  const base = sourceName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'image';
  return `${base}-tayar.${extension}`;
}
