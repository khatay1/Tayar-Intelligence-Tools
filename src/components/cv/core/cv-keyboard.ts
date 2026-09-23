export interface CVKeyboardActions {
  undo: () => void;
  redo: () => void;
  save?: () => void | Promise<void>;
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable;
}

export function handleCVKeyboardShortcut(event: KeyboardEvent, actions: CVKeyboardActions): boolean {
  if (!(event.metaKey || event.ctrlKey)) return false;
  const key = event.key.toLowerCase();

  if (key === 's') {
    event.preventDefault();
    void Promise.resolve(actions.save?.()).catch(() => undefined);
    return true;
  }

  // Native text editing history is more granular than document history.
  // Do not hijack undo/redo while the user is typing in a field.
  if (isEditableTarget(event.target)) return false;

  if (key === 'z' && event.shiftKey) {
    event.preventDefault();
    actions.redo();
    return true;
  }
  if (key === 'z') {
    event.preventDefault();
    actions.undo();
    return true;
  }
  if (key === 'y') {
    event.preventDefault();
    actions.redo();
    return true;
  }
  return false;
}
