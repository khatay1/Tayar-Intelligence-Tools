import {useEffect,useState} from 'react';
import {useLocalizer} from '@/lib/ui-localization-cms';
import type {WebsiteByoPublishResult} from '../services/websiteByoPublishBrowserService';

type ViewStatus='idle'|'pending'|'blocked'|'ready'|'failed';
export interface BuilderByoPublishController{
  start(newOperation:boolean):Promise<WebsiteByoPublishResult>;
  poll():Promise<WebsiteByoPublishResult|null>;
}
interface Props{projectSaved:boolean;controller?:BuilderByoPublishController;initialPreview?:WebsiteByoPublishResult|null;pollIntervalMs?:number;}
function view(result?:WebsiteByoPublishResult|null):ViewStatus{return result?.status??'idle';}

export function BuilderByoPublishPanel({projectSaved,controller,initialPreview=null,pollIntervalMs=3000}:Props){
  const l=useLocalizer(),[preview,setPreview]=useState<WebsiteByoPublishResult|null>(initialPreview);
  const[failed,setFailed]=useState(false);
  useEffect(()=>{if(initialPreview)setPreview(initialPreview);},[initialPreview]);
  const[busy,setBusy]=useState(false),available=projectSaved&&Boolean(controller);
  useEffect(()=>{if(!controller||preview?.status!=='pending'||failed)return;let active=true;const timer=window.setTimeout(()=>{void controller.poll().then(result=>{
        if(active&&result){setPreview(result);setFailed(false);}}).catch(()=>{if(active)setFailed(true);});},Math.max(1000,pollIntervalMs));
    return()=>{active=false;window.clearTimeout(timer);};
  },[controller,failed,pollIntervalMs,preview?.status,preview?.version]);
  const start=async()=>{if(!controller||!available||busy)return;setBusy(true);setFailed(false);
    try{setPreview(await controller.start(preview?.status==='ready'||preview?.status==='blocked'));}catch{setFailed(true);}finally{setBusy(false);}};
  const status=failed?'failed':view(preview);
  return <section className="builder-v2-card" data-testid="byo-publish-panel"><div className="builder-v2-card__header"><div><strong>{l('Publish on your infrastructure')}</strong>
    <p>{l('Tayar prepares and verifies the release. Your connected accounts run it.')}</p></div></div>
    <p>{l('Code, database and hosting remain in your accounts. Provider billing, backups and ongoing administration belong to you after handover.')}</p>
    <p>{l('A verified release runs independently of Tayar. Keep its runtime credentials in your hosting account; remove Tayar setup permissions only after verifying the handover.')}</p>
    <div className="builder-v2-card builder-v2-card--nested" data-environment="preview">
      <div className="builder-v2-card__header"><strong>{l('Preview')}</strong><span role="status">{l(status)}</span></div>
      {preview&&<small>{l('Stage')}: {preview.stage}</small>}{status==='blocked'&&<p role="alert">{l('Publishing is blocked. Check your connections and application configuration, then retry. This project has not been verified as ready.')}</p>}{preview?.liveUrl&&<a href={preview.liveUrl} target="_blank" rel="noreferrer">{l('Open published website')}</a>}
      <button type="button" disabled={!available||busy||status==='pending'} onClick={()=>void start()}>
        {busy?l('Publishing…'):l('Create verified preview')}
      </button>
    </div>
    <div className="builder-v2-card builder-v2-card--nested" data-environment="production">
      <div className="builder-v2-card__header"><strong>{l('Production')}</strong><span role="status">{l('blocked')}</span></div>
      <p role="alert">{l('Production publishing requires a separately staged and verified Production release.')}</p>
    </div>
    {!controller&&<small>{l('Publishing endpoint is not available yet.')}</small>}
  </section>;
}
export default BuilderByoPublishPanel;
