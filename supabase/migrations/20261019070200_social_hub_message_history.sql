-- Per-conversation keyset history; the global inbox snapshot is not full history.
create index social_hub_message_history_cursor on private.social_hub_messages(conversation_id,occurred_at desc,id desc);
create function private.get_social_hub_message_history(p_conversation_id uuid,p_before_id uuid default null,p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.social_hub_conversations;m private.social_hub_messages;v jsonb;n integer;begin
 select * into c from private.social_hub_conversations where id=p_conversation_id;
 if c.id is null or not private.social_hub_access(c.scope_id) then raise exception 'Conversation access required' using errcode='42501';end if;
 if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'Invalid history page size';end if;
 if p_before_id is not null then
  select * into m from private.social_hub_messages where id=p_before_id and conversation_id=c.id and scope_id=c.scope_id;
  if not found then raise exception 'Invalid conversation cursor' using errcode='42501';end if;
 end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.occurred_at desc,x.id desc),'[]'),count(*) into v,n
 from(select * from private.social_hub_messages where conversation_id=c.id and scope_id=c.scope_id
  and(p_before_id is null or(occurred_at,id)<(m.occurred_at,m.id))order by occurred_at desc,id desc limit p_limit+1)x;
 if n>p_limit then v:=v-p_limit;end if;
 return jsonb_build_object('messages',v,'nextBeforeId',case when n>p_limit then v->(p_limit-1)->>'id' else null end);
end $$;
revoke all on function private.get_social_hub_message_history(uuid,uuid,integer) from public,anon;
grant execute on function private.get_social_hub_message_history(uuid,uuid,integer) to authenticated;
create function public.get_social_hub_message_history(p_conversation_id uuid,p_before_id uuid default null,p_limit integer default 50)
returns jsonb language sql security invoker set search_path='' as $$select private.get_social_hub_message_history(p_conversation_id,p_before_id,p_limit)$$;
revoke all on function public.get_social_hub_message_history(uuid,uuid,integer) from public,anon;
grant execute on function public.get_social_hub_message_history(uuid,uuid,integer) to authenticated;
