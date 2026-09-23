import { useSyncExternalStore } from 'react';
import type { WebsiteCmsBinding, WebsiteElement } from '../core/types';
import type { WebsitePage } from '../core/website-builder-model';
import {
  getEditorCmsHostState,
  setEditorCmsHostState,
  subscribeEditorCmsHost,
} from '../core/editor-cms-host-store';
import { BuilderCmsPanel } from './BuilderCmsPanel';

interface BuilderCmsSettingsSlotProps {
  activePage?: WebsitePage;
  selectedElement?: WebsiteElement;
  disabled?: boolean;
  issues?: string[];
  onBindElement(binding?: WebsiteCmsBinding): void;
  onSetPageTemplate(template?: WebsitePage['cmsTemplate']): void;
}

export function BuilderCmsSettingsSlot({
  activePage,
  selectedElement,
  disabled,
  issues,
  onBindElement,
  onSetPageTemplate,
}: BuilderCmsSettingsSlotProps) {
  const cms = useSyncExternalStore(
    subscribeEditorCmsHost,
    getEditorCmsHostState,
    getEditorCmsHostState,
  );

  return <BuilderCmsPanel
    cms={cms}
    activePage={activePage}
    selectedElement={selectedElement}
    disabled={disabled}
    issues={issues}
    onChange={(nextCms) => setEditorCmsHostState(nextCms)}
    onBindElement={onBindElement}
    onSetPageTemplate={onSetPageTemplate}
  />;
}
