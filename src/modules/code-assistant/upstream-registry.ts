import { getRegistrySource, isRedistributableSource } from './source-catalog';
import { UIComponentCategory, UIComponentRecord } from './types';

interface UpstreamRegistryConfig {
  sourceId: string;
  revision: string;
  manifestUrl: string;
  rawBaseUrl: string;
  sourcePathPrefix: string;
  licensePath: string;
}

interface RawRegistryFile {
  path?: unknown;
  type?: unknown;
}

interface RawRegistryItem {
  name?: unknown;
  title?: unknown;
  description?: unknown;
  type?: unknown;
  dependencies?: unknown;
  registryDependencies?: unknown;
  files?: unknown;
}

interface RawRegistry {
  items?: unknown;
}

export interface UpstreamLoadResult {
  items: UIComponentRecord[];
  errors: string[];
}

const MAX_MANIFEST_BYTES = 5_000_000;
const MAX_COMPONENT_FILES = 64;
const MAX_COMPONENT_CODE_BYTES = 2_000_000;

export const UPSTREAM_REGISTRIES: UpstreamRegistryConfig[] = [
  {
    sourceId: 'shadcn',
    revision: '8a1b5386010e1a4a50367fff39ee3216bf6f01b2',
    manifestUrl: 'https://raw.githubusercontent.com/shadcn-ui/ui/8a1b5386010e1a4a50367fff39ee3216bf6f01b2/apps/v4/registry.json',
    rawBaseUrl: 'https://raw.githubusercontent.com/shadcn-ui/ui/8a1b5386010e1a4a50367fff39ee3216bf6f01b2',
    sourcePathPrefix: 'apps/v4/',
    licensePath: 'LICENSE.md',
  },
  {
    sourceId: 'kokonut-ui',
    revision: '83eec6d982d400a18438001a8efdbac1f159dd43',
    manifestUrl: 'https://raw.githubusercontent.com/kokonut-labs/kokonutui/83eec6d982d400a18438001a8efdbac1f159dd43/registry.json',
    rawBaseUrl: 'https://raw.githubusercontent.com/kokonut-labs/kokonutui/83eec6d982d400a18438001a8efdbac1f159dd43',
    sourcePathPrefix: '',
    licensePath: 'LICENSE',
  },
  {
    sourceId: 'magic-ui',
    revision: '2d671cc6c0e0f40e28682c9cbddd16694dcfe627',
    manifestUrl: 'https://raw.githubusercontent.com/magicuidesign/magicui/2d671cc6c0e0f40e28682c9cbddd16694dcfe627/apps/www/public/registry.json',
    rawBaseUrl: 'https://raw.githubusercontent.com/magicuidesign/magicui/2d671cc6c0e0f40e28682c9cbddd16694dcfe627',
    sourcePathPrefix: 'apps/www/',
    licensePath: 'LICENSE.md',
  },
  {
    sourceId: 'cult-ui',
    revision: '3b855612fb524cb042cc91b65f0cd575057471cc',
    manifestUrl: 'https://raw.githubusercontent.com/nolly-studio/cult-ui/3b855612fb524cb042cc91b65f0cd575057471cc/apps/www/public/registry/index.json',
    rawBaseUrl: 'https://raw.githubusercontent.com/nolly-studio/cult-ui/3b855612fb524cb042cc91b65f0cd575057471cc',
    sourcePathPrefix: 'apps/www/',
    licensePath: 'LICENSE.md',
  },
  {
    sourceId: '8bitcn',
    revision: '898caa5932590ab8ff70f54e3c9aff5b5baa523c',
    manifestUrl: 'https://raw.githubusercontent.com/TheOrcDev/8bitcn-ui/898caa5932590ab8ff70f54e3c9aff5b5baa523c/registry.json',
    rawBaseUrl: 'https://raw.githubusercontent.com/TheOrcDev/8bitcn-ui/898caa5932590ab8ff70f54e3c9aff5b5baa523c',
    sourcePathPrefix: '',
    licensePath: 'license.md',
  },
  {
    sourceId: 'eldora-ui',
    revision: '2ef4f1eb4f4a6dea6fc2bdd4d87b6a3f2ff65321',
    manifestUrl: 'https://raw.githubusercontent.com/karthikmudunuri/eldoraui/2ef4f1eb4f4a6dea6fc2bdd4d87b6a3f2ff65321/apps/www/public/registry.json',
    rawBaseUrl: 'https://raw.githubusercontent.com/karthikmudunuri/eldoraui/2ef4f1eb4f4a6dea6fc2bdd4d87b6a3f2ff65321',
    sourcePathPrefix: 'apps/www/',
    licensePath: 'LICENSE.md',
  },
  {
    sourceId: 'ui-layouts',
    revision: '88d827d7ec342917ca06f6894e5add65fabbe5d8',
    manifestUrl: 'https://raw.githubusercontent.com/ui-layouts/uilayouts/88d827d7ec342917ca06f6894e5add65fabbe5d8/apps/ui-layout/registry.json',
    rawBaseUrl: 'https://raw.githubusercontent.com/ui-layouts/uilayouts/88d827d7ec342917ca06f6894e5add65fabbe5d8',
    sourcePathPrefix: 'apps/ui-layout/',
    licensePath: 'LICENSE',
  },
  {
    sourceId: 'spectrum-ui',
    revision: '3f52ca5c7dbc8d0114a49960280a05c716664ed1',
    manifestUrl: 'https://raw.githubusercontent.com/arihantcodes/spectrum-ui/3f52ca5c7dbc8d0114a49960280a05c716664ed1/registry.json',
    rawBaseUrl: 'https://raw.githubusercontent.com/arihantcodes/spectrum-ui/3f52ca5c7dbc8d0114a49960280a05c716664ed1',
    sourcePathPrefix: '',
    licensePath: 'LICENSE',
  },
  {
    sourceId: 'shadcn-space',
    revision: '6cbc9245562238a03d84f1e914e35942c800eb24',
    manifestUrl: 'https://raw.githubusercontent.com/shadcnspace/shadcnspace/6cbc9245562238a03d84f1e914e35942c800eb24/registry.json',
    rawBaseUrl: 'https://raw.githubusercontent.com/shadcnspace/shadcnspace/6cbc9245562238a03d84f1e914e35942c800eb24',
    sourcePathPrefix: '',
    licensePath: 'LICENSE',
  },
];

const codeCache = new Map<string, Promise<string>>();
const licenseCache = new Map<string, Promise<string>>();

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter(Boolean);
}

function normalizePath(path: string): string {
  return path.trim().replace(/^\.\/+/, '');
}

function safePath(path: string): boolean {
  const normalized = normalizePath(path);
  if (!normalized || normalized.length > 260 || normalized.startsWith('/') || normalized.includes('\\') || normalized.includes('?') || normalized.includes('#')) return false;
  return normalized.split('/').every((part) => part && part !== '.' && part !== '..');
}

function rawUrl(config: UpstreamRegistryConfig, path: string): string {
  const fullPath = `${config.sourcePathPrefix}${normalizePath(path)}`;
  if (!safePath(fullPath)) throw new Error('Unsafe upstream file path.');
  const encodedPath = fullPath.split('/').map(encodeURIComponent).join('/');
  return `${config.rawBaseUrl}/${encodedPath}`;
}

async function fetchText(url: string, maxBytes: number): Promise<string> {
  if (!url.startsWith('https://raw.githubusercontent.com/')) {
    throw new Error('Only approved raw GitHub sources are allowed.');
  }
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Upstream request failed with HTTP ${response.status}.`);
    const text = await response.text();
    if (text.length > maxBytes) throw new Error('Upstream payload exceeded the safe size limit.');
    return text;
  } finally {
    window.clearTimeout(timer);
  }
}

function inferCategory(name: string, description: string): UIComponentCategory {
  const haystack = `${name} ${description}`.toLowerCase();
  if (/hero|landing intro|banner hero/.test(haystack)) return 'hero';
  if (/nav|navbar|navigation|menu|sidebar|header|breadcrumb/.test(haystack)) return 'navigation';
  if (/pricing|price|subscription plan/.test(haystack)) return 'pricing';
  if (/login|sign.?in|sign.?up|auth|password|otp/.test(haystack)) return 'authentication';
  if (/chat|prompt|assistant|artificial intelligence|\bai\b/.test(haystack)) return 'ai';
  if (/form|input|textarea|select|picker|checkbox|radio|upload/.test(haystack)) return 'forms';
  if (/dashboard|admin|overview/.test(haystack)) return 'dashboard';
  if (/chart|graph|metric|stat|table|data/.test(haystack)) return 'data';
  if (/cta|call.?to.?action/.test(haystack)) return 'cta';
  return 'cards';
}

function previewFor(category: UIComponentCategory): UIComponentRecord['preview'] {
  if (category === 'hero') return 'hero';
  if (category === 'navigation') return 'nav';
  if (category === 'pricing') return 'pricing';
  if (category === 'authentication' || category === 'forms') return 'auth';
  if (category === 'dashboard') return 'dashboard';
  if (category === 'data') return 'stats';
  if (category === 'ai') return 'chat';
  if (category === 'cta') return 'cta';
  return 'generic';
}

function normalizeItem(config: UpstreamRegistryConfig, raw: RawRegistryItem): UIComponentRecord | null {
  const name = asString(raw.name);
  const title = asString(raw.title) || name;
  const description = asString(raw.description) || `${title} component`;
  const type = asString(raw.type);
  if (!name || !['registry:component', 'registry:ui', 'registry:block'].includes(type)) return null;

  const files = Array.isArray(raw.files)
    ? raw.files
        .map((file) => normalizePath(asString((file as RawRegistryFile)?.path)))
        .filter((path) => safePath(path))
    : [];
  if (!files.length || files.length > MAX_COMPONENT_FILES) return null;

  const source = getRegistrySource(config.sourceId);
  if (!source || !isRedistributableSource(config.sourceId)) return null;

  const category = inferCategory(name, description);
  const dependencies = stringArray(raw.dependencies);
  const registryDependencies = stringArray(raw.registryDependencies);

  return {
    id: `${config.sourceId}:${name}`,
    name: title,
    description,
    category,
    kind: type === 'registry:block' ? 'block' : 'component',
    tags: Array.from(new Set([name, category, ...dependencies.slice(0, 4)])).slice(0, 7),
    sourceId: config.sourceId,
    sourcePath: files[0],
    license: source.license,
    dependencies,
    code: '',
    remote: {
      sourceId: config.sourceId,
      revision: config.revision,
      files,
      registryDependencies,
    },
    preview: previewFor(category),
    aiPrompt: `Adapt "${title}" to the existing project. Reuse project primitives, tokens, routing and data services. Preserve accessibility and responsive behavior. Install only required dependencies, do not replace working business logic, and show a diff before applying changes.`,
  };
}

async function loadRegistry(config: UpstreamRegistryConfig): Promise<UIComponentRecord[]> {
  if (!isRedistributableSource(config.sourceId)) {
    throw new Error(`Source "${config.sourceId}" is not approved for redistribution.`);
  }
  const text = await fetchText(config.manifestUrl, MAX_MANIFEST_BYTES);
  const parsed = JSON.parse(text) as RawRegistry;
  if (!Array.isArray(parsed.items)) throw new Error('Registry manifest does not contain an items array.');

  const unique = new Map<string, UIComponentRecord>();
  for (const raw of parsed.items.slice(0, 5000)) {
    if (!raw || typeof raw !== 'object') continue;
    const item = normalizeItem(config, raw as RawRegistryItem);
    if (item && !unique.has(item.id)) unique.set(item.id, item);
  }
  return Array.from(unique.values());
}

export async function loadUpstreamComponents(): Promise<UpstreamLoadResult> {
  const settled = await Promise.allSettled(UPSTREAM_REGISTRIES.map(loadRegistry));
  const items: UIComponentRecord[] = [];
  const errors: string[] = [];

  settled.forEach((result, index) => {
    const sourceId = UPSTREAM_REGISTRIES[index].sourceId;
    if (result.status === 'fulfilled') items.push(...result.value);
    else errors.push(`${sourceId}: ${result.reason instanceof Error ? result.reason.message : 'Unable to load registry.'}`);
  });

  return { items, errors };
}

async function loadLicense(config: UpstreamRegistryConfig): Promise<string> {
  const existing = licenseCache.get(config.sourceId);
  if (existing) return existing;
  const request = fetchText(rawUrl({ ...config, sourcePathPrefix: '' }, config.licensePath), 100_000);
  licenseCache.set(config.sourceId, request);
  return request;
}

export async function loadUpstreamComponentCode(record: UIComponentRecord): Promise<string> {
  const remote = record.remote;
  if (!remote) return record.code;
  const cached = codeCache.get(record.id);
  if (cached) return cached;

  const request = (async () => {
    const config = UPSTREAM_REGISTRIES.find((entry) => entry.sourceId === remote.sourceId);
    if (!config || !isRedistributableSource(config.sourceId)) {
      throw new Error('Component source is not approved.');
    }

    const license = await loadLicense(config);
    let total = 0;
    const chunks: string[] = [];

    for (const file of remote.files) {
      const content = await fetchText(rawUrl(config, file), MAX_COMPONENT_CODE_BYTES);
      total += content.length;
      if (total > MAX_COMPONENT_CODE_BYTES) throw new Error('Component source exceeded the safe combined size limit.');
      chunks.push(`// File: ${file}\n${content}`);
    }

    const safeLicense = license.replace(/\*\//g, '* /');
    const source = getRegistrySource(config.sourceId);
    const notice = `/*\nThird-party source: ${source?.repository || config.sourceId}\nLicense preserved from upstream:\n\n${safeLicense}\n*/`;

    return [notice, ...chunks].join('\n\n');
  })();

  codeCache.set(record.id, request);
  try {
    return await request;
  } catch (error) {
    codeCache.delete(record.id);
    throw error;
  }
}
