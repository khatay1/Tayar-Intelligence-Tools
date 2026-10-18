import { supabase } from '@/lib/supabase';
/** Same-origin authenticated transport. Never persist Telegram tokens or OAuth codes. */
export async function socialConnectRequest(action: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!['start','callback','telegram','disconnect','status'].includes(action)) throw new Error('Unsupported connection action.');
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error('Sign in to connect an account.');
  try {
    const response = await fetch(`/api/social-connect?action=${action}`, { method:'POST', credentials:'same-origin', redirect:'error',
      headers:{'content-type':'application/json',authorization:`Bearer ${data.session.access_token}`},
      body:JSON.stringify(payload),signal:AbortSignal.timeout(15000),cache:'no-store' });
    if (!response.ok) throw new Error();
    const text = await response.text();
    if (text.length > 16000) throw new Error();
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new Error('Connection setup is unavailable. Check deployment, permissions and account approval.'); }
}
