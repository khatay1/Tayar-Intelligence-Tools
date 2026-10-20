create function private.social_hub_business_hours_valid(p_hours jsonb)
returns boolean language plpgsql immutable parallel safe set search_path='' as $$
declare slot jsonb;v_day integer;seen integer[]:=array[0,0,0,0,0,0,0];begin
 if p_hours is null or jsonb_typeof(p_hours)<>'array'or jsonb_array_length(p_hours)>7 then return false;end if;
 for slot in select value from jsonb_array_elements(p_hours)loop
  if jsonb_typeof(slot)<>'object'or(select count(*)from jsonb_object_keys(slot))<>3
   or not(slot?'day'and slot?'openMinute'and slot?'closeMinute')
   or jsonb_typeof(slot->'day')<>'number'or jsonb_typeof(slot->'openMinute')<>'number'or jsonb_typeof(slot->'closeMinute')<>'number'
   or slot->>'day'!~'^[0-6]$'or slot->>'openMinute'!~'^[0-9]{1,4}$'or slot->>'closeMinute'!~'^[0-9]{1,4}$'
   or(slot->>'openMinute')::integer not between 0 and 1439 or(slot->>'closeMinute')::integer not between 1 and 1440
   or(slot->>'openMinute')::integer >=(slot->>'closeMinute')::integer then return false;end if;
  v_day:=(slot->>'day')::integer;if seen[v_day+1]=1 then return false;end if;seen[v_day+1]:=1;
 end loop;return true;
end $$;
revoke all on function private.social_hub_business_hours_valid(jsonb)from public,anon,authenticated,service_role;

alter table private.social_hub_scopes add column business_time_zone text not null default'UTC'
 check(length(business_time_zone)between 1 and 64),add column business_hours jsonb not null default'[]'
 check(private.social_hub_business_hours_valid(business_hours));

create function private.configure_social_hub_business_hours(p_scope_id uuid,p_time_zone text,p_hours jsonb)
returns void language plpgsql security definer set search_path=''as $$
begin
 if not private.social_hub_access(p_scope_id,true,true)or exists(select 1 from public.profiles where id=auth.uid()and suspended)
  then raise exception'Manager required'using errcode='42501';end if;
 if p_time_zone is null or length(p_time_zone)not between 1 and 64
  or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_time_zone)
  or not private.social_hub_business_hours_valid(p_hours)then raise exception'Invalid business hours';end if;
 update private.social_hub_scopes set business_time_zone=p_time_zone,business_hours=p_hours where id=p_scope_id;
 if not found then raise exception'Scope unavailable';end if;
end $$;
revoke all on function private.configure_social_hub_business_hours(uuid,text,jsonb)from public,anon;
grant execute on function private.configure_social_hub_business_hours(uuid,text,jsonb)to authenticated;
create function public.configure_social_hub_business_hours(p_scope_id uuid,p_time_zone text,p_hours jsonb)
returns void language sql security invoker set search_path=''as $$select private.configure_social_hub_business_hours(p_scope_id,p_time_zone,p_hours)$$;
revoke all on function public.configure_social_hub_business_hours(uuid,text,jsonb)from public,anon;
grant execute on function public.configure_social_hub_business_hours(uuid,text,jsonb)to authenticated;

create function private.social_hub_outside_business_hours(p_scope_id uuid,p_occurred_at timestamptz)
returns boolean language sql stable security definer set search_path=''as $$
 select case when jsonb_array_length(s.business_hours)=0 then false else not exists(
  select 1 from jsonb_array_elements(s.business_hours)slot where(slot->>'day')::integer=extract(dow from(p_occurred_at at time zone s.business_time_zone))::integer
   and extract(hour from(p_occurred_at at time zone s.business_time_zone))::integer*60+extract(minute from(p_occurred_at at time zone s.business_time_zone))::integer
    >=(slot->>'openMinute')::integer
   and extract(hour from(p_occurred_at at time zone s.business_time_zone))::integer*60+extract(minute from(p_occurred_at at time zone s.business_time_zone))::integer
    <(slot->>'closeMinute')::integer)end from private.social_hub_scopes s where s.id=p_scope_id
$$;
revoke all on function private.social_hub_outside_business_hours(uuid,timestamptz)from public,anon,authenticated,service_role;

alter table private.social_hub_automation_events drop constraint social_hub_automation_events_event_type_check;
alter table private.social_hub_automation_events add constraint social_hub_automation_events_event_type_check
 check(event_type in('message_received','conversation_assigned','human_requested','outside_hours'));
alter table private.social_hub_automation_events drop constraint social_hub_automation_events_message_id_key;
alter table private.social_hub_automation_events add constraint social_hub_automation_events_message_type_key unique(message_id,event_type);
alter table private.social_hub_automation_rules drop constraint social_hub_automation_rules_trigger_check;
alter table private.social_hub_automation_rules add constraint social_hub_automation_rules_trigger_check
 check(trigger in('message.received','conversation.assigned','human.requested','outside.hours'));

create or replace function private.save_social_hub_event_rule(p_scope_id uuid,p_id uuid,p_enabled boolean,p_trigger text,p_contains text,p_action text,p_answer_id uuid default null)
returns uuid language plpgsql security definer set search_path=''as $$
declare v uuid;begin
 if p_trigger is null or p_trigger not in('message.received','conversation.assigned','human.requested','outside.hours')
  or(p_trigger<>'message.received'and(p_action='reply'or coalesce(p_contains,'')<>''))then raise exception'Unsupported event rule';end if;
 if not private.social_hub_access(p_scope_id,true,true)then raise exception'Manager required'using errcode='42501';end if;
 if p_trigger='outside.hours'and not exists(select 1 from private.social_hub_scopes where id=p_scope_id and jsonb_array_length(business_hours)>0)
  then raise exception'Business hours required';end if;
 perform 1 from private.social_hub_scopes where id=p_scope_id for update;
 update private.social_hub_automation_rules set trigger='message.received'where id=p_id and scope_id=p_scope_id;
 v:=private.save_social_hub_automation_rule(p_scope_id,p_id,p_enabled,p_contains,p_action,p_answer_id);
 update private.social_hub_automation_rules set trigger=p_trigger,updated_at=now()where id=v;return v;
end $$;

alter function private.ingest_social_hub_message(uuid,uuid,text,text,text,text,text,timestamptz,jsonb)
 rename to ingest_social_hub_message_before_outside_hours;
revoke all on function private.ingest_social_hub_message_before_outside_hours(uuid,uuid,text,text,text,text,text,timestamptz,jsonb)
 from public,anon,authenticated,service_role;
create function private.ingest_social_hub_message(p_scope_id uuid,p_connection_id uuid,p_event_id text,p_external_conversation_id text,p_external_message_id text,p_sender_name text,p_text text,p_occurred_at timestamptz,p_attachment_refs jsonb default'[]')
returns uuid language plpgsql security definer set search_path=''as $$
declare v_message uuid;v_conversation uuid;begin
 v_message:=private.ingest_social_hub_message_before_outside_hours(p_scope_id,p_connection_id,p_event_id,p_external_conversation_id,p_external_message_id,p_sender_name,p_text,p_occurred_at,p_attachment_refs);
 if v_message is null then return null;end if;
 if exists(select 1 from private.social_hub_scopes s join private.social_hub_automation_rules r on r.scope_id=s.id and r.enabled and r.trigger='outside.hours'
  where s.id=p_scope_id and s.enabled and s.automation_enabled and private.social_hub_outside_business_hours(s.id,p_occurred_at))then
  select conversation_id into v_conversation from private.social_hub_messages where id=v_message and scope_id=p_scope_id;
  insert into private.social_hub_automation_events(scope_id,conversation_id,message_id,event_type)values(p_scope_id,v_conversation,v_message,'outside_hours');
 end if;return v_message;
end $$;
revoke all on function private.ingest_social_hub_message(uuid,uuid,text,text,text,text,text,timestamptz,jsonb)from public,anon,authenticated;
grant execute on function private.ingest_social_hub_message(uuid,uuid,text,text,text,text,text,timestamptz,jsonb)to service_role;
create or replace function public.ingest_social_hub_message(p_scope_id uuid,p_connection_id uuid,p_event_id text,p_external_conversation_id text,p_external_message_id text,p_sender_name text,p_text text,p_occurred_at timestamptz,p_attachment_refs jsonb default'[]')
returns uuid language sql security invoker set search_path=''as $$select private.ingest_social_hub_message(p_scope_id,p_connection_id,p_event_id,p_external_conversation_id,p_external_message_id,p_sender_name,p_text,p_occurred_at,p_attachment_refs)$$;

alter function private.claim_social_hub_automation()rename to claim_social_hub_automation_before_outside_hours;
revoke all on function private.claim_social_hub_automation_before_outside_hours()from public,anon,authenticated,service_role;
create function private.claim_social_hub_automation()returns jsonb language plpgsql security definer set search_path=''as $$
declare v jsonb;v_type text;begin
 v:=private.claim_social_hub_automation_before_outside_hours();if v is null then return null;end if;
 select event_type into v_type from private.social_hub_automation_events where id=(v->>'id')::uuid;
 if v_type<>'outside_hours'then return v;end if;
 return v||jsonb_build_object('trigger','outside.hours','rules',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'scopeId',r.scope_id,'enabled',r.enabled,'trigger',r.trigger,'contains',r.contains,'action',r.action,'approvedAnswerId',r.approved_answer_id))
  from private.social_hub_automation_rules r where r.scope_id=(v->>'scopeId')::uuid and r.enabled and r.trigger='outside.hours'),'[]'::jsonb));
end $$;
revoke all on function private.claim_social_hub_automation()from public,anon,authenticated;
grant execute on function private.claim_social_hub_automation()to service_role;
create or replace function public.claim_social_hub_automation()returns jsonb language sql security invoker set search_path=''as $$select private.claim_social_hub_automation()$$;

alter function private.complete_social_hub_automation(uuid,uuid,jsonb)rename to complete_social_hub_automation_before_outside_hours;
revoke all on function private.complete_social_hub_automation_before_outside_hours(uuid,uuid,jsonb)from public,anon,authenticated,service_role;
create function private.complete_social_hub_automation(p_event_id uuid,p_claim_token uuid,p_decisions jsonb)
returns boolean language plpgsql security definer set search_path=''as $$
declare e private.social_hub_automation_events;s private.social_hub_scopes;c private.social_hub_conversations;r private.social_hub_automation_rules;d jsonb;v_applied boolean:=false;begin
 select * into e from private.social_hub_automation_events where id=p_event_id and claim_token=p_claim_token and lease_until>now()and processed_at is null;
 if not found then return false;end if;if e.event_type<>'outside_hours'then return private.complete_social_hub_automation_before_outside_hours(p_event_id,p_claim_token,p_decisions);end if;
 if jsonb_typeof(p_decisions)is distinct from'array'or jsonb_array_length(p_decisions)>20 then raise exception'Invalid decisions';end if;
 select * into s from private.social_hub_scopes where id=e.scope_id for update;select * into c from private.social_hub_conversations where id=e.conversation_id and scope_id=e.scope_id for update;
 select * into e from private.social_hub_automation_events where id=p_event_id and claim_token=p_claim_token and lease_until>now()and processed_at is null for update;if not found then return false;end if;
 if s.enabled and s.automation_enabled and e.created_at>=s.automation_enabled_at and c.status not in('archived','resolved')then
  for d in select distinct value from jsonb_array_elements(p_decisions)loop
   select * into r from private.social_hub_automation_rules where id::text=d->>'ruleId'and scope_id=s.id and enabled and trigger='outside.hours'and action=d->>'action';
   if not found or r.updated_at>e.created_at or r.contains<>''or r.action='reply'or not coalesce((private.get_social_hub_actor_access(s.id,r.configured_by)->>'canManage')::boolean,false)then continue;end if;
   if r.action='handoff'then update private.social_hub_conversations set status='human_required'where id=c.id;v_applied:=true;
   elsif r.action in('suggest','notify')then insert into private.social_hub_notes(scope_id,conversation_id,author_id,text)values(s.id,c.id,r.configured_by,'Automation: message received outside business hours.');v_applied:=true;end if;
  end loop;
 end if;
 update private.social_hub_automation_events set processed_at=now(),outcome=case when v_applied then'applied'else'skipped'end,claim_token=null,lease_until=null where id=e.id;return true;
end $$;
revoke all on function private.complete_social_hub_automation(uuid,uuid,jsonb)from public,anon,authenticated;
grant execute on function private.complete_social_hub_automation(uuid,uuid,jsonb)to service_role;
create or replace function public.complete_social_hub_automation(p_event_id uuid,p_claim_token uuid,p_decisions jsonb)
returns boolean language sql security invoker set search_path=''as $$select private.complete_social_hub_automation(p_event_id,p_claim_token,p_decisions)$$;
