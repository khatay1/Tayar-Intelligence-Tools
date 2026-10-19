-- Social Hub CRM links and tenant-scoped follow-up work. Disabled scopes remain inert.
alter table private.social_hub_conversations
  add column crm_lead_id uuid references public.website_leads(id) on delete set null;
create index social_hub_conversations_crm_lead on private.social_hub_conversations(crm_lead_id)
  where crm_lead_id is not null;

create table private.social_hub_followups (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null,
  conversation_id uuid not null,
  title text not null check(length(btrim(title)) between 1 and 200),
  body text not null default '' check(length(body)<=4000),
  status text not null default 'open' check(status in ('open','done')),
  source text not null default 'manual' check(source in ('manual','handoff')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(conversation_id,scope_id)
    references private.social_hub_conversations(id,scope_id) on delete cascade
);
create index social_hub_followups_scope on private.social_hub_followups(scope_id,status,created_at desc);
create index social_hub_followups_conversation on private.social_hub_followups(conversation_id,created_at desc);
create index social_hub_followups_assignee on private.social_hub_followups(assigned_to) where assigned_to is not null;
create unique index social_hub_one_open_handoff on private.social_hub_followups(conversation_id)
  where source='handoff' and status='open';
alter table private.social_hub_followups enable row level security;
revoke all on private.social_hub_followups from public,anon,authenticated;
grant all on private.social_hub_followups to service_role;

create function private.social_hub_valid_assignee(p_scope_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select p_user_id is null or exists(
  select 1 from private.social_hub_scopes s where s.id=p_scope_id and
   case when s.kind='official' then exists(select 1 from public.profiles where id=p_user_id and role='admin' and not coalesce(suspended,false))
   when s.workspace_id is null then p_user_id=s.owner_id
   else exists(select 1 from public.team_workspace_members m where m.workspace_id=s.workspace_id and m.user_id=p_user_id and m.role in('owner','admin','editor')) end)
$$;

create function private.ensure_social_hub_handoff_followup()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_creator uuid;begin
 if new.status<>'human_required' or (tg_op='UPDATE' and old.status='human_required') then return new;end if;
 select coalesce(auth.uid(),s.owner_id) into v_creator from private.social_hub_scopes s where s.id=new.scope_id;
 insert into private.social_hub_followups(scope_id,conversation_id,title,body,source,assigned_to,created_by)
 select new.scope_id,new.id,'Human follow-up required','Review the conversation before any further automated action.','handoff',new.assigned_to,v_creator
 where not exists(select 1 from private.social_hub_followups f where f.conversation_id=new.id and f.source='handoff' and f.status='open');
 return new;
end $$;
create trigger social_hub_handoff_followup after insert or update of status on private.social_hub_conversations
for each row execute function private.ensure_social_hub_handoff_followup();

create function private.link_social_hub_crm_lead(p_conversation_id uuid,p_lead_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare c private.social_hub_conversations;s private.social_hub_scopes;begin
 select * into c from private.social_hub_conversations where id=p_conversation_id for update;
 if c.id is null or not private.social_hub_access(c.scope_id,true,true) then raise exception 'Manager access required' using errcode='42501';end if;
 select * into s from private.social_hub_scopes where id=c.scope_id;
 if s.kind<>'customer' or s.project_id is null then raise exception 'Project CRM unavailable';end if;
 if p_lead_id is not null and not exists(select 1 from public.website_leads l where l.id=p_lead_id and l.project_id=s.project_id) then raise exception 'CRM lead outside scope' using errcode='42501';end if;
 update private.social_hub_conversations set crm_lead_id=p_lead_id,
  crm_reference=case when p_lead_id is null then null else jsonb_build_object('provider','website_leads','leadId',p_lead_id)end
 where id=c.id;
end $$;

create function private.create_social_hub_followup(p_conversation_id uuid,p_title text,p_body text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare c private.social_hub_conversations;v uuid;begin
 select * into c from private.social_hub_conversations where id=p_conversation_id;
 if c.id is null or not private.social_hub_access(c.scope_id,true) then raise exception 'Editor access required' using errcode='42501';end if;
 insert into private.social_hub_followups(scope_id,conversation_id,title,body,source,created_by)
 values(c.scope_id,c.id,btrim(p_title),coalesce(p_body,''),'manual',auth.uid()) returning id into v;
 return v;
end $$;

create function private.mutate_social_hub_followup(p_id uuid,p_status text default null,p_assigned_to uuid default null,p_set_assignment boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare f private.social_hub_followups;begin
 select * into f from private.social_hub_followups where id=p_id for update;
 if f.id is null or not private.social_hub_access(f.scope_id,true) then raise exception 'Editor access required' using errcode='42501';end if;
 if p_status is not null and p_status not in('open','done') then raise exception 'Invalid follow-up status';end if;
 if p_set_assignment and not private.social_hub_valid_assignee(f.scope_id,p_assigned_to) then raise exception 'Assignee outside scope' using errcode='42501';end if;
 update private.social_hub_followups set status=coalesce(p_status,status),
  assigned_to=case when p_set_assignment then p_assigned_to else assigned_to end,updated_at=now() where id=f.id;
end $$;

create or replace function private.get_social_hub_inbox(p_scope_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.social_hub_scopes;begin
 if not private.social_hub_access(p_scope_id) then raise exception 'Scope access required' using errcode='42501';end if;
 select * into s from private.social_hub_scopes where id=p_scope_id;
 return jsonb_build_object('scope',to_jsonb(s),
 'connections',coalesce((select jsonb_agg(to_jsonb(c)-'secret_ref') from private.social_hub_connections c where scope_id=p_scope_id),'[]'),
 'conversations',coalesce((select jsonb_agg(to_jsonb(c)) from(select * from private.social_hub_conversations where scope_id=p_scope_id order by last_message_at desc limit 100)c),'[]'),
 'messages',coalesce((select jsonb_agg(to_jsonb(m)) from(select * from private.social_hub_messages where scope_id=p_scope_id order by occurred_at desc limit 500)m),'[]'),
 'notes',coalesce((select jsonb_agg(to_jsonb(n)) from(select * from private.social_hub_notes where scope_id=p_scope_id order by created_at desc limit 200)n),'[]'),
 'outbox',coalesce((select jsonb_agg(to_jsonb(o)-'claim_token') from(select * from private.social_hub_outbox where scope_id=p_scope_id order by created_at desc limit 100)o),'[]'),
 'followups',coalesce((select jsonb_agg(to_jsonb(f)) from(select * from private.social_hub_followups where scope_id=p_scope_id order by created_at desc limit 200)f),'[]'),
 'crmLeads',case when s.kind='customer' and s.project_id is not null and private.social_hub_access(p_scope_id,true,true)
   then coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',left(l.name,120),'email',left(l.email,200),'stage',l.stage,'priority',l.priority))
     from(select * from public.website_leads where project_id=s.project_id order by updated_at desc limit 100)l),'[]') else null end);
end $$;

revoke all on function private.social_hub_valid_assignee(uuid,uuid),private.ensure_social_hub_handoff_followup(),
 private.link_social_hub_crm_lead(uuid,uuid),private.create_social_hub_followup(uuid,text,text),private.mutate_social_hub_followup(uuid,text,uuid,boolean)
 from public,anon,authenticated;
grant execute on function private.link_social_hub_crm_lead(uuid,uuid),private.create_social_hub_followup(uuid,text,text),private.mutate_social_hub_followup(uuid,text,uuid,boolean) to authenticated;

create function public.link_social_hub_crm_lead(p_conversation_id uuid,p_lead_id uuid default null)
returns void language sql security invoker set search_path='' as $$select private.link_social_hub_crm_lead(p_conversation_id,p_lead_id)$$;
create function public.create_social_hub_followup(p_conversation_id uuid,p_title text,p_body text default '')
returns uuid language sql security invoker set search_path='' as $$select private.create_social_hub_followup(p_conversation_id,p_title,p_body)$$;
create function public.mutate_social_hub_followup(p_id uuid,p_status text default null,p_assigned_to uuid default null,p_set_assignment boolean default false)
returns void language sql security invoker set search_path='' as $$select private.mutate_social_hub_followup(p_id,p_status,p_assigned_to,p_set_assignment)$$;
revoke all on function public.link_social_hub_crm_lead(uuid,uuid),public.create_social_hub_followup(uuid,text,text),public.mutate_social_hub_followup(uuid,text,uuid,boolean) from public,anon;
grant execute on function public.link_social_hub_crm_lead(uuid,uuid),public.create_social_hub_followup(uuid,text,text),public.mutate_social_hub_followup(uuid,text,uuid,boolean) to authenticated;
