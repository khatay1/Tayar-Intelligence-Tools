import { NameTone, NameUseCase } from './name-types';

export const TONE_WORDS: Record<NameTone, string[]> = {
  modern: ['Nova', 'Nexa', 'Flow', 'Pulse', 'Loop', 'Orbit', 'Pixel', 'Shift', 'Core', 'Axis'],
  professional: ['Prime', 'Crest', 'Summit', 'Bridge', 'Sterling', 'North', 'Vertex', 'Harbor', 'Apex', 'Ledger'],
  friendly: ['Bloom', 'Sunny', 'Hello', 'Nest', 'Buddy', 'Joy', 'Sprout', 'Kind', 'Happy', 'Cozy'],
  bold: ['Forge', 'Titan', 'Blaze', 'Vanta', 'Storm', 'Volt', 'Roar', 'Iron', 'Rogue', 'Strike'],
  minimal: ['One', 'Mono', 'Form', 'Line', 'Plain', 'Base', 'Quiet', 'Pure', 'Blank', 'Soft'],
};

export const USE_CASE_SUFFIXES: Record<NameUseCase, string[]> = {
  business: ['Works', 'Group', 'Studio', 'Labs', 'Partners', 'Collective', 'Solutions', 'Co'],
  product: ['Kit', 'App', 'Flow', 'Desk', 'Box', 'Pilot', 'Sync', 'Stack'],
  brand: ['House', 'Club', 'Made', 'Supply', 'Collective', 'Story', 'Craft', 'Label'],
  youtube: ['TV', 'Daily', 'Show', 'Studio', 'Channel', 'Stories', 'World', 'Hub'],
  instagram: ['Daily', 'Life', 'Vibes', 'Studio', 'Diary', 'Edit', 'World', 'Space'],
};

export const CONNECTORS = ['&', 'Go', 'Up', 'Now', 'HQ', 'Lab', 'ly', 'io'];
