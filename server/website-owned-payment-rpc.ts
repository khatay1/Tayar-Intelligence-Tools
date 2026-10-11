import type { ApplicationDefinition } from '../src/modules/website-builder/core/application-model';
import { readApplicationDefinition } from '../src/modules/website-builder/core/application-validation';
import { validateOwnedApplicationPublicBackend,type ApplicationPublicBackend } from '../src/modules/website-builder/core/application-data-runtime';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function bounded(response:Response){
 if(!response.body)throw new Error();const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;
  if(size>200000){await reader.cancel();throw new Error();}chunks.push(next.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as unknown;
 }finally{reader.releaseLock();}
}

/** Server-only modern Supabase key and a fixed, definition-derived RPC
 * allowlist. Auth requests verify the supplied session with the customer Auth
 * service and never infer identity from unverified JWT contents. */
export function createOwnedPaymentRpcClient(input:{backend:ApplicationPublicBackend;expectedProjectRef:string;
 definition:ApplicationDefinition;secretKey:string;fetcher?:typeof fetch}){
 if(typeof window!=='undefined')throw new Error('Payment client unavailable.');
 validateOwnedApplicationPublicBackend(input.backend,input.expectedProjectRef);
 const prefix=['sb','secret',''].join('_');
 if(!input.secretKey.startsWith(prefix)||!/^[A-Za-z0-9_-]{16,200}$/.test(input.secretKey.slice(prefix.length)))
  throw new Error('Payment client unavailable.');
 const definition=readApplicationDefinition(input.definition),origin=new URL(input.backend.url).origin;
 const secretKey=input.secretKey,publicKey=input.backend.publishableKey,fetcher=input.fetcher??fetch;
 const names=new Set(['app_stripe_order_reserve','app_stripe_order_bind_session','app_stripe_order_reserve_refund',
  'app_stripe_order_bind_refund','app_stripe_order_apply_event']);
 definition.tables.forEach((table,index)=>{if(table.payment){names.add(`app_order_quote_${index}`);names.add(`app_order_refund_authorize_${index}`);names.add(`app_order_payment_status_${index}`);}});
 return{
  async rpc(name:string,args:Record<string,unknown>){
   try{
    if(typeof window!=='undefined'||!names.has(name))throw new Error();const body=JSON.stringify(args);
    if(body.length>200000)throw new Error();
    const response=await fetcher(`${origin}/rest/v1/rpc/${name}`,{method:'POST',redirect:'error',cache:'no-store',
     signal:AbortSignal.timeout(8000),headers:{apikey:secretKey,Accept:'application/json','Content-Type':'application/json'},body});
    if(!response.ok){await response.body?.cancel();throw new Error();}
    return{data:await bounded(response),error:null};
   }catch{return{data:null,error:true};}
  },
  async authenticate(accessToken:string):Promise<{userId:string}|null>{
   try{
    if(typeof window!=='undefined'||!/^[A-Za-z0-9._~-]{20,4096}$/.test(accessToken))return null;
    const response=await fetcher(`${origin}/auth/v1/user`,{method:'GET',redirect:'error',cache:'no-store',
     signal:AbortSignal.timeout(8000),headers:{apikey:publicKey,Authorization:`Bearer ${accessToken}`,Accept:'application/json'}});
    if(!response.ok){await response.body?.cancel();return null;}
    const value=await bounded(response);if(!value||typeof value!=='object'||Array.isArray(value))return null;
    const user=value as Record<string,unknown>;
    if(typeof user.id!=='string'||!uuid.test(user.id)||user.is_anonymous!==false||typeof user.email_confirmed_at!=='string'
     ||!Number.isFinite(Date.parse(user.email_confirmed_at)))return null;
    return{userId:user.id};
   }catch{return null;}
  },
 };
}
