import type {SupabaseClient} from '@supabase/supabase-js';

type Client=Pick<SupabaseClient,'rpc'>;
type Target={connectionId:string;version:number};
export interface WebsiteByoPublishTargets{
  githubPreview:Target;vercelPreview:Target;vercelProduction:Target|null;
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseTarget(value:unknown):Target{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();
  const row=value as Record<string,unknown>;
  if(Object.keys(row).some(key=>!['connectionId','version'].includes(key))
    ||typeof row.connectionId!=='string'||!uuid.test(row.connectionId)
    ||!Number.isSafeInteger(row.version)||(row.version as number)<1)throw new Error();
  return{connectionId:row.connectionId,version:row.version as number};
}
function parse(value:unknown):WebsiteByoPublishTargets{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();
  const row=value as Record<string,unknown>;
  if(Object.keys(row).some(key=>!['githubPreview','vercelPreview','vercelProduction'].includes(key)))throw new Error();
  const result={githubPreview:parseTarget(row.githubPreview),vercelPreview:parseTarget(row.vercelPreview),
    vercelProduction:row.vercelProduction===null?null:parseTarget(row.vercelProduction)};
  const ids=[result.githubPreview.connectionId,result.vercelPreview.connectionId];
  if(result.vercelProduction)ids.push(result.vercelProduction.connectionId);
  if(new Set(ids).size!==ids.length)throw new Error();
  return result;
}
const identity=(value:WebsiteByoPublishTargets)=>JSON.stringify(value);

/** Service-only target capture. Provider IDs are selected by PostgreSQL from
 * the private registry and are re-read before every remote operation. */
export async function captureWebsiteByoPublishTargets(input:{client:Client;projectId:string;ownerId:string;requireProduction?:boolean}){
  if(typeof window!=='undefined'||!uuid.test(input.projectId)||!uuid.test(input.ownerId))
    throw new Error('BYO publish targets unavailable.');
  const read=async()=>{const{data,error}=await input.client.rpc('website_byo_publish_targets',{
    p_project_id:input.projectId,p_owner_id:input.ownerId});if(error||data===null)throw new Error();return parse(data);};
  try{
    const targets=await read();if(input.requireProduction&&!targets.vercelProduction)throw new Error();
    const captured=identity(targets);
    const isCurrent=async()=>{try{return identity(await read())===captured;}catch{return false;}};
    if(!await isCurrent())throw new Error();
    return{targets:structuredClone(targets),isCurrent};
  }catch{throw new Error('BYO publish targets unavailable.');}
}
