import { useMemo, useSyncExternalStore } from 'react';
import type { EditorElementLike, EditorPageLike } from '../core/editor-model';
import type { WebsiteCmsBinding, WebsiteElement } from '../core/types';
import type { WebsitePage } from '../core/website-builder-model';
import {
  getEditorCmsHostState,
  setEditorCmsHostState,
  subscribeEditorCmsHost,
} from '../core/editor-cms-host-store';
import { BuilderCmsPanel } from './BuilderCmsPanel';

interface BuilderCmsSettingsSlotProps {
  activePage?: EditorPageLike;
  selectedElement?: EditorElementLike;
  disabled?: boolean;
  issues?: string[];
  onBindElement(binding?: WebsiteCmsBinding): void;
  onSetPageTemplate(template?: WebsitePage['cmsTemplate']): void;
}

function asWebsitePage(page?: EditorPageLike): WebsitePage | undefined {
  if (!page) return undefined;
  return page as WebsitePage;
}

function asWebsiteElement(element?: EditorElementLike): WebsiteElement | undefined {
  if (!element) return undefined;
  return element as WebsiteElement;
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
  const websitePage = useMemo(() => asWebsitePage(activePage), [activePage]);
  const websiteElement = useMemo(() => asWebsiteElement(selectedElement), [selectedElement]);

  return <BuilderCmsPanel
    cms={cms}
    activePage={websitePage}
    selectedElement={websiteElement}
    disabled={disabled}
    issues={issues}
    onChange={(nextCms) => setEditorCmsHostState(nextCms)}
    onBindElement={onBindElement}
    onSetPageTemplate={onSetPageTemplate}
  />;
}
