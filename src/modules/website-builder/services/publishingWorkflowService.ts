import {
  readPublishedWebsiteFolderFiles,
  replacePublishedWebsiteFiles,
  snapshotPublishedWebsiteFiles,
  uploadPublishedWebsiteFolderFiles,
  verifyPublishedRoute,
  type PublishedWebsiteFile,
} from './publishedWebsiteService';
import {
  normalizeEditorPublishPlan,
  validateEditorPublishPlan,
  validateEditorPublishRedirects,
  type EditorPublishPlan,
  type EditorPublishRedirect,
} from '../core/editor-publishing';

export interface WebsitePublishingFolders {
  staging: string;
  production: string;
}

export function websitePublishingFolders(projectId: string, ownerId: string): WebsitePublishingFolders {
  const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeOwner = ownerId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeProject || !safeOwner) throw new Error('Publishing requires a valid project and owner.');
  const root = `${safeOwner}/${safeProject}`;
  return { staging: `${root}/staging`, production: `${root}/production` };
}

export async function stageWebsiteRelease(input: {
  projectId: string;
  ownerId: string;
  files: PublishedWebsiteFile[];
}) {
  const folders = websitePublishingFolders(input.projectId, input.ownerId);
  await replacePublishedWebsiteFiles(folders.staging, input.files);
  return folders.staging;
}

export async function promoteStagingToProduction(input: {
  projectId: string;
  ownerId: string;
  productionUrl?: string;
}) {
  const folders = websitePublishingFolders(input.projectId, input.ownerId);
  const staged = await readPublishedWebsiteFolderFiles(folders.staging);
  const rollback = await snapshotPublishedWebsiteFiles(folders.production);
  await replacePublishedWebsiteFiles(folders.production, staged, rollback);
  if (input.productionUrl && !(await verifyPublishedRoute(input.productionUrl))) {
    throw new Error('Production promotion completed in storage but the public route could not be verified.');
  }
  return { files: staged, rollback };
}

export async function restoreProductionFromArchive(input: {
  projectId: string;
  ownerId: string;
  archivePrefix: string;
  productionUrl?: string;
}) {
  const folders = websitePublishingFolders(input.projectId, input.ownerId);
  const archived = await readPublishedWebsiteFolderFiles(input.archivePrefix);
  await replacePublishedWebsiteFiles(folders.production, archived);
  if (input.productionUrl && !(await verifyPublishedRoute(input.productionUrl))) {
    throw new Error('Rollback files were restored but the public route could not be verified.');
  }
  return archived;
}

export function prepareWebsitePublishPlan(input: {
  plan: Partial<EditorPublishPlan>;
  allPageIds: string[];
  redirects?: EditorPublishRedirect[];
  now?: Date;
}) {
  const plan = normalizeEditorPublishPlan(input.plan, input.allPageIds);
  const errors = [
    ...validateEditorPublishPlan(plan, input.now),
    ...validateEditorPublishRedirects(input.redirects || []),
  ];
  if (errors.length) throw new Error(errors.join(' '));
  return plan;
}

export async function createImmutableReleaseArchive(input: {
  archivePrefix: string;
  files: PublishedWebsiteFile[];
}) {
  await uploadPublishedWebsiteFolderFiles(input.archivePrefix, input.files);
  return input.archivePrefix;
}
