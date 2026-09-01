import { supabase } from '@/lib/supabase';

export async function getWebsiteBuilderBillingState(
  projectId: string | null,
) {
  return supabase.rpc('get_website_builder_billing_state', {
    p_project_id: projectId,
  });
}
