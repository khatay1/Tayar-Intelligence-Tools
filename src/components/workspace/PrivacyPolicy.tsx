import { useLocalizer } from '@/lib/ui-localization';
import { LEGAL_LAST_UPDATED } from '@/lib/legal';
import { Shield } from 'lucide-react';
import { LegalOperatorDetails } from './LegalOperatorDetails';
import { PageSection, PageShell } from './PageShell';

export default function PrivacyPolicy() {
  const l = useLocalizer();
  return (
    <PageShell icon={Shield} title={l('Privacy Policy')} subtitle={`${l('Last updated:')} ${LEGAL_LAST_UPDATED}`}>
      <PageSection title={l('1. Operator and scope')}>
        <p>{l('This policy explains how the operator of Tayar Intelligence processes personal data when you use the workspace, public website features, support and billing flows.')}</p>
        <LegalOperatorDetails />
      </PageSection>

      <PageSection title={l('2. Data we process')}>
        <p>{l('Depending on the features you use, we process account and profile details, authentication identifiers, projects and files, AI conversations and usage records, preferences, support requests, subscription status, team activity, and security or operational events.')}</p>
        <p>{l('Website Builder may also store published pages and media, release history, form submissions, leads and privacy-limited analytics events for sites you operate.')}</p>
      </PageSection>

      <PageSection title={l('3. Purposes and legal grounds')}>
        <p>{l('We process data as needed to provide and secure the service, save your work, enforce permissions and plan limits, respond to support, and administer subscriptions. Depending on the context, the legal ground may be performance of a contract, legitimate interests in protecting and improving the service, consent for optional analytics, or compliance with a legal obligation.')}</p>
      </PageSection>

      <PageSection title={l('4. AI and external processing')}>
        <p>{l('AI requests are sent only when you choose an AI-powered action. The prompt and content needed for that action may be sent to the AI or image provider configured by the operator. Do not submit sensitive data unless it is necessary and you are authorized to do so.')}</p>
      </PageSection>

      <PageSection title={l('5. Website visitors')}>
        <p>{l('If you publish a site with Tayar, you are responsible for the notices, permissions and lawful use of visitor information collected through your site. Tayar handles form submissions and configured analytics to provide those Website Builder features to your account.')}</p>
      </PageSection>

      <PageSection title={l('6. Providers, payments and transfers')}>
        <p>{l('Supabase provides authentication, database and storage capabilities. Stripe handles Checkout, payment methods, invoices and subscription management; Tayar stores billing identifiers and subscription status, not full payment-card details. Configured AI, email, monitoring or hosting providers process only the information needed for their service.')}</p>
        <p>{l('Provider locations can vary. Where personal data is transferred internationally, the operator relies on the safeguards available under its provider agreements and applicable law. Contact us for the current provider list and transfer details.')}</p>
      </PageSection>

      <PageSection title={l('7. Retention and deletion')}>
        <p>{l('Account and project data is generally kept while your account is active. Account deletion cancels an active Tayar subscription and removes the active account, owned project records and owned storage controlled by Tayar. Limited billing, security, fraud-prevention, dispute and audit records may remain when needed for legal obligations or legitimate service protection.')}</p>
      </PageSection>

      <PageSection title={l('8. Security')}>
        <p>{l('The application uses encrypted network connections, authenticated server functions and database access controls, including Row Level Security for user and workspace data. No online service can guarantee absolute security.')}</p>
      </PageSection>

      <PageSection title={l('9. Browser storage and analytics')}>
        <p>{l('Necessary browser storage supports authentication sessions, interface preferences, recovery and consent choices. Product analytics is off until you consent and can be disabled later in Settings. Tayar does not currently activate a separate marketing-cookie category.')}</p>
        <p>{l('With your consent, product analytics and error monitoring may process page or action names, referrer, a session identifier linked to your signed-in account, browser or device data, network information and limited error diagnostics. Interaction autocapture and session replay are disabled, and project content is not intentionally included in analytics events.')}</p>
      </PageSection>

      <PageSection title={l('10. Your choices and rights')}>
        <p>{l('Settings provides account-data export, analytics consent controls and account deletion. Depending on applicable law, you may also request access, correction, restriction, portability or objection, withdraw consent, and complain to a competent data-protection authority. Use the in-product account support flow.')}</p>
      </PageSection>

      <PageSection title={l('11. Changes')}>
        <p>{l('This policy may be updated as the product, providers or legal requirements change. Material changes should be communicated through the service when appropriate, and the revision date above will be updated.')}</p>
      </PageSection>
    </PageShell>
  );
}
