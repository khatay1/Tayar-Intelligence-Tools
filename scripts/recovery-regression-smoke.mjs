import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const requireMatch = (source, pattern, message) => {
  if (!pattern.test(source)) throw new Error(message);
};
const forbidMatch = (source, pattern, message) => {
  if (pattern.test(source)) throw new Error(message);
};

const livePreview = read('src/modules/code-assistant/live-preview.ts');
forbidMatch(livePreview, /\beval\s*\(/, 'Live Preview must not execute generated code with eval().');
requireMatch(livePreview, /Content-Security-Policy/, 'Live Preview must define an isolation CSP.');
requireMatch(livePreview, /default-src 'none'/, 'Live Preview CSP must deny resources by default.');
requireMatch(livePreview, /connect-src 'none'/, 'Live Preview CSP must block network connections.');
requireMatch(livePreview, /frame-src 'none'/, 'Live Preview CSP must block nested frames.');
requireMatch(livePreview, /object-src 'none'/, 'Live Preview CSP must block plugin/object content.');
requireMatch(livePreview, /form-action 'none'/, 'Live Preview CSP must block form submission.');
requireMatch(livePreview, /BLOCKED_RUNTIME/, 'Live Preview must retain runtime API blocking.');

const requestContext = read('src/lib/ai/request-context.ts');
requireMatch(requestContext, /projectId/, 'AI request binding must track projectId.');
requireMatch(requestContext, /fingerprint/, 'AI request binding must track the project fingerprint.');
requireMatch(requestContext, /assertAIResponseProjectContextMatches/, 'Safe Apply binding assertion is missing.');

const projectContext = read('src/modules/code-assistant/project-context.ts');
requireMatch(projectContext, /prepareAIProjectRequestContext/, 'Coding Assistance must bind AI requests to project snapshots.');
requireMatch(projectContext, /setActiveAIProjectContext/, 'Coding Assistance must track the active project snapshot.');

const patchPlan = read('src/modules/code-assistant/patch-plan.ts');
requireMatch(patchPlan, /assertAIResponseProjectContextCurrent/, 'Patch validation must reject stale AI responses.');
requireMatch(patchPlan, /carryAIResponseProjectContext/, 'Validated plans must retain their AI project binding.');

const projectApply = read('src/modules/code-assistant/project-apply.ts');
requireMatch(projectApply, /assertAIResponseProjectContextMatches/, 'Safe Apply must verify AI project binding before writes.');
requireMatch(projectApply, /\.eq\('updated_at', data\.updated_at\)/, 'Safe Apply optimistic locking must remain enabled.');

const cloudService = read('src/modules/website-builder/services/projectCloudService.ts');
requireMatch(cloudService, /\.select\('id, updated_at'\)/, 'Website cloud mutations must return a row for verification.');
requireMatch(cloudService, /Cloud save did not match/, 'Website cloud save must reject zero-row updates.');

const mediaService = read('src/modules/website-builder/services/websiteMediaService.ts');
requireMatch(mediaService, /offset \+= MEDIA_PAGE_SIZE/, 'Website media listing must paginate beyond the first page.');

const importCard = read('src/components/workspace/CodeProjectImportCard.tsx');
requireMatch(importCard, /node_modules/, 'Code project import must exclude dependency directories.');
requireMatch(importCard, /\.env/, 'Code project import must exclude environment secrets.');

console.log('Recovery regression smoke passed.');
