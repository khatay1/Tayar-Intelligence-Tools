#!/usr/bin/env bash
# Synthetic-only PostgreSQL 17 backup and restore proof in the existing CI service.
set -euo pipefail
if [[ "$GITHUB_ACTIONS" != true || "$GITHUB_REPOSITORY" != khatay1/Tayar-Intelligence-Tools ]]; then
  echo 'REFUSED: disposable public-repo GitHub Actions only.' >&2; exit 2
fi
id="$TAYAR_PG_SERVICE_CONTAINER_ID"
if [[ ! "$id" =~ ^[0-9a-f]{64}$ ]] || [[ "$(docker inspect -f '{{.Config.Image}}' "$id")" != postgres:17.11 ]]; then
  echo 'REFUSED: PostgreSQL 17.11 test service ID required.' >&2; exit 2
fi
source_db=tayar_release_rehearsal_test
restore_db=tayar_release_restore_test
backup=/tmp/tayar_release_rehearsal.backup
created_source=false; created_restore=false
cleanup() {
  if [[ "$created_source" == true ]]; then
    docker exec "$id" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "DROP DATABASE IF EXISTS $source_db WITH (FORCE);" >/dev/null 2>&1 || true
  fi
  if [[ "$created_restore" == true ]]; then
    docker exec "$id" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "DROP DATABASE IF EXISTS $restore_db WITH (FORCE);" >/dev/null 2>&1 || true
  fi
  docker exec "$id" rm -f "$backup" >/dev/null 2>&1 || true
}
preexisting="$(docker exec "$id" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d postgres -c "SELECT count(*) FROM pg_database WHERE datname IN ('$source_db','$restore_db');")"
if [[ "$preexisting" != 0 ]]; then echo 'REFUSED: test DB name already exists.' >&2; exit 2; fi
trap cleanup EXIT
docker exec "$id" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "CREATE DATABASE $source_db;" >/dev/null
created_source=true
docker exec "$id" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "CREATE DATABASE $restore_db;" >/dev/null
created_restore=true

docker exec -i "$id" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$source_db" >/dev/null <<'SQL'
CREATE TABLE public.projects (id uuid PRIMARY KEY, user_id uuid NOT NULL, title text NOT NULL, content jsonb NOT NULL);
CREATE TABLE public.website_publish_versions (id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES public.projects(id), snapshot jsonb NOT NULL);
CREATE INDEX versions_project_idx ON public.website_publish_versions(project_id);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_publish_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_owner ON public.projects USING (user_id::text = current_setting('app.synthetic_owner',true));
CREATE POLICY version_owner ON public.website_publish_versions USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id));
INSERT INTO public.projects VALUES
('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000021','Synthetic real estate','{"type":"real-estate","features":["listings","booking"]}'),
('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000022','Synthetic store','{"type":"store","features":["orders"]}');
INSERT INTO public.website_publish_versions VALUES
('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000011','{"pages":["listings"]}'),
('00000000-0000-4000-8000-000000000032','00000000-0000-4000-8000-000000000012','{"pages":["shop"]}');
SQL

fingerprint() {
  docker exec "$id" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d "$1" -c \
    "SELECT md5(COALESCE((SELECT string_agg(row_to_json(p)::text,';' ORDER BY p.id) FROM public.projects p),'') || '|' || COALESCE((SELECT string_agg(row_to_json(v)::text,';' ORDER BY v.id) FROM public.website_publish_versions v),''));"
}
verify() {
  if [[ "$(fingerprint "$1")" != "$expected" ]]; then echo 'FAIL: restored synthetic rows differ.' >&2; return 1; fi
  docker exec -i "$id" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$1" >/dev/null <<'SQL'
DO $$ BEGIN
 IF (SELECT count(*) FROM public.projects) <> 2
   OR (SELECT count(*) FROM public.website_publish_versions) <> 2
   OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.projects'::regclass)
   OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.website_publish_versions'::regclass)
   OR (SELECT count(*) FROM pg_policies WHERE tablename IN ('projects','website_publish_versions') AND schemaname='public') <> 2
   OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='website_publish_versions_project_id_fkey' AND contype='f')
   OR NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='versions_project_idx' AND schemaname='public')
   OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='temporary_migration_column')
 THEN RAISE EXCEPTION 'Synthetic database restore lost data or critical structure'; END IF;
END $$;
SQL
}
expected="$(fingerprint "$source_db")"
docker exec "$id" pg_dump -U postgres -d "$source_db" -Fc --no-owner --no-acl -f "$backup"
docker exec "$id" test -s "$backup"
docker exec "$id" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$source_db" -c 'ALTER TABLE public.projects ADD COLUMN temporary_migration_column text;' >/dev/null
docker exec "$id" pg_restore -U postgres -d "$restore_db" --no-owner --no-acl --exit-on-error "$backup"
verify "$restore_db"
docker exec "$id" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "DROP DATABASE $source_db WITH (FORCE);" >/dev/null
docker exec "$id" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "CREATE DATABASE $source_db;" >/dev/null
docker exec "$id" pg_restore -U postgres -d "$source_db" --no-owner --no-acl --exit-on-error "$backup"
verify "$source_db"
echo 'PASS disposable PG17: backup and restore preserved synthetic data, RLS, policies, FK and index; schema mutation removed.'
