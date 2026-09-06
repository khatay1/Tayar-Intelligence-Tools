import { useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { functionErrorMessage } from '@/lib/function-errors';
import { supabase } from '@/lib/supabase';
import { useLocalizer } from '@/lib/ui-localization';

export default function SuspendedAccount() {
  const l = useLocalizer();
  const { user, profile, signOut } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    if (!user || confirmation !== 'DELETE' || deleting) return;
    setDeleting(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('delete-account', {
        body: { confirmation },
      });
      if (invokeError) throw invokeError;
      if (data?.deleted !== true) throw new Error(data?.error || 'Account deletion was not confirmed.');

      await supabase.auth.signOut();
      window.location.hash = '';
      window.location.reload();
    } catch (deleteError) {
      setError(await functionErrorMessage(
        deleteError,
        l('Failed to delete account. Please contact support.'),
      ));
      setDeleting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06060e] p-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-400" aria-hidden="true" />
        <h1 className="mt-3 text-xl font-bold">{l('Account suspended')}</h1>
        <p className="mt-2 text-sm text-gray-400">
          {l('Your account is currently suspended. Contact support if you believe this is a mistake.')}
        </p>
        <button
          type="button"
          onClick={() => { window.location.hash = 'privacy'; }}
          className="mt-3 text-sm text-violet-300 underline underline-offset-4 hover:text-violet-200"
        >
          {l('Privacy Policy')}
        </button>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-left text-sm text-red-200" role="alert">
            {error}
          </div>
        )}

        {profile?.role === 'admin' ? (
          <p className="mt-5 text-xs text-amber-300">
            {l('Administrator accounts must be transferred and deleted by another administrator.')}
          </p>
        ) : confirming ? (
          <div className="mt-5 space-y-3 text-left">
            <p className="text-xs leading-relaxed text-gray-400">
              {l('Permanently delete your Tayar account, owned projects and stored files. An active subscription is canceled first. Limited billing, security and audit records may remain where legally required or needed to protect the service. This action cannot be undone.')}
            </p>
            <label className="block text-xs font-medium text-gray-300">
              {l('Type')} <span className="font-mono text-red-300">DELETE</span> {l('to confirm')}
              <input
                value={confirmation}
                onChange={event => setConfirmation(event.target.value)}
                autoComplete="off"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                placeholder="DELETE"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void deleteAccount()}
                disabled={deleting || confirmation !== 'DELETE'}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {l('Yes, Delete Everything')}
              </button>
              <button
                type="button"
                onClick={() => { setConfirming(false); setConfirmation(''); setError(null); }}
                disabled={deleting}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-gray-300 hover:border-white/20 disabled:opacity-40"
              >
                {l('Cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-xl border border-red-500/25 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/10"
            >
              {l('Delete My Account')}
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15"
            >
              {l('Sign out')}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
