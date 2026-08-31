export interface PublishedSiteStorageEntry {
  id?: string | null;
  name: string;
}

export interface PublishedSiteStorageError {
  message?: string;
}

export interface PublishedSiteStorageBucket {
  list(
    path: string,
    options: {
      limit: number;
      offset: number;
      sortBy: { column: string; order: 'asc' | 'desc' };
    },
  ): PromiseLike<{
    data: Array<{ id?: string | null; name?: string | null }> | null;
    error: PublishedSiteStorageError | null;
  }>;
  remove(paths: string[]): PromiseLike<{
    error: PublishedSiteStorageError | null;
  }>;
}

export interface PublishedSiteListOptions {
  pageSize?: number;
  maxEntries?: number;
}

function boundedPositive(value: number | undefined, fallback: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(maximum, Math.floor(parsed)));
}

export async function listAllPublishedSiteFiles(
  bucket: PublishedSiteStorageBucket,
  folder: string,
  options: PublishedSiteListOptions = {},
): Promise<PublishedSiteStorageEntry[]> {
  const pageSize = boundedPositive(options.pageSize, 100, 1000);
  const maxEntries = boundedPositive(options.maxEntries, 5000, 50000);
  const entries: PublishedSiteStorageEntry[] = [];

  for (let offset = 0; offset < maxEntries; offset += pageSize) {
    const { data, error } = await bucket.list(folder, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) throw new Error(error.message || 'Published-site storage list failed.');

    const batch = data || [];
    entries.push(
      ...batch
        .filter((item): item is { id?: string | null; name: string } => typeof item.name === 'string' && item.name.length > 0)
        .map((item) => ({ id: item.id, name: item.name })),
    );

    if (batch.length < pageSize) return entries;
  }

  throw new Error('Published-site folder contains too many files to process safely.');
}

export function publishedSiteFilePaths(
  folder: string,
  entries: PublishedSiteStorageEntry[],
  keepNames?: ReadonlySet<string>,
): string[] {
  return entries
    .filter((item) => Boolean(item.id) && Boolean(item.name) && !keepNames?.has(item.name))
    .map((item) => `${folder}/${item.name}`);
}

export async function removePublishedSiteFiles(
  bucket: PublishedSiteStorageBucket,
  paths: string[],
): Promise<void> {
  if (!paths.length) return;
  const { error } = await bucket.remove(paths);
  if (error) throw new Error(error.message || 'Published-site storage cleanup failed.');
}
