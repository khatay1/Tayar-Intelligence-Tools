import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
const dir = await mkdtemp(join(tmpdir(), 'tayar-formula-'));
try {
  const entry = join(dir, 'entry.ts');
  await writeFile(entry, ['application-validation', 'application-schema-sql', 'application-data-view']
    .map(name => `export * from ${JSON.stringify(resolve(`src/modules/website-builder/core/${name}`))};`).join('\n')
    + `\nexport * from ${JSON.stringify(resolve('server/website-owned-formula-catalog'))};`);
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'test.cjs') });
  const { readApplicationDefinition: validate, compileInitialApplicationSchema: compile,
    compileAdditiveApplicationMigration: migrate, parseApplicationDataViewValues: values,
    verifyOwnedFormulaCatalog: verify } = createRequire(import.meta.url)(join(dir, 'test.cjs'));
  const sourceFields = [
    { id: 'price', key: 'price', name: 'Price', type: 'number', required: true, defaultValue: 0 },
    { id: 'quantity', key: 'quantity', name: 'Quantity', type: 'number', required: true, defaultValue: 0 },
  ];
  const total = { id: 'total', key: 'total', name: 'Total', type: 'number', required: true,
    formula: { operation: 'multiply', fieldIds: ['price', 'quantity'] } };
  const table = { id: 'lines', key: 'lines', name: 'Lines', fields: [...sourceFields, total],
    permissions: ['read', 'create', 'update'].map(operation => ({ operation, access: 'owner' })) };
  const app = { version: 1, roles: [], pageAccess: [], auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, tables: [table],
    requirements: { version: 1, request: 'Calculate totals', items: [{ id: 'total', summary: 'Calculate totals', capability: 'formula', evidence: ['formula:lines'] }] } };
  validate(app);
  const sql = compile(app).join('\n');
  assert.match(sql, /"total" numeric generated always as \(\("price" \* "quantity"\)\) stored not null/);
  assert.deepEqual(values(table, { price: '2.5', quantity: '4' }, true), { price: 2.5, quantity: 4 });
  assert.throws(() => values(table, { price: 2.5, quantity: 4, total: 10 }, true), /Unknown record field/);
  for (const formula of [
    { operation: 'divide', fieldIds: ['price', 'quantity'] }, { operation: 'multiply', fieldIds: ['price'] },
    { operation: 'sum', fieldIds: ['price', 'price'] }, { operation: 'sum', fieldIds: ['price', 'missing'] },
  ]) assert.throws(() => validate({ ...app, tables: [{ ...table, fields: [...sourceFields, { ...total, formula }] }] }));
  const before = { ...app, requirements: undefined, tables: [{ ...table, fields: sourceFields }] };
  const additive = migrate(before, { ...app, requirements: undefined }).join('\n');
  assert.match(additive, /alter table public\."app_lines" add column "total" numeric generated always/);
  assert.throws(() => migrate({ ...app, requirements: undefined }, before), /reviewed/);
  console.log('PASS formulas: strict definitions, generated SQL, additive fields and rejected client writes');
  if (process.argv.includes('--postgres')) {
    const databaseUrl = process.env.TAYAR_BOOKING_TEST_DATABASE_URL, url = new URL(databaseUrl ?? 'http://invalid');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/tayar_booking_test') throw Error('Isolated local fixture database required');
    const query = sql => new Promise((resolveQuery, reject) => {
      const child = spawn('psql', [databaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t'], { stdio: ['pipe', 'pipe', 'pipe'] }); let output = '', error = '';
      child.stdout.on('data', data => output += data); child.stderr.on('data', data => error += data); child.on('error', reject);
      child.on('close', code => code ? reject(Error(error)) : resolveQuery(output.trim())); child.stdin.end(sql);
    });
    await query('drop schema private cascade; drop schema public cascade; create schema public; grant usage on schema public to anon,authenticated,service_role;');
    await query(sql);
    const owner = '11111111-1111-4111-8111-111111111111';
    const asOwner = `set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false);`;
    await query(`${asOwner} insert into public.app_lines(price,quantity) values(2.5,4);`);
    assert.equal(await query('select total from public.app_lines;'), '10.0');
    await query(`${asOwner} update public.app_lines set quantity=6;`);
    assert.equal(await query('select total from public.app_lines;'), '15.0');
    await assert.rejects(query(`${asOwner} update public.app_lines set total=999;`), /generated column/);
    await assert.rejects(query(`${asOwner} insert into public.app_lines(price,quantity,total) values(2,3,999);`), /generated column/);
    const catalog = async sql => JSON.parse(await query(`select coalesce(json_agg(x),'[]') from (${sql}) x;`));
    assert.equal(await verify(app, catalog), true);
    await query('alter table public.app_lines drop column total; alter table public.app_lines add column total numeric generated always as (price + quantity) stored;');
    assert.equal(await verify(app, catalog), false);
    console.log('PASS PostgreSQL formulas: derived inserts/updates and rejected result forgery');
  }
} finally { await rm(dir, { recursive: true, force: true }); }
