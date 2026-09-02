import fs from 'node:fs';

const upstream = fs.readFileSync('src/modules/code-assistant/upstream-registry.ts', 'utf8');
const catalog = fs.readFileSync('src/modules/code-assistant/catalogs/animata-catalog.ts', 'utf8');

const blockPattern = /\{\s*sourceId:\s*'([^']+)'[\s\S]*?revision:\s*'([0-9a-f]{40})'[\s\S]*?(?:manifestUrl:\s*'([^']+)')?[\s\S]*?rawBaseUrl:\s*'([^']+)'[\s\S]*?sourcePathPrefix:\s*'([^']*)'[\s\S]*?licensePath:\s*'([^']+)'[\s\S]*?\},/g;
const configs = [];
for (const match of upstream.matchAll(blockPattern)) {
  configs.push({
    sourceId: match[1],
    revision: match[2],
    manifestUrl: match[3] || null,
    rawBaseUrl: match[4],
    sourcePathPrefix: match[5],
    licensePath: match[6],
  });
}

if (configs.length < 11) throw new Error(`Expected at least 11 approved pinned sources, found ${configs.length}.`);
if (!catalog.includes('ANIMATA_CATALOG_COUNT = 154')) throw new Error('Pinned Animata catalog count changed unexpectedly.');

async function fetchChecked(url, label, maxBytes = 5_000_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > maxBytes) throw new Error(`${label} exceeded ${maxBytes} bytes`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

for (const config of configs) {
  if (!config.rawBaseUrl.includes(config.revision)) throw new Error(`${config.sourceId} rawBaseUrl is not pinned to its revision.`);
  const licenseUrl = `${config.rawBaseUrl}/${config.licensePath.split('/').map(encodeURIComponent).join('/')}`;
  const license = await fetchChecked(licenseUrl, `${config.sourceId} license`, 150_000);
  if (!/permission|license|copyright|apache|mit/i.test(license)) {
    throw new Error(`${config.sourceId} license payload does not look like a license.`);
  }

  if (!config.manifestUrl) continue;
  if (!config.manifestUrl.includes(config.revision)) throw new Error(`${config.sourceId} manifest is not pinned.`);
  const manifestText = await fetchChecked(config.manifestUrl, `${config.sourceId} manifest`);
  const manifest = JSON.parse(manifestText);
  if (!Array.isArray(manifest.items) || !manifest.items.length) throw new Error(`${config.sourceId} manifest has no items.`);

  const first = manifest.items.find((item) => Array.isArray(item.files) && item.files.some((file) => typeof file?.path === 'string'));
  const firstPath = first?.files?.find((file) => typeof file?.path === 'string')?.path;
  if (firstPath) {
    const normalized = String(firstPath).replace(/^\.\/+/, '');
    const fullPath = `${config.sourcePathPrefix}${normalized}`;
    const sourceUrl = `${config.rawBaseUrl}/${fullPath.split('/').map(encodeURIComponent).join('/')}`;
    await fetchChecked(sourceUrl, `${config.sourceId} sample source`, 2_000_000);
  }

  console.log(`[registry-health] ${config.sourceId}: ${manifest.items.length} manifest items OK`);
}

console.log(`[registry-health] PASS: ${configs.length} pinned sources + Animata snapshot verified`);
