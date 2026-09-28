import { supabase } from '@/lib/supabase';
import { saveWebsiteIntegrationSecret } from './websiteProjectSecretService';

/** The editor supplies project identity checks; this adapter owns the Vault client. */
export function saveWebsiteIntegrationSecretForProject(
  input: Omit<Parameters<typeof saveWebsiteIntegrationSecret>[0], 'client'>,
): Promise<void> {
  return saveWebsiteIntegrationSecret({ ...input, client: supabase });
}
