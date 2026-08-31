import { validateImageFile } from '../image-tools/image-processing';
import { MAX_IMAGE_PIXELS } from '../image-tools/image-types';

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('The browser could not encode this image for PDF.')),
      'image/jpeg',
      Math.min(1, Math.max(0.5, quality)),
    );
  });
}

export async function encodeFileAsJpeg(file: File, quality: number) {
  validateImageFile(file);
  const bitmap = await createImageBitmap(file);

  try {
    if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) {
      throw new Error('Image is too large to encode safely.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas processing is not available in this browser.');

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);

    const blob = await canvasToJpeg(canvas, quality);
    return {
      jpeg: new Uint8Array(await blob.arrayBuffer()),
      width: bitmap.width,
      height: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}
