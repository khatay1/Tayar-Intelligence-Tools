create or replace function private.social_hub_valid_assignee(p_scope_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select p_user_id is null or exists(
  select 1 from private.social_hub_scopes s where s.id=p_scope_id and
   case when s.kind='official' then exists(select 1 from public.profiles p where p.id=p_user_id and p.role='admin' and not coalesce(p.suspended,false))
   when s.workspace_id is null then p_user_id=s.owner_id and not exists(select 1 from public.profiles p where p.id=p_user_id and coalesce(p.suspended,false))
   else exists(select 1 from public.team_workspace_members m join public.profiles p on p.id=m.user_id
    where m.workspace_id=s.workspace_id and m.user_id=p_user_id and m.role in('owner','admin','editor') and not coalesce(p.suspended,false))end)
$$;

alter function private.mutate_social_hub_conversation(uuid,text,uuid,text,boolean)
 rename to mutate_social_hub_conversation_before_team_assignment;
revoke all on function private.mutate_social_hub_conversation_before_team_assignment(uuid,text,uuid,text,boolean)
 from public,anon,authenticated,service_role;
create function private.mutate_social_hub_conversation(p_conversation_id uuid,p_status text default null,p_assigned_to uuid default null,p_note text default null,p_set_assignment boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare v_scope uuid;begin
 select scope_id into v_scope from private.social_hub_conversations where id=p_conversation_id;
 if p_set_assignment and not private.social_hub_valid_assignee(v_scope,p_assigned_to)then
  raise exception 'Assignee outside scope' using errcode='42501';
 end if;
 perform private.mutate_social_hub_conversation_before_team_assignment(p_conversation_id,p_status,p_assigned_to,p_note,p_set_assignment);
end $$;
revoke all on function private.mutate_social_hub_conversation(uuid,text,uuid,text,boolean) from public,anon;
grant execute on function private.mutate_social_hub_conversation(uuid,text,uuid,text,boolean) to authenticated;

create function private.list_social_hub_assignees(p_scope_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s private.social_hub_scopes;begin
 if not private.social_hub_access(p_scope_id)then raise exception 'Scope access required' using errcode='42501';end if;
 select * into s from private.social_hub_scopes where id=p_scope_id;
 return coalesce((select jsonb_agg(jsonb_build_object('id',candidate.id,'name',candidate.name)order by candidate.name,candidate.id)
  from(select p.id,coalesce(nullif(left(trim(p.full_name),100),''),'Team member')name from public.profiles p
   where private.social_hub_valid_assignee(s.id,p.id) order by name,p.id limit 200)candidate),'[]'::jsonb);
end $$;
revoke all on function private.list_social_hub_assignees(uuid) from public,anon;
grant execute on function private.list_social_hub_assignees(uuid) to authenticated;
create function public.list_social_hub_assignees(p_scope_id uuid)returns jsonb language sql stable security invoker set search_path='' as $$select private.list_social_hub_assignees(p_scope_id)$$;
revoke all on function public.list_social_hub_assignees(uuid) from public,anon;
grant execute on function public.list_social_hub_assignees(uuid) to authenticated;
