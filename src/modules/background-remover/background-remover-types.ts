export interface BackgroundRemovalResult {
  url: string;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  contentType: string;
}

export const MAX_BACKGROUND_IMAGE_BYTES = 3 * 1024 * 1024;
export const BACKGROUND_ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
