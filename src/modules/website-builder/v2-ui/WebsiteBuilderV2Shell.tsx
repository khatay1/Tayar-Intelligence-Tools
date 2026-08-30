import type { ReactNode } from 'react';
import type { EditorShellContract } from '../core/editor-shell-contract';
import type { EditorInspectorTab, EditorLeftPanel } from '../core/editor-layout';
import { BuilderCanvasFrame } from './BuilderCanvasFrame';
import { BuilderInspector } from './BuilderInspector';
import { BuilderLeftSidebar } from './BuilderLeftSidebar';
import { BuilderStatusBar } from './BuilderStatusBar';
import { BuilderTopbar } from './BuilderTopbar';

export interface WebsiteBuilderV2ShellProps {
  shell: EditorShellContract;
  brandSlot?: ReactNode;
  topbarCenterSlot?: ReactNode;
  topbarTrailingSlot?: ReactNode;
  canvas: ReactNode;
  canvasOverlaySlot?: ReactNode;
  renderLeftPanel(panel: EditorLeftPanel): ReactNode;
  renderInspector(target: EditorShellContract['view']['inspectorTarget'], tab: EditorInspectorTab): ReactNode;
}

export function WebsiteBuilderV2Shell(props: WebsiteBuilderV2ShellProps) {
  const { shell } = props;
  return (
    <div
      className="tayar-v2-shell"
      data-focus={shell.view.focusMode ? 'true' : 'false'}
      data-left-open={shell.view.focusMode ? 'false' : 'true'}
      data-inspector-open={shell.view.focusMode ? 'false' : 'true'}
    >
      <BuilderTopbar
        shell={shell}
        brandSlot={props.brandSlot}
        centerSlot={props.topbarCenterSlot}
        trailingSlot={props.topbarTrailingSlot}
      />
      <div className="tayar-v2-shell__workspace">
        {!shell.view.focusMode && (
          <BuilderLeftSidebar shell={shell} renderPanel={props.renderLeftPanel} />
        )}
        <BuilderCanvasFrame shell={shell} overlaySlot={props.canvasOverlaySlot}>
          {props.canvas}
        </BuilderCanvasFrame>
        {!shell.view.focusMode && (
          <BuilderInspector shell={shell} renderInspector={props.renderInspector} />
        )}
      </div>
      <BuilderStatusBar shell={shell} />
    </div>
  );
}
