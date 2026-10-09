import type { ApplicationAccess, ApplicationDefinition } from './application-model';
import { readApplicationDefinition } from './application-validation';

const quoted = (value: string) => `"${value}"`;
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;

export function applicationWorkflowInfrastructure(): string[] {
  return [
    'create table if not exists private.app_workflow_requests (actor_id uuid not null, request_id uuid not null, table_name text not null, record_id uuid not null, transition_id text not null, from_state text not null, to_state text not null, primary key(actor_id, request_id));',
    'alter table private.app_workflow_requests enable row level security;',
    'revoke all on private.app_workflow_requests from public, anon, authenticated;',
    'create table if not exists private.app_workflow_context (transaction_id bigint primary key, actor_id uuid not null, table_name text not null, record_id uuid not null, field_name text not null, from_state text not null, to_state text not null);',
    'alter table private.app_workflow_context enable row level security;',
    'revoke all on private.app_workflow_context from public, anon, authenticated;',
    `create or replace function private.app_workflow_write_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP='INSERT' then
    if to_jsonb(new)->>TG_ARGV[0] is distinct from TG_ARGV[1] then raise exception 'Workflow records require the initial state'; end if;
    return new;
  end if;
  if to_jsonb(new)->>TG_ARGV[0] is not distinct from to_jsonb(old)->>TG_ARGV[0] then return new; end if;
  if not exists (select 1 from private.app_workflow_context where transaction_id=txid_current()
    and actor_id=(select auth.uid()) and table_name=TG_TABLE_NAME and record_id=old.id and field_name=TG_ARGV[0]
    and from_state=to_jsonb(old)->>TG_ARGV[0] and to_state=to_jsonb(new)->>TG_ARGV[0]) then
    raise exception 'Workflow state changes require an atomic transition';
  end if;
  return new;
end $$;`,
    'revoke all on function private.app_workflow_write_guard() from public, anon, authenticated;',
  ];
}

function accessCondition(access: Exclude<ApplicationAccess, 'public'>, roleId: string | undefined): string {
  if (access === 'owner') return 'owner = actor';
  if (access === 'role') return `(select private.app_has_role(${literal(roleId!)}))`;
  return 'true';
}

export function compileApplicationWorkflowSchema(input: ApplicationDefinition, index: number, existing = false): string[] {
  const app = readApplicationDefinition(input), table = app.tables[index], workflow = table?.workflow;
  if (!table || !workflow) return [];
  const field = table.fields.find(candidate => candidate.id === workflow.fieldId)!;
  const tableName = `app_${table.key}`, fullTable = `public.${quoted(tableName)}`, inner = `app_transition_workflow_${index}`;
  const permission = (operation: 'read' | 'update') => table.permissions.filter(rule => rule.operation === operation)
    .map(rule => rule.access === 'public' ? 'true' : accessCondition(rule.access, rule.roleId)).join(' or ') || 'false';
  const branches = workflow.transitions.map((transition, transitionIndex) => `${transitionIndex ? 'elsif' : 'if'} transition_id=${literal(transition.id)} then
    allowed_from:=array[${transition.from.map(literal).join(',')}]; requested_to:=${literal(transition.to)};
  `).join('') + `else raise exception 'Application workflow transition unavailable'; end if;`;
  const accessBranches = workflow.transitions.map((transition, transitionIndex) => `${transitionIndex ? 'elsif' : 'if'} transition_id=${literal(transition.id)} then
    permitted:=${accessCondition(transition.access, transition.roleId)};
  `).join('') + `else permitted:=false; end if;`;
  const statement = `create ${existing ? 'or replace ' : ''}function public.${inner}(record_id uuid, transition_id text, request_id uuid) returns text language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); owner uuid; current_state text; requested_to text; allowed_from text[]; permitted boolean; claimed uuid; prior private.app_workflow_requests%rowtype;
begin
  if actor is null or (((select auth.jwt())->>'is_anonymous')::boolean) is true or record_id is null or request_id is null then raise exception 'Application workflow transition unavailable'; end if;
  ${branches}
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text || ':' || request_id::text,0));
  select * into prior from private.app_workflow_requests r where r.actor_id=actor and r.request_id=${inner}.request_id;
  if found then
    if prior.table_name<>${literal(tableName)} or prior.record_id<>${inner}.record_id or prior.transition_id<>${inner}.transition_id or prior.to_state<>requested_to then raise exception 'Application workflow request identity mismatch'; end if;
    return 'already-transitioned';
  end if;
  select owner_id,${quoted(field.key)} into owner,current_state from ${fullTable} where id=${inner}.record_id for update;
  if not found or not current_state=any(allowed_from) or not (${permission('read')}) or not (${permission('update')}) then raise exception 'Application workflow transition unavailable'; end if;
  ${accessBranches}
  if not permitted then raise exception 'Application workflow transition unavailable'; end if;
  insert into private.app_workflow_requests(actor_id,request_id,table_name,record_id,transition_id,from_state,to_state)
    values(actor,${inner}.request_id,${literal(tableName)},${inner}.record_id,${inner}.transition_id,current_state,requested_to)
    on conflict on constraint app_workflow_requests_pkey do nothing returning app_workflow_requests.request_id into claimed;
  if claimed is null then raise exception 'Application workflow request identity mismatch'; end if;
  insert into private.app_workflow_context(transaction_id,actor_id,table_name,record_id,field_name,from_state,to_state)
    values(txid_current(),actor,${literal(tableName)},${inner}.record_id,${literal(field.key)},current_state,requested_to);
  update ${fullTable} set ${quoted(field.key)}=requested_to where id=${inner}.record_id;
  delete from private.app_workflow_context where transaction_id=txid_current();
  return 'transitioned';
end $$;`;
  const statements = [
    `create trigger app_workflow_guard before insert or update on ${fullTable} for each row execute function private.app_workflow_write_guard(${literal(field.key)},${literal(String(field.defaultValue))});`,
    statement,
    `revoke all on function public.${inner}(uuid,text,uuid) from public, anon;`,
    `grant execute on function public.${inner}(uuid,text,uuid) to authenticated;`,
  ];
  return existing ? statements.slice(1) : statements;
}

export function applicationWorkflowFunctionManifest(input: ApplicationDefinition) {
  const app = readApplicationDefinition(input);
  const statements = [
    ...applicationWorkflowInfrastructure().filter(statement => statement.startsWith('create or replace function ')),
    ...app.tables.flatMap((_, index) => compileApplicationWorkflowSchema(app, index, true).filter(statement => statement.startsWith('create or replace function '))),
  ];
  return statements.map(statement => {
    const match = /^create or replace function (private|public)\.(app_[a-z_0-9]+)\(([^)]*)\) returns (text|trigger) language (plpgsql) security (definer|invoker) set search_path = '' as \$\$([\s\S]*)\$\$;$/.exec(statement);
    if (!match) throw new Error('Application workflow function manifest is unavailable.');
    return { schema: match[1], name: match[2], arguments: match[3].replace(/,\s*/g, ', '), result: match[4], language: match[5], securityDefiner: match[6] === 'definer', source: match[7] };
  });
}
