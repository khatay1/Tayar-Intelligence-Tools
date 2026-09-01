import { normalizeNpmDependencyNames } from './dependency-spec';
import { UIComponentCategory, UIComponentRecord } from './types';

const MAX_FILES = 80;
const MAX_FILE_CHARS = 250_000;
const MAX_TOTAL_CHARS = 2_000_000;
const CODE_EXTENSION = /\.(?:[cm]?[jt]sx?)$/i;
const STYLE_EXTENSION = /\.(?:css|scss|sass|less)$/i;
const ALLOWED_EXTENSION = /\.(?:[cm]?[jt]sx?|css|scss|sass|less)$/i;
const FORBIDDEN_NAME = /(?:^|\/)(?:\.env(?:\.|$)|package-lock\.json$|pnpm-lock\.yaml$|yarn\.lock$|bun\.lockb?$|.*secret.*|.*credential.*)/i;

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

function npmImports(source: string): string[] {
  const values: string[] = [];
  const pattern = /(?:from\s+|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) {
    const spec = match[1]?.trim();
    if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@/') || spec.startsWith('#')) continue;
    const name = spec.startsWith('@')
      ? spec.split('/').slice(0, 2).join('/')
      : spec.split('/')[0];
    if (name && !['react', 'react-dom'].includes(name)) values.push(name);
  }
  return normalizeNpmDependencyNames(values);
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

  const styles = new Map(
    loaded.filter((entry) => STYLE_EXTENSION.test(entry.path)).map((entry) => [stem(entry.path), entry.content]),
  );

  const items = loaded
    .filter((entry) => CODE_EXTENSION.test(entry.path))
    .map((entry, index): UIComponentRecord => {
      const dependencies = npmImports(entry.content);
      const category = inferCategory(entry.path);
      const matchingStyle = styles.get(stem(entry.path));
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
        ...(matchingStyle ? { registryStyles: { css: matchingStyle } } : {}),
        code: `// Private user-provided source: ${entry.path}\n${entry.content}`,
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
