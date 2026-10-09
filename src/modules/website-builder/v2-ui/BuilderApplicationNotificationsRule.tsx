import { useState, useSyncExternalStore } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import type { ApplicationEmailNotification, ApplicationTable } from '../core/application-model';
import { validateApplicationEmailNotification } from '../core/application-email-notifications';
import { getEditorIntegrationsHostConfig, subscribeEditorIntegrationsHost } from '../core/editor-integrations-host-store';

export function BuilderApplicationNotificationsRule({ table, disabled, onSave }: {
  table: ApplicationTable; disabled?: boolean; onSave(value?: ApplicationTable['notifications']): void;
}) {
  const l = useLocalizer();
  const integrations = useSyncExternalStore(subscribeEditorIntegrationsHost, getEditorIntegrationsHostConfig, getEditorIntegrationsHostConfig);
  const connections = integrations.connections.filter(item => item.providerId === 'resend');
  const [editingId, setEditingId] = useState<string>();
  const [connectionId, setConnectionId] = useState('');
  const [event, setEvent] = useState('created');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const candidate: ApplicationEmailNotification = { id: editingId ?? 'draft', connectionId,
    event: event === 'created' ? { type: 'created' } : { type: 'transition', transitionId: event.slice('transition:'.length) }, subject, text };
  const issue = validateApplicationEmailNotification(candidate, table);
  const connection = connections.find(item => item.id === connectionId);
  const available = connection?.enabled && ['configured', 'active'].includes(connection.status) && !connection.events?.length;
  const rules = table.notifications ?? [];
  function edit(rule: ApplicationEmailNotification) {
    setEditingId(rule.id); setConnectionId(rule.connectionId); setSubject(rule.subject); setText(rule.text);
    setEvent(rule.event.type === 'created' ? 'created' : `transition:${rule.event.transitionId}`);
  }
  function reset() { setEditingId(undefined); setSubject(''); setText(''); setEvent('created'); }
  return <fieldset data-testid="application-notifications"><legend>{l('Record email notifications')}</legend>
    <p>{l('Messages go to the verified record owner. Sender and credentials come from the selected email connection.')}</p>
    <p role="status">{l('Rules can be saved now. Delivery requires customer-owned credentials and scheduled worker setup before publishing.')}</p>
    {rules.map(rule => <div key={rule.id}>
      <span>{rule.subject} · {connections.find(item => item.id === rule.connectionId)?.name ?? rule.connectionId}</span>
      <button type="button" disabled={disabled} onClick={() => edit(rule)}>{l('Edit notification')}</button>
      <button type="button" disabled={disabled} onClick={() => { const next = rules.filter(item => item.id !== rule.id); onSave(next.length ? next : undefined); }}>{l('Remove notification')}</button>
    </div>)}
    <label>{l('Email connection')}<select disabled={disabled} value={connectionId} onChange={event => setConnectionId(event.target.value)}>
      <option value="">{l('Select an email connection')}</option>
      {connectionId && !connection && <option value={connectionId}>{l('Unavailable connection')}</option>}
      {connections.map(item => <option key={item.id} value={item.id} disabled={!item.enabled || !['configured', 'active'].includes(item.status) || !!item.events?.length}>{item.name} · {item.environments.join(', ')}</option>)}
    </select></label>
    {!available && <p>{l('Configure an enabled Resend connection in Integrations without generic event automation.')}</p>}
    <label>{l('Notification event')}<select disabled={disabled} value={event} onChange={event => setEvent(event.target.value)}>
      <option value="created">{l('Record created')}</option>
      {table.workflow?.transitions.map(item => <option key={item.id} value={`transition:${item.id}`}>{item.label}</option>)}
    </select></label>
    <label>{l('Email subject')}<input disabled={disabled} value={subject} maxLength={200} onChange={event => setSubject(event.target.value)} /></label>
    <label>{l('Email message')}<textarea disabled={disabled} value={text} maxLength={16000} onChange={event => setText(event.target.value)} /></label>
    <p>{l('Template variables use record ID or field IDs. Field values are limited to 500 characters; dates use UTC.')}</p>
    <code>{'{{record.id}}'}</code>
    {table.fields.filter(field => field.type !== 'json').map(field => <div key={field.id}>{field.name}: <code>{`{{field:${field.id}}}`}</code></div>)}
    {issue && (subject || text) && <p role="alert">{l(issue)}</p>}
    <button type="button" disabled={disabled || !!issue || !available || !editingId && rules.length >= 50} onClick={() => {
      const rule = { ...candidate, id: editingId ?? crypto.randomUUID() };
      onSave(editingId ? rules.map(item => item.id === editingId ? rule : item) : [...rules, rule]);
    }}>{l('Save notification')}</button>
    {editingId && <button type="button" disabled={disabled} onClick={reset}>{l('Cancel editing')}</button>}
  </fieldset>;
}
