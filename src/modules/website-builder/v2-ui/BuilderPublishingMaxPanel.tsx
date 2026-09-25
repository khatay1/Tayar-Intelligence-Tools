import { useMemo, useState, useSyncExternalStore } from 'react';
import { usePreferences } from '@/context/PreferencesContext';
import type { EditorPageLike } from '../core/editor-model';
import { localizeEditorPublishing } from '../core/editor-publishing-localization';
import { normalizeEditorPublishPlan, validateEditorPublishPlan, type EditorPublishEnvironment, type EditorPublishMode, type EditorPublishPlan } from '../core/editor-publishing';
import {
  getEditorPublishingHostState,
  patchEditorPublishingHostState,
  subscribeEditorPublishingHost,
} from '../core/editor-publishing-host-store';

export interface BuilderPublishingMaxPanelProps {
  pages: EditorPageLike[];
  publishing?: boolean;
  onPublishPlan?(plan: EditorPublishPlan): void | Promise<void>;
  onOpenDomains?(): void;
  onOpenRedirects?(): void;
  onOpenVersions?(): void;
}
export function BuilderPublishingMaxPanel({ pages, publishing, onPublishPlan, onOpenDomains, onOpenRedirects, onOpenVersions }: BuilderPublishingMaxPanelProps) {
  const { prefs } = usePreferences(); const t=(s:string)=>localizeEditorPublishing(s,prefs.language);
  const draft=useSyncExternalStore(subscribeEditorPublishingHost,getEditorPublishingHostState,getEditorPublishingHostState);
  const {environment,mode,pageIds,scheduledAt,releaseNote}=draft;
  const [error,setError]=useState('');
  const [submitting, setSubmitting] = useState(false);
  const allIds=useMemo(()=>pages.map(p=>p.id),[pages]);
  const toggle=(id:string)=>patchEditorPublishingHostState({pageIds:pageIds.includes(id)?pageIds.filter(x=>x!==id):[...pageIds,id]});
  const submit=async()=>{
    if (submitting || publishing || !onPublishPlan) return;
    const plan=normalizeEditorPublishPlan({environment,mode,pageIds,scheduledAt:scheduledAt||undefined,releaseNote},allIds);
    const errors=validateEditorPublishPlan(plan);
    if(errors.length){setError(errors.join(' '));return;}
    setError('');
    setSubmitting(true);
    try { await onPublishPlan(plan); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Publishing failed. Please try again.'); }
    finally { setSubmitting(false); }
  };
  return <section className="tayar-v2-publishing-max"><div className="tayar-v2-panel-heading"><strong>{t('Publishing MAX')}</strong></div>
    <label>{t('Release environment')}<select value={environment} onChange={e=>patchEditorPublishingHostState({environment:e.target.value as EditorPublishEnvironment})}><option value="staging">{t('Staging')}</option><option value="production">{t('Production')}</option></select></label>
    <label>{t('Publish scope')}<select value={mode} onChange={e=>patchEditorPublishingHostState({mode:e.target.value as EditorPublishMode})}><option value="full">{t('Full site')}</option><option value="selective">{t('Selected pages')}</option></select></label>
    {mode==='selective'&&<div className="tayar-v2-publish-pages">{pages.map(page=><label key={page.id}><input type="checkbox" checked={pageIds.includes(page.id)} onChange={()=>toggle(page.id)}/>{page.name||page.id}</label>)}</div>}
    <label>{t('Release date and time')}<input type="datetime-local" value={scheduledAt} onChange={e=>patchEditorPublishingHostState({scheduledAt:e.target.value})}/></label>
    <label>{t('Release note')}<textarea maxLength={500} value={releaseNote} onChange={e=>patchEditorPublishingHostState({releaseNote:e.target.value})}/></label>
    {error&&<div className="tayar-v2-error" role="alert">{error}</div>}
    <button type="button" className="tayar-v2-primary-action" disabled={publishing || submitting} onClick={() => void submit()}>{scheduledAt?t('Schedule publish'):t('Publish now')}</button>
    <div className="tayar-v2-publishing-tools"><button type="button" onClick={onOpenRedirects}>{t('Redirects')}</button><button type="button" onClick={onOpenVersions}>{t('Versions & rollback')}</button><button type="button" onClick={onOpenDomains}>{t('Domains')}</button></div>
  </section>;
}
export default BuilderPublishingMaxPanel;
