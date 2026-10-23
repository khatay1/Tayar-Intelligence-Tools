import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createApplicationReferenceProjects } from './fixtures/application-reference-projects.mjs';

const dir = await mkdtemp(join(tmpdir(), 'tayar-reference-projects-'));
try {
  const entry = join(dir, 'reference-projects.ts'), outfile = join(dir, 'reference-projects.cjs');
  await writeFile(entry, [
    `export { readApplicationDefinition } from ${JSON.stringify(resolve('src/modules/website-builder/core/application-validation'))};`,
    `export { compileInitialApplicationSchema } from ${JSON.stringify(resolve('src/modules/website-builder/core/application-schema-sql'))};`,
    `export { prepareGeneratedApplication } from ${JSON.stringify(resolve('src/modules/website-builder/core/editor-generated-application'))};`,
    `export { buildApplicationRequirementCoverage } from ${JSON.stringify(resolve('src/modules/website-builder/core/application-requirements'))};`,
    `export { compileApplicationDataView } from ${JSON.stringify(resolve('src/modules/website-builder/core/application-data-view'))};`,
    `export { renderWebsiteApplicationSnapshot } from ${JSON.stringify(resolve('src/modules/website-builder/services/websiteApplicationRenderService'))};`,
    `export { preparePublishedApplicationDataViews } from ${JSON.stringify(resolve('src/modules/website-builder/core/application-published-data-views'))};`,
    `export { addApplicationPageBootstrap } from ${JSON.stringify(resolve('src/modules/website-builder/services/websiteApplicationPageBootstrapService'))};`
  ].join('\n'));
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile, alias: { '@': resolve('src') } });
  const { readApplicationDefinition: validate, compileInitialApplicationSchema: compile,
    prepareGeneratedApplication, buildApplicationRequirementCoverage, compileApplicationDataView,
    renderWebsiteApplicationSnapshot, preparePublishedApplicationDataViews, addApplicationPageBootstrap } = (await import(pathToFileURL(outfile))).default;
  const references = createApplicationReferenceProjects();

  for (const reference of references) {
    assert.doesNotThrow(() => validate(reference.definition), `${reference.domain} definition should satisfy the native application contract`);
    const schema = compile(reference.definition).join('\n');
    assert.match(schema, /enable row level security/, `${reference.domain} tables keep RLS enabled`);
    assert.match(schema, /owner_id = \(select auth\.uid\(\)\)/, `${reference.domain} owner data is isolated`);
    assert.match(schema, reference.expected, `${reference.domain} emits its expected native backend behavior`);

    const table = reference.definition.tables[0];
    const pageId = `${reference.domain}-overview`;
    const featureTable = reference.definition.tables.find(item => item.id === reference.feature.tableId);
    assert.ok(featureTable, `${reference.domain} primary feature table exists`);
    const page = { id: pageId, name: 'Overview', slug: 'overview', sections: reference.definition.tables.map(item => ({
      id: `${reference.domain}-${item.id}-records`, type: 'features', title: item.name,
      applicationDataView: { tableId: item.id, columns: item.fields.map(field => field.id),
        actions: item.transaction ? ['transact'] : item.workflow ? ['transition'] : item.attachments ? ['attachments']
          : item.booking ? ['create'] : [], pageSize: 10,
        ...(reference.domain === 'real-estate' && item.id === 'properties'
          ? { searchFieldId: 'headline', filterFieldId: 'listing-status' } : {}) },
    })) };
    const featureAction = reference.feature.action;
    const coveragePage = structuredClone(page);
    const featureView = coveragePage.sections.find(section => section.applicationDataView.tableId === featureTable.id).applicationDataView;
    assert.doesNotThrow(() => compileApplicationDataView(reference.definition, featureView),
      `${reference.domain} primary data view compiles`);
    const featureEvidence = reference.feature.capability === 'formula'
      ? `formula:${featureTable.id}` : `${reference.feature.capability}:${featureTable.id}`;
    const requirements = [
      { id: 'account-access', summary: 'Users can securely access their workspace.', capability: 'auth', evidence: ['auth'] },
      { id: 'overview-page', summary: 'Users can open the project overview.', capability: 'page', evidence: ['page:overview'] },
      { id: 'records-view', summary: `Users can read ${reference.domain} records.`, capability: 'records', evidence: [`view:${table.id}:read`] },
    ];
    const projectSpecification = {
      version: 1, intent: `Create a secure ${reference.domain} application with an overview and owner-scoped records.`,
      actors: [{ id: 'user', name: 'Project user' }],
      entities: reference.definition.tables.map(item => ({ id: item.id, scope: 'owner',
        classification: ['clinic', 'government'].includes(reference.domain) ? 'restricted'
          : reference.domain === 'school' || reference.domain === 'custom-research' ? 'confidential' : 'internal' })),
      requirements: requirements.map(item => ({ id: item.id, origin: 'explicit', acceptanceCriteria: [`${item.summary} The current generated project provides its declared implementation.`] })),
      operations: [
        { id: 'authenticate', summary: 'Authenticate the project user.', actorIds: ['user'], entityIds: [], requirementIds: ['account-access'], dependsOn: [], execution: 'native', transactional: false },
        { id: 'open-overview', summary: 'Open the generated overview page.', actorIds: ['user'], entityIds: [], requirementIds: ['overview-page'], dependsOn: ['authenticate'], execution: 'native', transactional: false },
        { id: 'read-records', summary: `Read owner-scoped ${reference.domain} records.`, actorIds: ['user'], entityIds: [table.id], requirementIds: ['records-view'], dependsOn: ['authenticate', 'open-overview'], execution: 'native', transactional: false },
      ],
      rules: [{ id: 'owner-scoped-records', summary: 'Users can read only records allowed by the declared owner policy.', operationIds: ['read-records'] }],
      tenancy: { mode: 'single' }, integrations: [],
      privacy: reference.definition.tables.filter(() => ['clinic', 'government', 'school', 'custom-research'].includes(reference.domain))
        .map(item => ({ entityId: item.id, purpose: `Operate the ${reference.domain} application.`, retentionDays: 365 })),
      decisions: [],
    };
    const prepared = prepareGeneratedApplication({ projectKind: 'application', application: structuredClone(reference.definition), requirements, projectSpecification }, [page],
      `Create a secure ${reference.domain} application with a project overview and record access.`, new Set(), true);
    assert.doesNotThrow(() => validate(prepared), `${reference.domain} generated application remains valid`);
    const coverage = buildApplicationRequirementCoverage(prepared, [coveragePage]);
    assert.equal(coverage.length, requirements.length, `${reference.domain} reports every requirement`);
    assert.ok(coverage.every(row => row.deliveryStatus === 'blocked'
      && row.tests.some(test => test.kind === 'acceptance' && test.result === 'not-run')),
    `${reference.domain} stays blocked until criterion-specific tests execute: ${JSON.stringify(coverage)}`);
    const featureCoverageApplication = structuredClone(reference.definition);
    featureCoverageApplication.requirements = {
      version: 1, request: `Reference ${reference.domain} primary capability coverage.`,
      items: [{
        id: 'primary-feature',
        summary: `Users can use the ${reference.feature.capability} capability in ${reference.domain}.`,
        capability: reference.feature.capability, evidence: [featureEvidence],
      }],
    };
    const coverageWithPrimaryFeature = buildApplicationRequirementCoverage(featureCoverageApplication, [coveragePage]);
    const featureCoverage = coverageWithPrimaryFeature.find(row => row.requirementId === 'primary-feature');
    assert.equal(featureCoverage?.tests[0]?.id, `contract:${featureEvidence}`);
    assert.equal(featureCoverage?.tests[0]?.result, 'passed',
      `${reference.domain} primary capability is backed by its compiled data view: ${JSON.stringify(featureCoverage)}`);
    assert.equal(featureCoverage?.deliveryStatus, 'blocked',
      `${reference.domain} compilation without structured acceptance criteria cannot prove behavioral coverage`);
    const unboundFeaturePage = structuredClone(coveragePage);
    const featureSection = unboundFeaturePage.sections.find(section => section.applicationDataView.tableId === featureTable.id);
    if (featureAction) featureSection.applicationDataView.actions = featureSection.applicationDataView.actions.filter(action => action !== featureAction);
    else featureSection.applicationDataView.columns = featureSection.applicationDataView.columns.filter(id => id !== featureTable.fields.find(field => field.formula)?.id);
    const unboundCoverage = buildApplicationRequirementCoverage(featureCoverageApplication, [unboundFeaturePage]);
    assert.equal(unboundCoverage.find(row => row.requirementId === 'primary-feature')?.deliveryStatus, 'blocked',
      `${reference.domain} missing primary feature binding blocks coverage`);
    assert.deepEqual(prepared.requirements.specification, projectSpecification, `${reference.domain} retains its validated project specification`);

    const snapshot = { application: reference.definition, homePageId: pageId, pages: [structuredClone(page)],
      siteName: `Reference ${reference.domain}`, siteUrl: 'https://reference.invalid' };
    const renderedPages = await renderWebsiteApplicationSnapshot(snapshot);
    assert.equal(renderedPages.length, 1, `${reference.domain} renders one generated application page`);
    const publishedViews = preparePublishedApplicationDataViews(reference.definition, pageId, page.sections);
    const runtimeResponse = await addApplicationPageBootstrap(new Response(renderedPages[0].content, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }), {
      language: 'en', returnPath: '/account', applicationOrigin: 'https://reference.invalid',
      definition: reference.definition, paths: ['/overview'], pageId, applicationForms: [],
      applicationDataViews: publishedViews,
      backend: { url: 'https://reference.supabase.co', projectRef: 'reference', publishableKey: 'sb_publishable_fixture' },
    });
    const runtimeHtml = await runtimeResponse.text();
    assert.match(runtimeHtml, /data-tayar-application-runtime/, `${reference.domain} page receives the real application runtime bootstrap`);
    const encodedConfig = /data-application="([^"]+)"/.exec(runtimeHtml)?.[1];
    assert.ok(encodedConfig, `${reference.domain} runtime config is attached to rendered HTML`);
    const runtimeConfig = JSON.parse(encodedConfig.replaceAll('&quot;', '"').replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>').replaceAll('&amp;', '&'));
    const primaryView = runtimeConfig.applicationDataViews.find(view => view.sectionId === `${reference.domain}-${featureTable.id}-records`);
    assert.equal(primaryView?.binding.tableId, featureTable.id, `${reference.domain} runtime binds its primary feature table`);
    if (reference.domain === 'real-estate') {
      assert.equal(primaryView.binding.filterFieldId, 'listing-status', 'Real-estate status filter survives generation and runtime bootstrap');
      assert.equal(primaryView.binding.searchFieldId, 'headline');
    }
    if (featureAction) assert.ok(primaryView.binding.actions.includes(featureAction),
      `${reference.domain} generated page exposes its declared ${featureAction} operation`);
    else assert.ok(primaryView.binding.columns.includes(featureTable.fields.find(item => item.formula).id),
      'school runtime page includes its calculated total field');
    assert.deepEqual(runtimeConfig.definition, reference.definition, `${reference.domain} runtime uses the generated project definition`);

    const brokenPage = structuredClone(page);
    brokenPage.sections[0].applicationDataView.tableId = 'missing-table';
    assert.throws(() => prepareGeneratedApplication({ projectKind: 'application', application: structuredClone(reference.definition), requirements, projectSpecification },
      [brokenPage], `Create a secure ${reference.domain} application`, new Set(), true), /data view|table|invalid/i,
    `${reference.domain} rejects an unbound record view before applying the application`);
  }

  const generatedOnly = { ...references[0].definition, tables: references[0].definition.tables.map(item => ({ ...item })) };
  generatedOnly.tables[0].permissions = generatedOnly.tables[0].permissions.filter(rule => rule.operation !== 'update');
  assert.throws(() => validate(generatedOnly), /transaction|counter/i, 'unsafe transaction permissions fail closed');
  const invalidBookingResource = { ...references[3].definition, tables: references[3].definition.tables.map(item => ({ ...item, fields: item.fields.map(field => ({ ...field })) })) };
  invalidBookingResource.tables[1].fields[1].type = 'text';
  assert.throws(() => validate(invalidBookingResource), /booking|resource|reference|field/i, 'invalid clinic booking resources fail closed');

  if (process.argv.includes('--postgres')) {
    const databaseUrl = process.env.TAYAR_BOOKING_TEST_DATABASE_URL;
    const url = new URL(databaseUrl ?? 'http://invalid');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname)
      || url.pathname !== '/tayar_booking_test') throw Error('An isolated local tayar_booking_test database is required.');
    const { spawn } = await import('node:child_process');
    const query = sql => new Promise((resolveQuery, reject) => {
      const child = spawn('psql', [databaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t'], { stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '', error = '';
      child.stdout.on('data', data => output += data);
      child.stderr.on('data', data => error += data);
      child.on('error', reject);
      child.on('close', code => code ? reject(Error(error || output)) : resolveQuery(output.trim()));
      child.stdin.end(sql);
    });
    const ownerId = '11111111-1111-4111-8111-111111111111';
    const otherOwnerId = '22222222-2222-4222-8222-222222222222';
    const resetSql = [
      'drop schema if exists private cascade;',
      'drop schema if exists public cascade;',
      'create schema public;',
      'create extension if not exists btree_gist with schema public;',
      'grant usage on schema public to anon, authenticated, service_role;',
      "create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;",
    ].join('\n');
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await query("do $$ begin if not exists (select 1 from pg_roles where rolname = '" + role + "') then create role " + role + "; end if; end $$;");
    }
    await query('create schema if not exists auth;');
    for (const reference of references) {
      await query(resetSql);
      await query(compile(reference.definition).join('\n'));
      const table = reference.definition.tables[0];
      const tableName = 'app_' + table.key;
      const values = [];
      const otherValues = [];
      const columns = [];
      for (const item of table.fields) {
        if (!item.required || item.formula || item.defaultValue !== undefined) continue;
        let value;
        let otherValue;
        if (item.type === 'text' || item.type === 'email' || item.type === 'url' || item.type === 'phone') {
          value = "'" + ('runtime-' + reference.domain + '-' + item.id + '-' + ownerId.slice(0, 8)).replaceAll("'", "''") + "'";
          otherValue = "'" + ('runtime-' + reference.domain + '-' + item.id + '-' + otherOwnerId.slice(0, 8)).replaceAll("'", "''") + "'";
        } else if (item.type === 'number' || item.type === 'currency') value = '1';
        else if (item.type === 'boolean') value = 'true';
        else if (item.type === 'enum') value = "'" + String(item.options?.[0] ?? '').replaceAll("'", "''") + "'";
        else if (item.type === 'date') value = "'2026-10-12'";
        else if (item.type === 'datetime') value = "'2026-10-12T10:00:00Z'";
        else if (item.type === 'time') value = "'10:00:00'";
        else if (item.type === 'json') value = "'{}'::jsonb";
        else if (item.type === 'reference') throw Error(reference.domain + ' primary fixture unexpectedly requires a referenced row.');
        else throw Error(reference.domain + ' primary fixture has unsupported required field type ' + item.type);
        otherValue ??= value;
        columns.push(item.key);
        values.push(value);
        otherValues.push(otherValue);
      }
      const columnSql = columns.length ? ', ' + columns.join(', ') : '';
      const valueSql = values.length ? ', ' + values.join(', ') : '';
      const otherValueSql = otherValues.length ? ', ' + otherValues.join(', ') : '';
      await query("insert into public." + tableName + " (id, owner_id" + columnSql + ") values ('" + ownerId + "', '" + ownerId + "'" + valueSql + "), ('" + otherOwnerId + "', '" + otherOwnerId + "'" + otherValueSql + ");");
      const ownerCount = await query("set role authenticated; set request.jwt.claim.sub = '" + ownerId + "'; select count(*) from public." + tableName + "; reset role;");
      const otherCount = await query("set role authenticated; set request.jwt.claim.sub = '" + otherOwnerId + "'; select count(*) from public." + tableName + "; reset role;");
      assert.equal(ownerCount, '1', reference.domain + ' authenticated owner sees only their row');
      assert.equal(otherCount, '1', reference.domain + ' second owner sees only their row');
      try {
        await query("set role authenticated; set request.jwt.claim.sub = '" + ownerId + "'; update public." + tableName + " set owner_id = '" + otherOwnerId + "' where id = '" + ownerId + "'; reset role;");
      } catch (error) {
        assert.match(error.message, /permission denied|row-level security|new row violates|immutable application record identity/i,
          reference.domain + ' transfer rejection is caused by an access guard');
      }
      assert.equal(await query("select count(*) from public." + tableName + " where id = '" + ownerId + "' and owner_id = '" + ownerId + "';"), '1',
        reference.domain + ' denied or filtered tenant transfer leaves the original record intact');
      assert.equal(await query("select count(*) from public." + tableName + " where id = '" + ownerId + "' and owner_id = '" + otherOwnerId + "';"), '0',
        reference.domain + ' never transfers the record to another owner');

      const asOwner = "set role authenticated; set request.jwt.claim.sub = '" + ownerId + "'; ";
      if (reference.domain === 'retail' || reference.domain === 'factory') {
        const itemTable = reference.domain === 'retail' ? 'app_products' : 'app_materials';
        const counterField = reference.domain === 'retail' ? 'quantity' : 'on_hand';
        const transactionTable = reference.domain === 'retail' ? 'app_orders' : 'app_work_orders';
        const lineTable = reference.domain === 'retail' ? 'app_order_lines' : 'app_material_issues';
        await query(asOwner + "select public.app_adjust_counter_0('" + ownerId + "', 10, gen_random_uuid()); reset role;");
        const orderData = reference.domain === 'retail'
          ? { reference: 'runtime-retail-order', note: 'reference project runtime' }
          : { batch_reference: 'runtime-factory-batch', quantity: 2 };
        const transaction = JSON.parse(await query(asOwner + "select public.app_create_transaction_1('" + JSON.stringify(orderData)
          + "'::jsonb, '[{\"itemId\":\"" + ownerId + "\",\"quantity\":2}]'::jsonb, gen_random_uuid()); reset role;"));
        assert.equal(transaction.status, 'created', reference.domain + ' primary inventory transaction executes');
        assert.equal(await query("select " + counterField + " from public." + itemTable + " where id = '" + ownerId + "';"), '8',
          reference.domain + ' transaction decrements the generated inventory counter atomically');
        assert.equal(await query("select count(*) from public." + transactionTable + " where owner_id = '" + ownerId + "';"), '1');
        assert.equal(await query("select count(*) from public." + lineTable + ";"), '1');
      } else if (reference.domain === 'restaurant') {
        await query("insert into public.app_kitchen_tickets (id, owner_id, ticket_number, menu_item) values ('" + ownerId + "', '" + ownerId + "', 'runtime-ticket', '" + ownerId + "');");
        await query(asOwner + "select public.app_transition_workflow_1('" + ownerId + "', 'start-cooking', gen_random_uuid()); reset role;");
        assert.equal(await query("select state from public.app_kitchen_tickets where id = '" + ownerId + "';"), 'cooking',
          'restaurant owner transition executes on its generated ticket');
      } else if (reference.domain === 'school') {
        const assessmentId = '33333333-3333-4333-8333-333333333333';
        await query(asOwner + "insert into public.app_assessments (id, owner_id, student, coursework_score, exam_score) values ('"
          + assessmentId + "', '" + ownerId + "', '" + ownerId + "', 30, 60); reset role;");
        assert.equal(Number(await query("select total_score from public.app_assessments where id = '" + assessmentId + "';")), 90,
          'school assessment calculates its generated total score at runtime');
      } else if (reference.domain === 'clinic') {
        const appointmentId = '44444444-4444-4444-8444-444444444444';
        await query(asOwner + "insert into public.app_appointments (id, owner_id, patient_reference, clinician, starts_at, ends_at) values ('"
          + appointmentId + "', '" + ownerId + "', 'runtime-patient', '" + ownerId
          + "', '2026-10-12T07:00:00Z', '2026-10-12T07:30:00Z'); reset role;");
        assert.equal(await query("select count(*) from public.app_appointments where id = '" + appointmentId + "';"), '1',
          'clinic appointment inside declared business hours is accepted');
        await assert.rejects(query(asOwner + "insert into public.app_appointments (id, owner_id, patient_reference, clinician, starts_at, ends_at) values ('55555555-5555-4555-8555-555555555555', '"
          + ownerId + "', 'runtime-overlap', '" + ownerId + "', '2026-10-12T07:15:00Z', '2026-10-12T07:45:00Z'); reset role;"),
          /exclusion|overlap|booking/i, 'clinic overlap is rejected by the generated booking constraint');
      } else if (reference.domain === 'government') {
        await query("insert into private.app_user_roles (user_id, role_id) values ('" + ownerId + "', 'reviewer') on conflict do nothing;");
        await query(asOwner + "select public.app_transition_workflow_0('" + ownerId + "', 'approve', gen_random_uuid()); reset role;");
        assert.equal(await query("select state from public.app_permit_cases where id = '" + ownerId + "';"), 'approved',
          'government reviewer approval executes on its generated case');
      } else if (reference.domain === 'real-estate') {
        await query(asOwner + "select public.app_transition_workflow_0('" + ownerId + "', 'publish', gen_random_uuid()); reset role;");
        assert.equal(await query("select listing_status from public.app_properties where id = '" + ownerId + "';"), 'listed',
          'real-estate owner publishes a generated property listing');
        const inquiryId = '66666666-6666-4666-8666-666666666666';
        await query(asOwner + "insert into public.app_buyer_inquiries (id, owner_id, property, buyer_email, message) values ('"
          + inquiryId + "', '" + ownerId + "', '" + ownerId
          + "', 'buyer@example.invalid', 'Synthetic property inquiry'); reset role;");
        assert.equal(await query("select count(*) from public.app_buyer_inquiries where owner_id = '" + ownerId + "';"), '1',
          'real-estate inquiry persists with its generated owner-scoped property reference');
        const dealId = '77777777-7777-4777-8777-777777777777';
        await query(asOwner + "insert into public.app_brokerage_deals (id, owner_id, property, sale_price, commission_rate) values ('"
          + dealId + "', '" + ownerId + "', '" + ownerId + "', 200000, 0.025); reset role;");
        assert.equal(Number(await query("select commission_amount from public.app_brokerage_deals where id = '"
          + dealId + "';")), 5000, 'real-estate commission is calculated by PostgreSQL, not the UI');
      } else if (reference.domain === 'custom-research') {
        await query(asOwner + "select public.app_transition_workflow_0('" + ownerId + "', 'analyse', gen_random_uuid()); reset role;");
        assert.equal(await query("select condition from public.app_research_samples where id = '" + ownerId + "';"), 'analysed',
          'research owner transition executes on its generated sample');
      } else {
        throw Error('Missing runtime feature scenario for ' + reference.domain);
      }
    }
    await query('drop schema if exists private cascade; drop schema if exists public cascade; create schema public;');
    console.log('PASS PostgreSQL reference-project runtime isolation: generated schemas apply and owner RLS denies cross-tenant reads/transfers for all eight projects');
  }

  console.log(`PASS ${references.length} synthetic reference application contracts and runtime fixtures: retail, restaurant, school, clinic, government, factory, custom research, real estate`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
