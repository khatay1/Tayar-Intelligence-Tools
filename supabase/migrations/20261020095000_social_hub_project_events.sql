create table private.social_hub_project_events(
 id uuid primary key default gen_random_uuid(),scope_id uuid not null references private.social_hub_scopes(id)on delete cascade,
 conversation_id uuid not null,project_id uuid not null references public.projects(id)on delete cascade,
 trigger text not null check(trigger in('order.status.changed','booking.reminder')),
 external_event_key text not null check(external_event_key~'^[A-Za-z0-9_.:=-]{8,200}$'),
 due_at timestamptz not null,created_at timestamptz not null default now(),emitted_at timestamptz,cancelled_at timestamptz,
 foreign key(conversation_id,scope_id)references private.social_hub_conversations(id,scope_id)on delete cascade,
 unique(scope_id,trigger,external_event_key),check(emitted_at is null or cancelled_at is null)
);
create index social_hub_project_events_due on private.social_hub_project_events(due_at,id)where emitted_at is null and cancelled_at is null;
alter table private.social_hub_project_events enable row level security;
revoke all on private.social_hub_project_events from public,anon,authenticated;
grant all on private.social_hub_project_events to service_role;

alter table private.social_hub_automation_events add column source_project_event_id uuid unique references private.social_hub_project_events(id)on delete cascade;
alter table private.social_hub_automation_events drop constraint social_hub_automation_events_event_type_check;
alter table private.social_hub_automation_events add constraint social_hub_automation_events_event_type_check
 check(event_type in('message_received','conversation_assigned','human_requested','outside_hours','order_status_changed','booking_reminder'));
alter table private.social_hub_automation_rules drop constraint social_hub_automation_rules_trigger_check;
alter table private.social_hub_automation_rules add constraint social_hub_automation_rules_trigger_check
 check(trigger in('message.received','conversation.assigned','human.requested','outside.hours','order.status.changed','booking.reminder'));

create or replace function private.save_social_hub_event_rule(p_scope_id uuid,p_id uuid,p_enabled boolean,p_trigger text,p_contains text,p_action text,p_answer_id uuid default null)
returns uuid language plpgsql security definer set search_path=''as $$
declare v uuid;begin
 if p_trigger is null or p_trigger not in('message.received','conversation.assigned','human.requested','outside.hours','order.status.changed','booking.reminder')
  or(p_trigger<>'message.received'and(p_action='reply'or coalesce(p_contains,'')<>''))then raise exception'Unsupported event rule';end if;
 if not private.social_hub_access(p_scope_id,true,true)then raise exception'Manager required'using errcode='42501';end if;
 if p_trigger='outside.hours'and not exists(select 1 from private.social_hub_scopes where id=p_scope_id and jsonb_array_length(business_hours)>0)
  then raise exception'Business hours required';end if;
 if p_trigger in('order.status.changed','booking.reminder')and not exists(select 1 from private.social_hub_scopes where id=p_scope_id and project_id is not null)
  then raise exception'Project scope required';end if;
 perform 1 from private.social_hub_scopes where id=p_scope_id for update;
 update private.social_hub_automation_rules set trigger='message.received'where id=p_id and scope_id=p_scope_id;
 v:=private.save_social_hub_automation_rule(p_scope_id,p_id,p_enabled,p_contains,p_action,p_answer_id);
 update private.social_hub_automation_rules set trigger=p_trigger,updated_at=now()where id=v;return v;
end $$;

create function private.schedule_social_hub_project_event(p_scope_id uuid,p_project_id uuid,p_conversation_id uuid,p_trigger text,p_external_event_key text,p_due_at timestamptz)
returns uuid language plpgsql security definer set search_path=''as $$
declare v uuid;existing private.social_hub_project_events;begin
 if p_trigger is null or p_trigger not in('order.status.changed','booking.reminder')or p_external_event_key is null or p_external_event_key!~'^[A-Za-z0-9_.:=-]{8,200}$'or p_due_at is null
  or p_due_at<now()-interval'5 minutes'or p_due_at>now()+interval'366 days'
  or(p_trigger='order.status.changed'and p_due_at>now()+interval'5 minutes')then raise exception'Invalid project event';end if;
 perform 1 from private.social_hub_scopes s join private.social_hub_conversations c on c.scope_id=s.id and c.id=p_conversation_id
  where s.id=p_scope_id and s.project_id=p_project_id and s.enabled and s.automation_enabled and c.status not in('archived','resolved')
   and exists(select 1 from private.social_hub_automation_rules r where r.scope_id=s.id and r.enabled and r.trigger=p_trigger)for update of s;
 if not found then raise exception'Enabled project automation required';end if;
 select * into existing from private.social_hub_project_events where scope_id=p_scope_id and trigger=p_trigger and external_event_key=p_external_event_key;
 if found then
  if existing.project_id<>p_project_id or existing.conversation_id<>p_conversation_id or existing.due_at<>p_due_at then raise exception'Idempotency conflict';end if;return existing.id;
 end if;
 if(select count(*)from private.social_hub_project_events where scope_id=p_scope_id and emitted_at is null and cancelled_at is null)>=1000 then raise exception'Project event limit reached';end if;
 insert into private.social_hub_project_events(scope_id,conversation_id,project_id,trigger,external_event_key,due_at)
 values(p_scope_id,p_conversation_id,p_project_id,p_trigger,p_external_event_key,p_due_at)on conflict(scope_id,trigger,external_event_key)do nothing returning id into v;
 if v is null then select * into existing from private.social_hub_project_events where scope_id=p_scope_id and trigger=p_trigger and external_event_key=p_external_event_key;
  if existing.project_id<>p_project_id or existing.conversation_id<>p_conversation_id or existing.due_at<>p_due_at then raise exception'Idempotency conflict';end if;v:=existing.id;end if;
 return v;
end $$;
create function private.cancel_social_hub_booking_reminder(p_scope_id uuid,p_project_id uuid,p_external_event_key text)
returns boolean language plpgsql security definer set search_path=''as $$
begin
 update private.social_hub_project_events set cancelled_at=now()where scope_id=p_scope_id and project_id=p_project_id and trigger='booking.reminder'
  and external_event_key=p_external_event_key and emitted_at is null and cancelled_at is null;return found;
end $$;
revoke all on function private.schedule_social_hub_project_event(uuid,uuid,uuid,text,text,timestamptz),private.cancel_social_hub_booking_reminder(uuid,uuid,text)from public,anon,authenticated;
grant execute on function private.schedule_social_hub_project_event(uuid,uuid,uuid,text,text,timestamptz),private.cancel_social_hub_booking_reminder(uuid,uuid,text)to service_role;
create function public.schedule_social_hub_project_event(p_scope_id uuid,p_project_id uuid,p_conversation_id uuid,p_trigger text,p_external_event_key text,p_due_at timestamptz)
returns uuid language sql security invoker set search_path=''as $$select private.schedule_social_hub_project_event(p_scope_id,p_project_id,p_conversation_id,p_trigger,p_external_event_key,p_due_at)$$;
create function public.cancel_social_hub_booking_reminder(p_scope_id uuid,p_project_id uuid,p_external_event_key text)
returns boolean language sql security invoker set search_path=''as $$select private.cancel_social_hub_booking_reminder(p_scope_id,p_project_id,p_external_event_key)$$;
revoke all on function public.schedule_social_hub_project_event(uuid,uuid,uuid,text,text,timestamptz),public.cancel_social_hub_booking_reminder(uuid,uuid,text)from public,anon,authenticated;
grant execute on function public.schedule_social_hub_project_event(uuid,uuid,uuid,text,text,timestamptz),public.cancel_social_hub_booking_reminder(uuid,uuid,text)to service_role;

create function private.promote_due_social_hub_project_events()returns void language plpgsql security definer set search_path=''as $$
declare e private.social_hub_project_events;begin
 update private.social_hub_project_events p set cancelled_at=now()from private.social_hub_scopes s where s.id=p.scope_id and p.emitted_at is null and p.cancelled_at is null
  and p.due_at<=now()and(not s.enabled or not s.automation_enabled or p.created_at<s.automation_enabled_at);
 for e in select p.* from private.social_hub_project_events p join private.social_hub_scopes s on s.id=p.scope_id
  where p.emitted_at is null and p.cancelled_at is null and p.due_at<=now()and s.enabled and s.automation_enabled and p.created_at>=s.automation_enabled_at
   and exists(select 1 from private.social_hub_automation_rules r where r.scope_id=p.scope_id and r.enabled and r.trigger=p.trigger)
  order by p.due_at,p.id for update of p skip locked limit 20 loop
  insert into private.social_hub_automation_events(scope_id,conversation_id,message_id,event_type,source_project_event_id)
   values(e.scope_id,e.conversation_id,null,case e.trigger when'order.status.changed'then'order_status_changed'else'booking_reminder'end,e.id);
  update private.social_hub_project_events set emitted_at=now()where id=e.id;
 end loop;
end $$;
revoke all on function private.promote_due_social_hub_project_events()from public,anon,authenticated,service_role;

alter function private.claim_social_hub_automation()rename to claim_social_hub_automation_before_project_events;
revoke all on function private.claim_social_hub_automation_before_project_events()from public,anon,authenticated,service_role;
create function private.claim_social_hub_automation()returns jsonb language plpgsql security definer set search_path=''as $$
declare v jsonb;v_type text;v_trigger text;begin
 perform private.promote_due_social_hub_project_events();v:=private.claim_social_hub_automation_before_project_events();if v is null then return null;end if;
 select event_type into v_type from private.social_hub_automation_events where id=(v->>'id')::uuid;
 if v_type not in('order_status_changed','booking_reminder')then return v;end if;
 v_trigger:=case v_type when'order_status_changed'then'order.status.changed'else'booking.reminder'end;
 return v||jsonb_build_object('trigger',v_trigger,'rules',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'scopeId',r.scope_id,'enabled',r.enabled,'trigger',r.trigger,'contains',r.contains,'action',r.action,'approvedAnswerId',r.approved_answer_id))
  from private.social_hub_automation_rules r where r.scope_id=(v->>'scopeId')::uuid and r.enabled and r.trigger=v_trigger),'[]'::jsonb));
end $$;
revoke all on function private.claim_social_hub_automation()from public,anon,authenticated;
grant execute on function private.claim_social_hub_automation()to service_role;
create or replace function public.claim_social_hub_automation()returns jsonb language sql security invoker set search_path=''as $$select private.claim_social_hub_automation()$$;

alter function private.complete_social_hub_automation(uuid,uuid,jsonb)rename to complete_social_hub_automation_before_project_events;
revoke all on function private.complete_social_hub_automation_before_project_events(uuid,uuid,jsonb)from public,anon,authenticated,service_role;
create function private.complete_social_hub_automation(p_event_id uuid,p_claim_token uuid,p_decisions jsonb)
returns boolean language plpgsql security definer set search_path=''as $$
declare e private.social_hub_automation_events;s private.social_hub_scopes;c private.social_hub_conversations;r private.social_hub_automation_rules;d jsonb;v_trigger text;v_applied boolean:=false;begin
 select * into e from private.social_hub_automation_events where id=p_event_id and claim_token=p_claim_token and lease_until>now()and processed_at is null;
 if not found then return false;end if;if e.event_type not in('order_status_changed','booking_reminder')then return private.complete_social_hub_automation_before_project_events(p_event_id,p_claim_token,p_decisions);end if;
 if jsonb_typeof(p_decisions)is distinct from'array'or jsonb_array_length(p_decisions)>20 then raise exception'Invalid decisions';end if;
 v_trigger:=case e.event_type when'order_status_changed'then'order.status.changed'else'booking.reminder'end;
 select * into s from private.social_hub_scopes where id=e.scope_id for update;select * into c from private.social_hub_conversations where id=e.conversation_id and scope_id=e.scope_id for update;
 select * into e from private.social_hub_automation_events where id=p_event_id and claim_token=p_claim_token and lease_until>now()and processed_at is null for update;if not found then return false;end if;
 if s.enabled and s.automation_enabled and e.created_at>=s.automation_enabled_at and c.status not in('archived','resolved')then
  for d in select distinct value from jsonb_array_elements(p_decisions)loop
   select * into r from private.social_hub_automation_rules where id::text=d->>'ruleId'and scope_id=s.id and enabled and trigger=v_trigger and action=d->>'action';
   if not found or r.updated_at>e.created_at or r.contains<>''or r.action='reply'or not coalesce((private.get_social_hub_actor_access(s.id,r.configured_by)->>'canManage')::boolean,false)then continue;end if;
   if r.action='handoff'then update private.social_hub_conversations set status='human_required'where id=c.id;v_applied:=true;
   elsif r.action in('suggest','notify')then insert into private.social_hub_notes(scope_id,conversation_id,author_id,text)values(s.id,c.id,r.configured_by,
    case v_trigger when'order.status.changed'then'Automation: order status changed.'else'Automation: booking reminder due.'end);v_applied:=true;end if;
  end loop;
 end if;
 update private.social_hub_automation_events set processed_at=now(),outcome=case when v_applied then'applied'else'skipped'end,claim_token=null,lease_until=null where id=e.id;return true;
end $$;
revoke all on function private.complete_social_hub_automation(uuid,uuid,jsonb)from public,anon,authenticated;
grant execute on function private.complete_social_hub_automation(uuid,uuid,jsonb)to service_role;
create or replace function public.complete_social_hub_automation(p_event_id uuid,p_claim_token uuid,p_decisions jsonb)
returns boolean language sql security invoker set search_path=''as $$select private.complete_social_hub_automation(p_event_id,p_claim_token,p_decisions)$$;
