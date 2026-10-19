create table private.social_hub_read_states (
 scope_id uuid not null references private.social_hub_scopes(id) on delete cascade,
 conversation_id uuid not null references private.social_hub_conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 last_read_at timestamptz not null,
 last_read_message_id uuid references private.social_hub_messages(id) on delete set null,
 updated_at timestamptz not null default now(),
 primary key(user_id,conversation_id)
);
create index social_hub_read_states_scope_user on private.social_hub_read_states(scope_id,user_id);
create index social_hub_unread_inbound on private.social_hub_messages(conversation_id,occurred_at,id) where direction='inbound';
alter table private.social_hub_read_states enable row level security;
revoke all on private.social_hub_read_states from public,anon,authenticated;
grant all on private.social_hub_read_states to service_role;

create function private.get_social_hub_unread_counts(p_scope_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.social_hub_access(p_scope_id) then raise exception 'Scope access required' using errcode='42501';end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object('conversationId',c.id,'unread',(
   select count(*) from private.social_hub_messages m
   left join private.social_hub_read_states r on r.scope_id=c.scope_id and r.conversation_id=c.id and r.user_id=auth.uid()
   where m.scope_id=c.scope_id and m.conversation_id=c.id and m.direction='inbound'
    and(r.user_id is null or m.occurred_at>r.last_read_at
     or(m.occurred_at=r.last_read_at and(r.last_read_message_id is null or m.id>r.last_read_message_id)))
  )) order by c.last_message_at desc)
  from(select * from private.social_hub_conversations where scope_id=p_scope_id order by last_message_at desc limit 100)c
 ),'[]'::jsonb);
end $$;

create function private.mark_social_hub_conversation_read(p_conversation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare c private.social_hub_conversations;m private.social_hub_messages;begin
 select * into c from private.social_hub_conversations where id=p_conversation_id;
 if not private.social_hub_access(c.scope_id) then raise exception 'Scope access required' using errcode='42501';end if;
 select * into m from private.social_hub_messages where scope_id=c.scope_id and conversation_id=c.id and direction='inbound'
  order by occurred_at desc,id desc limit 1;
 insert into private.social_hub_read_states(scope_id,conversation_id,user_id,last_read_at,last_read_message_id)
 values(c.scope_id,c.id,auth.uid(),coalesce(m.occurred_at,now()),m.id)
 on conflict(user_id,conversation_id)do update set scope_id=excluded.scope_id,
  last_read_at=case when(private.social_hub_read_states.last_read_at,coalesce(private.social_hub_read_states.last_read_message_id,'00000000-0000-0000-0000-000000000000'::uuid))
   >(excluded.last_read_at,coalesce(excluded.last_read_message_id,'00000000-0000-0000-0000-000000000000'::uuid))
   then private.social_hub_read_states.last_read_at else excluded.last_read_at end,
  last_read_message_id=case when(private.social_hub_read_states.last_read_at,coalesce(private.social_hub_read_states.last_read_message_id,'00000000-0000-0000-0000-000000000000'::uuid))
   >(excluded.last_read_at,coalesce(excluded.last_read_message_id,'00000000-0000-0000-0000-000000000000'::uuid))
   then private.social_hub_read_states.last_read_message_id else excluded.last_read_message_id end,updated_at=now();
end $$;

revoke all on function private.get_social_hub_unread_counts(uuid),private.mark_social_hub_conversation_read(uuid) from public,anon;
grant execute on function private.get_social_hub_unread_counts(uuid),private.mark_social_hub_conversation_read(uuid) to authenticated;
create function public.get_social_hub_unread_counts(p_scope_id uuid)returns jsonb language sql security invoker set search_path='' as $$select private.get_social_hub_unread_counts(p_scope_id)$$;
create function public.mark_social_hub_conversation_read(p_conversation_id uuid)returns void language sql security invoker set search_path='' as $$select private.mark_social_hub_conversation_read(p_conversation_id)$$;
revoke all on function public.get_social_hub_unread_counts(uuid),public.mark_social_hub_conversation_read(uuid) from public,anon;
grant execute on function public.get_social_hub_unread_counts(uuid),public.mark_social_hub_conversation_read(uuid) to authenticated;
