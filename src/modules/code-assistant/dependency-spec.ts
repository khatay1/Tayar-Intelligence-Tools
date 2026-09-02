export interface NpmDependencyRequirement {
  raw: string;
  name: string;
  spec: string | null;
}

const NPM_NAME = /^(?:@[a-z0-9._-]+\/[a-z0-9._-]+|[a-z0-9._-]+)$/i;

export function parseNpmDependencyRequirement(value: string): NpmDependencyRequirement | null {
  const raw = value.trim();
  if (!raw || raw.length > 220 || /\s/.test(raw)) return null;

  let name = raw;
  let spec: string | null = null;

  if (raw.startsWith('@')) {
    const slash = raw.indexOf('/');
    if (slash <= 1) return null;
    const versionAt = raw.indexOf('@', slash + 1);
    if (versionAt > slash + 1) {
      name = raw.slice(0, versionAt);
      spec = raw.slice(versionAt + 1) || null;
    }
  } else {
    const versionAt = raw.lastIndexOf('@');
    if (versionAt > 0) {
      name = raw.slice(0, versionAt);
      spec = raw.slice(versionAt + 1) || null;
    }
  }

  if (!NPM_NAME.test(name)) return null;
  return { raw, name, spec };
}

export function normalizeNpmDependencyNames(values: string[]): string[] {
  return Array.from(new Set(
    values
      .map(parseNpmDependencyRequirement)
      .filter((entry): entry is NpmDependencyRequirement => Boolean(entry))
      .map((entry) => entry.name),
  ));
}

export function mergeNpmDependencyRequirements(values: string[]): string[] {
  const byName = new Map<string, NpmDependencyRequirement>();
  for (const value of values) {
    const parsed = parseNpmDependencyRequirement(value);
    if (!parsed) continue;
    const current = byName.get(parsed.name);
    if (!current || (!current.spec && parsed.spec)) byName.set(parsed.name, parsed);
  }
  return Array.from(byName.values()).map((entry) => entry.spec ? `${entry.name}@${entry.spec}` : entry.name);
}

export function installTargetForName(requirements: string[], name: string): string {
  const matching = requirements
    .map(parseNpmDependencyRequirement)
    .find((entry) => entry?.name === name);
  return matching?.raw || name;
}

export function buildDependencyInstallCommand(
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun',
  requirements: string[],
  missingNames: string[],
): string {
  const targets = Array.from(new Set(missingNames))
    .map((name) => installTargetForName(requirements, name))
    .filter(Boolean);
  if (!targets.length) return '';
  const prefix =
    packageManager === 'pnpm' ? 'pnpm add'
    : packageManager === 'yarn' ? 'yarn add'
    : packageManager === 'bun' ? 'bun add'
    : 'npm install';
  return `${prefix} ${targets.join(' ')}`;
}
