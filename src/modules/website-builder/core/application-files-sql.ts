import type { ApplicationDefinition, ApplicationPermission } from './application-model';
import { readApplicationDefinition } from './application-validation';

const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
function access(rule: ApplicationPermission) {
  return rule.access === 'public' || rule.access === 'authenticated' ? 'true'
    : rule.access === 'owner' ? 'record.owner_id = (select auth.uid())'
      : `(select private.app_has_role(${literal(rule.roleId!)}))`;
}

/** Invoker functions preserve the parent table's RLS, including any extra
 * restrictions installed by the customer. No browser bypass credentials. */
export function applicationFilesManifest(input: ApplicationDefinition) {
  const app = readApplicationDefinition(input);
  return app.tables.flatMap((table, index) => {
    if (!table.attachments) return [];
    const permission = (operation: string) => table.permissions.filter(rule => rule.operation === operation).map(access).join(' or ');
    const name = `app_files_${index}_access`, bucket = `app_files_${table.key}`;
    const source = `
begin
  if object_bucket is distinct from ${literal(bucket)} then return restrictive; end if;
  if action not in ('SELECT', 'INSERT', 'DELETE') or (select auth.uid()) is null
    or (((select auth.jwt())->>'is_anonymous')::boolean) is true then return false; end if;
  if object_name is null or object_name !~ ${literal(`^${uuid}/${uuid}$`)}
    or (action = 'INSERT' and object_owner is distinct from (select auth.uid())::text) then return false; end if;
  return exists (select 1 from public."app_${table.key}" record
    where record.id::text = split_part(object_name, '/', 1)
      and (${permission('read')}) and (action = 'SELECT' or (${permission('update')})));
end;
`;
    const policies = (['SELECT', 'INSERT', 'DELETE', 'UPDATE'] as const).flatMap(command =>
      [false, true].filter(restrictive => restrictive || command !== 'UPDATE').map(restrictive => {
        const expression = `private.${name}(bucket_id, name, owner_id, ${literal(command)}::text, ${restrictive})`;
        return { name: `app_files_${index}_${command.toLowerCase()}${restrictive ? '_guard' : ''}`, command,
          permissive: !restrictive, roles: restrictive ? ['public'] : ['authenticated'],
          using: command === 'INSERT' ? null : expression,
          check: command === 'INSERT' || command === 'UPDATE' ? expression : null };
      }));
    return [{ name, bucket, source, rule: table.attachments, policies }];
  });
}

export function compileApplicationFilesSchema(app: ApplicationDefinition, index: number, replace = false): string[] {
  const manifest = applicationFilesManifest(app).find(item => item.name === `app_files_${index}_access`);
  if (!manifest) return [];
  const statements: string[] = [];
  if (!replace) statements.push(`insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values (${literal(manifest.bucket)}, ${literal(manifest.bucket)}, false, ${manifest.rule.maxBytes}, array[${manifest.rule.mimeTypes.map(literal).join(', ')}]::text[]);`);
  statements.push('grant usage on schema private to anon, authenticated;',
    `create ${replace ? 'or replace ' : ''}function private.${manifest.name}(object_bucket text, object_name text, object_owner text, action text, restrictive boolean) returns boolean language plpgsql stable security invoker set search_path = '' as $$${manifest.source}$$;`,
    `revoke all on function private.${manifest.name}(text, text, text, text, boolean) from public, anon, authenticated;`,
    `grant execute on function private.${manifest.name}(text, text, text, text, boolean) to anon, authenticated;`);
  for (const policy of manifest.policies) {
    if (replace) statements.push(`drop policy "${policy.name}" on storage.objects;`);
    statements.push(`create policy "${policy.name}" on storage.objects as ${policy.permissive ? 'permissive' : 'restrictive'} for ${policy.command} to ${policy.roles.join(', ')}${policy.using === null ? '' : ` using (${policy.using})`}${policy.check === null ? '' : ` with check (${policy.check})`};`);
  }
  return statements;
}
