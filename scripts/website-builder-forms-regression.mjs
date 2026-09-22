import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const outfile = path.join(os.tmpdir(), `tayar-forms-${process.pid}.mjs`);
await build({ entryPoints: ['src/modules/website-builder/core/website-forms.ts'], bundle: true, platform: 'node', format: 'esm', outfile });
const forms = await import(`${pathToFileURL(outfile).href}?v=${Date.now()}`);

const field = forms.normalizeWebsiteFormField({ id: 'f1', name: ' Budget ', label: 'Budget', type: 'number', required: true, validation: { min: 10, max: 100 }, conditions: [{ fieldName: 'kind', operator: 'equals', value: 'paid' }] });
assert.equal(field.name, 'budget');
assert.equal(field.validation.min, 10);
assert.equal(forms.fieldIsVisible(field, { kind: 'paid' }), true);
assert.equal(forms.fieldIsVisible(field, { kind: 'free' }), false);
assert.equal(forms.normalizeWebsiteFormAutomation({ action: 'webhook', destination: 'http://unsafe.test', enabled: true }), null);
assert.equal(forms.normalizeWebsiteFormAutomation({ action: 'webhook', destination: 'https://safe.test/hook', enabled: true }).action, 'webhook');

const page = { id: 'home', name: 'Home', slug: 'home', showInNavigation: true, sections: [{ id: 'contact-1', type: 'contact', title: 'Lead form', description: '', buttonText: 'Send', buttonUrl: '', background: '#000000', accent: '#ffffff', elements: [], formFields: [field], formAutomations: [{ id: 'a1', name: 'Webhook', trigger: 'submission-created', action: 'webhook', destination: 'https://safe.test/hook', enabled: true }] }] };
const definitions = forms.collectWebsiteFormDefinitions([page]);
assert.equal(definitions.length, 1);
assert.equal(definitions[0].automations.length, 1);

const rendering = fs.readFileSync('src/modules/website-builder/core/website-builder-rendering.ts', 'utf8');
const endpoint = fs.readFileSync('supabase/functions/website-form-submit/index.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260921191410_website_forms_automations_max.sql', 'utf8');
const service = fs.readFileSync('src/modules/website-builder/services/websiteFormService.ts', 'utf8');
for (const token of ['data-conditions', 'website-form-submit', '_tayar_started_at', 'data-max-file-mb']) assert.ok(rendering.includes(token), `rendering missing ${token}`);
for (const token of ['enforce_website_public_rate_limit', 'website-form-uploads', 'WEBSITE_FORM_WEBHOOK_SECRET', 'workflow_status', 'validWebhookDestination', 'safeValidationPattern', 'cf-connecting-ip']) assert.ok(endpoint.includes(token), `endpoint missing ${token}`);
for (const token of ['enable row level security', 'website_forms_owner_insert', 'website_form_deliveries_team_select', 'file_size_limit']) assert.ok(migration.toLowerCase().includes(token.toLowerCase()), `migration missing ${token}`);
assert.ok(service.includes("onConflict: 'project_id,form_id'"));
assert.ok(service.includes('snapshotPublishedWebsiteForms') && service.includes('restorePublishedWebsiteForms'));

fs.rmSync(outfile, { force: true });
console.log('Website Builder Forms + Automations MAX regression: 16 checks passed');
