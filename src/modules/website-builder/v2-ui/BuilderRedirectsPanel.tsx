import { useState } from 'react';
import { usePreferences } from '@/context/PreferencesContext';
import { localizeEditorPublishing } from '../core/editor-publishing-localization';
import { normalizeEditorPublishRedirect, validateEditorPublishRedirects, type EditorPublishRedirect } from '../core/editor-publishing';

export interface BuilderRedirectsPanelProps { redirects: EditorPublishRedirect[]; onChange(redirects: EditorPublishRedirect[]): void; onSave?(): void|Promise<void>; }
export function BuilderRedirectsPanel({ redirects,onChange,onSave }:BuilderRedirectsPanelProps){
 const {prefs}=usePreferences(); const t=(s:string)=>localizeEditorPublishing(s,prefs.language); const [error,setError]=useState('');
 const add=()=>onChange([...redirects,normalizeEditorPublishRedirect({from:'/old-page',to:'/new-page',status:301})]);
 const patch=(id:string,changes:Partial<EditorPublishRedirect>)=>onChange(redirects.map(r=>r.id===id?{...r,...changes}:r));
 const save=()=>{const errors=validateEditorPublishRedirects(redirects);if(errors.length){setError(errors.join(' '));return;}setError('');void onSave?.();};
 return <section className="tayar-v2-redirects"><div className="tayar-v2-panel-heading"><strong>{t('Redirects')}</strong><button type="button" onClick={add}>{t('Add redirect')}</button></div>{!redirects.length&&<div className="tayar-v2-muted">{t('No redirects yet.')}</div>}{redirects.map(r=><div className="tayar-v2-redirect-row" key={r.id}><input aria-label={t('Source path')} value={r.from} onChange={e=>patch(r.id,{from:e.target.value})}/><input aria-label={t('Target')} value={r.to} onChange={e=>patch(r.id,{to:e.target.value})}/><select value={r.status} onChange={e=>patch(r.id,{status:Number(e.target.value) as EditorPublishRedirect['status']})}><option value={301}>301 {t('Permanent')}</option><option value={302}>302 {t('Temporary')}</option><option value={307}>307 {t('Temporary')}</option><option value={308}>308 {t('Permanent')}</option></select><input type="checkbox" checked={r.enabled} onChange={e=>patch(r.id,{enabled:e.target.checked})}/><button type="button" onClick={()=>onChange(redirects.filter(x=>x.id!==r.id))}>×</button></div>)}{error&&<div role="alert" className="tayar-v2-error">{error}</div>}<button type="button" className="tayar-v2-primary-action" onClick={save}>{t('Save')}</button></section>;
}
export default BuilderRedirectsPanel;
