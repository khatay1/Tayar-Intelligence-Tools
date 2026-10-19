-- A Social Hub scope does not grant access to a transferred/deleted project's CRM.
create function private.social_hub_project_crm_access(p_scope_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.social_hub_access(p_scope_id,true,true) and exists(
  select 1 from private.social_hub_scopes s join public.projects p on p.id=s.project_id
  where s.id=p_scope_id and s.kind='customer' and p.deleted_at is null
   and p.workspace_id is not distinct from s.workspace_id
   and (s.workspace_id is not null or p.user_id=s.owner_id)
   and public.website_project_team_role(p.id) in('owner','admin'))
$$;
revoke all on function private.social_hub_project_crm_access(uuid) from public,anon,authenticated,service_role;

alter function private.get_social_hub_inbox(uuid) rename to get_social_hub_inbox_before_project_guard;
revoke all on function private.get_social_hub_inbox_before_project_guard(uuid) from public,anon,authenticated,service_role;
create function private.get_social_hub_inbox(p_scope_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;begin
 -- Keep project ownership/workspace stable while resolving CRM authorization.
 perform 1 from public.projects p join private.social_hub_scopes s on s.project_id=p.id
  where s.id=p_scope_id for share of p;
 v:=private.get_social_hub_inbox_before_project_guard(p_scope_id);
 if not private.social_hub_project_crm_access(p_scope_id) then
  v:=jsonb_set(v,'{crmLeads}','null'::jsonb);
  v:=jsonb_set(v,'{conversations}',coalesce((select jsonb_agg(c-'crm_lead_id'-'crm_reference')
   from jsonb_array_elements(v->'conversations')c),'[]'::jsonb));
 end if;
 return v;
end $$;
revoke all on function private.get_social_hub_inbox(uuid) from public,anon;
grant execute on function private.get_social_hub_inbox(uuid) to authenticated;
create or replace function public.get_social_hub_inbox(p_scope_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.get_social_hub_inbox(p_scope_id)$$;

alter function private.link_social_hub_crm_lead(uuid,uuid) rename to link_social_hub_crm_lead_before_project_guard;
revoke all on function private.link_social_hub_crm_lead_before_project_guard(uuid,uuid) from public,anon,authenticated,service_role;
create function private.link_social_hub_crm_lead(p_conversation_id uuid,p_lead_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_scope uuid;begin
 select c.scope_id into v_scope from private.social_hub_conversations c where c.id=p_conversation_id;
 perform 1 from public.projects p join private.social_hub_scopes s on s.project_id=p.id
  where s.id=v_scope for share of p;
 if not coalesce(private.social_hub_project_crm_access(v_scope),false) then
  raise exception 'Current project CRM manager required' using errcode='42501';
 end if;
 perform private.link_social_hub_crm_lead_before_project_guard(p_conversation_id,p_lead_id);
end $$;
revoke all on function private.link_social_hub_crm_lead(uuid,uuid) from public,anon;
grant execute on function private.link_social_hub_crm_lead(uuid,uuid) to authenticated;
create or replace function public.link_social_hub_crm_lead(p_conversation_id uuid,p_lead_id uuid default null)
returns void language sql security invoker set search_path='' as $$select private.link_social_hub_crm_lead(p_conversation_id,p_lead_id)$$;
