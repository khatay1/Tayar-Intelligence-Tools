import { supabase } from '@/lib/supabase';
import {
  BACKGROUND_ALLOWED_TYPES,
  BackgroundRemovalResult,
  MAX_BACKGROUND_IMAGE_BYTES,
} from './background-remover-types';

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read this image.'));
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      if (!value) reject(new Error('Could not encode this image.'));
      else resolve(value);
    };
    reader.readAsDataURL(file);
  });
}

export function validateBackgroundFile(file: File) {
  if (!BACKGROUND_ALLOWED_TYPES.has(file.type)) {
    throw new Error('Use a JPEG, PNG or WebP image.');
  }
  if (file.size <= 0 || file.size > MAX_BACKGROUND_IMAGE_BYTES) {
    throw new Error('Image must be larger than 0 bytes and no more than 3 MB.');
  }
}

export async function removeImageBackground(
  file: File,
  cropToBbox: boolean,
): Promise<BackgroundRemovalResult> {
  validateBackgroundFile(file);
  const imageDataUrl = await readAsDataUrl(file);

  const { data, error } = await supabase.functions.invoke('background-remover', {
    body: {
      imageDataUrl,
      cropToBbox,
    },
  });

  if (error) {
    throw new Error(error.message || 'Background removal request failed.');
  }

  if (!data || typeof data !== 'object' || typeof data.url !== 'string') {
    throw new Error('Background remover returned an invalid response.');
  }

  return {
    url: data.url,
    width: Number.isFinite(Number(data.width)) ? Number(data.width) : null,
    height: Number.isFinite(Number(data.height)) ? Number(data.height) : null,
    fileSize: Number.isFinite(Number(data.fileSize)) ? Number(data.fileSize) : null,
    contentType: typeof data.contentType === 'string' ? data.contentType : 'image/png',
  };
}

export async function downloadRemoteResult(url: string, fallbackName: string) {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('download failed');
    const blob = await response.blob();
    const localUrl = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = localUrl;
      anchor.download = fallbackName;
      anchor.rel = 'noopener';
      anchor.click();
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(localUrl), 1000);
    }
  } catch {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.click();
  }
}
