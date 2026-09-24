import {
Check,
Upload
} from 'lucide-react';
import { SECTION_LABELS } from '../core/defaults';
import {
type DeliveryStatus
} from '../core/delivery-config';
import type { EditorPageLike,EditorSymbolLike } from '../core/editor-model';
import type { Device,WebsiteCmsBinding } from '../core/types';
import type { useWebsiteBuilderController } from '../core/use-website-builder-controller';
import { normalizeWebsiteCms } from '../core/website-cms';
import { BuilderAiPanel } from './BuilderAiPanel';
import { BuilderCmsPanel } from './BuilderCmsPanel';
import { BuilderLegacyAnalytics } from './BuilderLegacyAnalytics';
import { BuilderLegacyBilling } from './BuilderLegacyBilling';
import { BuilderLegacyCanvas } from './BuilderLegacyCanvas';
import { BuilderLegacyCommandPalette } from './BuilderLegacyCommandPalette';
import { BuilderLegacyHeader } from './BuilderLegacyHeader';
import { BuilderLegacyInspector } from './BuilderLegacyInspector';
import { BuilderLegacyLaunchCenter } from './BuilderLegacyLaunchCenter';
import { BuilderLegacyLeads } from './BuilderLegacyLeads';
import { BuilderLegacyReleaseHistory } from './BuilderLegacyReleaseHistory';
import { BuilderLegacySidebar } from './BuilderLegacySidebar';
import { BuilderSettingsPanel } from './BuilderSettingsPanel';
import { BuilderSitePanel } from './BuilderSitePanel';
import { BuilderV2Canvas } from './BuilderV2Canvas';
import { WebsiteBuilderV2Bridge } from './WebsiteBuilderV2Bridge';
import { WebsiteCollaborationPanel } from './WebsiteCollaborationPanel';

type WebsiteBuilderView = ReturnType<typeof useWebsiteBuilderController>;

export function WebsiteBuilderPresentation(view: WebsiteBuilderView) {
  const {
    aiBusy, aiCandidateActiveOperations, aiCandidateApproveButtonRef, aiCandidateCanShowAfter, aiCandidateCanShowBefore, aiCandidateGlobalOperations, aiCandidatePreview, aiCandidateReviewedOperationCount,
    aiCandidateReviewedPageCount, aiCandidateReviewPages, aiCandidateTargetableOperations, aiEditScope, aiEditScopeOptions, aiError, aiIntent, aiMessages,
    aiPatchApproveButtonRef, aiPatchReview, aiPlan, aiPlanApproveButtonRef, aiPlanReview, aiPreparedFollowUpRef, aiPrompt, aiQualityBusy,
    aiQualityReview, aiSelectedDestructiveCount, aiStageStatus, aiUndoSnapshot, approveAICandidatePreview, l, moveAICandidatePreviewPage, previewAICandidatePage,
    previewNextUnreviewedAICandidateOperation, previewNextUnreviewedAICandidatePage, resolveAICandidatePreview, resolveAIPatchReview, resolveAIPlanReview, revealAdjacentAICandidateOperation, revealAICandidateOperation, runAIQualityCheck,
    setAICandidatePreviewMode, setAiEditScope, setAiIntent, setAiPrompt, stopAIQualityCheck, stopAIRequest, submitV2AIRequest, toggleAIPatchReviewOperation,
    undoLastAIChange, v2AiMessagesEndRef, cms, activePage, selectedElement, cloudBusy, publishBusy, cmsIssues,
    remember, sections, setCms, setSaved, updateSelectedElement, setPages, activePageId, applyDesignSystemPreset,
    checkCustomDomain, cloudProjectId, connectCustomDomain, customDomain, customDomainBusy, customDomainDraft, customDomainError, designSystemReport,
    faviconUrl, footerConfig, headerConfig, localization, localizationIssues, projectTeamAccess, removeCustomDomain, repairActiveDesignSystem,
    setCustomDomainDraft, setFaviconUrl, setFooterConfig, setHeaderConfig, setLocalization, setSiteEnhancements, setSiteName, setSiteUrl,
    setTheme, siteEnhancements, siteName, siteUrl, theme, billingEntitlements, cloudError, hasUnpublishedChanges,
    launchCheckBusy, launchLastCheckedAt, liveVerification, productionConfig, publishBlocker, publishedAt, publishedUrl, publishError,
    publishWebsite, requireBillingFeature, runV1LaunchChecks, seo, setDeliveryOpen, setProductionConfig, setReleaseHistoryOpen, setSeo,
    siteAudit, unpublishWebsite, verifyLiveDeployment, aiCanvasPreview, aiCandidateShowingBefore, addElementToSection, beginElementResize, canvasActivePageId,
    canvasHeaderConfig, canvasPages, canvasSections, canvasSiteName, canvasSnapGuide, canvasTheme, darkMode, deleteSection,
    deleteSelectedElement, device, draggedElementId, draggedId, dragOverElementId, dragOverElementPosition, dragOverId, dragOverSectionPosition,
    duplicateSelectedElement, endElementResize, handleDragEnd, handleDragOver, handleDragStart, handleDrop, handleElementDragEnd, handleElementDragMove,
    handleElementDragOver, handleElementDragStart, handleElementDrop, handleElementPointerDragStart, moveSection, quickUpdateElement, resetElementPosition, resizeElementFrame,
    selectCanvasElement, selectCanvasElements, selectedElementId, selectedElementIds, selectedId, selectEditorTarget, setInspectorOpen, setMediaOpen,
    updateInlineElementContent, updateInlineElementSource, saveProject, previewWebsite, selectedSection, selectAllCanvasElements, selectRelatedCanvasElements, selectedElements,
    copySelectedTarget, cutSelectedTarget, createContainerForSelected, ungroupSelectedElements, normalizeSelectedElementFrames, arrangeSelectedElements, moveSelectedElementsLayer, canPasteCopiedTarget,
    editorClipboard, pasteCopiedTarget, duplicateActivePage, exportProjectBackup, importProjectBackup, recoveryAvailable, restoreRecoverySnapshot, exportAuditReport,
    setLaunchCenterOpen, exportV1LaunchReport, setBillingOpen, refreshBilling, downloadClientHandoffZip, setLeadsOpen, setAnalyticsOpen, pages,
    switchPage, setSelectedId, setSelectedElementId, commandQuery, commandOpen, closeCommandPalette, desktopShortcutActionsRef, handleCommandDialogKeyDown,
    setCommandQuery, handleCommandInputKeyDown, handleCommandItemKeyDown, analyticsOpen, autoSaveStatus, billingOpen, billingPlan, cloudProjects,
    deliveryConfig, deliveryOpen, downloadProductionZip, duplicateProject, future, history, historyOpen, inspectorOpen,
    launchCenterOpen, leads, leadsOpen, leftSidebarOpen, loadCloudProject, mediaOpen, networkOnline, operationsOpen,
    publishVersions, qualityDiagnostics, redo, releaseHistoryOpen, resetProject, saved, setDevice, setHistoryOpen,
    setLeftSidebarOpen, setOperationsOpen, undo, user, v1LaunchStatus, aiQualityOpen, setAiQualityOpen, fixAIQualityIssues,
    applyPageTemplate, closeLaunchCenter, cloudSyncFailed, launchManualChecks, setLaunchManualCheck, analyticsEvents, billingBusy, billingError,
    billingLoading, billingState, openBillingPortal, startBillingCheckout, previewUrl, setDeliveryConfig, launchReadiness, deliveryUsage,
    approvalCurrent, approveForDelivery, clearDeliveryApproval, markProjectDelivered, exportDeliveryReport, setCommandOpen, copyProjectSummary, copied,
    exportLeadsCsv, exportAnalyticsCsv, markAllLeadsRead, archiveReadLeads, analyticsError, analyticsLoading, analyticsSummary, refreshAnalytics,
    mediaUploading, uploadMediaFile, refreshMedia, mediaLoading, mediaError, mediaAssets, applyMediaAsset, updateActivePageMeta,
    deleteMediaAsset, bulkUpdateLeadStage, copyLeadSummary, deleteLead, filteredLeads, formDeliveries, leadCrmSummary, leadQuery,
    leadsError, leadsLoading, leadStageFilter, leadStatusFilter, openWebsiteFormUpload, refreshLeads, selectedLeadIds, setLeadQuery,
    setLeadStageFilter, setLeadStatusFilter, setSelectedLeadIds, updateLeadCrm, updateLeadStatus, createSharePreview, currentAIEditableFingerprint, deletePublishVersion,
    lastPublishedVersionId, previewBusy, previewCreatedAt, previewError, previewFingerprint, promoteSharePreviewToLive, publishVersionsError, publishVersionsLoading,
    refreshPublishVersions, releaseDiffSummary, releaseNote, restorePublishVersionToEditor, revokeSharePreview, rollbackPublishVersion, setReleaseNote, projectHistory,
    restoreHistoryEntry, addElement, addPage, addSection, addSectionTemplate, advancedSiteSettingsOpen, aiStage, applyAIChange,
    applyThemeToAllPages, applyThemeToCurrentPage, builderPanel, copyHtml, deleteActivePage, deleteReusableSection, duplicatePageAsTranslation, generateRealImage,
    generateWithAI, homePageId, insertReusableSection, makeActivePageHome, movePage, openBillingWithMessage, pageSettingsOpen, prefs,
    reusableBusy, reusableError, reusableSections, saveSelectedSectionAsReusable, setAdvancedSiteSettingsOpen, setAiError, setAiStage, setBuilderPanel,
    setPageSettingsOpen, insertSectionAfter, addFormAutomation, addFormField, assignSelectedToContainer, copySelectedElementResponsiveFrom, copySelectedSectionResponsiveFrom, createSymbolFromSelected,
    deleteFormAutomation, deleteFormField, deleteSelectedContainer, deleteSymbol, detachSelectedSymbol, generateImagePrompt, insertSymbol, moveFormField,
    moveSelectedElement, resetContactForm, resetSelectedElementResponsive, resetSelectedSectionResponsive, sectionSettingsOpen, selectedContainer, setSectionSettingsOpen, setSelectedSectionLayout,
    symbols, updateFormAutomation, updateFormField, updateSelected, updateSelectedContainer, updateSelectedSectionResponsive, getCurrentPages, editorV2Flags,
    duplicateSelectedTarget, deleteSelectedTarget, renameSymbol, duplicateSymbol, selectNextSymbolInstance, openV2MediaUpload, generateMediaLibraryImage, v2DuplicateSectionDirect,
    v2MoveElementDirect, v2DuplicateElementDirect, v2DeleteElementDirect, applyV2NativeOperations, restoreEditHistoryEntry, brand, selectedContainerId, selectedFormFieldId,
    hasUnsavedChanges, cmsErrors, clearEditorDragState,
  } = view;
  const v2AiPanel = (
    <BuilderAiPanel
      aiBusy={aiBusy}
      aiCandidateActiveOperations={aiCandidateActiveOperations}
      aiCandidateApproveButtonRef={aiCandidateApproveButtonRef}
      aiCandidateCanShowAfter={aiCandidateCanShowAfter}
      aiCandidateCanShowBefore={aiCandidateCanShowBefore}
      aiCandidateGlobalOperations={aiCandidateGlobalOperations}
      aiCandidatePreview={aiCandidatePreview}
      aiCandidateReviewedOperationCount={aiCandidateReviewedOperationCount}
      aiCandidateReviewedPageCount={aiCandidateReviewedPageCount}
      aiCandidateReviewPages={aiCandidateReviewPages}
      aiCandidateTargetableOperations={aiCandidateTargetableOperations}
      aiEditScope={aiEditScope}
      aiEditScopeOptions={aiEditScopeOptions}
      aiError={aiError}
      aiIntent={aiIntent}
      aiMessages={aiMessages}
      aiPatchApproveButtonRef={aiPatchApproveButtonRef}
      aiPatchReview={aiPatchReview}
      aiPlan={aiPlan}
      aiPlanApproveButtonRef={aiPlanApproveButtonRef}
      aiPlanReview={aiPlanReview}
      aiPreparedFollowUpRef={aiPreparedFollowUpRef}
      aiPrompt={aiPrompt}
      aiQualityBusy={aiQualityBusy}
      aiQualityReview={aiQualityReview}
      aiSelectedDestructiveCount={aiSelectedDestructiveCount}
      aiStageStatus={aiStageStatus}
      aiUndoSnapshot={aiUndoSnapshot}
      approveAICandidatePreview={approveAICandidatePreview}
      l={l}
      moveAICandidatePreviewPage={moveAICandidatePreviewPage}
      previewAICandidatePage={previewAICandidatePage}
      previewNextUnreviewedAICandidateOperation={previewNextUnreviewedAICandidateOperation}
      previewNextUnreviewedAICandidatePage={previewNextUnreviewedAICandidatePage}
      resolveAICandidatePreview={resolveAICandidatePreview}
      resolveAIPatchReview={resolveAIPatchReview}
      resolveAIPlanReview={resolveAIPlanReview}
      revealAdjacentAICandidateOperation={revealAdjacentAICandidateOperation}
      revealAICandidateOperation={revealAICandidateOperation}
      runAIQualityCheck={runAIQualityCheck}
      setAICandidatePreviewMode={setAICandidatePreviewMode}
      setAiEditScope={setAiEditScope}
      setAiIntent={setAiIntent}
      setAiPrompt={setAiPrompt}
      stopAIQualityCheck={stopAIQualityCheck}
      stopAIRequest={stopAIRequest}
      submitV2AIRequest={submitV2AIRequest}
      toggleAIPatchReviewOperation={toggleAIPatchReviewOperation}
      undoLastAIChange={undoLastAIChange}
      v2AiMessagesEndRef={v2AiMessagesEndRef}
    />
  );

  const v2CmsPanel = (
    <BuilderCmsPanel
      cms={cms}
      activePage={activePage || undefined}
      selectedElement={selectedElement || undefined}
      disabled={cloudBusy || publishBusy || aiBusy}
      issues={cmsIssues.map((issue) => issue.message)}
      onChange={(nextCms, label) => {
        remember(sections, label);
        setCms(normalizeWebsiteCms(nextCms));
        setSaved(false);
      }}
      onBindElement={(binding?: WebsiteCmsBinding) => {
        updateSelectedElement({ cmsBinding: binding });
      }}
      onSetPageTemplate={(template) => {
        remember(sections, template ? 'Connect dynamic page' : 'Disconnect dynamic page');
        setPages((current) => current.map((page) => page.id === activePageId
          ? { ...page, sections, cmsTemplate: template }
          : page));
        setSaved(false);
      }}
    />
  );
  const v2SitePanel = (
    <BuilderSitePanel
      applyDesignSystemPreset={applyDesignSystemPreset}
      checkCustomDomain={checkCustomDomain}
      cloudProjectId={cloudProjectId}
      connectCustomDomain={connectCustomDomain}
      customDomain={customDomain}
      customDomainBusy={customDomainBusy}
      customDomainDraft={customDomainDraft}
      customDomainError={customDomainError}
      designSystemReport={designSystemReport}
      faviconUrl={faviconUrl}
      footerConfig={footerConfig}
      headerConfig={headerConfig}
      l={l}
      localization={localization}
      localizationIssues={localizationIssues}
      projectTeamAccess={projectTeamAccess}
      removeCustomDomain={removeCustomDomain}
      repairActiveDesignSystem={repairActiveDesignSystem}
      setCustomDomainDraft={setCustomDomainDraft}
      setFaviconUrl={setFaviconUrl}
      setFooterConfig={setFooterConfig}
      setHeaderConfig={setHeaderConfig}
      setLocalization={setLocalization}
      setSaved={setSaved}
      setSiteEnhancements={setSiteEnhancements}
      setSiteName={setSiteName}
      setSiteUrl={setSiteUrl}
      setTheme={setTheme}
      siteEnhancements={siteEnhancements}
      siteName={siteName}
      siteUrl={siteUrl}
      theme={theme}
    />
  );
  const v2SettingsPanel = (
    <BuilderSettingsPanel
      billingEntitlements={billingEntitlements}
      cloudError={cloudError}
      hasUnpublishedChanges={hasUnpublishedChanges}
      l={l}
      launchCheckBusy={launchCheckBusy}
      launchLastCheckedAt={launchLastCheckedAt}
      liveVerification={liveVerification}
      productionConfig={productionConfig}
      publishBlocker={publishBlocker}
      publishBusy={publishBusy}
      publishedAt={publishedAt}
      publishedUrl={publishedUrl}
      publishError={publishError}
      publishWebsite={publishWebsite}
      requireBillingFeature={requireBillingFeature}
      runV1LaunchChecks={runV1LaunchChecks}
      seo={seo}
      setDeliveryOpen={setDeliveryOpen}
      setProductionConfig={setProductionConfig}
      setReleaseHistoryOpen={setReleaseHistoryOpen}
      setSaved={setSaved}
      setSeo={setSeo}
      siteAudit={siteAudit}
      unpublishWebsite={unpublishWebsite}
      verifyLiveDeployment={verifyLiveDeployment}
    />
  );

  const aiCanvasPreviewBanner = aiCanvasPreview ? (
    <div
      className="sticky top-2 z-[80] mx-auto mb-3 flex w-fit max-w-[calc(100%-1rem)] items-center gap-3 rounded-full border border-violet-300/30 bg-[#111122]/95 px-3 py-2 text-[9px] font-bold text-white shadow-2xl backdrop-blur"
      role="status"
      aria-live="polite"
    >
      <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide">{l(aiCandidatePreview ? (aiCandidateShowingBefore ? 'Original before AI' : 'Rendered AI result') : 'AI preview only')}</span>
      <span className="hidden text-gray-300 sm:inline">{l(aiCandidatePreview ? 'Compare before and after, then keep or discard from the AI panel' : 'Apply or discard from the AI panel')}</span>
      <span className="flex items-center gap-1 text-violet-300"><i className="h-2 w-2 rounded-full bg-violet-400" />{l('Update')}</span>
      <span className="flex items-center gap-1 text-emerald-300"><i className="h-2 w-2 rounded-full bg-emerald-400" />{l('Add')}</span>
      <span className="flex items-center gap-1 text-red-300"><i className="h-2 w-2 rounded-full bg-red-400" />{l('Remove')}</span>
    </div>
  ) : null;

  const v2Canvas = (
        <BuilderV2Canvas
              addElementToSection={addElementToSection}
              aiCandidateApproveButtonRef={aiCandidateApproveButtonRef}
              aiCandidatePreview={aiCandidatePreview}
              aiCanvasPreview={aiCanvasPreview}
              aiCanvasPreviewBanner={aiCanvasPreviewBanner}
              aiPatchApproveButtonRef={aiPatchApproveButtonRef}
              beginElementResize={beginElementResize}
              canvasActivePageId={canvasActivePageId}
              canvasHeaderConfig={canvasHeaderConfig}
              canvasPages={canvasPages}
              canvasSections={canvasSections}
              canvasSiteName={canvasSiteName}
              canvasSnapGuide={canvasSnapGuide}
              canvasTheme={canvasTheme}
              darkMode={darkMode}
              deleteSection={deleteSection}
              deleteSelectedElement={deleteSelectedElement}
              device={device}
              draggedElementId={draggedElementId}
              draggedId={draggedId}
              dragOverElementId={dragOverElementId}
              dragOverElementPosition={dragOverElementPosition}
              dragOverId={dragOverId}
              dragOverSectionPosition={dragOverSectionPosition}
              duplicateSelectedElement={duplicateSelectedElement}
              endElementResize={endElementResize}
              footerConfig={footerConfig}
              handleDragEnd={handleDragEnd}
              handleDragOver={handleDragOver}
              handleDragStart={handleDragStart}
              handleDrop={handleDrop}
              handleElementDragEnd={handleElementDragEnd}
              handleElementDragMove={handleElementDragMove}
              handleElementDragOver={handleElementDragOver}
              handleElementDragStart={handleElementDragStart}
              handleElementDrop={handleElementDrop}
              handleElementPointerDragStart={handleElementPointerDragStart}
              moveSection={moveSection}
              quickUpdateElement={quickUpdateElement}
              resetElementPosition={resetElementPosition}
              resizeElementFrame={resizeElementFrame}
              selectCanvasElement={selectCanvasElement}
              selectCanvasElements={selectCanvasElements}
              selectedElementId={selectedElementId}
              selectedElementIds={selectedElementIds}
              selectedId={selectedId}
              selectEditorTarget={selectEditorTarget}
              setInspectorOpen={setInspectorOpen}
              setMediaOpen={setMediaOpen}
              updateInlineElementContent={updateInlineElementContent}
              updateInlineElementSource={updateInlineElementSource}
            />
  );

  const commandPaletteItems = [
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
  ];
  const filteredCommandPaletteItems = commandPaletteItems
    .filter((item) => !commandQuery.trim() || `${l(item.label)} ${item.keywords}`.toLowerCase().includes(commandQuery.trim().toLowerCase()))
    .slice(0, 30);
  const commandPaletteOverlay = commandOpen ? (
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
          <input autoFocus type="search" data-command-focus value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} onKeyDown={handleCommandInputKeyDown} aria-label={l('Type a command, page or section…')} placeholder={l('Type a command, page or section…')} className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-sky-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-gray-50 text-gray-900'}`} />
        </div>
        <div className="max-h-[60vh] overflow-auto p-2">
          {filteredCommandPaletteItems.map((item) => (
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
          {!filteredCommandPaletteItems.length && <p className="px-3 py-6 text-center text-xs text-gray-500">{l('No matching commands')}</p>}
        </div>
        <div className="flex items-center justify-between border-t border-white/10 px-3 py-2 text-[10px] text-gray-500"><span>{l('Ctrl/Cmd+K · Ctrl/Cmd+C/X/V')}</span><button type="button" data-command-focus onClick={closeCommandPalette} className="font-semibold text-violet-400">{l('Close')}</button></div>
      </div>
    </div>
  ) : null;

  const legacyBuilder = (
    <div data-tayar-v1-root="true"
      className={`-m-4 flex min-h-[calc(100vh-64px)] flex-col lg:-m-8 ${
        darkMode ? 'bg-[#06060f] text-white' : 'bg-gray-50 text-gray-900'
      }`}
    >
      <BuilderLegacyHeader
              aiBusy={aiBusy}
              aiQualityBusy={aiQualityBusy}
              aiQualityReview={aiQualityReview}
              analyticsOpen={analyticsOpen}
              autoSaveStatus={autoSaveStatus}
              billingOpen={billingOpen}
              billingPlan={billingPlan}
              cloudBusy={cloudBusy}
              cloudProjectId={cloudProjectId}
              cloudProjects={cloudProjects}
              darkMode={darkMode}
              deliveryConfig={deliveryConfig}
              deliveryOpen={deliveryOpen}
              device={device}
              downloadProductionZip={downloadProductionZip}
              duplicateProject={duplicateProject}
              future={future}
              hasUnpublishedChanges={hasUnpublishedChanges}
              history={history}
              historyOpen={historyOpen}
              inspectorOpen={inspectorOpen}
              l={l}
              launchCenterOpen={launchCenterOpen}
              leads={leads}
              leadsOpen={leadsOpen}
              leftSidebarOpen={leftSidebarOpen}
              liveVerification={liveVerification}
              loadCloudProject={loadCloudProject}
              mediaOpen={mediaOpen}
              networkOnline={networkOnline}
              operationsOpen={operationsOpen}
              previewWebsite={previewWebsite}
              projectTeamAccess={projectTeamAccess}
              publishBusy={publishBusy}
              publishedAt={publishedAt}
              publishedUrl={publishedUrl}
              publishVersions={publishVersions}
              publishWebsite={publishWebsite}
              qualityDiagnostics={qualityDiagnostics}
              redo={redo}
              refreshBilling={refreshBilling}
              releaseHistoryOpen={releaseHistoryOpen}
              requireBillingFeature={requireBillingFeature}
              resetProject={resetProject}
              runAIQualityCheck={runAIQualityCheck}
              runV1LaunchChecks={runV1LaunchChecks}
              saved={saved}
              saveProject={saveProject}
              setAnalyticsOpen={setAnalyticsOpen}
              setBillingOpen={setBillingOpen}
              setDeliveryOpen={setDeliveryOpen}
              setDevice={setDevice}
              setHistoryOpen={setHistoryOpen}
              setInspectorOpen={setInspectorOpen}
              setLaunchCenterOpen={setLaunchCenterOpen}
              setLeadsOpen={setLeadsOpen}
              setLeftSidebarOpen={setLeftSidebarOpen}
              setMediaOpen={setMediaOpen}
              setOperationsOpen={setOperationsOpen}
              setReleaseHistoryOpen={setReleaseHistoryOpen}
              setSaved={setSaved}
              setSiteName={setSiteName}
              setSiteUrl={setSiteUrl}
              siteName={siteName}
              siteUrl={siteUrl}
              stopAIQualityCheck={stopAIQualityCheck}
              undo={undo}
              unpublishWebsite={unpublishWebsite}
              user={user}
              v1LaunchStatus={v1LaunchStatus}
              verifyLiveDeployment={verifyLiveDeployment}
            />

      {publishError && (
        <div className={`border-b px-4 py-2 text-xs ${darkMode ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {publishError}
        </div>
      )}

      {cloudError && (
        <div className={`border-b px-4 py-2 text-xs ${darkMode ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          {l(cloudError)}
        </div>
      )}

      {aiQualityOpen && (
        <div className={`border-b px-4 py-3 ${darkMode ? 'border-emerald-500/15 bg-[#07140f]' : 'border-emerald-200 bg-emerald-50/50'}`}>
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-xs font-bold">
                  <Check className="h-4 w-4 text-emerald-400" />
                  {l('AI Quality Check')}
                  {aiQualityReview && <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${aiQualityReview.score >= 80 ? 'bg-emerald-500/10 text-emerald-400' : aiQualityReview.score >= 60 ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'}`}>{aiQualityReview.score}/100</span>}
                </p>
                <p className="mt-1 text-[10px] text-gray-500">{aiQualityReview?.summary ? l(aiQualityReview.summary) : (aiQualityBusy ? l('Reviewing design, content, SEO, accessibility and publish readiness…') : l('Run the final AI review before publishing.'))}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={aiQualityBusy ? stopAIQualityCheck : () => void runAIQualityCheck()} disabled={aiBusy} className={`text-xs font-semibold disabled:opacity-40 ${aiQualityBusy ? 'text-rose-400' : 'text-emerald-400'}`}>{aiQualityBusy ? l('Stop check') : l('Run again')}</button>
                <button onClick={() => setAiQualityOpen(false)} className="text-xs font-semibold text-violet-400">{l('Close')}</button>
              </div>
            </div>

            {aiQualityReview && (
              <>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {aiQualityReview.findings.map((finding, index) => (
                    <article key={`${finding.title}-${index}`} className={`rounded-xl border p-3 ${darkMode ? 'border-white/[0.07] bg-white/[0.025]' : 'border-gray-200 bg-white'}`}>
                      <span className={`text-[8px] font-black uppercase tracking-wider ${finding.severity === 'critical' ? 'text-rose-400' : finding.severity === 'warning' ? 'text-amber-400' : 'text-sky-400'}`}>{l(finding.severity)}</span>
                      <p className="mt-1 text-[10px] font-bold">{l(finding.title)}</p>
                      <p className="mt-1 text-[9px] leading-relaxed text-gray-500">{l(finding.detail)}</p>
                    </article>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {aiQualityReview.fixPrompt && (
                    <button onClick={() => void fixAIQualityIssues()} disabled={aiBusy || aiQualityBusy} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50">{l('Fix safe issues with AI')}</button>
                  )}
                  <button onClick={previewWebsite} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${darkMode ? 'border-white/10 text-gray-300' : 'border-gray-200 bg-white text-gray-700'}`}>{l('Preview')}</button>
                  <span className="text-[9px] text-gray-500">{l('Publish remains blocked by critical deterministic audit errors and launch checks.')}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {commandOpen && (
        <BuilderLegacyCommandPalette
              arrangeSelectedElements={arrangeSelectedElements}
              canPasteCopiedTarget={canPasteCopiedTarget}
              closeCommandPalette={closeCommandPalette}
              cloudProjectId={cloudProjectId}
              commandQuery={commandQuery}
              copySelectedTarget={copySelectedTarget}
              createContainerForSelected={createContainerForSelected}
              cutSelectedTarget={cutSelectedTarget}
              darkMode={darkMode}
              desktopShortcutActionsRef={desktopShortcutActionsRef}
              downloadClientHandoffZip={downloadClientHandoffZip}
              duplicateActivePage={duplicateActivePage}
              editorClipboard={editorClipboard}
              exportAuditReport={exportAuditReport}
              exportProjectBackup={exportProjectBackup}
              exportV1LaunchReport={exportV1LaunchReport}
              handleCommandDialogKeyDown={handleCommandDialogKeyDown}
              handleCommandInputKeyDown={handleCommandInputKeyDown}
              handleCommandItemKeyDown={handleCommandItemKeyDown}
              importProjectBackup={importProjectBackup}
              l={l}
              moveSelectedElementsLayer={moveSelectedElementsLayer}
              normalizeSelectedElementFrames={normalizeSelectedElementFrames}
              pages={pages}
              pasteCopiedTarget={pasteCopiedTarget}
              previewWebsite={previewWebsite}
              recoveryAvailable={recoveryAvailable}
              refreshBilling={refreshBilling}
              requireBillingFeature={requireBillingFeature}
              restoreRecoverySnapshot={restoreRecoverySnapshot}
              runAIQualityCheck={runAIQualityCheck}
              runV1LaunchChecks={runV1LaunchChecks}
              saveProject={saveProject}
              sections={sections}
              selectAllCanvasElements={selectAllCanvasElements}
              selectedElement={selectedElement}
              selectedElements={selectedElements}
              selectedSection={selectedSection}
              selectRelatedCanvasElements={selectRelatedCanvasElements}
              setAnalyticsOpen={setAnalyticsOpen}
              setBillingOpen={setBillingOpen}
              setCommandQuery={setCommandQuery}
              setDeliveryOpen={setDeliveryOpen}
              setLaunchCenterOpen={setLaunchCenterOpen}
              setLeadsOpen={setLeadsOpen}
              setSelectedElementId={setSelectedElementId}
              setSelectedId={setSelectedId}
              switchPage={switchPage}
              ungroupSelectedElements={ungroupSelectedElements}
            />
      )}

      {launchCenterOpen && (
        <BuilderLegacyLaunchCenter
              applyPageTemplate={applyPageTemplate}
              closeLaunchCenter={closeLaunchCenter}
              cloudBusy={cloudBusy}
              cloudProjectId={cloudProjectId}
              cloudSyncFailed={cloudSyncFailed}
              darkMode={darkMode}
              exportV1LaunchReport={exportV1LaunchReport}
              l={l}
              launchCheckBusy={launchCheckBusy}
              launchLastCheckedAt={launchLastCheckedAt}
              launchManualChecks={launchManualChecks}
              liveVerification={liveVerification}
              networkOnline={networkOnline}
              previewWebsite={previewWebsite}
              projectTeamAccess={projectTeamAccess}
              publishBusy={publishBusy}
              publishedUrl={publishedUrl}
              publishWebsite={publishWebsite}
              qualityDiagnostics={qualityDiagnostics}
              refreshBilling={refreshBilling}
              runV1LaunchChecks={runV1LaunchChecks}
              saveProject={saveProject}
              setBillingOpen={setBillingOpen}
              setLaunchManualCheck={setLaunchManualCheck}
              setOperationsOpen={setOperationsOpen}
              setSaved={setSaved}
              setSiteName={setSiteName}
              setSiteUrl={setSiteUrl}
              siteAudit={siteAudit}
              siteName={siteName}
              siteUrl={siteUrl}
              v1LaunchStatus={v1LaunchStatus}
              verifyLiveDeployment={verifyLiveDeployment}
            />
      )}

      {billingOpen && (
        <BuilderLegacyBilling
              analyticsEvents={analyticsEvents}
              billingBusy={billingBusy}
              billingEntitlements={billingEntitlements}
              billingError={billingError}
              billingLoading={billingLoading}
              billingPlan={billingPlan}
              billingState={billingState}
              cloudProjectId={cloudProjectId}
              darkMode={darkMode}
              l={l}
              leads={leads}
              openBillingPortal={openBillingPortal}
              pages={pages}
              refreshBilling={refreshBilling}
              setBillingOpen={setBillingOpen}
              startBillingCheckout={startBillingCheckout}
            />
      )}

      {deliveryOpen && (
        <div className={`border-b px-4 py-3 ${darkMode ? 'border-fuchsia-500/20 bg-[#170b18]' : 'border-fuchsia-200 bg-fuchsia-50/50'}`}>
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold">{l('Client Delivery Workspace')}</p>
                <p className="text-[11px] text-gray-500">{l('Approval, launch readiness, usage and one-click client handoff.')}</p>
              </div>
              <div className="flex items-center gap-2">
                {previewUrl && <button onClick={() => void navigator.clipboard.writeText(previewUrl)} className="text-xs font-semibold text-cyan-400">{l('Copy preview')}</button>}
                <button onClick={() => setDeliveryOpen(false)} className="text-xs font-semibold text-violet-400">{l('Close')}</button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.15fr_.85fr]">
              <div className={`rounded-xl border p-3 ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-fuchsia-400">{l('Client & project')}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-[10px] text-gray-500">{l('Client name')}<input value={deliveryConfig.clientName} onChange={(e) => setDeliveryConfig((current) => ({ ...current, clientName: e.target.value.slice(0, 160) }))} placeholder={l('Client or company')} className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-black/20 text-white' : 'border-gray-200 bg-white'}`} /></label>
                  <label className="text-[10px] text-gray-500">{l('Client email')}<input value={deliveryConfig.clientEmail} onChange={(e) => setDeliveryConfig((current) => ({ ...current, clientEmail: e.target.value.slice(0, 200) }))} placeholder="client@example.com" className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-black/20 text-white' : 'border-gray-200 bg-white'}`} /></label>
                  <label className="text-[10px] text-gray-500">{l('Project code')}<input value={deliveryConfig.projectCode} onChange={(e) => setDeliveryConfig((current) => ({ ...current, projectCode: e.target.value.slice(0, 80) }))} placeholder="WEB-001" className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-black/20 text-white' : 'border-gray-200 bg-white'}`} /></label>
                  <label className="text-[10px] text-gray-500">{l('Due date')}<input type="date" value={deliveryConfig.dueDate} onChange={(e) => setDeliveryConfig((current) => ({ ...current, dueDate: e.target.value }))} className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-black/20 text-white' : 'border-gray-200 bg-white'}`} /></label>
                  <label className="text-[10px] text-gray-500">{l('Delivery status')}<select value={deliveryConfig.status} onChange={(e) => setDeliveryConfig((current) => ({ ...current, status: e.target.value as DeliveryStatus }))} className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-[#111122] text-white' : 'border-gray-200 bg-white'}`}><option value="building">{l('Building')}</option><option value="review">{l('Ready for review')}</option><option value="approved">{l('Approved')}</option><option value="delivered">{l('Delivered')}</option></select></label>
                  <label className="flex items-end gap-2 rounded-lg border border-fuchsia-500/15 px-3 py-2 text-[10px] text-gray-400"><input type="checkbox" checked={deliveryConfig.whiteLabel} disabled={!billingEntitlements.features.whiteLabel} onChange={(e) => { if (!requireBillingFeature('whiteLabel', 'White-label client delivery')) return; setDeliveryConfig((current) => ({ ...current, whiteLabel: e.target.checked })); }} /> {l('White-label client handoff files')} {!billingEntitlements.features.whiteLabel && <span className="font-bold text-amber-400">BUSINESS</span>}</label>
                </div>
                <label className="mt-2 block text-[10px] text-gray-500">{l('Handoff notes')}<textarea value={deliveryConfig.handoffNotes} onChange={(e) => setDeliveryConfig((current) => ({ ...current, handoffNotes: e.target.value.slice(0, 4000) }))} rows={4} placeholder={l('Hosting notes, DNS details, next steps, support terms…')} className={`mt-1 w-full resize-none rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-black/20 text-white' : 'border-gray-200 bg-white'}`} /></label>
              </div>

              <div className={`rounded-xl border p-3 ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wide text-cyan-400">{l('Launch readiness')}</p><span className={`text-2xl font-black ${launchReadiness.score >= 85 ? 'text-emerald-400' : launchReadiness.score >= 65 ? 'text-amber-400' : 'text-rose-400'}`}>{launchReadiness.score}%</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${launchReadiness.score}%` }} /></div>
                <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10px]">
                  {launchReadiness.checks.map((item) => <div key={l(item.label)} className={`rounded-lg border px-2 py-1.5 ${item.ok ? 'border-emerald-500/20 text-emerald-400' : 'border-white/10 text-gray-500'}`}>{item.ok ? '✓' : '○'} {l(item.label)}</div>)}
                </div>
                <p className="mt-2 text-[9px] text-gray-500">{l('Audit contributes')} {launchReadiness.auditPoints}/40 {l('points · current audit')} {siteAudit.score}/100.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
              {[
                ['Pages', deliveryUsage.pages], ['Sections', deliveryUsage.sections], ['Elements', deliveryUsage.elements], ['Forms', deliveryUsage.forms], ['Symbols', deliveryUsage.symbols], ['Releases', deliveryUsage.releases], ['Leads', deliveryUsage.leads], ['Events', deliveryUsage.analyticsEvents], ['Media*', deliveryUsage.mediaLoaded],
              ].map(([label, value]) => <div key={String(label)} className={`rounded-xl border p-2 text-center ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}><p className="text-[9px] uppercase text-gray-500">{l(String(label))}</p><p className="mt-1 text-lg font-black">{value}</p></div>)}
            </div>
            <p className="-mt-2 text-[9px] text-gray-500">{l('*Media count reflects assets currently loaded into the Media Library panel.')}</p>

            <div className={`rounded-xl border p-3 ${approvalCurrent ? 'border-emerald-500/25 bg-emerald-500/5' : deliveryConfig.approvedAt ? 'border-amber-500/25 bg-amber-500/5' : darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold">{l('Client approval fingerprint')}</p>
                  <p className={`mt-1 text-[10px] ${approvalCurrent ? 'text-emerald-400' : deliveryConfig.approvedAt ? 'text-amber-400' : 'text-gray-500'}`}>{deliveryConfig.approvedAt ? (approvalCurrent ? `${l('Approved')} ${new Date(deliveryConfig.approvedAt).toLocaleString()} — ${l('current build still matches')}` : `${l('Approved')} ${new Date(deliveryConfig.approvedAt).toLocaleString()} — ${l('website changed after approval')}`) : l('No approval snapshot recorded yet.')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={approveForDelivery} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">{l('Approve current build')}</button>
                  {deliveryConfig.approvedAt && <button onClick={clearDeliveryApproval} className="rounded-lg border border-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-400">{l('Clear approval')}</button>}
                  <button onClick={markProjectDelivered} className="rounded-lg border border-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-400">{l('Mark delivered')}</button>
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <button onClick={downloadClientHandoffZip} className="rounded-xl bg-fuchsia-600 p-3 text-left text-xs font-bold text-white hover:bg-fuchsia-500">{l('Download client handoff ZIP')}<div className="mt-1 text-[10px] font-normal text-fuchsia-100">{l('Site + backup + reports + checksums')}</div></button>
              <button onClick={exportDeliveryReport} className={`rounded-xl border p-3 text-left text-xs font-semibold ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>{l('Export delivery report')}<div className="mt-1 text-[10px] font-normal text-gray-500">{l('Approval, readiness, usage and audit')}</div></button>
              <button onClick={() => setReleaseHistoryOpen(true)} disabled={!user || !cloudProjectId} className={`rounded-xl border p-3 text-left text-xs font-semibold disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>{l('Open releases')}<div className="mt-1 text-[10px] font-normal text-gray-500">{publishVersions.length} {l('loaded releases')}</div></button>
              <button onClick={() => previewUrl ? window.open(previewUrl, '_blank', 'noopener,noreferrer') : setReleaseHistoryOpen(true)} className={`rounded-xl border p-3 text-left text-xs font-semibold ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>{previewUrl ? l('Open client preview') : l('Create client preview')}<div className="mt-1 text-[10px] font-normal text-gray-500">{l('Unlisted review link')}</div></button>
            </div>
          </div>
        </div>
      )}

      {operationsOpen && (
        <div className={`border-b px-4 py-3 ${darkMode ? 'border-sky-500/20 bg-[#08131a]' : 'border-sky-200 bg-sky-50/50'}`}>
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-bold">{l('Operations & Reliability')}</p><p className="text-[11px] text-gray-500">{l('Backup, restore, exports and bulk operations.')}</p></div>
              <div className="flex items-center gap-2"><button onClick={() => setCommandOpen(true)} className="text-xs font-semibold text-sky-400">{l('Command palette')}</button><button onClick={() => setOperationsOpen(false)} className="text-xs font-semibold text-violet-400">{l('Close')}</button></div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <button onClick={exportProjectBackup} className={`rounded-xl border p-3 text-left text-xs font-semibold ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{l('Export project backup')}<div className="mt-1 text-[10px] font-normal text-gray-500">{l('Portable JSON snapshot')}</div></button>
              <button onClick={importProjectBackup} className={`rounded-xl border p-3 text-left text-xs font-semibold ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{l('Import project backup')}<div className="mt-1 text-[10px] font-normal text-gray-500">{l('Restore JSON as local draft')}</div></button>
              <button onClick={exportAuditReport} className={`rounded-xl border p-3 text-left text-xs font-semibold ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{l('Export audit report')}<div className="mt-1 text-[10px] font-normal text-gray-500">{l('Score')} {siteAudit.score}/100</div></button>
              <button onClick={() => void copyProjectSummary()} className={`rounded-xl border p-3 text-left text-xs font-semibold ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{copied ? l('Summary copied') : l('Copy project summary')}<div className="mt-1 text-[10px] font-normal text-gray-500">{l('Pages, elements and health')}</div></button>
              <button onClick={exportLeadsCsv} disabled={!leads.length} className={`rounded-xl border p-3 text-left text-xs font-semibold disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{l('Export leads CSV')}<div className="mt-1 text-[10px] font-normal text-gray-500">{leads.length} {l('loaded leads')}</div></button>
              <button onClick={exportAnalyticsCsv} disabled={!analyticsEvents.length} className={`rounded-xl border p-3 text-left text-xs font-semibold disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{l('Export analytics CSV')}<div className="mt-1 text-[10px] font-normal text-gray-500">{analyticsEvents.length} {l('loaded events')}</div></button>
              <button onClick={() => void markAllLeadsRead()} disabled={!leads.some((lead) => lead.status === 'new')} className={`rounded-xl border p-3 text-left text-xs font-semibold disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{l('Mark all leads read')}<div className="mt-1 text-[10px] font-normal text-gray-500">{l('Bulk inbox cleanup')}</div></button>
              <button onClick={() => void archiveReadLeads()} disabled={!leads.some((lead) => lead.status === 'read')} className={`rounded-xl border p-3 text-left text-xs font-semibold disabled:opacity-40 ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>{l('Archive read leads')}<div className="mt-1 text-[10px] font-normal text-gray-500">{l('Keep inbox focused')}</div></button>
            </div>
            <p className="text-[10px] text-gray-500">{l('Shortcuts: Ctrl/Cmd+K commands · Ctrl/Cmd+C/X/V clipboard · Ctrl/Cmd+G group · Ctrl/Cmd+Shift+G ungroup · Ctrl/Cmd+[ or ] layers · arrows move · Shift+arrows move 10px.')}</p>
          </div>
        </div>
      )}

      {analyticsOpen && (
        <BuilderLegacyAnalytics
              analyticsError={analyticsError}
              analyticsEvents={analyticsEvents}
              analyticsLoading={analyticsLoading}
              analyticsSummary={analyticsSummary}
              darkMode={darkMode}
              exportAnalyticsCsv={exportAnalyticsCsv}
              l={l}
              refreshAnalytics={refreshAnalytics}
              setAnalyticsOpen={setAnalyticsOpen}
            />
      )}

      {mediaOpen && (
        <div className={`border-b px-4 py-3 ${darkMode ? 'border-fuchsia-500/20 bg-[#170b18]' : 'border-fuchsia-200 bg-fuchsia-50/50'}`}>
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold">{l('Media Library')}</p>
                <p className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{l("Upload reusable images to your account and place them into any image element.")}</p>
              </div>
              <div className="flex items-center gap-2">
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white ${mediaUploading ? 'pointer-events-none bg-fuchsia-400 opacity-60' : 'bg-fuchsia-600 hover:bg-fuchsia-500'}`}>
                  <Upload className="h-3.5 w-3.5" />
                  {mediaUploading ? 'Uploading…' : 'Upload image'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={mediaUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadMediaFile(file);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                <button onClick={() => void refreshMedia()} disabled={mediaLoading} className="text-xs font-semibold text-fuchsia-400 disabled:opacity-50">
                  {mediaLoading ? 'Refreshing…' : 'Refresh'}
                </button>
                <button onClick={() => setMediaOpen(false)} className="text-xs font-semibold text-violet-400">{l('Close')}</button>
              </div>
            </div>

            {mediaError && <p className="text-xs text-amber-400">{l(mediaError)}</p>}

            {!mediaLoading && !mediaAssets.length ? (
              <div className={`rounded-lg border p-4 text-xs ${darkMode ? 'border-white/10 bg-white/5 text-gray-400' : 'border-gray-200 bg-white text-gray-500'}`}>{l("No images yet. Upload JPG, PNG, WebP or GIF files up to 5 MB.")}</div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {mediaAssets.map((asset) => (
                  <article key={asset.path} className={`overflow-hidden rounded-xl border ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
                    <button type="button" onClick={() => applyMediaAsset(asset)} className="block w-full" title={l('Use image')}>
                      <img src={asset.url} alt={asset.name} className="aspect-square w-full object-cover" loading="lazy" />
                    </button>
                    <div className="p-2">
                      <p className="truncate text-[10px] font-semibold" title={asset.name}>{asset.name}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <button onClick={() => applyMediaAsset(asset)} className="text-[10px] font-bold text-fuchsia-400">{l('Use')}</button>
                        <button onClick={() => { setFaviconUrl(asset.url); setSaved(false); }} className="text-[10px] font-bold text-emerald-400">{l('Favicon')}</button>
                        <button onClick={() => updateActivePageMeta({ socialImage: asset.url })} disabled={!activePage} className="text-[10px] font-bold text-sky-400 disabled:opacity-40">{l('Social')}</button>
                        <button onClick={() => void deleteMediaAsset(asset)} className="text-[10px] font-bold text-rose-400">{l('Delete')}</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {leadsOpen && (
        <BuilderLegacyLeads
              archiveReadLeads={archiveReadLeads}
              bulkUpdateLeadStage={bulkUpdateLeadStage}
              copyLeadSummary={copyLeadSummary}
              darkMode={darkMode}
              deleteLead={deleteLead}
              exportLeadsCsv={exportLeadsCsv}
              filteredLeads={filteredLeads}
              formDeliveries={formDeliveries}
              l={l}
              leadCrmSummary={leadCrmSummary}
              leadQuery={leadQuery}
              leads={leads}
              leadsError={leadsError}
              leadsLoading={leadsLoading}
              leadStageFilter={leadStageFilter}
              leadStatusFilter={leadStatusFilter}
              markAllLeadsRead={markAllLeadsRead}
              openWebsiteFormUpload={openWebsiteFormUpload}
              refreshLeads={refreshLeads}
              selectedLeadIds={selectedLeadIds}
              setLeadQuery={setLeadQuery}
              setLeadsOpen={setLeadsOpen}
              setLeadStageFilter={setLeadStageFilter}
              setLeadStatusFilter={setLeadStatusFilter}
              setSelectedLeadIds={setSelectedLeadIds}
              updateLeadCrm={updateLeadCrm}
              updateLeadStatus={updateLeadStatus}
            />
      )}

      {releaseHistoryOpen && (
        <BuilderLegacyReleaseHistory
              cloudProjectId={cloudProjectId}
              createSharePreview={createSharePreview}
              currentAIEditableFingerprint={currentAIEditableFingerprint}
              darkMode={darkMode}
              deletePublishVersion={deletePublishVersion}
              hasUnpublishedChanges={hasUnpublishedChanges}
              l={l}
              lastPublishedVersionId={lastPublishedVersionId}
              previewBusy={previewBusy}
              previewCreatedAt={previewCreatedAt}
              previewError={previewError}
              previewFingerprint={previewFingerprint}
              previewUrl={previewUrl}
              promoteSharePreviewToLive={promoteSharePreviewToLive}
              publishBusy={publishBusy}
              publishedUrl={publishedUrl}
              publishVersions={publishVersions}
              publishVersionsError={publishVersionsError}
              publishVersionsLoading={publishVersionsLoading}
              refreshPublishVersions={refreshPublishVersions}
              releaseDiffSummary={releaseDiffSummary}
              releaseNote={releaseNote}
              restorePublishVersionToEditor={restorePublishVersionToEditor}
              revokeSharePreview={revokeSharePreview}
              rollbackPublishVersion={rollbackPublishVersion}
              setReleaseHistoryOpen={setReleaseHistoryOpen}
              setReleaseNote={setReleaseNote}
              user={user}
            />
      )}

      {historyOpen && (
        <div className={`border-b px-4 py-3 ${darkMode ? 'border-white/10 bg-[#0d0d20]' : 'border-gray-200 bg-gray-50'}`}>
          <div className="mx-auto flex max-w-6xl flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold">{l('Project History')}</p>
                <p className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{l('Up to 30 manual and AI checkpoints. Autosave stays lightweight.')}</p>
              </div>
              <button onClick={() => setHistoryOpen(false)} className="text-xs font-semibold text-violet-400">{l('Close')}</button>
            </div>
            {projectHistory.length ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {projectHistory.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => restoreHistoryEntry(entry)}
                    className={`min-w-52 rounded-lg border px-3 py-2 text-left text-xs ${darkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-100'}`}
                    title={l('Restore this version')}
                  >
                    <span className="block font-semibold">{entry.label}</span>
                    <span className={`mt-1 block text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{l('Restore version')}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{l('No restore points yet. Save or use Tayar AI to create the first checkpoint.')}</p>
            )}
          </div>
        </div>
      )}

      <div data-tayar-v1-workspace="true" className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <BuilderLegacySidebar
              activePage={activePage}
              activePageId={activePageId}
              addElement={addElement}
              addPage={addPage}
              addSection={addSection}
              addSectionTemplate={addSectionTemplate}
              advancedSiteSettingsOpen={advancedSiteSettingsOpen}
              aiBusy={aiBusy}
              aiError={aiError}
              aiMessages={aiMessages}
              aiPlan={aiPlan}
              aiPrompt={aiPrompt}
              aiQualityBusy={aiQualityBusy}
              aiStage={aiStage}
              aiStageStatus={aiStageStatus}
              aiUndoSnapshot={aiUndoSnapshot}
              applyAIChange={applyAIChange}
              applyDesignSystemPreset={applyDesignSystemPreset}
              applyPageTemplate={applyPageTemplate}
              applyThemeToAllPages={applyThemeToAllPages}
              applyThemeToCurrentPage={applyThemeToCurrentPage}
              billingEntitlements={billingEntitlements}
              builderPanel={builderPanel}
              copied={copied}
              copyHtml={copyHtml}
              darkMode={darkMode}
              deleteActivePage={deleteActivePage}
              deleteReusableSection={deleteReusableSection}
              designSystemReport={designSystemReport}
              duplicateActivePage={duplicateActivePage}
              duplicatePageAsTranslation={duplicatePageAsTranslation}
              faviconUrl={faviconUrl}
              footerConfig={footerConfig}
              generateRealImage={generateRealImage}
              generateWithAI={generateWithAI}
              headerConfig={headerConfig}
              homePageId={homePageId}
              insertReusableSection={insertReusableSection}
              l={l}
              leftSidebarOpen={leftSidebarOpen}
              localization={localization}
              makeActivePageHome={makeActivePageHome}
              movePage={movePage}
              openBillingWithMessage={openBillingWithMessage}
              pages={pages}
              pageSettingsOpen={pageSettingsOpen}
              prefs={prefs}
              productionConfig={productionConfig}
              qualityDiagnostics={qualityDiagnostics}
              recoveryAvailable={recoveryAvailable}
              repairActiveDesignSystem={repairActiveDesignSystem}
              requireBillingFeature={requireBillingFeature}
              restoreRecoverySnapshot={restoreRecoverySnapshot}
              reusableBusy={reusableBusy}
              reusableError={reusableError}
              reusableSections={reusableSections}
              runAIQualityCheck={runAIQualityCheck}
              saveSelectedSectionAsReusable={saveSelectedSectionAsReusable}
              sections={sections}
              selectedElementId={selectedElementId}
              selectedId={selectedId}
              selectedSection={selectedSection}
              seo={seo}
              setAdvancedSiteSettingsOpen={setAdvancedSiteSettingsOpen}
              setAiError={setAiError}
              setAiPrompt={setAiPrompt}
              setAiStage={setAiStage}
              setBuilderPanel={setBuilderPanel}
              setFaviconUrl={setFaviconUrl}
              setFooterConfig={setFooterConfig}
              setHeaderConfig={setHeaderConfig}
              setInspectorOpen={setInspectorOpen}
              setLeftSidebarOpen={setLeftSidebarOpen}
              setLocalization={setLocalization}
              setPageSettingsOpen={setPageSettingsOpen}
              setProductionConfig={setProductionConfig}
              setSaved={setSaved}
              setSelectedElementId={setSelectedElementId}
              setSelectedId={setSelectedId}
              setSeo={setSeo}
              setSiteEnhancements={setSiteEnhancements}
              setTheme={setTheme}
              siteAudit={siteAudit}
              siteEnhancements={siteEnhancements}
              stopAIQualityCheck={stopAIQualityCheck}
              switchPage={switchPage}
              theme={theme}
              undoLastAIChange={undoLastAIChange}
              updateActivePageMeta={updateActivePageMeta}
            />

        <BuilderLegacyCanvas
              addElementToSection={addElementToSection}
              aiCandidateApproveButtonRef={aiCandidateApproveButtonRef}
              aiCandidatePreview={aiCandidatePreview}
              aiCanvasPreview={aiCanvasPreview}
              aiCanvasPreviewBanner={aiCanvasPreviewBanner}
              aiPatchApproveButtonRef={aiPatchApproveButtonRef}
              beginElementResize={beginElementResize}
              canvasActivePageId={canvasActivePageId}
              canvasHeaderConfig={canvasHeaderConfig}
              canvasPages={canvasPages}
              canvasSections={canvasSections}
              canvasSiteName={canvasSiteName}
              canvasSnapGuide={canvasSnapGuide}
              canvasTheme={canvasTheme}
              darkMode={darkMode}
              deleteSection={deleteSection}
              deleteSelectedElement={deleteSelectedElement}
              device={device}
              draggedElementId={draggedElementId}
              draggedId={draggedId}
              dragOverElementId={dragOverElementId}
              dragOverElementPosition={dragOverElementPosition}
              dragOverId={dragOverId}
              dragOverSectionPosition={dragOverSectionPosition}
              duplicateSelectedElement={duplicateSelectedElement}
              endElementResize={endElementResize}
              footerConfig={footerConfig}
              handleDragEnd={handleDragEnd}
              handleDragOver={handleDragOver}
              handleDragStart={handleDragStart}
              handleDrop={handleDrop}
              handleElementDragEnd={handleElementDragEnd}
              handleElementDragMove={handleElementDragMove}
              handleElementDragOver={handleElementDragOver}
              handleElementDragStart={handleElementDragStart}
              handleElementDrop={handleElementDrop}
              handleElementPointerDragStart={handleElementPointerDragStart}
              insertSectionAfter={insertSectionAfter}
              l={l}
              moveSection={moveSection}
              quickUpdateElement={quickUpdateElement}
              resetElementPosition={resetElementPosition}
              resizeElementFrame={resizeElementFrame}
              selectCanvasElement={selectCanvasElement}
              selectCanvasElements={selectCanvasElements}
              selectedElementId={selectedElementId}
              selectedElementIds={selectedElementIds}
              selectedId={selectedId}
              selectEditorTarget={selectEditorTarget}
              setInspectorOpen={setInspectorOpen}
              setMediaOpen={setMediaOpen}
              updateInlineElementContent={updateInlineElementContent}
              updateInlineElementSource={updateInlineElementSource}
            />

        <BuilderLegacyInspector
              addFormAutomation={addFormAutomation}
              addFormField={addFormField}
              aiBusy={aiBusy}
              aiQualityBusy={aiQualityBusy}
              assignSelectedToContainer={assignSelectedToContainer}
              copySelectedElementResponsiveFrom={copySelectedElementResponsiveFrom}
              copySelectedSectionResponsiveFrom={copySelectedSectionResponsiveFrom}
              createContainerForSelected={createContainerForSelected}
              createSymbolFromSelected={createSymbolFromSelected}
              darkMode={darkMode}
              deleteFormAutomation={deleteFormAutomation}
              deleteFormField={deleteFormField}
              deleteSection={deleteSection}
              deleteSelectedContainer={deleteSelectedContainer}
              deleteSelectedElement={deleteSelectedElement}
              deleteSymbol={deleteSymbol}
              detachSelectedSymbol={detachSelectedSymbol}
              device={device}
              duplicateSelectedElement={duplicateSelectedElement}
              generateImagePrompt={generateImagePrompt}
              generateRealImage={generateRealImage}
              insertSymbol={insertSymbol}
              inspectorOpen={inspectorOpen}
              l={l}
              mediaUploading={mediaUploading}
              moveFormField={moveFormField}
              moveSection={moveSection}
              moveSelectedElement={moveSelectedElement}
              pages={pages}
              resetContactForm={resetContactForm}
              resetSelectedElementResponsive={resetSelectedElementResponsive}
              resetSelectedSectionResponsive={resetSelectedSectionResponsive}
              sectionSettingsOpen={sectionSettingsOpen}
              selectedContainer={selectedContainer}
              selectedElement={selectedElement}
              selectedSection={selectedSection}
              setInspectorOpen={setInspectorOpen}
              setMediaOpen={setMediaOpen}
              setSectionSettingsOpen={setSectionSettingsOpen}
              setSelectedSectionLayout={setSelectedSectionLayout}
              symbols={symbols}
              theme={theme}
              updateFormAutomation={updateFormAutomation}
              updateFormField={updateFormField}
              updateSelected={updateSelected}
              updateSelectedContainer={updateSelectedContainer}
              updateSelectedElement={updateSelectedElement}
              updateSelectedSectionResponsive={updateSelectedSectionResponsive}
              uploadMediaFile={uploadMediaFile}
              user={user}
            />
      </div>
    </div>
  );

  const collaborationPanel = (
    <WebsiteCollaborationPanel
      projectId={cloudProjectId}
      canEdit={projectTeamAccess.canEdit}
      canManage={projectTeamAccess.canManage}
      pageId={activePageId}
      pageName={activePage?.name || siteName}
      sectionId={selectedId}
      elementId={selectedElementId}
      darkMode={darkMode}
      onNavigate={(anchor) => {
        const targetPage = getCurrentPages().find((page) => page.id === anchor.pageId);
        if (targetPage && targetPage.id !== activePageId) switchPage(targetPage.id);
        if (!anchor.sectionId || !targetPage) return;
        const targetSection = targetPage.sections.find((section) => section.id === anchor.sectionId);
        if (!targetSection) return;
        const targetElementId = anchor.elementId && targetSection.elements.some((element) => element.id === anchor.elementId)
          ? anchor.elementId
          : null;
        selectEditorTarget(targetSection.id, targetElementId);
        setInspectorOpen(true);
      }}
    />
  );

  if (!editorV2Flags.shell) {
    return <>{legacyBuilder}{collaborationPanel}</>;
  }

  return (
    <>
    <WebsiteBuilderV2Bridge
      canvas={v2Canvas}
      overlaySlot={commandPaletteOverlay}
      aiPanel={v2AiPanel}
      topbarTrailingSlot={
        <>
          <button
            type="button"
            className="tayar-v2-command-button"
            onClick={() => setCommandOpen(true)}
            aria-label={l('Open command palette')}
            title={l('Open command palette')}
          >
            ⌘K
          </button>
          {selectedElements.length > 1 && (
            <div className="tayar-v2-multi-selection" role="group" aria-label={l('Selected elements actions')}>
              <span>{l('Selected elements')}: {selectedElements.length}</span>
              <select
                value=""
                onChange={(event) => {
                  const action = event.target.value;
                  if (action === 'match-width' || action === 'match-appearance' || action === 'reset-position' || action === 'show' || action === 'hide') normalizeSelectedElementFrames(action);
                  else if (action === 'bring-front') moveSelectedElementsLayer('front');
                  else if (action === 'bring-forward') moveSelectedElementsLayer('forward');
                  else if (action === 'send-backward') moveSelectedElementsLayer('backward');
                  else if (action === 'send-back') moveSelectedElementsLayer('back');
                  else if (action) arrangeSelectedElements(action as Parameters<typeof arrangeSelectedElements>[0]);
                }}
                disabled={cloudBusy || publishBusy || aiBusy || aiQualityBusy || launchCheckBusy}
                aria-label={l('Arrange selected elements')}
                title={l('Arrange selected elements')}
              >
                <option value="" disabled>{l('Arrange')}</option>
                <optgroup label={l('Align')}>
                  <option value="left">{l('Align left')}</option>
                  <option value="center">{l('Align center')}</option>
                  <option value="right">{l('Align right')}</option>
                  <option value="top">{l('Align top')}</option>
                  <option value="middle">{l('Align middle')}</option>
                  <option value="bottom">{l('Align bottom')}</option>
                </optgroup>
                <optgroup label={l('Distribute')}>
                  <option value="distribute-horizontal" disabled={selectedElements.length < 3}>{l('Distribute horizontally')}</option>
                  <option value="distribute-vertical" disabled={selectedElements.length < 3}>{l('Distribute vertically')}</option>
                </optgroup>
                <optgroup label={l('Size')}>
                  <option value="match-width">{l('Match width')}</option>
                  <option value="match-appearance">{l('Match appearance')}</option>
                  <option value="reset-position">{l('Reset selected transforms')}</option>
                </optgroup>
                <optgroup label={l('Layer order')}>
                  <option value="bring-front">{l('Bring to front')}</option>
                  <option value="bring-forward">{l('Bring forward')}</option>
                  <option value="send-backward">{l('Send backward')}</option>
                  <option value="send-back">{l('Send to back')}</option>
                </optgroup>
                <optgroup label={l('Visibility')}>
                  <option value="show">{l('Show selected')}</option>
                  <option value="hide">{l('Hide selected')}</option>
                </optgroup>
              </select>
              <button
                type="button"
                onClick={createContainerForSelected}
                disabled={cloudBusy || publishBusy || aiBusy || aiQualityBusy || launchCheckBusy}
                title={l('Group selected elements')}
              >
                {l('Group')}
              </button>
              {selectedElements.some((element) => element.containerId) && (
                <button
                  type="button"
                  onClick={ungroupSelectedElements}
                  disabled={cloudBusy || publishBusy || aiBusy || aiQualityBusy || launchCheckBusy}
                  title={l('Ungroup selected elements')}
                >
                  {l('Ungroup')}
                </button>
              )}
              <button
                type="button"
                onClick={duplicateSelectedTarget}
                disabled={cloudBusy || publishBusy || aiBusy || aiQualityBusy || launchCheckBusy}
                title={l('Duplicate selected elements')}
              >
                {l('Duplicate')}
              </button>
              <button
                type="button"
                onClick={deleteSelectedTarget}
                disabled={cloudBusy || publishBusy || aiBusy || aiQualityBusy || launchCheckBusy || selectedElements.length >= (selectedSection?.elements.length || 0)}
                title={l('Delete selected elements')}
              >
                {l('Delete')}
              </button>
            </div>
          )}
          {canPasteCopiedTarget() && editorClipboard && (
            <button
              type="button"
              className="tayar-v2-clipboard-button"
              onClick={pasteCopiedTarget}
              disabled={cloudBusy || publishBusy || aiBusy || aiQualityBusy || launchCheckBusy}
              title={l(editorClipboard.kind === 'section' ? 'Paste copied section' : editorClipboard.kind === 'elements' ? 'Paste copied elements' : 'Paste copied element')}
            >
              {l(editorClipboard.kind === 'section' ? 'SECTION READY' : editorClipboard.kind === 'elements' ? 'ELEMENTS READY' : 'ELEMENT READY')}
            </button>
          )}
          {publishedUrl && (
          <button
            type="button"
            className="tayar-v2-live-button"
            onClick={() => window.open(publishedUrl, '_blank', 'noopener,noreferrer')}
            title={publishedUrl}
          >
            {liveVerification === 'healthy' ? 'LIVE ↗' : 'Open ↗'}
          </button>
          )}
        </>
      }
      sitePanel={v2SitePanel}
      cmsPanel={v2CmsPanel}
      settingsPanel={v2SettingsPanel}
      symbols={symbols as unknown as EditorSymbolLike[]}
      onCreateSymbol={createSymbolFromSelected}
      onDetachSymbol={detachSelectedSymbol}
      onInsertSymbol={(symbolId) => {
        const symbol = symbols.find((item) => item.id === symbolId);
        if (symbol) insertSymbol(symbol);
      }}
      onDeleteSymbol={deleteSymbol}
      onRenameSymbol={renameSymbol}
      onDuplicateSymbol={duplicateSymbol}
      onSelectSymbolInstance={selectNextSymbolInstance}
      pages={pages.map((page) =>
        page.id === activePageId
          ? { ...page, sections }
          : page
      ) as unknown as EditorPageLike[]}
      homePageId={homePageId}

      mediaAssets={mediaAssets.map((asset) => ({
        id: asset.path,
        kind: 'image' as const,
        origin: 'upload' as const,
        url: asset.url,
        name: asset.name,
        createdAt: asset.createdAt
          ? Date.parse(asset.createdAt)
          : undefined,
      }))}

      onMediaOpen={() => {
        void refreshMedia();
      }}

      onMediaUpload={openV2MediaUpload}

      onGenerateMediaWithAI={async (prompt) => {
        await generateMediaLibraryImage(prompt);
      }}

      onAddPage={addPage}

      onMovePage={movePage}

      onDuplicatePage={
        duplicateActivePage
      }

      onDeletePage={
        deleteActivePage
      }

      onSetHomePage={
        makeActivePageHome
      }

      onMoveSection={
        moveSection
      }

      onDuplicateSection={
        v2DuplicateSectionDirect
      }

      onDeleteSection={
        deleteSection
      }

      onMoveElement={
        v2MoveElementDirect
      }

      onDuplicateElement={
        v2DuplicateElementDirect
      }

      onCopySelection={copySelectedTarget}
      onCutSelection={cutSelectedTarget}
      onPasteSelection={pasteCopiedTarget}
      clipboardKind={canPasteCopiedTarget() ? editorClipboard?.kind : undefined}

      onDeleteElement={
        v2DeleteElementDirect
      }

      onApplyOperations={applyV2NativeOperations}
      onRestoreHistoryEntry={restoreEditHistoryEntry}

      accent={
        selectedSection?.accent ||
        brand.colors.primary
      }
      activePageId={activePageId}
      selectedSectionId={selectedId}
      selectedElementId={selectedElementId}
      selectedElementIds={selectedElementIds}
      selectedContainerId={selectedContainerId}
      selectedFormFieldId={selectedFormFieldId}
      device={device}
      dirty={hasUnsavedChanges}
      canUndo={history.length > 0}
      canRedo={future.length > 0}
      historyEntries={history.map((entry) => ({
        id: entry.id,
        label: entry.label,
        createdAt: Date.parse(entry.savedAt) || Date.now(),
        source: 'manual' as const,
      }))}
      futureEntries={future.map((entry) => ({
        id: entry.id,
        label: entry.label,
        createdAt: Date.parse(entry.savedAt) || Date.now(),
        source: 'manual' as const,
      }))}
      saving={cloudBusy || autoSaveStatus === 'saving'}
      publishing={publishBusy}
      checking={launchCheckBusy}
      mutating={cloudBusy || publishBusy || launchCheckBusy || aiBusy || aiQualityBusy}
      saveError={cloudError || (autoSaveStatus === 'failed' ? 'Autosave needs attention.' : undefined)}
      publishError={publishError || undefined}
      checkScore={siteAudit.score}
      checkErrors={siteAudit.errors.length}
      checkWarnings={siteAudit.warnings.length}
      lastCheckedAt={launchLastCheckedAt ? Date.parse(launchLastCheckedAt) : undefined}
      publishedUrl={publishedUrl || undefined}
      publishedAt={publishedAt ? Date.parse(publishedAt) : undefined}
      publishedOutdated={hasUnpublishedChanges}
      liveVerification={liveVerification}
      publishBlockers={[
        !user ? 'Sign in before publishing.' : '',
        !networkOnline ? 'Reconnect before publishing.' : '',
        user && cloudProjectId && !projectTeamAccess.canPublish ? 'Only the project owner can publish.' : '',
        siteAudit.errors.length ? `Fix ${siteAudit.errors.length} critical Check issue${siteAudit.errors.length === 1 ? '' : 's'} before publishing.` : '',
        cmsErrors.length ? `Fix ${cmsErrors.length} CMS issue${cmsErrors.length === 1 ? '' : 's'} before publishing.` : '',
      ].filter(Boolean)}
      onUndo={undo}
      onRedo={redo}
      onSave={() => void saveProject()}
      onPreview={previewWebsite}
      onPublish={() => void publishWebsite()}
      onRunCheck={() => void runV1LaunchChecks()}
      onSetDevice={(nextDevice) => {
        clearEditorDragState();
        setDevice(nextDevice as Device);
      }}
      onSelect={(selection) => {
        const currentPages = getCurrentPages();
        const targetPageId = selection.pageId || activePageId;
        const targetPage = currentPages.find((page) => page.id === targetPageId);
        if (!targetPage) return;

        if (targetPage.id !== activePageId) {
          switchPage(targetPage.id);
        }

        if (!selection.sectionId) return;

        const targetSection = targetPage.sections.find(
          (section) => section.id === selection.sectionId,
        );
        if (!targetSection) return;

        const elementId =
          selection.elementId &&
          targetSection.elements.some((element) => element.id === selection.elementId)
            ? selection.elementId
            : null;
        const containerId =
          !elementId &&
          selection.containerId &&
          (targetSection.containers || []).some((container) => container.id === selection.containerId)
            ? selection.containerId
            : null;
        const formFieldId =
          !elementId &&
          !containerId &&
          selection.formFieldId &&
          (targetSection.formFields || []).some((field) => field.id === selection.formFieldId)
            ? selection.formFieldId
            : null;

        selectEditorTarget(
          targetSection.id,
          elementId,
          containerId,
          formFieldId,
        );
        setInspectorOpen(true);
      }}
      onSelectElement={(sectionId, elementId, additive, range) => {
        selectCanvasElement(sectionId, elementId, additive, range);
        setInspectorOpen(true);
      }}
    />
    {collaborationPanel}
    </>
  );
}
