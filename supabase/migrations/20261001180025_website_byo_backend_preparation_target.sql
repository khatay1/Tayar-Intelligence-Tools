-- The backend-preparation worker derives runtime-binding CAS state only after
-- the customer Supabase migration has reached its verified ready state. An
-- exact retry receives the pre-commit version so the existing full-field
-- reconciliation RPC can recover the committed binding without another write.
create function public.website_byo_backend_preparation_state(
 p_project_id uuid,p_owner_id uuid,p_environment text,p_operation_id uuid
)returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'bindingVersion',coalesce(b.version,0),
  'expectedBindingVersion',case when b.last_commit_id=p_operation_id then b.version-1 else coalesce(b.version,0)end,
  'operationCommitted',coalesce(b.last_commit_id=p_operation_id,false))
 from public.projects p
 left join private.website_byo_runtime_bindings b on b.project_id=p.id
  and b.owner_id=p_owner_id and b.environment=p_environment
 where p.id=p_project_id and p.user_id=p_owner_id and p.type='website-builder'and p.deleted_at is null
  and p_environment in('preview','production')and p_operation_id is not null
  and(b.project_id is null or b.version>0)
$$;
revoke all on function public.website_byo_backend_preparation_state(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.website_byo_backend_preparation_state(uuid,uuid,text,uuid) to service_role;
