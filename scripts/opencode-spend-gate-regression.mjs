import assert from 'node:assert/strict';
import { chooseFreeLocalOpenCode, reserveOptionalOpenCodeSpend,
  FREE_ONLY_OPENCODE_POLICY } from '../server/opencode-spend-gate.mjs';

const free={route:'local-ollama',paid:false,modelApiChargeMicroUsd:0};
assert.deepEqual(chooseFreeLocalOpenCode(),free);
assert.deepEqual(await reserveOptionalOpenCodeSpend(),free);
assert.deepEqual(await reserveOptionalOpenCodeSpend({request:{route:'local-ollama',providerID:'ollama'}}),free);
for(const r of [
  {route:'paid-cloud'}, {route:'local-ollama',providerID:'openai'},
  {route:'local-ollama',autoFallback:true}, {route:'local-ollama',autoUpgrade:true},
  {route:'free-hosted-cloud'}, {route:'local-ollama',monthlyChargeMicroUsd:5000},
]) await assert.rejects(reserveOptionalOpenCodeSpend({request:r}));
assert.deepEqual(FREE_ONLY_OPENCODE_POLICY,{
  phase:'free-only',paidProviderEnabled:false,
  automaticPaidFallback:false,monthlyBudgetMicroUsd:0,
});
const nowMs=Date.parse('2026-10-20T16:00:00Z');
const request={
  route:'paid-cloud',intent:'explicit-premium-selection',tenantId:'tenant_001',
  providerID:'example-provider',modelID:'example-model',quotedMicroUsd:500_000,
};
const policy={
  phase:'premium-opt-in',paidProviderEnabled:true,automaticPaidFallback:false,
  operatorApproved:true,billingMonth:'2026-10',
  approvedModels:[{providerID:'example-provider',modelID:'example-model'}],
  monthlyBudgetMicroUsd:4_000_000,maxPerRequestMicroUsd:1_000_000,
};
const consent={
  confirmed:true,tenantId:request.tenantId,approvalId:'approve_01',
  billingMonth:'2026-10',expiresAtMs:nowMs+3600_000,
};
let called=0;
const ledger={reserveAtomic:async (payload)=>{
  called++;
  assert.deepEqual(payload,{
    tenantId:'tenant_001',billingMonth:'2026-10',
    providerID:'example-provider',modelID:'example-model',
    approvalId:'approve_01',quoteMicroUsd:500000,
    maxPerRequestMicroUsd:1000000,monthlyBudgetMicroUsd:4000000,
  });
  return {authorized:true,reservationId:'res_001',tenantId:'tenant_001',
    billingMonth:'2026-10',reservedMicroUsd:500000};
}};
const base={request,policy,consent,ledger,nowMs};
async function reject(change,expected){
  const initial=called;
  await assert.rejects(reserveOptionalOpenCodeSpend({...base,...change}),{code:expected});
  assert.equal(called,initial,'inadmissible request must NOT touch paid ledger');
}
await reject({policy:FREE_ONLY_OPENCODE_POLICY},'paid-provider-disabled');
await reject({request:{...request,autoFallback:true}},'automatic-upgrade-blocked');
await reject({request:{...request,intent:'automatic-demand-spike'}},'automatic-upgrade-blocked');
await reject({policy:{...policy,paidProviderEnabled:false}},'paid-provider-disabled');
await reject({policy:{...policy,operatorApproved:false}},'paid-provider-disabled');
await reject({policy:{...policy,automaticPaidFallback:true}},'paid-provider-disabled');
await reject({policy:{...policy,approvedModels:[]}},'model-not-approved');
await reject({request:{...request,modelID:'unknown-model'}},'model-not-approved');
await reject({consent:{...consent,confirmed:false}},'explicit-consent-required');
await reject({consent:{...consent,tenantId:'tenant_002'}},'explicit-consent-required');
await reject({consent:{...consent,expiresAtMs:nowMs}},'explicit-consent-required');
await reject({consent:{...consent,billingMonth:'2026-09'}},'billing-month-mismatch');
await reject({policy:{...policy,billingMonth:'2026-11'}},'billing-month-mismatch');
await reject({request:{...request,quotedMicroUsd:2_000_000}},'budget-exceeded');
await reject({request:{...request,quotedMicroUsd:-1}},'budget-exceeded');
await reject({policy:{...policy,monthlyBudgetMicroUsd:0}},'budget-exceeded');
await reject({ledger:undefined},'atomic-reservation-required');
const allowed=await reserveOptionalOpenCodeSpend(base);
assert.deepEqual(allowed,{
  route:'paid-cloud',paid:true,providerID:'example-provider',
  modelID:'example-model',reservationId:'res_001',reservedMicroUsd:500000,
});
assert.equal(called,1);
await assert.rejects(reserveOptionalOpenCodeSpend({...base,
  ledger:{reserveAtomic:async()=>({authorized:true,reservationId:'res_001',
    tenantId:'tenant_other',billingMonth:'2026-10',reservedMicroUsd:500000})}
}),{code:'atomic-reservation-invalid'});
await assert.rejects(reserveOptionalOpenCodeSpend({...base,
  ledger:{reserveAtomic:async()=>{throw Error('private balance');}}
}),{code:'atomic-reservation-failed'});
console.log('OpenCode zero-paid default + explicit premium admission regression passed.');
