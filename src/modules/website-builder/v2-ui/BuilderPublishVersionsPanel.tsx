import { usePreferences } from '@/context/PreferencesContext';
import { localizeEditorPublishing } from '../core/editor-publishing-localization';
import type { EditorPublishEnvironment, EditorPublishRevision } from '../core/editor-publishing';

export interface BuilderPublishVersionsPanelProps { revisions:EditorPublishRevision[]; environment:EditorPublishEnvironment; restoringId?:string; onRestore?(revision:EditorPublishRevision):void|Promise<void>; }
export function BuilderPublishVersionsPanel({revisions,environment,restoringId,onRestore}:BuilderPublishVersionsPanelProps){const {prefs}=usePreferences();const t=(s:string)=>localizeEditorPublishing(s,prefs.language);const filtered=revisions.filter(r=>r.environment===environment);return <section className="tayar-v2-publish-versions"><div className="tayar-v2-panel-heading"><strong>{t('Versions & rollback')}</strong></div>{filtered.map(revision=><article key={revision.id} className="tayar-v2-version-row"><div><strong>{revision.releaseNote||revision.id}</strong><small>{new Date(revision.createdAt).toLocaleString()} · {revision.pageIds?.length||0} pages</small></div><button type="button" disabled={restoringId===revision.id} onClick={()=>void onRestore?.(revision)}>{t('Restore')}</button></article>)}</section>}
export default BuilderPublishVersionsPanel;
