import { Plus } from 'lucide-react';
import type * as React from 'react';
import { SectionPreview } from '../components/SectionPreview';
import { SECTION_LABELS } from '../core/defaults';
import type { AIWebsiteCanvasPreview } from '../core/editor-ai-patch-review';
import type { CanvasSnapGuides } from '../core/editor-canvas-geometry';
import type { Device,SectionType,WebsiteElement,WebsiteElementType,WebsiteSection } from '../core/types';
import type { AIWebsiteCandidatePreview,WebsiteFooterConfig,WebsiteHeaderConfig,WebsitePage,WebsiteTheme } from '../core/website-builder-model';

interface BuilderLegacyCanvasProps {
  addElementToSection: (sectionId: string, type: WebsiteElementType) => void;
  aiCandidateApproveButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
  aiCandidatePreview: AIWebsiteCandidatePreview | null;
  aiCanvasPreview: AIWebsiteCanvasPreview | null;
  aiCanvasPreviewBanner: React.ReactElement | null;
  aiPatchApproveButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
  beginElementResize: (sectionId: string, elementId: string) => void;
  canvasActivePageId: string;
  canvasHeaderConfig: WebsiteHeaderConfig;
  canvasPages: WebsitePage[];
  canvasSections: WebsiteSection[];
  canvasSiteName: string;
  canvasSnapGuide: ({ sectionId: string; } & CanvasSnapGuides) | null;
  canvasTheme: WebsiteTheme;
  darkMode: boolean;
  deleteSection: (id: string) => void;
  deleteSelectedElement: () => void;
  device: Device;
  draggedElementId: string | null;
  draggedId: string | null;
  dragOverElementId: string | null;
  dragOverElementPosition: "before" | "after" | null;
  dragOverId: string | null;
  dragOverSectionPosition: "before" | "after" | null;
  duplicateSelectedElement: () => void;
  endElementResize: () => void;
  footerConfig: WebsiteFooterConfig;
  handleDragEnd: () => void;
  handleDragOver: (e: React.DragEvent, targetId: string) => void;
  handleDragStart: (id: string, e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, _targetId: string) => void;
  handleElementDragEnd: () => void;
  handleElementDragMove: (sectionId: string, id: string, e: React.DragEvent) => void;
  handleElementDragOver: (targetSectionId: string, targetId: string, e: React.DragEvent) => void;
  handleElementDragStart: (sectionId: string, id: string, e: React.DragEvent) => void;
  handleElementDrop: (targetSectionId: string, targetId: string, e: React.DragEvent) => void;
  handleElementPointerDragStart: (sectionId: string, id: string, e: React.PointerEvent<HTMLElement>) => void;
  insertSectionAfter: (afterSectionId: string, type: SectionType) => void;
  l: (text: string) => string;
  moveSection: (id: string, direction: "up" | "down") => void;
  quickUpdateElement: (sectionId: string, elementId: string, changes: Partial<WebsiteElement>) => void;
  resetElementPosition: (sectionId: string, elementId: string) => void;
  resizeElementFrame: (sectionId: string, elementId: string, frame: { width: number; positionX?: number; }) => void;
  selectCanvasElement: (sectionId: string, elementId: string, additive?: boolean, range?: boolean) => void;
  selectCanvasElements: (sectionId: string, elementIds: string[], additive?: boolean) => void;
  selectedElementId: string | null;
  selectedElementIds: string[];
  selectedId: string | null;
  selectEditorTarget: (sectionId: string | null, elementId?: string | null, containerId?: string | null, formFieldId?: string | null) => void;
  setInspectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMediaOpen: React.Dispatch<React.SetStateAction<boolean>>;
  updateInlineElementContent: (sectionId: string, elementId: string, content: string) => void;
  updateInlineElementSource: (sectionId: string, elementId: string, src: string) => void;
}

export function BuilderLegacyCanvas({
  addElementToSection,
  aiCandidateApproveButtonRef,
  aiCandidatePreview,
  aiCanvasPreview,
  aiCanvasPreviewBanner,
  aiPatchApproveButtonRef,
  beginElementResize,
  canvasActivePageId,
  canvasHeaderConfig,
  canvasPages,
  canvasSections,
  canvasSiteName,
  canvasSnapGuide,
  canvasTheme,
  darkMode,
  deleteSection,
  deleteSelectedElement,
  device,
  draggedElementId,
  draggedId,
  dragOverElementId,
  dragOverElementPosition,
  dragOverId,
  dragOverSectionPosition,
  duplicateSelectedElement,
  endElementResize,
  footerConfig,
  handleDragEnd,
  handleDragOver,
  handleDragStart,
  handleDrop,
  handleElementDragEnd,
  handleElementDragMove,
  handleElementDragOver,
  handleElementDragStart,
  handleElementDrop,
  handleElementPointerDragStart,
  insertSectionAfter,
  l,
  moveSection,
  quickUpdateElement,
  resetElementPosition,
  resizeElementFrame,
  selectCanvasElement,
  selectCanvasElements,
  selectedElementId,
  selectedElementIds,
  selectedId,
  selectEditorTarget,
  setInspectorOpen,
  setMediaOpen,
  updateInlineElementContent,
  updateInlineElementSource,
}: BuilderLegacyCanvasProps) {
  return (
<main data-tayar-v1-canvas="true"
          className={`min-h-[600px] flex-1 overflow-auto p-3 lg:p-5 ${
            darkMode ? 'bg-[#050914]' : 'bg-[#f3f4f6]'
          }`}
        >
          {aiCanvasPreviewBanner}
          <div
            aria-disabled={aiCanvasPreview ? true : undefined}
            onFocusCapture={(event) => {
              if (!aiCanvasPreview) return;
              event.stopPropagation();
              (aiCandidatePreview ? aiCandidateApproveButtonRef : aiPatchApproveButtonRef).current?.focus();
            }}
            className={`mx-auto overflow-hidden rounded-xl border shadow-xl transition-all duration-200 ${aiCanvasPreview ? 'pointer-events-none select-none' : ''} ${
              device === 'mobile' ? 'max-w-[390px]' : device === 'tablet' ? 'max-w-[768px]' : 'w-full max-w-6xl'
            } ${aiCanvasPreview?.global ? 'ring-2 ring-violet-400 shadow-[0_0_32px_rgba(139,92,246,0.25)]' : ''} ${darkMode ? 'border-white/10 bg-[#0f172a]' : 'border-gray-200 bg-white'}`}
            style={{ fontFamily: `${canvasTheme.fontFamily}, Arial, sans-serif` }}
          >
            {canvasHeaderConfig.enabled && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3" style={{ background: canvasHeaderConfig.backgroundColor, color: canvasHeaderConfig.textColor, borderColor: canvasHeaderConfig.borderColor }}>
                <div className="flex min-w-0 items-center gap-2 font-bold" style={{ fontSize: `${canvasHeaderConfig.brandSize}px` }}>
                  {canvasHeaderConfig.logoUrl && <img src={canvasHeaderConfig.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />}
                  <span className="truncate">{canvasHeaderConfig.brandText.trim() || canvasSiteName}</span>
                </div>
                {device === 'mobile' && canvasHeaderConfig.mobileMenu ? (
                  <div className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[10px] font-bold" style={{ color: canvasHeaderConfig.textColor, borderColor: canvasHeaderConfig.borderColor }}>☰ Menu</div>
                ) : (
                  <div className="flex flex-wrap items-center justify-end text-[10px]" style={{ color: canvasHeaderConfig.textColor, gap: `${canvasHeaderConfig.navGap}px`, fontSize: `${canvasHeaderConfig.navSize}px` }}>
                    {canvasPages.filter((page) => page.showInNavigation !== false).map((page) => <span key={page.id} className={page.id === canvasActivePageId ? 'font-bold' : ''} style={{ color: page.id === canvasActivePageId ? canvasHeaderConfig.activeColor : canvasHeaderConfig.textColor }}>{page.name}</span>)}
                    {canvasHeaderConfig.showCta && <span className="px-2.5 py-1.5 font-bold" style={{ background: canvasHeaderConfig.ctaBackgroundColor, color: canvasHeaderConfig.ctaTextColor, borderRadius: `${canvasTheme.buttonRadius}px` }}>{canvasHeaderConfig.ctaLabel}</span>}
                  </div>
                )}
              </div>
            )}
            {canvasSections.map((section, sectionIndex) => (
  <div
    key={section.id}
    onDragStart={(e) => handleDragStart(section.id, e)}
    onDragOver={(e) => handleDragOver(e, section.id)}
    onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, section.id)}
              draggable={true}
    className={`relative transition-all duration-150 ${
      draggedId === section.id ? 'scale-[0.995] opacity-45' : 'opacity-100'
      }
    }`}
  >
    {dragOverId === section.id && dragOverSectionPosition && draggedId !== section.id && (
      <span className={`pointer-events-none absolute left-2 right-2 z-[60] h-1 rounded-full bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.8)] ${dragOverSectionPosition === 'before' ? '-top-0.5' : '-bottom-0.5'}`} />
    )}
    <SectionPreview
      section={section}
      selected={selectedId === section.id}
      selectedElementId={selectedId === section.id ? selectedElementId : null}
      selectedElementIds={selectedId === section.id ? selectedElementIds : []}
      onSelect={() => selectEditorTarget(section.id)}
      onSelectElement={(elementId, additive, range) => selectCanvasElement(section.id, elementId, additive, range)}
      onMarqueeSelect={(elementIds, additive) => selectCanvasElements(section.id, elementIds, additive)}
      draggedElementId={draggedElementId}
      dragOverElementId={dragOverElementId}
      dragOverElementPosition={dragOverElementPosition}
      snapGuides={canvasSnapGuide?.sectionId === section.id ? canvasSnapGuide : null}
      onElementDragStart={(elementId, e) => handleElementDragStart(section.id, elementId, e)}
      onElementDragMove={(elementId, e) => handleElementDragMove(section.id, elementId, e)}
      onElementPointerDragStart={(elementId, e) => handleElementPointerDragStart(section.id, elementId, e)}
      onElementDragOver={(elementId, e) => handleElementDragOver(section.id, elementId, e)}
      onElementDrop={(elementId, e) => handleElementDrop(section.id, elementId, e)}
      onElementDragEnd={handleElementDragEnd}
      onResizeElementStart={(elementId) => beginElementResize(section.id, elementId)}
      onResizeElementFrame={(elementId, frame) => resizeElementFrame(section.id, elementId, frame)}
      onResizeElementEnd={endElementResize}
      onResetElementPosition={(elementId) => resetElementPosition(section.id, elementId)}
      onQuickUpdateElement={(elementId, changes) => quickUpdateElement(section.id, elementId, changes)}
      onOpenMediaLibrary={() => { selectEditorTarget(section.id); setMediaOpen(true); }}
      onOpenInspector={() => setInspectorOpen(true)}
      onDuplicateSelectedElement={duplicateSelectedElement}
      onDeleteSelectedElement={deleteSelectedElement}
      onInlineContentChange={(elementId, content) => updateInlineElementContent(section.id, elementId, content)}
      onInlineSourceChange={(elementId, src) => updateInlineElementSource(section.id, elementId, src)}
      onAddElement={(type) => addElementToSection(section.id, type)}
      onMoveSection={(direction) => moveSection(section.id, direction)}
      onDeleteSection={() => deleteSection(section.id)}
      canMoveSectionUp={sectionIndex > 0}
      canMoveSectionDown={sectionIndex < canvasSections.length - 1}
      canDeleteSection={canvasSections.length > 1}
      device={device}
      theme={canvasTheme}
      aiPreview={aiCanvasPreview}
    />
    <div data-tayar-v1-root="true"
      className="group/add-section relative flex h-8 items-center justify-center"
      draggable={false}
      onDragStart={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="h-px w-full bg-violet-500/0 transition group-hover/add-section:bg-violet-500/20" />
      <details className="absolute z-40">
        <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full border border-violet-400/20 bg-[#111122]/90 px-2.5 py-1 text-[9px] font-bold text-violet-300 opacity-60 shadow transition hover:opacity-100 [&::-webkit-details-marker]:hidden">
          <Plus className="h-3 w-3" /> {l('Add section')}
        </summary>
        <div className="absolute left-1/2 top-7 z-50 grid w-56 -translate-x-1/2 grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#111122] p-2 shadow-2xl">
          {(Object.keys(SECTION_LABELS) as SectionType[]).map((type) => (
            <button key={type} type="button" onClick={() => insertSectionAfter(section.id, type)} className="rounded-lg px-2 py-2 text-left text-[10px] font-semibold text-gray-200 hover:bg-white/10">
              + {SECTION_LABELS[type]}
            </button>
          ))}
        </div>
      </details>
    </div>
  </div>
))}
            {footerConfig.enabled && (
              <div className="border-t border-white/10 px-5 py-5" style={{ background: canvasTheme.secondaryColor, color: canvasTheme.textColor }}>
                <div className="flex flex-wrap items-start justify-between gap-4 text-[10px]">
                  <div><p className="font-bold">{canvasHeaderConfig.brandText.trim() || canvasSiteName}</p><p className="mt-1" style={{ color: canvasTheme.mutedTextColor }}>{footerConfig.text.trim() || `© ${new Date().getFullYear()} ${canvasSiteName}. All rights reserved.`}</p></div>
                  {footerConfig.showNavigation && <div className="flex flex-wrap gap-3" style={{ color: canvasTheme.mutedTextColor }}>{canvasPages.filter((page) => page.showInNavigation !== false).map((page) => <span key={page.id}>{page.name}</span>)}</div>}
                  <div className="flex flex-wrap gap-3" style={{ color: canvasTheme.mutedTextColor }}>{footerConfig.instagramUrl && <span>Instagram</span>}{footerConfig.facebookUrl && <span>Facebook</span>}{footerConfig.linkedinUrl && <span>LinkedIn</span>}{footerConfig.xUrl && <span>X</span>}</div>
                </div>
              </div>
            )}
          </div>
        </main>
  );
}
