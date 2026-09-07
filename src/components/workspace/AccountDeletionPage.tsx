import { Mail, Trash2 } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import { legalIdentity } from '@/lib/legal';
import { PageSection, PageShell } from './PageShell';

export default function AccountDeletionPage() {
  const l = useLocalizer();
  const contactEmail = legalIdentity.contactEmail;
  const mailto = contactEmail
    ? `mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent('Tayar account deletion request')}`
    : '';

  return (
    <PageShell
      icon={Trash2}
      title={l('Account and Data Deletion')}
      subtitle={l('Tayar provides permanent account deletion from the mobile app and signed-in web workspace.')}
    >
      <PageSection title={l('Delete your account now')}>
        <p>{l('Mobile app: open Profile, choose Delete account permanently, then confirm the destructive action.')}</p>
        <p>{l('Web: sign in, open Workspace → Settings → Privacy → Delete Account, then type DELETE to confirm.')}</p>
        <a
          href="#login"
          className="mt-2 inline-flex items-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
        >
          {l('Sign in to Tayar')}
        </a>
      </PageSection>

      <PageSection title={l('If you cannot sign in')}>
        <p>{l('Send an account deletion request from the email address associated with your Tayar account. Include only the information needed to identify the account. Never send your password.')}</p>
        {contactEmail ? (
          <a
            href={mailto}
            className="mt-2 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-violet-200 transition-colors hover:bg-white/[0.07]"
          >
            <Mail className="h-4 w-4" />
            {l('Request deletion by email')}
          </a>
        ) : (
          <p>{l('Use the legal and privacy contact shown on the Privacy Policy page to request deletion assistance.')}</p>
        )}
      </PageSection>

      <PageSection title={l('What deletion does')}>
        <p>{l('Tayar cancels an active Tayar subscription first, removes the active account, deletes owned project records, and removes user-owned Tayar storage that is covered by the deletion flow.')}</p>
        <p>{l('Limited billing, security, fraud-prevention, dispute, or audit records may remain only where required by law or needed for legitimate service protection, as described in the Privacy Policy.')}</p>
      </PageSection>

      <PageSection title={l('Important')}>
        <p>{l('Account deletion is permanent and cannot be undone. If you need a copy of your account records first, use the Account Data Export in Workspace → Settings → Privacy before deleting the account.')}</p>
      </PageSection>
    </PageShell>
  );
}
