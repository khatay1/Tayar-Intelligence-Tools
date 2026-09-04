import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const fail = (message) => {
  console.error(`[launch-hardening-smoke] FAIL: ${message}`);
  process.exitCode = 1;
};

const service = read('src/lib/ai/service.ts');
const requestContext = read('src/lib/ai/request-context.ts');
const projectContext = read('src/modules/code-assistant/project-context.ts');
const patchPlan = read('src/modules/code-assistant/patch-plan.ts');
const projectApply = read('src/modules/code-assistant/project-apply.ts');
const livePreview = read('src/modules/code-assistant/live-preview.ts');
const cloud = read('src/modules/website-builder/services/projectCloudService.ts');
const publishVersions = read('src/modules/website-builder/services/publishVersionService.ts');
const media = read('src/modules/website-builder/services/websiteMediaService.ts');
const fileManager = read('src/components/workspace/FileManager.impl.tsx');
const codeImporter = read('src/components/workspace/CodeProjectImportCard.tsx');
const releaseGate = read('.github/workflows/release-gate.yml');

if (!service.includes("from './service.impl'") || !service.includes('captureAIProjectRequestContext') || !service.includes('bindAIResponseProjectContext')) {
  fail('AI service request/response project binding wrapper is missing.');
}
if (!requestContext.includes('WeakMap<object, AIProjectRequestBinding>') || !requestContext.includes('assertAIResponseProjectContextMatches')) {
  fail('AI project request binding registry is incomplete.');
}
if (!projectContext.includes("setActiveAIProjectContext('code-assistant'") || !projectContext.includes('prepareAIProjectRequestContext')) {
  fail('Code Assistant does not bind AI requests to the selected project context.');
}
if (!patchPlan.includes('assertAIResponseProjectContextCurrent') || !patchPlan.includes('carryAIResponseProjectContext')) {
  fail('Validated patch plans do not preserve/check their AI project binding.');
}
if (!projectApply.includes('assertAIResponseProjectContextMatches') || !projectApply.includes('expectedFingerprint')) {
  fail('Safe Apply is missing project-bound AI patch enforcement.');
}
if (livePreview.includes('(0,eval)') || livePreview.includes('eval(transformed)')) {
  fail('Live preview still relies on eval under CSP.');
}
if (!livePreview.includes("document.createElement('script')") || !livePreview.includes('document.body.appendChild(execution)')) {
  fail('Live preview CSP-safe transformed script execution is missing.');
}
if (!cloud.includes(".select('id, updated_at')") || !cloud.includes('Cloud save did not match an accessible website project')) {
  fail('Website Builder cloud mutations are not verified against a returned row.');
}
const dbDeleteIndex = publishVersions.indexOf(".from('website_publish_versions')");
const storageDeleteIndex = publishVersions.indexOf(".from('published-sites')");
if (dbDeleteIndex < 0 || storageDeleteIndex < 0 || dbDeleteIndex > storageDeleteIndex || !publishVersions.includes(".select('id')")) {
  fail('Release deletion must verify the DB row before archive storage cleanup.');
}
if (!media.includes('MEDIA_PAGE_SIZE = 100') || !media.includes('MEDIA_MAX_FILES = 1_000') || !media.includes('offset += MEDIA_PAGE_SIZE')) {
  fail('Website media library pagination is missing.');
}
if (!fileManager.includes('CodeProjectImportCard') || !fileManager.includes("props.onNavigate('code-assistant', projectId)")) {
  fail('My Files is missing the Code Project import entry point.');
}
if (!codeImporter.includes("type: 'code-assistant'") || !codeImporter.includes('content: {') || !codeImporter.includes('files: fileStore') || !codeImporter.includes('BLOCKED_NAME')) {
  fail('Code Project folder import does not create a safe content.files project.');
}
if (!releaseGate.includes('npm run smoke:code-assistant') || !releaseGate.includes('node scripts/launch-hardening-smoke.mjs')) {
  fail('Release Gate is missing Code Assistant or launch-hardening regression checks.');
}

if (!process.exitCode) {
  console.log('[launch-hardening-smoke] PASS');
}
