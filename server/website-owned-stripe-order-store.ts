import type { OwnedStripeOrderEvent, OwnedStripeOrderEventStore } from './website-owned-stripe-webhook';

export interface OwnedStripeOrderRpcClient {
  rpc(name: 'app_stripe_order_reserve' | 'app_stripe_order_bind_session' | 'app_stripe_order_reserve_refund'
    | 'app_stripe_order_bind_refund' | 'app_stripe_order_apply_event', args: Record<string, unknown>):
    PromiseLike<{ data: unknown; error: unknown }>;
}

export function createOwnedStripeOrderEventStore(client: OwnedStripeOrderRpcClient): OwnedStripeOrderEventStore {
  return { async apply(event: OwnedStripeOrderEvent) {
    const { data, error } = await client.rpc('app_stripe_order_apply_event', {
      p_event_id: event.eventId, p_event_type: event.eventType, p_event_created_at: event.eventCreatedAt,
      p_project_id: event.projectId, p_order_id: event.orderId, p_livemode: event.livemode,
      p_provider_object_id: event.providerObjectId, p_provider_payment_id: event.providerPaymentId ?? null,
      p_amount: event.amount, p_currency: event.currency, p_status: event.status,
    });
    if (error || !['applied', 'duplicate', 'conflict'].includes(String(data))) throw new Error('Stripe order event store unavailable.');
    return data as 'applied' | 'duplicate' | 'conflict';
  } };
}

export async function reserveOwnedStripeOrder(client: OwnedStripeOrderRpcClient, input: { orderId: string; userId: string;
  environment: 'preview' | 'production'; currency: string; amountDue: number; operationId: string }) {
  const { data, error } = await client.rpc('app_stripe_order_reserve', { p_order_id: input.orderId, p_user_id: input.userId,
    p_environment: input.environment, p_currency: input.currency, p_amount_due: input.amountDue, p_operation_id: input.operationId });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Stripe order reservation unavailable.');
  const value = data as Record<string, unknown>;
  if (value.orderId !== input.orderId || !['pending', 'paid', 'payment-failed', 'refund-pending', 'partially-refunded', 'refunded', 'refund-failed'].includes(String(value.status))
    || value.sessionId !== null && (typeof value.sessionId !== 'string' || !/^cs_(?:test|live)_[A-Za-z0-9]{8,200}$/.test(value.sessionId))) {
    throw new Error('Stripe order reservation unavailable.');
  }
  return { orderId: value.orderId as string, status: value.status as string, sessionId: value.sessionId as string | null };
}

export async function bindOwnedStripeOrderSession(client: OwnedStripeOrderRpcClient, input: { orderId: string; operationId: string; sessionId: string }) {
  const { data, error } = await client.rpc('app_stripe_order_bind_session', { p_order_id: input.orderId,
    p_operation_id: input.operationId, p_session_id: input.sessionId });
  if (error || data !== true) throw new Error('Stripe checkout session binding unavailable.');
}

export async function reserveOwnedStripeOrderRefund(client:OwnedStripeOrderRpcClient,input:{orderId:string;userId:string;
 paymentIntentId:string;amount:number;operationId:string}){
 const{data,error}=await client.rpc('app_stripe_order_reserve_refund',{p_order_id:input.orderId,p_requested_by:input.userId,
  p_payment_intent_id:input.paymentIntentId,p_amount:input.amount,p_operation_id:input.operationId});
 if(error||!data||typeof data!=='object'||Array.isArray(data))throw new Error('Stripe refund reservation unavailable.');
 const value=data as Record<string,unknown>;
 if(Object.keys(value).sort().join(',')!=='amount,operationId,providerRefundId,providerStatus'
  ||value.operationId!==input.operationId||value.amount!==input.amount
  ||value.providerRefundId!==null&&(typeof value.providerRefundId!=='string'||!/^re_[A-Za-z0-9]{8,200}$/.test(value.providerRefundId))
  ||value.providerStatus!==null&&!['pending','succeeded'].includes(String(value.providerStatus))
  ||(value.providerRefundId===null)!==(value.providerStatus===null))throw new Error('Stripe refund reservation unavailable.');
 return{operationId:input.operationId,amount:input.amount,providerRefundId:value.providerRefundId as string|null,
  providerStatus:value.providerStatus as 'pending'|'succeeded'|null};
}

export async function bindOwnedStripeOrderRefund(client:OwnedStripeOrderRpcClient,input:{orderId:string;operationId:string;
 providerRefundId:string;providerStatus:'pending'|'succeeded'}){
 const{data,error}=await client.rpc('app_stripe_order_bind_refund',{p_order_id:input.orderId,p_operation_id:input.operationId,
  p_provider_refund_id:input.providerRefundId,p_provider_status:input.providerStatus});
 if(error||data!==true)throw new Error('Stripe refund binding unavailable.');
}
