import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-email-'));
const project = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', user = '11111111-1111-4111-8111-111111111111';
const jobId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', receipt = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const credential = 're_private_fixture_never_log', from = 'receipts@example.com';
let clock = Date.parse('2026-10-09T10:00:00Z');
const now = () => new Date(clock);
try {
  const entry = join(dir, 'entry.ts');
  await writeFile(entry, ['delivery', 'schema', 'store', 'events', 'worker', 'rpc', 'rules'].map(name =>
    `export * from ${JSON.stringify(resolve(`server/website-owned-email-${name}.ts`))};`).join('\n')
    + `\nexport * from ${JSON.stringify(resolve('src/modules/website-builder/core/application-schema-sql.ts'))};`
    + `\nexport * from ${JSON.stringify(resolve('src/modules/website-builder/core/editor-integration-runtime.ts'))};`
    + `\nexport * from ${JSON.stringify(resolve('src/modules/website-builder/core/editor-integration-events.ts'))};`);
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'test.cjs') });
  const { deliverOwnedEmail: deliver, compileOwnedEmailQueueSchema: compile, createOwnedEmailStore: rpcStore,
    createOwnedEmailEventDispatcher: eventDispatcher, dispatchEditorIntegrationEvent: dispatch,
    emitEditorBuilderIntegrationEvent: emit, drainOwnedEmailQueue: drain, serveOwnedEmailWorker: serve, createOwnedEmailRpcClient: httpClient, compileOwnedEmailNotificationRules: rulesSql, compileInitialApplicationSchema: appSql } = createRequire(import.meta.url)(join(dir, 'test.cjs'));
  const job = { id: jobId, projectId: project, connectionId: 'mail', environment: 'production', from, to: 'verified@example.com',
    subject: 'حجزك مؤكد', text: 'تم تأكيد حجزك.\nYour appointment is confirmed.' };
  function memoryStore() {
    const state = { status: 'pending', attempt: 0, leaseId: null, expiry: 0, first: null, next: 0,
      fingerprint: null, job: structuredClone(job), outcome: null };
    return { state,
      async claim(input) {
        if (input.jobId !== jobId || input.projectId !== project || input.environment !== 'production' || input.connectionId !== 'mail'
          || !['pending', 'sending'].includes(state.status) || state.expiry > clock || state.next > clock) return null;
        if (state.fingerprint && state.fingerprint !== input.credentialFingerprint) { state.status = 'review'; return null; }
        state.status = 'sending'; state.fingerprint = input.credentialFingerprint; state.leaseId = input.leaseId;
        state.expiry = clock + 90_000; state.first ??= now().toISOString(); state.attempt++;
        return { job: structuredClone(state.job), leaseId: state.leaseId, attempt: state.attempt,
          firstAttemptAt: state.first, leaseExpiresAt: new Date(state.expiry).toISOString() };
      },
      async finish({ leaseId, outcome }) {
        if (leaseId !== state.leaseId || state.expiry <= clock) return false;
        state.outcome = outcome; state.status = outcome.status === 'retry' ? 'pending' : outcome.status;
        state.next = outcome.status === 'retry' ? Date.parse(outcome.retryAt) : 0; state.expiry = 0;
        return true;
      },
    };
  }
  const input = store => ({ jobId, projectId: project, connectionId: 'mail', environment: 'production', from, apiKey: credential, store, now });
  let store = memoryStore(), calls = [];
  const lost = await deliver({ ...input(store), fetcher: async (url, request) => {
    calls.push({ url, ...request }); throw Error(`DO NOT LOG ${credential}`);
  } });
  assert.equal(lost.status, 'retry'); assert.equal(store.state.status, 'pending');
  assert.ok(!JSON.stringify(lost).includes(credential));
  assert.equal((await deliver({ ...input(store), fetcher: () => assert.fail('Delayed retry must not send') })).status, 'idle');
  clock = Date.parse(lost.retryAt);
  const success = await deliver({ ...input(store), fetcher: async (url, request) => {
    calls.push({ url, ...request }); return Response.json({ id: receipt });
  } });
  assert.equal(success.status, 'accepted'); assert.equal(success.attempt, 2);
  assert.equal(calls[0].url, 'https://api.resend.com/emails'); assert.equal(calls[0].redirect, 'error');
  assert.equal(calls[0].body, calls[1].body); assert.equal(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key']);
  assert.ok(calls[0].headers['Idempotency-Key'].length < 256);
  assert.deepEqual(JSON.parse(calls[0].body).to, ['verified@example.com']);
  assert.equal((await deliver({ ...input(store), fetcher: () => assert.fail('Accepted job must not resend') })).status, 'idle');

  // Two competing workers acquire a single lease before the provider mutation.
  store = memoryStore(); let sends = 0;
  const pair = await Promise.all([1, 2].map(() => deliver({ ...input(store), fetcher: async () => {
    sends++; return Response.json({ id: receipt });
  } })));
  assert.equal(sends, 1); assert.deepEqual(pair.map(item => item.status).sort(), ['accepted', 'idle']);

  // Provider accepted, local commit lost: after lease expiry replay the same key.
  store = memoryStore(); const save = store.finish; let firstKey;
  store.finish = async () => { throw Error('receipt lost'); };
  assert.equal((await deliver({ ...input(store), fetcher: async (_, request) => {
    firstKey = request.headers['Idempotency-Key']; return Response.json({ id: receipt });
  } })).status, 'uncertain');
  clock += 91_000; store.finish = save;
  assert.equal((await deliver({ ...input(store), fetcher: async (_, request) => {
    assert.equal(request.headers['Idempotency-Key'], firstKey); return Response.json({ id: receipt });
  } })).status, 'accepted');

  for (const [response, expected] of [
    [Response.json({ name: 'concurrent_idempotent_requests' }, { status: 409 }), 'retry'],
    [Response.json({ name: 'invalid_idempotent_request' }, { status: 409 }), 'review'],
    [new Response('not-json', { status: 409 }), 'review'],
    [new Response('', { status: 429 }), 'retry'], [new Response('', { status: 503 }), 'retry'],
    [new Response('', { status: 403 }), 'failed'], [Response.json({ id: 'invalid' }), 'retry'],
    [new Response('x'.repeat(5000)), 'retry'],
  ]) {
    store = memoryStore(); assert.equal((await deliver({ ...input(store), fetcher: async () => response })).status, expected);
  }
  store = memoryStore(); store.state.first = new Date(clock - 20 * 3600_000).toISOString();
  assert.equal((await deliver({ ...input(store), fetcher: () => assert.fail('Expired deduplication must not send') })).status, 'review');
  store = memoryStore(); store.state.attempt = 7;
  assert.equal((await deliver({ ...input(store), fetcher: async () => { throw Error(); } })).status, 'review');
  store = memoryStore(); await deliver({ ...input(store), fetcher: async () => { throw Error(); } }); clock += 31_000;
  assert.equal((await deliver({ ...input(store), apiKey: 're_replacement_fixture_credential',
    fetcher: () => assert.fail('Changed provider credential must not resend') })).status, 'idle');
  assert.equal(store.state.status, 'review');
  for (const change of [{ to: 'victim@example.com\r\nBcc: attacker@example.com' }, { projectId: receipt },
    { subject: 'subject\nBcc: injected' }, { from: 'attacker@example.com' }]) {
    store = memoryStore(); Object.assign(store.state.job, change);
    assert.equal((await deliver({ ...input(store), fetcher: () => assert.fail('Unsafe frozen job must not send') })).status, 'unavailable');
  }
  store = memoryStore(); const originalClaim = store.claim;
  store.claim = async args => ({ ...await originalClaim(args), leaseExpiresAt: new Date(clock + 1000).toISOString() });
  assert.equal((await deliver({ ...input(store), fetcher: () => assert.fail('Expiring lease must not send') })).status, 'unavailable');
  store = memoryStore(); const fixedScopeClaim = store.claim, mutableDelivery = input(store);
  store.claim = async args => {
    mutableDelivery.apiKey = 're_rotated_during_claim_fixture'; mutableDelivery.projectId = receipt;
    return fixedScopeClaim(args);
  };
  mutableDelivery.fetcher = async (_, request) => {
    assert.equal(request.headers.Authorization, `Bearer ${credential}`);
    assert.ok(request.headers['Idempotency-Key'].includes(project)); return Response.json({ id: receipt });
  };
  assert.equal((await deliver(mutableDelivery)).status, 'accepted', 'Async configuration changes cannot replace the claimed credential or scope');

  // Durable event IDs pass through the shared boundary; browser mail fields are ignored.
  const ref = `secret://website/${project}/mail/apiKey/production`;
  const connection = { id: 'mail', providerId: 'resend', name: 'Receipts', enabled: true, status: 'active',
    environments: ['production'], config: { from }, secrets: { apiKey: { ref } }, events: ['form.submitted'] };
  const event = { id: 'form:record-1', event: 'form.submitted', projectId: project, environment: 'production',
    occurredAt: now().toISOString(), payload: { to: 'attacker@example.com', subject: 'Client override' } };
  const enqueues = [];
  const client = { async rpc(name, args) {
    if (name === 'app_email_enqueue') { enqueues.push(args); return { data: true, error: null }; }
    if (name === 'app_email_claim') return { data: { job: { ...job, id: args.p_id }, leaseId: args.p_lease_id,
      attempt: 1, firstAttemptAt: new Date().toISOString(), leaseExpiresAt: new Date(Date.now() + 90_000).toISOString() }, error: null };
    return { data: true, error: null };
  } };
  const handler = eventDispatcher({ projectId: project, environment: 'production', connectionId: 'mail', from, client,
    async resolveSecret(actual) { assert.equal(actual, ref); return credential; },
    async resolveTemplate() { return { sourceEventId: jobId, recipientUserId: user, subject: job.subject, text: job.text,
      id: 'template-cannot-override-identity', from: 'attacker@example.com', environment: 'preview' }; },
    async fetcher(_, request) { assert.deepEqual(JSON.parse(request.body).to, [job.to]); return Response.json({ id: receipt }); },
  });
  const adapter = { deliverEmail: handler, async resolveSecret() { assert.fail(); }, async request() { assert.fail(); } };
  assert.equal((await dispatch({ version: 1, connections: [connection] }, event, adapter))[0].status, 'accepted');
  assert.equal((await emit({ version: 1, connections: [connection] }, event, adapter))[0].status, 'accepted');
  assert.equal((await dispatch({ version: 1, connections: [connection] }, { ...event, id: 'another-client-envelope' }, adapter))[0].status, 'accepted');
  assert.equal(enqueues[0].p_id, enqueues[1].p_id); assert.equal(enqueues[0].p_user_id, user);
  assert.equal(enqueues[0].p_id, enqueues[2].p_id, 'A different browser envelope cannot turn one committed event into another email');
  assert.equal(enqueues[0].p_from, from); assert.equal(enqueues[0].p_environment, 'production');
  assert.ok(!JSON.stringify(enqueues).includes('attacker@example.com'));
  const before = enqueues.length;
  assert.equal((await handler(connection, { ...event, projectId: receipt })).status, 'failed');
  assert.equal((await handler({ ...connection, secrets: { apiKey: { ref: ref.replace('/production', '/preview') } } }, event)).status, 'failed');
  assert.equal(enqueues.length, before);
  await assert.rejects(rpcStore({ async rpc() { return { data: null, error: Error(credential) }; } }).claim({}), /Email claim unavailable/);
  const workerScope = { projectId: project, environment: 'production', connections: [{ id: 'mail', from, apiKey: credential }] };
  const cronSecret = 'private_cron_fixture_01234567890123456789', workerOrigin = 'https://customer.example.com';
  const workerUrl = `${workerOrigin}/api/application-email-worker`;
  let dueCalls = 0, workerSends = 0;
  const workerClient = { async rpc(name, args) {
    if (name === 'app_email_due') { dueCalls++; assert.equal(args.p_connection_id, 'mail'); return { data: [jobId], error: null }; }
    return client.rpc(name, args);
  } };
  const workerInput = { ...workerScope, applicationOrigin: workerOrigin, cronSecret,
    client: () => workerClient, fetcher: async () => { workerSends++; return Response.json({ id: receipt }); } };
  for (const [request, status] of [
    [new Request(workerUrl), 401],
    [new Request(workerUrl, { headers: { authorization: 'Bearer ' + 'wrong'.repeat(8) } }), 401],
    [new Request(workerUrl + '?environment=preview', { headers: { authorization: `Bearer ${cronSecret}` } }), 403],
    [new Request(workerUrl, { headers: { authorization: `Bearer ${cronSecret}`, origin: workerOrigin } }), 403],
    [new Request(workerUrl, { method: 'POST', headers: { authorization: `Bearer ${cronSecret}` }, body: JSON.stringify({ to: 'attacker@example.com' }) }), 405],
    [new Request(workerUrl.replace(workerOrigin, 'https://foreign.example.com'), { headers: { authorization: `Bearer ${cronSecret}` } }), 403],
  ]) {
    const response = await serve(request, { ...workerInput, client: () => assert.fail('Rejected cron must not construct a credentialed client') });
    assert.equal(response.status, status); assert.match(response.headers.get('cache-control'), /no-store/);
    assert.ok(!(await response.text()).includes(credential));
  }
  assert.equal(workerSends, 0); assert.equal(dueCalls, 0);
  const workerResponse = await serve(new Request(workerUrl, { headers: { authorization: `Bearer ${cronSecret}` } }), workerInput);
  assert.equal(workerResponse.status, 200); const workerCounts = await workerResponse.json();
  assert.equal(workerCounts.accepted, 1); assert.equal(workerSends, 1);
  assert.ok(!JSON.stringify(workerCounts).includes(job.to)); assert.ok(!JSON.stringify(workerCounts).includes(receipt));
  for (const data of [[jobId, jobId], [jobId, 'bad-id'], Array(5).fill(jobId), { ids: [jobId] }]) {
    await assert.rejects(drain({ ...workerScope, client: { async rpc() { return { data, error: null }; } },
      fetcher: () => assert.fail('Malformed due list must not send') }), /Email queue unavailable/);
  }
  let monotonic = 0;
  const budgetCounts = await drain({ ...workerScope, monotonicNow: () => monotonic,
    client: { async rpc(name, args) {
      if (name === 'app_email_due') return { data: [jobId, receipt], error: null };
      if (name === 'app_email_claim') monotonic = 26_000;
      return workerClient.rpc(name, args);
    } }, fetcher: async () => Response.json({ id: receipt }) });
  assert.equal(budgetCounts.scanned, 1, 'Budget ends the batch without claiming another job');

  const projectRef = 'abcdefghijklmnopqrst', backend = { projectRef, url: `https://${projectRef}.supabase.co`, publishableKey: 'sb_publishable_fixture' };
  const privateKey = 'sb_secret_fixture_only_01234567890123456789'; let httpCalls = 0;
  const http = httpClient({ backend, expectedProjectRef: projectRef, secretKey: privateKey, async fetcher(url, request) {
    httpCalls++; assert.equal(url, `${backend.url}/rest/v1/rpc/app_email_due`);
    assert.equal(request.headers.apikey, privateKey); assert.equal(request.headers.Authorization, undefined);
    assert.equal(request.redirect, 'error'); assert.equal(request.cache, 'no-store'); return Response.json([jobId]);
  } });
  assert.deepEqual((await http.rpc('app_email_due', {})).data, [jobId]);
  assert.equal((await http.rpc('auth_admin_delete_user', {})).error, true); assert.equal(httpCalls, 1);
  const token = (role, ref, exp=Date.now()/1000+3600) => `header.${Buffer.from(JSON.stringify({ role, ref, iss: 'supabase', exp })).toString('base64url')}.signature`;
  for (const key of [backend.publishableKey, token('anon', projectRef), token('service_role', 'foreignprojectrefxxxx'), token('service_role',projectRef,1), privateKey + '\r\nInjected: secret']) {
    assert.throws(() => httpClient({ backend, expectedProjectRef: projectRef, secretKey: key }), /credentials unavailable/);
  }
  assert.throws(() => httpClient({ backend: { ...backend, url: 'https://attacker.example.com' }, expectedProjectRef: projectRef, secretKey: privateKey }));
  const legacyKey = token('service_role', projectRef);
  await httpClient({ backend, expectedProjectRef: projectRef, secretKey: legacyKey, async fetcher(_, request) {
    assert.equal(request.headers.Authorization, `Bearer ${legacyKey}`); return Response.json([]);
  } }).rpc('app_email_due', {});
  const rejectedHttp = await httpClient({ backend, expectedProjectRef: projectRef, secretKey: privateKey,
    async fetcher() { throw Error(privateKey); } }).rpc('app_email_due', {});
  assert.deepEqual(rejectedHttp, { data: null, error: true }); assert.ok(!JSON.stringify(rejectedHttp).includes(privateKey));
  await httpClient({ backend: { ...backend,url: backend.url+'/' }, expectedProjectRef: projectRef, secretKey: privateKey,
    async fetcher(url) { assert.equal(url,`${backend.url}/rest/v1/rpc/app_email_due`); return Response.json([]); }
  }).rpc('app_email_due', {});
  assert.equal((await httpClient({ backend, expectedProjectRef: projectRef, secretKey: privateKey,
    async fetcher() { return new Response('x'.repeat(150_001)); } }).rpc('app_email_due', {})).error, true);
  const notificationTable = { id: 'appointments', key: 'appointments', name: 'Appointments', fields: [
    { id: 'name', key: 'name', name: 'Name', type: 'text', required: true },
    { id: 'start', key: 'starts_at', name: 'Start', type: 'datetime', required: true },
    { id: 'state', key: 'state', name: 'State', type: 'enum', required: true, defaultValue: 'pending', options: ['pending','confirmed','cancelled'] },
  ], permissions: ['read','create','update'].map(operation=>({ operation, access: 'owner' })),
    workflow: { fieldId: 'state', transitions: [{ id: 'confirm', label: 'Confirm', from: ['pending'], to: 'confirmed', access: 'owner' }] } };
  const definition = { version: 1, roles: [], pageAccess: [], tables: [notificationTable],
    auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true } };
  const rule = { id: 'created', tableId: 'appointments', connectionId: 'mail', from, event: { type: 'created' },
    subject: 'Booking {{field:name}}', text: 'Appointment {{record.id}} at {{field:start}}. $tayar_email_rule$ $rule$ Quote: \'safe\'' };
  const transitionRule = { ...rule, id: 'confirmed', event: { type: 'transition', transitionId: 'confirm' },
    subject: 'Confirmed {{field:name}}', text: '{{field:state}}' };
  const compiledRules = rulesSql({ definition, environment: 'production', rules: [rule,transitionRule] }).join('\n');
  assert.match(compiledRules, /as \$tayar_email_rule_1\$/); assert.match(compiledRules, /after insert/);
  assert.match(compiledRules, /after update/); assert.match(compiledRules, /at time zone 'UTC'/);
  assert.ok(!compiledRules.includes(credential));
  for (const change of [{ subject: 'Header\nInjection' }, { subject: '{{field:unknown}}' },
    { text: '{{html:script}}' }, { to: 'attacker@example.com' }, { event: { type: 'transition', transitionId: 'unknown' } }]) {
    assert.throws(()=>rulesSql({ definition, environment: 'production', rules: [{ ...rule,...change }] }));
  }
  assert.throws(()=>rulesSql({ definition: { ...definition, tables: [{ ...notificationTable,
    permissions: notificationTable.permissions.filter(item=>item.operation!=='read') }] }, environment: 'production', rules: [rule] }));
  assert.throws(()=>rulesSql({ definition: { ...definition, tables: [{ ...notificationTable, workflow: { ...notificationTable.workflow,
    transitions: [...notificationTable.workflow.transitions,{ id:'force',label:'Force',from:['pending'],to:'confirmed',access:'owner' }] } }] },
    environment:'production',rules:[transitionRule] }));
  console.log('PASS owned email: durable leases, frozen retries, receipt-loss recovery, scope isolation and safe Resend outcomes');
  console.log('PASS owned email worker: cron authorization, immutable scope, batch budget, due-list validation and private customer RPC boundaries');
  console.log('PASS email notification rules: owner-only recipients, strict declared variables, safe SQL literals and unambiguous workflow events');

  if (process.argv.includes('--postgres')) {
    const databaseUrl = process.env.TAYAR_BOOKING_TEST_DATABASE_URL, url = new URL(databaseUrl ?? 'http://invalid');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname)
      || url.pathname !== '/tayar_booking_test') throw Error('Isolated fixture database required');
    const query = sql => new Promise((resolveQuery, reject) => {
      const child = spawn('psql', [databaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t'], { stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '', error = '';
      child.stdout.on('data', data => output += data); child.stderr.on('data', data => error += data); child.on('error', reject);
      child.on('close', code => code ? reject(Error(error)) : resolveQuery(output.trim())); child.stdin.end(sql);
    });
    const literal = value => value === null ? 'null' : `'${(typeof value === 'object' ? JSON.stringify(value) : String(value)).replaceAll("'", "''")}'`;
    const dbClient = { async rpc(name, args) {
      assert.ok(['app_email_due', 'app_email_enqueue', 'app_email_claim', 'app_email_finish'].includes(name));
      try {
        const data = await query(`set role service_role; select to_jsonb(public.${name}(${Object.entries(args)
          .map(([key, value]) => `${key}=>${literal(value)}`).join(',')}));`);
        return { data: data ? JSON.parse(data) : null, error: null };
      } catch (error) { return { data: null, error }; }
    } };
    await query(`drop schema private cascade; drop schema public cascade; create schema public;
      grant usage on schema public to anon,authenticated,service_role;
      alter table auth.users add column if not exists email text;
      alter table auth.users add column if not exists email_confirmed_at timestamptz;
      alter table auth.users add column if not exists banned_until timestamptz;
      update auth.users set email='verified@example.com',email_confirmed_at=clock_timestamp(),is_anonymous=false where id='${user}';`);
    await query(compile(project));
    const enqueue = { p_id: jobId, p_connection_id: 'mail', p_user_id: user, p_environment: 'production', p_from: from, p_subject: job.subject, p_text: job.text };
    assert.equal((await dbClient.rpc('app_email_enqueue', enqueue)).data, true);
    assert.equal((await dbClient.rpc('app_email_enqueue', enqueue)).data, true);
    assert.ok((await dbClient.rpc('app_email_enqueue', { ...enqueue, p_text: 'Changed content' })).error);
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(query(`set role ${role}; select public.app_email_enqueue('${receipt}','mail','${user}','production','${from}','test','test');`), /permission denied/);
      await assert.rejects(query(`set role ${role}; select * from private.app_email_jobs;`), /permission denied/);
      await assert.rejects(query(`set role ${role}; select private.app_email_claim('${jobId}','${project}','production','mail','${'a'.repeat(64)}','${from}','${receipt}');`), /permission denied/);
      await assert.rejects(query(`set role ${role}; select public.app_email_due('${project}','production','mail',4);`), /permission denied/);
    }
    await assert.rejects(query('set role service_role; select * from private.app_email_jobs;'), /permission denied/);
    const real = rpcStore(dbClient), leaseA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', leaseB = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const args = { jobId, projectId: project, connectionId: 'mail', environment: 'production', from, credentialFingerprint: 'a'.repeat(64), leaseId: leaseA };
    assert.equal(await real.claim({ ...args, projectId: receipt }), null);
    assert.equal(await real.claim({ ...args, environment: 'preview' }), null);
    assert.equal(await real.claim({ ...args, connectionId: 'other-mail' }), null);
    const claims = await Promise.all([real.claim(args), real.claim({ ...args, leaseId: leaseB })]);
    assert.equal(claims.filter(Boolean).length, 1);
    const claim = claims.find(Boolean), winner = claim.leaseId;
    assert.equal(claim.job.to, 'verified@example.com'); assert.equal(claim.attempt, 1);
    assert.equal(await real.finish({ jobId, leaseId: winner === leaseA ? leaseB : leaseA, outcome: { status: 'accepted', providerId: receipt } }), false);
    await query(`update private.app_email_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id='${jobId}';`);
    assert.equal(await real.finish({ jobId, leaseId: winner, outcome: { status: 'accepted', providerId: receipt } }), false);
    const reclaimed = await real.claim({ ...args, leaseId: leaseB }); assert.equal(reclaimed.attempt, 2);
    assert.equal(reclaimed.firstAttemptAt, claim.firstAttemptAt);
    assert.equal(await real.finish({ jobId, leaseId: leaseB, outcome: { status: 'accepted', providerId: receipt } }), true);
    assert.equal(await real.claim(args), null);
    assert.equal(await query(`select status||':'||provider_id from private.app_email_jobs where id='${jobId}';`), `accepted:${receipt}`);

    // Isolated database roundtrip through the real worker, then simulated lost receipt.
    await query(`delete from private.app_email_jobs;`); assert.equal((await dbClient.rpc('app_email_enqueue', enqueue)).data, true);
    let sentKey;
    const broken = { claim: real.claim, async finish() { throw Error('commit response lost'); } };
    assert.equal((await deliver({ ...input(broken), now: undefined, fetcher: async (_, request) => {
      sentKey = request.headers['Idempotency-Key']; return Response.json({ id: receipt });
    } })).status, 'uncertain');
    await query(`update private.app_email_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id='${jobId}';`);
    assert.equal((await deliver({ ...input(real), now: undefined, fetcher: async (_, request) => {
      assert.equal(request.headers['Idempotency-Key'], sentKey); return Response.json({ id: receipt });
    } })).status, 'accepted');
    for (const update of [
      `credential_fingerprint='${'b'.repeat(64)}'`,
      `first_attempt_at=clock_timestamp()-interval '21 hours'`, `attempt=8`,
    ]) {
      await query(`update private.app_email_jobs set status='pending',lease_id=null,lease_expires_at=null,${update} where id='${jobId}';`);
      assert.equal((await deliver({ ...input(real), now: undefined, fetcher: () => assert.fail('Unsafe retry must not send') })).status, 'idle');
      assert.equal(await query(`select status from private.app_email_jobs where id='${jobId}';`), 'review');
      await query(`update private.app_email_jobs set credential_fingerprint=null,first_attempt_at=null,attempt=0 where id='${jobId}';`);
    }
    await query(`update private.app_email_jobs set status='pending'; update auth.users set email='changed@example.com' where id='${user}';`);
    assert.equal(await real.claim(args), null);
    assert.equal(await query('select status from private.app_email_jobs;'), 'failed');
    await query(`update auth.users set email_confirmed_at=null where id='${user}';`);
    assert.ok((await dbClient.rpc('app_email_enqueue', { ...enqueue, p_id: receipt })).error);
    await query(`update auth.users set email_confirmed_at=clock_timestamp(),banned_until=clock_timestamp()+interval '1 hour' where id='${user}';`);
    assert.ok((await dbClient.rpc('app_email_enqueue', { ...enqueue, p_id: receipt })).error);
    await query(`update auth.users set banned_until=null,is_anonymous=true where id='${user}';`);
    assert.ok((await dbClient.rpc('app_email_enqueue', { ...enqueue, p_id: receipt })).error);
    // Background worker selects only due jobs in its captured connection/environment.
    await query(`delete from private.app_email_jobs; update auth.users set email='verified@example.com',email_confirmed_at=clock_timestamp(),is_anonymous=false where id='${user}';`);
    for (const item of [enqueue, { ...enqueue, p_id: receipt, p_environment: 'preview' },
      { ...enqueue, p_id: leaseA, p_connection_id: 'other-mail' }, { ...enqueue, p_id: leaseB }]) {
      assert.equal((await dbClient.rpc('app_email_enqueue', item)).data, true);
    }
    await query(`update private.app_email_jobs set next_attempt_at=clock_timestamp()+interval '1 hour' where id='${leaseB}';`);
    const dueArgs = { p_project_id: project, p_environment: 'production', p_connection_id: 'mail', p_limit: 4 };
    assert.deepEqual((await dbClient.rpc('app_email_due', dueArgs)).data, [jobId]);
    assert.deepEqual((await dbClient.rpc('app_email_due', { ...dueArgs, p_environment: 'preview' })).data, [receipt]);
    assert.deepEqual((await dbClient.rpc('app_email_due', { ...dueArgs, p_connection_id: 'other-mail' })).data, [leaseA]);
    assert.deepEqual((await dbClient.rpc('app_email_due', { ...dueArgs, p_project_id: receipt })).data, []);
    assert.deepEqual((await dbClient.rpc('app_email_due', { ...dueArgs, p_limit: 0 })).data, []);
    const drained = await drain({ ...workerScope, client: dbClient, fetcher: async () => Response.json({ id: receipt }) });
    assert.equal(drained.accepted, 1);
    assert.equal(await query(`select status from private.app_email_jobs where id='${leaseA}';`), 'pending');
    assert.equal(await query(`select status from private.app_email_jobs where id='${receipt}';`), 'pending');
    const requestsById = new Map();
    await query(`update private.app_email_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id='${leaseB}';`);
    const competing = await Promise.all([1,2].map(() => drain({ ...workerScope, client: dbClient, async fetcher(_, request) {
      const key = request.headers['Idempotency-Key']; requestsById.set(key,(requestsById.get(key)??0)+1);
      return Response.json({ id: receipt });
    } })));
    assert.equal([...requestsById.values()].reduce((sum,value)=>sum+value,0), 1);
    assert.equal(competing.reduce((sum,item)=>sum+item.accepted,0), 1);
    await query('delete from private.app_email_jobs;');
    await query(appSql(definition).join('\n'));
    await query(compiledRules);
    const rowId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const asOwner = `set role authenticated; set request.jwt.claim.sub='${user}'; set request.jwt.claim.is_anonymous='false';`;
    await query(`${asOwner} begin; insert into public.app_appointments(id,name,starts_at) values('${rowId}','Rollback','2026-10-10T09:00:00Z'); rollback;`);
    assert.equal(await query('select count(*) from private.app_email_jobs;'), '0', 'Rolled-back record has no queued message');
    const dangerousName = 'Name\nBcc: attacker@example.com $tayar_email_rule$';
    await query(`${asOwner} insert into public.app_appointments(id,name,starts_at) values('${rowId}',${literal(dangerousName)},'2026-10-10T09:00:00+02:00');`);
    const frozen = await query("select jsonb_build_object('subject',subject,'body',body,'recipient',recipient) from private.app_email_jobs;");
    const frozenValue = JSON.parse(frozen);
    assert.ok(!frozenValue.subject.includes('\n')); assert.equal(frozenValue.recipient, 'verified@example.com');
    assert.ok(frozenValue.body.includes('2026-10-10T07:00:00.000Z')); assert.ok(frozenValue.body.includes("Quote: 'safe'"));
    await query(`${asOwner} update public.app_appointments set name='Later change' where id='${rowId}';`);
    assert.equal(await query('select count(*) from private.app_email_jobs;'), '1');
    assert.equal(await query("select jsonb_build_object('subject',subject,'body',body,'recipient',recipient) from private.app_email_jobs;"), frozen);
    await assert.rejects(query(`${asOwner} update public.app_appointments set state='confirmed' where id='${rowId}';`), /atomic transition/);
    await query(`${asOwner} select public.app_transition_workflow_0('${rowId}','confirm','${jobId}');`);
    assert.equal(await query('select count(*) from private.app_email_jobs;'), '2');
    await query(`${asOwner} select public.app_transition_workflow_0('${rowId}','confirm','${jobId}');`);
    assert.equal(await query('select count(*) from private.app_email_jobs;'), '2', 'Replayed workflow does not queue another message');
    assert.equal(await query("select body from private.app_email_jobs where subject like 'Confirmed%';"), 'confirmed');
    await assert.rejects(query(`set role authenticated; select private.app_email_rule_0();`), /permission denied/);
    const other = '22222222-2222-4222-8222-222222222222';
    assert.equal(await query(`set role authenticated; set request.jwt.claim.sub='${other}'; update public.app_appointments set name='Foreign' where id='${rowId}' returning 1;`), '', 'Foreign row is hidden');
    assert.equal(await query('select count(*) from private.app_email_jobs;'), '2');
    await query(`update auth.users set email_confirmed_at=null where id='${user}';`);
    await query(`${asOwner} insert into public.app_appointments(name,starts_at) values('Unverified','2026-10-10T09:00:00Z');`);
    assert.equal(await query('select count(*) from private.app_email_jobs;'), '2', 'Unverified recipients do not queue mail');
    console.log('PASS PostgreSQL owned email: private RPC grants, verified recipients, competing leases, receipt replay and expired/changed bindings');
    console.log('PASS PostgreSQL email worker: due-time, connection and environment isolation; overlapping batches send a job once');
    console.log('PASS PostgreSQL email rules: atomic rollback, frozen UTC templates, guarded transitions, replay/foreign/unverified isolation');
  }
} finally { await rm(dir, { recursive: true, force: true }); }
