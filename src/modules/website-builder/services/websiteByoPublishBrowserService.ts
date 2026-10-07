const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const stages=new Set(['created','validated','exporting','exported','observing','blocked','promoting','verifying-production','ready']);
const hostname=/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?[.])+(?:[a-z]{2,63}|vercel[.]app)$/;
const keyPrefix='tayar:byo-publish:v1';
export type WebsiteByoPublishEnvironment='preview'|'production';
export type WebsiteByoPublishStatus='pending'|'blocked'|'ready';
export interface WebsiteByoPublishResult{status:WebsiteByoPublishStatus;operationId:string;environment:WebsiteByoPublishEnvironment;
  stage:string;version:number;liveUrl:string|null;}
export interface WebsiteByoPublishBrowserScope{ownerId:string;projectId:string;loadSequence:number;isCurrent():boolean;}
export interface WebsiteByoPublishBrowserTransport{platformUrl:string;anonKey:string;
  getSession():Promise<{ownerId:string;accessToken:string}|null>;fetcher?:typeof fetch;}
type StorageLike=Pick<Storage,'getItem'|'setItem'|'removeItem'>;

function assertScope(scope:WebsiteByoPublishBrowserScope){if(!uuid.test(scope.ownerId)||!uuid.test(scope.projectId)
  ||!Number.isSafeInteger(scope.loadSequence)||scope.loadSequence<0||!scope.isCurrent())throw new Error('Project or account changed.');}
function storageKey(scope:WebsiteByoPublishBrowserScope,environment:WebsiteByoPublishEnvironment){return`${keyPrefix}:${scope.ownerId}:${scope.projectId}:${environment}`;}
function validUrl(value:unknown){if(value===null)return null;if(typeof value!=='string')throw new Error();const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash||!hostname.test(url.hostname))throw new Error();return url.origin;}
function parse(value:unknown,scope:WebsiteByoPublishBrowserScope,environment:WebsiteByoPublishEnvironment):WebsiteByoPublishResult{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();const row=value as Record<string,unknown>;
  if(!['pending','blocked','ready'].includes(String(row.status))||!uuid.test(String(row.operationId))||row.environment!==environment
    ||!stages.has(String(row.stage))||!Number.isSafeInteger(row.version)||(row.version as number)<1
    ||(row.status==='ready')!==(row.stage==='ready')||(row.status==='blocked')!==(row.stage==='blocked'))throw new Error();
  const liveUrl=validUrl(row.liveUrl);if((row.status==='ready')!==Boolean(liveUrl)||!scope.isCurrent())throw new Error();
  return{status:row.status as WebsiteByoPublishStatus,operationId:String(row.operationId),environment,
    stage:String(row.stage),version:row.version as number,liveUrl};
}
function readOperation(scope:WebsiteByoPublishBrowserScope,environment:WebsiteByoPublishEnvironment,storage:StorageLike){
  assertScope(scope);try{const value=JSON.parse(storage.getItem(storageKey(scope,environment))??'null');
    return value&&uuid.test(value.operationId)&&['pending','blocked','ready'].includes(value.status)?value as{operationId:string;status:WebsiteByoPublishStatus}:null;
  }catch{return null;}
}
function writeOperation(scope:WebsiteByoPublishBrowserScope,environment:WebsiteByoPublishEnvironment,storage:StorageLike,result:WebsiteByoPublishResult){
  storage.setItem(storageKey(scope,environment),JSON.stringify({operationId:result.operationId,status:result.status}));
}
function newOperation(scope:WebsiteByoPublishBrowserScope,environment:WebsiteByoPublishEnvironment,storage:StorageLike){
  const operationId=crypto.randomUUID();if(!uuid.test(operationId))throw new Error();storage.setItem(storageKey(scope,environment),JSON.stringify({operationId,status:'pending'}));return operationId;
}
async function request(input:{scope:WebsiteByoPublishBrowserScope;transport:WebsiteByoPublishBrowserTransport;
  environment:WebsiteByoPublishEnvironment;body:Record<string,unknown>}){
  assertScope(input.scope);const session=await input.transport.getSession();if(!session||session.ownerId!==input.scope.ownerId
    ||!session.accessToken||session.accessToken.length>16_384||!input.scope.isCurrent())throw new Error('Sign in to publish.');
  let endpoint:URL;try{const base=new URL(input.transport.platformUrl);if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||!input.transport.anonKey)throw new Error();
    endpoint=new URL(`${base.pathname.replace(/\/$/,'')}/functions/v1/website-byo-publish`,base.origin);}catch{throw new Error('Publishing is not configured.');}
  try{const response=await(input.transport.fetcher??fetch)(endpoint.toString(),{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),
      headers:{'content-type':'application/json',authorization:`Bearer ${session.accessToken}`,apikey:input.transport.anonKey},body:JSON.stringify(input.body)});
    if(![200,202,409].includes(response.status)||Number(response.headers.get('content-length')??0)>32_768)throw new Error();
    const raw=await response.text();if(raw.length>32_768||!input.scope.isCurrent())throw new Error();const value=JSON.parse(raw);
    if(response.status===409&&value?.status!=='blocked')throw new Error();return parse(value,input.scope,input.environment);
  }catch{throw new Error('Publish status is unavailable. Refresh and try again.');}
}

export function readStoredWebsiteByoPublishOperation(input:{scope:WebsiteByoPublishBrowserScope;environment:WebsiteByoPublishEnvironment;storage:StorageLike}){
  return readOperation(input.scope,input.environment,input.storage);
}
export async function startWebsiteByoPreview(input:{scope:WebsiteByoPublishBrowserScope;transport:WebsiteByoPublishBrowserTransport;
  storage:StorageLike;newOperation?:boolean}){
  const saved=readOperation(input.scope,'preview',input.storage);const operationId=!input.newOperation&&saved?saved.operationId:newOperation(input.scope,'preview',input.storage);
  const result=await request({scope:input.scope,transport:input.transport,environment:'preview',body:{action:'preview',projectId:input.scope.projectId,operationId}});
  if(result.operationId!==operationId)throw new Error('Publish status is unavailable. Refresh and try again.');writeOperation(input.scope,'preview',input.storage,result);return result;
}
export async function startWebsiteByoProduction(input:{scope:WebsiteByoPublishBrowserScope;transport:WebsiteByoPublishBrowserTransport;
  storage:StorageLike;newOperation?:boolean}){
  const preview=readOperation(input.scope,'preview',input.storage);if(!preview||preview.status!=='ready')throw new Error('Create and verify a preview first.');
  const saved=readOperation(input.scope,'production',input.storage);const operationId=!input.newOperation&&saved?saved.operationId:newOperation(input.scope,'production',input.storage);
  const result=await request({scope:input.scope,transport:input.transport,environment:'production',body:{action:'production',projectId:input.scope.projectId,operationId,previewOperationId:preview.operationId}});
  if(result.operationId!==operationId)throw new Error('Publish status is unavailable. Refresh and try again.');writeOperation(input.scope,'production',input.storage,result);return result;
}
export async function pollWebsiteByoPublish(input:{scope:WebsiteByoPublishBrowserScope;transport:WebsiteByoPublishBrowserTransport;
  storage:StorageLike;environment:WebsiteByoPublishEnvironment;includeSettled?:boolean}){
  const saved=readOperation(input.scope,input.environment,input.storage);if(!saved||(!input.includeSettled&&saved.status!=='pending'))return null;
  const result=await request({scope:input.scope,transport:input.transport,environment:input.environment,body:{action:'status',projectId:input.scope.projectId,operationId:saved.operationId,environment:input.environment}});
  if(result.operationId!==saved.operationId)throw new Error('Publish status is unavailable. Refresh and try again.');writeOperation(input.scope,input.environment,input.storage,result);return result;
}
