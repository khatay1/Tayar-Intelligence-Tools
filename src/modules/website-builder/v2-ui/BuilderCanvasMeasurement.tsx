import { useMemo } from 'react';
import type { CanvasSnapGuides } from '../core/editor-canvas-geometry';
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
  guides?: CanvasSnapGuides;
  onHover?(id?: string): void;
}

export function BuilderCanvasMeasurement({ shell, targets, selection = {}, activeTargetId, guides, onHover }: BuilderCanvasMeasurementProps) {
  const overlay = useMemo(() => buildEditorCanvasOverlay(targets, selection, activeTargetId), [targets, selection, activeTargetId]);
  return <BuilderCanvasOverlay shell={shell} items={overlay} guides={guides} onHover={onHover} />;
}
