import {
  EMPTY_WEBSITE_CMS,
  normalizeWebsiteCms,
  type WebsiteCmsState,
} from './website-cms';

let currentCms: WebsiteCmsState = EMPTY_WEBSITE_CMS;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getEditorCmsHostState(): WebsiteCmsState {
  return currentCms;
}

export function setEditorCmsHostState(cms: WebsiteCmsState): void {
  currentCms = normalizeWebsiteCms(cms);
  emit();
}

export function subscribeEditorCmsHost(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hydrateEditorCmsHost(value: unknown): WebsiteCmsState {
  currentCms = normalizeWebsiteCms(value);
  emit();
  return currentCms;
}
