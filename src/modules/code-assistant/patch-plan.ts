import {
  assertAIResponseProjectContextCurrent,
  carryAIResponseProjectContext,
} from '@/lib/ai/request-context';
import { CodeProjectContext } from './project-context';

export interface CodePatchOperation {
  type: 'create' | 'replace';
  path: string;
  content: string;
  reason: string;
}

export interface CodePatchPlan {
  summary: string;
  dependenciesToInstall: string[];
  registryDependencies: string[];
  operations: CodePatchOperation[];
  warnings: string[];
}

export interface PatchPreview {
  operation: CodePatchOperation;
  existingContent: string | null;
  preview: string;
}

const MAX_OPERATIONS = 20;
const MAX_FILE_CHARS = 80_000;
const MAX_TOTAL_CHARS = 240_000;
const SAFE_PATCH_EXTENSION = /\.(?:[cm]?[jt]sx?|css|scss|sass|less|html?|json|mdx?|yaml|yml|toml)$/i;
const FORBIDDEN_SEGMENTS = new Set(['.git', 'node_modules', '.vercel', '.supabase']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safePatchPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const path = value.trim().replace(/^\.\//, '');
  if (!path || path.length > 260 || path.startsWith('/') || path.includes('\\')) return null;
  const parts = path.split('/');
  if (!parts.every((part) => part && part !== '.' && part !== '..' && !FORBIDDEN_SEGMENTS.has(part))) return null;
  const lower = path.toLowerCase();
  if (
    lower === 'package-lock.json' ||
    lower === 'pnpm-lock.yaml' ||
    lower === 'yarn.lock' ||
    lower === 'bun.lock' ||
    lower === 'bun.lockb' ||
    lower.includes('.env') ||
    lower.includes('secret') ||
    lower.includes('credential')
  ) return null;
  if (lower === 'package.json') return null;
  if (!SAFE_PATCH_EXTENSION.test(path)) return null;
  return path;
}

function stringList(value: unknown, max = 50): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map((entry) => typeof entry === 'string' ? entry.trim() : '')
      .filter(Boolean),
  )).slice(0, max);
}

export function validatePatchPlan(value: unknown): CodePatchPlan {
  assertAIResponseProjectContextCurrent(value, 'code-assistant');
  if (!isRecord(value)) throw new Error('AI patch plan is not a JSON object.');

  const rawOperations = Array.isArray(value.operations) ? value.operations : [];
  if (rawOperations.length > MAX_OPERATIONS) throw new Error('AI patch plan contains too many file operations.');

  let totalChars = 0;
  const operations: CodePatchOperation[] = [];
  const seenPaths = new Set<string>();

  for (const raw of rawOperations) {
    if (!isRecord(raw)) throw new Error('AI patch plan contains an invalid operation.');
    const type = raw.type === 'create' || raw.type === 'replace' ? raw.type : null;
    const path = safePatchPath(raw.path);
    const content = typeof raw.content === 'string' ? raw.content : null;
    const reason = typeof raw.reason === 'string' ? raw.reason.trim().slice(0, 600) : '';

    if (!type || !path || content === null) throw new Error('AI patch operation failed safety validation.');
    if (seenPaths.has(path)) throw new Error(`AI patch plan contains duplicate path "${path}".`);
    if (content.length > MAX_FILE_CHARS) throw new Error(`AI patch file "${path}" exceeds the safe size limit.`);

    totalChars += content.length;
    if (totalChars > MAX_TOTAL_CHARS) throw new Error('AI patch plan exceeds the safe combined size limit.');

    seenPaths.add(path);
    operations.push({ type, path, content, reason });
  }

  if (!operations.length) throw new Error('AI patch plan did not include any safe file operations.');

  const plan: CodePatchPlan = {
    summary: typeof value.summary === 'string' ? value.summary.trim().slice(0, 2_000) : 'Proposed component integration',
    dependenciesToInstall: stringList(value.dependenciesToInstall),
    registryDependencies: stringList(value.registryDependencies),
    operations,
    warnings: stringList(value.warnings, 20).map((entry) => entry.slice(0, 1_000)),
  };

  carryAIResponseProjectContext(value, plan);
  return plan;
}

function findExistingFile(project: CodeProjectContext | null, path: string): string | null {
  return project?.files.find((file) => file.path === path)?.content ?? null;
}

function compactDiff(before: string | null, after: string): string {
  if (before === null) {
    return after.split('\n').slice(0, 80).map((line) => `+ ${line}`).join('\n')
      + (after.split('\n').length > 80 ? '\n… preview truncated' : '');
  }

  const oldLines = before.split('\n');
  const newLines = after.split('\n');
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix++;

  let oldSuffix = oldLines.length - 1;
  let newSuffix = newLines.length - 1;
  while (oldSuffix >= prefix && newSuffix >= prefix && oldLines[oldSuffix] === newLines[newSuffix]) {
    oldSuffix--;
    newSuffix--;
  }

  const contextStart = Math.max(0, prefix - 3);
  const contextEndNew = Math.min(newLines.length, newSuffix + 4);
  const output: string[] = [];

  oldLines.slice(contextStart, prefix).forEach((line) => output.push(`  ${line}`));
  oldLines.slice(prefix, oldSuffix + 1).slice(0, 80).forEach((line) => output.push(`- ${line}`));
  if (oldSuffix - prefix + 1 > 80) output.push('- … removed preview truncated');
  newLines.slice(prefix, newSuffix + 1).slice(0, 80).forEach((line) => output.push(`+ ${line}`));
  if (newSuffix - prefix + 1 > 80) output.push('+ … added preview truncated');

  const sharedSuffixStart = Math.max(newSuffix + 1, contextEndNew - 3);
  newLines.slice(sharedSuffixStart, contextEndNew).forEach((line) => output.push(`  ${line}`));

  return output.join('\n') || 'No textual changes.';
}

export function buildPatchPreviews(project: CodeProjectContext | null, plan: CodePatchPlan): PatchPreview[] {
  return plan.operations.map((operation) => {
    const existingContent = findExistingFile(project, operation.path);
    return {
      operation,
      existingContent,
      preview: compactDiff(existingContent, operation.content),
    };
  });
}
