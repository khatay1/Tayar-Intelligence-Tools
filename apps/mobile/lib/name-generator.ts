export type NameUseCase = 'business' | 'product' | 'brand' | 'youtube' | 'instagram';
export type NameTone = 'modern' | 'professional' | 'friendly' | 'bold' | 'minimal';
export type GeneratedName = { name: string; slug: string; reason: string };

const TONE_WORDS: Record<NameTone, string[]> = {
  modern: ['Nova', 'Nexa', 'Flow', 'Pulse', 'Loop', 'Orbit', 'Pixel', 'Shift', 'Core', 'Axis'],
  professional: ['Prime', 'Crest', 'Summit', 'Bridge', 'Sterling', 'North', 'Vertex', 'Harbor', 'Apex', 'Ledger'],
  friendly: ['Bloom', 'Sunny', 'Hello', 'Nest', 'Buddy', 'Joy', 'Sprout', 'Kind', 'Happy', 'Cozy'],
  bold: ['Forge', 'Titan', 'Blaze', 'Vanta', 'Storm', 'Volt', 'Roar', 'Iron', 'Rogue', 'Strike'],
  minimal: ['One', 'Mono', 'Form', 'Line', 'Plain', 'Base', 'Quiet', 'Pure', 'Blank', 'Soft'],
};

const USE_CASE_SUFFIXES: Record<NameUseCase, string[]> = {
  business: ['Works', 'Group', 'Studio', 'Labs', 'Partners', 'Collective', 'Solutions', 'Co'],
  product: ['Kit', 'App', 'Flow', 'Desk', 'Box', 'Pilot', 'Sync', 'Stack'],
  brand: ['House', 'Club', 'Made', 'Supply', 'Collective', 'Story', 'Craft', 'Label'],
  youtube: ['TV', 'Daily', 'Show', 'Studio', 'Channel', 'Stories', 'World', 'Hub'],
  instagram: ['Daily', 'Life', 'Vibes', 'Studio', 'Diary', 'Edit', 'World', 'Space'],
};

const CONNECTORS = ['&', 'Go', 'Up', 'Now', 'HQ', 'Lab', 'ly', 'io'];

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
  return value.trim().replace(/[^a-zA-Z0-9\s-]/g, ' ').split(/[\s-]+/).filter(Boolean).slice(0, 3).map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()).join('');
}

function slugify(value: string) {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '').slice(0, 40);
}

export function generateNames(input: { keyword: string; useCase: NameUseCase; tone: NameTone; count: number; nonce: number }): GeneratedName[] {
  const root = titleToken(input.keyword.trim().slice(0, 40)) || 'Tayar';
  const count = Math.max(6, Math.min(30, Math.round(input.count || 18)));
  const random = mulberry32(hashString(`${root}|${input.useCase}|${input.tone}|${input.nonce}`));
  const unique = new Map<string, GeneratedName>();
  for (let index = 0; index < count * 8 && unique.size < count; index += 1) {
    const prefix = pick(TONE_WORDS[input.tone], random);
    const suffix = pick(USE_CASE_SUFFIXES[input.useCase], random);
    const connector = pick(CONNECTORS, random);
    let candidate = root;
    if (index % 6 === 0) candidate = `${prefix}${root}`;
    if (index % 6 === 1) candidate = `${root}${suffix.replace(/\s+/g, '')}`;
    if (index % 6 === 2) candidate = `${prefix}${suffix.replace(/\s+/g, '')}`;
    if (index % 6 === 3) candidate = `${root}${connector.replace(/[^a-zA-Z0-9]/g, '')}`;
    if (index % 6 === 4) candidate = `${prefix}${root}${suffix.replace(/\s+/g, '')}`;
    if (index % 6 === 5) candidate = `${root}${prefix}`;
    candidate = candidate.replace(/[^a-zA-Z0-9]/g, '').slice(0, 36);
    if (candidate.length < 3) continue;
    const key = candidate.toLowerCase();
    if (!unique.has(key)) unique.set(key, { name: candidate, slug: slugify(candidate), reason: `${input.useCase}-ready · ${input.tone} tone` });
  }
  return [...unique.values()];
}
