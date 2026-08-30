import type { EditorCommand } from './editor-command';
import {
  applyEditorControllerNativePatch,
  createEditorControllerState,
  executeEditorControllerCommand,
  markEditorControllerSaved,
  redoEditorController,
  setEditorControllerLayout,
  setEditorControllerSelection,
  undoEditorController,
  type EditorControllerState,
} from './editor-controller';
import type { EditorSessionOptions } from './editor-session';
import type { ApplyEditorNativePatchOptions } from './editor-native-patch';
import type { EditorLayoutState } from './editor-layout';
import type { EditorProjectLike } from './editor-model';
import type { EditorNativeOperation } from './editor-native-operation';
import type { EditorSelection } from './editor-selection';

export type EditorStoreListener<P extends EditorProjectLike> = (
  state: EditorControllerState<P>,
  previous: EditorControllerState<P>,
) => void;

export interface EditorStoreMutation {
  changed: boolean;
  errors: string[];
  warnings: string[];
}

export class EditorStore<P extends EditorProjectLike> {
  private state: EditorControllerState<P>;
  private listeners = new Set<EditorStoreListener<P>>();

  constructor(project: P, options: { selection?: EditorSelection; layout?: EditorLayoutState } = {}) {
    this.state = createEditorControllerState(project, options);
  }

  getSnapshot = () => this.state;

  subscribe = (listener: EditorStoreListener<P>) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private commit(next: EditorControllerState<P>) {
    if (next === this.state) return false;
    const previous = this.state;
    this.state = next;
    this.listeners.forEach((listener) => listener(this.state, previous));
    return true;
  }

  select(selection: EditorSelection) {
    return this.commit(setEditorControllerSelection(this.state, selection));
  }

  setLayout(layout: EditorLayoutState) {
    return this.commit(setEditorControllerLayout(this.state, layout));
  }

  execute(command: EditorCommand<P>, options: EditorSessionOptions<P> = {}): EditorStoreMutation {
    const result = executeEditorControllerCommand(this.state, command, options);
    if (result.changed) this.commit(result.state);
    return { changed: result.changed, errors: result.errors, warnings: result.warnings };
  }

  applyNativePatch(
    operations: EditorNativeOperation[],
    options: ApplyEditorNativePatchOptions<P> = {},
  ): EditorStoreMutation {
    const result = applyEditorControllerNativePatch(this.state, operations, options);
    if (result.changed) this.commit(result.state);
    return { changed: result.changed, errors: result.errors, warnings: result.warnings };
  }

  undo(): EditorStoreMutation {
    const result = undoEditorController(this.state);
    if (result.changed) this.commit(result.state);
    return { changed: result.changed, errors: result.errors, warnings: result.warnings };
  }

  redo(): EditorStoreMutation {
    const result = redoEditorController(this.state);
    if (result.changed) this.commit(result.state);
    return { changed: result.changed, errors: result.errors, warnings: result.warnings };
  }

  markSaved(savedAt = Date.now()) {
    return this.commit(markEditorControllerSaved(this.state, savedAt));
  }
}
