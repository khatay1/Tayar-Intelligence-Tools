import type { FileWriteOperation } from './project-file-store';
import type { CodeProjectContext } from './project-context';
import { buildDependencyInstallCommand, parseNpmDependencyRequirement } from './dependency-spec';

export interface ControlledPackageEdit {
  operation: FileWriteOperation | null;
  additions: Array<{ name: string; spec: string }>;
  unresolved: string[];
  warnings: string[];
  installCommand: string;
  preview: string;
}

const MAX_PACKAGE_JSON_CHARS = 80_000;
const SAFE_SPEC = /^(?:(?:\^|~)?\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?|latest|next|beta|alpha|canary)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const output: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) if (typeof entry === 'string') output[key] = entry;
  return output;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}

function indentOf(source: string): number {
  const match = source.match(/\n(\s+)"/);
  return match ? Math.min(8, Math.max(2, match[1].length)) : 2;
}

function safeExplicitSpec(spec: string | null): spec is string {
  return Boolean(spec && SAFE_SPEC.test(spec));
}

function packageContentFromStore(content: Record<string, unknown>): string | null {
  const files = content.files;
  if (isRecord(files)) {
    const raw = files['package.json'];
    if (typeof raw === 'string') return raw;
    if (isRecord(raw)) {
      for (const key of ['content', 'text', 'code', 'source', 'value']) {
        if (typeof raw[key] === 'string') return raw[key] as string;
      }
    }
    return null;
  }
  if (Array.isArray(files)) {
    for (const raw of files) {
      if (!isRecord(raw)) continue;
      const path = [raw.path, raw.name, raw.filename].find((value) => typeof value === 'string');
      if (path !== 'package.json' && path !== './package.json') continue;
      for (const key of ['content', 'text', 'code', 'source', 'value']) {
        if (typeof raw[key] === 'string') return raw[key] as string;
      }
    }
  }
  return null;
}

function parsePackage(source: string): Record<string, unknown> {
  if (!source || source.length > MAX_PACKAGE_JSON_CHARS) throw new Error('package.json is unavailable or too large for controlled editing.');
  const parsed: unknown = JSON.parse(source);
  if (!isRecord(parsed)) throw new Error('package.json is not a JSON object.');
  return parsed;
}

export function buildControlledPackageEdit(project: CodeProjectContext | null, requirements: string[]): ControlledPackageEdit | null {
  if (!project || !requirements.length) return null;

  const parsedRequirements = requirements.map(parseNpmDependencyRequirement).filter((entry) => Boolean(entry));
  const missingNames = parsedRequirements
    .filter((entry) => entry && !project.dependencies[entry.name] && !project.devDependencies[entry.name])
    .map((entry) => entry!.name);
  const installCommand = buildDependencyInstallCommand(project.packageManager, requirements, missingNames);

  const unresolved: string[] = [];
  const additions: Array<{ name: string; spec: string }> = [];
  const seen = new Set<string>();

  for (const requirement of requirements) {
    const parsed = parseNpmDependencyRequirement(requirement);
    if (!parsed || project.dependencies[parsed.name] || project.devDependencies[parsed.name] || seen.has(parsed.name)) continue;
    seen.add(parsed.name);
    if (!safeExplicitSpec(parsed.spec)) {
      unresolved.push(parsed.raw);
      continue;
    }
    additions.push({ name: parsed.name, spec: parsed.spec });
  }

  const warnings: string[] = [];
  if (project.filePaths.some((path) => /(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/.test(path))) {
    warnings.push('A lockfile exists. Tayar will not edit it; refresh it with the project package manager after apply.');
  }

  const packageFile = project.packageJsonFile;
  if (!packageFile?.complete) {
    return {
      operation: null,
      additions: [],
      unresolved: Array.from(new Set([...unresolved, ...requirements])),
      warnings: [...warnings, 'A complete package.json file is not available, so controlled editing is disabled.'],
      installCommand,
      preview: '',
    };
  }

  if (!additions.length) return { operation: null, additions, unresolved: Array.from(new Set(unresolved)), warnings, installCommand, preview: '' };

  try {
    const parsed = parsePackage(packageFile.content);
    const dependencies = stringRecord(parsed.dependencies);
    for (const addition of additions) dependencies[addition.name] = addition.spec;
    const next = { ...parsed, dependencies };
    const content = JSON.stringify(next, null, indentOf(packageFile.content)) + (packageFile.content.endsWith('\n') ? '\n' : '');
    return {
      operation: { type: 'replace', path: 'package.json', content },
      additions,
      unresolved: Array.from(new Set(unresolved)),
      warnings,
      installCommand,
      preview: additions.map((entry) => `+ dependencies["${entry.name}"] = "${entry.spec}"`).join('\n'),
    };
  } catch {
    return {
      operation: null,
      additions: [],
      unresolved: Array.from(new Set([...unresolved, ...requirements])),
      warnings: [...warnings, 'package.json could not be parsed safely; use the install command instead.'],
      installCommand,
      preview: '',
    };
  }
}

export function validateControlledPackageOperation(
  currentContent: Record<string, unknown>,
  operation: FileWriteOperation,
  allowedRequirements: string[],
): void {
  if (operation.type !== 'replace' || operation.path !== 'package.json') throw new Error('Controlled dependency editing may replace package.json only.');
  if (operation.content.length > MAX_PACKAGE_JSON_CHARS) throw new Error('Controlled package.json edit exceeds the size limit.');

  const beforeSource = packageContentFromStore(currentContent);
  if (!beforeSource) throw new Error('Current package.json file is unavailable for controlled validation.');
  const before = parsePackage(beforeSource);
  const after = parsePackage(operation.content);

  const beforeDeps = stringRecord(before.dependencies);
  const afterDeps = stringRecord(after.dependencies);
  const beforeDev = stringRecord(before.devDependencies);
  const afterDev = stringRecord(after.devDependencies);

  const beforeRest = { ...before };
  const afterRest = { ...after };
  delete beforeRest.dependencies;
  delete afterRest.dependencies;
  if (stableSerialize(beforeRest) !== stableSerialize(afterRest)) throw new Error('Controlled package.json edit attempted to change fields other than dependencies.');
  if (stableSerialize(beforeDev) !== stableSerialize(afterDev)) throw new Error('Controlled package.json edit attempted to modify devDependencies.');

  for (const [name, spec] of Object.entries(beforeDeps)) {
    if (afterDeps[name] !== spec) throw new Error(`Controlled package.json edit attempted to change existing dependency "${name}".`);
  }

  const allowed = new Map<string, string>();
  for (const requirement of allowedRequirements) {
    const parsed = parseNpmDependencyRequirement(requirement);
    if (parsed && safeExplicitSpec(parsed.spec)) allowed.set(parsed.name, parsed.spec);
  }

  const added = Object.entries(afterDeps).filter(([name]) => !Object.prototype.hasOwnProperty.call(beforeDeps, name));
  if (added.length > 25) throw new Error('Controlled package.json edit contains too many dependency additions.');
  for (const [name, spec] of added) {
    if (allowed.get(name) !== spec) throw new Error(`Controlled package.json edit contains unapproved dependency "${name}".`);
  }
}
