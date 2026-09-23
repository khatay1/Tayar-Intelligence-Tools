import type * as React from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { SECTION_LABELS } from '../core/defaults';
import type { AIQualityReview } from '../core/editor-ai-patch-review';
import type { WebsiteElement,WebsiteSection } from '../core/types';
import type { BillingFeature,WebsiteClipboard,WebsitePage } from '../core/website-builder-model';

interface BuilderLegacyCommandPaletteProps {
  arrangeSelectedElements: (action: "left" | "center" | "right" | "top" | "middle" | "bottom" | "distribute-horizontal" | "distribute-vertical") => void;
  canPasteCopiedTarget: () => boolean;
  closeCommandPalette: () => void;
  cloudProjectId: string | null;
  commandQuery: string;
  copySelectedTarget: () => void;
  createContainerForSelected: () => void;
  cutSelectedTarget: () => void;
  darkMode: boolean;
  desktopShortcutActionsRef: React.MutableRefObject<{ busy: boolean; save: () => Promise<boolean>; undo: () => void; redo: () => void; preview: () => void; }>;
  downloadClientHandoffZip: () => void;
  duplicateActivePage: () => void;
  editorClipboard: WebsiteClipboard | null;
  exportAuditReport: () => void;
  exportProjectBackup: () => void;
  exportV1LaunchReport: () => void;
  handleCommandDialogKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  handleCommandInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  handleCommandItemKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  importProjectBackup: () => void;
  l: (text: string) => string;
  moveSelectedElementsLayer: (destination: "front" | "forward" | "backward" | "back") => void;
  normalizeSelectedElementFrames: (action: "match-width" | "match-appearance" | "reset-position" | "show" | "hide") => void;
  pages: WebsitePage[];
  pasteCopiedTarget: () => void;
  previewWebsite: () => void;
  recoveryAvailable: boolean;
  refreshBilling: (projectId?: string | null, expectedLoadSequence?: number) => Promise<void>;
  requireBillingFeature: (feature: BillingFeature, label: string) => boolean;
  restoreRecoverySnapshot: () => void;
  runAIQualityCheck: () => Promise<AIQualityReview | null>;
  runV1LaunchChecks: () => Promise<void>;
  saveProject: (options?: { automatic?: boolean; createHistory?: boolean; forPublication?: boolean; }) => Promise<boolean>;
  sections: WebsiteSection[];
  selectAllCanvasElements: () => void;
  selectedElement: WebsiteElement | null;
  selectedElements: WebsiteElement[];
  selectedSection: WebsiteSection | null;
  selectRelatedCanvasElements: (scope: "type" | "container") => void;
  setAnalyticsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setBillingOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCommandQuery: React.Dispatch<React.SetStateAction<string>>;
  setDeliveryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLaunchCenterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLeadsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  switchPage: (pageId: string) => void;
  ungroupSelectedElements: () => void;
}

export function BuilderLegacyCommandPalette({
  arrangeSelectedElements,
  canPasteCopiedTarget,
  closeCommandPalette,
  cloudProjectId,
  commandQuery,
  copySelectedTarget,
  createContainerForSelected,
  cutSelectedTarget,
  darkMode,
  desktopShortcutActionsRef,
  downloadClientHandoffZip,
  duplicateActivePage,
  editorClipboard,
  exportAuditReport,
  exportProjectBackup,
  exportV1LaunchReport,
  handleCommandDialogKeyDown,
  handleCommandInputKeyDown,
  handleCommandItemKeyDown,
  importProjectBackup,
  l,
  moveSelectedElementsLayer,
  normalizeSelectedElementFrames,
  pages,
  pasteCopiedTarget,
  previewWebsite,
  recoveryAvailable,
  refreshBilling,
  requireBillingFeature,
  restoreRecoverySnapshot,
  runAIQualityCheck,
  runV1LaunchChecks,
  saveProject,
  sections,
  selectAllCanvasElements,
  selectedElement,
  selectedElements,
  selectedSection,
  selectRelatedCanvasElements,
  setAnalyticsOpen,
  setBillingOpen,
  setCommandQuery,
  setDeliveryOpen,
  setLaunchCenterOpen,
  setLeadsOpen,
  setSelectedElementId,
  setSelectedId,
  switchPage,
  ungroupSelectedElements,
}: BuilderLegacyCommandPaletteProps) {
  return (
<div className="fixed inset-0 z-[250] flex items-start justify-center bg-black/70 px-4 pt-[10vh] backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) closeCommandPalette(); }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={l('Command palette')}
            aria-busy={desktopShortcutActionsRef.current.busy}
            onKeyDown={handleCommandDialogKeyDown}
            className={`w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl ${darkMode ? 'border-white/10 bg-[#0b0f18]' : 'border-gray-200 bg-white'}`}
          >
            <div className="border-b border-white/10 p-3">
              <input autoFocus type="search" data-command-focus value={commandQuery} onChange={(e) => setCommandQuery(e.target.value)} onKeyDown={handleCommandInputKeyDown} aria-label={l('Type a command, page or section…')} placeholder={l('Type a command, page or section…')} className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-sky-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-gray-50 text-gray-900'}`} />
            </div>
            <div className="max-h-[60vh] overflow-auto p-2">
              {[
                { label: 'Save project', keywords: 'save cloud', mutates: true, run: () => void saveProject() },
                { label: 'Preview website', keywords: 'preview open', run: previewWebsite },
                { label: 'Run AI quality check', keywords: 'check quality seo accessibility publish', mutates: true, run: () => void runAIQualityCheck() },
                ...(selectedSection ? [{ label: 'Select all elements in section', keywords: 'select all section elements', run: selectAllCanvasElements }] : []),
                ...(selectedElement && selectedSection && selectedSection.elements.filter((element) => element.type === selectedElement.type).length > 1 ? [{ label: 'Select elements of same type', keywords: `select matching ${selectedElement.type}`, run: () => selectRelatedCanvasElements('type') }] : []),
                ...(selectedElement?.containerId && selectedSection && selectedSection.elements.filter((element) => element.containerId === selectedElement.containerId).length > 1 ? [{ label: 'Select all elements in group', keywords: 'select container group members', run: () => selectRelatedCanvasElements('container') }] : []),
                ...(selectedSection ? [{ label: selectedElements.length > 1 ? 'Copy selected elements' : selectedElement ? 'Copy selected element' : 'Copy selected section', keywords: 'copy clipboard elements section', run: copySelectedTarget }] : []),
                ...(selectedSection ? [{ label: selectedElements.length > 1 ? 'Cut selected elements' : selectedElement ? 'Cut selected element' : 'Cut selected section', keywords: 'cut clipboard elements section', mutates: true, run: cutSelectedTarget }] : []),
                ...(selectedElements.length > 1 ? [{ label: 'Group selected elements', keywords: 'group container selected elements', mutates: true, run: createContainerForSelected }] : []),
                ...(selectedElements.length > 1 && selectedElements.some((element) => element.containerId) ? [{ label: 'Ungroup selected elements', keywords: 'ungroup detach container selected elements', mutates: true, run: ungroupSelectedElements }] : []),
                ...(selectedElements.length > 1 ? [
                  { label: 'Match selected widths', keywords: 'size width equal match selection', mutates: true, run: () => normalizeSelectedElementFrames('match-width') },
                  { label: 'Match selected appearance', keywords: 'style appearance colors typography match selection', mutates: true, run: () => normalizeSelectedElementFrames('match-appearance') },
                  { label: 'Reset selected transforms', keywords: 'reset position rotate selection', mutates: true, run: () => normalizeSelectedElementFrames('reset-position') },
                  { label: 'Align selected left', keywords: 'align left selection', mutates: true, run: () => arrangeSelectedElements('left') },
                  { label: 'Align selected center', keywords: 'align horizontal center selection', mutates: true, run: () => arrangeSelectedElements('center') },
                  { label: 'Align selected top', keywords: 'align top selection', mutates: true, run: () => arrangeSelectedElements('top') },
                  { label: 'Align selected middle', keywords: 'align vertical middle selection', mutates: true, run: () => arrangeSelectedElements('middle') },
                ] : []),
                ...(selectedElements.length ? [
                  { label: 'Bring selection to front', keywords: 'layer order front selection', mutates: true, run: () => moveSelectedElementsLayer('front') },
                  { label: 'Bring selection forward', keywords: 'layer order forward selection', mutates: true, run: () => moveSelectedElementsLayer('forward') },
                  { label: 'Send selection backward', keywords: 'layer order backward selection', mutates: true, run: () => moveSelectedElementsLayer('backward') },
                  { label: 'Send selection to back', keywords: 'layer order back selection', mutates: true, run: () => moveSelectedElementsLayer('back') },
                  { label: 'Show selected elements', keywords: 'visibility show selection', mutates: true, run: () => normalizeSelectedElementFrames('show') },
                  { label: 'Hide selected elements', keywords: 'visibility hide selection', mutates: true, run: () => normalizeSelectedElementFrames('hide') },
                ] : []),
                ...(canPasteCopiedTarget() ? [{ label: editorClipboard?.kind === 'section' ? 'Paste copied section' : editorClipboard?.kind === 'elements' ? 'Paste copied elements' : 'Paste copied element', keywords: 'paste clipboard elements section', mutates: true, run: pasteCopiedTarget }] : []),
                { label: 'Duplicate current page', keywords: 'copy page duplicate', mutates: true, run: duplicateActivePage },
                { label: 'Export project backup', keywords: 'backup json export', run: exportProjectBackup },
                { label: 'Import project backup', keywords: 'backup json import restore', mutates: true, run: importProjectBackup },
                ...(recoveryAvailable ? [{ label: 'Restore recovery snapshot', keywords: 'recovery crash restore safety', mutates: true, run: restoreRecoverySnapshot }] : []),
                { label: 'Export audit report', keywords: 'audit seo accessibility', run: exportAuditReport },
                { label: 'Open V1 launch center', keywords: 'launch production go live checklist onboarding readiness', run: () => { setLaunchCenterOpen(true); void runV1LaunchChecks(); } },
                { label: 'Export V1 launch report', keywords: 'launch report final production', run: exportV1LaunchReport },
                { label: 'Open plans & billing', keywords: 'billing plan upgrade subscription usage stripe', run: () => { setBillingOpen(true); void refreshBilling(cloudProjectId); } },
                { label: 'Open client delivery', keywords: 'client delivery handoff approval launch', run: () => { if (requireBillingFeature('clientDelivery', 'Client delivery workspace')) setDeliveryOpen(true); } },
                { label: 'Download client handoff ZIP', keywords: 'client delivery handoff export zip', run: downloadClientHandoffZip },
                { label: 'Open leads', keywords: 'leads inbox contacts', run: () => setLeadsOpen(true) },
                { label: 'Open analytics', keywords: 'analytics stats traffic', run: () => { if (requireBillingFeature('analytics', 'Site analytics')) setAnalyticsOpen(true); } },
                ...pages.map((page) => ({ label: `Go to page: ${page.name}`, keywords: `page ${page.slug}`, run: () => switchPage(page.id) })),
                ...sections.map((section) => ({ label: `Select section: ${section.title || SECTION_LABELS[section.type]}`, keywords: `section ${section.type} ${section.anchorId || ''}`, run: () => { setSelectedId(section.id); setSelectedElementId(section.elements[0]?.id ?? null); } })),
              ].filter((item) => !commandQuery.trim() || `${l(item.label)} ${item.keywords}`.toLowerCase().includes(commandQuery.trim().toLowerCase())).slice(0, 24).map((item) => (
                <button
                  key={`${l(item.label)}-${item.keywords}`}
                  type="button"
                  data-command-item
                  data-command-focus
                  disabled={'mutates' in item && item.mutates === true && desktopShortcutActionsRef.current.busy}
                  onKeyDown={handleCommandItemKeyDown}
                  onClick={() => { item.run(); closeCommandPalette(); }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs ${darkMode ? 'text-gray-200 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-100'}`}><span>{l(item.label)}</span><span className="text-[9px] text-gray-500">↵</span></button>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-white/10 px-3 py-2 text-[10px] text-gray-500"><span>{l('Ctrl/Cmd+K · Ctrl/Cmd+C/X/V')}</span><button type="button" data-command-focus onClick={closeCommandPalette} className="font-semibold text-violet-400">{l('Close')}</button></div>
          </div>
        </div>
  );
}
