import { supabase } from '@/lib/supabase';
import { inspectProjectFileStore, ProjectFileStoreKind } from './project-file-store';

export interface CodeProjectFile {
  path: string;
  content: string;
}

export interface CodeProjectContext {
  id: string;
  title: string;
  type: string;
  status: string;
  framework: string;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  files: CodeProjectFile[];
  totalCandidateFiles: number;
  truncated: boolean;
  fileStoreKind: ProjectFileStoreKind;
  fileStoreFingerprint: string;
  canApply: boolean;
  lastApply?: {
    id: string;
    summary: string;
    appliedAt: string;
    fingerprintAfter: string;
  } | null;
}

export interface CodeProjectOption {
  id: string;
  title: string;
  type: string;
  status: string;
  updatedAt: string;
}

export interface DependencyCheck {
  name: string;
  installed: boolean;
  version?: string;
  kind: 'dependency' | 'devDependency' | 'missing';
}

const MAX_CONTEXT_FILES = 12;
const MAX_FILE_CHARS = 4_000;
const MAX_TOTAL_CHARS = 8_000;
const SAFE_TEXT_EXTENSION = /\.(?:[cm]?[jt]sx?|css|scss|sass|less|html?|json|mdx?|yaml|yml|toml|txt)$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safePath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const path = value.trim().replace(/^\.\//, '');
  if (!path || path.length > 260 || path.startsWith('/') || path.includes('\\')) return null;
  if (!path.split('/').every((part) => part && part !== '.' && part !== '..')) return null;
  return path;
}

function textContent(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (!isRecord(value)) return null;
  for (const key of ['content', 'text', 'code', 'source', 'value']) {
    const candidate = value[key];
    if (typeof candidate === 'string') return candidate;
  }
  return null;
}

function collectFiles(content: Record<string, unknown>): Array<{ path: string; content: string }> {
  const candidates: Array<{ path: string; content: string }> = [];

  const add = (pathValue: unknown, contentValue: unknown) => {
    const path = safePath(pathValue);
    const text = textContent(contentValue);
    if (!path || text === null) return;
    if (path !== 'package.json' && !SAFE_TEXT_EXTENSION.test(path)) return;
    candidates.push({ path, content: text });
  };

  const inspectCollection = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (!isRecord(entry)) return;
        add(entry.path ?? entry.name ?? entry.filename, entry);
      });
      return;
    }
    if (isRecord(value)) {
      Object.entries(value).forEach(([path, entry]) => add(path, entry));
    }
  };

  for (const key of ['files', 'sourceFiles', 'source_files', 'projectFiles', 'project_files']) {
    inspectCollection(content[key]);
  }

  for (const key of ['code', 'source', 'html', 'css', 'javascript', 'typescript']) {
    const value = content[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    const inferredPath =
      key === 'html' ? 'index.html'
      : key === 'css' ? 'styles.css'
      : key === 'typescript' ? 'src/main.tsx'
      : key === 'javascript' ? 'src/main.jsx'
      : 'src/main.tsx';
    add(inferredPath, value);
  }

  const unique = new Map<string, string>();
  for (const file of candidates) {
    if (!unique.has(file.path)) unique.set(file.path, file.content);
  }
  return Array.from(unique, ([path, fileContent]) => ({ path, content: fileContent }));
}

function parsePackageJson(content: Record<string, unknown>, files: Array<{ path: string; content: string }>): Record<string, unknown> {
  for (const key of ['packageJson', 'package_json']) {
    const value = content[key];
    if (isRecord(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed: unknown = JSON.parse(value);
        if (isRecord(parsed)) return parsed;
      } catch {
        // Continue to other package.json representations.
      }
    }
  }

  const file = files.find((entry) => entry.path === 'package.json');
  if (file) {
    try {
      const parsed: unknown = JSON.parse(file.content);
      if (isRecord(parsed)) return parsed;
    } catch {
      // Invalid project package JSON is treated as unavailable metadata.
    }
  }
  return {};
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const output: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && key.trim()) output[key] = entry;
  }
  return output;
}

function detectPackageManager(files: Array<{ path: string; content: string }>): 'npm' | 'pnpm' | 'yarn' | 'bun' {
  const paths = new Set(files.map((file) => file.path));
  if (paths.has('pnpm-lock.yaml')) return 'pnpm';
  if (paths.has('yarn.lock')) return 'yarn';
  if (paths.has('bun.lock') || paths.has('bun.lockb')) return 'bun';
  return 'npm';
}

function detectFramework(
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>,
  files: Array<{ path: string; content: string }>,
): string {
  const packages = new Set([...Object.keys(dependencies), ...Object.keys(devDependencies)]);
  if (packages.has('next')) return 'Next.js';
  if (packages.has('@remix-run/react')) return 'Remix';
  if (packages.has('react-router-dom')) return 'React + React Router';
  if (packages.has('vite')) return packages.has('react') ? 'React + Vite' : 'Vite';
  if (packages.has('react')) return 'React';
  if (packages.has('vue')) return 'Vue';
  if (packages.has('svelte')) return 'Svelte';
  if (files.some((file) => /\.tsx?$/.test(file.path))) return 'TypeScript';
  if (files.some((file) => /\.jsx?$/.test(file.path))) return 'JavaScript';
  if (files.some((file) => /\.html?$/.test(file.path))) return 'HTML';
  return 'Unknown';
}

function boundedFiles(files: Array<{ path: string; content: string }>): { files: CodeProjectFile[]; truncated: boolean } {
  let totalChars = 0;
  const output: CodeProjectFile[] = [];
  let truncated = files.length > MAX_CONTEXT_FILES;

  const prioritized = [...files].sort((a, b) => {
    const score = (path: string) =>
      path === 'package.json' ? 0
      : /(?:^|\/)src\/(?:App|main)\.[jt]sx?$/.test(path) ? 1
      : /(?:^|\/)app\/(?:page|layout)\.[jt]sx?$/.test(path) ? 2
      : /(?:^|\/)components\//.test(path) ? 3
      : 4;
    return score(a.path) - score(b.path) || a.path.localeCompare(b.path);
  });

  for (const file of prioritized.slice(0, MAX_CONTEXT_FILES)) {
    if (totalChars >= MAX_TOTAL_CHARS) {
      truncated = true;
      break;
    }
    const remaining = MAX_TOTAL_CHARS - totalChars;
    const limit = Math.min(MAX_FILE_CHARS, remaining);
    const slice = file.content.slice(0, limit);
    if (slice.length < file.content.length) truncated = true;
    output.push({ path: file.path, content: slice });
    totalChars += slice.length;
  }

  return { files: output, truncated };
}

export async function listCodeProjects(): Promise<CodeProjectOption[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, title, type, status, updated_at')
    .order('updated_at', { ascending: false })
    .limit(80);

  if (error) throw new Error('Unable to load project choices.');
  return (data || []).map((entry) => ({
    id: String(entry.id),
    title: typeof entry.title === 'string' && entry.title.trim() ? entry.title : 'Untitled project',
    type: typeof entry.type === 'string' ? entry.type : 'project',
    status: typeof entry.status === 'string' ? entry.status : 'unknown',
    updatedAt: typeof entry.updated_at === 'string' ? entry.updated_at : '',
  }));
}

export async function loadCodeProjectContext(projectId: string): Promise<CodeProjectContext | null> {
  const normalizedId = projectId.trim();
  if (!normalizedId || normalizedId.length > 128) throw new Error('Invalid project id.');

  const { data, error } = await supabase
    .from('projects')
    .select('id, title, type, status, content')
    .eq('id', normalizedId)
    .maybeSingle();

  if (error) throw new Error('Unable to load the active project context.');
  if (!data) return null;

  const content = isRecord(data.content) ? data.content : {};
  const allFiles = collectFiles(content);
  const packageJson = parsePackageJson(content, allFiles);
  const dependencies = stringRecord(packageJson.dependencies);
  const devDependencies = stringRecord(packageJson.devDependencies);
  const bounded = boundedFiles(allFiles);
  const fileStore = inspectProjectFileStore(content);
  const rawAssistantState = isRecord(content._tayarCodeAssistant) ? content._tayarCodeAssistant : {};
  const rawLastApply = isRecord(rawAssistantState.lastApply) ? rawAssistantState.lastApply : null;
  const lastApply =
    rawLastApply &&
    typeof rawLastApply.id === 'string' &&
    typeof rawLastApply.fingerprintAfter === 'string'
      ? {
          id: rawLastApply.id,
          summary: typeof rawLastApply.summary === 'string' ? rawLastApply.summary : 'Applied patch',
          appliedAt: typeof rawLastApply.appliedAt === 'string' ? rawLastApply.appliedAt : '',
          fingerprintAfter: rawLastApply.fingerprintAfter,
        }
      : null;

  return {
    id: String(data.id),
    title: typeof data.title === 'string' ? data.title : 'Untitled project',
    type: typeof data.type === 'string' ? data.type : 'project',
    status: typeof data.status === 'string' ? data.status : 'unknown',
    framework: detectFramework(dependencies, devDependencies, allFiles),
    packageManager: detectPackageManager(allFiles),
    dependencies,
    devDependencies,
    files: bounded.files,
    totalCandidateFiles: allFiles.length,
    truncated: bounded.truncated,
    fileStoreKind: fileStore.kind,
    fileStoreFingerprint: fileStore.fingerprint,
    canApply: fileStore.kind !== 'unsupported',
    lastApply,
  };
}

export function checkProjectDependencies(
  project: CodeProjectContext | null,
  required: string[],
): DependencyCheck[] {
  return Array.from(new Set(required.filter(Boolean))).map((name) => {
    const dependencyVersion = project?.dependencies[name];
    if (dependencyVersion) return { name, installed: true, version: dependencyVersion, kind: 'dependency' as const };
    const devVersion = project?.devDependencies[name];
    if (devVersion) return { name, installed: true, version: devVersion, kind: 'devDependency' as const };
    return { name, installed: false, kind: 'missing' as const };
  });
}

export function summarizeProjectForAI(project: CodeProjectContext | null): Record<string, unknown> | null {
  if (!project) return null;
  const boundedRecord = (value: Record<string, string>, maxEntries: number) =>
    Object.fromEntries(Object.entries(value).slice(0, maxEntries));
  return {
    id: project.id,
    title: project.title.slice(0, 160),
    type: project.type.slice(0, 80),
    status: project.status.slice(0, 80),
    framework: project.framework,
    packageManager: project.packageManager,
    dependencies: boundedRecord(project.dependencies, 80),
    devDependencies: boundedRecord(project.devDependencies, 80),
    files: project.files,
    sourceFileCount: project.totalCandidateFiles,
    contextTruncated: project.truncated,
  };
}
