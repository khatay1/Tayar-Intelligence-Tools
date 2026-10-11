import type { ApplicationDefinition } from '../src/modules/website-builder/core/application-model';
import { readApplicationDefinition } from '../src/modules/website-builder/core/application-validation';

const literal=(value:string)=>`'${value.replace(/'/g,"''")}'`;
const verified=(actor:string)=>`exists(select 1 from auth.users u where u.id=${actor} and u.email_confirmed_at is not null
 and not coalesce(u.is_anonymous,false) and(u.banned_until is null or u.banned_until<=clock_timestamp()))`;

/** Compiled together with the private quote and Stripe ledger. Only the owned
 * server can call these functions; user identities come from verified Auth. */
export function compileOwnedPaymentAccessSchema(input:ApplicationDefinition):string[]{
 const app=readApplicationDefinition(input);
 return app.tables.flatMap((table,index)=>{
  if(!table.payment)return[];
  const rule=table.payment,item=app.tables.find(candidate=>candidate.id===table.transaction!.itemTableId)!;
  const price=item.fields.find(field=>field.id===rule.itemUnitAmountFieldId)!;
  const roleExists=(actor:string)=>`exists(select 1 from private.app_user_roles r where r.user_id=${actor} and r.role_id=${literal(rule.refundRoleId)})`;
  const quote=`app_order_quote_${index}`,refund=`app_order_refund_authorize_${index}`,guard=`app_order_price_guard_${index}`,status=`app_order_payment_status_${index}`;
  return[
   `create function private.${guard}() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new."${price.key}" is not distinct from old."${price.key}" then return new;end if;
 if (select auth.role())='authenticated' and (not ${verified('(select auth.uid())')} or not ${roleExists('(select auth.uid())')})
  then raise exception 'Price administration role required';end if;
 if new."${price.key}" is null or new."${price.key}" in('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)
  or new."${price.key}"<1 or new."${price.key}">99999999999 or new."${price.key}"<>trunc(new."${price.key}")
  then raise exception 'Invalid item price';end if;
 return new;
end $$;`,
   `revoke all on function private.${guard}() from public,anon,authenticated,service_role;`,
   `create trigger ${guard} before insert or update on public."app_${item.key}" for each row execute function private.${guard}();`,
   `create function private.${quote}(p_order_id uuid,p_user_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare q private.app_order_quotes;
begin
 if not ${verified('p_user_id')} then return null;end if;
 select quote.* into q from private.app_order_quotes quote join public."app_${table.key}" parent on parent.id=quote.order_id
 where quote.order_id=p_order_id and quote.owner_id=p_user_id and parent.owner_id=p_user_id and quote.table_id=${literal(table.id)};
 if not found then return null;end if;
 return jsonb_build_object('amount',q.amount,'currency',q.currency);
end $$;`,
   `create function public.${quote}(p_order_id uuid,p_user_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select private.${quote}(p_order_id,p_user_id);$$;`,
   `create function private.${refund}(p_order_id uuid,p_user_id uuid,p_amount bigint) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare payment private.app_stripe_order_payments;remaining bigint;
begin
 if not ${verified('p_user_id')} or not ${roleExists('p_user_id')} then return null;end if;
 if not exists(select 1 from private.app_order_quotes where order_id=p_order_id and table_id=${literal(table.id)}) then return null;end if;
 select * into payment from private.app_stripe_order_payments where order_id=p_order_id;
 if not found or payment.status not in('paid','partially-refunded','refund-pending','refunded') or payment.payment_intent_id is null then return null;end if;
 remaining:=payment.amount_paid-payment.amount_refunded;
 -- Reservation enforces remaining capacity under a row lock. Allow an explicit
 -- previously accepted amount through so a lost response can be retried after
 -- the webhook has completed the refund.
 if(p_amount is null and remaining<1)or(p_amount is not null and(p_amount<1 or p_amount>payment.amount_paid))then return null;end if;
 return jsonb_build_object('paymentIntentId',payment.payment_intent_id,'amount',coalesce(p_amount,remaining));
end $$;`,
   `create function public.${refund}(p_order_id uuid,p_user_id uuid,p_amount bigint) returns jsonb language sql stable security invoker set search_path='' as $$
 select private.${refund}(p_order_id,p_user_id,p_amount);$$;`,
   `create function private.${status}(p_order_id uuid,p_user_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare quote private.app_order_quotes; payment private.app_stripe_order_payments;
begin
 if not ${verified('p_user_id')} then return null;end if;
 select q.* into quote from private.app_order_quotes q join public."app_${table.key}" r on r.id=q.order_id
  where q.order_id=p_order_id and q.table_id=${literal(table.id)} and(q.owner_id=p_user_id or ${roleExists('p_user_id')});
 if not found then return null;end if;
 select * into payment from private.app_stripe_order_payments where order_id=p_order_id;
 return jsonb_build_object('status',case when found then payment.status else 'unpaid' end,'currency',quote.currency,
  'amountDue',quote.amount,'amountPaid',coalesce(payment.amount_paid,0),'amountRefunded',coalesce(payment.amount_refunded,0));
end $$;`,
   `create function public.${status}(p_order_id uuid,p_user_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select private.${status}(p_order_id,p_user_id);$$;`,
   'grant usage on schema private to service_role;',
   ...[[quote,'uuid,uuid'],[refund,'uuid,uuid,bigint'],[status,'uuid,uuid']].map(([name,args])=>
    `revoke all on function private.${name}(${args}),public.${name}(${args}) from public,anon,authenticated;
grant execute on function private.${name}(${args}),public.${name}(${args}) to service_role;`),
  ];
 });
}
