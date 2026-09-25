import {
  readPublishedWebsiteFolderFiles,
  replacePublishedWebsiteFiles,
  snapshotPublishedWebsiteFiles,
  archivePublishedWebsiteFiles,
  restorePublishedWebsiteSnapshot,
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
  const safeSegment = /^[a-zA-Z0-9_-]{1,160}$/;
  if (!safeSegment.test(projectId) || !safeSegment.test(ownerId)) throw new Error('Publishing requires a valid project and owner.');
  const root = `${ownerId}/${projectId}`;
  return { staging: `${root}/staging`, production: root };
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
    await restoreAfterVerificationFailure(folders.production, rollback);
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
  if (!input.archivePrefix.startsWith(`${folders.production}/versions/`) || !/^[a-zA-Z0-9_-]+$/.test(input.archivePrefix.slice(`${folders.production}/versions/`.length))) {
    throw new Error('Release archive must belong to this project.');
  }
  const archived = await readPublishedWebsiteFolderFiles(input.archivePrefix);
  const rollback = await snapshotPublishedWebsiteFiles(folders.production);
  await replacePublishedWebsiteFiles(folders.production, archived, rollback);
  if (input.productionUrl && !(await verifyPublishedRoute(input.productionUrl))) {
    await restoreAfterVerificationFailure(folders.production, rollback);
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
  await archivePublishedWebsiteFiles(input.archivePrefix, input.files);
  return input.archivePrefix;
}

async function restoreAfterVerificationFailure(folder: string, snapshot: Awaited<ReturnType<typeof snapshotPublishedWebsiteFiles>>): Promise<never> {
  try {
    await restorePublishedWebsiteSnapshot(folder, snapshot);
  } catch (error) {
    throw new Error('Public route verification failed. Automatic rollback was incomplete: ' + (error instanceof Error ? error.message : String(error)));
  }
  throw new Error('Public route verification failed. The previous live website was restored automatically.');
}
