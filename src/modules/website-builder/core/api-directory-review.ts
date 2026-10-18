import { isPublicIntegrationEndpoint } from './editor-integration-security';

export interface APIDirectoryCandidate {
  name: string;
  url: string;
  categories: string[];
  source: 'api-mega-list';
  reviewStatus: 'quarantined';
  executable: false;
}
const trackingKey = /^(utm_.*|fpr|ref|referral|affiliate|aff|aff_id|partner|source)$/i;

/** Pure, bounded discovery import. No fetch, HTML execution, remote code import,
 * provider registration or authorization. Remove referral URLs and sponsorship
 * before review; commercial listings cannot self-certify price or licensing. */
export function reviewAPIMegaList(markdown: string) {
  if (typeof markdown !== 'string' || markdown.length > 8_000_000) throw new Error('Directory input exceeds review limit.');
  const candidates = new Map<string, APIDirectoryCandidate>();
  let category = '', sponsoredLevel = 0, sponsored = 0, duplicates = 0, rejected = 0, trackingRemoved = 0;
  for (const line of markdown.split('\n')) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      if (sponsoredLevel && heading[1].length <= sponsoredLevel) sponsoredLevel = 0;
      if (/sponsor|featured|partner listing|promot/i.test(heading[2])) sponsoredLevel = heading[1].length;
      if (heading[1].length === 2) category = heading[2].replace(/[^\p{L}\p{N} &/-]/gu, '').trim().slice(0, 80);
    }
    const entry = /^\|\s*\[([^\]\n]{1,240})\]\((https?:\/\/[^\s)]+)\)\s*\|/.exec(line);
    if (!entry) continue;
    if (sponsoredLevel || /\b(sponsored|advertisement|paid placement)\b/i.test(line)) { sponsored++; continue; }
    let parsed: URL;
    try { parsed = new URL(entry[2]); } catch { rejected++; continue; }
    if (!isPublicIntegrationEndpoint(parsed.href)) { rejected++; continue; }
    for (const key of [...parsed.searchParams.keys()]) if (trackingKey.test(key)) { parsed.searchParams.delete(key); trackingRemoved++; }
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    parsed.searchParams.sort();
    const url = parsed.href;
    const existing = candidates.get(url);
    if (existing) { duplicates++; if (category && !existing.categories.includes(category)) existing.categories.push(category); continue; }
    if (candidates.size >= 20_000) throw new Error('Directory candidate count exceeds review limit.');
    candidates.set(url, { name: entry[1].trim(), url, categories: category ? [category] : [], source: 'api-mega-list', reviewStatus: 'quarantined', executable: false });
  }
  return { candidates: [...candidates.values()], stats: { unique: candidates.size, duplicates, sponsored, rejected, trackingRemoved },
    approval: 'none' as const, licensing: 'not-established' as const };
}
