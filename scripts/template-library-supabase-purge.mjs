import { createClient } from '@supabase/supabase-js';

const BUCKET = 'template-library';
const PREFIX = '24billions';
const EXPECTED_PROJECT_REF = 'pnbllxdlskljcakyaylt';
const EXPECTED_OBJECTS = 6124;
const EXPECTED_BYTES = 4232081544;
const CONFIRMATION = `DELETE-24BILLIONS-${EXPECTED_OBJECTS}`;
const PAGE_SIZE = 1000;
const DELETE_BATCH_SIZE = 500;

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function assertProject(urlValue) {
  const parsed = new URL(urlValue);
  const ref = parsed.hostname.split('.')[0];
  if (parsed.protocol !== 'https:' || ref !== EXPECTED_PROJECT_REF) {
    throw new Error(`Refusing project ${ref || '(unknown)'}; expected ${EXPECTED_PROJECT_REF}.`);
  }
}

async function inventory(client) {
  const files = [];
  const directories = [PREFIX];

  while (directories.length) {
    const directory = directories.shift();
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await client.storage.from(BUCKET).list(directory, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw error;
      const entries = Array.isArray(data) ? data : [];
      for (const entry of entries) {
        const path = `${directory}/${entry.name}`;
        if (entry.metadata) files.push({ path, size: Number(entry.metadata.size) || 0 });
        else directories.push(path);
      }
      if (entries.length < PAGE_SIZE) break;
    }
  }
  return files;
}

async function main() {
  const execute = process.argv.includes('--execute');
  const confirmation = process.argv.find(value => value.startsWith('--confirm='))?.slice(10) || '';
  const supabaseUrl = required('SUPABASE_URL');
  const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
  assertProject(supabaseUrl);

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const files = await inventory(client);
  const bytes = files.reduce((sum, file) => sum + file.size, 0);
  console.log(`Target: ${EXPECTED_PROJECT_REF}/${BUCKET}/${PREFIX}/`);
  console.log(`Inventory: ${files.length.toLocaleString()} objects, ${bytes.toLocaleString()} bytes.`);

  if (files.length !== EXPECTED_OBJECTS || bytes !== EXPECTED_BYTES) {
    throw new Error(
      `Inventory changed; refusing deletion. Expected ${EXPECTED_OBJECTS} objects and ${EXPECTED_BYTES} bytes.`,
    );
  }
  if (!execute) {
    console.log(`Dry run only. After R2 verification, execute with --execute --confirm=${CONFIRMATION}`);
    return;
  }
  if (confirmation !== CONFIRMATION) throw new Error('Exact deletion confirmation is missing.');

  for (let index = 0; index < files.length; index += DELETE_BATCH_SIZE) {
    const paths = files.slice(index, index + DELETE_BATCH_SIZE).map(file => file.path);
    const { error } = await client.storage.from(BUCKET).remove(paths);
    if (error) throw error;
    console.log(`Deleted ${Math.min(index + paths.length, files.length)}/${files.length}.`);
  }

  const remaining = await inventory(client);
  if (remaining.length) throw new Error(`Deletion incomplete: ${remaining.length} objects remain.`);
  console.log('Verified: no objects remain under template-library/24billions/.');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
