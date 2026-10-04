export type MediaOperationId =
  | 'video-to-images'
  | 'video-to-gif'
  | 'gif-to-video'
  | 'images-to-video'
  | 'audio-image-to-video'
  | 'trim-video'
  | 'split-video'
  | 'merge-videos'
  | 'compress-video'
  | 'convert-video'
  | 'remove-audio'
  | 'extract-audio'
  | 'add-audio'
  | 'replace-audio'
  | 'change-volume'
  | 'fade-audio'
  | 'change-speed'
  | 'reverse-video'
  | 'rotate-video'
  | 'flip-video'
  | 'resize-video'
  | 'crop-video'
  | 'change-aspect-ratio'
  | 'change-fps'
  | 'add-subtitles'
  | 'burn-subtitles'
  | 'add-text-watermark'
  | 'add-image-watermark'
  | 'create-thumbnail'
  | 'loop-video'
  | 'freeze-frame'
  | 'remove-metadata';

export type MediaOperationGroup = 'convert' | 'edit' | 'audio' | 'visual' | 'export';

export type MediaInputKind = 'video' | 'audio' | 'image' | 'images' | 'videos' | 'gif' | 'subtitle';

export interface MediaOperationDefinition {
  id: MediaOperationId;
  name: string;
  description: string;
  group: MediaOperationGroup;
  input: MediaInputKind[];
  output: 'video' | 'audio' | 'image' | 'images' | 'gif';
  acceptsMultiple?: boolean;
  recommended?: boolean;
  localFirst: boolean;
}

export interface MediaSourceFile {
  id: string;
  file: File;
  objectUrl: string;
  kind: MediaInputKind;
  duration?: number;
  width?: number;
  height?: number;
  hasAudio?: boolean;
}

export interface MediaOperationSettings {
  startSeconds?: number;
  endSeconds?: number;
  durationSeconds?: number;
  fps?: number;
  width?: number;
  height?: number;
  quality?: number;
  crf?: number;
  speed?: number;
  volume?: number;
  rotation?: 90 | 180 | 270;
  flip?: 'horizontal' | 'vertical';
  format?: string;
  audioFormat?: string;
  imageFormat?: 'png' | 'jpg' | 'webp';
  frameIntervalSeconds?: number;
  loopCount?: number;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  aspectRatio?: string;
  text?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  opacity?: number;
  subtitleStyle?: 'clean' | 'boxed' | 'cinema';
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
}

export interface MediaJobPlan {
  operation: MediaOperationId;
  inputNames: string[];
  outputName: string;
  outputMimeType: string;
  args: string[];
  notes: string[];
}

export interface MediaResult {
  name: string;
  blob: Blob;
  mimeType: string;
  previewUrl: string;
}
