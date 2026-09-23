import type { User } from '@supabase/supabase-js';
import { BarChart3,Check,ChevronDown,Copy,Download,ExternalLink,Eye,Globe,History as HistoryIcon,Images,Inbox,Monitor,RotateCcw,Save,Smartphone,Sparkles } from 'lucide-react';
import type * as React from 'react';
import type { WebsiteDeliveryConfig } from '../core/delivery-config';
import type { AIQualityReview } from '../core/editor-ai-patch-review';
import type { EditorProjectAccess } from '../core/editor-project-access';
import type { Device } from '../core/types';
import { BILLING_PLAN_DETAILS } from '../core/website-builder-config';
import type { BillingFeature,BillingPlan,CloudWebsiteProject,LiveVerification,ProjectHistoryEntry,WebsiteLead,WebsitePublishVersion } from '../core/website-builder-model';

interface BuilderLegacyHeaderProps {
  aiBusy: boolean;
  aiQualityBusy: boolean;
  aiQualityReview: AIQualityReview | null;
  analyticsOpen: boolean;
  autoSaveStatus: "idle" | "saving" | "saved" | "failed";
  billingOpen: boolean;
  billingPlan: BillingPlan;
  cloudBusy: boolean;
  cloudProjectId: string | null;
  cloudProjects: CloudWebsiteProject[];
  darkMode: boolean;
  deliveryConfig: WebsiteDeliveryConfig;
  deliveryOpen: boolean;
  device: Device;
  downloadProductionZip: () => void;
  duplicateProject: () => Promise<void>;
  future: ProjectHistoryEntry[];
  hasUnpublishedChanges: boolean;
  history: ProjectHistoryEntry[];
  historyOpen: boolean;
  inspectorOpen: boolean;
  l: (text: string) => string;
  launchCenterOpen: boolean;
  leads: WebsiteLead[];
  leadsOpen: boolean;
  leftSidebarOpen: boolean;
  liveVerification: LiveVerification;
  loadCloudProject: (projectId: string) => Promise<void>;
  mediaOpen: boolean;
  networkOnline: boolean;
  operationsOpen: boolean;
  previewWebsite: () => void;
  projectTeamAccess: EditorProjectAccess;
  publishBusy: boolean;
  publishedAt: string | null;
  publishedUrl: string;
  publishVersions: WebsitePublishVersion[];
  publishWebsite: (fromStaging?: boolean) => Promise<void>;
  qualityDiagnostics: { pages: number; sections: number; elements: number; snapshotKb: number; warnings: string[]; healthy: boolean; };
  redo: () => void;
  refreshBilling: (projectId?: string | null, expectedLoadSequence?: number) => Promise<void>;
  releaseHistoryOpen: boolean;
  requireBillingFeature: (feature: BillingFeature, label: string) => boolean;
  resetProject: () => void;
  runAIQualityCheck: () => Promise<AIQualityReview | null>;
  runV1LaunchChecks: () => Promise<void>;
  saved: boolean;
  saveProject: (options?: { automatic?: boolean; createHistory?: boolean; forPublication?: boolean; }) => Promise<boolean>;
  setAnalyticsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setBillingOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDeliveryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDevice: React.Dispatch<React.SetStateAction<Device>>;
  setHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setInspectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLaunchCenterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLeadsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLeftSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMediaOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setOperationsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setReleaseHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSaved: React.Dispatch<React.SetStateAction<boolean>>;
  setSiteName: React.Dispatch<React.SetStateAction<string>>;
  setSiteUrl: React.Dispatch<React.SetStateAction<string>>;
  siteName: string;
  siteUrl: string;
  stopAIQualityCheck: () => void;
  undo: () => void;
  unpublishWebsite: () => Promise<void>;
  user: User | null;
  v1LaunchStatus: { score: number; checks: { label: string; detail: string; ok: boolean; points: number; }[]; blockers: string[]; preflightReady: boolean; publishedRelease: boolean; liveHealthy: boolean; status: string; };
  verifyLiveDeployment: (expectedProjectId?: string | null, expectedOwnerId?: string, expectedLoadSequence?: number) => Promise<boolean>;
}

export function BuilderLegacyHeader({
  aiBusy,
  aiQualityBusy,
  aiQualityReview,
  analyticsOpen,
  autoSaveStatus,
  billingOpen,
  billingPlan,
  cloudBusy,
  cloudProjectId,
  cloudProjects,
  darkMode,
  deliveryConfig,
  deliveryOpen,
  device,
  downloadProductionZip,
  duplicateProject,
  future,
  hasUnpublishedChanges,
  history,
  historyOpen,
  inspectorOpen,
  l,
  launchCenterOpen,
  leads,
  leadsOpen,
  leftSidebarOpen,
  liveVerification,
  loadCloudProject,
  mediaOpen,
  networkOnline,
  operationsOpen,
  previewWebsite,
  projectTeamAccess,
  publishBusy,
  publishedAt,
  publishedUrl,
  publishVersions,
  publishWebsite,
  qualityDiagnostics,
  redo,
  refreshBilling,
  releaseHistoryOpen,
  requireBillingFeature,
  resetProject,
  runAIQualityCheck,
  runV1LaunchChecks,
  saved,
  saveProject,
  setAnalyticsOpen,
  setBillingOpen,
  setDeliveryOpen,
  setDevice,
  setHistoryOpen,
  setInspectorOpen,
  setLaunchCenterOpen,
  setLeadsOpen,
  setLeftSidebarOpen,
  setMediaOpen,
  setOperationsOpen,
  setReleaseHistoryOpen,
  setSaved,
  setSiteName,
  setSiteUrl,
  siteName,
  siteUrl,
  stopAIQualityCheck,
  undo,
  unpublishWebsite,
  user,
  v1LaunchStatus,
  verifyLiveDeployment,
}: BuilderLegacyHeaderProps) {
  return (
<header data-tayar-v1-header="true"
        className={`flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 ${
          darkMode
            ? 'border-white/10 bg-[#0a0a1a]'
            : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/12">
            <Globe className="h-4 w-4 text-violet-400" />
          </div>

          <div>
            <h1 className="text-sm font-bold">{l('Website Builder')}</h1>
            <p className={`hidden text-[10px] lg:block ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {l('Build, preview and publish')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={siteName}
            onChange={(e) => {
              setSiteName(e.target.value);
              setSaved(false);
            }}
            className={`hidden md:block w-32 xl:w-36 rounded-lg border px-2.5 py-1.5 text-xs outline-none focus:border-violet-500 ${
              darkMode
                ? 'border-white/10 bg-white/5 text-white'
                : 'border-gray-200 bg-gray-50 text-gray-900'
            }`}
            placeholder={l('Website name')}
          />


          <div
            className={`flex rounded-lg border p-1 ${
              darkMode
                ? 'border-white/10 bg-white/5'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <button
              onClick={() => setDevice('desktop')}
              className={`rounded-md p-2 ${
                device === 'desktop'
                  ? 'bg-violet-600 text-white'
                  : darkMode
                    ? 'text-gray-400'
                    : 'text-gray-500'
              }`}
              title={l('Desktop preview')}
            >
              <Monitor className="h-4 w-4" />
            </button>            <button
              onClick={() => setDevice('tablet')}
              className={`rounded-md p-2 ${
                device === 'tablet'
                  ? 'bg-violet-600 text-white'
                  : darkMode
                    ? 'text-gray-400'
                    : 'text-gray-500'
              }`}
              title={l('Tablet preview')}
            >
              <Monitor className="h-4 w-4" />
            </button>

            <button
              onClick={() => setDevice('mobile')}
              className={`rounded-md p-2 ${
                device === 'mobile'
                  ? 'bg-violet-600 text-white'
                  : darkMode
                    ? 'text-gray-400'
                    : 'text-gray-500'
              }`}
              title={l('Mobile preview')}
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              const reopenPanels = !leftSidebarOpen && !inspectorOpen;
              setLeftSidebarOpen(reopenPanels);
              setInspectorOpen(reopenPanels);
            }}
            className={`flex items-center gap-2 rounded-lg border p-2 text-xs font-semibold transition ${darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-100'}`}
            title={l(!leftSidebarOpen && !inspectorOpen ? 'Show editing panels' : 'Focus on canvas')}
          >
            <Eye className="h-4 w-4" />
            <span className="hidden 2xl:inline">{l(!leftSidebarOpen && !inspectorOpen ? 'Panels' : 'Focus')}</span>
          </button>

          <button
            onClick={undo}
            disabled={!history.length}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold `}
            title={l('Undo')}
          >
            <RotateCcw className="h-4 w-4" /><span className="sr-only">{l('Undo')}</span></button>

          <button
            onClick={redo}
            disabled={!future.length}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold `}
            title={l('Redo')}
          >
            <RotateCcw className="h-4 w-4 rotate-180" /><span className="sr-only">{l('Redo')}</span></button>


          <details className="relative">
            <summary
              className={'flex cursor-pointer list-none items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-semibold [&::-webkit-details-marker]:hidden ' + (darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-100')}
              title={l('More website tools')}
            >
              {l('More')}
              <ChevronDown className="h-3.5 w-3.5" />
            </summary>
            <div className={'absolute right-0 top-11 z-[90] w-[min(92vw,430px)] rounded-2xl border p-3 shadow-2xl ' + (darkMode ? 'border-white/10 bg-[#0a0a1a] text-white' : 'border-gray-200 bg-white text-gray-900')}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold">{l('Website tools')}</p>
                  <p className="mt-0.5 text-[10px] text-gray-500">{l('Advanced tools stay here until you need them.')}</p>
                </div>
                <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-bold text-gray-500">{BILLING_PLAN_DETAILS[billingPlan].label}</span>
              </div>
              <div className={`mb-3 rounded-xl border p-2.5 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-gray-50'}`}>
                <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">{l('Project & domain')}</p>
                <input
                  value={siteUrl}
                  onChange={(e) => { setSiteUrl(e.target.value); setSaved(false); }}
                  placeholder="https://your-domain.com"
                  className={`w-full rounded-lg border px-2.5 py-2 text-[11px] outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-black/20 text-white' : 'border-gray-200 bg-white text-gray-900'}`}
                />
                {user && (
                  <select
                    value={cloudProjectId ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (!value) {
                        resetProject();
                        return;
                      }
                      void loadCloudProject(value);
                    }}
                    disabled={cloudBusy}
                    className={`mt-2 w-full rounded-lg border px-2.5 py-2 text-[11px] outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-[#111122] text-white' : 'border-gray-200 bg-white text-gray-900'}`}
                  >
                    <option value="">{l('Start a new website…')}</option>
                    {cloudProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}{project.user_id !== user.id ? ' · Shared' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMediaOpen((open) => !open)}
            disabled={!user}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
              mediaOpen
                ? 'border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-400'
                : darkMode
                  ? 'border-white/10 text-gray-300 hover:bg-white/5'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={!user ? 'Sign in to use the media library' : 'Open media library'}
          >
            <Images className="h-4 w-4" />{l("Media")}</button>

          <button
            onClick={() => setLeadsOpen((open) => !open)}
            disabled={!user || !cloudProjectId}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
              leadsOpen
                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                : darkMode
                  ? 'border-white/10 text-gray-300 hover:bg-white/5'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={!user ? 'Sign in to view leads' : !cloudProjectId ? 'Save this project to cloud first' : 'Open lead inbox'}
          >
            <Inbox className="h-4 w-4" />
            Leads
            {leads.filter((lead) => lead.status === 'new').length > 0 && (
              <span className="rounded-full bg-cyan-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                {leads.filter((lead) => lead.status === 'new').length}
              </span>
            )}
          </button>

          <button
            onClick={() => { if (requireBillingFeature('analytics', 'Site analytics')) setAnalyticsOpen((open) => !open); }}
            disabled={!user || !cloudProjectId}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
              analyticsOpen
                ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                : darkMode
                  ? 'border-white/10 text-gray-300 hover:bg-white/5'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={!user ? 'Sign in to view analytics' : !cloudProjectId ? 'Save this project to cloud first' : 'Open site analytics'}
          >
            <BarChart3 className="h-4 w-4" />{l('Analytics')}</button>

          <button
            onClick={() => { setLaunchCenterOpen((open) => !open); if (!launchCenterOpen) void runV1LaunchChecks(); }}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
              launchCenterOpen
                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                : v1LaunchStatus.preflightReady
                  ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                  : darkMode
                    ? 'border-white/10 text-gray-300 hover:bg-white/5'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={l('Website Builder V1 launch center')}
          >
            <Check className="h-4 w-4" />{l("Launch")}<span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black ${v1LaunchStatus.status === 'V1 LIVE' ? 'bg-emerald-500 text-white' : v1LaunchStatus.preflightReady ? 'bg-cyan-500 text-white' : 'bg-amber-500/20 text-amber-400'}`}>{v1LaunchStatus.score}</span>
          </button>

          <button
            onClick={() => { setBillingOpen((open) => !open); void refreshBilling(cloudProjectId); }}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
              billingOpen
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                : darkMode
                  ? 'border-white/10 text-gray-300 hover:bg-white/5'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={l('Plans, usage and billing')}
          >
            <Sparkles className="h-4 w-4" />
            {BILLING_PLAN_DETAILS[billingPlan].label}
          </button>

          <button
            onClick={() => setOperationsOpen((open) => !open)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
              operationsOpen
                ? 'border-sky-500 bg-sky-500/10 text-sky-400'
                : darkMode
                  ? 'border-white/10 text-gray-300 hover:bg-white/5'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={l('Operations, backups and exports')}
          >{l("Tools")}</button>

          <button
            onClick={() => { if (requireBillingFeature('clientDelivery', 'Client delivery workspace')) setDeliveryOpen((open) => !open); }}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
              deliveryOpen
                ? 'border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-400'
                : darkMode
                  ? 'border-white/10 text-gray-300 hover:bg-white/5'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={l('Client delivery, approval and handoff')}
          >{l("Delivery")}<span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase ${
              deliveryConfig.status === 'delivered' ? 'bg-emerald-500 text-white' : deliveryConfig.status === 'approved' ? 'bg-cyan-500 text-white' : 'bg-fuchsia-500/20 text-fuchsia-400'
            }`}>{deliveryConfig.status}</span>
          </button>

          <button
            onClick={() => setHistoryOpen((open) => !open)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
              historyOpen
                ? 'border-violet-500 bg-violet-600/10 text-violet-400'
                : darkMode
                  ? 'border-white/10 text-gray-300 hover:bg-white/5'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={l('Project history')}
          >
            <HistoryIcon className="h-4 w-4" />{l("History")}</button>

          <button
            onClick={() => { if (requireBillingFeature('releaseHistory', 'Release history and rollback')) setReleaseHistoryOpen((open) => !open); }}
            disabled={!user || !cloudProjectId}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
              releaseHistoryOpen
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                : darkMode
                  ? 'border-white/10 text-gray-300 hover:bg-white/5'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={!user ? 'Sign in to use release history' : !cloudProjectId ? 'Save this project to cloud first' : 'Publish releases, previews and rollback'}
          >
            Releases
            {publishVersions.length > 0 && <span className="rounded-full bg-indigo-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{publishVersions.length}</span>}
          </button>

          <button
            onClick={() => void duplicateProject()}
            disabled={cloudBusy}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
              darkMode
                ? 'border-white/10 text-gray-300 hover:bg-white/5'
                : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={l('Duplicate project')}
          >
            <Copy className="h-4 w-4" />{l('Duplicate')}</button>


              </div>
              <div className="mt-3 border-t border-white/10 pt-3">
                <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">{l('Project actions')}</p>
                <div className="flex flex-wrap gap-2">
          <button
            onClick={downloadProductionZip}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500"
          >
            <Download className="h-4 w-4" />{l("Export ZIP")}</button>

          <button
            onClick={resetProject}
            className={`rounded-lg border p-2 ${
              darkMode
                ? 'border-white/10 text-gray-400 hover:bg-white/5'
                : 'border-gray-200 text-gray-500 hover:bg-gray-100'
            }`}
            title={l('Reset')}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
          {publishedUrl && (
            <>
              <button
                onClick={() => window.open(publishedUrl, '_blank', 'noopener,noreferrer')}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                  darkMode
                    ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
                    : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                }`}
                title={publishedAt ? `Published ${new Date(publishedAt).toLocaleString()}` : 'Open published website'}
              >
                <ExternalLink className="h-4 w-4" />{l('Live')}</button>
              <button
                onClick={() => void verifyLiveDeployment()}
                disabled={liveVerification === 'checking'}
                className={`rounded-lg border px-2 py-2 text-[10px] font-semibold ${
                  liveVerification === 'healthy'
                    ? 'border-emerald-500/30 text-emerald-400'
                    : liveVerification === 'failed'
                      ? 'border-red-500/30 text-red-400'
                      : 'border-white/10 text-gray-400'
                }`}
                title={l('Verify that index.html exists in published storage')}
              >
                {liveVerification === 'checking' ? 'Checking…' : liveVerification === 'healthy' ? 'Live ✓' : liveVerification === 'failed' ? 'Check failed' : 'Verify'}
              </button>
              <button
                onClick={() => void unpublishWebsite()}
                disabled={publishBusy}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                  darkMode
                    ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                    : 'border-red-200 text-red-600 hover:bg-red-50'
                }`}
                title={l('Remove public website')}
              >{l("Unpublish")}</button>
            </>
          )}

          <span className={`inline-flex text-[11px] ${
            autoSaveStatus === 'saving'
              ? 'text-amber-400'
              : autoSaveStatus === 'saved'
                ? 'text-emerald-400'
                : autoSaveStatus === 'failed'
                  ? 'text-red-400'
                  : darkMode ? 'text-gray-500' : 'text-gray-400'
          }`}>
            {autoSaveStatus === 'saving' ? 'Autosaving…' : autoSaveStatus === 'saved' ? 'Autosaved' : autoSaveStatus === 'failed' ? 'Sync failed' : 'Autosave on'}
          </span>

          <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-bold ${networkOnline ? (qualityDiagnostics.healthy ? 'border-emerald-500/30 text-emerald-400' : 'border-amber-500/30 text-amber-400') : 'border-red-500/30 text-red-400'}`}>
            {networkOnline ? (qualityDiagnostics.healthy ? 'Health ✓' : 'Health warning') : 'Offline'}
          </span>


              </div>
            </div>
          </details>

          <button
            onClick={previewWebsite}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
              darkMode
                ? 'border-white/10 text-gray-300 hover:bg-white/5'
                : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ExternalLink className="h-4 w-4" /><span className="hidden 2xl:inline">{l('Preview')}</span></button>

          <button
            onClick={aiQualityBusy ? stopAIQualityCheck : () => void runAIQualityCheck()}
            disabled={aiBusy}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${aiQualityReview && aiQualityReview.score >= 80 ? 'border-emerald-500/30 text-emerald-400' : darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-100'}`}
            title={l('AI quality check before publishing')}
          >
            <Check className="h-4 w-4" />
            <span className="hidden 2xl:inline">{aiQualityBusy ? l('Stop check') : aiQualityReview ? `Check ${aiQualityReview.score}` : l('Check')}</span>
          </button>

          <button
            onClick={() => void saveProject()}
            disabled={cloudBusy}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${darkMode ? 'border-white/10 text-gray-200 hover:bg-white/5' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
            title={user ? 'Save locally and to your account' : 'Save locally'}
          >
            {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            <span className="hidden 2xl:inline">{saved ? 'Saved' : 'Save'}</span>
          </button>

          <button
            onClick={() => void publishWebsite()}
            disabled={!v1LaunchStatus.preflightReady || publishBusy || !projectTeamAccess.canPublish}
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            title={!projectTeamAccess.canPublish ? 'Only the project owner can publish shared projects' : !v1LaunchStatus.preflightReady ? v1LaunchStatus.blockers[0] || 'Complete the Launch Center checks before publishing' : 'Publish website'}
          >
            <Globe className="h-4 w-4" />
            {publishBusy ? 'Publishing…' : publishedUrl ? (hasUnpublishedChanges ? 'Publish Changes' : 'Republish') : 'Publish'}
            {hasUnpublishedChanges && !publishBusy && <span className="ml-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[8px] font-black text-slate-900">{l('DRAFT')}</span>}
          </button>




        </div>
      </header>
  );
}
