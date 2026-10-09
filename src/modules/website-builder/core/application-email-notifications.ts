import type { ApplicationEmailNotification, ApplicationField, ApplicationTable } from './application-model';

export type ApplicationEmailTemplatePart = { literal: string } | { field: ApplicationField } | { recordId: true };
const identifier = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** The editor and SQL compiler accept the same plain-text variables. */
export function applicationEmailTemplateParts(value: string, fields: readonly ApplicationField[]): ApplicationEmailTemplatePart[] {
  const parts: ApplicationEmailTemplatePart[] = []; let cursor = 0;
  for (const match of value.matchAll(/\{\{(record\.id|field:([A-Za-z0-9][A-Za-z0-9_-]{0,119}))\}\}/g)) {
    const preceding = value.slice(cursor, match.index);
    if (preceding.includes('{{') || preceding.includes('}}')) throw new Error('Unknown email template variable.');
    if (preceding) parts.push({ literal: preceding });
    if (match[1] === 'record.id') parts.push({ recordId: true });
    else {
      const field = fields.find(field => field.id === match[2]);
      if (!field || field.type === 'json') throw new Error('Unknown email template field.');
      parts.push({ field });
    }
    cursor = match.index! + match[0].length;
  }
  const remainder = value.slice(cursor);
  if (remainder.includes('{{') || remainder.includes('}}')) throw new Error('Unknown email template variable.');
  if (remainder) parts.push({ literal: remainder });
  if (parts.length > 100) throw new Error('Email template too large.');
  return parts;
}

export function validateApplicationEmailNotification(value: unknown, table: Pick<ApplicationTable, 'fields' | 'permissions' | 'workflow'>): string | null {
  if (!object(value) || Object.keys(value).sort().join(',') !== 'connectionId,event,id,subject,text'
    || typeof value.id !== 'string' || !identifier.test(value.id)
    || typeof value.connectionId !== 'string' || !identifier.test(value.connectionId)
    || typeof value.subject !== 'string' || !value.subject.trim() || value.subject.length > 200
    || Array.from(value.subject).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    || typeof value.text !== 'string' || !value.text.trim() || value.text.length > 16000 || value.text.includes('\0')) return 'Invalid email notification rule.';
  if (!table.permissions.some(permission => permission.operation === 'read' && permission.access === 'owner')) return 'Email recipients require owner read access.';
  const event = value.event;
  if (!object(event)) return 'Unknown email notification event.';
  if (event.type === 'created' && Object.keys(event).join(',') === 'type') {
    if (!table.permissions.some(permission => permission.operation === 'create' && permission.access !== 'public')) return 'Email source write unavailable.';
  } else if (event.type === 'transition' && Object.keys(event).sort().join(',') === 'transitionId,type') {
    const transition = table.workflow?.transitions.find(item => item.id === event.transitionId);
    if (!transition) return 'Unknown email workflow transition.';
    if (table.workflow!.transitions.some(other => other.id !== transition.id && other.to === transition.to
      && other.from.some(state => transition.from.includes(state)))) return 'Email source transition is ambiguous.';
  } else return 'Unknown email notification event.';
  try {
    applicationEmailTemplateParts(value.subject, table.fields);
    applicationEmailTemplateParts(value.text, table.fields);
  } catch (error) { return error instanceof Error ? error.message : 'Invalid email notification rule.'; }
  return null;
}

export function applicationEmailRuleWithoutRuntime(value: ApplicationEmailNotification): ApplicationEmailNotification {
  return { id: value.id, connectionId: value.connectionId, event: value.event, subject: value.subject, text: value.text };
}
