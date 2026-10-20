import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { checkV2Config, checkReadOnlyAgent, planWithOpenCodeV2 }
  from '../server/opencode-v2-local-planner.mjs';

const rules = [
  { action: '*', resource: '*', effect: 'deny' },
  { action: 'read', resource: '*', effect: 'allow' },
  { action: 'glob', resource: '*', effect: 'allow' },
  { action: 'grep', resource: '*', effect: 'allow' },
];
const config = {
  enabled: true, isolated: true, offline: true, readonlyWorktree: true,
  runtimeVersion: 'v1.19.3', baseUrl: 'http://127.0.0.1:4096',
  providerID: 'ollama', modelID: 'qwen2.5-coder:7b',
  workspaceDirectory: '/workspace/test-tenant-123',
  serverPassword: 'disposable-test-password-123',
};
assert.deepEqual(checkV2Config(config), {
  origin: 'http://127.0.0.1:4096', modelID: config.modelID,
  workspaceDirectory: config.workspaceDirectory,
});
assert.equal(checkReadOnlyAgent({ id:'tayar-readonly', permissions: rules }), true);
for (const unsafe of [
  [...rules, { action:'shell',resource:'*',effect:'allow' }],
  [{ action:'*',resource:'*',effect:'ask' }, ...rules.slice(1)],
  [rules[0], rules[1], rules[2], { action:'external_directory',resource:'*',effect:'allow' }],
  [rules[0], rules[1], rules[1], rules[2]],
]) assert.throws(() => checkReadOnlyAgent({id:'tayar-readonly',permissions:unsafe}), {code:'unsafe-agent-policy'});

async function rejectBeforeNetwork(override, expected, text='Inspect project') {
  let touched = false;
  await assert.rejects(planWithOpenCodeV2({
    config: { ...config, ...override }, prompt: text,
    fetcher: async () => { touched = true; throw Error('unexpected network'); },
  }), { code: expected });
  assert.equal(touched,false);
}
for (const [override, code] of [
  [{enabled:false}, 'disabled'],
  [{isolated:false},'external-isolation-required'],
  [{offline:false},'external-isolation-required'],
  [{readonlyWorktree:false},'external-isolation-required'],
  [{runtimeVersion:'latest'},'unsupported-runtime'],
  [{providerID:'openai'},'unsupported-runtime'],
  [{modelID:'cloud-demo'},'invalid-local-model'],
  [{baseUrl:'http://localhost:4096'},'invalid-endpoint'],
  [{baseUrl:'http://127.0.0.1:4096/admin'},'invalid-endpoint'],
  [{baseUrl:'http://127.0.0.1:4096@malicious.test'},'invalid-endpoint'],
  [{workspaceDirectory:'/tmp/customer'},'invalid-workspace'],
  [{workspaceDirectory:'/workspace/../secret'},'invalid-workspace'],
  ...[undefined, '', 'short', 'x'.repeat(257), 'line\nbreak-password', 'non-ascii-密碼-password']
    .map(serverPassword => [{serverPassword}, 'invalid-server-credential']),
]) await rejectBeforeNetwork(override,code);
await rejectBeforeNetwork({},'invalid-prompt','');
await rejectBeforeNetwork({},'invalid-prompt','x'.repeat(11000));

const calls = [];
let agentRules = rules;
let outcome = 'success';
let providerID = 'ollama';
let name = 'read';
let reply = 'Reviewed architecture.';
const fetcher = async (url, opts) => {
  const u = new URL(url); const body = opts.body ? JSON.parse(opts.body) : undefined;
  calls.push({path:u.pathname+u.search, method:opts.method, body, opts});
  assert.equal(u.origin,config.baseUrl);
  assert.equal(opts.redirect,'error');
  assert.equal(opts.cache,'no-store');
  assert.equal(opts.headers.authorization, 'Basic ' + btoa('opencode:' + config.serverPassword));
  assert.equal(String(url).includes(config.serverPassword), false);
  assert.equal((opts.body ?? '').includes(config.serverPassword), false);
  if (u.pathname === '/api/health') return Response.json({healthy:true});
  if (u.pathname === '/api/agent') {
    assert.equal(u.searchParams.get('location[directory]'),config.workspaceDirectory);
    return Response.json({
      location:{directory: config.workspaceDirectory},
      data:[{id:'tayar-readonly',permissions:agentRules}],
    });
  }
  if (u.pathname === '/api/session' && opts.method === 'POST') {
    assert.deepEqual(body,{agent:'tayar-readonly',model:{id:config.modelID,providerID:'ollama'},location:{directory:config.workspaceDirectory}});
    return Response.json({data:{id:'ses_1234',agent:'tayar-readonly',model:body.model,location:body.location}});
  }
  if (u.pathname === '/api/session/ses_1234/prompt') {
    assert.deepEqual(body,{prompt:{text:'Inspect project'}});
    return Response.json({data:{id:'msg_1234',sessionID:'ses_1234'}});
  }
  if (u.pathname === '/api/session/ses_1234/wait') {
    return new Response(null,{status:204});
  }
  if (u.pathname === '/api/session/ses_1234/message') {
    if (outcome === 'large') return new Response('x'.repeat(200000));
    const content = [{type:'text',text:reply},
      {type:'tool',name,state:{status:'completed'}}];
    return Response.json({data:[{
      type:'assistant',agent:'tayar-readonly',
      model:{providerID,id:config.modelID},
      content, finish:'stop', time:{completed:Date.now()},
    },{type:'user',text:'Inspect project'}]});
  }
  if (u.pathname === '/api/session/ses_1234/interrupt')
    return new Response(null,{status:204});
  throw Error('unexpected API path: '+u.pathname);
};
const request = {config,prompt:'Inspect project',fetcher};
assert.deepEqual(await planWithOpenCodeV2(request),{
  plan:'Reviewed architecture.',mode:'read-only',providerID:'ollama',
  modelID:config.modelID,
});
assert.equal(calls.filter(x=>x.path.includes('/prompt')).length,1);
assert.equal(calls.filter(x=>x.path.includes('/interrupt')).length,0);
assert.equal(calls.find(x=>x.path.startsWith('/api/agent?')).method,'GET');
calls.length=0; agentRules=[...rules,{action:'shell',resource:'*',effect:'allow'}];
await assert.rejects(planWithOpenCodeV2(request),{code:'unsafe-agent-policy'});
assert.equal(calls.some(x=>x.path==='/api/session'),false,
 'unsafe agent must be refused before creating a session');
agentRules=rules;
providerID='openai';
await assert.rejects(planWithOpenCodeV2(request),{code:'invalid-model-response'});
providerID='ollama';
name='shell';
await assert.rejects(planWithOpenCodeV2(request),{code:'unsafe-tool-result'});
name='read';
reply='x'.repeat(17000);
await assert.rejects(planWithOpenCodeV2(request),{code:'invalid-plan'});
reply='Reviewed architecture.';
outcome='large';
await assert.rejects(planWithOpenCodeV2(request),{code:'response-too-large'});
assert.ok(calls.filter(x=>x.path.endsWith('/interrupt')).length>=4,
 'failed active sessions should best-effort interrupt');
console.log('OpenCode V2 local protocol regression passed.');

// Real HTTP transport against a local protocol fixture, NOT model inference.
// Exercise native fetch so redirect/credential behavior isn't just mocked.
let behavior = 'success';
let admitted = 0;
let interrupts = 0;
let redirected = 0;
const expectedAuthorization = 'Basic ' + btoa('opencode:' + config.serverPassword);
const localServer = createServer(async (req, res) => {
  if (req.url === '/credential-trap') {
    redirected++;
    res.writeHead(500).end();
    return;
  }
  if (req.headers.authorization !== expectedAuthorization) {
    res.writeHead(401, {'content-type':'application/json'}).end(
      JSON.stringify({error:'untrusted response: ' + config.serverPassword}));
    return;
  }
  if (behavior === 'redirect') {
    res.writeHead(302, {location:'/credential-trap'}).end();
    return;
  }
  let raw = '';
  for await (const chunk of req) raw += chunk;
  assert.equal(raw.includes(config.serverPassword), false);
  const path = new URL(req.url, 'http://127.0.0.1').pathname;
  if (path === '/api/session' && req.method === 'POST') admitted++;
  if (path.endsWith('/interrupt')) interrupts++;
  if (behavior === 'prompt-failure' && path.endsWith('/prompt')) {
    res.writeHead(503).end(config.serverPassword);
    return;
  }
  const response = await fetcher('http://127.0.0.1:4096' + req.url, {
    method:req.method,
    headers:{authorization:req.headers.authorization},
    body:raw || undefined, redirect:'error', cache:'no-store',
  });
  res.writeHead(response.status, {'content-type':'application/json'});
  res.end(response.status === 204 ? undefined : await response.text());
});
try {
  await new Promise((resolve, reject) => {
    localServer.once('error', reject);
    localServer.listen(0, '127.0.0.1', resolve);
  });
  outcome = 'success';
  const liveConfig = {...config, baseUrl:'http://127.0.0.1:' + localServer.address().port};
  const runLocal = override => planWithOpenCodeV2({
    config:{...liveConfig,...override}, prompt:'Inspect project',
  });
  assert.equal((await runLocal()).plan, 'Reviewed architecture.');
  assert.equal(admitted, 1);
  await assert.rejects(runLocal({serverPassword:'wrong-disposable-password'}), error => {
    assert.equal(String(error).includes(config.serverPassword), false);
    return error.code === 'unavailable';
  });
  assert.equal(admitted, 1, 'HTTP 401 must stop before session creation');
  behavior = 'redirect';
  await assert.rejects(runLocal(), {code:'unavailable'});
  assert.equal(redirected, 0, 'native fetch must never follow redirects with credentials');
  assert.equal(admitted, 1);
  behavior = 'prompt-failure';
  await assert.rejects(runLocal(), error => {
    assert.equal(String(error).includes(config.serverPassword), false);
    return error.code === 'unavailable';
  });
  assert.equal(interrupts, 1, 'failure cleanup must authenticate too');
  console.log('OpenCode V2 authenticated loopback HTTP fixture passed (no model inference).');
} finally {
  localServer.closeAllConnections();
  await new Promise(resolve => localServer.close(resolve));
}
