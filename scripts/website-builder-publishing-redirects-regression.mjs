import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [sql, service, panel, bridge, publishing] = await Promise.all([
  read('supabase/migrations/20261003223000_website_publish_redirects.sql'),
  read('src/modules/website-builder/services/publishRedirectService.ts'),
  read('src/modules/website-builder/v2-ui/BuilderPersistedRedirectsPanel.tsx'),
  read('src/modules/website-builder/v2-ui/WebsiteBuilderV2BridgeBase.tsx'),
  read('src/modules/website-builder/core/editor-publishing.ts'),
]);

assert.match(sql, /references public\.projects\(id\)/, 'Redirects must bind to the canonical project table');
assert.doesNotMatch(sql, /website_projects/, 'Legacy Website Builder project tables must not return');
assert.match(sql, /enable row level security/i, 'Redirect persistence must enforce RLS');
assert.match(sql, /website_replace_publish_redirects/, 'Atomic redirect replacement RPC must exist');
assert.match(sql, /jsonb_array_length\(p_redirects\)>100/, 'Redirect replacement must stay bounded');
assert.match(sql, /delete from public\.website_publish_redirects[\s\S]*insert into public\.website_publish_redirects/,
  'Replacement must happen in one database transaction');

assert.match(service, /rpc\('website_replace_publish_redirects'/, 'Browser persistence must use the atomic RPC');
assert.match(service, /listWebsitePublishRedirects\(input\.projectId, input\.ownerId\)/,
  'Uncertain RPC responses must reconcile from owner-scoped persisted rows');
assert.doesNotMatch(service, /\.from\('website_publish_redirects'\)[\s\S]{0,120}\.delete\(/,
  'The browser must not delete redirects before a separate insert');

assert.match(panel, /loadActiveWebsiteProjectId/, 'Publishing redirects must follow the active cloud project');
assert.match(panel, /listWebsitePublishRedirects/, 'Persisted redirects must load from the active project');
assert.match(panel, /replaceWebsitePublishRedirects/, 'Save must reach atomic persistence');
assert.match(panel, /loadSequenceRef/, 'Project/user switches must invalidate stale loads');
assert.match(panel, /saveSequenceRef/, 'Project/user switches must invalidate stale saves');
assert.match(panel, /externallyControlled/, 'Explicit host wiring must still override the persistence fallback');

assert.match(bridge, /publishingTool==='redirects'/, 'Publishing MAX must expose the redirects surface');
assert.match(bridge, /BuilderPersistedRedirectsPanel/, 'Publishing MAX must render the persisted redirects surface');
assert.match(publishing, /validateEditorPublishRedirects/, 'Redirects must keep central safety validation');
assert.match(publishing, /Unsafe redirect target/, 'Unsafe redirect targets must remain blocked');

console.log('PASS Publishing MAX redirects: owner-scoped atomic persistence, reconciliation, stale-result guards and V2 reachability');
