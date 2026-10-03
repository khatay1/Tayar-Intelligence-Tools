import{createClient}from'@supabase/supabase-js';
import{createWebsiteByoPublishHost}from'./website-byo-publish-host';

type HostInput=Parameters<typeof createWebsiteByoPublishHost>[0];
type DeploymentRuntime=Pick<HostInput['runner'],'fetcher'>;
type Environment=Readonly<Record<string,string|undefined>>;
const provider=/^[A-Za-z0-9_-]{1,200}$/,githubClient=/^[A-Za-z0-9_]{5,100}$/;
const publicSecret=/^(?:NEXT_PUBLIC_|VITE_|PUBLIC_).*?(?:SECRET|SERVICE_ROLE|PRIVATE_KEY)/i;
const keyNames={url:'TAYAR_PLATFORM_SUPABASE_URL',secret:'TAYAR_PLATFORM_SUPABASE_SECRET_KEY',
 returnUrl:'WEBSITE_GITHUB_RETURN_URL',organization:'WEBSITE_SUPABASE_PLATFORM_ORGANIZATION_ID',
 vercelAccount:'TAYAR_PLATFORM_VERCEL_ACCOUNT_ID',githubClient:'WEBSITE_GITHUB_APP_CLIENT_ID',
 githubSecret:'WEBSITE_GITHUB_APP_CLIENT_SECRET'}as const;

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
function returnOrigin(value:string){
 const url=new URL(value);if(url.protocol!=='https:'||!url.hostname||url.username||url.password||url.hash||url.search)throw new Error();
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
function providerSecret(value:string){
 if(value.length<20||value.length>4096||/[\r\n]/.test(value))throw new Error();
 return value;
}

/** Supabase Edge deployment boundary. Reuse the already-configured provider
 * connection identity instead of duplicating platform secrets for publishing. */
export function createWebsiteByoPublishDeploymentEntry(input:{environment:Environment}&DeploymentRuntime){
 try{
  if(input.fetcher!==undefined&&typeof input.fetcher!=='function')throw new Error();
  for(const[key,value]of Object.entries(input.environment))if(value&&publicSecret.test(key))throw new Error();
  const platformUrl=exactHttps(required(input.environment,keyNames.url,2048),true);
  const platformOrigin=returnOrigin(required(input.environment,keyNames.returnUrl,2048));
  if(platformOrigin===platformUrl)throw new Error();
  const platformSupabaseOrganizationId=required(input.environment,keyNames.organization,200);
  const platformVercelAccountId=required(input.environment,keyNames.vercelAccount,200);
  const githubClientId=required(input.environment,keyNames.githubClient,100);
  const githubClientSecret=providerSecret(required(input.environment,keyNames.githubSecret,4096));
  if(!provider.test(platformSupabaseOrganizationId)||!provider.test(platformVercelAccountId)
   ||!githubClient.test(githubClientId))throw new Error();
  const serviceKey=secretKey(required(input.environment,keyNames.secret,4096));
  const platform=createClient(platformUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
   ...(input.fetcher?{global:{fetch:input.fetcher}}:{})});
  return createWebsiteByoPublishHost({platform,allowedOrigin:platformOrigin,runner:{platformOrigin,platformUrl,
   platformSupabaseOrganizationId,platformVercelAccountId,githubClientId,githubClientSecret,fetcher:input.fetcher}});
 }catch{throw new Error('BYO publish deployment unavailable.');}
}
