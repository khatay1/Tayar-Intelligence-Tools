import { supabase } from '@/lib/supabase';

export async function getWebsiteProjectTeamAccess(projectId: string) {
  return supabase.rpc('get_project_team_access', {
    p_project_id: projectId,
  });
}
