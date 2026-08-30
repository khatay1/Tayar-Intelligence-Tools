import { useMemo, useSyncExternalStore } from 'react';
import { createEditorShellContract, type EditorShellAdapterCallbacks } from '../core/editor-shell-adapter';
import type { EditorShellContract, EditorShellStatus } from '../core/editor-shell-contract';
import type { EditorProjectLike } from '../core/editor-model';
import type { EditorStore } from '../core/editor-store';

export function useEditorStoreSnapshot<P extends EditorProjectLike>(store: EditorStore<P>) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function useEditorShellContract<P extends EditorProjectLike>(
  store: EditorStore<P>,
  callbacks: EditorShellAdapterCallbacks,
  status: EditorShellStatus = {},
): EditorShellContract {
  const state = useEditorStoreSnapshot(store);
  return useMemo(
    () => createEditorShellContract(state, callbacks, status),
    [state, callbacks, status],
  );
}
