import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const model=read('src/modules/website-builder/core/editor-collaboration.ts');
const service=read('src/modules/website-builder/services/collaborationService.ts');
const panel=read('src/modules/website-builder/v2-ui/BuilderCollaborationMaxPanel.tsx');
const bridge=read('src/modules/website-builder/v2-ui/WebsiteBuilderV2Bridge.tsx');
const migration=read('supabase/migrations/20260922153000_website_collaboration_max.sql');
const checks=[
 ['roles',model.includes("'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer'")],
 ['edit permission',model.includes('canEditProject')],
 ['review permission',model.includes('canReviewProject')],
 ['restore permission',model.includes('canRestoreVersion')],
 ['mentions',model.includes('extractEditorMentions')],
 ['version compare',model.includes('compareEditorVersionValues')],
 ['comments persistence',service.includes('createWebsiteComment')&&service.includes('resolveWebsiteComment')],
 ['reviews persistence',service.includes('createWebsiteReview')&&service.includes('updateWebsiteReviewStatus')],
 ['activity persistence',service.includes('recordWebsiteActivity')],
 ['collaboration UI',panel.includes('Comments')&&panel.includes('Activity')&&panel.includes('Versions')],
 ['review UI',panel.includes('Approve')&&panel.includes('Request changes')],
 ['version restore UI',panel.includes('onRestoreVersion')],
 ['bridge integration',bridge.includes('BuilderCollaborationMaxPanel')&&bridge.includes('collaborationComments')],
 ['selection anchor',bridge.includes('anchor={selection}')],
 ['RLS enabled',migration.includes('enable row level security')],
 ['RLS role gate',migration.includes('website_collaboration_role')&&migration.includes('admins manage collaborators')],
];
const failed=checks.filter(([,ok])=>!ok);if(failed.length){console.error('Collaboration MAX regression failed:',failed.map(([n])=>n).join(', '));process.exit(1);}console.log(`Collaboration + Versioning MAX regression: ${checks.length}/${checks.length} passed`);
