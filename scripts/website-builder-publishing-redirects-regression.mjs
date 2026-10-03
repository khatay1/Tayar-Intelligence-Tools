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
assert.match(sql, /revoke all on table public\.website_publish_redirects from public, anon, authenticated/,
  'Default and inherited authenticated table privileges must be explicitly reset');
assert.match(sql, /grant select, insert, delete on table public\.website_publish_redirects to authenticated/,
  'Authenticated Data API access must be explicit on new Supabase projects');
assert.doesNotMatch(sql, /grant[^\n]*update[^\n]*website_publish_redirects to authenticated/,
  'Authenticated clients must not receive direct UPDATE when the UI uses atomic replace');
assert.match(sql, /website_publish_redirects_user_project_idx/,
  'The user_id foreign key must have a covering index');
assert.match(sql, /website_replace_publish_redirects/, 'Atomic redirect replacement RPC must exist');
assert.match(sql, /jsonb_array_length\(p_redirects\)>100/, 'Redirect replacement must stay bounded');
assert.match(sql, /position\(chr\(10\) in source_path\)=0/, 'Source line breaks must be blocked without regex escaping');
assert.match(sql, /position\(chr\(13\) in target\)=0/, 'Target line breaks must be blocked without regex escaping');
assert.match(sql, /lower\(ltrim\(target\)\) not like 'javascript:%'/, 'Javascript targets must be blocked after leading whitespace');
assert.doesNotMatch(sql, /source_path !~/, 'Redirect safety must not depend on ambiguous PostgreSQL regex escaping');
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
assert.match(publishing, /Redirect contains an invalid line break/, 'UI validation must reject redirect line breaks');
assert.match(publishing, /\^\\s\*javascript:/, 'UI validation must reject whitespace-prefixed javascript targets');
assert.match(publishing, /Unsafe redirect target/, 'Unsafe redirect targets must remain blocked');

const repair = await read('supabase/migrations/20261003224500_website_publish_redirects_validation_fix.sql');
assert.match(repair, /drop constraint if exists website_publish_redirects_source_path_check/,
  'Already-migrated databases must replace the weak source constraint');
assert.match(repair, /delete from public\.website_publish_redirects/,
  'Unsafe rows created before the repair must be removed before constraints are replaced');
assert.match(repair, /position\(chr\(10\) in \(e\.value->>'from'\)\)>0/,
  'The repaired RPC must reject line breaks without regex escaping');

const grants = await read('supabase/migrations/20261003230000_website_publish_redirects_explicit_grants.sql');
assert.match(grants, /revoke all on table public\.website_publish_redirects from public, anon, authenticated/,
  'Already-migrated environments must reset inherited authenticated privileges');
assert.match(grants, /grant select, insert, delete on table public\.website_publish_redirects to authenticated/,
  'Already-migrated environments must receive explicit authenticated Data API grants');
assert.match(grants, /grant select, insert, update, delete on table public\.website_publish_redirects to service_role/,
  'Service operations must retain explicit table access after PUBLIC privileges are revoked');
assert.match(grants, /website_publish_redirects_user_project_idx/,
  'Already-migrated environments must receive the owner foreign-key index');

console.log('PASS Publishing MAX redirects: owner-scoped atomic persistence, reconciliation, escape-proof validation, stale-result guards and V2 reachability');
