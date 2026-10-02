import{createClient}from'@supabase/supabase-js';
import{createWebsiteByoPublishHost}from'./website-byo-publish-host';

type HostInput=Parameters<typeof createWebsiteByoPublishHost>[0];
type DeploymentRuntime=Pick<HostInput['runner'],'fetcher'>;
type Environment=Readonly<Record<string,string|undefined>>;
const provider=/^[A-Za-z0-9_-]{1,200}$/,githubClient=/^[A-Za-z0-9_]{5,100}$/;
const publicSecret=/^(?:NEXT_PUBLIC_|VITE_|PUBLIC_).*?(?:SECRET|SERVICE_ROLE|PRIVATE_KEY)/i;
const keyNames={url:'TAYAR_PLATFORM_SUPABASE_URL',secret:'TAYAR_PLATFORM_SUPABASE_SECRET_KEY',
 origin:'TAYAR_PLATFORM_ORIGIN',organization:'TAYAR_PLATFORM_SUPABASE_ORGANIZATION_ID',
 vercelAccount:'TAYAR_PLATFORM_VERCEL_ACCOUNT_ID',githubClient:'TAYAR_GITHUB_APP_CLIENT_ID',
 githubKey:'TAYAR_GITHUB_APP_PRIVATE_KEY_PKCS8'}as const;

function required(environment:Environment,key:string,max:number){
 const value=environment[key];if(typeof value!=='string'||!value||value.length>max||value.trim()!==value
  ||value.includes(String.fromCharCode(0)))throw new Error();
 return value;
}
function exactHttps(value:string,supabase=false){
 const url=new URL(value);if(url.protocol!=='https:'||url.origin!==value||url.username||url.password||url.port
  ||url.pathname!=='/'||url.search||url.hash||(supabase&&!/^[a-z0-9]{20}[.]supabase[.]co$/.test(url.hostname)))throw new Error();
 return url.origin;
}
function legacyServiceRole(value:string){
 try{const parts=value.split('.');if(parts.length!==3||parts.some(part=>!part))return false;
  const base=parts[1].replace(/-/g,'+').replace(/_/g,'/'),payload=JSON.parse(atob(base.padEnd(Math.ceil(base.length/4)*4,'=')));
  return!!payload&&typeof payload==='object'&&payload.role==='service_role';}catch{return false;}
}
function secretKey(value:string){
 if(/[\s\r\n]/.test(value)||value.length>4096||(!/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(value)&&!legacyServiceRole(value)))throw new Error();
 return value;
}
function privateKey(value:string){
 if(value.length>24_000||!/^-----BEGIN PRIVATE KEY-----\s+[A-Za-z0-9+/=\s]+\s+-----END PRIVATE KEY-----$/.test(value))throw new Error();
 return value;
}

/** Unmounted Node deployment boundary. Environment values are parsed once at
 * cold start; the returned Fetch handler never accepts platform configuration
 * or provider credentials from an HTTP request. */
export function createWebsiteByoPublishDeploymentEntry(input:{environment:Environment}&DeploymentRuntime){
 try{
  if(input.fetcher!==undefined&&typeof input.fetcher!=='function')throw new Error();
  for(const[key,value]of Object.entries(input.environment))if(value&&publicSecret.test(key))throw new Error();
  const platformUrl=exactHttps(required(input.environment,keyNames.url,2048),true);
  const platformOrigin=exactHttps(required(input.environment,keyNames.origin,2048));
  if(platformOrigin===platformUrl)throw new Error();
  const platformSupabaseOrganizationId=required(input.environment,keyNames.organization,200);
  const platformVercelAccountId=required(input.environment,keyNames.vercelAccount,200);
  const githubAppClientId=required(input.environment,keyNames.githubClient,100);
  if(!provider.test(platformSupabaseOrganizationId)||!provider.test(platformVercelAccountId)
   ||!githubClient.test(githubAppClientId))throw new Error();
  const serviceKey=secretKey(required(input.environment,keyNames.secret,4096));
  const githubAppPrivateKeyPkcs8=privateKey(required(input.environment,keyNames.githubKey,24_000));
  const platform=createClient(platformUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
   ...(input.fetcher?{global:{fetch:input.fetcher}}:{})});
  return createWebsiteByoPublishHost({platform,allowedOrigin:platformOrigin,runner:{platformOrigin,platformUrl,
   platformSupabaseOrganizationId,platformVercelAccountId,githubAppClientId,githubAppPrivateKeyPkcs8,
   fetcher:input.fetcher}});
 }catch{throw new Error('BYO publish deployment unavailable.');}
}
