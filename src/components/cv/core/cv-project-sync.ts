import { CVDocument, serializeCVDocument } from './cv-document';

export interface CVProjectAdapter {
  createProject: (userId: string, title: string, type: string, content: Record<string, unknown>, status: string) => Promise<string | null>;
  saveProject: (projectId: string, patch: { title?: string; content?: Record<string, unknown>; status?: string }) => Promise<boolean>;
  createFileEntry: (userId: string, projectId: string, filename: string, type: string) => Promise<void>;
  logActivity: (message: string, tool: string) => Promise<void>;
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
    const saved = await adapter.saveProject(projectId, { title, content, status: 'draft' });
    if (!saved) throw new Error('Failed to save CV project');
    return projectId;
  }

  const createdId = await adapter.createProject(userId, title, 'cv', content, 'draft');
  if (!createdId) throw new Error('Failed to create CV project');
  await adapter.createFileEntry(userId, createdId, `${title}.pdf`, 'cv');
  await adapter.logActivity(`Created resume: ${title}`, 'cv-builder');
  return createdId;
}
