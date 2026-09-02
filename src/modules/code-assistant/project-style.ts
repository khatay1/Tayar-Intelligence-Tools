import type { CodeProjectFile } from './project-context';

export interface ProjectStyleProfile {
  colors: string[];
  cssVariables: string[];
  fontFamilies: string[];
  radii: string[];
  spacing: string[];
  usesTailwind: boolean;
  darkModeSignals: boolean;
  classHints: string[];
}

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const RGB = /\brgba?\([^)]{1,80}\)/g;
const CSS_VAR = /--([a-zA-Z0-9-_]+)\s*:\s*([^;\n]{1,120})/g;
const FONT_FAMILY = /font-family\s*:\s*([^;\n]{1,160})/gi;
const RADIUS = /border-radius\s*:\s*([^;\n]{1,80})/gi;
const SPACING = /(?:padding|margin|gap)\s*:\s*([^;\n]{1,80})/gi;
const CLASSNAME = /className\s*=\s*[{"'\x60]([^}"'\x60]{1,300})/g;

function unique(values: string[], max: number) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, max);
}

function compact(value: string, max = 80) {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function buildProjectStyleProfile(files: Array<Pick<CodeProjectFile, 'path' | 'content'>>): ProjectStyleProfile {
  const colors: string[] = [];
  const cssVariables: string[] = [];
  const fontFamilies: string[] = [];
  const radii: string[] = [];
  const spacing: string[] = [];
  const classHints: string[] = [];
  let usesTailwind = false;
  let darkModeSignals = false;

  for (const file of files) {
    const source = file.content.slice(0, 30_000);
    colors.push(...(source.match(HEX) || []), ...(source.match(RGB) || []));

    for (const match of source.matchAll(CSS_VAR)) {
      cssVariables.push(`--${match[1]}: ${compact(match[2])}`);
    }
    for (const match of source.matchAll(FONT_FAMILY)) fontFamilies.push(compact(match[1]));
    for (const match of source.matchAll(RADIUS)) radii.push(compact(match[1]));
    for (const match of source.matchAll(SPACING)) spacing.push(compact(match[1]));

    if (/tailwind|@apply|className=.*(?:bg-|text-|rounded-|px-|py-|gap-|grid|flex)/s.test(source)) usesTailwind = true;
    if (/dark:|\.dark\b|data-theme=["']dark|prefers-color-scheme\s*:\s*dark|bg-(?:slate|gray|zinc|neutral)-9\d\d/.test(source)) {
      darkModeSignals = true;
    }

    for (const match of source.matchAll(CLASSNAME)) {
      const hint = compact(match[1], 180);
      if (/(?:rounded|bg-|text-|border|shadow|px-|py-|gap-|space-|font-)/.test(hint)) classHints.push(hint);
    }
  }

  return {
    colors: unique(colors, 10),
    cssVariables: unique(cssVariables, 18),
    fontFamilies: unique(fontFamilies, 6),
    radii: unique(radii, 6),
    spacing: unique(spacing, 8),
    usesTailwind,
    darkModeSignals,
    classHints: unique(classHints, 8),
  };
}

export function summarizeStyleProfile(profile: ProjectStyleProfile): string[] {
  const lines: string[] = [];
  if (profile.colors.length) lines.push(`Colors: ${profile.colors.join(', ')}`);
  if (profile.cssVariables.length) lines.push(`CSS vars: ${profile.cssVariables.join(' | ')}`);
  if (profile.fontFamilies.length) lines.push(`Fonts: ${profile.fontFamilies.join(', ')}`);
  if (profile.radii.length) lines.push(`Radii: ${profile.radii.join(', ')}`);
  if (profile.spacing.length) lines.push(`Spacing: ${profile.spacing.join(', ')}`);
  if (profile.usesTailwind) lines.push('Tailwind-style utility classes detected');
  if (profile.darkModeSignals) lines.push('Dark-mode styling detected');
  return lines.slice(0, 8);
}
