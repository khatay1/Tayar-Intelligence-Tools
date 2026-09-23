import { Check } from 'lucide-react';
import type * as React from 'react';
import type { EditorProjectAccess } from '../core/editor-project-access';
import type { LiveVerification } from '../core/website-builder-model';
import type { PageTemplateDefinition } from '../core/website-builder-rendering';
import { PAGE_TEMPLATES } from '../core/website-builder-rendering';

interface BuilderLegacyLaunchCenterProps {
  applyPageTemplate: (template: PageTemplateDefinition) => void;
  closeLaunchCenter: () => void;
  cloudBusy: boolean;
  cloudProjectId: string | null;
  cloudSyncFailed: boolean;
  darkMode: boolean;
  exportV1LaunchReport: () => void;
  l: (text: string) => string;
  launchCheckBusy: boolean;
  launchLastCheckedAt: string | null;
  launchManualChecks: Record<"stripe" | "domain" | "support", boolean>;
  liveVerification: LiveVerification;
  networkOnline: boolean;
  previewWebsite: () => void;
  projectTeamAccess: EditorProjectAccess;
  publishBusy: boolean;
  publishedUrl: string;
  publishWebsite: (fromStaging?: boolean) => Promise<void>;
  qualityDiagnostics: { pages: number; sections: number; elements: number; snapshotKb: number; warnings: string[]; healthy: boolean; };
  refreshBilling: (projectId?: string | null, expectedLoadSequence?: number) => Promise<void>;
  runV1LaunchChecks: () => Promise<void>;
  saveProject: (options?: { automatic?: boolean; createHistory?: boolean; forPublication?: boolean; }) => Promise<boolean>;
  setBillingOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLaunchManualCheck: (key: "stripe" | "domain" | "support", checked: boolean) => void;
  setOperationsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSaved: React.Dispatch<React.SetStateAction<boolean>>;
  setSiteName: React.Dispatch<React.SetStateAction<string>>;
  setSiteUrl: React.Dispatch<React.SetStateAction<string>>;
  siteAudit: { errors: string[]; warnings: string[]; score: number; };
  siteName: string;
  siteUrl: string;
  v1LaunchStatus: { score: number; checks: { label: string; detail: string; ok: boolean; points: number; }[]; blockers: string[]; preflightReady: boolean; publishedRelease: boolean; liveHealthy: boolean; status: string; };
  verifyLiveDeployment: (expectedProjectId?: string | null, expectedOwnerId?: string, expectedLoadSequence?: number) => Promise<boolean>;
}

export function BuilderLegacyLaunchCenter({
  applyPageTemplate,
  closeLaunchCenter,
  cloudBusy,
  cloudProjectId,
  cloudSyncFailed,
  darkMode,
  exportV1LaunchReport,
  l,
  launchCheckBusy,
  launchLastCheckedAt,
  launchManualChecks,
  liveVerification,
  networkOnline,
  previewWebsite,
  projectTeamAccess,
  publishBusy,
  publishedUrl,
  publishWebsite,
  qualityDiagnostics,
  refreshBilling,
  runV1LaunchChecks,
  saveProject,
  setBillingOpen,
  setLaunchManualCheck,
  setOperationsOpen,
  setSaved,
  setSiteName,
  setSiteUrl,
  siteAudit,
  siteName,
  siteUrl,
  v1LaunchStatus,
  verifyLiveDeployment,
}: BuilderLegacyLaunchCenterProps) {
  return (
<div className={`border-b px-4 py-4 ${darkMode ? 'border-cyan-500/20 bg-[#06141a]' : 'border-cyan-200 bg-cyan-50/60'}`}>
          <div className="mx-auto max-w-6xl space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Check className="h-4 w-4 text-cyan-400" />
                  <p className="text-sm font-black">{l('Website Builder V1 Launch Center')}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${v1LaunchStatus.status === 'V1 LIVE' ? 'bg-emerald-500 text-white' : v1LaunchStatus.preflightReady ? 'bg-cyan-500 text-white' : 'bg-amber-500/15 text-amber-400'}`}>{l(v1LaunchStatus.status)}</span>
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-black text-gray-400">V1.0</span>
                </div>
                <p className="mt-1 text-[11px] text-gray-500">{l('One place to onboard a project, run production checks, publish the release and verify that the live site is healthy.')}</p>
                {launchLastCheckedAt && <p className="mt-1 text-[9px] text-gray-600">{l('Last automated check')}: {new Date(launchLastCheckedAt).toLocaleString()}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => void runV1LaunchChecks()} disabled={launchCheckBusy} className="rounded-lg bg-cyan-600 px-3 py-2 text-[10px] font-black text-white hover:bg-cyan-500 disabled:opacity-50">{launchCheckBusy ? l('Checking…') : l('Run final checks')}</button>
                <button onClick={exportV1LaunchReport} className="rounded-lg border border-cyan-500/25 px-3 py-2 text-[10px] font-bold text-cyan-400">{l('Export launch report')}</button>
                <button onClick={closeLaunchCenter} className="text-xs font-semibold text-violet-400">{l('Close')}</button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[.75fr_1.25fr]">
              <div className={`rounded-2xl border p-4 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-cyan-400">{l('Final readiness')}</p><p className="mt-1 text-xs text-gray-500">{l('Automated release gate for this project.')}</p></div><span className={`text-4xl font-black ${v1LaunchStatus.score >= 90 ? 'text-emerald-400' : v1LaunchStatus.score >= 70 ? 'text-cyan-400' : 'text-amber-400'}`}>{v1LaunchStatus.score}</span></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${v1LaunchStatus.score >= 90 ? 'bg-emerald-500' : v1LaunchStatus.score >= 70 ? 'bg-cyan-500' : 'bg-amber-500'}`} style={{ width: `${v1LaunchStatus.score}%` }} /></div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl border border-white/10 p-2"><p className="text-[9px] uppercase text-gray-500">{l('Audit')}</p><p className="text-lg font-black">{siteAudit.score}</p></div>
                  <div className="rounded-xl border border-white/10 p-2"><p className="text-[9px] uppercase text-gray-500">{l('Health')}</p><p className={`text-lg font-black ${qualityDiagnostics.healthy ? 'text-emerald-400' : 'text-amber-400'}`}>{qualityDiagnostics.healthy ? l('GOOD') : l('CHECK')}</p></div>
                  <div className="rounded-xl border border-white/10 p-2"><p className="text-[9px] uppercase text-gray-500">{l('Sync')}</p><p className={`text-lg font-black ${networkOnline && !cloudSyncFailed ? 'text-emerald-400' : 'text-rose-400'}`}>{networkOnline && !cloudSyncFailed ? l('OK') : l('FIX')}</p></div>
                  <div className="rounded-xl border border-white/10 p-2"><p className="text-[9px] uppercase text-gray-500">{l('Live')}</p><p className={`text-lg font-black ${liveVerification === 'healthy' ? 'text-emerald-400' : publishedUrl ? 'text-amber-400' : 'text-gray-500'}`}>{liveVerification === 'healthy' ? l('VERIFIED') : publishedUrl ? l('VERIFY') : l('NOT YET')}</p></div>
                </div>
                {v1LaunchStatus.blockers.length > 0 ? <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3"><p className="text-[10px] font-black uppercase text-rose-400">{l('Launch blockers')}</p><div className="mt-2 space-y-1">{v1LaunchStatus.blockers.map((item) => <p key={item} className="text-[10px] text-rose-300">• {l(item)}</p>)}</div></div> : <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[10px] font-bold text-emerald-400">{l('✓ No critical production blockers detected.')}</div>}
              </div>

              <div className={`rounded-2xl border p-4 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-wider text-violet-400">{l('Automated launch checks')}</p><p className="mt-1 text-[10px] text-gray-500">{l('Publish only after the preflight items are green.')}</p></div><span className="text-[10px] font-bold text-gray-500">{v1LaunchStatus.checks.filter((item) => item.ok).length}/{v1LaunchStatus.checks.length}</span></div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {v1LaunchStatus.checks.map((check) => <div key={check.label} className={`rounded-xl border p-2.5 ${check.ok ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/10 bg-black/10'}`}><div className="flex items-center gap-2"><span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${check.ok ? 'bg-emerald-500 text-white' : 'bg-white/10 text-gray-500'}`}>{check.ok ? '✓' : '○'}</span><p className={`text-[10px] font-bold ${check.ok ? 'text-emerald-400' : 'text-gray-300'}`}>{l(check.label)}</p></div><p className="mt-1 pl-7 text-[9px] text-gray-500">{l(check.detail)}</p></div>)}
                </div>
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${darkMode ? 'border-violet-500/15 bg-violet-500/[0.03]' : 'border-violet-100 bg-white'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black">{l('Quick-start onboarding')}</p><p className="mt-1 text-[10px] text-gray-500">{l('Start from a proven page structure, then complete the production URL and cloud save.')}</p></div><span className="rounded-full bg-violet-500/10 px-2 py-1 text-[9px] font-black text-violet-400">{l('FIRST PROJECT')}</span></div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                {PAGE_TEMPLATES.slice(0, 6).map((template) => <button key={template.id} onClick={() => applyPageTemplate(template)} className={`rounded-xl border p-2.5 text-left ${darkMode ? 'border-white/10 bg-white/[0.03] hover:border-violet-500/40' : 'border-gray-200 bg-gray-50 hover:border-violet-300'}`}><p className="text-[10px] font-bold">{l(template.name)}</p><p className="mt-1 line-clamp-2 text-[9px] text-gray-500">{l(template.description)}</p></button>)}
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
                <input value={siteName} onChange={(e) => { setSiteName(e.target.value.slice(0, 160)); setSaved(false); }} placeholder={l('Website name')} className={`rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-black/20 text-white' : 'border-gray-200 bg-white'}`} />
                <input value={siteUrl} onChange={(e) => { setSiteUrl(e.target.value.slice(0, 1000)); setSaved(false); }} placeholder="https://example.com" className={`rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-black/20 text-white' : 'border-gray-200 bg-white'}`} />
                <button onClick={() => void saveProject()} disabled={cloudBusy} className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white disabled:opacity-50">{l('Save project')}</button>
                <button onClick={previewWebsite} className="rounded-lg border border-violet-500/25 px-3 py-2 text-[10px] font-black text-violet-400">{l('Preview')}</button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
              <div className={`rounded-2xl border p-4 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white'}`}>
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">{l('Manual production sign-off')}</p>
                <p className="mt-1 text-[10px] text-gray-500">{l('These checks involve external services and must be confirmed by a human before accepting paid customers.')}</p>
                <div className="mt-3 space-y-2">
                  {([
                    ['stripe', 'Stripe test purchase + Customer Portal + webhook verified'],
                    ['domain', 'Production domain / DNS / HTTPS verified'],
                    ['support', 'Support contact + privacy / terms review completed'],
                  ] as const).map(([key, label]) => <label key={key} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${launchManualChecks[key] ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/10'}`}><input type="checkbox" checked={launchManualChecks[key]} onChange={(e) => setLaunchManualCheck(key, e.target.checked)} className="mt-0.5" /><span className={`text-[10px] ${launchManualChecks[key] ? 'font-bold text-emerald-400' : 'text-gray-400'}`}>{l(label)}</span></label>)}
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white'}`}>
                <p className="text-[10px] font-black uppercase tracking-wider text-cyan-400">{l('Release actions')}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => { setBillingOpen(true); void refreshBilling(cloudProjectId); }} className="rounded-xl border border-white/10 p-3 text-left text-[10px] font-bold">{l('Billing & limits')}<div className="mt-1 text-[9px] font-normal text-gray-500">{l('Verify plan and Stripe state')}</div></button>
                  <button onClick={() => setOperationsOpen(true)} className="rounded-xl border border-white/10 p-3 text-left text-[10px] font-bold">{l('Audit & backups')}<div className="mt-1 text-[9px] font-normal text-gray-500">{l('Export backup and diagnostics')}</div></button>
                  <button onClick={() => void publishWebsite()} disabled={!v1LaunchStatus.preflightReady || publishBusy || !projectTeamAccess.canPublish} className="rounded-xl bg-sky-600 p-3 text-left text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{publishedUrl ? l('Publish production changes') : l('Publish first release')}<div className="mt-1 text-[9px] font-normal text-sky-100">{l('Blocked until automated preflight is ready')}</div></button>
                  <button onClick={() => void verifyLiveDeployment()} disabled={!publishedUrl || liveVerification === 'checking'} className="rounded-xl border border-emerald-500/20 p-3 text-left text-[10px] font-bold text-emerald-400 disabled:opacity-40">{l('Verify live release')}<div className="mt-1 text-[9px] font-normal text-gray-500">{l('Confirm index.html is deployed')}</div></button>
                </div>
                <div className={`mt-3 rounded-xl border p-3 ${v1LaunchStatus.status === 'V1 LIVE' && Object.values(launchManualChecks).every(Boolean) ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-black/10'}`}>
                  <p className="text-[10px] font-black">{l('V1 release decision')}</p>
                  <p className={`mt-1 text-xs font-black ${v1LaunchStatus.status === 'V1 LIVE' && Object.values(launchManualChecks).every(Boolean) ? 'text-emerald-400' : 'text-amber-400'}`}>{v1LaunchStatus.status === 'V1 LIVE' && Object.values(launchManualChecks).every(Boolean) ? l('GO — READY FOR FIRST PAYING CUSTOMERS') : v1LaunchStatus.preflightReady ? l('CODE READY — COMPLETE PUBLISH / MANUAL CHECKS') : l('NO-GO — FIX AUTOMATED BLOCKERS')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
  );
}
