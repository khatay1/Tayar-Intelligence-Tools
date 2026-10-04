import type { MediaInputKind, MediaSourceFile } from './types';

export function detectMediaKind(file: File): MediaInputKind {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type === 'image/gif' || name.endsWith('.gif')) return 'gif';
  if (type.startsWith('image/')) return 'image';
  if (/\.(srt|vtt|ass|ssa)$/i.test(name)) return 'subtitle';
  return 'video';
}

function readVideoMetadata(url: string) {
  return new Promise<Pick<MediaSourceFile, 'duration' | 'width' | 'height'>>((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };
    video.onloadedmetadata = () => {
      resolve({
        duration: Number.isFinite(video.duration) ? video.duration : undefined,
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
      });
      cleanup();
    };
    video.onerror = () => {
      resolve({});
      cleanup();
    };
    video.src = url;
  });
}

function readImageMetadata(url: string) {
  return new Promise<Pick<MediaSourceFile, 'width' | 'height'>>((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({});
    image.src = url;
  });
}

export async function createMediaSource(file: File, index: number): Promise<MediaSourceFile> {
  const objectUrl = URL.createObjectURL(file);
  const kind = detectMediaKind(file);
  let metadata: Pick<MediaSourceFile, 'duration' | 'width' | 'height'> = {};
  if (kind === 'video') metadata = await readVideoMetadata(objectUrl);
  else if (kind === 'image' || kind === 'gif') metadata = await readImageMetadata(objectUrl);
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    file,
    objectUrl,
    kind,
    ...metadata,
  };
}

export function disposeSources(sources: MediaSourceFile[]) {
  sources.forEach((source) => URL.revokeObjectURL(source.objectUrl));
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function acceptForKinds(kinds: MediaInputKind[]) {
  const accepts = new Set<string>();
  if (kinds.some((kind) => kind === 'video' || kind === 'videos')) accepts.add('video/*');
  if (kinds.includes('audio')) accepts.add('audio/*');
  if (kinds.some((kind) => kind === 'image' || kind === 'images')) accepts.add('image/*');
  if (kinds.includes('gif')) accepts.add('image/gif');
  if (kinds.includes('subtitle')) {
    accepts.add('.srt'); accepts.add('.vtt'); accepts.add('.ass'); accepts.add('.ssa');
  }
  return Array.from(accepts).join(',');
}
