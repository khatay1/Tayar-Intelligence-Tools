import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocalizer } from '@/lib/ui-localization';
import type { EditorShellContract } from '../core/editor-shell-contract';
import type { EditorPreviewDevice } from '../core/editor-layout';

const DEVICES: Array<{ id: EditorPreviewDevice; label: string }> = [
  { id: 'desktop', label: 'Desktop' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'mobile', label: 'Mobile' },
];

export interface BuilderCanvasFrameProps {
  shell: EditorShellContract;
  children?: ReactNode;
  overlaySlot?: ReactNode;
}

export function BuilderCanvasFrame({ shell, children, overlaySlot }: BuilderCanvasFrameProps) {
  const l = useLocalizer();
  const { view, actions } = shell;
  const [canvasZoom, setCanvasZoom] = useState(100);
  const [spacePanReady, setSpacePanReady] = useState(false);
  const [canvasPanning, setCanvasPanning] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasHoverRef = useRef(false);
  const panSessionRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null>(null);

  const setZoomAroundPoint = useCallback((nextZoom: number, clientX?: number, clientY?: number) => {
    const viewport = viewportRef.current;
    const boundedZoom = Math.max(50, Math.min(150, nextZoom));
    if (boundedZoom === canvasZoom) return;
    const previousZoom = canvasZoom;
    const viewportBounds = viewport?.getBoundingClientRect();
    const anchorX = viewport && viewportBounds
      ? (clientX === undefined ? viewport.clientWidth / 2 : clientX - viewportBounds.left)
      : 0;
    const anchorY = viewport && viewportBounds
      ? (clientY === undefined ? viewport.clientHeight / 2 : clientY - viewportBounds.top)
      : 0;
    const previousScrollLeft = viewport?.scrollLeft || 0;
    const previousScrollTop = viewport?.scrollTop || 0;
    const ratio = boundedZoom / previousZoom;
    setCanvasZoom(boundedZoom);
    if (viewport) {
      window.requestAnimationFrame(() => {
        viewport.scrollLeft = ((previousScrollLeft + anchorX) * ratio) - anchorX;
        viewport.scrollTop = ((previousScrollTop + anchorY) * ratio) - anchorY;
      });
    }
  }, [canvasZoom]);

  const changeZoom = useCallback((direction: -1 | 1) => {
    setZoomAroundPoint(canvasZoom + direction * 25);
  }, [canvasZoom, setZoomAroundPoint]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const editingText = Boolean(target && (target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"]')));
      if (editingText || !canvasHoverRef.current) return;
      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        setSpacePanReady(true);
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '=' || event.key === '-')) {
        event.preventDefault();
        changeZoom(event.key === '-' ? -1 : 1);
      }
      if ((event.ctrlKey || event.metaKey) && event.key === '0') {
        event.preventDefault();
        setZoomAroundPoint(100);
      }
    };
    const releaseSpace = (event?: KeyboardEvent) => {
      if (!event || event.code === 'Space') setSpacePanReady(false);
    };
    const cancelPan = () => {
      panSessionRef.current = null;
      setCanvasPanning(false);
      setSpacePanReady(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', releaseSpace);
    window.addEventListener('blur', cancelPan);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', releaseSpace);
      window.removeEventListener('blur', cancelPan);
    };
  }, [changeZoom, setZoomAroundPoint]);

  const beginCanvasPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const wantsPan = event.button === 1 || (event.button === 0 && spacePanReady);
    if (!wantsPan) return;
    event.preventDefault();
    event.stopPropagation();
    const viewport = event.currentTarget;
    panSessionRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: viewport.scrollLeft,
      startScrollTop: viewport.scrollTop,
    };
    viewport.setPointerCapture(event.pointerId);
    setCanvasPanning(true);
  };

  const moveCanvasPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const pan = panSessionRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.scrollLeft = pan.startScrollLeft - (event.clientX - pan.startClientX);
    event.currentTarget.scrollTop = pan.startScrollTop - (event.clientY - pan.startClientY);
  };

  const finishCanvasPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const pan = panSessionRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    panSessionRef.current = null;
    setCanvasPanning(false);
  };

  return (
    <main className="tayar-v2-canvas" data-device={view.previewDevice} data-focus={view.focusMode ? 'true' : 'false'} data-zoom={canvasZoom}>
      <div className="tayar-v2-canvas__toolbar">
        <div role="group" aria-label={l('Preview device')}>
          {DEVICES.map((device) => (
            <button
              key={device.id}
              type="button"
              aria-pressed={view.previewDevice === device.id}
              onClick={() => actions.onSetPreviewDevice(device.id)}
            >
              {l(device.label)}
            </button>
          ))}
        </div>
        <div className="tayar-v2-canvas__toolbar-actions">
          <div className="tayar-v2-canvas__zoom" role="group" aria-label={`${l('Zoom Out')} / ${l('Zoom In')}`}>
            <button type="button" onClick={() => changeZoom(-1)} disabled={canvasZoom <= 50} aria-label={l('Zoom Out')}>−</button>
            <button type="button" onClick={() => setZoomAroundPoint(100)} aria-label={`${l('Reset')} 100%`} title={`${l('Reset')} 100%`}>{canvasZoom}%</button>
            <button type="button" onClick={() => changeZoom(1)} disabled={canvasZoom >= 150} aria-label={l('Zoom In')}>+</button>
          </div>
          <button
            type="button"
            onClick={actions.onToggleFocus}
            aria-keyshortcuts="Escape"
            title={view.focusMode ? l('Exit focus') : l('Focus on canvas')}
          >
            {view.focusMode ? l('Exit focus') : l('Focus on canvas')}
          </button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className="tayar-v2-canvas__viewport"
        data-device={view.previewDevice}
        data-pan-ready={spacePanReady ? 'true' : 'false'}
        data-panning={canvasPanning ? 'true' : 'false'}
        onPointerEnter={() => { canvasHoverRef.current = true; }}
        onPointerLeave={() => { if (!canvasPanning) canvasHoverRef.current = false; }}
        onPointerDownCapture={beginCanvasPan}
        onPointerMoveCapture={moveCanvasPan}
        onPointerUpCapture={finishCanvasPan}
        onPointerCancelCapture={finishCanvasPan}
        onWheel={(event) => {
          if (!event.ctrlKey && !event.metaKey) return;
          event.preventDefault();
          setZoomAroundPoint(canvasZoom + (event.deltaY > 0 ? -10 : 10), event.clientX, event.clientY);
        }}
        title={l('Hold Space and drag to pan')}
      >
        <div
          className="tayar-v2-canvas__surface"
          style={{ '--tayar-canvas-zoom': canvasZoom / 100 } as CSSProperties}
        >
          {children}
          {overlaySlot}
        </div>
      </div>
    </main>
  );
}
