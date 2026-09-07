import { AlphaType, ColorType, ImageFormat, Skia } from '@shopify/react-native-skia';
import * as ImageManipulator from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { loadTensorflowModel } from 'react-native-fast-tflite';
import { supabase } from './supabase';

const MODEL_SIZE = 320;
const MAX_OUTPUT_EDGE = 1600;
const MODEL_ASSET = require('../assets/models/u2netp_d0_320_fp16.tflite');
const MEAN = [0.485, 0.456, 0.406] as const;
const STD = [0.229, 0.224, 0.225] as const;

type ToolState = {
  allowed?: boolean;
  reason?: string;
  required_plan?: string;
  effective_plan?: string;
  usage_remaining?: number | null;
};

type Model = Awaited<ReturnType<typeof loadTensorflowModel>>;
let modelPromise: Promise<Model> | null = null;
let cpuModelPromise: Promise<Model> | null = null;

function readableAccessError(state: ToolState) {
  if (state.reason === 'plan_required') return `This tool requires the ${state.required_plan || 'required'} plan.`;
  if (state.reason === 'limit_reached') return 'Your Background Remover usage limit has been reached.';
  if (state.reason === 'disabled') return 'Background Remover is currently disabled.';
  return 'Background Remover is not available for this account.';
}

export async function assertBackgroundRemovalAccess() {
  const { data, error } = await supabase.rpc('tool_access_state', { p_tool_id: 'background-remover' });
  if (error) throw new Error(error.message || 'Could not verify tool access.');
  const state = (data || {}) as ToolState;
  if (state.allowed !== true) throw new Error(readableAccessError(state));
  return state;
}

export async function recordBackgroundRemovalUsage() {
  const { data, error } = await supabase.rpc('consume_tool_usage', {
    p_tool_id: 'background-remover',
    p_action: 'remove_background',
  });
  if (error) throw new Error(error.message || 'Could not record tool usage.');
  return (data || {}) as ToolState;
}

async function loadPreferredModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      try {
        if (Platform.OS === 'ios') return await loadTensorflowModel(MODEL_ASSET, ['core-ml']);
        if (Platform.OS === 'android') return await loadTensorflowModel(MODEL_ASSET, ['android-gpu']);
      } catch {
        // Some devices/models do not support every delegate. CPU is the safe fallback.
      }
      if (!cpuModelPromise) cpuModelPromise = loadTensorflowModel(MODEL_ASSET, []);
      return cpuModelPromise;
    })();
  }
  return modelPromise;
}

async function getCpuModel() {
  if (!cpuModelPromise) cpuModelPromise = loadTensorflowModel(MODEL_ASSET, []);
  return cpuModelPromise;
}

async function decodeRgba(uri: string) {
  const encoded = await new File(uri).bytes();
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(encoded));
  if (!image) throw new Error('Could not decode this image. Try JPEG, PNG or WebP.');
  const width = image.width();
  const height = image.height();
  const pixels = image.readPixels(0, 0, {
    width,
    height,
    alphaType: AlphaType.Unpremul,
    colorType: ColorType.RGBA_8888,
  });
  image.dispose();
  if (!(pixels instanceof Uint8Array)) throw new Error('Could not read image pixels in a supported format.');
  return { pixels, width, height };
}

function buildInput(pixels: Uint8Array) {
  const expected = MODEL_SIZE * MODEL_SIZE * 4;
  if (pixels.length < expected) throw new Error('The resized image returned incomplete pixel data.');
  const input = new Float32Array(MODEL_SIZE * MODEL_SIZE * 3);
  let outputIndex = 0;
  for (let index = 0; index < expected; index += 4) {
    input[outputIndex++] = (pixels[index] / 255 - MEAN[0]) / STD[0];
    input[outputIndex++] = (pixels[index + 1] / 255 - MEAN[1]) / STD[1];
    input[outputIndex++] = (pixels[index + 2] / 255 - MEAN[2]) / STD[2];
  }
  return input;
}

function toArrayBuffer(input: Float32Array) {
  const buffer = new ArrayBuffer(input.byteLength);
  new Float32Array(buffer).set(input);
  return buffer;
}

function normalizeMask(raw: Float32Array) {
  const expected = MODEL_SIZE * MODEL_SIZE;
  if (raw.length < expected) throw new Error(`Background model returned an unexpected mask (${raw.length} values).`);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < expected; i += 1) {
    const value = raw[i];
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error('Background model returned invalid mask values.');
  const range = Math.max(max - min, 1e-6);
  const mask = new Float32Array(expected);
  for (let i = 0; i < expected; i += 1) {
    const normalized = Math.max(0, Math.min(1, (raw[i] - min) / range));
    const shaped = Math.max(0, Math.min(1, (normalized - 0.035) / 0.93));
    mask[i] = shaped * shaped * (3 - 2 * shaped);
  }
  return mask;
}

function sampleMask(mask: Float32Array, x: number, y: number, width: number, height: number) {
  const mx = width <= 1 ? 0 : (x * (MODEL_SIZE - 1)) / (width - 1);
  const my = height <= 1 ? 0 : (y * (MODEL_SIZE - 1)) / (height - 1);
  const x0 = Math.floor(mx);
  const y0 = Math.floor(my);
  const x1 = Math.min(MODEL_SIZE - 1, x0 + 1);
  const y1 = Math.min(MODEL_SIZE - 1, y0 + 1);
  const tx = mx - x0;
  const ty = my - y0;
  const top = mask[y0 * MODEL_SIZE + x0] * (1 - tx) + mask[y0 * MODEL_SIZE + x1] * tx;
  const bottom = mask[y1 * MODEL_SIZE + x0] * (1 - tx) + mask[y1 * MODEL_SIZE + x1] * tx;
  return top * (1 - ty) + bottom * ty;
}

function applyMask(rgba: Uint8Array, mask: Float32Array, width: number, height: number) {
  const output = new Uint8Array(rgba);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = (y * width + x) * 4;
      const alpha = Math.round(255 * sampleMask(mask, x, y, width, height));
      output[pixelIndex + 3] = Math.round((rgba[pixelIndex + 3] * alpha) / 255);
    }
  }
  return output;
}

async function prepareImage(uri: string, width: number, height: number) {
  const modelInput = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MODEL_SIZE, height: MODEL_SIZE } }],
    { format: ImageManipulator.SaveFormat.PNG, compress: 1 },
  );

  const maxEdge = Math.max(width, height);
  const scale = maxEdge > MAX_OUTPUT_EDGE ? MAX_OUTPUT_EDGE / maxEdge : 1;
  const outputWidth = Math.max(1, Math.round(width * scale));
  const outputHeight = Math.max(1, Math.round(height * scale));
  const actions: ImageManipulator.Action[] = scale < 1 ? [{ resize: { width: outputWidth, height: outputHeight } }] : [];
  const working = await ImageManipulator.manipulateAsync(uri, actions, {
    format: ImageManipulator.SaveFormat.PNG,
    compress: 1,
  });
  return { modelInput, working };
}

async function runMask(input: Float32Array) {
  const inputBuffer = toArrayBuffer(input);
  const preferred = await loadPreferredModel();
  try {
    const outputs = await preferred.run([inputBuffer]);
    if (!outputs[0]) throw new Error('Background model returned no output.');
    return normalizeMask(new Float32Array(outputs[0]));
  } catch (preferredError) {
    const cpu = await getCpuModel();
    if (cpu === preferred) throw preferredError;
    const outputs = await cpu.run([inputBuffer]);
    if (!outputs[0]) throw new Error('Background model returned no output.');
    return normalizeMask(new Float32Array(outputs[0]));
  }
}

export type LocalBackgroundResult = {
  uri: string;
  width: number;
  height: number;
  bytes: number;
};

export async function removeBackgroundOnDevice(uri: string, width: number, height: number): Promise<LocalBackgroundResult> {
  if (!uri) throw new Error('Choose an image first.');
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error('The selected image dimensions could not be read.');
  }

  const prepared = await prepareImage(uri, width, height);
  const modelPixels = await decodeRgba(prepared.modelInput.uri);
  const input = buildInput(modelPixels.pixels);
  const mask = await runMask(input);

  const working = await decodeRgba(prepared.working.uri);
  const composited = applyMask(working.pixels, mask, working.width, working.height);
  const image = Skia.Image.MakeImage(
    {
      width: working.width,
      height: working.height,
      alphaType: AlphaType.Unpremul,
      colorType: ColorType.RGBA_8888,
    },
    Skia.Data.fromBytes(composited),
    working.width * 4,
  );
  if (!image) throw new Error('Could not create the transparent result image.');
  const png = image.encodeToBytes(ImageFormat.PNG, 100);
  image.dispose();
  if (!png.length) throw new Error('Could not encode the transparent PNG.');

  const output = new File(Paths.cache, `tayar-background-removed-${Date.now()}.png`);
  output.create();
  output.write(png);
  return { uri: output.uri, width: working.width, height: working.height, bytes: png.byteLength };
}
