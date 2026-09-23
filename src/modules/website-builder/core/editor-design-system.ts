export type EditorDesignTokenKind = 'color' | 'spacing' | 'radius' | 'font-size' | 'font-family';

export interface EditorDesignToken {
  id: string;
  name: string;
  kind: EditorDesignTokenKind;
  value: string;
}

export interface EditorStylePreset {
  id: string;
  name: string;
  values: Record<string, string | number | boolean>;
}

export interface EditorDesignSystemState {
  tokens: EditorDesignToken[];
  presets: EditorStylePreset[];
}

export const EMPTY_EDITOR_DESIGN_SYSTEM: EditorDesignSystemState = { tokens: [], presets: [] };

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function tokenKind(value: unknown): EditorDesignTokenKind | null {
  return value === 'color' || value === 'spacing' || value === 'radius' || value === 'font-size' || value === 'font-family' ? value : null;
}

export function normalizeEditorDesignSystem(value: unknown): EditorDesignSystemState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return EMPTY_EDITOR_DESIGN_SYSTEM;
  const input = value as Partial<EditorDesignSystemState>;
  const tokenIds = new Set<string>();
  const tokens: EditorDesignToken[] = [];
  for (const raw of Array.isArray(input.tokens) ? input.tokens : []) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const item = raw as Partial<EditorDesignToken>;
    const id = cleanText(item.id, 120); const name = cleanText(item.name, 80); const kind = tokenKind(item.kind); const tokenValue = cleanText(item.value, 240);
    if (!id || !name || !kind || !tokenValue || tokenIds.has(id)) continue;
    tokenIds.add(id); tokens.push({ id, name, kind, value: tokenValue });
    if (tokens.length >= 200) break;
  }
  const presetIds = new Set<string>();
  const presets: EditorStylePreset[] = [];
  for (const raw of Array.isArray(input.presets) ? input.presets : []) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const item = raw as Partial<EditorStylePreset>;
    const id = cleanText(item.id, 120); const name = cleanText(item.name, 80);
    if (!id || !name || presetIds.has(id) || !item.values || typeof item.values !== 'object' || Array.isArray(item.values)) continue;
    const values: EditorStylePreset['values'] = {};
    for (const [key, rawValue] of Object.entries(item.values).slice(0, 80)) {
      const safeKey = cleanText(key, 80);
      if (!safeKey || !['string','number','boolean'].includes(typeof rawValue)) continue;
      values[safeKey] = rawValue as string | number | boolean;
    }
    presetIds.add(id); presets.push({ id, name, values });
    if (presets.length >= 100) break;
  }
  return { tokens, presets };
}
