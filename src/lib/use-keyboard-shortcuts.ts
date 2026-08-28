import { useEffect } from 'react';

interface Shortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Allow Escape to blur
        if (e.key === 'Escape') target.blur();
        return;
      }

      for (const sc of shortcuts) {
        const ctrlMatch = sc.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
        const shiftMatch = sc.shift ? e.shiftKey : !sc.shift ? true : e.shiftKey;
        if (ctrlMatch && shiftMatch && e.key.toLowerCase() === sc.key.toLowerCase()) {
          e.preventDefault();
          sc.handler();
          return;
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}

export const SHORTCUT_HINTS = [
  { key: 'Ctrl+K', description: 'Open command palette' },
  { key: 'Ctrl+/', description: 'Show keyboard shortcuts' },
  { key: 'Ctrl+B', description: 'Toggle sidebar' },
  { key: 'Ctrl+,', description: 'Open settings' },
  { key: 'Escape', description: 'Close dialogs / blur input' },
  { key: 'G then D', description: 'Go to Dashboard' },
  { key: 'G then F', description: 'Go to Files' },
  { key: 'G then C', description: 'Go to CV Builder' },
];
