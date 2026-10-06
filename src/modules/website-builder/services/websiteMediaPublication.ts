import { websiteMediaPath, websiteMediaTokens } from '@/lib/website-media-reference';

interface MediaStorage {
  from(bucket: string): {
    download(path: string): PromiseLike<{ data: Blob | null; error: unknown }>;
    upload(path: string, body: Blob, options: { upsert: boolean; contentType: string; cacheControl: string }): PromiseLike<{ error: unknown }>;
    getPublicUrl(path: string): { data: { publicUrl: string } };
  };
}

/** Resolve only Tayar media references. Private bytes are read through the
 * current caller's storage RLS; never fetch visitor-controlled external URLs.
 * Publication copies are immutable by content hash and independent of drafts. */
export async function materializeWebsiteMedia<T extends { content: string }>(
  files: T[], storage: MediaStorage, mode: 'publish' | 'inline',
): Promise<T[]> {
  const replacements = new Map<string, string>();
  const paths = new Map<string, string>();
  const tokens = [...new Set(files.flatMap(file => websiteMediaTokens(file.content)))];
  if (tokens.length > 1000) throw new Error('Too many media references.');
  let totalBytes = 0;
  for (const token of tokens) {
    const path = websiteMediaPath(token)!;
    if (paths.has(path)) { replacements.set(token, paths.get(path)!); continue; }
    const { data, error } = await storage.from('website-media').download(path);
    if (error || !data) throw new Error('Could not read private website media.');
    if (data.size > 5 * 1024 * 1024 || totalBytes + data.size > 50 * 1024 * 1024) throw new Error('Website media is too large.');
    if (!/^image\/(?:png|jpeg|webp|gif|avif|svg\+xml)$/i.test(data.type)) throw new Error('Unsupported website media.');
    totalBytes += data.size;
    const bytes = new Uint8Array(await data.arrayBuffer());
    let result: string;
    if (mode === 'inline') {
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      result = `data:${data.type};base64,${btoa(binary)}`;
    } else {
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
      const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg' }[data.type.toLowerCase()];
      const destination = `${path.split('/')[0]}/${digest}.${extension}`;
      const published = storage.from('website-published-media');
      const upload = await published.upload(destination, data, { upsert: true, contentType: data.type, cacheControl: '31536000' });
      if (upload.error) throw new Error('Could not publish website media.');
      result = published.getPublicUrl(destination).data.publicUrl;
      if (!result) throw new Error('Published media URL is unavailable.');
    }
    paths.set(path, result); replacements.set(token, result);
  }
  return files.map(file => {
    let content = file.content;
    for (const [token, result] of replacements) content = content.split(token).join(result);
    return { ...file, content };
  });
}
