import { useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import type { ApplicationRole, ApplicationTable, ApplicationWorkflowRule, ApplicationWorkflowTransition } from '../core/application-model';

export function BuilderApplicationWorkflowRule({ table, roles, disabled, onSave }: {
  table: ApplicationTable; roles: ApplicationRole[]; disabled?: boolean;
  onSave(value: ApplicationWorkflowRule | undefined): void;
}) {
  const l = useLocalizer();
  const [fieldId, setFieldId] = useState(table.workflow?.fieldId ?? '');
  const [transitions, setTransitions] = useState<ApplicationWorkflowTransition[]>(table.workflow?.transitions ?? []);
  const field = table.fields.find(item => item.id === fieldId);
  const fields = table.fields.filter(item => item.type === 'enum' && item.required && typeof item.defaultValue === 'string');
  const valid = !!field && transitions.length > 0 && transitions.every(item => item.label.trim() && item.from.length
    && item.from.every(state => field.options?.includes(state) && state !== item.to) && field.options?.includes(item.to)
    && (item.access !== 'role' || roles.some(role => role.id === item.roleId)));
  const update = (id: string, changes: Partial<ApplicationWorkflowTransition>) => setTransitions(current => current.map(item => item.id === id ? { ...item, ...changes } : item));
  return <fieldset disabled={disabled}><legend>{l('Workflow')}</legend>
    <label>{l('Field')}<select value={fieldId} onChange={event => { setFieldId(event.target.value); setTransitions([]); }}>
      <option value="">{l('Select a field')}</option>{fields.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    {transitions.map(item => <div key={item.id} className="builder-v2-grid">
      <label>{l('Label')}<input value={item.label} maxLength={160} onChange={event => update(item.id, { label: event.target.value })} /></label>
      <fieldset><legend>{l('From')}</legend>{field?.options?.map(state => <label key={state}><input type="checkbox" checked={item.from.includes(state)} onChange={event => update(item.id, { from: event.target.checked ? [...item.from, state] : item.from.filter(value => value !== state) })} />{state}</label>)}</fieldset>
      <label>{l('To')}<select value={item.to} onChange={event => update(item.id, { to: event.target.value })}><option value="">{l('Select a field')}</option>{field?.options?.map(state => <option key={state}>{state}</option>)}</select></label>
      <label>{l('Permissions')}<select value={item.access} onChange={event => {
        const access = event.target.value as ApplicationWorkflowTransition['access'];
        setTransitions(current => current.map(transition => { if (transition.id !== item.id) return transition; const next = { ...transition, access }; delete next.roleId; if (access === 'role') next.roleId = roles[0]?.id; return next; }));
      }}><option value="owner">{l('Record owner')}</option><option value="authenticated">{l('Authenticated')}</option>{roles.length > 0 && <option value="role">{l('Role')}</option>}</select></label>
      {item.access === 'role' && <select aria-label={l('Role')} value={item.roleId} onChange={event => update(item.id, { roleId: event.target.value })}>{roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select>}
      <button type="button" onClick={() => setTransitions(current => current.filter(transition => transition.id !== item.id))}>{l('Remove')}</button>
    </div>)}
    <button type="button" disabled={disabled || !field || transitions.length >= 100} onClick={() => setTransitions(current => [...current, { id: crypto.randomUUID(), label: '', from: [], to: '', access: 'owner' }])}>{l('Add')}</button>
    <button type="button" disabled={disabled || !valid} onClick={() => onSave({ fieldId, transitions })}>{l('Save')}</button>
    {table.workflow && <button type="button" onClick={() => onSave(undefined)}>{l('Remove')}</button>}
  </fieldset>;
}
