import { completeMeteredLocalAction } from '@/lib/tool-usage';
import {
  BACKGROUND_ALLOWED_TYPES,
  BackgroundRemovalResult,
  MAX_BACKGROUND_IMAGE_BYTES,
} from './background-remover-types';

const ORT_VERSION = '1.22.0';
const ORT_SCRIPT_URL = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort.min.js`;
const ORT_WASM_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const U2NETP_MODEL_URL = 'https://cdn.jsdelivr.net/gh/NovareOrbis/nova-ai-models@v3/u2netp.onnx';
const INPUT_SIZE = 320;
const MODEL_MEAN = [0.485, 0.456, 0.406] as const;
const MODEL_STD = [0.229, 0.224, 0.225] as const;

type OrtTensorResult = {
  data: Float32Array | number[];
  dims: readonly number[];
};

type OrtSession = {
  inputNames: string[];
  outputNames: string[];
  run: (feeds: Record<string, unknown>) => Promise<Record<string, OrtTensorResult>>;
};

type OrtApi = {
  env: {
    wasm: {
      wasmPaths: string;
      numThreads: number;
    };
  };
  Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => unknown;
  InferenceSession: {
    create: (
      modelUrl: string,
      options?: { executionProviders?: string[]; graphOptimizationLevel?: string },
    ) => Promise<OrtSession>;
  };
};

type LocalRemoval = {
  blob: Blob;
  width: number;
  height: number;
};

let ortPromise: Promise<OrtApi> | null = null;
let sessionPromise: Promise<OrtSession> | null = null;

function globalOrt(): OrtApi | undefined {
  return (window as typeof window & { ort?: OrtApi }).ort;
}

function loadOrt(): Promise<OrtApi> {
  const loaded = globalOrt();
  if (loaded) return Promise.resolve(loaded);
  if (ortPromise) return ortPromise;

  ortPromise = new Promise<OrtApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = ORT_SCRIPT_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.tayarOrt = ORT_VERSION;
    script.onload = () => {
      const ort = globalOrt();
      if (!ort) {
        ortPromise = null;
        reject(new Error('Local AI runtime loaded without initializing.'));
        return;
      }
      ort.env.wasm.wasmPaths = ORT_WASM_BASE;
      ort.env.wasm.numThreads = 1;
      resolve(ort);
    };
    script.onerror = () => {
      ortPromise = null;
      reject(new Error('Could not download the local AI runtime. Check your connection and try again.'));
    };
    document.head.appendChild(script);
  });

  return ortPromise;
}

async function getLocalSession(): Promise<{ ort: OrtApi; session: OrtSession }> {
  const ort = await loadOrt();
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(U2NETP_MODEL_URL, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    }).catch((error) => {
      sessionPromise = null;
      throw error;
    });
  }

  try {
    return { ort, session: await sessionPromise };
  } catch {
    throw new Error('Could not download or initialize the local background-removal model.');
  }
}

function canvas2d(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Your browser could not initialize image processing.');
  return context;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not create the transparent PNG result.'));
    }, 'image/png');
  });
}

function preprocess(imageData: ImageData): Float32Array {
  const pixels = imageData.data;
  const plane = INPUT_SIZE * INPUT_SIZE;
  const tensor = new Float32Array(plane * 3);

  for (let pixelIndex = 0; pixelIndex < plane; pixelIndex += 1) {
    const source = pixelIndex * 4;
    tensor[pixelIndex] = (pixels[source] / 255 - MODEL_MEAN[0]) / MODEL_STD[0];
    tensor[plane + pixelIndex] = (pixels[source + 1] / 255 - MODEL_MEAN[1]) / MODEL_STD[1];
    tensor[plane * 2 + pixelIndex] = (pixels[source + 2] / 255 - MODEL_MEAN[2]) / MODEL_STD[2];
  }

  return tensor;
}

function normalizeMask(raw: Float32Array | number[]): Float32Array {
  const values = raw instanceof Float32Array ? raw : Float32Array.from(raw);
  const expected = INPUT_SIZE * INPUT_SIZE;
  if (values.length < expected) throw new Error('Local AI model returned an invalid mask.');

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < expected; index += 1) {
    const value = values[index];
    if (value < min) min = value;
    if (value > max) max = value;
  }

  const range = max - min;
  if (!Number.isFinite(range) || range <= 1e-6) {
    throw new Error('No clear foreground subject was detected in this image.');
  }

  const normalized = new Float32Array(expected);
  for (let index = 0; index < expected; index += 1) {
    normalized[index] = Math.max(0, Math.min(1, (values[index] - min) / range));
  }
  return normalized;
}

function maskCanvas(mask: Float32Array): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const context = canvas2d(canvas);
  const image = context.createImageData(INPUT_SIZE, INPUT_SIZE);

  for (let index = 0; index < mask.length; index += 1) {
    const alpha = Math.round(mask[index] * 255);
    const target = index * 4;
    image.data[target] = 255;
    image.data[target + 1] = 255;
    image.data[target + 2] = 255;
    image.data[target + 3] = alpha;
  }

  context.putImageData(image, 0, 0);
  return canvas;
}

function foregroundBounds(mask: Float32Array) {
  const threshold = 0.04;
  let minX = INPUT_SIZE;
  let minY = INPUT_SIZE;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < INPUT_SIZE; y += 1) {
    for (let x = 0; x < INPUT_SIZE; x += 1) {
      if (mask[y * INPUT_SIZE + x] <= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  return maxX >= minX && maxY >= minY ? { minX, minY, maxX, maxY } : null;
}

async function runLocalBackgroundRemoval(file: File, cropToSubject: boolean): Promise<LocalRemoval> {
  const bitmap = await createImageBitmap(file);
  try {
    const inferenceCanvas = document.createElement('canvas');
    inferenceCanvas.width = INPUT_SIZE;
    inferenceCanvas.height = INPUT_SIZE;
    const inferenceContext = canvas2d(inferenceCanvas);
    inferenceContext.drawImage(bitmap, 0, 0, INPUT_SIZE, INPUT_SIZE);
    const input = preprocess(inferenceContext.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE));

    const { ort, session } = await getLocalSession();
    const tensor = new ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    const outputs = await session.run({ [session.inputNames[0]]: tensor });
    const output = outputs[session.outputNames[0]];
    if (!output?.data) throw new Error('Local AI model returned no mask.');

    const mask = normalizeMask(output.data);
    const alphaCanvas = maskCanvas(mask);

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = bitmap.width;
    outputCanvas.height = bitmap.height;
    const outputContext = canvas2d(outputCanvas);
    outputContext.drawImage(bitmap, 0, 0);
    outputContext.globalCompositeOperation = 'destination-in';
    outputContext.imageSmoothingEnabled = true;
    outputContext.drawImage(alphaCanvas, 0, 0, bitmap.width, bitmap.height);
    outputContext.globalCompositeOperation = 'source-over';

    let finalCanvas = outputCanvas;
    if (cropToSubject) {
      const bounds = foregroundBounds(mask);
      if (bounds) {
        const subjectWidth = bounds.maxX - bounds.minX + 1;
        const subjectHeight = bounds.maxY - bounds.minY + 1;
        const padX = Math.max(2, Math.round(subjectWidth * 0.03));
        const padY = Math.max(2, Math.round(subjectHeight * 0.03));
        const scaleX = bitmap.width / INPUT_SIZE;
        const scaleY = bitmap.height / INPUT_SIZE;
        const sx = Math.max(0, Math.floor((bounds.minX - padX) * scaleX));
        const sy = Math.max(0, Math.floor((bounds.minY - padY) * scaleY));
        const ex = Math.min(bitmap.width, Math.ceil((bounds.maxX + 1 + padX) * scaleX));
        const ey = Math.min(bitmap.height, Math.ceil((bounds.maxY + 1 + padY) * scaleY));
        const width = Math.max(1, ex - sx);
        const height = Math.max(1, ey - sy);

        const cropped = document.createElement('canvas');
        cropped.width = width;
        cropped.height = height;
        canvas2d(cropped).drawImage(outputCanvas, sx, sy, width, height, 0, 0, width, height);
        finalCanvas = cropped;
      }
    }

    const blob = await canvasToBlob(finalCanvas);
    return { blob, width: finalCanvas.width, height: finalCanvas.height };
  } finally {
    bitmap.close();
  }
}

export function validateBackgroundFile(file: File) {
  if (!BACKGROUND_ALLOWED_TYPES.has(file.type)) {
    throw new Error('Use a JPEG, PNG or WebP image.');
  }
  if (file.size <= 0 || file.size > MAX_BACKGROUND_IMAGE_BYTES) {
    const maxMb = Math.round(MAX_BACKGROUND_IMAGE_BYTES / 1024 / 1024);
    throw new Error(`Image must be larger than 0 bytes and no more than ${maxMb} MB.`);
  }
}

export async function removeImageBackground(
  file: File,
  cropToSubject: boolean,
): Promise<BackgroundRemovalResult> {
  validateBackgroundFile(file);

  const local = await completeMeteredLocalAction(
    'background-remover',
    'remove-background-local',
    () => runLocalBackgroundRemoval(file, cropToSubject),
  );

  return {
    url: URL.createObjectURL(local.blob),
    width: local.width,
    height: local.height,
    fileSize: local.blob.size,
    contentType: 'image/png',
  };
}

export function downloadLocalResult(url: string, fallbackName: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fallbackName;
  anchor.rel = 'noopener';
  anchor.click();
}
