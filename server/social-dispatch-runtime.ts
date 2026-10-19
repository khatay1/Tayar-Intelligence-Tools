import type { SupabaseClient } from '@supabase/supabase-js';
import { createSocialHubDueOutgoingReader, createSocialHubRpcWorkers } from './social-hub-worker-store';

function unavailable() { return new Response(null,{status:503}); }
async function equalSecret(received:string,expected:string) {
  const encoder=new TextEncoder();const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(received)),crypto.subtle.digest('SHA-256',encoder.encode(expected))]);
  const left=new Uint8Array(a),right=new Uint8Array(b);let mismatch=left.length^right.length;for(let i=0;i<Math.max(left.length,right.length);i++)mismatch|=(left[i%left.length]??0)^(right[i%right.length]??0);return mismatch===0;
}

/** Dedicated scheduler endpoint. It never accepts scope/job/provider data from the request. */
export function createSocialDispatchHandler(input:{enabled:()=>boolean;secret:string;client:Pick<SupabaseClient,'rpc'>;graphVersion?:string;fetcher?:typeof fetch}) {
  if (input.secret.length<32 || input.secret.length>512 || /\s/.test(input.secret)) throw Error('Invalid scheduler secret.');
  const listDue=createSocialHubDueOutgoingReader(input.client);
  const workers=createSocialHubRpcWorkers(input.client,{enabled:input.enabled,graphVersion:input.graphVersion,fetcher:input.fetcher});
  return async (request:Request):Promise<Response> => {
    if(input.enabled()!==true)return unavailable();
    if(request.method!=='GET')return new Response(null,{status:405});
    const url=new URL(request.url);if(url.search)return new Response(null,{status:400});
    const authorization=request.headers.get('authorization')??'';
    if(!authorization.startsWith('Bearer ')||!await equalSecret(authorization.slice(7),input.secret))return new Response(null,{status:401});
    try {
      const due=await listDue(3);let accepted=0,review=0,rejected=0,idle=0;
      for(const item of due){
        if(input.enabled()!==true)return unavailable();
        const outcome=await workers.dispatch({tenantId:item.tenantId,connectionId:item.connectionId},item.jobId);
        if(outcome.status==='accepted')accepted++;else if(outcome.status==='review')review++;else if(outcome.status==='idle')idle++;else rejected++;
      }
      return Response.json({processed:due.length,accepted,review,rejected,idle},{headers:{'Cache-Control':'private, no-store'}});
    } catch { return unavailable(); }
  };
}
