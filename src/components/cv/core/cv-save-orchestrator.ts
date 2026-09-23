import { SupabaseClient } from '@supabase/supabase-js';
import { CVDocument } from './cv-document';
import { deleteCVRecord, saveCVRecord } from './cv-persistence';
import { CVProjectAdapter, syncCVProject } from './cv-project-sync';

export interface CVSaveContext {
  userId: string;
  cvId: string | null;
  projectId: string | null;
  title: string;
  atsScore: number;
  document: CVDocument;
}

export interface CVSaveOutcome {
  cvId: string;
  projectId: string | null;
  createdCV: boolean;
}

export async function saveCVEverywhere(
  supabase: SupabaseClient,
  projects: CVProjectAdapter,
  context: CVSaveContext,
): Promise<CVSaveOutcome> {
  const cvResult = await saveCVRecord(
    supabase,
    context.userId,
    context.cvId,
    context.title,
    context.document,
    context.atsScore,
  );

  try {
    const projectId = await syncCVProject(
      projects,
      context.userId,
      context.projectId,
      context.title,
      context.document,
    );
    return { cvId: cvResult.cvId, projectId, createdCV: cvResult.created };
  } catch (error) {
    // A brand-new CV should not be left orphaned when its workspace project
    // cannot be created. Existing CV updates are preserved and retried later.
    if (cvResult.created) {
      await deleteCVRecord(supabase, context.userId, cvResult.cvId).catch(() => undefined);
    }
    throw error;
  }
}
