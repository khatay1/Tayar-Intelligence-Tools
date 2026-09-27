// Produces a rollback-only SQL fixture for an empty isolated test project.
// It deliberately fails if real public.projects/publish-version tables exist.
import { readFile } from 'node:fs/promises';
const setup = `begin;
create table public.projects(id uuid primary key,user_id uuid not null,type text not null,content jsonb not null,deleted_at timestamptz);
create table public.website_publish_versions(id uuid primary key,project_id uuid references public.projects(id),user_id uuid,storage_prefix text,snapshot jsonb,file_manifest jsonb,release_note text,published_url text,editor_fingerprint text);
insert into storage.buckets(id,name,public) values ('published-sites','published-sites',true) on conflict(id) do nothing;
alter table public.website_publish_versions enable row level security;
grant select, insert, update, delete on public.website_publish_versions to authenticated;
insert into public.projects values
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','website-builder','{"application":{"version":1}}',null),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','22222222-2222-4222-8222-222222222222','website-builder','{"application":{"version":1}}',null);
`;
let query = setup + await readFile('supabase/migrations/20260927001500_website_application_backend_bindings.sql', 'utf8');
for (const fixture of ['website-application-backend-bindings', 'website-application-backend-credentials', 'website-application-private-release', 'website-application-release-commit']) {
  query += '\nsavepoint isolated_fixture;\n' + await readFile(`scripts/fixtures/${fixture}.sql`, 'utf8') + '\nrollback to savepoint isolated_fixture;\n';
}
process.stdout.write(query + "\nselect 'PASS binding, custody and immutable private releases' as result; rollback;\n");
