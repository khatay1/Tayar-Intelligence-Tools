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

  const duplicateNames = new Set<string>();
  const seenNames = new Set<string>();
  for (const file of files) {
    const name = String(file.name || '').trim();
    if (!name || name.startsWith('/') || name.includes('..')) {
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
