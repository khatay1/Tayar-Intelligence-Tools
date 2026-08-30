import { useMemo } from 'react';
import { buildEditorCanvasOverlay } from '../core/editor-canvas-overlay';
import type { EditorCanvasTargetRect } from '../core/editor-canvas-overlay';
import type { EditorSelection } from '../core/editor-selection';
import type { EditorShellContract } from '../core/editor-shell-contract';
import { BuilderCanvasOverlay } from './BuilderCanvasOverlay';

export interface BuilderCanvasMeasurementProps {
  shell: EditorShellContract;
  targets: EditorCanvasTargetRect[];
  selection?: EditorSelection;
  activeTargetId?: string;
  onHover?(id?: string): void;
}

export function BuilderCanvasMeasurement({ shell, targets, selection = {}, activeTargetId, onHover }: BuilderCanvasMeasurementProps) {
  const overlay = useMemo(() => buildEditorCanvasOverlay(targets, selection, activeTargetId), [targets, selection, activeTargetId]);
  return <BuilderCanvasOverlay shell={shell} items={overlay} onHover={onHover} />;
}
