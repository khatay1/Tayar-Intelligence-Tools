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
  await writeFile(entry, ['delivery', 'schema', 'store', 'events'].map(name =>
    `export * from ${JSON.stringify(resolve(`server/website-owned-email-${name}.ts`))};`).join('\n')
    + `\nexport * from ${JSON.stringify(resolve('src/modules/website-builder/core/editor-integration-runtime.ts'))};`
    + `\nexport * from ${JSON.stringify(resolve('src/modules/website-builder/core/editor-integration-events.ts'))};`);
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'test.cjs') });
  const { deliverOwnedEmail: deliver, compileOwnedEmailQueueSchema: compile, createOwnedEmailStore: rpcStore,
    createOwnedEmailEventDispatcher: eventDispatcher, dispatchEditorIntegrationEvent: dispatch,
    emitEditorBuilderIntegrationEvent: emit } = createRequire(import.meta.url)(join(dir, 'test.cjs'));
  const job = { id: jobId, projectId: project, environment: 'production', from, to: 'verified@example.com',
    subject: 'حجزك مؤكد', text: 'تم تأكيد حجزك.\nYour appointment is confirmed.' };
  function memoryStore() {
    const state = { status: 'pending', attempt: 0, leaseId: null, expiry: 0, first: null, next: 0,
      fingerprint: null, job: structuredClone(job), outcome: null };
    return { state,
      async claim(input) {
        if (input.jobId !== jobId || input.projectId !== project || input.environment !== 'production'
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
  const input = store => ({ jobId, projectId: project, environment: 'production', from, apiKey: credential, store, now });
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
  console.log('PASS owned email: durable leases, frozen retries, receipt-loss recovery, scope isolation and safe Resend outcomes');

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
      assert.ok(['app_email_enqueue', 'app_email_claim', 'app_email_finish'].includes(name));
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
    const enqueue = { p_id: jobId, p_user_id: user, p_environment: 'production', p_from: from, p_subject: job.subject, p_text: job.text };
    assert.equal((await dbClient.rpc('app_email_enqueue', enqueue)).data, true);
    assert.equal((await dbClient.rpc('app_email_enqueue', enqueue)).data, true);
    assert.ok((await dbClient.rpc('app_email_enqueue', { ...enqueue, p_text: 'Changed content' })).error);
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(query(`set role ${role}; select public.app_email_enqueue('${receipt}','${user}','production','${from}','test','test');`), /permission denied/);
      await assert.rejects(query(`set role ${role}; select * from private.app_email_jobs;`), /permission denied/);
      await assert.rejects(query(`set role ${role}; select private.app_email_claim('${jobId}','${project}','production','${'a'.repeat(64)}','${from}','${receipt}');`), /permission denied/);
    }
    await assert.rejects(query('set role service_role; select * from private.app_email_jobs;'), /permission denied/);
    const real = rpcStore(dbClient), leaseA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', leaseB = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const args = { jobId, projectId: project, environment: 'production', from, credentialFingerprint: 'a'.repeat(64), leaseId: leaseA };
    assert.equal(await real.claim({ ...args, projectId: receipt }), null);
    assert.equal(await real.claim({ ...args, environment: 'preview' }), null);
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
    console.log('PASS PostgreSQL owned email: private RPC grants, verified recipients, competing leases, receipt replay and expired/changed bindings');
  }
} finally { await rm(dir, { recursive: true, force: true }); }
