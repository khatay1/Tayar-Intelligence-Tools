import type { ApplicationDefinition, ApplicationField } from '../src/modules/website-builder/core/application-model';
import { applicationEmailTemplateParts, validateApplicationEmailNotification, applicationEmailRuleWithoutRuntime, type ApplicationEmailTemplatePart } from '../src/modules/website-builder/core/application-email-notifications';
import { readApplicationDefinition } from '../src/modules/website-builder/core/application-validation';
import { isOwnedEmailAddress, type OwnedEmailJob } from './website-owned-email-delivery';
import { validateEditorIntegrations, type EditorIntegrationsConfig } from '../src/modules/website-builder/core/editor-integrations';

/** Configuration only. Recipient addresses and credentials are never editable rules. */
export interface OwnedEmailNotificationRule {
  id: string;
  tableId: string;
  connectionId: string;
  from: string;
  event: { type: 'created' } | { type: 'transition'; transitionId: string };
  subject: string;
  text: string;
}

/** Resolve saved rule IDs against the exact captured customer integration.
 * Only opaque Vault references leave this function, never resolved credentials.
 * SQL triggers are the sole producer; generic event automation is rejected. */
export function bindSavedOwnedEmailNotifications(input: {
  projectId: string; definition: ApplicationDefinition; environment: OwnedEmailJob['environment']; integrations: EditorIntegrationsConfig;
}) {
  const definition = readApplicationDefinition(input.definition);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input.projectId)
    || !['preview', 'staging', 'production'].includes(input.environment)
    || input.integrations.version !== 1 || !Array.isArray(input.integrations.connections)
    || new Set(input.integrations.connections.map(connection => connection.id)).size !== input.integrations.connections.length) throw new Error('Email connection identity unavailable.');
  const rules: OwnedEmailNotificationRule[] = [];
  const connections = new Map<string, { id: string; from: string; secretRef: string; secretUpdatedAt: string; connectionUpdatedAt: string }>();
  for (const table of definition.tables) for (const rule of table.notifications ?? []) {
    const connection = input.integrations.connections.find(item => item.id === rule.connectionId);
    if (!connection || connection.providerId !== 'resend') throw new Error('Email connection unavailable.');
    if (!connection.environments.includes(input.environment)) continue;
    const secret = connection.secrets.apiKey;
    const from = connection.config.from;
    if (!connection.enabled || !['configured', 'active'].includes(connection.status) || connection.events?.length
      || validateEditorIntegrations({ version: 1, connections: [connection] }).length
      || typeof from !== 'string' || !isOwnedEmailAddress(from)
      || secret?.ref !== `secret://website/${input.projectId}/${connection.id}/apiKey/${input.environment}`
      || !secret.updatedAt || !Number.isFinite(Date.parse(secret.updatedAt)) || !Number.isFinite(Date.parse(connection.updatedAt))) throw new Error('Email connection requires a verified customer credential binding without generic event automation.');
    rules.push({ ...applicationEmailRuleWithoutRuntime(rule), tableId: table.id, from });
    connections.set(connection.id, { id: connection.id, from, secretRef: secret.ref, secretUpdatedAt: secret.updatedAt, connectionUpdatedAt: connection.updatedAt });
  }
  if (connections.size > 10) throw new Error('Email worker supports at most 10 connections.');
  return { rules, connections: [...connections.values()] };
}

const identifier = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
const quoted = (value: string) => `"${value}"`;
function valueSql(field: ApplicationField): string {
  const column = `new.${quoted(field.key)}`;
  const value = field.type === 'datetime' ? `to_char(${column} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`
    : field.type === 'date' ? `to_char(${column},'YYYY-MM-DD')` : `${column}::text`;
  return `left(coalesce(${value},''),500)`;
}

function templateSql(parts: ApplicationEmailTemplatePart[]) {
  return parts.map(part => 'literal' in part ? literal(part.literal) : 'field' in part ? valueSql(part.field) : 'new.id::text').join(' || ') || "''";
}

/** Atomic AFTER triggers queue only emails to the record's verified owner. Existing
 * RLS/workflow guards authorize the write; recipients must also have owner-read access.
 * Customer exporter/custody/catalog mounting is required before installing this SQL. */
export function compileOwnedEmailNotificationRules(input: {
  definition: ApplicationDefinition; environment: OwnedEmailJob['environment']; rules: readonly OwnedEmailNotificationRule[];
}): string[] {
  const app = readApplicationDefinition(input.definition);
  if (!app.auth.enabled || !app.auth.emailVerificationRequired || !['preview', 'staging', 'production'].includes(input.environment)
    || !Array.isArray(input.rules) || input.rules.length > 50) throw new Error('Email notification rules unavailable.');
  const ids = new Set<string>();
  return input.rules.flatMap((rule: OwnedEmailNotificationRule, index: number) => {
    if (!rule || Object.keys(rule).sort().join(',') !== 'connectionId,event,from,id,subject,tableId,text'
      || !identifier.test(rule.id) || ids.has(rule.id) || !identifier.test(rule.connectionId) || !isOwnedEmailAddress(rule.from)
      || typeof rule.subject !== 'string' || !rule.subject.trim() || rule.subject.length > 200
      || Array.from(rule.subject).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
      || typeof rule.text !== 'string' || !rule.text.trim() || rule.text.length > 16000 || rule.text.includes('\0')) {
      throw new Error('Invalid email notification rule.');
    }
    ids.add(rule.id);
    const table = app.tables.find(table => table.id === rule.tableId);
    if (!table || !table.permissions.some(permission => permission.operation === 'read' && permission.access === 'owner')) {
      throw new Error('Email recipients require owner read access.');
    }
    const validation = validateApplicationEmailNotification(applicationEmailRuleWithoutRuntime(rule), table);
    if (validation) throw new Error(validation);
    const event = rule.event;
    let condition = "TG_OP='INSERT'", operation = 'insert';
    if (event?.type === 'created' && Object.keys(event).join(',') === 'type') {
      if (!table.permissions.some(permission => permission.operation === 'create' && permission.access !== 'public')) throw new Error('Email source write unavailable.');
    } else if (event?.type === 'transition' && Object.keys(event).sort().join(',') === 'transitionId,type') {
      const transition = table.workflow?.transitions.find(item => item.id === event.transitionId);
      const field = table.fields.find(field => field.id === table.workflow?.fieldId);
      if (!transition || !field) throw new Error('Unknown email workflow transition.');
      if (table.workflow!.transitions.some(other => other.id !== transition.id && other.to === transition.to
        && other.from.some(state => transition.from.includes(state)))) throw new Error('Email source transition is ambiguous.');
      condition = `TG_OP='UPDATE' and old.${quoted(field.key)} is distinct from new.${quoted(field.key)}
 and old.${quoted(field.key)} in (${transition.from.map(literal).join(',')}) and new.${quoted(field.key)}=${literal(transition.to)}`;
      operation = 'update';
    } else throw new Error('Unknown email notification event.');
    const subject = templateSql(applicationEmailTemplateParts(rule.subject, table.fields)), text = templateSql(applicationEmailTemplateParts(rule.text, table.fields));
    const name = `app_email_rule_${index}`;
    const body = `declare actor uuid := (select auth.uid()); rendered_subject text; rendered_body text;
begin
 if actor is null or (((select auth.jwt())->>'is_anonymous')::boolean) is true
  or not exists(select 1 from auth.users where id=actor and not coalesce(is_anonymous,false)
   and (banned_until is null or banned_until <= clock_timestamp())) then return new; end if;
 if not (${condition}) then return new; end if;
 if not exists(select 1 from auth.users where id=new.owner_id and email_confirmed_at is not null and email is not null
  and not coalesce(is_anonymous,false) and (banned_until is null or banned_until <= clock_timestamp())) then return new; end if;
 rendered_subject := left(regexp_replace(${subject},'[[:cntrl:]]',' ','g'),200);
 rendered_body := left(${text},32000);
 if btrim(rendered_subject)='' or btrim(rendered_body)='' then return new; end if;
 perform private.app_email_enqueue(pg_catalog.gen_random_uuid(),${literal(rule.connectionId)},new.owner_id,
  ${literal(input.environment)},${literal(rule.from)},rendered_subject,rendered_body);
 return new;
end`;
    // Dollar quoting is lexical even inside string literals. Pick a delimiter
    // absent from the complete body, including user-authored template literals.
    let delimiter = '$tayar_email_rule$'; let suffix = 0;
    while (body.includes(delimiter)) delimiter = `$tayar_email_rule_${++suffix}$`;
    return [
      `create function private.${name}() returns trigger language plpgsql security definer set search_path = '' as ${delimiter}\n${body}\n${delimiter};`,
      `revoke all on function private.${name}() from public,anon,authenticated,service_role;`,
      `create trigger ${name} after ${operation} on public.${quoted(`app_${table.key}`)} for each row execute function private.${name}();`,
    ];
  });
}
