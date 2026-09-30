import {useEffect,useState} from 'react';
import {useLocalizer} from '@/lib/ui-localization-cms';
import type {WebsiteByoPublishEnvironment,WebsiteByoPublishResult} from '../services/websiteByoPublishBrowserService';

type ViewStatus='idle'|'pending'|'blocked'|'ready'|'failed';
export interface BuilderByoPublishController{
  start(environment:WebsiteByoPublishEnvironment,newOperation:boolean):Promise<WebsiteByoPublishResult>;
  poll(environment:WebsiteByoPublishEnvironment):Promise<WebsiteByoPublishResult|null>;
}
interface Props{projectSaved:boolean;controller?:BuilderByoPublishController;initialPreview?:WebsiteByoPublishResult|null;
  initialProduction?:WebsiteByoPublishResult|null;pollIntervalMs?:number;}
function view(result?:WebsiteByoPublishResult|null):ViewStatus{return result?.status??'idle';}

export function BuilderByoPublishPanel({projectSaved,controller,initialPreview=null,initialProduction=null,pollIntervalMs=3000}:Props){
  const l=useLocalizer(),[preview,setPreview]=useState<WebsiteByoPublishResult|null>(initialPreview);
  const[production,setProduction]=useState<WebsiteByoPublishResult|null>(initialProduction),[failed,setFailed]=useState<WebsiteByoPublishEnvironment|null>(null);
  const[busy,setBusy]=useState<WebsiteByoPublishEnvironment|null>(null),available=projectSaved&&Boolean(controller);
  useEffect(()=>{if(!controller)return;const pending:WebsiteByoPublishEnvironment[]=[];if(preview?.status==='pending'&&failed!=='preview')pending.push('preview');if(production?.status==='pending'&&failed!=='production')pending.push('production');
    if(!pending.length)return;let active=true;const timer=window.setTimeout(()=>{void Promise.all(pending.map(async environment=>{try{const result=await controller.poll(environment);if(!active||!result)return;
          if(environment==='preview')setPreview(result);else setProduction(result);setFailed(null);}catch{if(active)setFailed(environment);}}));},Math.max(1000,pollIntervalMs));
    return()=>{active=false;window.clearTimeout(timer);};
  },[controller,failed,pollIntervalMs,preview?.status,preview?.version,production?.status,production?.version]);
  const start=async(environment:WebsiteByoPublishEnvironment)=>{if(!controller||!available||busy)return;setBusy(environment);setFailed(null);
    const current=environment==='preview'?preview:production;try{const result=await controller.start(environment,current?.status==='ready'||current?.status==='blocked');
      if(environment==='preview')setPreview(result);else setProduction(result);}catch{setFailed(environment);}finally{setBusy(null);}};
  const row=(environment:WebsiteByoPublishEnvironment,result:WebsiteByoPublishResult|null)=>{const status=failed===environment?'failed':view(result);
    const canProduction=environment==='preview'||preview?.status==='ready';return <div className="builder-v2-card builder-v2-card--nested" data-environment={environment}>
      <div className="builder-v2-card__header"><strong>{l(environment==='preview'?'Preview':'Production')}</strong><span role="status">{l(status)}</span></div>
      {result&&<small>{l('Stage')}: {result.stage}</small>}{result?.liveUrl&&<a href={result.liveUrl} target="_blank" rel="noreferrer">{l('Open published website')}</a>}
      <button type="button" disabled={!available||!canProduction||Boolean(busy)||status==='pending'} onClick={()=>void start(environment)}>
        {busy===environment?l('Publishing…'):l(environment==='preview'?'Create verified preview':'Publish verified preview')}
      </button>{environment==='production'&&preview?.status!=='ready'&&<small>{l('Create and verify a preview first.')}</small>}
    </div>;};
  return <section className="builder-v2-card" data-testid="byo-publish-panel"><div className="builder-v2-card__header"><div><strong>{l('Publish on your infrastructure')}</strong>
    <p>{l('Tayar prepares and verifies the release. Your connected accounts run it.')}</p></div></div>
    {row('preview',preview)}{row('production',production)}
    {!controller&&<small>{l('Publishing endpoint is not available yet.')}</small>}
  </section>;
}
export default BuilderByoPublishPanel;
