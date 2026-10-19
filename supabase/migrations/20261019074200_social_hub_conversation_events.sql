alter table private.social_hub_automation_events alter column message_id drop not null;
alter table private.social_hub_automation_events drop constraint social_hub_automation_events_event_type_check;
alter table private.social_hub_automation_events add constraint social_hub_automation_events_event_type_check
 check(event_type in('message_received','conversation_assigned','human_requested'));
alter table private.social_hub_automation_rules drop constraint social_hub_automation_rules_trigger_check;
alter table private.social_hub_automation_rules add constraint social_hub_automation_rules_trigger_check
 check(trigger in('message.received','conversation.assigned','human.requested'));
alter table private.social_hub_automation_rules add constraint social_hub_event_reply_guard
 check(trigger='message.received' or(action<>'reply' and contains=''));

create function private.save_social_hub_event_rule(p_scope_id uuid,p_id uuid,p_enabled boolean,p_trigger text,p_contains text,p_action text,p_answer_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid;begin
 if p_trigger is null or p_trigger not in('message.received','conversation.assigned','human.requested')
  or(p_trigger<>'message.received' and(p_action='reply' or coalesce(p_contains,'')<>''))then raise exception 'Unsupported event rule';end if;
 if not private.social_hub_access(p_scope_id,true,true)then raise exception 'Manager required' using errcode='42501';end if;
 perform 1 from private.social_hub_scopes where id=p_scope_id for update;
 -- Permit switching a non-message rule back to a message reply atomically.
 update private.social_hub_automation_rules set trigger='message.received' where id=p_id and scope_id=p_scope_id;
 -- Existing implementation supplies manager checks, scope lock, limits and cancellation.
 v:=private.save_social_hub_automation_rule(p_scope_id,p_id,p_enabled,p_contains,p_action,p_answer_id);
 update private.social_hub_automation_rules set trigger=p_trigger,updated_at=now() where id=v;
 return v;
end $$;
revoke all on function private.save_social_hub_event_rule(uuid,uuid,boolean,text,text,text,uuid) from public,anon;
grant execute on function private.save_social_hub_event_rule(uuid,uuid,boolean,text,text,text,uuid) to authenticated;
create function public.save_social_hub_event_rule(p_scope_id uuid,p_id uuid,p_enabled boolean,p_trigger text,p_contains text,p_action text,p_answer_id uuid default null)
returns uuid language sql security invoker set search_path='' as $$select private.save_social_hub_event_rule(p_scope_id,p_id,p_enabled,p_trigger,p_contains,p_action,p_answer_id)$$;
revoke all on function public.save_social_hub_event_rule(uuid,uuid,boolean,text,text,text,uuid) from public,anon;
grant execute on function public.save_social_hub_event_rule(uuid,uuid,boolean,text,text,text,uuid) to authenticated;

create function private.capture_social_hub_conversation_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_trigger text;begin
 if not exists(select 1 from private.social_hub_scopes where id=new.scope_id and enabled and automation_enabled)then return new;end if;
 foreach v_trigger in array array['conversation.assigned','human.requested']loop
  if((v_trigger='conversation.assigned' and new.assigned_to is not null and new.assigned_to is distinct from old.assigned_to)
   or(v_trigger='human.requested' and new.status='human_required' and old.status<>'human_required'))
   and exists(select 1 from private.social_hub_automation_rules where scope_id=new.scope_id and enabled and trigger=v_trigger)then
   insert into private.social_hub_automation_events(scope_id,conversation_id,message_id,event_type)
   values(new.scope_id,new.id,null,case v_trigger when 'conversation.assigned' then 'conversation_assigned'else 'human_requested'end);
  end if;
 end loop;
 return new;
end $$;
revoke all on function private.capture_social_hub_conversation_event() from public,anon,authenticated,service_role;
create trigger social_hub_conversation_event after update of assigned_to,status on private.social_hub_conversations
 for each row execute function private.capture_social_hub_conversation_event();

alter function private.claim_social_hub_automation() rename to claim_social_hub_automation_before_events;
revoke all on function private.claim_social_hub_automation_before_events() from public,anon,authenticated,service_role;
create function private.claim_social_hub_automation()returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;v_trigger text;begin
 v:=private.claim_social_hub_automation_before_events();if v is null then return null;end if;
 select case event_type when 'message_received'then'message.received'when'conversation_assigned'then'conversation.assigned'else'human.requested'end
 into v_trigger from private.social_hub_automation_events where id=(v->>'id')::uuid;
 return v||jsonb_build_object('trigger',v_trigger,'text',coalesce(v->>'text',''),
  'rules',coalesce((select jsonb_agg(rule)from jsonb_array_elements(v->'rules')as t(rule)where rule->>'trigger'=v_trigger),'[]'::jsonb));
end $$;
revoke all on function private.claim_social_hub_automation() from public,anon,authenticated;
grant execute on function private.claim_social_hub_automation() to service_role;
create or replace function public.claim_social_hub_automation()returns jsonb language sql security invoker set search_path='' as $$select private.claim_social_hub_automation()$$;

alter function private.complete_social_hub_automation(uuid,uuid,jsonb) rename to complete_social_hub_automation_before_events;
revoke all on function private.complete_social_hub_automation_before_events(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
create function private.complete_social_hub_automation(p_event_id uuid,p_claim_token uuid,p_decisions jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare e private.social_hub_automation_events;s private.social_hub_scopes;c private.social_hub_conversations;
 r private.social_hub_automation_rules;d jsonb;v_decisions jsonb;v_trigger text;v_applied boolean:=false;begin
 if jsonb_typeof(p_decisions)is distinct from'array'or jsonb_array_length(p_decisions)>20 then raise exception 'Invalid decisions';end if;
 select * into e from private.social_hub_automation_events where id=p_event_id and claim_token=p_claim_token and lease_until>now()and processed_at is null;
 if not found then return false;end if;
 if e.event_type='message_received'then
  select coalesce(jsonb_agg(decision),'[]')into v_decisions from jsonb_array_elements(p_decisions)as t(decision)
   join private.social_hub_automation_rules candidate on candidate.id::text=decision->>'ruleId' and candidate.scope_id=e.scope_id and candidate.trigger='message.received';
  return private.complete_social_hub_automation_before_events(p_event_id,p_claim_token,v_decisions);
 end if;
 select * into s from private.social_hub_scopes where id=e.scope_id for update;
 select * into c from private.social_hub_conversations where id=e.conversation_id and scope_id=e.scope_id for update;
 select * into e from private.social_hub_automation_events where id=p_event_id and claim_token=p_claim_token and lease_until>now()and processed_at is null for update;
 if not found then return false;end if;
 v_trigger:=case e.event_type when'conversation_assigned'then'conversation.assigned'else'human.requested'end;
 if s.enabled and s.automation_enabled and e.created_at>=s.automation_enabled_at and c.status not in('archived','resolved')then
  for d in select distinct value from jsonb_array_elements(p_decisions)loop
   select * into r from private.social_hub_automation_rules where id::text=d->>'ruleId'and scope_id=s.id and enabled and trigger=v_trigger and action=d->>'action';
   if not found or r.updated_at>e.created_at or r.contains<>''or not coalesce((private.get_social_hub_actor_access(s.id,r.configured_by)->>'canManage')::boolean,false)then continue;end if;
   if r.action='handoff'then
    update private.social_hub_conversations set status='human_required'where id=c.id;v_applied:=true;
   elsif r.action in('suggest','notify')then
    insert into private.social_hub_notes(scope_id,conversation_id,author_id,text)values(s.id,c.id,r.configured_by,
     case when v_trigger='conversation.assigned'then'Automation: assigned conversation requires review.'else'Automation: human follow-up requested.'end);v_applied:=true;
   end if;
  end loop;
 end if;
 update private.social_hub_automation_events set processed_at=now(),outcome=case when v_applied then'applied'else'skipped'end,claim_token=null,lease_until=null where id=e.id;
 return true;
end $$;
revoke all on function private.complete_social_hub_automation(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.complete_social_hub_automation(uuid,uuid,jsonb) to service_role;
create or replace function public.complete_social_hub_automation(p_event_id uuid,p_claim_token uuid,p_decisions jsonb)
returns boolean language sql security invoker set search_path='' as $$select private.complete_social_hub_automation(p_event_id,p_claim_token,p_decisions)$$;
