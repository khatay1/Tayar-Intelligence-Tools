import type { MediaJobPlan, MediaOperationId, MediaOperationSettings, MediaSourceFile } from './types';

function clamp(value: number | undefined, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Number(value)));
}

function safeExt(name: string, fallback: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  return match?.[1] || fallback;
}

function inputName(source: MediaSourceFile, index: number) {
  return `input_${index}.${safeExt(source.file.name, source.kind === 'audio' ? 'mp3' : source.kind === 'image' ? 'png' : 'mp4')}`;
}

function videoOutput(format = 'mp4') {
  const normalized = ['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(format) ? format : 'mp4';
  return { name: `tayar-media.${normalized}`, mime: normalized === 'webm' ? 'video/webm' : normalized === 'mov' ? 'video/quicktime' : 'video/mp4' };
}

function audioOutput(format = 'mp3') {
  const normalized = ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac'].includes(format) ? format : 'mp3';
  const mime = normalized === 'wav' ? 'audio/wav' : normalized === 'ogg' ? 'audio/ogg' : normalized === 'flac' ? 'audio/flac' : normalized === 'aac' ? 'audio/aac' : normalized === 'm4a' ? 'audio/mp4' : 'audio/mpeg';
  return { name: `tayar-audio.${normalized}`, mime };
}

function videoCodec(format = 'mp4') {
  if (format === 'webm') return ['-c:v', 'libvpx-vp9', '-c:a', 'libopus'];
  if (format === 'avi') return ['-c:v', 'mpeg4', '-c:a', 'aac'];
  return ['-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', '-movflags', '+faststart'];
}

function escapeFilterText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/%/g, '\\%');
}

function positionExpression(position: MediaOperationSettings['position']) {
  switch (position) {
    case 'top-left': return 'x=20:y=20';
    case 'top-right': return 'x=w-tw-20:y=20';
    case 'bottom-left': return 'x=20:y=h-th-20';
    case 'center': return 'x=(w-tw)/2:y=(h-th)/2';
    default: return 'x=w-tw-20:y=h-th-20';
  }
}

function overlayExpression(position: MediaOperationSettings['position']) {
  switch (position) {
    case 'top-left': return '20:20';
    case 'top-right': return 'main_w-overlay_w-20:20';
    case 'bottom-left': return '20:main_h-overlay_h-20';
    case 'center': return '(main_w-overlay_w)/2:(main_h-overlay_h)/2';
    default: return 'main_w-overlay_w-20:main_h-overlay_h-20';
  }
}

export function createMediaJobPlan(operation: MediaOperationId, sources: MediaSourceFile[], settings: MediaOperationSettings = {}): MediaJobPlan {
  const inputs = sources.map(inputName);
  const format = settings.format || 'mp4';
  const video = videoOutput(format);
  const audio = audioOutput(settings.audioFormat || settings.format || 'mp3');
  const start = clamp(settings.startSeconds, 0, 86400, 0);
  const end = clamp(settings.endSeconds, 0, 86400, 0);
  const duration = clamp(settings.durationSeconds, 0.1, 86400, 3);
  const fps = clamp(settings.fps, 1, 120, 24);
  const width = Math.round(clamp(settings.width, 64, 7680, 1280) / 2) * 2;
  const height = Math.round(clamp(settings.height, 64, 4320, 720) / 2) * 2;
  const speed = clamp(settings.speed, 0.25, 4, 1);
  const volume = clamp(settings.volume, 0, 4, 1);
  const crf = Math.round(clamp(settings.crf ?? (settings.quality == null ? undefined : 35 - settings.quality * 0.18), 18, 40, 25));
  const notes: string[] = ['local-first', 'ffmpeg-wasm'];

  const oneVideo = ['-i', inputs[0]];
  const encodedVideo = [...videoCodec(format), ...(format === 'mp4' || format === 'mov' || format === 'mkv' ? ['-crf', String(crf)] : [])];

  switch (operation) {
    case 'video-to-images': {
      const ext = settings.imageFormat || 'png';
      const interval = clamp(settings.frameIntervalSeconds, 0.05, 3600, 1);
      const mime = ext === 'jpg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
      return { operation, inputNames: inputs, outputName: `frame_%05d.${ext}`, outputMimeType: mime, args: [...oneVideo, '-vf', `fps=1/${interval}`, `frame_%05d.${ext}`], notes };
    }
    case 'create-thumbnail': {
      const ext = settings.imageFormat || 'png';
      const mime = ext === 'jpg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
      return { operation, inputNames: inputs, outputName: `tayar-thumbnail.${ext}`, outputMimeType: mime, args: ['-ss', String(start), ...oneVideo, '-frames:v', '1', `tayar-thumbnail.${ext}`], notes };
    }
    case 'video-to-gif': {
      const gifFps = clamp(settings.fps, 4, 30, 12);
      const gifWidth = Math.round(clamp(settings.width, 160, 1920, 720));
      const trim = end > start ? `trim=start=${start}:end=${end},setpts=PTS-STARTPTS,` : start > 0 ? `trim=start=${start},setpts=PTS-STARTPTS,` : '';
      const filter = `${trim}fps=${gifFps},scale=${gifWidth}:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=sierra2_4a`;
      return { operation, inputNames: inputs, outputName: 'tayar-media.gif', outputMimeType: 'image/gif', args: [...oneVideo, '-filter_complex', filter, '-loop', '0', 'tayar-media.gif'], notes };
    }
    case 'gif-to-video':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-vf', `fps=${fps},scale=trunc(iw/2)*2:trunc(ih/2)*2`, ...encodedVideo, '-pix_fmt', 'yuv420p', video.name], notes };
    case 'images-to-video': {
      const secondsPerImage = clamp(settings.durationSeconds, 0.1, 30, 2);
      const concat = sources.flatMap((_, index) => ['-loop', '1', '-t', String(secondsPerImage), '-i', inputs[index]]);
      const streams = sources.map((_, index) => `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${index}]`).join(';');
      const labels = sources.map((_, index) => `[v${index}]`).join('');
      const filter = `${streams};${labels}concat=n=${sources.length}:v=1:a=0[outv]`;
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...concat, '-filter_complex', filter, '-map', '[outv]', '-r', String(fps), ...encodedVideo.filter((_, i) => !['-c:a', 'aac', 'libopus'].includes(encodedVideo[i - 1] || '')), '-pix_fmt', 'yuv420p', video.name], notes };
    }
    case 'audio-image-to-video':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: ['-loop', '1', '-i', inputs[0], '-i', inputs[1], '-shortest', '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`, ...encodedVideo, '-pix_fmt', 'yuv420p', video.name], notes };
    case 'trim-video': {
      const timeArgs = ['-ss', String(start), ...oneVideo];
      if (end > start) timeArgs.push('-t', String(end - start));
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...timeArgs, ...encodedVideo, video.name], notes };
    }
    case 'split-video':
      return { operation, inputNames: inputs, outputName: 'tayar-part-%03d.mp4', outputMimeType: 'video/mp4', args: [...oneVideo, '-map', '0', '-c', 'copy', '-f', 'segment', '-segment_time', String(duration), '-reset_timestamps', '1', 'tayar-part-%03d.mp4'], notes };
    case 'merge-videos': {
      const inputArgs = inputs.flatMap(name => ['-i', name]);
      const normalize = sources.map((_, index) => `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${index}];[${index}:a]aresample=async=1[a${index}]`).join(';');
      const chain = sources.map((_, index) => `[v${index}][a${index}]`).join('');
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...inputArgs, '-filter_complex', `${normalize};${chain}concat=n=${sources.length}:v=1:a=1[outv][outa]`, '-map', '[outv]', '-map', '[outa]', ...encodedVideo, video.name], notes };
    }
    case 'compress-video':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-vf', `scale='min(${width},iw)':-2`, ...encodedVideo, video.name], notes };
    case 'convert-video':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, ...encodedVideo, video.name], notes };
    case 'remove-audio':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-an', '-c:v', 'copy', video.name], notes };
    case 'extract-audio': {
      const codec = audio.name.endsWith('.wav') ? ['-c:a', 'pcm_s16le'] : audio.name.endsWith('.aac') ? ['-c:a', 'aac'] : audio.name.endsWith('.m4a') ? ['-c:a', 'aac'] : audio.name.endsWith('.ogg') ? ['-c:a', 'libopus'] : audio.name.endsWith('.flac') ? ['-c:a', 'flac'] : ['-c:a', 'libmp3lame'];
      return { operation, inputNames: inputs, outputName: audio.name, outputMimeType: audio.mime, args: [...oneVideo, '-vn', ...codec, '-b:a', '192k', audio.name], notes };
    }
    case 'add-audio':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: ['-i', inputs[0], '-i', inputs[1], '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2[a]', '-map', '0:v', '-map', '[a]', ...encodedVideo, '-shortest', video.name], notes };
    case 'replace-audio':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: ['-i', inputs[0], '-i', inputs[1], '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-shortest', video.name], notes };
    case 'change-volume':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-filter:a', `volume=${volume}`, ...encodedVideo, video.name], notes };
    case 'fade-audio': {
      const fadeIn = clamp(settings.fadeInSeconds, 0, 60, 1);
      const fadeOut = clamp(settings.fadeOutSeconds, 0, 60, 1);
      const knownDuration = Math.max(0, (sources[0]?.duration || 0) - fadeOut);
      const filter = `afade=t=in:st=0:d=${fadeIn}${fadeOut > 0 && knownDuration > 0 ? `,afade=t=out:st=${knownDuration}:d=${fadeOut}` : ''}`;
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-af', filter, ...encodedVideo, video.name], notes };
    }
    case 'change-speed': {
      const atempo: string[] = [];
      let remaining = speed;
      while (remaining > 2) { atempo.push('atempo=2'); remaining /= 2; }
      while (remaining < 0.5) { atempo.push('atempo=0.5'); remaining /= 0.5; }
      atempo.push(`atempo=${remaining.toFixed(3)}`);
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-filter_complex', `[0:v]setpts=${(1 / speed).toFixed(5)}*PTS[v];[0:a]${atempo.join(',')}[a]`, '-map', '[v]', '-map', '[a]', ...encodedVideo, video.name], notes };
    }
    case 'reverse-video':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-vf', 'reverse', '-af', 'areverse', ...encodedVideo, video.name], notes };
    case 'rotate-video': {
      const rotation = settings.rotation || 90;
      const filter = rotation === 180 ? 'hflip,vflip' : rotation === 270 ? 'transpose=2' : 'transpose=1';
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-vf', filter, ...encodedVideo, video.name], notes };
    }
    case 'flip-video':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-vf', settings.flip === 'vertical' ? 'vflip' : 'hflip', ...encodedVideo, video.name], notes };
    case 'resize-video':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-vf', `scale=${width}:${height}`, ...encodedVideo, video.name], notes };
    case 'crop-video': {
      const cropWidth = Math.round(clamp(settings.cropWidth, 2, 7680, width) / 2) * 2;
      const cropHeight = Math.round(clamp(settings.cropHeight, 2, 4320, height) / 2) * 2;
      const x = Math.max(0, Math.round(settings.cropX || 0));
      const y = Math.max(0, Math.round(settings.cropY || 0));
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-vf', `crop=${cropWidth}:${cropHeight}:${x}:${y}`, ...encodedVideo, video.name], notes };
    }
    case 'change-aspect-ratio': {
      const ratio = settings.aspectRatio || '16:9';
      const [rw, rh] = ratio.split(':').map(Number);
      const targetHeight = Math.round(width * (rh || 9) / (rw || 16) / 2) * 2;
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-vf', `scale=${width}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${width}:${targetHeight}:(ow-iw)/2:(oh-ih)/2`, ...encodedVideo, video.name], notes };
    }
    case 'change-fps':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-vf', `fps=${fps}`, ...encodedVideo, video.name], notes };
    case 'add-subtitles':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: ['-i', inputs[0], '-i', inputs[1], '-map', '0', '-map', '1:0', '-c:v', 'copy', '-c:a', 'copy', '-c:s', 'mov_text', video.name], notes };
    case 'burn-subtitles':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-vf', `subtitles=${inputs[1]}`, ...encodedVideo, video.name], notes };
    case 'add-text-watermark': {
      const text = escapeFilterText(settings.text || 'Tayar');
      const pos = positionExpression(settings.position);
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-vf', `drawtext=text='${text}':${pos}:fontsize=32:fontcolor=white@${clamp(settings.opacity, 0, 1, 0.8)}:box=1:boxcolor=black@0.25:boxborderw=8`, ...encodedVideo, video.name], notes };
    }
    case 'add-image-watermark': {
      const opacity = clamp(settings.opacity, 0.05, 1, 0.8);
      const pos = overlayExpression(settings.position);
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: ['-i', inputs[0], '-i', inputs[1], '-filter_complex', `[1:v]format=rgba,colorchannelmixer=aa=${opacity}[wm];[0:v][wm]overlay=${pos}[v]`, '-map', '[v]', '-map', '0:a?', ...encodedVideo, video.name], notes };
    }
    case 'loop-video': {
      const loops = Math.round(clamp(settings.loopCount, 2, 100, 2));
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: ['-stream_loop', String(loops - 1), ...oneVideo, ...encodedVideo, video.name], notes };
    }
    case 'freeze-frame': {
      const freeze = clamp(settings.durationSeconds, 0.1, 60, 3);
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-vf', `tpad=stop_mode=clone:stop_duration=${freeze}`, '-af', `apad=pad_dur=${freeze}`, ...encodedVideo, video.name], notes };
    }
    case 'remove-metadata':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-map_metadata', '-1', '-c', 'copy', video.name], notes };
    default:
      throw new Error(`Unsupported media operation: ${operation satisfies never}`);
  }
}
