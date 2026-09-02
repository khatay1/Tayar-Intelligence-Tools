import type { CodeProjectFile } from './project-context';
import type { UIComponentCategory, UIComponentRecord } from './types';

export interface ProjectReplacementTarget {
  path: string;
  content: string;
}

const CODE_FILE = /\.(?:[cm]?[jt]sx?)$/i;
const STOP = new Set(['component','components','index','src','app','page','pages','ui','view','views']);

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP.has(word));
}

function inferCategory(path: string, source: string): UIComponentCategory | null {
  const text = `${path} ${source.slice(0, 4_000)}`.toLowerCase();
  if (/pricing|price|plan-card|subscription/.test(text)) return 'pricing';
  if (/navbar|navigation|sidebar|breadcrumb|mobile-menu|<nav/.test(text)) return 'navigation';
  if (/login|sign.?in|sign.?up|password|auth/.test(text)) return 'authentication';
  if (/chat|assistant|prompt|message-list/.test(text)) return 'ai';
  if (/dashboard|admin|overview/.test(text)) return 'dashboard';
  if (/hero|masthead|landing/.test(text)) return 'hero';
  if (/form|<input|<select|textarea|checkbox/.test(text)) return 'forms';
  if (/chart|metric|stats?|table|recharts/.test(text)) return 'data';
  if (/call.?to.?action|\bcta\b/.test(text)) return 'cta';
  if (/card|panel|tile/.test(text)) return 'cards';
  return null;
}

export function replacementTargets(files: CodeProjectFile[]): ProjectReplacementTarget[] {
  return files
    .filter((file) => !file.truncated && CODE_FILE.test(file.path))
    .filter((file) => /(?:return\s*\(|<\w|React\.|jsx|tsx|className=)/i.test(file.content))
    .map((file) => ({ path: file.path, content: file.content }))
    .slice(0, 40);
}

export function replacementCandidates(
  records: UIComponentRecord[],
  target: ProjectReplacementTarget | null,
  max = 8,
): UIComponentRecord[] {
  if (!target) return [];
  const category = inferCategory(target.path, target.content);
  const pathWords = new Set(words(target.path));
  const sourceWords = new Set(words(target.content.slice(0, 2_500)).slice(0, 60));

  const score = (record: UIComponentRecord) => {
    let total = 0;
    if (category && record.category === category) total += 35;
    const recordWords = new Set(words([record.name, record.description, ...record.tags].join(' ')));
    for (const word of recordWords) {
      if (pathWords.has(word)) total += 14;
      if (sourceWords.has(word)) total += 3;
    }
    if ((record.kind || 'component') === 'component') total += 2;
    return total;
  };

  return records
    .map((record) => ({ record, score: score(record) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name))
    .slice(0, max)
    .map((entry) => entry.record);
}

export function validateExactReplacementPlan(
  path: string,
  plan: { operations: Array<{ type: string; path: string }> },
): void {
  if (plan.operations.length !== 1) {
    throw new Error('Replacement plan must contain exactly one file operation.');
  }
  const operation = plan.operations[0];
  if (operation.type !== 'replace' || operation.path !== path) {
    throw new Error('Replacement plan attempted to change a file outside the selected target.');
  }
}
