/** Customer schema foundation. Not installed in Tayar's platform database.
 * Installation remains opt-in until notification rules and custody are mounted. */
export function compileOwnedEmailQueueSchema(projectId: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(projectId)) {
    throw new Error('Invalid email queue project.');
  }
  return `
begin;
create schema if not exists private;
create table private.app_email_jobs (
 id uuid primary key,
 project_id uuid not null check (project_id = '${projectId}'::uuid),
 connection_id text not null check (connection_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$'),
 user_id uuid not null references auth.users(id) on delete cascade,
 environment text not null check (environment in ('preview','staging','production')),
 sender text not null check (length(sender) between 3 and 254),
 recipient text not null check (length(recipient) between 3 and 254),
 subject text not null check (length(btrim(subject)) between 1 and 200 and subject !~ '[[:cntrl:]]'),
 body text not null check (length(btrim(body)) between 1 and 32000),
 status text not null default 'pending' check (status in ('pending','sending','accepted','failed','review')),
 attempt integer not null default 0 check (attempt between 0 and 8),
 credential_fingerprint text check (credential_fingerprint ~ '^[0-9a-f]{64}$'),
 first_attempt_at timestamptz,
 next_attempt_at timestamptz not null default clock_timestamp(),
 lease_id uuid,
 lease_expires_at timestamptz,
 provider_id uuid,
 outcome_code text,
 created_at timestamptz not null default clock_timestamp()
);
alter table private.app_email_jobs enable row level security;
revoke all on private.app_email_jobs from public,anon,authenticated,service_role;
create index app_email_jobs_due on private.app_email_jobs(project_id,environment,connection_id,next_attempt_at,id) where status in ('pending','sending');

create function private.app_email_enqueue(p_id uuid,p_connection_id text,p_user_id uuid,p_environment text,p_from text,p_subject text,p_text text)
returns boolean language plpgsql security definer set search_path = '' as $queue$
declare recipient_email text; existing private.app_email_jobs;
begin
 if p_id is null or p_connection_id is null or p_connection_id !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$' or p_user_id is null or p_environment is null or p_from is null or p_subject is null or p_text is null
  or p_environment not in ('preview','staging','production') or p_from ~ '[[:cntrl:]]'
  or p_from !~ '^[^ @<>]+@[^ @<>]+[.][^ @<>]+$' then raise exception 'Invalid email queue input'; end if;
 select email into recipient_email from auth.users where id=p_user_id and email_confirmed_at is not null
  and not coalesce(is_anonymous,false) and (banned_until is null or banned_until <= clock_timestamp());
 if recipient_email is null then raise exception 'Verified recipient required'; end if;
 insert into private.app_email_jobs(id,project_id,connection_id,user_id,environment,sender,recipient,subject,body)
 values(p_id,'${projectId}',p_connection_id,p_user_id,p_environment,p_from,recipient_email,p_subject,p_text) on conflict(id) do nothing;
 select * into existing from private.app_email_jobs where id=p_id;
 if existing.project_id <> '${projectId}'::uuid or existing.connection_id <> p_connection_id or existing.user_id <> p_user_id or existing.environment <> p_environment
  or existing.sender <> p_from or existing.recipient <> recipient_email or existing.subject <> p_subject or existing.body <> p_text
 then raise exception 'Email identity conflict'; end if;
 return true;
end $queue$;

create function private.app_email_claim(p_id uuid,p_project_id uuid,p_environment text,p_connection_id text,p_fingerprint text,p_from text,p_lease_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $queue$
declare job private.app_email_jobs; observed timestamptz := clock_timestamp();
begin
 if p_id is null or p_project_id is distinct from '${projectId}'::uuid or p_environment is null
  or p_connection_id is null or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' or p_from is null or p_lease_id is null then return null; end if;
 select * into job from private.app_email_jobs where id=p_id and project_id=p_project_id and environment=p_environment and connection_id=p_connection_id
  for update skip locked;
 if not found or job.status not in ('pending','sending') or job.next_attempt_at > observed
  or (job.lease_expires_at is not null and job.lease_expires_at > observed) then return null; end if;
 if job.sender <> p_from or (job.credential_fingerprint is not null and job.credential_fingerprint <> p_fingerprint) then
  update private.app_email_jobs set status='review',outcome_code='binding_changed',lease_id=null,lease_expires_at=null where id=p_id;
  return null;
 end if;
 if job.attempt >= 8 or (job.first_attempt_at is not null and job.first_attempt_at + interval '20 hours' <= observed) then
  update private.app_email_jobs set status='review',outcome_code='retry_limit',lease_id=null,lease_expires_at=null where id=p_id;
  return null;
 end if;
 if not exists(select 1 from auth.users where id=job.user_id and email=job.recipient and email_confirmed_at is not null
  and not coalesce(is_anonymous,false) and (banned_until is null or banned_until <= observed)) then
  update private.app_email_jobs set status='failed',outcome_code='recipient_changed',lease_id=null,lease_expires_at=null where id=p_id;
  return null;
 end if;
 update private.app_email_jobs set status='sending',attempt=attempt+1,credential_fingerprint=p_fingerprint,
  first_attempt_at=coalesce(first_attempt_at,observed),lease_id=p_lease_id,lease_expires_at=observed+interval '90 seconds'
  where id=p_id returning * into job;
 return jsonb_build_object('job',jsonb_build_object('id',job.id,'projectId',job.project_id,'connectionId',job.connection_id,'environment',job.environment,
  'from',job.sender,'to',job.recipient,'subject',job.subject,'text',job.body),
  'leaseId',job.lease_id,'attempt',job.attempt,'firstAttemptAt',job.first_attempt_at,'leaseExpiresAt',job.lease_expires_at);
end $queue$;

create function private.app_email_finish(p_id uuid,p_lease_id uuid,p_outcome jsonb)
returns boolean language plpgsql security definer set search_path = '' as $queue$
declare job private.app_email_jobs; result_status text; result_code text; retry_at timestamptz; receipt uuid;
begin
 select * into job from private.app_email_jobs where id=p_id and lease_id=p_lease_id and status='sending' for update;
 if not found or job.lease_expires_at <= clock_timestamp() then return false; end if;
 result_status := p_outcome->>'status'; result_code := p_outcome->>'code';
 if result_status is null or result_status not in ('accepted','retry','failed','review') then raise exception 'Invalid receipt'; end if;
 if result_status='accepted' then
  receipt := (p_outcome->>'providerId')::uuid;
  if receipt is null then raise exception 'Provider receipt required'; end if;
 else
  if result_code is null or result_code !~ '^[a-z0-9_]{1,64}$' then raise exception 'Invalid receipt code'; end if;
 end if;
 if result_status='retry' then
  retry_at := (p_outcome->>'retryAt')::timestamptz;
  if retry_at is null or retry_at <= clock_timestamp() or retry_at > clock_timestamp()+interval '31 minutes'
   then raise exception 'Invalid retry'; end if;
  if job.attempt >= 8 or retry_at >= job.first_attempt_at+interval '20 hours' then
   result_status := 'review'; result_code := 'retry_limit';
  else result_status := 'pending'; end if;
 end if;
 update private.app_email_jobs set status=result_status,outcome_code=result_code,provider_id=receipt,
  next_attempt_at=coalesce(retry_at,next_attempt_at),lease_id=null,lease_expires_at=null where id=p_id;
 return true;
end $queue$;

create function private.app_email_due(p_project_id uuid,p_environment text,p_connection_id text,p_limit integer)
returns jsonb language sql security definer set search_path = '' as $queue$
 select coalesce(jsonb_agg(due.id),'[]'::jsonb) from (
  select id from private.app_email_jobs
  where p_project_id='${projectId}'::uuid and project_id=p_project_id and environment=p_environment
   and connection_id=p_connection_id and status in ('pending','sending') and next_attempt_at <= clock_timestamp()
   and (lease_expires_at is null or lease_expires_at <= clock_timestamp())
   and p_limit between 1 and 20
  order by next_attempt_at,id limit least(greatest(coalesce(p_limit,0),0),20)
 ) due;
$queue$;

create function public.app_email_enqueue(p_id uuid,p_connection_id text,p_user_id uuid,p_environment text,p_from text,p_subject text,p_text text)
returns boolean language sql security invoker set search_path = '' as $queue$
 select private.app_email_enqueue(p_id,p_connection_id,p_user_id,p_environment,p_from,p_subject,p_text); $queue$;
create function public.app_email_claim(p_id uuid,p_project_id uuid,p_environment text,p_connection_id text,p_fingerprint text,p_from text,p_lease_id uuid)
returns jsonb language sql security invoker set search_path = '' as $queue$
 select private.app_email_claim(p_id,p_project_id,p_environment,p_connection_id,p_fingerprint,p_from,p_lease_id); $queue$;
create function public.app_email_finish(p_id uuid,p_lease_id uuid,p_outcome jsonb)
returns boolean language sql security invoker set search_path = '' as $queue$
 select private.app_email_finish(p_id,p_lease_id,p_outcome); $queue$;
create function public.app_email_due(p_project_id uuid,p_environment text,p_connection_id text,p_limit integer)
returns jsonb language sql security invoker set search_path = '' as $queue$
 select private.app_email_due(p_project_id,p_environment,p_connection_id,p_limit); $queue$;
grant usage on schema private to service_role;
${['private','public'].flatMap(schema => [
  ['app_email_enqueue', 'uuid,text,uuid,text,text,text,text'],
  ['app_email_claim', 'uuid,uuid,text,text,text,text,uuid'],
  ['app_email_finish', 'uuid,uuid,jsonb'],
  ['app_email_due', 'uuid,text,text,integer'],
].map(([name, args]) => `revoke all on function ${schema}.${name}(${args}) from public,anon,authenticated;
grant execute on function ${schema}.${name}(${args}) to service_role;`)).join('\n')}
commit;
`;
}
