import { useState, type CSSProperties, type ReactNode } from 'react';
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

  const changeZoom = (direction: -1 | 1) => {
    setCanvasZoom((current) => Math.max(50, Math.min(150, current + direction * 25)));
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
            <button type="button" onClick={() => setCanvasZoom(100)} aria-label={`${l('Reset')} 100%`} title={`${l('Reset')} 100%`}>{canvasZoom}%</button>
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
      <div className="tayar-v2-canvas__viewport" data-device={view.previewDevice}>
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
