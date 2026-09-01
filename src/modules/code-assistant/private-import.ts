import { normalizeNpmDependencyNames } from './dependency-spec';
import { UIComponentCategory, UIComponentRecord } from './types';

const MAX_FILES = 600;
const MAX_FILE_CHARS = 400_000;
const MAX_TOTAL_CHARS = 20_000_000;
const CODE_EXTENSION = /\.(?:[cm]?[jt]sx?)$/i;
const STYLE_EXTENSION = /\.(?:css|scss|sass|less)$/i;
const ALLOWED_EXTENSION = /\.(?:[cm]?[jt]sx?|css|scss|sass|less)$/i;
const FORBIDDEN_NAME = /(?:^|\/)(?:\.env(?:\.|$)|package-lock\.json$|pnpm-lock\.yaml$|yarn\.lock$|bun\.lockb?$|.*secret.*|.*credential.*)/i;
const NON_COMPONENT_FILE = /(?:^|\/)(?:hooks?|lib|utils?|types?|constants?|helpers?)\/|(?:^|\/)(?:index|types?|constants?|utils?|helpers?)\.[cm]?[jt]sx?$|\.d\.ts$/i;

export interface PrivateImportResult {
  items: UIComponentRecord[];
  skipped: string[];
}

function safeFileName(file: File): string | null {
  const raw = (file.webkitRelativePath || file.name || '').replace(/\\/g, '/').replace(/^\.\//, '');
  if (!raw || raw.length > 260 || raw.startsWith('/') || raw.includes('..') || FORBIDDEN_NAME.test(raw)) return null;
  if (!ALLOWED_EXTENSION.test(raw)) return null;
  return raw;
}

function inferCategory(path: string): UIComponentCategory {
  const haystack = path.toLowerCase();
  if (/hero|banner|landing/.test(haystack)) return 'hero';
  if (/nav|menu|sidebar|header|breadcrumb/.test(haystack)) return 'navigation';
  if (/pricing|price/.test(haystack)) return 'pricing';
  if (/login|sign-?in|sign-?up|auth|password|otp/.test(haystack)) return 'authentication';
  if (/chat|assistant|prompt|\bai\b/.test(haystack)) return 'ai';
  if (/form|input|textarea|select|picker|checkbox|radio|upload/.test(haystack)) return 'forms';
  if (/dashboard|admin/.test(haystack)) return 'dashboard';
  if (/chart|graph|metric|stat|table|data/.test(haystack)) return 'data';
  if (/cta|call-to-action/.test(haystack)) return 'cta';
  return 'cards';
}

function displayName(path: string): string {
  const file = path.split('/').pop() || path;
  return file
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function importSpecifiers(source: string): string[] {
  const values: string[] = [];
  const pattern = /(?:from\s+|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) {
    const spec = match[1]?.trim();
    if (spec) values.push(spec);
  }
  return values;
}

function npmImports(source: string): string[] {
  const values: string[] = [];
  for (const spec of importSpecifiers(source)) {
    if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@/') || spec.startsWith('#')) continue;
    const name = spec.startsWith('@')
      ? spec.split('/').slice(0, 2).join('/')
      : spec.split('/')[0];
    if (name && !['react', 'react-dom'].includes(name)) values.push(name);
  }
  return normalizeNpmDependencyNames(values);
}

function normalizeJoinedPath(parts: string[]): string | null {
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!stack.length) return null;
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join('/');
}

function withExtensions(base: string): string[] {
  if (/\.[a-z0-9]+$/i.test(base)) return [base];
  return [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    `${base}.css`,
    `${base}.scss`,
    `${base}/index.tsx`,
    `${base}/index.ts`,
    `${base}/index.jsx`,
    `${base}/index.js`,
  ];
}

function resolveLocalImport(ownerPath: string, spec: string, files: Map<string, string>): string | null {
  if (spec.startsWith('.')) {
    const ownerParts = ownerPath.split('/');
    ownerParts.pop();
    const base = normalizeJoinedPath([...ownerParts, ...spec.split('/')]);
    if (!base) return null;
    return withExtensions(base).find((candidate) => files.has(candidate)) || null;
  }

  if (spec.startsWith('@/')) {
    const alias = spec.slice(2);
    const matches = Array.from(files.keys()).filter((path) =>
      withExtensions(alias).some((candidate) => path === candidate || path.endsWith(`/${candidate}`)),
    );
    return matches.length === 1 ? matches[0] : null;
  }

  return null;
}

function collectLocalBundle(
  startPath: string,
  files: Map<string, string>,
): Array<{ path: string; content: string }> {
  const output: Array<{ path: string; content: string }> = [];
  const visited = new Set<string>();
  const queue: Array<{ path: string; depth: number }> = [{ path: startPath, depth: 0 }];

  while (queue.length && output.length < 16) {
    const current = queue.shift()!;
    if (visited.has(current.path)) continue;
    const content = files.get(current.path);
    if (content === undefined) continue;
    visited.add(current.path);
    output.push({ path: current.path, content });

    if (current.depth >= 4 || !CODE_EXTENSION.test(current.path)) continue;
    for (const spec of importSpecifiers(content)) {
      const resolved = resolveLocalImport(current.path, spec, files);
      if (resolved && !visited.has(resolved)) queue.push({ path: resolved, depth: current.depth + 1 });
    }
  }

  return output;
}

function stem(path: string): string {
  return path.replace(/\.[^.]+$/, '');
}

export async function importPrivateComponentFiles(files: FileList | File[]): Promise<PrivateImportResult> {
  const selected = Array.from(files).slice(0, MAX_FILES);
  const loaded: Array<{ path: string; content: string }> = [];
  const skipped: string[] = [];
  let total = 0;

  for (const file of selected) {
    const path = safeFileName(file);
    if (!path) {
      skipped.push(file.name || 'unnamed file');
      continue;
    }
    const content = await file.text();
    if (content.length > MAX_FILE_CHARS || total + content.length > MAX_TOTAL_CHARS) {
      skipped.push(path);
      continue;
    }
    total += content.length;
    loaded.push({ path, content });
  }

  const fileMap = new Map(loaded.map((entry) => [entry.path, entry.content]));
  const styles = new Map(
    loaded.filter((entry) => STYLE_EXTENSION.test(entry.path)).map((entry) => [stem(entry.path), entry.content]),
  );

  const items = loaded
    .filter((entry) => CODE_EXTENSION.test(entry.path) && !NON_COMPONENT_FILE.test(entry.path))
    .map((entry, index): UIComponentRecord => {
      const bundle = collectLocalBundle(entry.path, fileMap);
      const dependencies = normalizeNpmDependencyNames(bundle.flatMap((file) => npmImports(file.content)));
      const category = inferCategory(entry.path);
      const bundledStyles = bundle.filter((file) => STYLE_EXTENSION.test(file.path)).map((file) => file.content);
      const matchingStyle = styles.get(stem(entry.path));
      const styleText = Array.from(new Set([...(matchingStyle ? [matchingStyle] : []), ...bundledStyles])).join('\n\n');
      const bundledCode = bundle.map((file) => `// Private file: ${file.path}\n${file.content}`).join('\n\n');
      return {
        id: `private-session:${index}:${entry.path}`,
        name: displayName(entry.path),
        description: `Private session component imported from ${entry.path}. Source stays in this browser session and is not added to Tayar's public registry.`,
        category,
        kind: 'component',
        tags: Array.from(new Set(['private', 'local', category, ...dependencies])).slice(0, 8),
        sourceId: 'private-session',
        sourcePath: entry.path,
        license: 'restricted',
        dependencies,
        dependencyRequirements: dependencies,
        ...(styleText ? { registryStyles: { css: styleText.slice(0, 300_000) } } : {}),
        code: bundledCode,
        preview: category === 'hero' ? 'hero'
          : category === 'navigation' ? 'nav'
          : category === 'pricing' ? 'pricing'
          : category === 'authentication' || category === 'forms' ? 'auth'
          : category === 'dashboard' ? 'dashboard'
          : category === 'data' ? 'stats'
          : category === 'ai' ? 'chat'
          : category === 'cta' ? 'cta'
          : 'generic',
        aiPrompt: 'Adapt this privately imported component to the active project. Treat the source as user-provided licensed material, keep it private, preserve accessibility/responsiveness, and show a diff before any project changes.',
      };
    });

  return { items, skipped };
}

export function isAnimatedComponent(item: UIComponentRecord): boolean {
  if (item.sourceId === 'motion-primitives' || item.sourceId === 'animata' || item.sourceId === 'animmaster-lib') return true;
  if (item.dependencies.some((dependency) => ['motion', 'framer-motion', 'gsap', '@react-spring/web'].includes(dependency))) return true;
  return /animat|motion|parallax|scroll|marquee|beam|particle|shader|3d|hover|transition/i.test(
    [item.name, item.description, ...item.tags].join(' '),
  );
}
