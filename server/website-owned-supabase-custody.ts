import type{ApplicationPublicBackend}from'../src/modules/website-builder/core/application-data-runtime';
import{validateOwnedApplicationPublicBackend}from'../src/modules/website-builder/core/application-data-runtime';

export type OwnedSupabaseEnvironment='preview'|'production';
export interface OwnedSupabaseCustody{version:number;accountId:string;organizationId:string;organizationSlug:string;
 projectRef:string;environment:OwnedSupabaseEnvironment;accessToken:string;}

const provider=/^[A-Za-z0-9_-]{1,200}$/,slug=/^[a-z0-9][a-z0-9-]{0,199}$/,ref=/^[a-z]{20}$/;
const providerTokenMaxBytes=65_536;
const token=(value:unknown)=>typeof value==='string'&&value.length>=20
 &&new TextEncoder().encode(value).length<=providerTokenMaxBytes&&!/[\r\n]/.test(value);
const object=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const exact=(row:Record<string,unknown>,keys:string[])=>Object.keys(row).every(key=>keys.includes(key));
const currentDate=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)>Date.now();

/** Parse the exact leased OAuth custody projection. Refresh tokens remain
 * inside custody because schema verification and migration need only access. */
export function parseOwnedSupabaseCustody(value:unknown,environment:OwnedSupabaseEnvironment,
 target:{projectRef:string;custodyVersion?:number}):OwnedSupabaseCustody{
 const row=object(value),grant=object(row?.grant);if(!row||!grant||!exact(row,['version','accountId','organizationId','organizationSlug',
  'projectRef','environment','accessExpiresAt','custodyExpiresAt','grant'])||!exact(grant,['accessToken','refreshToken'])
  ||!Number.isSafeInteger(row.version)||(row.version as number)<1
  ||(target.custodyVersion!==undefined&&row.version!==target.custodyVersion)
  ||typeof row.accountId!=='string'||!provider.test(row.accountId)||typeof row.organizationId!=='string'||!provider.test(row.organizationId)
  ||typeof row.organizationSlug!=='string'||!slug.test(row.organizationSlug)||row.projectRef!==target.projectRef
  ||!ref.test(String(row.projectRef))||row.environment!==environment||!currentDate(row.accessExpiresAt)||!currentDate(row.custodyExpiresAt)
  ||!token(grant.accessToken)||!token(grant.refreshToken))throw new Error();
 return{version:row.version as number,accountId:row.accountId,organizationId:row.organizationId,
  organizationSlug:row.organizationSlug,projectRef:row.projectRef as string,environment,accessToken:grant.accessToken};
}

/** Select one browser-safe customer key through the Management API. Secret
 * and service-role-shaped keys never leave this server-only boundary. */
export async function readOwnedSupabasePublicBackend(input:{custody:OwnedSupabaseCustody;fetcher?:typeof fetch}):Promise<ApplicationPublicBackend>{
 const response=await(input.fetcher??fetch)(`https://api.supabase.com/v1/projects/${input.custody.projectRef}/api-keys?reveal=true`,{
  method:'GET',headers:{Authorization:`Bearer ${input.custody.accessToken}`,Accept:'application/json'},redirect:'error',cache:'no-store',
  signal:AbortSignal.timeout(8000)});
 if(response.status!==200||Number(response.headers.get('content-length')??0)>131_072)throw new Error();
 const text=await response.text();if(text.length>131_072)throw new Error();const value:unknown=JSON.parse(text);
 if(!Array.isArray(value)||value.length>32)throw new Error();
 const keys=value.map(item=>{const row=object(item);if(!row||typeof row.type!=='string'||typeof row.api_key!=='string'
  ||(row.name!=null&&typeof row.name!=='string'))throw new Error();return row;});
 const publishable=keys.filter(key=>key.type==='publishable'&&/^sb_publishable_[A-Za-z0-9_-]+$/.test(String(key.api_key)));
 const legacy=keys.filter(key=>key.type==='legacy'&&key.name==='anon');
 const selected=publishable.length===1?publishable[0]:publishable.length===0&&legacy.length===1?legacy[0]:null;
 if(!selected)throw new Error();const backend={url:`https://${input.custody.projectRef}.supabase.co`,
  projectRef:input.custody.projectRef,publishableKey:String(selected.api_key)};
 validateOwnedApplicationPublicBackend(backend,input.custody.projectRef);return backend;
}
