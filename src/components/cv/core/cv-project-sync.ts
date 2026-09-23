import { CVDocument, serializeCVDocument } from './cv-document';

export interface CVProjectAdapter {
  createProject: (userId: string, title: string, type: string, content: Record<string, unknown>, status: string) => Promise<string | null>;
  saveProject: (projectId: string, patch: { title: string; content: Record<string, unknown>; status: string }) => Promise<unknown>;
  createFileEntry: (userId: string, projectId: string, filename: string, type: string) => Promise<unknown>;
  logActivity: (message: string, tool: string) => Promise<unknown>;
}

export async function syncCVProject(
  adapter: CVProjectAdapter,
  userId: string,
  projectId: string | null,
  title: string,
  document: CVDocument,
): Promise<string | null> {
  const content = serializeCVDocument(document);
  if (projectId) {
    await adapter.saveProject(projectId, { title, content, status: 'draft' });
    return projectId;
  }

  const createdId = await adapter.createProject(userId, title, 'cv', content, 'draft');
  if (!createdId) return null;
  await adapter.createFileEntry(userId, createdId, `${title}.pdf`, 'cv');
  await adapter.logActivity(`Created resume: ${title}`, 'cv-builder');
  return createdId;
}
