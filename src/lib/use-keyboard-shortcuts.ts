import { useEffect, useRef } from 'react';

interface Shortcut {
  key?: string;
  sequence?: readonly string[];
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const shortcutsRef = useRef(shortcuts);
  const sequenceRef = useRef<string[]>([]);
  const sequenceTimerRef = useRef<number | null>(null);

  useEffect(() => { shortcutsRef.current = shortcuts; }, [shortcuts]);

  useEffect(() => {
    const clearSequence = () => {
      sequenceRef.current = [];
      if (sequenceTimerRef.current !== null) window.clearTimeout(sequenceTimerRef.current);
      sequenceTimerRef.current = null;
    };

    function handler(e: KeyboardEvent) {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Allow Escape to blur
        if (e.key === 'Escape') target.blur();
        return;
      }

      if (document.querySelector('[aria-modal="true"]')) return;

      const normalizedKey = e.key.toLowerCase();
      const registeredShortcuts = shortcutsRef.current;

      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const nextSequence = [...sequenceRef.current, normalizedKey];
        const exactMatch = registeredShortcuts.find((shortcut) =>
          shortcut.sequence?.length === nextSequence.length &&
          shortcut.sequence.every((key, index) => key.toLowerCase() === nextSequence[index]),
        );
        const partialMatch = registeredShortcuts.some((shortcut) =>
          shortcut.sequence && shortcut.sequence.length > nextSequence.length &&
          nextSequence.every((key, index) => shortcut.sequence?.[index]?.toLowerCase() === key),
        );

        if (exactMatch) {
          e.preventDefault();
          clearSequence();
          exactMatch.handler();
          return;
        }
        if (partialMatch) {
          e.preventDefault();
          sequenceRef.current = nextSequence;
          if (sequenceTimerRef.current !== null) window.clearTimeout(sequenceTimerRef.current);
          sequenceTimerRef.current = window.setTimeout(clearSequence, 900);
          return;
        }
        clearSequence();
      }

      for (const sc of registeredShortcuts) {
        if (!sc.key) continue;
        const ctrlMatch = sc.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
        const shiftMatch = sc.shift ? e.shiftKey : !sc.shift ? true : e.shiftKey;
        if (ctrlMatch && shiftMatch && normalizedKey === sc.key.toLowerCase()) {
          e.preventDefault();
          sc.handler();
          return;
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      clearSequence();
    };
  }, []);
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
