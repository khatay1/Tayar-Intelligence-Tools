-- Assistant knowledge and consent use existing identities/scopes. All activation defaults off.
create table private.social_hub_assistant_settings (
 scope_id uuid primary key references private.social_hub_scopes(id) on delete cascade,
 enabled boolean not null default false, external_approved boolean not null default false,
 language text not null default 'en' check(language ~ '^[a-z]{2,3}(-[a-z0-9]{2,8}){0,3}$'),
 daily_limit integer not null default 0 check(daily_limit between 0 and 1000),
 usage_day date not null default current_date, daily_used integer not null default 0 check(daily_used >= 0),
 updated_at timestamptz not null default now()
);
create table private.social_hub_knowledge (
 id uuid primary key default gen_random_uuid(), scope_id uuid not null references private.social_hub_scopes(id) on delete cascade,
 question text not null check(length(btrim(question)) between 1 and 400),
 answer text not null check(length(btrim(answer)) between 1 and 4000),
 language text not null check(language ~ '^[a-z]{2,3}(-[a-z0-9]{2,8}){0,3}$'),
 approved boolean not null default false, sensitive boolean not null default false,
 updated_at timestamptz not null default now()
);
create index social_hub_knowledge_scope on private.social_hub_knowledge(scope_id,language);
create table private.social_hub_assistant_reviews (
 message_id uuid primary key references private.social_hub_messages(id) on delete cascade,
 scope_id uuid not null references private.social_hub_scopes(id) on delete cascade,
 source_hash text not null, redacted_text text not null check(length(btrim(redacted_text)) between 1 and 1000),
 language text not null check(language ~ '^[a-z]{2,3}(-[a-z0-9]{2,8}){0,3}$'),
 reviewed_by uuid not null references auth.users(id), expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index social_hub_assistant_reviews_scope on private.social_hub_assistant_reviews(scope_id);
create index social_hub_assistant_reviews_reviewer on private.social_hub_assistant_reviews(reviewed_by);
create table private.social_hub_assistant_reservations (
 message_id uuid primary key references private.social_hub_messages(id) on delete cascade,
 scope_id uuid not null references private.social_hub_scopes(id) on delete cascade,
 requested_by uuid not null references auth.users(id), reserved_at timestamptz not null default now()
);
create index social_hub_assistant_reservations_scope on private.social_hub_assistant_reservations(scope_id);
create index social_hub_assistant_reservations_requester on private.social_hub_assistant_reservations(requested_by);
do $$ declare t text; begin
 foreach t in array array['assistant_settings','knowledge','assistant_reviews','assistant_reservations'] loop
 execute format('alter table private.social_hub_%I enable row level security',t);
 execute format('revoke all on private.social_hub_%I from public,anon,authenticated',t);
 execute format('grant all on private.social_hub_%I to service_role',t);
 end loop;
end $$;

create function private.configure_social_hub_assistant(p_scope_id uuid,p_enabled boolean,p_external_approved boolean,p_language text,p_daily_limit integer)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.social_hub_access(p_scope_id,true,true) or exists(select 1 from public.profiles where id=auth.uid() and suspended) then raise exception 'Manager required' using errcode='42501';end if;
 insert into private.social_hub_assistant_settings(scope_id,enabled,external_approved,language,daily_limit)
 values(p_scope_id,p_enabled,p_external_approved,p_language,p_daily_limit)
 on conflict(scope_id)do update set enabled=excluded.enabled,external_approved=excluded.external_approved,
 language=excluded.language,daily_limit=excluded.daily_limit,updated_at=now();
 -- Re-enabling external processing requires a fresh per-message review.
 delete from private.social_hub_assistant_reviews where scope_id=p_scope_id;
end $$;
create function private.save_social_hub_knowledge(p_scope_id uuid,p_id uuid,p_question text,p_answer text,p_language text,p_approved boolean default false,p_sensitive boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=coalesce(p_id,gen_random_uuid());begin
 if not private.social_hub_access(p_scope_id,true,true) or exists(select 1 from public.profiles where id=auth.uid() and suspended) then raise exception 'Manager required' using errcode='42501';end if;
 perform 1 from private.social_hub_scopes where id=p_scope_id for update;
 if exists(select 1 from private.social_hub_knowledge where id=v_id and scope_id<>p_scope_id)then raise exception 'Knowledge scope mismatch';end if;
 if not exists(select 1 from private.social_hub_knowledge where id=v_id)and(select count(*)from private.social_hub_knowledge where scope_id=p_scope_id)>=500 then raise exception 'Knowledge limit reached';end if;
 insert into private.social_hub_knowledge(id,scope_id,question,answer,language,approved,sensitive)values(v_id,p_scope_id,p_question,p_answer,p_language,p_approved,p_sensitive)
 on conflict(id)do update set question=excluded.question,answer=excluded.answer,language=excluded.language,approved=excluded.approved,sensitive=excluded.sensitive,updated_at=now()
 where social_hub_knowledge.scope_id=p_scope_id;return v_id;
end $$;
create function private.review_social_hub_assistant_message(p_scope_id uuid,p_message_id uuid,p_redacted_text text,p_language text)
returns void language plpgsql security definer set search_path='' as $$
declare m private.social_hub_messages;begin
 if not private.social_hub_access(p_scope_id,true,true) or exists(select 1 from public.profiles where id=auth.uid() and suspended) then raise exception 'Manager required' using errcode='42501';end if;
 select * into m from private.social_hub_messages where id=p_message_id and scope_id=p_scope_id and direction='inbound';
 if not found or not exists(select 1 from private.social_hub_assistant_settings where scope_id=p_scope_id and enabled and external_approved)then raise exception 'Approved assistant context required';end if;
 insert into private.social_hub_assistant_reviews(message_id,scope_id,source_hash,redacted_text,language,reviewed_by,expires_at)
 values(m.id,p_scope_id,md5(m.text),p_redacted_text,p_language,auth.uid(),now()+interval '24 hours')
 on conflict(message_id)do update set source_hash=excluded.source_hash,redacted_text=excluded.redacted_text,language=excluded.language,reviewed_by=excluded.reviewed_by,expires_at=excluded.expires_at,created_at=now();
end $$;
create function private.get_social_hub_assistant_context(p_scope_id uuid,p_conversation_id uuid,p_message_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.social_hub_assistant_settings;m private.social_hub_messages;c private.social_hub_conversations;r private.social_hub_assistant_reviews;v_review boolean;begin
 if not private.social_hub_access(p_scope_id,true) or exists(select 1 from public.profiles where id=auth.uid() and suspended)then return null;end if;
 if not exists(select 1 from private.social_hub_scopes where id=p_scope_id and enabled)then return null;end if;
 select * into s from private.social_hub_assistant_settings where scope_id=p_scope_id and enabled;if not found then return null;end if;
 select * into c from private.social_hub_conversations where id=p_conversation_id and scope_id=p_scope_id;if not found then return null;end if;
 select * into m from private.social_hub_messages where id=p_message_id and conversation_id=p_conversation_id and scope_id=p_scope_id and direction='inbound';if not found then return null;end if;
 select * into r from private.social_hub_assistant_reviews where message_id=m.id and scope_id=p_scope_id;
 v_review:=coalesce(s.external_approved and r.expires_at>now()and r.source_hash=md5(m.text)and(private.get_social_hub_actor_access(p_scope_id,r.reviewed_by)->>'canManage')::boolean,false);
 return jsonb_build_object('input',jsonb_build_object('enabled',true,'automationEnabled',false,'scopeId',p_scope_id,'messageId',m.id,
 'text',m.text,'language',case when v_review then r.language else s.language end,'humanAssigned',c.assigned_to is not null or c.status in('human_required','archived','resolved'),
 'knowledge',coalesce((select jsonb_agg(jsonb_build_object('id',k.id,'scopeId',k.scope_id,'question',k.question,'answer',k.answer,'language',k.language,'approved',k.approved,'sensitive',k.sensitive))from
 (select * from private.social_hub_knowledge where scope_id=p_scope_id and approved and not sensitive and language=case when v_review then r.language else s.language end order by id limit 50)k),'[]')),
 'externalClassification',jsonb_build_object('approved',v_review,'redactedText',case when v_review then r.redacted_text else null end));
end $$;
create function private.reserve_social_hub_assistant_classification(p_scope_id uuid,p_conversation_id uuid,p_message_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare s private.social_hub_assistant_settings;v_context jsonb;begin
 perform 1 from private.social_hub_scopes where id=p_scope_id and enabled for update;if not found then return false;end if;
 select * into s from private.social_hub_assistant_settings where scope_id=p_scope_id for update;if not found then return false;end if;
 v_context:=private.get_social_hub_assistant_context(p_scope_id,p_conversation_id,p_message_id);
 if v_context is null or not coalesce((v_context->'externalClassification'->>'approved')::boolean,false)
 or coalesce((v_context->'input'->>'humanAssigned')::boolean,true)or s.daily_limit=0
 or(case when s.usage_day=current_date then s.daily_used else 0 end)>=s.daily_limit then return false;end if;
 insert into private.social_hub_assistant_reservations(message_id,scope_id,requested_by)values(p_message_id,p_scope_id,auth.uid())on conflict do nothing;
 if not found then return false;end if;
 update private.social_hub_assistant_settings set usage_day=current_date,daily_used=case when usage_day=current_date then daily_used+1 else 1 end where scope_id=p_scope_id;return true;
end $$;
create function private.get_social_hub_assistant_settings(p_scope_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$begin
 if not private.social_hub_access(p_scope_id,true,true)or exists(select 1 from public.profiles where id=auth.uid()and suspended)then return null;end if;
 return jsonb_build_object('settings',(select to_jsonb(s)from private.social_hub_assistant_settings s where scope_id=p_scope_id),
 'knowledge',coalesce((select jsonb_agg(to_jsonb(k))from(select * from private.social_hub_knowledge where scope_id=p_scope_id order by id limit 500)k),'[]'));
end $$;
revoke all on function private.get_social_hub_assistant_settings(uuid)from public,anon,authenticated;
grant execute on function private.get_social_hub_assistant_settings(uuid)to authenticated;
create function public.get_social_hub_assistant_settings(p_scope_id uuid)returns jsonb language sql security invoker set search_path=''as $$select private.get_social_hub_assistant_settings(p_scope_id)$$;
revoke all on function public.get_social_hub_assistant_settings(uuid)from public,anon,authenticated;
grant execute on function public.get_social_hub_assistant_settings(uuid)to authenticated;

revoke all on function private.configure_social_hub_assistant(uuid,boolean,boolean,text,integer)from public,anon,authenticated;
revoke all on function private.save_social_hub_knowledge(uuid,uuid,text,text,text,boolean,boolean)from public,anon,authenticated;
revoke all on function private.review_social_hub_assistant_message(uuid,uuid,text,text)from public,anon,authenticated;
revoke all on function private.get_social_hub_assistant_context(uuid,uuid,uuid)from public,anon,authenticated;
revoke all on function private.reserve_social_hub_assistant_classification(uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function private.configure_social_hub_assistant(uuid,boolean,boolean,text,integer),private.save_social_hub_knowledge(uuid,uuid,text,text,text,boolean,boolean),private.review_social_hub_assistant_message(uuid,uuid,text,text),private.get_social_hub_assistant_context(uuid,uuid,uuid),private.reserve_social_hub_assistant_classification(uuid,uuid,uuid)to authenticated;
create function public.configure_social_hub_assistant(p_scope_id uuid,p_enabled boolean,p_external_approved boolean,p_language text,p_daily_limit integer)returns void language sql security invoker set search_path=''as $$select private.configure_social_hub_assistant(p_scope_id,p_enabled,p_external_approved,p_language,p_daily_limit)$$;
create function public.save_social_hub_knowledge(p_scope_id uuid,p_id uuid,p_question text,p_answer text,p_language text,p_approved boolean default false,p_sensitive boolean default false)returns uuid language sql security invoker set search_path=''as $$select private.save_social_hub_knowledge(p_scope_id,p_id,p_question,p_answer,p_language,p_approved,p_sensitive)$$;
create function public.review_social_hub_assistant_message(p_scope_id uuid,p_message_id uuid,p_redacted_text text,p_language text)returns void language sql security invoker set search_path=''as $$select private.review_social_hub_assistant_message(p_scope_id,p_message_id,p_redacted_text,p_language)$$;
create function public.get_social_hub_assistant_context(p_scope_id uuid,p_conversation_id uuid,p_message_id uuid)returns jsonb language sql security invoker set search_path=''as $$select private.get_social_hub_assistant_context(p_scope_id,p_conversation_id,p_message_id)$$;
create function public.reserve_social_hub_assistant_classification(p_scope_id uuid,p_conversation_id uuid,p_message_id uuid)returns boolean language sql security invoker set search_path=''as $$select private.reserve_social_hub_assistant_classification(p_scope_id,p_conversation_id,p_message_id)$$;
revoke all on function public.configure_social_hub_assistant(uuid,boolean,boolean,text,integer),public.save_social_hub_knowledge(uuid,uuid,text,text,text,boolean,boolean),public.review_social_hub_assistant_message(uuid,uuid,text,text),public.get_social_hub_assistant_context(uuid,uuid,uuid),public.reserve_social_hub_assistant_classification(uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function public.configure_social_hub_assistant(uuid,boolean,boolean,text,integer),public.save_social_hub_knowledge(uuid,uuid,text,text,text,boolean,boolean),public.review_social_hub_assistant_message(uuid,uuid,text,text),public.get_social_hub_assistant_context(uuid,uuid,uuid),public.reserve_social_hub_assistant_classification(uuid,uuid,uuid)to authenticated;
