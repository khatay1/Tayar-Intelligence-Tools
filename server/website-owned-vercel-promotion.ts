export interface OwnedVercelPromotionReport {
  status: 'ready'; deploymentId: string; sourceCommitSha: string;
  aliases: string[]; liveUrl: string;
}

const id=/^[A-Za-z0-9_-]{3,128}$/,team=/^team_[A-Za-z0-9]{8,128}$/;
const project=/^prj_[A-Za-z0-9]{8,128}$/,deployment=/^dpl_[A-Za-z0-9]{8,128}$/;
const sha=/^[0-9a-f]{40}$/i,branch=/^[A-Za-z0-9_./-]{1,200}$/;
const hostname=/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?[.])+(?:[a-z]{2,63}|vercel[.]app)$/;
const complete=new Set(['READY','SUCCESS','ASSIGNED','COMPLETED']);

function validDomains(values:string[]){
  const result=[...values].sort();
  if(!result.length||result.length>100||new Set(result).size!==result.length||result.some(value=>!hostname.test(value)))throw new Error();
  return result;
}

async function json(fetcher:typeof fetch,url:string,token:string){
  const response=await fetcher(url,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000),
    headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
  if(response.status!==200||Number(response.headers.get('content-length')??0)>262_144)throw new Error();
  const raw=await response.text();if(raw.length>262_144)throw new Error();const parsed:unknown=JSON.parse(raw);
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error();return parsed as Record<string,unknown>;
}

/** Stable pre-effect binding for the production domains Vercel will map. */
export async function readOwnedVercelProductionDomains(input:{
  accessToken:string;accountId:string;projectId:string;productionBranch:string;
  isCurrent():Promise<boolean>;fetcher?:typeof fetch;
}):Promise<string[]>{
  if(typeof window!=='undefined'||!input.accessToken||input.accessToken.length>4096||/[\r\n]/.test(input.accessToken)
    ||!id.test(input.accountId)||!project.test(input.projectId)||!branch.test(input.productionBranch)
    ||input.productionBranch.includes('..'))throw new Error('Vercel production domains are unavailable.');
  const teamScope=team.test(input.accountId),scope=teamScope?`&teamId=${encodeURIComponent(input.accountId)}`:'';
  const path=`https://api.vercel.com/v9/projects/${input.projectId}/domains?production=true&verified=true&redirects=false&limit=100${scope}`;
  const read=async()=>{
    const value=await json(input.fetcher??fetch,path,input.accessToken);if(!Array.isArray(value.domains)||value.domains.length>100)throw new Error();
    if(value.pagination&&typeof value.pagination==='object'&&!Array.isArray(value.pagination)
      &&(value.pagination as Record<string,unknown>).next!=null)throw new Error();
    return validDomains(value.domains.map(raw=>{if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error();
      const domain=raw as Record<string,unknown>;if(domain.projectId!==input.projectId||domain.verified!==true||domain.redirect!=null
        ||(domain.gitBranch!=null&&domain.gitBranch!==input.productionBranch)||domain.customEnvironmentId!=null
        ||typeof domain.name!=='string')throw new Error();return domain.name; }));
  };
  try{if(!await input.isCurrent())throw new Error();const first=await read();if(!await input.isCurrent())throw new Error();
    const second=await read();if(JSON.stringify(first)!==JSON.stringify(second)||!await input.isCurrent())throw new Error();return second;
  }catch{throw new Error('Vercel production domains are unavailable.');}
}

/** A claimed operation may issue promote once. Retries pass issuePromotion=false
 * and only reconcile provider state. Readiness requires two identical proofs. */
export async function promoteAndVerifyOwnedVercelDeployment(input:{
  accessToken:string;accountId:string;projectId:string;deploymentId:string;sourceCommitSha:string;
  sourceBranch:string;expectedAliases:string[];issuePromotion:boolean;isCurrent():Promise<boolean>;fetcher?:typeof fetch;
}):Promise<OwnedVercelPromotionReport>{
  let expected:string[];try{expected=validDomains(input.expectedAliases);}catch{throw new Error('Vercel promotion is unavailable.');}
  if(typeof window!=='undefined'||!input.accessToken||input.accessToken.length>4096||/[\r\n]/.test(input.accessToken)
    ||!id.test(input.accountId)||!project.test(input.projectId)||!deployment.test(input.deploymentId)
    ||!sha.test(input.sourceCommitSha)||!branch.test(input.sourceBranch)||input.sourceBranch.includes('..'))
    throw new Error('Vercel promotion is unavailable.');
  const fetcher=input.fetcher??fetch,teamScope=team.test(input.accountId),query=teamScope?`?teamId=${encodeURIComponent(input.accountId)}`:'';
  const amp=teamScope?`&teamId=${encodeURIComponent(input.accountId)}`:'';
  const observe=async()=>{
    const deployed=await json(fetcher,`https://api.vercel.com/v13/deployments/${input.deploymentId}${query}`,input.accessToken),meta=deployed.meta;
    if(deployed.id!==input.deploymentId||deployed.projectId!==input.projectId||deployed.ownerId!==input.accountId
      ||deployed.readyState!=='READY'||!meta||typeof meta!=='object'||Array.isArray(meta)
      ||(meta as Record<string,unknown>).githubCommitSha!==input.sourceCommitSha
      ||(meta as Record<string,unknown>).githubCommitRef!==input.sourceBranch)throw new Error();
    const assigned=await json(fetcher,`https://api.vercel.com/v2/deployments/${input.deploymentId}/aliases${query}`,input.accessToken);
    if(!Array.isArray(assigned.aliases)||assigned.aliases.length>100)throw new Error();
    const aliases=validDomains(assigned.aliases.map(raw=>{if(!raw||typeof raw!=='object'||Array.isArray(raw)||typeof(raw as Record<string,unknown>).alias!=='string')throw new Error();
      return String((raw as Record<string,unknown>).alias);}));
    const promotion=await json(fetcher,`https://api.vercel.com/v1/projects/${input.projectId}/promote/aliases?limit=100${amp}`,input.accessToken);
    if(!Array.isArray(promotion.aliases)||promotion.aliases.length>100)throw new Error();
    if(promotion.pagination&&typeof promotion.pagination==='object'&&!Array.isArray(promotion.pagination)
      &&(promotion.pagination as Record<string,unknown>).next!=null)throw new Error();
    const mapped=validDomains(promotion.aliases.map(raw=>{if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error();const alias=raw as Record<string,unknown>;
      if(typeof alias.alias!=='string'||typeof alias.status!=='string'||!complete.has(alias.status.toUpperCase()))throw new Error();return alias.alias;}));
    if(expected.some(value=>!aliases.includes(value)||!mapped.includes(value)))throw new Error();
    return expected;
  };
  try{
    if(!await input.isCurrent())throw new Error();
    if(input.issuePromotion){try{const response=await fetcher(`https://api.vercel.com/v10/projects/${input.projectId}/promote/${input.deploymentId}${query}`,
      {method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000),headers:{Authorization:`Bearer ${input.accessToken}`,Accept:'application/json'}});
      if(![201,202].includes(response.status))throw new Error();}catch{/* uncertain response: reconcile, never repeat */}}
    if(!await input.isCurrent())throw new Error();const first=await observe();if(!await input.isCurrent())throw new Error();const second=await observe();
    if(JSON.stringify(first)!==JSON.stringify(second)||!await input.isCurrent())throw new Error();
    return{status:'ready',deploymentId:input.deploymentId,sourceCommitSha:input.sourceCommitSha,
      aliases:second,liveUrl:`https://${second[0]}`};
  }catch{throw new Error('Vercel promotion is unavailable.');}
}
