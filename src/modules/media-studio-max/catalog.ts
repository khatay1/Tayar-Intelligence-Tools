import type { MediaOperationDefinition, MediaOperationGroup } from './types';

export const MEDIA_GROUPS: { id: MediaOperationGroup; label: string; description: string }[] = [
  { id: 'convert', label: 'Convert', description: 'Convert video to or from images, GIF and audio.' },
  { id: 'edit', label: 'Edit', description: 'Trim, split, merge, speed up, reverse and reshape video.' },
  { id: 'audio', label: 'Audio', description: 'Remove, extract, add, replace and mix video audio.' },
  { id: 'visual', label: 'Visual', description: 'Resize, crop, rotate, subtitles, watermarks and frame tools.' },
  { id: 'export', label: 'Export', description: 'Compress, change format and prepare final output.' },
];

export const MEDIA_OPERATIONS: MediaOperationDefinition[] = [
  { id: 'video-to-images', name: 'Video to Images', description: 'Extract frames from a video as PNG, JPG or WebP images.', group: 'convert', input: ['video'], output: 'images', recommended: true, localFirst: true },
  { id: 'video-to-gif', name: 'Video to GIF', description: 'Turn any selected video section into an animated GIF.', group: 'convert', input: ['video'], output: 'gif', recommended: true, localFirst: true },
  { id: 'gif-to-video', name: 'GIF to Video', description: 'Convert an animated GIF into a standard video file.', group: 'convert', input: ['gif'], output: 'video', localFirst: true },
  { id: 'images-to-video', name: 'Images to Video', description: 'Create a slideshow or video sequence from multiple images.', group: 'convert', input: ['images'], output: 'video', acceptsMultiple: true, recommended: true, localFirst: true },
  { id: 'audio-image-to-video', name: 'Audio + Image to Video', description: 'Create a video from one image and an audio track.', group: 'convert', input: ['image', 'audio'], output: 'video', localFirst: true },
  { id: 'trim-video', name: 'Trim Video', description: 'Keep only the selected start and end section.', group: 'edit', input: ['video'], output: 'video', recommended: true, localFirst: true },
  { id: 'split-video', name: 'Split Video', description: 'Split one video into multiple clips by duration.', group: 'edit', input: ['video'], output: 'video', localFirst: true },
  { id: 'merge-videos', name: 'Merge Videos', description: 'Join multiple videos into one ordered video.', group: 'edit', input: ['videos'], output: 'video', acceptsMultiple: true, recommended: true, localFirst: true },
  { id: 'change-speed', name: 'Change Speed', description: 'Create slow-motion or fast-motion video.', group: 'edit', input: ['video'], output: 'video', localFirst: true },
  { id: 'reverse-video', name: 'Reverse Video', description: 'Reverse both video and audio playback.', group: 'edit', input: ['video'], output: 'video', localFirst: true },
  { id: 'loop-video', name: 'Loop Video', description: 'Repeat a video a selected number of times.', group: 'edit', input: ['video'], output: 'video', localFirst: true },
  { id: 'freeze-frame', name: 'Freeze Frame', description: 'Hold a selected frame for a chosen duration.', group: 'edit', input: ['video'], output: 'video', localFirst: true },
  { id: 'remove-audio', name: 'Remove Audio', description: 'Create a silent copy of the selected video.', group: 'audio', input: ['video'], output: 'video', recommended: true, localFirst: true },
  { id: 'extract-audio', name: 'Extract Audio', description: 'Save the audio track from a video as MP3, WAV, AAC or M4A.', group: 'audio', input: ['video'], output: 'audio', recommended: true, localFirst: true },
  { id: 'add-audio', name: 'Add Audio', description: 'Mix an additional audio track with the original video sound.', group: 'audio', input: ['video', 'audio'], output: 'video', localFirst: true },
  { id: 'replace-audio', name: 'Replace Audio', description: 'Replace the original video sound with a new audio track.', group: 'audio', input: ['video', 'audio'], output: 'video', localFirst: true },
  { id: 'change-volume', name: 'Change Volume', description: 'Raise, lower or mute the audio volume.', group: 'audio', input: ['video'], output: 'video', localFirst: true },
  { id: 'fade-audio', name: 'Audio Fade', description: 'Add audio fade-in and fade-out effects.', group: 'audio', input: ['video'], output: 'video', localFirst: true },
  { id: 'rotate-video', name: 'Rotate Video', description: 'Rotate video 90, 180 or 270 degrees.', group: 'visual', input: ['video'], output: 'video', localFirst: true },
  { id: 'flip-video', name: 'Flip Video', description: 'Flip video horizontally or vertically.', group: 'visual', input: ['video'], output: 'video', localFirst: true },
  { id: 'resize-video', name: 'Resize Video', description: 'Change resolution while preserving quality.', group: 'visual', input: ['video'], output: 'video', localFirst: true },
  { id: 'crop-video', name: 'Crop Video', description: 'Crop a specific region from the video.', group: 'visual', input: ['video'], output: 'video', localFirst: true },
  { id: 'change-aspect-ratio', name: 'Change Aspect Ratio', description: 'Prepare 16:9, 9:16, 1:1, 4:5 and custom layouts.', group: 'visual', input: ['video'], output: 'video', localFirst: true },
  { id: 'change-fps', name: 'Change FPS', description: 'Change the output frame rate.', group: 'visual', input: ['video'], output: 'video', localFirst: true },
  { id: 'add-subtitles', name: 'Add Subtitle Track', description: 'Attach subtitle files without burning them into the image.', group: 'visual', input: ['video', 'subtitle'], output: 'video', localFirst: true },
  { id: 'burn-subtitles', name: 'Burn Subtitles', description: 'Render subtitle text permanently into the video.', group: 'visual', input: ['video', 'subtitle'], output: 'video', localFirst: true },
  { id: 'add-text-watermark', name: 'Text Watermark', description: 'Place custom text over the video.', group: 'visual', input: ['video'], output: 'video', localFirst: true },
  { id: 'add-image-watermark', name: 'Image Watermark', description: 'Overlay a logo or image with adjustable position and opacity.', group: 'visual', input: ['video', 'image'], output: 'video', localFirst: true },
  { id: 'create-thumbnail', name: 'Create Thumbnail', description: 'Capture a high-quality still image from a chosen timestamp.', group: 'visual', input: ['video'], output: 'image', localFirst: true },
  { id: 'compress-video', name: 'Compress Video', description: 'Reduce file size with adjustable quality and resolution.', group: 'export', input: ['video'], output: 'video', recommended: true, localFirst: true },
  { id: 'convert-video', name: 'Convert Video Format', description: 'Convert between common video containers and codecs.', group: 'export', input: ['video'], output: 'video', recommended: true, localFirst: true },
  { id: 'remove-metadata', name: 'Remove Metadata', description: 'Strip metadata before exporting the final file.', group: 'export', input: ['video'], output: 'video', localFirst: true },
];

export function getMediaOperation(id: string) {
  return MEDIA_OPERATIONS.find((operation) => operation.id === id);
}
