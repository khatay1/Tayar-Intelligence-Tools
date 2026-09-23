import { useSyncExternalStore } from 'react';
import type { EditorPageLike } from '../core/editor-model';
import {
  getEditorLocalizationHostConfig,
  setEditorLocalizationHostConfig,
  subscribeEditorLocalizationHost,
} from '../core/editor-localization-host-store';
import { BuilderLocalizationMaxPanel } from './BuilderLocalizationMaxPanel';

interface Props {
  pages: EditorPageLike[];
  activePageId: string;
  rootDomain?: string;
  onTranslatePage?(pageId: string, sourceLocale: string, targetLocale: string): void | Promise<void>;
}

export function BuilderLocalizationSettingsSlot({
  pages,
  activePageId,
  rootDomain,
  onTranslatePage,
}: Props) {
  const config = useSyncExternalStore(
    subscribeEditorLocalizationHost,
    getEditorLocalizationHostConfig,
    getEditorLocalizationHostConfig,
  );

  return (
    <BuilderLocalizationMaxPanel
      config={config}
      pages={pages}
      activePageId={activePageId}
      rootDomain={rootDomain}
      onChange={setEditorLocalizationHostConfig}
      onTranslatePage={onTranslatePage}
    />
  );
}

export default BuilderLocalizationSettingsSlot;
