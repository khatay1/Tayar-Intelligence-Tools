export type ImageOutputFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ImageSourceInfo {
  width: number;
  height: number;
  size: number;
  type: string;
  name: string;
}

export interface ImageProcessOptions {
  width: number;
  height: number;
  format: ImageOutputFormat;
  quality: number;
}

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;
export const MAX_IMAGE_DIMENSION = 12_000;
export const MIN_IMAGE_DIMENSION = 1;

export const ALLOWED_IMAGE_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const OUTPUT_FORMATS: Array<{ value: ImageOutputFormat; label: string; extension: string }> = [
  { value: 'image/jpeg', label: 'JPEG', extension: 'jpg' },
  { value: 'image/png', label: 'PNG', extension: 'png' },
  { value: 'image/webp', label: 'WebP', extension: 'webp' },
];
