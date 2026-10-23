import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateEdgeSourceBoundary } from './release-edge-source-gate.mjs';

const repo='khatay1/Tayar-Intelligence-Tools';
const old='22e528a8c22572d170cc1e6d40186e94a57fb40b';
const main='e261c5aa154de173c726b52f68040f6d7d31b802';
const mainEndpointSource=await readFile(new URL('../server/website-byo-publish-endpoint.ts', import.meta.url),'utf8');
const mainRunnerSource=await readFile(new URL('../server/website-byo-publish-runners.ts', import.meta.url),'utf8');
const input={
  repository:repo,mainSha:main,
  deployedEdgeSource:'// live pinned import observed 2026-10-23\nimport "https://raw.githubusercontent.com/'+repo+'/'+old+'/supabase/functions/website-byo-publish/index.ts";',
  pinnedEndpointSource:'const result=await context.runProduction({...scope,previewOperationId});',
  pinnedRunnerSource:'async runProduction(s){return runWebsiteOwnedByoProductionPublish({...s})}',
  mainEndpointSource,mainRunnerSource,
};
let result=evaluateEdgeSourceBoundary(input);
assert.equal(result.status,'BLOCKED');
assert.equal(result.confirmedOutdatedPublishBoundary,true);
assert.equal(result.olderPublishRouteExists,true);
assert.equal(result.releaseAuthorized,false);
assert.equal(result.productionPublishAuthorized,false);
assert.equal(result.deployedPinnedSha,old);
assert.equal(result.mainEndpointRefusesProduction,true);
assert.equal(result.mainRunnerRefusesProduction,true);
result=evaluateEdgeSourceBoundary({...input,deployedEdgeSource:input.deployedEdgeSource.replace(old,main)});
assert.equal(result.confirmedOutdatedPublishBoundary,false);
assert.equal(result.releaseAuthorized,false);
result=evaluateEdgeSourceBoundary({...input,deployedEdgeSource:'export default null; // unpinned code'});
assert.equal(result.deployedPinnedSha,null);
assert.equal(result.releaseAuthorized,false);
result=evaluateEdgeSourceBoundary({...input,pinnedRunnerSource:'// no publisher present here'});
assert.equal(result.olderPublishRouteExists,false);
result=evaluateEdgeSourceBoundary({...input,mainEndpointSource:'return json(200,{status:"ready"});'});
assert.equal(result.mainEndpointRefusesProduction,false);
result=evaluateEdgeSourceBoundary({...input,deployedEdgeSource:'import "https://evil.invalid/'+repo+'/'+old+'/supabase/functions/website-byo-publish/index.ts";'});
assert.equal(result.deployedPinnedSha,null);
assert.throws(()=>evaluateEdgeSourceBoundary({...input,repository:'other/repo'}),/Complete reviewed/);
assert.throws(()=>evaluateEdgeSourceBoundary({...input,mainRunnerSource:''}),/Complete reviewed/);
console.log('PASS BYO Edge source gate: detected old source + current refusal, conservative/no approval');
