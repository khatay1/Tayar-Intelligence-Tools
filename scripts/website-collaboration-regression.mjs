import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile('supabase/migrations/20260920160000_website_collaboration_pro.sql', 'utf8');
const cloud = await readFile('src/modules/website-builder/services/projectCloudService.ts', 'utf8');
const service = await readFile('src/modules/website-builder/services/websiteCollaborationService.ts', 'utf8');
const panel = await readFile('src/modules/website-builder/v2-ui/WebsiteCollaborationPanel.tsx', 'utf8');
const editor = (await Promise.all([
  'src/modules/website-builder/WebsiteBuilderTool.tsx',
  'src/modules/website-builder/core/use-website-builder-controller.tsx',
  'src/modules/website-builder/v2-ui/WebsiteBuilderPresentation.tsx',
].map((file) => readFile(file, 'utf8')))).join('\n');
const publishHandler = await readFile('src/modules/website-builder/core/editor-publish-handler.ts', 'utf8');
const rollbackHandler = await readFile('src/modules/website-builder/core/editor-rollback-handler.ts', 'utf8');
const unpublishHandler = await readFile('src/modules/website-builder/core/editor-unpublish-handler.ts', 'utf8');

assert.match(migration, /create table if not exists public\.website_project_comments/i);
assert.match(migration, /create table if not exists public\.website_project_presence/i);
assert.match(migration, /revoke all on public\.website_project_comments from public, anon, authenticated/i);
assert.match(migration, /grant select on public\.website_project_comments to authenticated/i);
assert.match(migration, /website_project_team_role\(project_id\)/i);
assert.match(migration, /user_id = auth\.uid\(\)/i);
assert.match(migration, /v_role is null or v_role not in \('owner', 'admin', 'editor'\)/i);
assert.match(migration, /auth\.uid\(\) is null or \(v_comment\.user_id <> auth\.uid\(\)/i);
assert.match(migration, /alter publication supabase_realtime add table public\.website_project_comments/i);
assert.match(migration, /alter publication supabase_realtime add table public\.website_project_presence/i);

assert.match(cloud, /expectedUpdatedAt/);
assert.match(cloud, /query = query\.eq\('updated_at', expectedUpdatedAt\)/);
assert.match(cloud, /A teammate saved a newer version/);
assert.match(publishHandler, /expectedUpdatedAt: publishRevision/);
assert.match(rollbackHandler, /expectedUpdatedAt: rollbackRevision/);
assert.match(unpublishHandler, /expectedUpdatedAt: unpublishRevision/);
assert.match(editor, /createPublishWebsiteHandler/);
assert.match(editor, /createRollbackPublishVersionHandler/);
assert.match(editor, /createUnpublishWebsiteHandler/);

assert.match(service, /list_website_project_comments/);
assert.match(service, /website_project_presence/);
assert.match(panel, /postgres_changes/);
assert.match(panel, /25_000/);
assert.match(panel, /CollaborationSession key=/);
assert.match(panel, /resolveWebsiteProjectComment/);
assert.match(editor, /WebsiteCollaborationPanel/);

console.log('PASS review comments, live presence, role guards and optimistic cloud-save conflicts');

await import('./website-builder-concurrency-regression.mjs');
