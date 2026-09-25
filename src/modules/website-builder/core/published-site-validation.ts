export interface PublishedWebsiteBundleFile {
  name: string;
  content: string;
  contentType: string;
}

export function isValidPublishedHtml(content: unknown): boolean {
  if (typeof content !== 'string') return false;
  const prefix = content.trimStart().slice(0, 4096);
  return /^(?:<!doctype\s+html\b[^>]*>\s*)?<html\b/i.test(prefix);
}

export function assertValidPublishedWebsiteBundle(
  files: PublishedWebsiteBundleFile[],
): void {
  if (!Array.isArray(files) || !files.length) {
    throw new Error('Published website bundle is empty.');
  }

  const indexFile = files.find((file) => file.name === 'index.html');
  if (!indexFile) {
    throw new Error('Published website bundle is missing index.html.');
  }

  if (!/^text\/html(?:;|$)/i.test(indexFile.contentType.trim())) {
    throw new Error('Published index.html must use a text/html content type.');
  }

  if (!isValidPublishedHtml(indexFile.content)) {
    throw new Error('Published index.html is not a valid HTML document.');
  }

  assertValidPublishedWebsiteFileNames(files.map((file) => file.name));
}

export function assertValidPublishedWebsiteFileNames(names: unknown[]): void {
  if (!Array.isArray(names) || !names.includes('index.html') || names.length > 250) {
    throw new Error('Published website file list is missing index.html or exceeds its limit.');
  }
  const duplicateNames = new Set<string>();
  const seenNames = new Set<string>();
  for (const candidate of names) {
    const name = typeof candidate === 'string' ? candidate : '';
    const segments = name.split('/');
    if (
      !name ||
      name !== name.trim() ||
      name.startsWith('/') ||
      name.includes('\\') ||
      /^(?:versions|previews|staging)(?:\/|$)/i.test(name) ||
      segments.some((segment) => !segment || segment === '.' || segment === '..')
    ) {
      throw new Error('Published website bundle contains an invalid file path.');
    }
    if (seenNames.has(name)) duplicateNames.add(name);
    seenNames.add(name);
  }

  if (duplicateNames.size) {
    throw new Error(
      'Published website bundle contains duplicate files: ' +
      [...duplicateNames].join(', '),
    );
  }
}
