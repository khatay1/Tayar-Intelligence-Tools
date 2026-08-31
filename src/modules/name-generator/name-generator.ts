import { CONNECTORS, TONE_WORDS, USE_CASE_SUFFIXES } from './name-banks';
import { GeneratedName, NameGeneratorInput } from './name-types';

export const MAX_KEYWORD_LENGTH = 40;
export const MAX_RESULTS = 30;

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function pick<T>(items: T[], random: () => number) {
  return items[Math.floor(random() * items.length)] || items[0];
}

function titleToken(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join('');
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);
}

function reason(useCase: NameGeneratorInput['useCase'], tone: NameGeneratorInput['tone']) {
  const labels: Record<NameGeneratorInput['useCase'], string> = {
    business: 'business-ready',
    product: 'product-friendly',
    brand: 'brandable',
    youtube: 'channel-friendly',
    instagram: 'handle-friendly',
  };
  return `${labels[useCase]} · ${tone} tone`;
}

export function generateNames(input: NameGeneratorInput): GeneratedName[] {
  const keyword = input.keyword.trim().slice(0, MAX_KEYWORD_LENGTH);
  const root = titleToken(keyword) || 'Tayar';
  const count = Math.max(6, Math.min(MAX_RESULTS, Math.round(input.count || 12)));
  const seed = hashString(`${root}|${input.useCase}|${input.tone}|${input.nonce}`);
  const random = mulberry32(seed);
  const toneWords = TONE_WORDS[input.tone];
  const suffixes = USE_CASE_SUFFIXES[input.useCase];
  const unique = new Map<string, GeneratedName>();
  const targetAttempts = count * 8;

  for (let index = 0; index < targetAttempts && unique.size < count; index += 1) {
    const prefix = pick(toneWords, random);
    const suffix = pick(suffixes, random);
    const connector = pick(CONNECTORS, random);
    const pattern = index % 6;

    let candidate = root;
    if (pattern === 0) candidate = `${prefix}${root}`;
    if (pattern === 1) candidate = `${root}${suffix.replace(/\s+/g, '')}`;
    if (pattern === 2) candidate = `${prefix}${suffix.replace(/\s+/g, '')}`;
    if (pattern === 3) candidate = `${root}${connector.replace(/[^a-zA-Z0-9]/g, '')}`;
    if (pattern === 4) candidate = `${prefix}${root}${suffix.replace(/\s+/g, '')}`;
    if (pattern === 5) candidate = `${root}${prefix}`;

    candidate = candidate.replace(/[^a-zA-Z0-9]/g, '').slice(0, 36);
    if (candidate.length < 3) continue;

    const key = candidate.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, {
        name: candidate,
        slug: slugify(candidate),
        reason: reason(input.useCase, input.tone),
      });
    }
  }

  return [...unique.values()];
}
