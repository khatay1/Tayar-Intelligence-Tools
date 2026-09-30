import type {SupabaseClient} from '@supabase/supabase-js';
import type {ByoPublishCheckpoint} from './website-byo-publish-worker';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const stages=new Set(['created','validated','exporting','exported','observing','blocked','promoting','verifying-production','ready']);
const responseHeaders={'cache-control':'no-store','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'",'x-content-type-options':'nosniff'};
const json=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:{...responseHeaders,'content-type':'application/json'}});
type Result={status:'pending'|'blocked'|'ready';checkpoint:ByoPublishCheckpoint};
type Scope={ownerId:string;projectId:string;operationId:string};

function safeLiveUrl(value:string|null){
  if(value===null)return true;try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port
    &&url.pathname==='/'&&!url.search&&!url.hash&&/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?[.])+(?:[a-z]{2,63}|vercel[.]app)$/.test(url.hostname);
  }catch{return false;}
}

function safe(result:Result,scope:Scope,environment:'preview'|'production'){
  const value=result.checkpoint;
  if(!['pending','blocked','ready'].includes(result.status)||value.operationId!==scope.operationId||value.projectId!==scope.projectId
    ||value.ownerId!==scope.ownerId||value.environment!==environment||!stages.has(value.stage)
    ||!Number.isSafeInteger(value.version)||value.version<1
    ||(result.status==='ready')!==(value.stage==='ready')||(result.status==='blocked')!==(value.stage==='blocked')
    ||(value.liveUrl!==null&&typeof value.liveUrl!=='string')||!safeLiveUrl(value.liveUrl))throw new Error();
  return{status:result.status,operationId:value.operationId,environment:value.environment,stage:value.stage,
    version:value.version,liveUrl:result.status==='ready'?value.liveUrl:null};
}

/** Authenticated source-only transport. Provider targets and credentials are
 * loaded by trusted callbacks; the browser can name only project/operations. */
export async function handleWebsiteByoPublish(request:Request,context:{
  platform:Pick<SupabaseClient,'auth'|'from'>;
  runPreview(scope:Scope):Promise<Result>;
  runProduction(scope:Scope&{previewOperationId:string}):Promise<Result>;
  readStatus(scope:Scope&{environment:'preview'|'production'}):Promise<Result>;
}):Promise<Response>{
  if(request.method!=='POST')return json(405,{error:'Method not allowed.'});
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??''))return json(415,{error:'JSON request required.'});
  const bearer=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(request.headers.get('authorization')??'')?.[1];
  if(!bearer||bearer.length>16_384)return json(401,{error:'Sign in required.'});
  let ownerId:string,input:Record<string,unknown>,action:'preview'|'production'|'status',projectId:string,operationId:string;
  try{const identity=await context.platform.auth.getUser(bearer);if(identity.error||!identity.data.user||identity.data.user.is_anonymous
      ||!uuid.test(identity.data.user.id))throw new Error();ownerId=identity.data.user.id;
  }catch{return json(401,{error:'Sign in required.'});}
  try{if(Number(request.headers.get('content-length')??0)>2048)throw new Error();const raw=await request.text();if(raw.length>2048)throw new Error();
    input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))throw new Error();action=String(input.action) as typeof action;
    const keys=action==='production'?['action','projectId','operationId','previewOperationId']
      :action==='status'?['action','projectId','operationId','environment']:['action','projectId','operationId'];
    if(!['preview','production','status'].includes(action)||Object.keys(input).some(key=>!keys.includes(key))
      ||typeof input.projectId!=='string'||!uuid.test(input.projectId)||typeof input.operationId!=='string'||!uuid.test(input.operationId)
      ||(action==='production'&&(typeof input.previewOperationId!=='string'||!uuid.test(input.previewOperationId)||input.previewOperationId===input.operationId))
      ||(action==='status'&&!['preview','production'].includes(String(input.environment))))throw new Error();
    projectId=input.projectId;operationId=input.operationId;
  }catch{return json(400,{error:'Invalid publish request.'});}
  const owns=async()=>{const{data,error}=await context.platform.from('projects').select('id').eq('id',projectId).eq('user_id',ownerId)
    .eq('type','website-builder').is('deleted_at',null).maybeSingle();if(error)throw new Error();return!!data;};
  try{
    if(!await owns())return json(404,{error:'Project not found.'});const scope={ownerId,projectId,operationId};
    const environment=action==='production'?'production':action==='preview'?'preview':input.environment as 'preview'|'production';
    const result=action==='preview'?await context.runPreview(scope):action==='production'
      ?await context.runProduction({...scope,previewOperationId:input.previewOperationId as string})
      :await context.readStatus({...scope,environment});
    if(!await owns())throw new Error();const body=safe(result,scope,environment);
    return json(body.status==='ready'?200:body.status==='blocked'?409:202,body);
  }catch{return json(409,{error:'Publish could not be reconciled. Refresh and try again.'});}
}
