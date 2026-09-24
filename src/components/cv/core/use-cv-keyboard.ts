import { useEffect } from 'react';
import { handleCVKeyboardShortcut } from './cv-keyboard';

interface UseCVKeyboardOptions {
  enabled?: boolean;
  undo: () => void;
  redo: () => void;
  save?: () => void | Promise<void>;
}

export function useCVKeyboard({ enabled = true, undo, redo, save }: UseCVKeyboardOptions): void {
  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => {
      handleCVKeyboardShortcut(event, { undo, redo, save });
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [enabled, undo, redo, save]);
}
