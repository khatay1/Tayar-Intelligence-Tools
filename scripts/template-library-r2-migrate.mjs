import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const PREFIX = '24billions/';
const PAGE_SIZE = 1000;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const DEFAULT_CONCURRENCY = 3;
const EXPECTED_OBJECTS = 6124;
const EXPECTED_BYTES = 4232081544;
const STATE_FILE = '.r2-migration-state.json';
const ALLOWED_HOSTS = new Set([
  '24billions.com',
  'www.24billions.com',
  'drive.google.com',
  'docs.google.com',
  'drive.usercontent.google.com',
  'lh3.googleusercontent.com',
]);

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function assertStoragePath(value) {
  const path = String(value || '').trim();
  const unsafeSegment = path.split('/').some(segment => segment === '.' || segment === '..');
  if (!path.startsWith(PREFIX) || unsafeSegment || path.includes('\\')) {
    throw new Error(`Unsafe storage path: ${path || '(empty)'}`);
  }
  return path;
}

function assertAllowedUrl(value) {
  const parsed = new URL(String(value || ''));
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(`Source URL host is not allowlisted: ${parsed.hostname}`);
  }
  return parsed.toString();
}

function normalizeGoogleDriveUrl(value) {
  const parsed = new URL(value);
  if (!['drive.google.com', 'docs.google.com'].includes(parsed.hostname.toLowerCase())) return value;

  const fileId = parsed.searchParams.get('id')
    || parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1]
    || '';
  if (!/^[a-zA-Z0-9_-]{10,200}$/.test(fileId)) return value;

  const direct = new URL('https://drive.usercontent.google.com/download');
  direct.searchParams.set('id', fileId);
  direct.searchParams.set('export', 'download');
  direct.searchParams.set('confirm', 't');
  return direct.toString();
}

async function fetchSource(sourceUrl) {
  let current = normalizeGoogleDriveUrl(assertAllowedUrl(sourceUrl));

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    current = assertAllowedUrl(current);
    const response = await fetch(current, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Tayar-R2-Migrator/1.0', Accept: '*/*' },
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Source returned a redirect without a location.');
      current = new URL(location, current).toString();
      continue;
    }

    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
    const announcedSize = Number(response.headers.get('content-length') || 0);
    if (announcedSize > MAX_FILE_BYTES) throw new Error('Source exceeds the 50 MB object limit.');

    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_FILE_BYTES) {
      throw new Error('Downloaded source is empty or exceeds the 50 MB object limit.');
    }

    const contentType = (response.headers.get('content-type') || 'application/octet-stream')
      .split(';')[0]
      .trim();
    if (contentType === 'text/html' || contentType === 'application/xhtml+xml') {
      throw new Error('Source returned HTML instead of a template binary.');
    }
    return { bytes, contentType, finalUrl: current };
  }

  throw new Error('Source exceeded the redirect limit.');
}

async function loadManifest(supabaseUrl, serviceKey) {
  const rows = [];
  const headers = { apikey: serviceKey };
  if (serviceKey.startsWith('eyJ')) headers.Authorization = `Bearer ${serviceKey}`;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = new URL('/rest/v1/template_assets', supabaseUrl);
    url.searchParams.set('select', 'id,storage_path,source_download_url,file_size_bytes,sha256,mime_type,format,metadata');
    url.searchParams.set('storage_path', `like.${PREFIX}*`);
    url.searchParams.set('order', 'storage_path.asc,id.asc');
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('offset', String(offset));

    const response = await fetch(url, {
      headers,
    });
    if (!response.ok) throw new Error(`Could not read template manifest: HTTP ${response.status}`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error('Supabase returned an invalid manifest response.');
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function groupManifest(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const path = assertStoragePath(row.storage_path);
    const entry = grouped.get(path) || {
      path,
      size: Number(row.file_size_bytes) || 0,
      sha256: String(row.sha256 || '').toLowerCase(),
      mimeType: String(row.mime_type || 'application/octet-stream'),
      format: String(row.format || '').toLowerCase(),
      sources: [],
    };
    const candidates = [row.metadata?.final_source_url, row.source_download_url];
    for (const candidate of candidates) {
      if (candidate && !entry.sources.includes(candidate)) entry.sources.push(candidate);
    }
    grouped.set(path, entry);
  }
  return [...grouped.values()];
}

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : { completed: {} };
  } catch {
    return { completed: {} };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function isImage(entry) {
  return entry.format === 'png' || entry.format === 'jpg' || entry.format === 'jpeg';
}

async function r2ObjectMatches(client, bucket, entry) {
  try {
    const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: entry.path }));
    return Number(result.ContentLength) === entry.size
      && String(result.Metadata?.sha256 || '').toLowerCase() === entry.sha256;
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') return false;
    throw error;
  }
}

async function migrateOne(client, bucket, entry) {
  if (!/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Manifest SHA-256 is missing or invalid.');
  if (await r2ObjectMatches(client, bucket, entry)) return 'existing';

  const failures = [];
  for (const source of entry.sources) {
    try {
      const downloaded = await fetchSource(source);
      const actualHash = sha256(downloaded.bytes);
      if (actualHash !== entry.sha256) throw new Error(`SHA-256 mismatch (${actualHash}).`);
      if (entry.size && downloaded.bytes.length !== entry.size) {
        throw new Error(`Size mismatch (${downloaded.bytes.length} != ${entry.size}).`);
      }

      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: entry.path,
        Body: downloaded.bytes,
        ContentLength: downloaded.bytes.length,
        ContentType: entry.mimeType || downloaded.contentType,
        ContentDisposition: isImage(entry) ? 'inline' : 'attachment',
        CacheControl: 'public, max-age=31536000, immutable',
        Metadata: { sha256: actualHash, source: '24billions' },
      }));

      if (!await r2ObjectMatches(client, bucket, entry)) {
        throw new Error('R2 HEAD verification failed after upload.');
      }
      return 'uploaded';
    } catch (error) {
      failures.push(`${source}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(failures.join(' | ') || 'No source URL is available.');
}

async function main() {
  const execute = process.argv.includes('--execute');
  const limitArg = process.argv.find(value => value.startsWith('--limit='));
  const limit = limitArg ? positiveInteger(limitArg.split('=')[1], Infinity) : Infinity;
  const supabaseUrl = required('SUPABASE_URL');
  const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
  const manifest = groupManifest(await loadManifest(supabaseUrl, serviceKey));
  const totalBytes = manifest.reduce((sum, entry) => sum + entry.size, 0);

  console.log(`Plan: ${manifest.length.toLocaleString()} unique objects, ${totalBytes.toLocaleString()} bytes.`);
  if (manifest.length !== EXPECTED_OBJECTS || totalBytes !== EXPECTED_BYTES) {
    throw new Error(
      `Manifest changed; expected ${EXPECTED_OBJECTS} objects and ${EXPECTED_BYTES} bytes. Re-audit before continuing.`,
    );
  }
  if (!execute) {
    console.log('Target: Cloudflare R2; exact bucket is read only in execute mode.');
    console.log('Dry run only. Add --execute to download from original sources and upload to R2.');
    return;
  }

  const accountId = required('R2_ACCOUNT_ID');
  const accessKeyId = required('R2_ACCESS_KEY_ID');
  const secretAccessKey = required('R2_SECRET_ACCESS_KEY');
  const bucket = required('R2_BUCKET_NAME');
  console.log(`Target: R2 bucket ${bucket}; prefix ${PREFIX}`);

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  const state = loadState();
  state.completed ||= {};
  const queue = manifest
    .slice(0, limit);
  const concurrency = Math.min(10, positiveInteger(process.env.R2_MIGRATION_CONCURRENCY, DEFAULT_CONCURRENCY));
  let cursor = 0;
  let uploaded = 0;
  let existing = 0;
  const failures = [];

  async function worker() {
    while (cursor < queue.length) {
      const index = cursor++;
      const entry = queue[index];
      try {
        const result = await migrateOne(client, bucket, entry);
        if (result === 'uploaded') uploaded += 1;
        else existing += 1;
        state.completed[entry.path] = entry.sha256;
        saveState(state);
        console.log(`[${index + 1}/${queue.length}] ${result}: ${entry.path}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ path: entry.path, error: message });
        console.error(`[${index + 1}/${queue.length}] failed: ${entry.path}: ${message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, () => worker()));
  console.log(`Completed: uploaded=${uploaded}, existing=${existing}, failed=${failures.length}.`);
  if (failures.length) {
    console.error(JSON.stringify(failures, null, 2));
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
