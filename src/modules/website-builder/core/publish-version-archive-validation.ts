import { assertValidPublishedWebsiteFileNames } from './published-site-validation';

export interface PublishVersionArchiveReference {
  versionId: string;
  projectId: string;
  ownerId: string;
  storagePrefix: string;
  fileManifest: Array<{ name: string; contentType: string }>;
}

export function assertValidPublishVersionArchive(reference: PublishVersionArchiveReference): void {
  const segment = /^[a-zA-Z0-9_-]{1,160}$/;
  if (![reference.versionId, reference.projectId, reference.ownerId].every(value => segment.test(value))) {
    throw new Error('Release archive has an invalid identity.');
  }
  if (reference.storagePrefix !== `${reference.ownerId}/${reference.projectId}/versions/${reference.versionId}`) {
    throw new Error('Release archive does not belong to this project.');
  }
  if (!Array.isArray(reference.fileManifest) || reference.fileManifest.some(item => !item || typeof item !== 'object' || typeof item.contentType !== 'string')) {
    throw new Error('Release archive manifest is invalid.');
  }
  assertValidPublishedWebsiteFileNames(reference.fileManifest.map(item => item.name));
}
