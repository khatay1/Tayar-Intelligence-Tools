import { useEffect, useRef, useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization';
import { Plus, Trash2, ChevronUp, ChevronDown, RotateCcw, Palette, Copy, Link, MousePointer2, Images } from 'lucide-react';
import type { Device, WebsiteElement, WebsiteElementContainer, WebsiteElementType, WebsiteSection } from '../core/types';
import { ELEMENT_LABELS, SECTION_LABELS, createDefaultContactFormFields } from '../core/defaults';
import { CANVAS_GRID_SIZE, CANVAS_RESIZE_SNAP_STEP, resolveCanvasResize } from '../core/editor-canvas-geometry';
import type { CanvasSnapGuides } from '../core/editor-canvas-geometry';
import { aiWebsitePatchPreviewClass } from '../core/editor-ai-patch-review';
import type { AIWebsiteCanvasPreview } from '../core/editor-ai-patch-review';
import type { WebsiteTheme } from '../core/website-builder-model';
import { sectionColumnCount, sectionLayoutGap, sectionLayoutAlign, sectionContentWidth, sectionVisualNumber, sectionBackgroundCss, sectionDomId, effectiveStyle, effectiveSectionStyle, clampElementNumber, elementColumn, elementColumnSpan, elementShadowCss, containerColumn, containerColumnSpan } from '../core/website-builder-rendering';
import { ElementPreview } from './ElementPreview';

export function SectionPreview({
  section,
  selected,
  selectedElementId,
  selectedElementIds,
  onSelect,
  onSelectElement,
  onMarqueeSelect,
  draggedElementId,
  dragOverElementId,
  dragOverElementPosition,
  snapGuides,
  onElementDragStart,
  onElementDragMove,
  onElementPointerDragStart,
  onElementDragOver,
  onElementDrop,
  onElementDragEnd,
  onResizeElementStart,
  onResizeElementFrame,
  onResizeElementEnd,
  onResetElementPosition,
  onQuickUpdateElement,
  onOpenMediaLibrary,
  onOpenInspector,
  onDuplicateSelectedElement,
  onDeleteSelectedElement,
  onInlineContentChange,
  onInlineSourceChange,
  onAddElement,
  onMoveSection,
  onDeleteSection,
  canMoveSectionUp,
  canMoveSectionDown,
  canDeleteSection,
  device,
  theme,
  aiPreview,
}: {
  section: WebsiteSection;
  selected: boolean;
  selectedElementId: string | null;
  selectedElementIds: string[];
  onSelect: () => void;
  onSelectElement: (id: string, additive?: boolean, range?: boolean) => void;
  onMarqueeSelect: (ids: string[], additive?: boolean) => void;
  draggedElementId: string | null;
  dragOverElementId: string | null;
  dragOverElementPosition: 'before' | 'after' | null;
  snapGuides: CanvasSnapGuides | null;
  onElementDragStart: (id: string, e: React.DragEvent) => void;
  onElementDragMove: (id: string, e: React.DragEvent) => void;
  onElementPointerDragStart: (id: string, e: React.PointerEvent<HTMLElement>) => void;
  onElementDragOver: (id: string, e: React.DragEvent) => void;
  onElementDrop: (id: string, e: React.DragEvent) => void;
  onElementDragEnd: () => void;
  onResizeElementStart: (id: string) => void;
  onResizeElementFrame: (id: string, frame: { width: number; positionX?: number }) => void;
  onResizeElementEnd: () => void;
  onResetElementPosition: (id: string) => void;
  onQuickUpdateElement: (id: string, changes: Partial<WebsiteElement>) => void;
  onOpenMediaLibrary: () => void;
  onOpenInspector: () => void;
  onDuplicateSelectedElement: () => void;
  onDeleteSelectedElement: () => void;
  onInlineContentChange: (elementId: string, content: string) => void;
  onInlineSourceChange: (elementId: string, src: string) => void;
  onAddElement: (type: WebsiteElementType) => void;
  onMoveSection: (direction: 'up' | 'down') => void;
  onDeleteSection: () => void;
  canMoveSectionUp: boolean;
  canMoveSectionDown: boolean;
  canDeleteSection: boolean;
  device: Device;
  theme: WebsiteTheme;
  aiPreview: AIWebsiteCanvasPreview | null;
}) {
  const l = useLocalizer();
  const [marqueeRect, setMarqueeRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const marqueeCleanupRef = useRef<(() => void) | null>(null);
  const marqueeDidDragRef = useRef(false);
  const compact = device === 'mobile';
  const responsiveSection = effectiveSectionStyle(section, device);
  const configuredColumns = sectionColumnCount(section.layout);
  const previewColumns = compact ? 1 : device === 'tablet' && configuredColumns === 3 ? 2 : configuredColumns;
  const layoutGap = sectionLayoutGap(responsiveSection);
  const layoutAlign = sectionLayoutAlign(section);
  const visibleElements = section.elements.filter((element) => section.type !== 'contact' || element.type !== 'button');
  const previewContainers = (section.containers || []).filter((container) => visibleElements.some((element) => element.containerId === container.id));
  const previewEntries: Array<{ kind: 'element'; element: WebsiteElement; sourceIndex: number } | { kind: 'container'; container: WebsiteElementContainer; elements: WebsiteElement[]; sourceIndex: number }> = [];
  const seenContainers = new Set<string>();
  visibleElements.forEach((element, sourceIndex) => {
    const container = element.containerId ? previewContainers.find((item) => item.id === element.containerId) : undefined;
    if (!container) {
      previewEntries.push({ kind: 'element', element, sourceIndex });
      return;
    }
    if (seenContainers.has(container.id)) return;
    seenContainers.add(container.id);
    previewEntries.push({ kind: 'container', container, elements: visibleElements.filter((item) => item.containerId === container.id), sourceIndex });
  });
  const contactSubmitElement = section.type === 'contact' ? section.elements.find((element) => element.type === 'button') : undefined;
  const contactSubmitStyle = contactSubmitElement ? effectiveStyle(contactSubmitElement, device) : undefined;
  const sectionMinHeight = sectionVisualNumber(responsiveSection.minHeight, 0, 0, 1200);
  const sectionPaddingY = sectionVisualNumber(responsiveSection.sectionPaddingY, theme.sectionSpacing, 0, 240);
  const sectionPaddingX = sectionVisualNumber(responsiveSection.sectionPaddingX, compact ? 20 : 40, 0, 160);
  const sectionRadius = sectionVisualNumber(section.sectionRadius, 0, 0, 80);
  const sectionFullWidth = sectionContentWidth(section) === 'full';
  const draggingElementInSection = Boolean(
    draggedElementId && section.elements.some((element) => element.id === draggedElementId),
  );
  const sectionPreviewKind = aiPreview?.sectionKinds[section.id];

  useEffect(() => () => marqueeCleanupRef.current?.(), []);

  const beginMarqueeSelection = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-tayar-canvas-element-id], button, input, textarea, select, a, [contenteditable="true"]')) return;
    const sectionHost = event.currentTarget;
    const sectionBounds = sectionHost.getBoundingClientRect();
    const canvasScale = sectionHost.offsetWidth > 0 ? sectionBounds.width / sectionHost.offsetWidth : 1;
    const pointerId = event.pointerId;
    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    let started = false;
    let selectionBounds = { left: startClientX, right: startClientX, top: startClientY, bottom: startClientY };

    const cleanup = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      marqueeCleanupRef.current = null;
    };
    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const distance = Math.hypot(moveEvent.clientX - startClientX, moveEvent.clientY - startClientY);
      if (!started && distance < 4) return;
      started = true;
      moveEvent.preventDefault();
      selectionBounds = {
        left: Math.min(startClientX, moveEvent.clientX),
        right: Math.max(startClientX, moveEvent.clientX),
        top: Math.min(startClientY, moveEvent.clientY),
        bottom: Math.max(startClientY, moveEvent.clientY),
      };
      setMarqueeRect({
        left: (selectionBounds.left - sectionBounds.left) / canvasScale,
        top: (selectionBounds.top - sectionBounds.top) / canvasScale,
        width: (selectionBounds.right - selectionBounds.left) / canvasScale,
        height: (selectionBounds.bottom - selectionBounds.top) / canvasScale,
      });
    };
    const finish = (finishEvent: PointerEvent) => {
      if (finishEvent.pointerId !== pointerId) return;
      cleanup();
      setMarqueeRect(null);
      if (!started) return;
      marqueeDidDragRef.current = true;
      window.setTimeout(() => {
        marqueeDidDragRef.current = false;
      }, 0);
      const ids = Array.from(sectionHost.querySelectorAll<HTMLElement>('[data-tayar-canvas-element-id]'))
        .filter((node) => {
          const bounds = node.getBoundingClientRect();
          return bounds.right >= selectionBounds.left && bounds.left <= selectionBounds.right &&
            bounds.bottom >= selectionBounds.top && bounds.top <= selectionBounds.bottom;
        })
        .map((node) => node.dataset.tayarCanvasElementId || '')
        .filter(Boolean);
      onMarqueeSelect([...new Set(ids)], additive);
    };
    const cancel = () => {
      cleanup();
      setMarqueeRect(null);
    };

    event.preventDefault();
    event.stopPropagation();
    marqueeCleanupRef.current?.();
    marqueeCleanupRef.current = cleanup;
    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel, { once: true });
  };

  const handleSectionSelect = () => {
    if (marqueeDidDragRef.current) {
      marqueeDidDragRef.current = false;
      return;
    }
    onSelect();
  };

  const renderSelectedElementToolbar = (element: WebsiteElement) => {
    if (selectedElementId !== element.id) return null;
    const elementStyle = effectiveStyle(element, device);
    const width = clampElementNumber(elementStyle.width, 100, 10, 100);
    const positionX = clampElementNumber(elementStyle.positionX, 0, -4000, 4000);
    const positionY = clampElementNumber(elementStyle.positionY, 0, -4000, 4000);
    const hasFreePosition = positionX !== 0 || positionY !== 0;
    const directEditHint = element.type === 'image'
      ? 'Double-click replace'
      : element.type === 'video' || element.type === 'embed'
        ? 'Double-click source'
        : element.type === 'heading' || element.type === 'text' || element.type === 'button'
          ? 'Double-click edit'
          : null;
    return (
      <div
        draggable={false}
        className="absolute -top-9 z-40 flex max-w-full items-center gap-0.5 rounded-md border border-white/10 bg-[#111122]/95 p-0.5 shadow-lg backdrop-blur"
        style={{
          right: `${Math.max(0, 100 - width)}%`,
          transform: `translate3d(${positionX}px, ${positionY}px, 0)`,
        }}
        title={l('Drag with smart element and center guides · Hold Alt for 1px precision · Arrows nudge · Shift+arrow 10px · Ctrl/Cmd+D duplicate · Delete remove · Esc deselect · Shift+drag reorder')}
        onDragStart={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <MousePointer2 className="ml-1 h-3 w-3 shrink-0 text-gray-500" />
        <span className="max-w-20 truncate px-1 text-[8px] font-bold text-violet-300">{ELEMENT_LABELS[element.type]}</span>
        <span className="rounded bg-white/5 px-1 py-0.5 text-[7px] font-semibold text-gray-400">W {Math.round(width)}%</span>
        {directEditHint && (
          <span className="rounded bg-cyan-500/10 px-1 py-0.5 text-[7px] font-semibold text-cyan-300">{directEditHint}</span>
        )}
        {(hasFreePosition || draggedElementId === element.id) && (
          <span className="max-w-24 truncate rounded bg-white/5 px-1 py-0.5 text-[7px] font-semibold text-gray-400">
            X {positionX} · Y {positionY}{draggedElementId === element.id ? ` · ${CANVAS_GRID_SIZE}px` : ''}
          </span>
        )}
        {element.type === 'button' && (
          <button
            type="button"
            onClick={() => {
              const next = window.prompt('Button link', element.href || '#');
              if (next !== null) onQuickUpdateElement(element.id, { href: next.trim() || '#' });
            }}
            className="rounded p-1 text-cyan-300 hover:bg-cyan-500/15 hover:text-cyan-200"
            title={l('Edit button link')}
          >
            <Link className="h-3.5 w-3.5" />
          </button>
        )}
        {element.type === 'image' && (
          <button type="button" onClick={onOpenMediaLibrary} className="rounded p-1 text-cyan-300 hover:bg-cyan-500/15 hover:text-cyan-200" title={l('Open media library')}>
            <Images className="h-3.5 w-3.5" />
          </button>
        )}
        <button type="button" onClick={onOpenInspector} className="rounded p-1 text-gray-300 hover:bg-white/10 hover:text-white" title={l('Open inspector')}>
          <Palette className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={onDuplicateSelectedElement} className="rounded p-1 text-gray-300 hover:bg-white/10 hover:text-white" title={l('Duplicate')}>
          <Copy className="h-3.5 w-3.5" />
        </button>
        {hasFreePosition && (
          <button type="button" onClick={() => onResetElementPosition(element.id)} className="rounded p-1 text-cyan-300 hover:bg-cyan-500/15 hover:text-cyan-200" title={l('Reset position')}>
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
        <button type="button" onClick={onDeleteSelectedElement} className="rounded p-1 text-red-300 hover:bg-red-500/15 hover:text-red-200" title={l('Delete')}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const renderSelectedElementResizeHandle = (element: WebsiteElement) => {
    if (selectedElementId !== element.id) return null;
    const elementStyle = effectiveStyle(element, device);
    const width = clampElementNumber(elementStyle.width, 100, 10, 100);
    const positionX = clampElementNumber(elementStyle.positionX, 0, -4000, 4000);
    const positionY = clampElementNumber(elementStyle.positionY, 0, -4000, 4000);

    const beginResize = (edge: 'left' | 'right', event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const host = event.currentTarget.parentElement;
      if (!host) return;
      const hostWidth = Math.max(1, host.getBoundingClientRect().width);
      const startClientX = event.clientX;
      onResizeElementStart(element.id);

      const finishResize = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', finishResize);
        window.removeEventListener('pointercancel', finishResize);
        window.removeEventListener('blur', finishResize);
        onResizeElementEnd();
      };
      const handleMove = (moveEvent: PointerEvent) => {
        const frame = resolveCanvasResize({
          startWidth: width,
          startPositionX: positionX,
          deltaX: moveEvent.clientX - startClientX,
          hostWidth,
          edge,
          precisionMode: moveEvent.altKey,
        });
        onResizeElementFrame(element.id, edge === 'left' ? frame : { width: frame.width });
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', finishResize, { once: true });
      window.addEventListener('pointercancel', finishResize, { once: true });
      window.addEventListener('blur', finishResize, { once: true });
    };

    const resizeWithKeyboard = (edge: 'left' | 'right', event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      event.stopPropagation();
      const host = event.currentTarget.parentElement;
      if (!host) return;
      const hostWidth = Math.max(1, host.getBoundingClientRect().width);
      const stepPercent = event.altKey ? 1 : CANVAS_RESIZE_SNAP_STEP;
      const deltaX = (event.key === 'ArrowRight' ? stepPercent : -stepPercent) * hostWidth / 100;
      const frame = resolveCanvasResize({
        startWidth: width,
        startPositionX: positionX,
        deltaX,
        hostWidth,
        edge,
        precisionMode: event.altKey,
      });
      onResizeElementStart(element.id);
      onResizeElementFrame(element.id, edge === 'left' ? frame : { width: frame.width });
    };

    return (
      <>
        <div
          className="pointer-events-none absolute z-30 border-l-2 border-violet-400/80"
          style={{
            left: `${positionX}px`,
            top: `calc(8px + ${positionY}px)`,
            bottom: `calc(8px - ${positionY}px)`,
          }}
        />
        <div
          className="pointer-events-none absolute z-30 border-r-2 border-violet-400/80"
          style={{
            left: `calc(${width}% + ${positionX}px)`,
            top: `calc(8px + ${positionY}px)`,
            bottom: `calc(8px - ${positionY}px)`,
          }}
        />
        <button
          type="button"
          draggable={false}
          aria-label={l('Resize element')}
          title={`${l('Drag to resize')} · ${Math.round(width)}% · ←/→ · ${l('Hold Alt for 1% precision')}`}
          className="absolute z-50 h-3.5 w-3.5 cursor-ew-resize rounded-full border-2 border-white bg-violet-500 shadow-[0_0_0_3px_rgba(139,92,246,0.18)] transition hover:scale-125"
          style={{
            left: `calc(${positionX}px - 7px)`,
            top: `calc(50% + ${positionY}px - 7px)`,
          }}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => beginResize('left', event)}
          onKeyDown={(event) => resizeWithKeyboard('left', event)}
          onKeyUp={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') onResizeElementEnd(); }}
          onBlur={onResizeElementEnd}
        />
        <button
          type="button"
          draggable={false}
          aria-label={l('Resize element')}
          title={`${l('Drag to resize')} · ${Math.round(width)}% · ←/→ · ${l('Hold Alt for 1% precision')}`}
          className="absolute z-50 h-3.5 w-3.5 cursor-ew-resize rounded-full border-2 border-white bg-violet-500 shadow-[0_0_0_3px_rgba(139,92,246,0.18)] transition hover:scale-125"
          style={{
            left: `calc(${width}% + ${positionX}px - 7px)`,
            top: `calc(50% + ${positionY}px - 7px)`,
          }}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => beginResize('right', event)}
          onKeyDown={(event) => resizeWithKeyboard('right', event)}
          onKeyUp={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') onResizeElementEnd(); }}
          onBlur={onResizeElementEnd}
        />
      </>
    );
  };

  return (
    <section
      id={sectionDomId(section)}
      data-tayar-section-canvas="true"
      data-tayar-ai-target-section={section.id}
      data-tayar-ai-preview-kind={sectionPreviewKind}
      tabIndex={-1}
      onPointerDown={beginMarqueeSelection}
      onClick={handleSectionSelect}
      className={`relative group cursor-pointer border border-transparent transition-all duration-150 ${sectionPreviewKind ? aiWebsitePatchPreviewClass(sectionPreviewKind) : selected ? 'ring-2 ring-violet-500/70 ring-inset' : 'hover:ring-1 hover:ring-violet-400/35 hover:ring-inset'}`}
      style={{
        background: sectionBackgroundCss(section),
        minHeight: sectionMinHeight ? `${sectionMinHeight}px` : undefined,
        borderRadius: `${sectionRadius}px`,
        overflow: 'hidden',
      }}
    >
      {sectionPreviewKind && (
        <span className={`pointer-events-none absolute left-1/2 top-2 z-[65] -translate-x-1/2 rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-wide shadow-lg backdrop-blur ${sectionPreviewKind === 'remove' ? 'border-red-300/40 bg-red-500/90 text-white' : sectionPreviewKind === 'add' ? 'border-emerald-300/40 bg-emerald-500/90 text-white' : 'border-violet-300/40 bg-violet-500/90 text-white'}`}>
          {l(sectionPreviewKind === 'remove' ? 'AI will remove' : sectionPreviewKind === 'add' ? 'AI will add here' : 'AI will update')}
        </span>
      )}
      {draggingElementInSection && (
        <div
          data-tayar-canvas-grid="true"
          className="pointer-events-none absolute inset-0 z-10 opacity-70"
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(139,92,246,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(139,92,246,0.16) 1px, transparent 1px)',
            backgroundSize: `${CANVAS_GRID_SIZE}px ${CANVAS_GRID_SIZE}px`,
          }}
        />
      )}
      {snapGuides?.vertical && (
        <span
          data-tayar-snap-guide="vertical"
          className="pointer-events-none absolute bottom-0 top-0 z-20 w-px -translate-x-1/2 bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]"
          style={{ left: snapGuides.verticalPosition === undefined ? '50%' : `${snapGuides.verticalPosition}px` }}
        />
      )}
      {snapGuides?.horizontal && (
        <span
          data-tayar-snap-guide="horizontal"
          className="pointer-events-none absolute left-0 right-0 z-20 h-px -translate-y-1/2 bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]"
          style={{ top: snapGuides.horizontalPosition === undefined ? '50%' : `${snapGuides.horizontalPosition}px` }}
        />
      )}
      {marqueeRect && (
        <span
          data-tayar-marquee-selection="true"
          className="pointer-events-none absolute z-[55] border border-violet-300 bg-violet-500/15 shadow-[0_0_18px_rgba(139,92,246,0.28)]"
          style={marqueeRect}
        />
      )}
      {selected && !selectedElementId && (
        <>
          <div className="absolute left-2 top-2 z-30 flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[10px] font-semibold text-white shadow-lg">
            <MousePointer2 className="h-3 w-3" /> {SECTION_LABELS[section.type]}
          </div>
          <div
            draggable={false}
            className="absolute right-2 top-2 z-30 flex items-center gap-0.5 rounded-lg border border-white/10 bg-[#111122]/95 p-1 shadow-xl backdrop-blur"
            onDragStart={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={() => onMoveSection('up')} disabled={!canMoveSectionUp} className="rounded-md p-1.5 text-gray-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30" title={l('Move section up')}>
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => onMoveSection('down')} disabled={!canMoveSectionDown} className="rounded-md p-1.5 text-gray-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30" title={l('Move section down')}>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onDeleteSection} disabled={!canDeleteSection} className="rounded-md p-1.5 text-red-300 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-30" title={l('Delete section')}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}
      <div
        className="mx-auto min-h-[260px] w-full"
        style={{
          maxWidth: sectionFullWidth || compact ? undefined : `${theme.contentWidth}px`,
          paddingTop: `${sectionPaddingY}px`,
          paddingBottom: `${sectionPaddingY}px`,
          paddingLeft: `${sectionPaddingX}px`,
          paddingRight: `${sectionPaddingX}px`,
        }}
      >
        <div
          className={previewColumns === 1 ? 'flex w-full flex-col justify-center' : 'grid w-full content-center'}
          style={previewColumns === 1
            ? { gap: `${layoutGap}px`, alignItems: layoutAlign }
            : { gridTemplateColumns: `repeat(${previewColumns}, minmax(0, 1fr))`, gap: `${layoutGap}px`, justifyItems: layoutAlign }}
        >
          {previewEntries.map((entry) => {
            if (entry.kind === 'container') {
              const first = entry.elements[0];
              const fallbackColumn = previewColumns === 1 ? 1 : Math.min(previewColumns, elementColumn(first, entry.sourceIndex, configuredColumns));
              const column = containerColumn(entry.container, fallbackColumn, previewColumns);
              const span = containerColumnSpan(entry.container, column, previewColumns);
              const alignItems = entry.container.align === 'start' ? 'flex-start' : entry.container.align === 'end' ? 'flex-end' : entry.container.align === 'stretch' ? 'stretch' : 'center';
              const justifyContent = entry.container.justify === 'start' ? 'flex-start' : entry.container.justify === 'end' ? 'flex-end' : entry.container.justify === 'between' ? 'space-between' : 'center';
              const containerGap = clampElementNumber(entry.container.gap, 16, 0, 80);
              const configuredContainerColumns = Math.round(clampElementNumber(entry.container.columns, 2, 1, 12));
              const containerColumns = device === 'mobile' ? 1 : device === 'tablet' ? Math.min(2, configuredContainerColumns) : configuredContainerColumns;
              return (
                <div
                  key={entry.container.id}
                  data-tayar-ai-target-container={entry.container.id}
                  data-tayar-ai-preview-kind={aiPreview?.containerKinds[entry.container.id]}
                  tabIndex={-1}
                  className={`relative flex min-w-0 w-full flex-col rounded-lg transition ${aiWebsitePatchPreviewClass(aiPreview?.containerKinds[entry.container.id])}`}
                  style={{ gridColumn: previewColumns === 1 ? '1 / span 1' : `${column} / span ${span}` }}
                >
                  <div className="absolute -top-2 left-2 z-20 rounded bg-cyan-600 px-1.5 py-0.5 text-[9px] font-bold text-white">{entry.container.name}</div>
                  <div
                    className="min-w-0 w-full"
                    style={{
                      display: entry.container.layout === 'grid' ? 'grid' : 'flex',
                      flexDirection: entry.container.layout === 'row' && device !== 'mobile' ? 'row' : 'column',
                      flexWrap: entry.container.wrap === false ? 'nowrap' : 'wrap',
                      gridTemplateColumns: entry.container.layout === 'grid' ? `repeat(${containerColumns}, minmax(0, 1fr))` : undefined,
                      columnGap: `${containerGap}px`,
                      rowGap: `${clampElementNumber(entry.container.rowGap, containerGap, 0, 80)}px`,
                      alignItems,
                      justifyContent,
                      background: entry.container.backgroundColor || 'transparent',
                      padding: `${clampElementNumber(entry.container.padding, 20, 0, 120)}px`,
                      borderRadius: `${clampElementNumber(entry.container.borderRadius, 16, 0, 120)}px`,
                      borderWidth: `${clampElementNumber(entry.container.borderWidth, 1, 0, 16)}px`,
                      borderStyle: 'solid',
                      borderColor: entry.container.borderColor || 'transparent',
                      boxShadow: elementShadowCss(entry.container.shadow),
                    }}
                  >
                    {entry.elements.map((element) => {
                      const elementLayoutStyle = effectiveStyle(element, device);
                      const hiddenOnDevice = elementLayoutStyle.hidden === true;
                      return (
                        <div
                          key={element.id}
                          data-tayar-ai-target-element={element.id}
                          data-tayar-ai-preview-kind={aiPreview?.elementKinds[element.id]}
                          tabIndex={-1}
                          className={`relative flex min-w-0 flex-col rounded-md transition ${aiWebsitePatchPreviewClass(aiPreview?.elementKinds[element.id])}`}
                          style={{
                            flexGrow: clampElementNumber(elementLayoutStyle.flexGrow, entry.container.layout === 'row' ? 1 : 0, 0, 20),
                            flexShrink: clampElementNumber(elementLayoutStyle.flexShrink, 1, 0, 20),
                            flexBasis: entry.container.layout === 'row' && device !== 'mobile' ? '180px' : 'auto',
                            width: entry.container.layout === 'stack' || device === 'mobile' ? '100%' : 'auto',
                            minWidth: elementLayoutStyle.minWidth ? `${clampElementNumber(elementLayoutStyle.minWidth, 0, 0, 2400)}px` : 0,
                            maxWidth: elementLayoutStyle.maxWidth ? `${clampElementNumber(elementLayoutStyle.maxWidth, 0, 0, 2400)}px` : undefined,
                            order: clampElementNumber(elementLayoutStyle.order, 0, -50, 50),
                            marginTop: `${clampElementNumber(elementLayoutStyle.marginTop, 0, -200, 400)}px`,
                            marginRight: `${clampElementNumber(elementLayoutStyle.marginRight, 0, -200, 400)}px`,
                            marginBottom: `${clampElementNumber(elementLayoutStyle.marginBottom, 0, -200, 400)}px`,
                            marginLeft: `${clampElementNumber(elementLayoutStyle.marginLeft, 0, -200, 400)}px`,
                            opacity: hiddenOnDevice ? 0.32 : 1,
                          }}
                        >
                          {dragOverElementId === element.id && dragOverElementPosition && draggedElementId !== element.id && (
                            <span className={`pointer-events-none absolute left-0 right-0 z-50 h-0.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.75)] ${dragOverElementPosition === 'before' ? '-top-2' : '-bottom-2'}`} />
                          )}
                          {hiddenOnDevice && <span className="absolute right-1 top-1 z-20 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-black">Hidden on {device}</span>}
                          {renderSelectedElementToolbar(element)}
                          {renderSelectedElementResizeHandle(element)}
                          <ElementPreview
                            element={element}
                            selected={selectedElementIds.includes(element.id)}
                            dragging={draggedElementId === element.id}
                            dragOver={dragOverElementId === element.id && draggedElementId !== element.id}
                            device={device}
                            onSelect={(additive, range) => onSelectElement(element.id, additive, range)}
                            onDragStart={(e) => onElementDragStart(element.id, e)}
                            onDragMove={(e) => onElementDragMove(element.id, e)}
                            onPointerDragStart={(e) => onElementPointerDragStart(element.id, e)}
                            onDragOver={(e) => onElementDragOver(element.id, e)}
                            onDrop={(e) => onElementDrop(element.id, e)}
                            onDragEnd={onElementDragEnd}
                            onInlineContentChange={(content) => onInlineContentChange(element.id, content)}
                            onInlineSourceChange={(src) => onInlineSourceChange(element.id, src)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const element = entry.element;
            const column = previewColumns === 1 ? 1 : Math.min(previewColumns, elementColumn(element, entry.sourceIndex, configuredColumns));
            const elementLayoutStyle = effectiveStyle(element, device);
            const span = elementColumnSpan(elementLayoutStyle, column, previewColumns);
            const selfAlign = elementLayoutStyle.alignSelf === 'start' || elementLayoutStyle.alignSelf === 'center' || elementLayoutStyle.alignSelf === 'end' || elementLayoutStyle.alignSelf === 'stretch'
              ? elementLayoutStyle.alignSelf
              : undefined;
            const hiddenOnDevice = elementLayoutStyle.hidden === true;
            const wrapperStyle: React.CSSProperties = {
              gridColumn: previewColumns === 1 ? '1 / span 1' : `${column} / span ${span}`,
              alignItems: layoutAlign,
              order: clampElementNumber(elementLayoutStyle.order, 0, -50, 50),
              marginTop: `${clampElementNumber(elementLayoutStyle.marginTop, 0, -200, 400)}px`,
              marginRight: `${clampElementNumber(elementLayoutStyle.marginRight, 0, -200, 400)}px`,
              marginBottom: `${clampElementNumber(elementLayoutStyle.marginBottom, 0, -200, 400)}px`,
              marginLeft: `${clampElementNumber(elementLayoutStyle.marginLeft, 0, -200, 400)}px`,
              maxWidth: elementLayoutStyle.maxWidth ? `${clampElementNumber(elementLayoutStyle.maxWidth, 0, 0, 2000)}px` : undefined,
              minWidth: elementLayoutStyle.minWidth ? `${clampElementNumber(elementLayoutStyle.minWidth, 0, 0, 2400)}px` : 0,
              flexGrow: clampElementNumber(elementLayoutStyle.flexGrow, 0, 0, 20),
              flexShrink: clampElementNumber(elementLayoutStyle.flexShrink, 1, 0, 20),
              alignSelf: selfAlign,
              justifySelf: selfAlign,
              opacity: hiddenOnDevice ? 0.32 : 1,
            };
            return (
              <div key={element.id} data-tayar-ai-target-element={element.id} data-tayar-ai-preview-kind={aiPreview?.elementKinds[element.id]} tabIndex={-1} className={`relative flex min-w-0 w-full flex-col rounded-md transition ${aiWebsitePatchPreviewClass(aiPreview?.elementKinds[element.id])}`} style={wrapperStyle}>
                {dragOverElementId === element.id && dragOverElementPosition && draggedElementId !== element.id && (
                  <span className={`pointer-events-none absolute left-0 right-0 z-50 h-0.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.75)] ${dragOverElementPosition === 'before' ? '-top-2' : '-bottom-2'}`} />
                )}
                {hiddenOnDevice && (
                  <span className="absolute right-1 top-1 z-20 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-black">Hidden on {device}</span>
                )}
                {renderSelectedElementToolbar(element)}
                {renderSelectedElementResizeHandle(element)}
                <ElementPreview
                  element={element}
                  selected={selectedElementIds.includes(element.id)}
                  dragging={draggedElementId === element.id}
                  dragOver={dragOverElementId === element.id && draggedElementId !== element.id}
                  device={device}
                  onSelect={(additive, range) => onSelectElement(element.id, additive, range)}
                  onDragStart={(e) => onElementDragStart(element.id, e)}
                  onDragMove={(e) => onElementDragMove(element.id, e)}
                  onPointerDragStart={(e) => onElementPointerDragStart(element.id, e)}
                  onDragOver={(e) => onElementDragOver(element.id, e)}
                  onDrop={(e) => onElementDrop(element.id, e)}
                  onDragEnd={onElementDragEnd}
                  onInlineContentChange={(content) => onInlineContentChange(element.id, content)}
                  onInlineSourceChange={(src) => onInlineSourceChange(element.id, src)}
                />
              </div>
            );
          })}
        </div>
        {selected && (
          <div className="flex justify-center px-4 pb-4 pt-2">
            <details
              className="relative"
              draggable={false}
              onDragStart={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-violet-400/30 bg-[#111122]/90 px-3 py-1.5 text-[10px] font-bold text-violet-200 shadow-lg backdrop-blur hover:bg-violet-500/15 [&::-webkit-details-marker]:hidden">
                <Plus className="h-3.5 w-3.5" /> {l('Add element')}
              </summary>
              <div className="absolute bottom-9 left-1/2 z-50 grid w-52 -translate-x-1/2 grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#111122] p-2 shadow-2xl">
                {(['heading', 'text', 'button', 'image'] as WebsiteElementType[]).map((type) => (
                  <button key={type} type="button" onClick={() => onAddElement(type)} className="rounded-lg px-2 py-2 text-left text-[10px] font-semibold text-gray-200 hover:bg-white/10">
                    + {ELEMENT_LABELS[type]}
                  </button>
                ))}
                <button type="button" onClick={() => onAddElement('spacer')} className="rounded-lg px-2 py-2 text-left text-[10px] font-semibold text-gray-200 hover:bg-white/10">+ {ELEMENT_LABELS.spacer}</button>
                <button type="button" onClick={() => onAddElement('divider')} className="rounded-lg px-2 py-2 text-left text-[10px] font-semibold text-gray-200 hover:bg-white/10">+ {ELEMENT_LABELS.divider}</button>
              </div>
            </details>
          </div>
        )}
                {section.type === 'contact' && (
          <div className={`mx-auto mt-5 grid w-full max-w-xl gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 ${compact ? 'text-xs' : 'text-sm'}`}>
            {(section.formFields ?? createDefaultContactFormFields()).map((field) => (
              field.type === 'checkbox' ? (
                <label key={field.id} className="flex items-center gap-2 text-left text-gray-300">
                  <input type="checkbox" disabled className="h-4 w-4" />
                  <span>{field.label}{field.required ? ' *' : ''}</span>
                </label>
              ) : field.type === 'textarea' ? (
                <label key={field.id} className="grid gap-1.5 text-left text-gray-300">
                  <span className="text-[11px] font-semibold">{field.label}{field.required ? ' *' : ''}</span>
                  <textarea disabled rows={3} placeholder={field.placeholder} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-gray-400" />
                </label>
              ) : field.type === 'select' ? (
                <label key={field.id} className="grid gap-1.5 text-left text-gray-300">
                  <span className="text-[11px] font-semibold">{field.label}{field.required ? ' *' : ''}</span>
                  <select disabled className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-gray-400">
                    <option>{field.placeholder || 'Choose an option'}</option>
                  </select>
                </label>
              ) : field.type === 'radio' ? (
                <fieldset key={field.id} className="grid gap-1.5 text-left text-gray-300">
                  <legend className="text-[11px] font-semibold">{field.label}{field.required ? ' *' : ''}</legend>
                  {(field.options || []).slice(0, 3).map((option) => <label key={option} className="flex items-center gap-2"><input type="radio" disabled /><span>{option}</span></label>)}
                </fieldset>
              ) : field.type === 'file' ? (
                <label key={field.id} className="grid gap-1.5 text-left text-gray-300">
                  <span className="text-[11px] font-semibold">{field.label}{field.required ? ' *' : ''}</span>
                  <input disabled type="file" className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-gray-400" />
                </label>
              ) : (
                <label key={field.id} className="grid gap-1.5 text-left text-gray-300">
                  <span className="text-[11px] font-semibold">{field.label}{field.required ? ' *' : ''}</span>
                  <input disabled type={['email', 'tel', 'url', 'number', 'date'].includes(field.type) ? field.type : 'text'} placeholder={field.placeholder} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-gray-400" />
                </label>
              )
            ))}
            <div data-tayar-ai-target-element={contactSubmitElement?.id} data-tayar-ai-preview-kind={contactSubmitElement ? aiPreview?.elementKinds[contactSubmitElement.id] : undefined} tabIndex={-1} className={`relative rounded-md transition ${contactSubmitElement ? aiWebsitePatchPreviewClass(aiPreview?.elementKinds[contactSubmitElement.id]) : ''}`}>
              {contactSubmitElement && renderSelectedElementToolbar(contactSubmitElement)}
              {contactSubmitElement && renderSelectedElementResizeHandle(contactSubmitElement)}
            {contactSubmitStyle?.hidden ? (
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); if (contactSubmitElement) onSelectElement(contactSubmitElement.id, event.shiftKey || event.metaKey || event.ctrlKey); }}
                className={`rounded-lg border border-dashed border-amber-400/60 px-4 py-3 text-xs font-semibold text-amber-300 ${contactSubmitElement && selectedElementIds.includes(contactSubmitElement.id) ? 'ring-2 ring-violet-400' : ''}`}
              >
                Submit button hidden on {device}
              </button>
            ) : (
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); if (contactSubmitElement) onSelectElement(contactSubmitElement.id, event.shiftKey || event.metaKey || event.ctrlKey); }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!contactSubmitElement) return;
                  onSelectElement(contactSubmitElement.id);
                  const nextText = window.prompt('Button text', contactSubmitElement.content || '')?.trim();
                  if (nextText && nextText !== contactSubmitElement.content) onInlineContentChange(contactSubmitElement.id, nextText);
                }}
                title={l('Double-click to edit button text')}
                className={`font-semibold opacity-90 transition ${contactSubmitElement && selectedElementIds.includes(contactSubmitElement.id) ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-transparent' : 'hover:ring-1 hover:ring-violet-400/40'}`}
                style={{
                  color: contactSubmitStyle?.color || '#ffffff',
                  background: contactSubmitStyle?.backgroundColor || section.accent,
                  fontSize: contactSubmitStyle?.fontSize ? `${contactSubmitStyle.fontSize}px` : undefined,
                  fontWeight: contactSubmitStyle?.fontWeight,
                  padding: `${clampElementNumber(contactSubmitStyle?.padding, 12, 0, 160)}px`,
                  borderRadius: `${clampElementNumber(contactSubmitStyle?.borderRadius, theme.buttonRadius, 0, 160)}px`,
                  width: contactSubmitStyle?.width ? `${clampElementNumber(contactSubmitStyle.width, 100, 0, 100)}%` : undefined,
                  maxWidth: contactSubmitStyle?.maxWidth ? `${clampElementNumber(contactSubmitStyle.maxWidth, 0, 0, 2000)}px` : undefined,
                  marginTop: `${clampElementNumber(contactSubmitStyle?.marginTop, 0, -200, 400)}px`,
                  marginRight: `${clampElementNumber(contactSubmitStyle?.marginRight, 0, -200, 400)}px`,
                  marginBottom: `${clampElementNumber(contactSubmitStyle?.marginBottom, 0, -200, 400)}px`,
                  marginLeft: `${clampElementNumber(contactSubmitStyle?.marginLeft, 0, -200, 400)}px`,
                  order: clampElementNumber(contactSubmitStyle?.order, 0, -50, 50),
                }}
              >
                {contactSubmitElement?.content || section.buttonText || 'Send Message'}
              </button>
            )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
