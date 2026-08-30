export type EditorShortcutAction =
  | 'undo'
  | 'redo'
  | 'save'
  | 'preview'
  | 'focus-canvas'
  | 'duplicate'
  | 'delete';

export interface EditorShortcutInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  targetTagName?: string;
  targetEditable?: boolean;
}

function editingText(input: EditorShortcutInput) {
  const tag = (input.targetTagName || '').toLowerCase();
  return Boolean(
    input.targetEditable ||
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select',
  );
}

export function resolveEditorShortcut(input: EditorShortcutInput): EditorShortcutAction | undefined {
  const key = input.key.toLowerCase();
  const primary = Boolean(input.ctrlKey || input.metaKey);
  const textTarget = editingText(input);

  if (primary && key === 's') return 'save';
  if (primary && key === 'z' && input.shiftKey) return 'redo';
  if (primary && key === 'z') return 'undo';
  if (primary && key === 'y') return 'redo';
  if (primary && key === 'p') return 'preview';
  if (primary && input.shiftKey && key === 'f') return 'focus-canvas';
  if (textTarget) return undefined;
  if (primary && key === 'd') return 'duplicate';
  if (key === 'delete' || key === 'backspace') return 'delete';
  return undefined;
}
