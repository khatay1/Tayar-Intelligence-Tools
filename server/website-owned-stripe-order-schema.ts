const project = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Private customer-owned payment ledger. The browser has no grants; only the
 * customer's server secret can reserve checkout identity or apply signed events. */
export function compileOwnedStripeOrderSchema(projectId: string): string {
  if (!project.test(projectId)) throw new Error('Invalid Stripe order project.');
  const functions: Array<[string, string]> = [
    ['app_stripe_order_reserve', 'uuid,uuid,text,text,bigint,uuid'],
    ['app_stripe_order_bind_session', 'uuid,uuid,text'],
    ['app_stripe_order_apply_event', 'text,text,timestamptz,uuid,uuid,boolean,text,text,bigint,text,text'],
  ];
  return `
begin;
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create table private.app_stripe_order_payments (
 order_id uuid primary key,
 project_id uuid not null check(project_id='${projectId}'::uuid),
 user_id uuid not null references auth.users(id) on delete restrict,
 environment text not null check(environment in ('preview','production')),
 livemode boolean not null check(livemode=(environment='production')),
 currency text not null check(currency ~ '^[a-z]{3}$'),
 amount_due bigint not null check(amount_due between 1 and 99999999999),
 operation_id uuid not null unique,
 session_id text unique check(session_id is null or session_id ~ '^cs_(test|live)_[A-Za-z0-9]{8,200}$'),
 payment_intent_id text unique check(payment_intent_id is null or payment_intent_id ~ '^pi_[A-Za-z0-9]{8,200}$'),
 status text not null default 'pending' check(status in ('pending','paid','payment-failed','refund-pending','partially-refunded','refunded','refund-failed')),
 amount_paid bigint not null default 0 check(amount_paid between 0 and 99999999999),
 amount_refunded bigint not null default 0 check(amount_refunded between 0 and amount_paid),
 last_payment_event_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
create table private.app_stripe_order_events (
 event_id text primary key check(event_id ~ '^evt_[A-Za-z0-9]{8,200}$'),
 event_type text not null check(event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','refund.created','refund.updated','charge.refunded')),
 event_created_at timestamptz not null,
 project_id uuid not null check(project_id='${projectId}'::uuid),
 order_id uuid not null references private.app_stripe_order_payments(order_id) on delete restrict,
 livemode boolean not null,
 provider_object_id text not null check(provider_object_id ~ '^(cs_(test|live)|ch|re)_[A-Za-z0-9]{8,200}$'),
 provider_payment_id text check(provider_payment_id is null or provider_payment_id ~ '^pi_[A-Za-z0-9]{8,200}$'),
 amount bigint not null check(amount between 0 and 99999999999),
 currency text not null check(currency ~ '^[a-z]{3}$'),
 status text not null check(status in ('paid','payment-failed','refund-pending','partially-refunded','refunded','refund-failed')),
 received_at timestamptz not null default clock_timestamp()
);
create table private.app_stripe_order_refunds (
 provider_refund_id text primary key check(provider_refund_id ~ '^re_[A-Za-z0-9]{8,200}$'),
 order_id uuid not null references private.app_stripe_order_payments(order_id) on delete restrict,
 payment_intent_id text not null check(payment_intent_id ~ '^pi_[A-Za-z0-9]{8,200}$'),
 amount bigint not null check(amount between 1 and 99999999999),
 status text not null check(status in ('pending','succeeded','failed')),
 last_event_at timestamptz not null
);
alter table private.app_stripe_order_payments enable row level security;
alter table private.app_stripe_order_events enable row level security;
alter table private.app_stripe_order_refunds enable row level security;
revoke all on private.app_stripe_order_payments,private.app_stripe_order_events,private.app_stripe_order_refunds from public,anon,authenticated,service_role;
create index app_stripe_events_order on private.app_stripe_order_events(order_id,event_created_at,event_id);
create index app_stripe_refunds_order on private.app_stripe_order_refunds(order_id,status);

create function private.app_stripe_order_reserve(p_order_id uuid,p_user_id uuid,p_environment text,p_currency text,p_amount_due bigint,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $payment$
declare found private.app_stripe_order_payments;
begin
 if p_order_id is null or p_user_id is null or p_operation_id is null or p_environment not in ('preview','production')
  or p_currency !~ '^[a-z]{3}$' or p_amount_due not between 1 and 99999999999 then raise exception 'Invalid payment reservation'; end if;
 if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null and not coalesce(is_anonymous,false)
  and (banned_until is null or banned_until<=clock_timestamp())) then raise exception 'Verified payment owner required'; end if;
 insert into private.app_stripe_order_payments(order_id,project_id,user_id,environment,livemode,currency,amount_due,operation_id)
 values(p_order_id,'${projectId}',p_user_id,p_environment,p_environment='production',p_currency,p_amount_due,p_operation_id)
 on conflict(order_id) do nothing;
 select * into found from private.app_stripe_order_payments where order_id=p_order_id for update;
 if found.project_id<>'${projectId}'::uuid or found.user_id<>p_user_id or found.environment<>p_environment or found.currency<>p_currency
  or found.amount_due<>p_amount_due or found.operation_id<>p_operation_id then raise exception 'Payment reservation conflict'; end if;
 return jsonb_build_object('orderId',found.order_id,'status',found.status,'sessionId',found.session_id);
end $payment$;

create function private.app_stripe_order_bind_session(p_order_id uuid,p_operation_id uuid,p_session_id text)
returns boolean language plpgsql security definer set search_path='' as $payment$
declare found private.app_stripe_order_payments;
begin
 if p_order_id is null or p_operation_id is null or p_session_id !~ '^cs_(test|live)_[A-Za-z0-9]{8,200}$' then raise exception 'Invalid checkout session'; end if;
 select * into found from private.app_stripe_order_payments where order_id=p_order_id and operation_id=p_operation_id for update;
 if not found or found.status<>'pending' or (found.livemode and p_session_id !~ '^cs_live_') or (not found.livemode and p_session_id !~ '^cs_test_')
  or (found.session_id is not null and found.session_id<>p_session_id) then raise exception 'Checkout session conflict'; end if;
 update private.app_stripe_order_payments set session_id=p_session_id,updated_at=clock_timestamp() where order_id=p_order_id;
 return true;
end $payment$;

create function private.app_stripe_order_apply_event(p_event_id text,p_event_type text,p_event_created_at timestamptz,p_project_id uuid,p_order_id uuid,
 p_livemode boolean,p_provider_object_id text,p_provider_payment_id text,p_amount bigint,p_currency text,p_status text)
returns text language plpgsql security definer set search_path='' as $payment$
declare existing private.app_stripe_order_events; payment private.app_stripe_order_payments; refund_status text; successful bigint; pending_count integer;
begin
 select * into existing from private.app_stripe_order_events where event_id=p_event_id;
 if found then
  if existing.event_type=p_event_type and existing.event_created_at=p_event_created_at and existing.project_id=p_project_id and existing.order_id=p_order_id
   and existing.livemode=p_livemode and existing.provider_object_id=p_provider_object_id
   and existing.provider_payment_id is not distinct from p_provider_payment_id and existing.amount=p_amount and existing.currency=p_currency and existing.status=p_status
  then return 'duplicate'; else return 'conflict'; end if;
 end if;
 if p_project_id is distinct from '${projectId}'::uuid or p_event_id !~ '^evt_[A-Za-z0-9]{8,200}$' or p_event_created_at is null
  or p_currency !~ '^[a-z]{3}$' or p_amount not between 0 and 99999999999 then return 'conflict'; end if;
 select * into payment from private.app_stripe_order_payments where order_id=p_order_id for update;
 if not found or payment.project_id<>p_project_id or payment.livemode<>p_livemode or payment.currency<>p_currency then return 'conflict'; end if;
 if p_event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed') then
  if payment.session_id is distinct from p_provider_object_id or p_provider_object_id !~ '^cs_(test|live)_' or p_amount<>payment.amount_due then return 'conflict'; end if;
  if p_event_type='checkout.session.async_payment_failed' then
   if p_status<>'payment-failed' then return 'conflict'; end if;
   if payment.status='pending' and (payment.last_payment_event_at is null or p_event_created_at>=payment.last_payment_event_at) then
    update private.app_stripe_order_payments set status='payment-failed',last_payment_event_at=p_event_created_at,updated_at=clock_timestamp() where order_id=p_order_id;
   end if;
  else
   if p_status<>'paid' or p_provider_payment_id !~ '^pi_[A-Za-z0-9]{8,200}$'
    or (payment.payment_intent_id is not null and payment.payment_intent_id<>p_provider_payment_id) then return 'conflict'; end if;
   update private.app_stripe_order_payments set payment_intent_id=p_provider_payment_id,status=case when amount_refunded=0 then 'paid' else status end,
    amount_paid=p_amount,last_payment_event_at=greatest(coalesce(last_payment_event_at,p_event_created_at),p_event_created_at),updated_at=clock_timestamp()
   where order_id=p_order_id;
  end if;
 else
  if payment.payment_intent_id is null or payment.payment_intent_id is distinct from p_provider_payment_id or payment.amount_paid<1 then return 'conflict'; end if;
  if p_provider_object_id ~ '^re_' then
   refund_status:=case p_status when 'refund-pending' then 'pending' when 'refunded' then 'succeeded' when 'refund-failed' then 'failed' else null end;
   if refund_status is null or p_amount<1 or p_amount>payment.amount_paid then return 'conflict'; end if;
   insert into private.app_stripe_order_refunds(provider_refund_id,order_id,payment_intent_id,amount,status,last_event_at)
   values(p_provider_object_id,p_order_id,p_provider_payment_id,p_amount,refund_status,p_event_created_at)
   on conflict(provider_refund_id) do update set amount=excluded.amount,status=excluded.status,last_event_at=excluded.last_event_at
    where private.app_stripe_order_refunds.order_id=excluded.order_id
     and private.app_stripe_order_refunds.payment_intent_id=excluded.payment_intent_id
     and excluded.last_event_at>=private.app_stripe_order_refunds.last_event_at;
   if not found then
    if not exists(select 1 from private.app_stripe_order_refunds where provider_refund_id=p_provider_object_id and order_id=p_order_id
     and payment_intent_id=p_provider_payment_id and amount=p_amount and last_event_at>=p_event_created_at) then return 'conflict'; end if;
   end if;
  elsif p_provider_object_id !~ '^ch_' or p_status not in ('partially-refunded','refunded') or p_amount>payment.amount_paid then return 'conflict'; end if;
  select coalesce(sum(amount),0),count(*) filter(where status='pending') into successful,pending_count
   from private.app_stripe_order_refunds where order_id=p_order_id and status in ('succeeded','pending');
  if p_provider_object_id ~ '^ch_' then successful:=greatest(successful,p_amount); end if;
  if successful>payment.amount_paid then return 'conflict'; end if;
  update private.app_stripe_order_payments set amount_refunded=greatest(amount_refunded,successful),
   status=case when greatest(amount_refunded,successful)>=amount_paid then 'refunded'
    when pending_count>0 then 'refund-pending' when greatest(amount_refunded,successful)>0 then 'partially-refunded'
    when p_status='refund-failed' then 'refund-failed' else status end,updated_at=clock_timestamp() where order_id=p_order_id;
 end if;
 insert into private.app_stripe_order_events(event_id,event_type,event_created_at,project_id,order_id,livemode,provider_object_id,provider_payment_id,amount,currency,status)
 values(p_event_id,p_event_type,p_event_created_at,p_project_id,p_order_id,p_livemode,p_provider_object_id,p_provider_payment_id,p_amount,p_currency,p_status);
 return 'applied';
exception when unique_violation then return 'conflict';
end $payment$;

create function public.app_stripe_order_reserve(p_order_id uuid,p_user_id uuid,p_environment text,p_currency text,p_amount_due bigint,p_operation_id uuid)
returns jsonb language sql security invoker set search_path='' as $wrapper$
 select private.app_stripe_order_reserve(p_order_id,p_user_id,p_environment,p_currency,p_amount_due,p_operation_id); $wrapper$;
create function public.app_stripe_order_bind_session(p_order_id uuid,p_operation_id uuid,p_session_id text)
returns boolean language sql security invoker set search_path='' as $wrapper$
 select private.app_stripe_order_bind_session(p_order_id,p_operation_id,p_session_id); $wrapper$;
create function public.app_stripe_order_apply_event(p_event_id text,p_event_type text,p_event_created_at timestamptz,p_project_id uuid,p_order_id uuid,
 p_livemode boolean,p_provider_object_id text,p_provider_payment_id text,p_amount bigint,p_currency text,p_status text)
returns text language sql security invoker set search_path='' as $wrapper$
 select private.app_stripe_order_apply_event(p_event_id,p_event_type,p_event_created_at,p_project_id,p_order_id,p_livemode,
  p_provider_object_id,p_provider_payment_id,p_amount,p_currency,p_status); $wrapper$;
grant usage on schema private to service_role;
${functions.map(([name,args]) => `revoke all on function private.${name}(${args}),public.${name}(${args}) from public,anon,authenticated;\ngrant execute on function private.${name}(${args}),public.${name}(${args}) to service_role;`).join('\n')}
commit;
`;
}
