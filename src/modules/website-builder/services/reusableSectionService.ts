import { supabase } from '@/lib/supabase';
import type { WebsiteSection } from '../core/types';

export async function listReusableSectionsInCloud(userId: string) {
  return supabase
    .from('projects')
    .select('id, title, content, updated_at')
    .eq('user_id', userId)
    .eq('type', 'website-section-template')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(30);
}

export async function saveReusableSectionInCloud(
  userId: string,
  title: string,
  section: WebsiteSection,
) {
  return supabase.from('projects').insert({
    user_id: userId,
    title,
    type: 'website-section-template',
    content: { version: 1, section },
    status: 'completed',
  });
}

export async function deleteReusableSectionInCloud(
  userId: string,
  templateId: string,
) {
  return supabase
    .from('projects')
    .delete()
    .eq('id', templateId)
    .eq('user_id', userId)
    .eq('type', 'website-section-template');
}
