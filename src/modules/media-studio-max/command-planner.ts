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
  const fallback = source.kind === 'audio' ? 'mp3' : source.kind === 'image' || source.kind === 'gif' ? 'png' : source.kind === 'subtitle' ? 'srt' : 'mp4';
  return `input_${index}.${safeExt(source.file.name, fallback)}`;
}

export function createMediaInputNames(sources: MediaSourceFile[]) {
  return sources.map(inputName);
}

function videoOutput(format = 'mp4') {
  const normalized = ['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(format) ? format : 'mp4';
  const mime = normalized === 'webm'
    ? 'video/webm'
    : normalized === 'mov'
      ? 'video/quicktime'
      : normalized === 'mkv'
        ? 'video/x-matroska'
        : normalized === 'avi'
          ? 'video/x-msvideo'
          : 'video/mp4';
  return { name: `tayar-media.${normalized}`, mime, format: normalized };
}

function audioOutput(format = 'mp3') {
  const normalized = ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac'].includes(format) ? format : 'mp3';
  const mime = normalized === 'wav'
    ? 'audio/wav'
    : normalized === 'ogg'
      ? 'audio/ogg'
      : normalized === 'flac'
        ? 'audio/flac'
        : normalized === 'aac'
          ? 'audio/aac'
          : normalized === 'm4a'
            ? 'audio/mp4'
            : 'audio/mpeg';
  return { name: `tayar-audio.${normalized}`, mime };
}

function videoCodec(format: string) {
  if (format === 'webm') return ['-c:v', 'libvpx-vp9'];
  if (format === 'avi') return ['-c:v', 'mpeg4'];
  return ['-c:v', 'libx264', '-preset', 'veryfast'];
}

function audioCodec(format: string) {
  if (format === 'webm') return ['-c:a', 'libopus'];
  if (format === 'avi') return ['-c:a', 'libmp3lame'];
  return ['-c:a', 'aac'];
}

function encodeVideoArgs(format: string, crf: number, withAudio: boolean) {
  const args = [...videoCodec(format)];
  if (format !== 'avi') args.push('-crf', String(crf));
  if (withAudio) args.push(...audioCodec(format));
  if (format === 'mp4' || format === 'mov') args.push('-movflags', '+faststart');
  return args;
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

function sourceHasAudio(source: MediaSourceFile | undefined) {
  return source?.hasAudio !== false;
}

export function createMediaJobPlan(operation: MediaOperationId, sources: MediaSourceFile[], settings: MediaOperationSettings = {}): MediaJobPlan {
  const inputs = createMediaInputNames(sources);
  const format = settings.format || 'mp4';
  const video = videoOutput(format);
  const audio = audioOutput(settings.audioFormat || 'mp3');
  const start = clamp(settings.startSeconds, 0, 86400, 0);
  const end = clamp(settings.endSeconds, 0, 86400, 0);
  const duration = clamp(settings.durationSeconds, 0.1, 86400, 3);
  const fps = clamp(settings.fps, 1, 120, 24);
  const width = Math.round(clamp(settings.width, 64, 7680, 1280) / 2) * 2;
  const height = Math.round(clamp(settings.height, 64, 4320, 720) / 2) * 2;
  const speed = clamp(settings.speed, 0.25, 4, 1);
  const volume = clamp(settings.volume, 0, 4, 1);
  const crf = Math.round(clamp(settings.crf ?? (settings.quality == null ? undefined : 35 - settings.quality * 0.18), 18, 40, 25));
  const hasAudio = sourceHasAudio(sources[0]);
  const notes: string[] = ['local-first', 'ffmpeg-wasm'];
  const oneVideo = ['-i', inputs[0]];
  const encodedVideo = encodeVideoArgs(video.format, crf, hasAudio);
  const encodedVideoOnly = encodeVideoArgs(video.format, crf, false);

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
      const trim = end > start
        ? `trim=start=${start}:end=${end},setpts=PTS-STARTPTS,`
        : start > 0
          ? `trim=start=${start},setpts=PTS-STARTPTS,`
          : '';
      const filter = `${trim}fps=${gifFps},scale=${gifWidth}:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=sierra2_4a`;
      return { operation, inputNames: inputs, outputName: 'tayar-media.gif', outputMimeType: 'image/gif', args: [...oneVideo, '-filter_complex', filter, '-loop', '0', 'tayar-media.gif'], notes };
    }

    case 'gif-to-video':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-vf', `fps=${fps},scale=trunc(iw/2)*2:trunc(ih/2)*2`, ...encodedVideoOnly, '-pix_fmt', 'yuv420p', video.name], notes };

    case 'images-to-video': {
      const secondsPerImage = clamp(settings.durationSeconds, 0.1, 30, 2);
      const inputArgs = sources.flatMap((_, index) => ['-loop', '1', '-t', String(secondsPerImage), '-i', inputs[index]]);
      const streams = sources.map((_, index) => `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}[v${index}]`).join(';');
      const labels = sources.map((_, index) => `[v${index}]`).join('');
      const filter = `${streams};${labels}concat=n=${sources.length}:v=1:a=0[outv]`;
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...inputArgs, '-filter_complex', filter, '-map', '[outv]', ...encodedVideoOnly, '-pix_fmt', 'yuv420p', video.name], notes };
    }

    case 'audio-image-to-video':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: ['-loop', '1', '-i', inputs[0], '-i', inputs[1], '-shortest', '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`, ...encodeVideoArgs(video.format, crf, true), video.name], notes };

    case 'trim-video': {
      const timeArgs = ['-ss', String(start), ...oneVideo];
      if (end > start) timeArgs.push('-t', String(end - start));
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...timeArgs, ...encodedVideo, video.name], notes };
    }

    case 'split-video': {
      const ext = safeExt(sources[0]?.file.name || '', 'mp4');
      const mime = sources[0]?.file.type || (ext === 'webm' ? 'video/webm' : 'video/mp4');
      const outputName = `tayar-part-%03d.${ext}`;
      return { operation, inputNames: inputs, outputName, outputMimeType: mime, args: [...oneVideo, '-map', '0', '-c', 'copy', '-f', 'segment', '-segment_time', String(duration), '-reset_timestamps', '1', outputName], notes };
    }

    case 'merge-videos': {
      const inputArgs = inputs.flatMap(name => ['-i', name]);
      const filters: string[] = [];
      const chain: string[] = [];
      sources.forEach((source, index) => {
        filters.push(`[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},setpts=PTS-STARTPTS[v${index}]`);
        if (source.hasAudio !== true) {
          const clipDuration = clamp(source.duration, 0.1, 86400, 1);
          filters.push(`anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=${clipDuration},asetpts=PTS-STARTPTS[a${index}]`);
        } else {
          filters.push(`[${index}:a]aresample=48000:async=1,aformat=sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS[a${index}]`);
        }
        chain.push(`[v${index}][a${index}]`);
      });
      filters.push(`${chain.join('')}concat=n=${sources.length}:v=1:a=1[outv][outa]`);
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...inputArgs, '-filter_complex', filters.join(';'), '-map', '[outv]', '-map', '[outa]', ...encodeVideoArgs(video.format, crf, true), video.name], notes };
    }

    case 'compress-video':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-vf', `scale='min(${width},iw)':-2`, ...encodedVideo, video.name], notes };

    case 'convert-video':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, ...encodedVideo, video.name], notes };

    case 'remove-audio':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-an', ...encodedVideoOnly, video.name], notes };

    case 'extract-audio': {
      if (sources[0]?.hasAudio === false) throw new Error('Selected video has no audio track.');
      const codec = audio.name.endsWith('.wav')
        ? ['-c:a', 'pcm_s16le']
        : audio.name.endsWith('.aac') || audio.name.endsWith('.m4a')
          ? ['-c:a', 'aac']
          : audio.name.endsWith('.ogg')
            ? ['-c:a', 'libopus']
            : audio.name.endsWith('.flac')
              ? ['-c:a', 'flac']
              : ['-c:a', 'libmp3lame'];
      return { operation, inputNames: inputs, outputName: audio.name, outputMimeType: audio.mime, args: [...oneVideo, '-vn', ...codec, '-b:a', '192k', audio.name], notes };
    }

    case 'add-audio': {
      if (sources[0]?.hasAudio !== true) {
        return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: ['-i', inputs[0], '-i', inputs[1], '-map', '0:v:0', '-map', '1:a:0', ...encodeVideoArgs(video.format, crf, true), '-shortest', video.name], notes: [...notes, 'input-audio-unconfirmed-use-new-track'] };
      }
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: ['-i', inputs[0], '-i', inputs[1], '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2[a]', '-map', '0:v:0', '-map', '[a]', ...encodeVideoArgs(video.format, crf, true), '-shortest', video.name], notes };
    }

    case 'replace-audio':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: ['-i', inputs[0], '-i', inputs[1], '-map', '0:v:0', '-map', '1:a:0', ...encodeVideoArgs(video.format, crf, true), '-shortest', video.name], notes };

    case 'change-volume':
      return sources[0]?.hasAudio !== true
        ? { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-an', ...encodedVideoOnly, video.name], notes: [...notes, 'input-audio-unconfirmed'] }
        : { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-filter:a', `volume=${volume}`, ...encodedVideo, video.name], notes };

    case 'fade-audio': {
      if (sources[0]?.hasAudio !== true) {
        return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-an', ...encodedVideoOnly, video.name], notes: [...notes, 'input-audio-unconfirmed'] };
      }
      const fadeIn = clamp(settings.fadeInSeconds, 0, 60, 1);
      const fadeOut = clamp(settings.fadeOutSeconds, 0, 60, 1);
      const knownDuration = Math.max(0, (sources[0]?.duration || 0) - fadeOut);
      const filter = `afade=t=in:st=0:d=${fadeIn}${fadeOut > 0 && knownDuration > 0 ? `,afade=t=out:st=${knownDuration}:d=${fadeOut}` : ''}`;
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-af', filter, ...encodedVideo, video.name], notes };
    }

    case 'change-speed': {
      const videoFilter = `setpts=${(1 / speed).toFixed(5)}*PTS`;
      if (sources[0]?.hasAudio !== true) {
        return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-vf', videoFilter, '-an', ...encodedVideoOnly, video.name], notes: [...notes, 'input-audio-unconfirmed'] };
      }
      const atempo: string[] = [];
      let remaining = speed;
      while (remaining > 2) { atempo.push('atempo=2'); remaining /= 2; }
      while (remaining < 0.5) { atempo.push('atempo=0.5'); remaining /= 0.5; }
      atempo.push(`atempo=${remaining.toFixed(3)}`);
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-filter_complex', `[0:v]${videoFilter}[v];[0:a]${atempo.join(',')}[a]`, '-map', '[v]', '-map', '[a]', ...encodeVideoArgs(video.format, crf, true), video.name], notes };
    }

    case 'reverse-video':
      return sources[0]?.hasAudio !== true
        ? { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-vf', 'reverse', '-an', ...encodedVideoOnly, video.name], notes: [...notes, 'input-audio-unconfirmed'] }
        : { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-vf', 'reverse', '-af', 'areverse', ...encodedVideo, video.name], notes };

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

    case 'add-subtitles': {
      const subtitleOutput = videoOutput('mp4');
      const maps = ['-map', '0:v:0', '-map', '0:a?', '-map', '1:0'];
      const encode = [...videoCodec('mp4'), '-crf', String(crf), ...(hasAudio ? audioCodec('mp4') : []), '-c:s', 'mov_text', '-movflags', '+faststart'];
      return { operation, inputNames: inputs, outputName: subtitleOutput.name, outputMimeType: subtitleOutput.mime, args: ['-i', inputs[0], '-i', inputs[1], ...maps, ...encode, subtitleOutput.name], notes };
    }

    case 'burn-subtitles':
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: [...oneVideo, '-vf', `subtitles=${inputs[1]}`, ...encodedVideo, video.name], notes };

    case 'add-text-watermark':
    case 'add-image-watermark': {
      const opacity = clamp(settings.opacity, 0.05, 1, 0.8);
      const pos = overlayExpression(settings.position);
      const filter = `[1:v]format=rgba,colorchannelmixer=aa=${opacity}[wm];[0:v][wm]overlay=${pos}[v]`;
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: ['-i', inputs[0], '-i', inputs[1], '-filter_complex', filter, '-map', '[v]', '-map', '0:a?', ...encodedVideo, video.name], notes };
    }

    case 'loop-video': {
      const loops = Math.round(clamp(settings.loopCount, 2, 100, 2));
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args: ['-stream_loop', String(loops - 1), ...oneVideo, ...encodedVideo, video.name], notes };
    }

    case 'freeze-frame': {
      const freeze = clamp(settings.durationSeconds, 0.1, 60, 3);
      const args = [...oneVideo, '-vf', `tpad=stop_mode=clone:stop_duration=${freeze}`];
      const confirmedAudio = sources[0]?.hasAudio === true;
      if (confirmedAudio) args.push('-af', `apad=pad_dur=${freeze}`);
      else args.push('-an');
      args.push(...(confirmedAudio ? encodedVideo : encodedVideoOnly), video.name);
      return { operation, inputNames: inputs, outputName: video.name, outputMimeType: video.mime, args, notes };
    }

    case 'remove-metadata': {
      const ext = safeExt(sources[0]?.file.name || '', 'mp4');
      const outputName = `tayar-clean.${ext}`;
      const mime = sources[0]?.file.type || (ext === 'webm' ? 'video/webm' : 'video/mp4');
      return { operation, inputNames: inputs, outputName, outputMimeType: mime, args: [...oneVideo, '-map', '0', '-map_metadata', '-1', '-c', 'copy', outputName], notes };
    }

    default:
      throw new Error(`Unsupported media operation: ${operation satisfies never}`);
  }
}
