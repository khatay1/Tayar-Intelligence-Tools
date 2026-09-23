const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export interface CVUploadValidation {
  valid: boolean;
  error?: string;
}

export function validateCVPhoto(file: Pick<File, 'size' | 'type'>): CVUploadValidation {
  if (!ALLOWED_PHOTO_TYPES.has(file.type)) return { valid: false, error: 'Unsupported photo type.' };
  if (file.size <= 0 || file.size > MAX_PHOTO_BYTES) return { valid: false, error: 'Photo must be smaller than 5 MB.' };
  return { valid: true };
}

export function sanitizeCVLink(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const normalized = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(normalized);
    return SAFE_LINK_PROTOCOLS.has(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

export function safeCVText(value: unknown, maxLength = 10_000): string {
  if (typeof value !== 'string') return '';
  return value.split(String.fromCharCode(0)).join('').slice(0, maxLength);
}
