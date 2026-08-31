import { ImageOutputFormat } from '../image-tools/image-types';

export interface BatchImageOptions {
  format: ImageOutputFormat;
  quality: number;
  maxSide: number;
}

export interface BatchImageResult {
  sourceName: string;
  outputName: string;
  blob: Blob;
  width: number;
  height: number;
}

export const MAX_BATCH_FILES = 20;
export const MAX_BATCH_INPUT_BYTES = 80 * 1024 * 1024;
export const MAX_BATCH_OUTPUT_BYTES = 120 * 1024 * 1024;
export const MAX_BATCH_SIDE = 6000;
