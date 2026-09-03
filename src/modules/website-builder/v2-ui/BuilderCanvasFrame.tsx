import type { ReactNode } from 'react';
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
  return (
    <main className="tayar-v2-canvas" data-device={view.previewDevice} data-focus={view.focusMode ? 'true' : 'false'}>
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
        <button type="button" onClick={actions.onToggleFocus}>
          {view.focusMode ? l('Exit focus') : l('Focus on canvas')}
        </button>
      </div>
      <div className="tayar-v2-canvas__viewport" data-device={view.previewDevice}>
        {children}
        {overlaySlot}
      </div>
    </main>
  );
}
