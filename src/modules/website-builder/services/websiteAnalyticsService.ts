import { supabase } from '@/lib/supabase';

export async function listWebsiteAnalyticsEvents(
  projectId: string,
  since: string,
) {
  return supabase
    .from('website_analytics_events')
    .select('id, project_id, user_id, page_path, referrer, session_id, event_type, event_data, created_at')
    .eq('project_id', projectId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5000);
}
