import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const dir = await mkdtemp(join(tmpdir(), 'tayar-generated-application-'));
try {
  const out = join(dir, 'generation.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/editor-ai-generation-handler.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile: out, alias: { '@': resolve('src') }, define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'fixture-ai', setup(b) {
      b.onResolve({ filter: /^@\/lib\/ai\/service$/ }, () => ({ path: 'ai', namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const createAIService=()=>({completeJSON:async()=>globalThis.__generationResponse});' }));
    } }] });
  const { createAIGenerationHandler } = require(out);
  const table = { id: 'appointments', key: 'appointments', name: 'Appointments',
    fields: [{ id: 'visit_date', key: 'visit_date', name: 'Date', type: 'date', required: true }],
    permissions: [{ operation: 'read', access: 'owner' }, { operation: 'create', access: 'owner' }] };
  const application = { version: 1, roles: [], tables: [table], auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true },
    pageAccess: [{ pageId: 'booking', access: 'authenticated' }] };
  const response = { projectKind: 'application', application, siteName: 'Dental clinic', pages: [
    { name: 'Home', slug: 'home', sections: [{ type: 'hero', buttonText: 'Book', buttonUrl: '/booking' }] },
    { name: 'Booking', slug: 'booking', sections: [{ type: 'contact', anchorId: 'booking-form', buttonText: 'Request appointment',
      formFields: [{ id: 'date_input', name: 'visit_date', label: 'Date', type: 'date', required: true }],
      applicationFormBinding: { operation: 'create', tableId: 'appointments', fields: [{ formFieldId: 'date_input', tableFieldId: 'visit_date' }] } }] },
  ] };
  async function run(json, maxPages = 6, prompt = 'Build appointment booking with a patient portal') {
    globalThis.__generationResponse = { json };
    globalThis.window = { confirm: () => true };
    const state = {}, checkpoints = [];
    const setter = key => value => { state[key] = typeof value === 'function' ? value(state[key] ?? []) : value; };
    const args = {
      activeUserIdRef: { current: 'owner' }, aiAbortControllerRef: { current: null }, aiQualityAbortControllerRef: { current: null },
      aiOperationSequenceRef: { current: 0 }, aiUndoContextRef: { current: null }, aiQualityReviewContextRef: { current: null },
      aiBusy: false, aiQualityBusy: false, aiPrompt: prompt, user: { id: 'owner' },
      aiEditorContextIsCurrent: () => true, captureAIEditorContext: () => ({}), beginAIRequest: () => new AbortController(), finishAIRequest: () => {},
      billingEntitlements: { maxPages }, theme: {}, headerConfig: {}, brand: {}, seo: {}, l: text => text,
      buildProjectSnapshot: () => ({ application: { old: true } }), pushProjectCheckpoint: (...data) => checkpoints.push(data), requestGeneratedImage: async () => { throw new Error(); },
    };
    for (const key of ['Application','ActivePageId','AiBusy','AiCandidatePreview','AiError','AiIntent','AiMessages','AiPatchReview','AiPlan','AiPrompt','AiQualityReview','AiStage','AiUndoSnapshot','Brand','HeaderConfig','HomePageId','Pages','Saved','Sections','SelectedElementId','SelectedId','Seo','SiteName','Theme']) args[`set${key}`] = setter(key);
    await createAIGenerationHandler(args)();
    return { state, checkpoints };
  }
  const built = await run(response);
  assert.equal(built.state.AiStage, 'ready');
  assert.equal(built.state.Application.tables[0].key, 'appointments');
  assert.equal(built.state.Application.pageAccess[0].pageId, built.state.Pages[1].id);
  assert.equal(built.state.Pages[0].sections[0].buttonUrl, 'page:booking');
  assert.equal(built.state.Pages[0].sections[0].elements.find(e => e.type === 'button').href, 'page:booking');
  assert.equal(built.state.Pages[1].sections[0].formFields[0].name, 'visit_date');
  assert.deepEqual(built.checkpoints.at(-1)[1].application, built.state.Application);
  assert.match(built.state.AiMessages.at(-1).content, /No backend has been provisioned/);
  for (const [json, limit] of [
    [{ ...response, application: undefined }, 6],
    [{ ...response, application: { ...application, secrets: { token: 'forbidden' } } }, 6],
    [{ ...response, application: { ...application, tables: [{ ...table, permissions: [{ operation: 'create', access: 'public' }] }] } }, 6],
    [{ ...response, unsupportedFeatures: ['SMS confirmation'] }, 6],
    [{ ...response, pages: [{ ...response.pages[0], sections: [{ type: 'hero', buttonText: 'Login', buttonUrl: '#login' }] }, response.pages[1]] }, 6],
    [response, 1],
    [{ ...response, pages: [response.pages[0], { ...response.pages[1], sections: [{ ...response.pages[1].sections[0], formFields: [{ ...response.pages[1].sections[0].formFields[0], credentials: 'forbidden' }] }] }] }, 6],
    [{ ...response, pages: [response.pages[0], { ...response.pages[1], sections: [{ type: 'contact' }] }] }, 6],
  ]) {
    const failed = await run(json, limit);
    assert.equal(failed.state.AiStage, 'error');
    assert.equal(failed.state.Application, undefined, 'Invalid response cannot alter current app');
    assert.equal(failed.state.Pages, undefined, 'Invalid response cannot apply a partial site');
    assert.equal(failed.checkpoints.length, 0);
  }
  const brochure = await run({ projectKind: 'website', pages: [{ name: 'Home', slug: 'home', sections: [{ type: 'hero', buttonText: 'Explore', buttonUrl: '#hero' }] }] }, 6, 'Build a dental practice brochure');
  assert.equal(brochure.state.AiStage, 'ready');
  assert.equal(brochure.state.Application, undefined);
  await build({ entryPoints: ['src/modules/website-builder/core/website-project-links.ts', 'src/modules/website-builder/core/website-builder-rendering.ts'], bundle: true,
    platform: 'node', format: 'cjs', outdir: dir, alias: { '@': resolve('src') }, define: { 'import.meta.env': '{}' } });
  const { websiteProjectLinkIssues } = require(join(dir, 'website-project-links.js'));
  const { resolveBuilderHref, sectionToHtml } = require(join(dir, 'website-builder-rendering.js'));
  const pages = structuredClone(built.state.Pages);
  pages[0].sections[0].buttonUrl = 'page:booking#booking-form';
  pages[0].sections[0].elements.find(e => e.type === 'button').href = 'page:booking#booking-form';
  assert.equal(websiteProjectLinkIssues(pages).length, 0);
  assert.equal(resolveBuilderHref('page:booking#booking-form'), 'booking.html#booking-form');
  assert.match(sectionToHtml(pages[0].sections[0], 'home'), /href="booking.html#booking-form"/);
  assert.match(sectionToHtml(pages[1].sections[0], 'home'), /id="booking-form"/);
  pages[0].sections[0].buttonUrl = '#login';
  assert.equal(websiteProjectLinkIssues(pages)[0].code, 'LINK_ANCHOR_MISSING');
  pages[0].sections[0].buttonUrl = '/booking';
  assert.equal(websiteProjectLinkIssues(pages)[0].code, 'LINK_ESCAPES_PROJECT');
  console.log('PASS real generation handler: native application/forms/links/history, rejects fake portals, secrets, public writes, missing pages and unsupported features atomically');
} finally { delete globalThis.window; delete globalThis.__generationResponse; await rm(dir, { recursive: true, force: true }); }
