import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const model=read('src/modules/website-builder/core/editor-collaboration.ts');
const realtime=read('src/modules/website-builder/services/websiteCollaborationService.ts');
const panel=read('src/modules/website-builder/v2-ui/BuilderCollaborationMaxPanel.tsx');
const bridge=read('src/modules/website-builder/v2-ui/WebsiteBuilderV2Bridge.tsx');
const bridgeBase=read('src/modules/website-builder/v2-ui/WebsiteBuilderV2BridgeBase.tsx');
const bridgeSources=`${bridge}\n${bridgeBase}`;
const migration=read('supabase/migrations/20260920160000_website_collaboration_pro.sql');
const checks=[
 ['roles',model.includes("'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer'")],
 ['edit permission',model.includes('canEditProject')],
 ['review permission',model.includes('canReviewProject')],
 ['restore permission',model.includes('canRestoreVersion')],
 ['mentions',model.includes('extractEditorMentions')],
 ['version compare',model.includes('compareEditorVersionValues')],
 ['version diff summary',model.includes('summarizeEditorVersionChanges')],
 ['selective version restore',model.includes('restoreEditorVersionPaths')],
 ['comments persistence',realtime.includes('createWebsiteProjectComment')&&realtime.includes('resolveWebsiteProjectComment')],
 ['comment RPC persistence',migration.includes('create_website_project_comment')&&migration.includes('resolve_website_project_comment')],
 ['realtime presence channel',realtime.includes('createWebsiteRealtimeCollaborationChannel')&&realtime.includes("presence: { key: self.userId }")],
 ['live cursor payload',realtime.includes('WebsiteRealtimeCursor')&&realtime.includes('cursor?: WebsiteRealtimeCursor')],
 ['live selection payload',realtime.includes('selection: WebsiteCommentAnchor')],
 ['reconnect tracking',realtime.includes("status === 'SUBSCRIBED'")&&realtime.includes('channel.track')],
 ['realtime cleanup',realtime.includes('channel.untrack')&&realtime.includes('removeChannel')],
 ['editing conflict detection',realtime.includes('hasWebsiteEditingConflict')&&realtime.includes('editingElementId')],
 ['database presence fallback',realtime.includes('heartbeatWebsiteProjectPresence')&&realtime.includes('listWebsiteProjectPresence')],
 ['collaboration UI',panel.includes('Comments')&&panel.includes('Activity')&&panel.includes('Version compare')],
 ['review UI',panel.includes('Approve')&&panel.includes('Request changes')],
 ['version restore UI',panel.includes('onRestoreVersion')],
 ['bridge integration',bridgeSources.includes('BuilderCollaborationMaxPanel')&&bridgeSources.includes('collaborationComments')],
 ['selection anchor',bridgeSources.includes('anchor={selection}')],
 ['RLS enabled',migration.includes('enable row level security')],
 ['RLS membership gate',migration.includes('website_project_team_role')&&migration.includes('website_project_presence_member_select')],
 ['Supabase realtime publication',migration.includes('supabase_realtime')&&migration.includes('website_project_presence')],
];
const failed=checks.filter(([,ok])=>!ok);
if(failed.length){console.error('Collaboration MAX regression failed:',failed.map(([n])=>n).join(', '));process.exit(1);}
console.log(`Collaboration + Versioning MAX regression: ${checks.length}/${checks.length} passed`);
