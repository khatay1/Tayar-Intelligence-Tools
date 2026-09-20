import { supabase } from '@/lib/supabase';

export interface WebsiteDomainVerification {
  type?: string;
  domain?: string;
  value?: string;
  reason?: string;
}

export interface WebsiteCustomDomain {
  id: string;
  project_id: string;
  user_id: string;
  hostname: string;
  status: 'pending' | 'verified' | 'misconfigured';
  verification: WebsiteDomainVerification[];
  created_at: string;
  updated_at: string;
}

async function domainRequest(input: {
  action: 'get' | 'connect' | 'check' | 'remove';
  projectId: string;
  hostname?: string;
}): Promise<WebsiteCustomDomain | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in before managing a custom domain.');
  const response = await fetch('/api/website-domain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(result.error || 'Custom domain request failed.'));
  return result.domain || null;
}

export const getWebsiteCustomDomain = (projectId: string) => domainRequest({ action: 'get', projectId });
export const connectWebsiteCustomDomain = (projectId: string, hostname: string) => domainRequest({ action: 'connect', projectId, hostname });
export const checkWebsiteCustomDomain = (projectId: string, hostname: string) => domainRequest({ action: 'check', projectId, hostname });
export const removeWebsiteCustomDomain = (projectId: string) => domainRequest({ action: 'remove', projectId });
