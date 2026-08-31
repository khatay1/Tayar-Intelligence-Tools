import { ImageOutputFormat } from '../image-tools/image-types';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropExportOptions {
  format: ImageOutputFormat;
  quality: number;
}

export type CropPresetId = 'free' | 'square' | '4:3' | '3:2' | '16:9' | '9:16';

export interface CropPreset {
  id: CropPresetId;
  label: string;
  ratio: number | null;
}

export const CROP_PRESETS: CropPreset[] = [
  { id: 'free', label: 'Free', ratio: null },
  { id: 'square', label: '1:1', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
];
