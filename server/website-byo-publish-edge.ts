import type {SupabaseClient} from '@supabase/supabase-js';
import {handleWebsiteByoPublish} from './website-byo-publish-endpoint';

type EndpointContext=Parameters<typeof handleWebsiteByoPublish>[1];
type Runners=Omit<EndpointContext,'platform'>;
const baseHeaders={'cache-control':'no-store','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'",'x-content-type-options':'nosniff'};
const json=(status:number,error:string)=>new Response(JSON.stringify({error}),{status,headers:{...baseHeaders,'content-type':'application/json'}});

/** Source-only Edge composition. Deployment code must inject the service-role
 * platform client and trusted runners from a compatible server executor. The
 * network wrapper intentionally does not bundle the Node source compiler. */
export function createWebsiteByoPublishEdgeHandler(input:{platform:Pick<SupabaseClient,'auth'|'from'>;
  allowedOrigin:string;runners:Runners}){
  let allowed:URL;
  try{allowed=new URL(input.allowedOrigin);if(allowed.protocol!=='https:'||allowed.origin!==input.allowedOrigin)throw new Error();}
  catch{throw new Error('BYO publish Edge configuration unavailable.');}
  return async(request:Request)=>{
    const origin=request.headers.get('origin');
    if(origin&&origin!==allowed.origin)return json(403,'Origin not allowed.');
    const cors=new Headers(baseHeaders);cors.set('vary','Origin');
    if(origin)cors.set('access-control-allow-origin',origin);
    cors.set('access-control-allow-methods','POST, OPTIONS');
    cors.set('access-control-allow-headers','authorization, apikey, content-type, x-client-info');
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    const response=await handleWebsiteByoPublish(request,{platform:input.platform,...input.runners});
    const headers=new Headers(response.headers);cors.forEach((value,key)=>headers.set(key,value));
    return new Response(response.body,{status:response.status,headers});
  };
}
