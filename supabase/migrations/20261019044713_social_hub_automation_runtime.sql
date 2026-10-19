-- Local automation consumes the existing inbox events and writes the existing outbox.
alter table private.social_hub_scopes add column automation_enabled_at timestamptz;
create table private.social_hub_automation_rules (
 id uuid primary key default gen_random_uuid(),scope_id uuid not null references private.social_hub_scopes(id) on delete cascade,
 enabled boolean not null default false,trigger text not null default 'message.received' check(trigger='message.received'),
 contains text not null default '' check(length(contains)<=200),action text not null check(action in('suggest','handoff','notify','reply')),
 approved_answer_id uuid references private.social_hub_knowledge(id) on delete restrict,
 configured_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),
 check(action<>'reply' or approved_answer_id is not null)
);
create index social_hub_automation_rules_scope on private.social_hub_automation_rules(scope_id);
create index social_hub_automation_rules_answer on private.social_hub_automation_rules(approved_answer_id);
create index social_hub_automation_rules_actor on private.social_hub_automation_rules(configured_by);
alter table private.social_hub_automation_rules enable row level security;
revoke all on private.social_hub_automation_rules from public,anon,authenticated;
grant all on private.social_hub_automation_rules to service_role;
alter table private.social_hub_automation_events add column claim_token uuid,add column lease_until timestamptz,
 add column outcome text check(outcome in('applied','skipped'));
create index social_hub_automation_due on private.social_hub_automation_events(created_at,id) where processed_at is null;
alter table private.social_hub_outbox add column automation_rule_id uuid references private.social_hub_automation_rules(id),
 add column automation_message_id uuid references private.social_hub_messages(id);
create index social_hub_outbox_rule on private.social_hub_outbox(automation_rule_id);
create index social_hub_outbox_auto_message on private.social_hub_outbox(automation_message_id);

-- Attach automation provenance to the existing claim envelope without changing its fence.
alter function private.claim_social_hub_outgoing(uuid,uuid,uuid) rename to claim_social_hub_outgoing_base;
revoke all on function private.claim_social_hub_outgoing_base(uuid,uuid,uuid)from public,anon,authenticated,service_role;
create function private.claim_social_hub_outgoing(p_scope_id uuid,p_connection_id uuid,p_job_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare v jsonb;begin
 v:=private.claim_social_hub_outgoing_base(p_scope_id,p_connection_id,p_job_id);if v is null then return null;end if;
 return v||jsonb_build_object('automation_rule_id',(select automation_rule_id from private.social_hub_outbox where id=p_job_id));
end $$;
revoke all on function private.claim_social_hub_outgoing(uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function private.claim_social_hub_outgoing(uuid,uuid,uuid)to service_role;
create or replace function public.claim_social_hub_outgoing(p_scope_id uuid,p_connection_id uuid,p_job_id uuid)returns jsonb language sql security invoker set search_path=''as $$select private.claim_social_hub_outgoing(p_scope_id,p_connection_id,p_job_id)$$;

create function private.save_social_hub_automation_rule(p_scope_id uuid,p_id uuid,p_enabled boolean,p_contains text,p_action text,p_answer_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid:=coalesce(p_id,gen_random_uuid());begin
 if not private.social_hub_access(p_scope_id,true,true) or exists(select 1 from public.profiles where id=auth.uid() and suspended)then raise exception 'Manager required' using errcode='42501';end if;
 perform 1 from private.social_hub_scopes where id=p_scope_id for update;
 if exists(select 1 from private.social_hub_automation_rules where id=v and scope_id<>p_scope_id)then raise exception 'Rule scope mismatch';end if;
 if not exists(select 1 from private.social_hub_automation_rules where id=v)and(select count(*)from private.social_hub_automation_rules where scope_id=p_scope_id)>=20 then raise exception 'Rule limit reached';end if;
 if p_answer_id is not null and not exists(select 1 from private.social_hub_knowledge where id=p_answer_id and scope_id=p_scope_id and approved and not sensitive)then raise exception 'Approved answer required';end if;
 -- Editing a rule invalidates queued replies from its previous version.
 update private.social_hub_outbox set status='cancelled',last_error_code='automation_rule_changed' where automation_rule_id=v and status='queued';
 insert into private.social_hub_automation_rules(id,scope_id,enabled,contains,action,approved_answer_id,configured_by)
 values(v,p_scope_id,p_enabled,p_contains,p_action,p_answer_id,auth.uid())on conflict(id)do update set enabled=excluded.enabled,contains=excluded.contains,
 action=excluded.action,approved_answer_id=excluded.approved_answer_id,configured_by=excluded.configured_by,updated_at=now();return v;
end $$;
create function private.get_social_hub_automation_rules(p_scope_id uuid)returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.social_hub_access(p_scope_id,true,true)or exists(select 1 from public.profiles where id=auth.uid()and suspended)then return null;end if;
 return coalesce((select jsonb_agg(to_jsonb(r))from(select * from private.social_hub_automation_rules where scope_id=p_scope_id order by id limit 20)r),'[]');
end $$;

create function private.set_social_hub_automation(p_scope_id uuid,p_enabled boolean)returns void language plpgsql security definer set search_path=''as $$
begin
 if p_enabled is null or not private.social_hub_access(p_scope_id,true,true)or exists(select 1 from public.profiles where id=auth.uid()and suspended)then raise exception 'Manager required'using errcode='42501';end if;
 update private.social_hub_scopes set automation_enabled_at=case when p_enabled and not automation_enabled then now()else automation_enabled_at end,
 automation_enabled=p_enabled where id=p_scope_id and(enabled or not p_enabled);
 if not found then raise exception 'Enabled scope required';end if;
 if not p_enabled then update private.social_hub_outbox set status='cancelled',last_error_code='automation_disabled'where scope_id=p_scope_id and automation_rule_id is not null and status='queued';end if;
end $$;

create function private.claim_social_hub_automation()returns jsonb language plpgsql security definer set search_path='' as $$
declare e private.social_hub_automation_events;c private.social_hub_conversations;m private.social_hub_messages;begin
 select x.* into e from private.social_hub_automation_events x join private.social_hub_scopes s on s.id=x.scope_id
 where x.processed_at is null and(x.lease_until is null or x.lease_until<now())and s.enabled and s.automation_enabled
 order by x.created_at,x.id for update of x skip locked limit 1;
 if not found then return null;end if;
 update private.social_hub_automation_events set claim_token=gen_random_uuid(),lease_until=now()+interval '1 minute' where id=e.id returning * into e;
 select * into c from private.social_hub_conversations where id=e.conversation_id and scope_id=e.scope_id;
 select * into m from private.social_hub_messages where id=e.message_id and scope_id=e.scope_id and conversation_id=c.id and direction='inbound';
 return jsonb_build_object('id',e.id,'claimToken',e.claim_token,'scopeId',e.scope_id,'messageId',e.message_id,'text',m.text,
 'humanAssigned',c.assigned_to is not null or c.status in('human_required','archived','resolved'),
 'rules',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'scopeId',r.scope_id,'enabled',r.enabled,'trigger',r.trigger,'contains',r.contains,'action',r.action,'approvedAnswerId',r.approved_answer_id))from private.social_hub_automation_rules r where r.scope_id=e.scope_id and r.enabled),'[]'),
 'knowledge',coalesce((select jsonb_agg(jsonb_build_object('id',k.id,'scopeId',k.scope_id,'question',k.question,'answer',k.answer,'language',k.language,'approved',k.approved,'sensitive',k.sensitive))from private.social_hub_knowledge k where k.scope_id=e.scope_id and k.approved and not k.sensitive and k.id in(select approved_answer_id from private.social_hub_automation_rules where scope_id=e.scope_id and enabled)),'[]'));
end $$;

create function private.complete_social_hub_automation(p_event_id uuid,p_claim_token uuid,p_decisions jsonb)returns boolean language plpgsql security definer set search_path='' as $$
declare e private.social_hub_automation_events;s private.social_hub_scopes;c private.social_hub_conversations;m private.social_hub_messages;
 r private.social_hub_automation_rules;k private.social_hub_knowledge;d jsonb;v_applied boolean:=false;v_replied boolean:=false;begin
 if jsonb_typeof(p_decisions)is distinct from 'array'or jsonb_array_length(p_decisions)>20 then raise exception 'Invalid decisions';end if;
 select * into e from private.social_hub_automation_events where id=p_event_id and claim_token=p_claim_token and lease_until>now()and processed_at is null;
 if not found then return false;end if;
 select * into s from private.social_hub_scopes where id=e.scope_id for update;
 select * into c from private.social_hub_conversations where id=e.conversation_id and scope_id=e.scope_id for update;
 select * into e from private.social_hub_automation_events where id=p_event_id and claim_token=p_claim_token and lease_until>now()and processed_at is null for update;
 if not found then return false;end if;
 select * into m from private.social_hub_messages where id=e.message_id and scope_id=e.scope_id and conversation_id=c.id and direction='inbound';
 if s.enabled and s.automation_enabled and e.created_at>=s.automation_enabled_at and m.id is not null and c.status not in('archived','resolved')then
 for d in select value from(select distinct value from jsonb_array_elements(p_decisions))decisions order by(value->>'action'='handoff')desc loop
 select * into r from private.social_hub_automation_rules where id=(d->>'ruleId')::uuid and scope_id=s.id and enabled and action=d->>'action';
 if not found or r.updated_at>e.created_at or not coalesce((private.get_social_hub_actor_access(s.id,r.configured_by)->>'canManage')::boolean,false)
 or(r.contains<>''and position(lower(r.contains)in lower(m.text))=0)then continue;end if;
 if r.action='handoff'then
 update private.social_hub_conversations set status='human_required'where id=c.id;c.status:='human_required';v_applied:=true;
 elsif r.action in('notify','suggest')then
 insert into private.social_hub_notes(scope_id,conversation_id,author_id,text)values(s.id,c.id,r.configured_by,case when r.action='notify'then 'Automation: follow-up requested.'else 'Automation: review an approved reply.'end);v_applied:=true;
 elsif r.action='reply'and not v_replied and c.assigned_to is null and c.status not in('human_required','archived','resolved')then
 select * into k from private.social_hub_knowledge where id=r.approved_answer_id and scope_id=s.id and approved and not sensitive;
 -- Only the exact approved question can authorize unattended sending. Never accept worker-supplied prose.
 if found and k.updated_at<=e.created_at and lower(btrim(m.text))=lower(btrim(k.question))and length(k.answer)<=4000
 and not exists(select 1 from private.social_hub_knowledge other where other.scope_id=s.id and other.approved and not other.sensitive and other.language=k.language and lower(btrim(other.question))=lower(btrim(m.text))and other.answer<>k.answer)
 and(m.text||' '||k.answer)!~*'(refund|payment|password|diagnosis|medical|prescription|card number|bank|delete|cancel|استرداد|دفع|كلمة السر|تشخيص|دواء|بطاق|حذف|إلغاء)'
 then
 insert into private.social_hub_outbox(scope_id,conversation_id,connection_id,requested_by,text,idempotency_key,automation_rule_id,automation_message_id)
 values(s.id,c.id,c.connection_id,r.configured_by,k.answer,'social:'||e.id::text,r.id,m.id)on conflict(scope_id,idempotency_key)do nothing;
 v_applied:=true;v_replied:=true;
 end if;
 end if;
 end loop;
 end if;
 update private.social_hub_automation_events set processed_at=now(),outcome=case when v_applied then 'applied'else 'skipped'end,claim_token=null,lease_until=null where id=e.id;
 return true;
end $$;

-- Automatic replies are reauthorized immediately before the existing dispatch reservation.
alter function private.reserve_social_hub_dispatch(uuid,uuid) rename to reserve_social_hub_dispatch_base;
revoke all on function private.reserve_social_hub_dispatch_base(uuid,uuid)from public,anon,authenticated,service_role;
create function private.reserve_social_hub_dispatch(p_job_id uuid,p_claim_token uuid)returns boolean language plpgsql security definer set search_path='' as $$
declare o private.social_hub_outbox;r private.social_hub_automation_rules;k private.social_hub_knowledge;c private.social_hub_conversations;begin
 select * into o from private.social_hub_outbox where id=p_job_id;
 if o.automation_rule_id is not null then
 perform 1 from private.social_hub_scopes where id=o.scope_id and enabled and automation_enabled for update;if not found then return false;end if;
 perform 1 from private.social_hub_connections where id=o.connection_id and scope_id=o.scope_id for update;
 select * into c from private.social_hub_conversations where id=o.conversation_id and scope_id=o.scope_id for update;
 if c.assigned_to is not null or c.status in('human_required','archived','resolved')then return false;end if;
 select * into r from private.social_hub_automation_rules where id=o.automation_rule_id and scope_id=o.scope_id and enabled and action='reply';
 if not found or not coalesce((private.get_social_hub_actor_access(o.scope_id,r.configured_by)->>'canManage')::boolean,false)then return false;end if;
 select * into k from private.social_hub_knowledge where id=r.approved_answer_id and scope_id=o.scope_id and approved and not sensitive;
 if not found or k.answer<>o.text then return false;end if;
 end if;
 return private.reserve_social_hub_dispatch_base(p_job_id,p_claim_token);
end $$;
revoke all on function private.reserve_social_hub_dispatch(uuid,uuid)from public,anon,authenticated;
grant execute on function private.reserve_social_hub_dispatch(uuid,uuid)to service_role;
-- Rebind the public wrapper after the internal rename (SQL bodies can retain OID bindings).
create or replace function public.reserve_social_hub_dispatch(p_job_id uuid,p_claim_token uuid)returns boolean language sql security invoker set search_path=''as $$select private.reserve_social_hub_dispatch(p_job_id,p_claim_token)$$;

revoke all on function private.save_social_hub_automation_rule(uuid,uuid,boolean,text,text,uuid),private.get_social_hub_automation_rules(uuid)from public,anon;
grant execute on function private.save_social_hub_automation_rule(uuid,uuid,boolean,text,text,uuid),private.get_social_hub_automation_rules(uuid)to authenticated;
create function public.save_social_hub_automation_rule(p_scope_id uuid,p_id uuid,p_enabled boolean,p_contains text,p_action text,p_answer_id uuid default null)returns uuid language sql security invoker set search_path=''as $$select private.save_social_hub_automation_rule(p_scope_id,p_id,p_enabled,p_contains,p_action,p_answer_id)$$;
create function public.get_social_hub_automation_rules(p_scope_id uuid)returns jsonb language sql security invoker set search_path=''as $$select private.get_social_hub_automation_rules(p_scope_id)$$;
revoke all on function public.save_social_hub_automation_rule(uuid,uuid,boolean,text,text,uuid),public.get_social_hub_automation_rules(uuid)from public,anon;
grant execute on function public.save_social_hub_automation_rule(uuid,uuid,boolean,text,text,uuid),public.get_social_hub_automation_rules(uuid)to authenticated;
revoke all on function private.claim_social_hub_automation(),private.complete_social_hub_automation(uuid,uuid,jsonb)from public,anon,authenticated;
grant execute on function private.claim_social_hub_automation(),private.complete_social_hub_automation(uuid,uuid,jsonb)to service_role;
create function public.claim_social_hub_automation()returns jsonb language sql security invoker set search_path=''as $$select private.claim_social_hub_automation()$$;
create function public.complete_social_hub_automation(p_event_id uuid,p_claim_token uuid,p_decisions jsonb)returns boolean language sql security invoker set search_path=''as $$select private.complete_social_hub_automation(p_event_id,p_claim_token,p_decisions)$$;
revoke all on function public.claim_social_hub_automation(),public.complete_social_hub_automation(uuid,uuid,jsonb)from public,anon,authenticated;
grant execute on function public.claim_social_hub_automation(),public.complete_social_hub_automation(uuid,uuid,jsonb)to service_role;
revoke all on function private.set_social_hub_automation(uuid,boolean)from public,anon;
grant execute on function private.set_social_hub_automation(uuid,boolean)to authenticated;
create function public.set_social_hub_automation(p_scope_id uuid,p_enabled boolean)returns void language sql security invoker set search_path=''as $$select private.set_social_hub_automation(p_scope_id,p_enabled)$$;
revoke all on function public.set_social_hub_automation(uuid,boolean)from public,anon;
grant execute on function public.set_social_hub_automation(uuid,boolean)to authenticated;
