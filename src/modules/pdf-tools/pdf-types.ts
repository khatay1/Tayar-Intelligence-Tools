export type PdfOperationGroup = 'organize' | 'edit' | 'convert' | 'optimize';

export type PdfOperationId =
  | 'merge'
  | 'split'
  | 'extract'
  | 'delete'
  | 'reorder'
  | 'rotate'
  | 'crop'
  | 'page-numbers'
  | 'watermark'
  | 'add-text'
  | 'sign'
  | 'create'
  | 'to-images'
  | 'extract-text'
  | 'compress'
  | 'flatten';

export type PdfPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type PdfImageFormat = 'png' | 'jpeg';
export type PdfCompressionPreset = 'quality' | 'balanced' | 'small';
export type PdfPageSize = 'a4' | 'letter';
export type PdfOrientation = 'portrait' | 'landscape';

export interface PdfOperationDefinition {
  id: PdfOperationId;
  group: PdfOperationGroup;
  label: string;
  description: string;
  multiple?: boolean;
  requiresFile?: boolean;
}

export interface PdfSourceInfo {
  name: string;
  size: number;
  pageCount: number;
}

export interface PdfCropMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PdfActionOptions {
  operation: PdfOperationId;
  files: File[];
  pageSelection: string;
  pageOrder: string;
  rotation: 90 | 180 | 270;
  cropMm: PdfCropMargins;
  position: PdfPosition;
  startNumber: number;
  text: string;
  fontSize: number;
  opacity: number;
  signatureFile: File | null;
  signatureWidthPercent: number;
  imageFormat: PdfImageFormat;
  imageScale: number;
  imageQuality: number;
  compressionPreset: PdfCompressionPreset;
  createPageSize: PdfPageSize;
  createOrientation: PdfOrientation;
  createPageCount: number;
}

export interface PdfProcessProgress {
  completed: number;
  total: number;
}

export type PdfProcessResult =
  | {
      kind: 'pdf' | 'zip';
      blob: Blob;
      filename: string;
      itemCount?: number;
    }
  | {
      kind: 'text';
      blob: Blob;
      filename: string;
      text: string;
      itemCount?: number;
    };

export const PDF_MAX_FILE_BYTES = 50 * 1024 * 1024;
export const PDF_MAX_TOTAL_BYTES = 120 * 1024 * 1024;
export const PDF_MAX_FILES = 12;
export const PDF_MAX_PAGES = 150;
export const PDF_MAX_RENDER_PAGES = 60;
export const PDF_MAX_SPLIT_PAGES = 100;

export const PDF_OPERATION_GROUPS: Array<{ id: PdfOperationGroup; label: string }> = [
  { id: 'organize', label: 'Organize' },
  { id: 'edit', label: 'Edit & sign' },
  { id: 'convert', label: 'Convert' },
  { id: 'optimize', label: 'Optimize' },
];

export const PDF_OPERATIONS: PdfOperationDefinition[] = [
  { id: 'merge', group: 'organize', label: 'Merge PDF', description: 'Combine multiple PDF files in your chosen order.', multiple: true },
  { id: 'split', group: 'organize', label: 'Split PDF', description: 'Save every page as a separate PDF inside one ZIP.' },
  { id: 'extract', group: 'organize', label: 'Extract pages', description: 'Create a new PDF from the pages you choose.' },
  { id: 'delete', group: 'organize', label: 'Delete pages', description: 'Remove selected pages and keep the rest.' },
  { id: 'reorder', group: 'organize', label: 'Reorder pages', description: 'Enter the exact new order for every page.' },
  { id: 'rotate', group: 'organize', label: 'Rotate pages', description: 'Rotate all pages or only a selected range.' },
  { id: 'crop', group: 'organize', label: 'Crop PDF', description: 'Trim page edges using precise millimetre margins.' },
  { id: 'page-numbers', group: 'edit', label: 'Add page numbers', description: 'Number all pages or a selected range.' },
  { id: 'watermark', group: 'edit', label: 'Add watermark', description: 'Stamp custom text with position and opacity controls.' },
  { id: 'add-text', group: 'edit', label: 'Add text', description: 'Place text on one page, a range, or the entire PDF.' },
  { id: 'sign', group: 'edit', label: 'Sign PDF', description: 'Place your PNG, JPEG, or WebP signature on selected pages.' },
  { id: 'create', group: 'edit', label: 'Create PDF', description: 'Create a clean blank PDF with your page size and orientation.', requiresFile: false },
  { id: 'to-images', group: 'convert', label: 'PDF to images', description: 'Export every page as PNG or JPEG in one ZIP.' },
  { id: 'extract-text', group: 'convert', label: 'PDF to text', description: 'Extract selectable text from every page into a TXT file.' },
  { id: 'compress', group: 'optimize', label: 'Compress PDF', description: 'Reduce file size by rebuilding pages at a chosen quality.' },
  { id: 'flatten', group: 'optimize', label: 'Flatten forms', description: 'Lock completed form fields into the PDF page content.' },
];
