import { useEffect, useRef, useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import { createApplicationDefinition, type ApplicationAccess, type ApplicationDataOperation, type ApplicationDefinition, type ApplicationField, type ApplicationFieldType, type ApplicationTable } from '../core/application-model';
import { applicationFingerprint, type ApplicationOperation } from '../core/application-operations';
import { planWebsiteApplicationWithAI, type ApplicationAIPlan } from '../services/websiteApplicationAIService';

interface Props {
  value?: ApplicationDefinition;
  pages: Array<{ id: string; name: string }>;
  cloudProjectId: string | null;
  loadSequence: number;
  disabled?: boolean;
  onApply(operations: ApplicationOperation[], source?: 'manual' | 'ai', review?: { fingerprint: string; loadSequence: number; projectId: string | null }): string | null;
}
const types: ApplicationFieldType[] = ['text', 'number', 'boolean', 'date', 'datetime', 'uuid', 'json', 'enum', 'reference'];
const verbs: ApplicationDataOperation[] = ['read', 'create', 'update', 'delete'];
const id = () => globalThis.crypto?.randomUUID?.() ?? `item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const keyOf = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);

function CommitInput({ value, onCommit, disabled, label }: { value: string; onCommit(value: string): void; disabled?: boolean; label?: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <input aria-label={label} disabled={disabled} value={draft} onChange={event => setDraft(event.target.value)}
    onBlur={() => { if (draft !== value) onCommit(draft); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />;
}

/** Edits the shared application definition; runtime data and credentials never enter this panel. */
export function BuilderApplicationPanel({ value, pages, cloudProjectId, loadSequence, disabled, onApply }: Props) {
  const l = useLocalizer();
  const app = value ?? createApplicationDefinition();
  const [name, setName] = useState('');
  const [roleName, setRoleName] = useState('');
  const [error, setError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [aiPlan, setAiPlan] = useState<ApplicationAIPlan>();
  const [planning, setPlanning] = useState(false);
  const scope = `${loadSequence}:${cloudProjectId ?? ''}:${applicationFingerprint({ cloudProjectId, pages, application: value })}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  function commit(ops: ApplicationOperation[]) { setError(onApply(ops) ?? ''); }
  function updateTable(table: ApplicationTable) { commit([{ type: 'put_table', table }]); }
  async function prepareAIPlan() {
    const expectedScope = scope;
    setPlanning(true); setError(''); setAiPlan(undefined);
    try {
      const result = await planWebsiteApplicationWithAI({ cloudProjectId, pages, application: value }, prompt);
      if (expectedScope !== scopeRef.current) throw new Error('The project changed while AI was planning. Create a new plan.');
      setAiPlan(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Application AI planning failed.'); }
    finally { setPlanning(false); }
  }
  return <section className="builder-v2-card" data-testid="application-panel">
    <div className="builder-v2-card__header"><strong>{l('Application data and access')}</strong></div>
    <p>{l('Database and authentication require secure backend provisioning before publishing.')}</p>
    {error && <p role="alert">{error}</p>}
    <details><summary>{l('Plan application changes with AI')}</summary>
      <textarea aria-label={l('Describe application changes')} value={prompt} disabled={disabled || planning} maxLength={4_000} onChange={event => setPrompt(event.target.value)} />
      <button type="button" disabled={disabled || planning || !prompt.trim()} onClick={() => void prepareAIPlan()}>{planning ? l('Planning…') : l('Plan with AI')}</button>
      {aiPlan && <div data-testid="application-ai-plan-review"><p>{aiPlan.summary}</p>
        {aiPlan.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
        <ul>{aiPlan.operations.map((operation, index) => <li key={index}>{operation.type}: {operation.type === 'put_table' ? operation.table.name : operation.type === 'put_role' ? operation.role.name : ''}</li>)}</ul>
        <button type="button" disabled={disabled} onClick={() => setAiPlan(undefined)}>{l('Cancel plan')}</button>
        <button type="button" disabled={disabled} onClick={() => {
          const result = onApply(aiPlan.operations, 'ai', { fingerprint: aiPlan.fingerprint, loadSequence, projectId: cloudProjectId });
          setError(result ?? ''); if (!result) { setAiPlan(undefined); setPrompt(''); }
        }}>{l('Apply reviewed plan')}</button>
      </div>}
    </details>
    <details open><summary>{l('Data')}</summary>
      <form className="builder-v2-grid" onSubmit={event => { event.preventDefault(); const key = keyOf(name); if (!key) { setError(l('Enter a table name.')); return; } commit([{ type: 'put_table', table: { id: id(), key, name: name.trim(), fields: [], permissions: [] } }]); setName(''); }}>
        <label>{l('Table name')}<input value={name} disabled={disabled} onChange={event => setName(event.target.value)} maxLength={160} /></label>
        <button disabled={disabled} type="submit">{l('Add table')}</button>
      </form>
      {app.tables.map(table => <details key={table.id} className="builder-v2-card builder-v2-card--nested"><summary>{table.name} · {table.key}</summary>
        <label>{l('Table name')}<CommitInput disabled={disabled} value={table.name} onCommit={name => updateTable({ ...table, name })} /></label>
        <label>{l('Table key')}<CommitInput disabled={disabled} value={table.key} onCommit={key => updateTable({ ...table, key })} /></label>
        {table.fields.map(field => <div key={field.id} className="builder-v2-grid">
          <label>{l('Field')}<CommitInput disabled={disabled} value={field.name} onCommit={name => updateTable({ ...table, fields: table.fields.map(item => item.id === field.id ? { ...item, name } : item) })} /></label>
          <label>{l('Key')}<CommitInput disabled={disabled} value={field.key} onCommit={key => updateTable({ ...table, fields: table.fields.map(item => item.id === field.id ? { ...item, key } : item) })} /></label>
          <label>{l('Type')}<select disabled={disabled} value={field.type} onChange={event => { const type = event.target.value as ApplicationFieldType; const next: ApplicationField = { id: field.id, key: field.key, name: field.name, type, required: field.required, ...(type === 'enum' ? { options: ['Option'] } : {}), ...(type === 'reference' && app.tables.length ? { referenceTableId: app.tables[0].id } : {}) }; updateTable({ ...table, fields: table.fields.map(item => item.id === field.id ? next : item) }); }}>{types.map(type => <option key={type}>{type}</option>)}</select></label>
          {field.type === 'reference' && <label>{l('Related table')}<select disabled={disabled} value={field.referenceTableId} onChange={event => updateTable({ ...table, fields: table.fields.map(item => item.id === field.id ? { ...item, referenceTableId: event.target.value } : item) })}>{app.tables.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
          {field.type === 'enum' && <label>{l('Options (comma separated)')}<CommitInput disabled={disabled} value={field.options?.join(', ') ?? ''} onCommit={options => updateTable({ ...table, fields: table.fields.map(item => item.id === field.id ? { ...item, options: options.split(',').map(x => x.trim()).filter(Boolean) } : item) })} /></label>}
          <label><input type="checkbox" disabled={disabled} checked={field.required} onChange={event => updateTable({ ...table, fields: table.fields.map(item => item.id === field.id ? { ...item, required: event.target.checked } : item) })} />{l('Required')}</label>
          <label><input type="checkbox" disabled={disabled} checked={field.unique ?? false} onChange={event => updateTable({ ...table, fields: table.fields.map(item => item.id === field.id ? { ...item, unique: event.target.checked } : item) })} />{l('Unique')}</label>
          <button type="button" disabled={disabled} onClick={() => commit([{ type: 'put_table', table: { ...table, fields: table.fields.filter(item => item.id !== field.id) } }])}>{l('Remove field')}</button>
        </div>)}
        <button type="button" disabled={disabled} onClick={() => { const n = table.fields.length + 1; updateTable({ ...table, fields: [...table.fields, { id: id(), key: `field_${n}`, name: `Field ${n}`, type: 'text', required: false }] }); }}>{l('Add field')}</button>
        <fieldset><legend>{l('Permissions')}</legend>{verbs.map(operation => <label key={operation}>{l(operation)} <select disabled={disabled} value={table.permissions.find(rule => rule.operation === operation)?.access ?? 'none'} onChange={event => { const access = event.target.value as ApplicationAccess | 'none'; updateTable({ ...table, permissions: [...table.permissions.filter(rule => rule.operation !== operation), ...(access === 'none' ? [] : [{ operation, access, ...(access === 'role' ? { roleId: app.roles[0]?.id } : {}) }])] }); }}><option value="none">{l('No access')}</option>{operation === 'read' && <option value="public">{l('Public')}</option>}{app.auth.enabled && <><option value="authenticated">{l('Authenticated')}</option><option value="owner">{l('Record owner')}</option>{app.roles.length > 0 && <option value="role">{l('Role')}</option>}</>}</select>{table.permissions.find(rule => rule.operation === operation)?.access === 'role' && <select disabled={disabled} value={table.permissions.find(rule => rule.operation === operation)?.roleId} onChange={event => updateTable({ ...table, permissions: table.permissions.map(rule => rule.operation === operation ? { ...rule, roleId: event.target.value } : rule) })}>{app.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select>}</label>)}</fieldset>
        <button type="button" disabled={disabled} onClick={() => { if (window.confirm(l('Remove this table and its definition?'))) commit([{ type: 'remove_table', tableId: table.id }]); }}>{l('Remove table')}</button>
      </details>)}
    </details>
    <details><summary>{l('Auth and roles')}</summary>
      <label><input type="checkbox" disabled={disabled} checked={app.auth.enabled} onChange={event => commit([{ type: 'set_auth', auth: { ...app.auth, enabled: event.target.checked, signUpEnabled: event.target.checked && app.auth.signUpEnabled } }])} />{l('Enable authentication')}</label>
      <label><input type="checkbox" disabled={disabled || !app.auth.enabled} checked={app.auth.signUpEnabled} onChange={event => commit([{ type: 'set_auth', auth: { ...app.auth, signUpEnabled: event.target.checked } }])} />{l('Allow sign up')}</label>
      <label><input type="checkbox" disabled={disabled || !app.auth.enabled} checked={app.auth.emailVerificationRequired} onChange={event => commit([{ type: 'set_auth', auth: { ...app.auth, emailVerificationRequired: event.target.checked } }])} />{l('Require email verification')}</label>
      <form className="builder-v2-grid" onSubmit={event => { event.preventDefault(); commit([{ type: 'put_role', role: { id: id(), name: roleName.trim() } }]); setRoleName(''); }}><label>{l('Role name')}<input disabled={disabled || !app.auth.enabled} value={roleName} onChange={event => setRoleName(event.target.value)} /></label><button disabled={disabled || !app.auth.enabled} type="submit">{l('Add role')}</button></form>
      {app.roles.map(role => <div key={role.id}><CommitInput label={l('Role name')} disabled={disabled} value={role.name} onCommit={name => commit([{ type: 'put_role', role: { ...role, name } }])} /><button type="button" disabled={disabled} onClick={() => commit([{ type: 'remove_role', roleId: role.id }])}>{l('Remove')}</button></div>)}
      {pages.map(page => { const rule = app.pageAccess.find(item => item.pageId === page.id); return <label key={page.id}>{page.name} <select disabled={disabled} value={rule?.access ?? 'public'} onChange={event => { const access = event.target.value as 'public' | 'authenticated' | 'role'; commit([{ type: 'set_page_access', rules: [...app.pageAccess.filter(item => item.pageId !== page.id), { pageId: page.id, access, ...(access === 'role' ? { roleId: app.roles[0]?.id } : {}) }] }]); }}><option value="public">{l('Public')}</option>{app.auth.enabled && <><option value="authenticated">{l('Authenticated')}</option>{app.roles.length > 0 && <option value="role">{l('Role')}</option>}</>}</select>{rule?.access === 'role' && <select disabled={disabled} value={rule.roleId} onChange={event => commit([{ type: 'set_page_access', rules: app.pageAccess.map(item => item.pageId === page.id ? { ...item, roleId: event.target.value } : item) }])}>{app.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select>}</label>; })}
    </details>
  </section>;
}

export default BuilderApplicationPanel;
