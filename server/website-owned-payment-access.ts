import type { ApplicationDefinition } from '../src/modules/website-builder/core/application-model';
import { readApplicationDefinition } from '../src/modules/website-builder/core/application-validation';
import { parseApplicationPaymentStatus } from '../src/modules/website-builder/core/application-payment-status';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface OwnedPaymentAccessClient{
 rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>;
}
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value as Record<string,unknown>;}

/** Exact table-index routing is compiled from the saved application. It cannot
 * be selected by a browser RPC name or a caller-provided price/role. */
export function createOwnedPaymentAccess(input:{definition:ApplicationDefinition;tableId:string;returnPath:string;client:OwnedPaymentAccessClient}){
 if(typeof window!=='undefined')throw new Error('Payment access unavailable.');
 const app=readApplicationDefinition(input.definition),index=app.tables.findIndex(table=>table.id===input.tableId);
 if(index<0||!app.tables[index].payment||!/^\/(?:[\p{L}\p{N}._-]+\/)*[\p{L}\p{N}._-]+\.html$/u.test(input.returnPath))throw new Error('Payment access unavailable.');
 const tableId=input.tableId,returnPath=input.returnPath,client=input.client;
 return{
  async loadStatus(value:{orderId:string;userId:string}){
   if(!uuid.test(value.orderId)||!uuid.test(value.userId))return null;
   const{data,error}=await client.rpc(`app_order_payment_status_${index}`,{p_order_id:value.orderId,p_user_id:value.userId});
   if(error)throw new Error('Payment status unavailable.');if(data===null)return null;
   const status=parseApplicationPaymentStatus(data);
   if(status.currency!==app.tables[index].payment!.currency)throw new Error('Payment status unavailable.');
   return status;
  },
  async loadOrder(value:{orderId:string;userId:string;checkoutId:string}){
   try{
    if(!uuid.test(value.orderId)||!uuid.test(value.userId)||value.checkoutId!==tableId)return null;
    const{data,error}=await client.rpc(`app_order_quote_${index}`,{p_order_id:value.orderId,p_user_id:value.userId});
    if(error||data===null)return null;const row=object(data);
    if(Object.keys(row).sort().join(',')!=='amount,currency'||!Number.isSafeInteger(row.amount)
     ||(row.amount as number)<1||(row.amount as number)>99999999999||row.currency!==app.tables[index].payment!.currency)throw new Error();
    return{amount:row.amount as number,currency:row.currency as string,returnPath};
   }catch{throw new Error('Order quote unavailable.');}
  },
  async authorizeRefund(value:{orderId:string;userId:string;amount?:number}){
   try{
    if(!uuid.test(value.orderId)||!uuid.test(value.userId)||value.amount!==undefined&&(!Number.isSafeInteger(value.amount)||value.amount<1))return null;
    const{data,error}=await client.rpc(`app_order_refund_authorize_${index}`,{p_order_id:value.orderId,p_user_id:value.userId,p_amount:value.amount??null});
    if(error||data===null)return null;const row=object(data);
    if(Object.keys(row).sort().join(',')!=='amount,paymentIntentId'||typeof row.paymentIntentId!=='string'
     ||!/^pi_[A-Za-z0-9]{8,200}$/.test(row.paymentIntentId)||!Number.isSafeInteger(row.amount)
     ||(row.amount as number)<1||(row.amount as number)>99999999999||value.amount!==undefined&&row.amount!==value.amount)throw new Error();
    return{paymentIntentId:row.paymentIntentId,amount:row.amount as number};
   }catch{throw new Error('Order refund authorization unavailable.');}
  },
 };
}
