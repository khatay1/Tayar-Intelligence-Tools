import { supabase } from '@/lib/supabase';

export async function getWebsiteBuilderBillingState(
  projectId: string | null,
) {
  return supabase.rpc('get_website_builder_billing_state', {
    p_project_id: projectId,
  });
}

export async function createWebsiteCheckoutSession(
  plan: 'pro' | 'business',
) {
  return supabase.functions.invoke('create-checkout-session', {
    body: { plan },
  });
}

export async function openWebsiteBillingPortalSession() {
  return supabase.functions.invoke('billing-portal', {
    body: {},
  });
}
