import { SupabaseClient } from '@supabase/supabase-js';
import { CVDocument, normalizeCVDocument, serializeCVDocument } from './cv-document';

export interface StoredCVRecord {
  id: string;
  title: string;
  data: unknown;
  template: string | null;
  ats_score?: number | null;
  updated_at?: string | null;
}

export interface CVSaveResult {
  cvId: string;
  created: boolean;
}

export async function loadCVRecord(
  supabase: SupabaseClient,
  userId: string,
  cvId: string,
): Promise<{ record: StoredCVRecord; document: CVDocument } | null> {
  const { data, error } = await supabase
    .from('cvs')
    .select('id,title,data,template,ats_score,updated_at')
    .eq('id', cvId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const document = normalizeCVDocument({
    cv: data.data,
    template: data.template ?? undefined,
  });
  return { record: data as StoredCVRecord, document };
}

export async function saveCVRecord(
  supabase: SupabaseClient,
  userId: string,
  cvId: string | null,
  title: string,
  document: CVDocument,
  atsScore: number,
): Promise<CVSaveResult> {
  const serialized = serializeCVDocument(document);
  const data = serialized.cv;
  const template = document.settings.template;

  if (!cvId) {
    const { data: created, error } = await supabase
      .from('cvs')
      .insert({ user_id: userId, title, data, template, ats_score: atsScore })
      .select('id')
      .single();
    if (error) throw error;
    return { cvId: created.id as string, created: true };
  }

  const { error } = await supabase
    .from('cvs')
    .update({ data, template, ats_score: atsScore, title, updated_at: new Date().toISOString() })
    .eq('id', cvId)
    .eq('user_id', userId);
  if (error) throw error;
  return { cvId, created: false };
}

export async function deleteCVRecord(
  supabase: SupabaseClient,
  userId: string,
  cvId: string,
): Promise<void> {
  const { error } = await supabase
    .from('cvs')
    .delete()
    .eq('id', cvId)
    .eq('user_id', userId);
  if (error) throw error;
}
