import { useLocalizer } from '@/lib/ui-localization';
import { legalIdentity, LEGAL_LAST_UPDATED } from '@/lib/legal';
import { FileText } from 'lucide-react';
import { LegalOperatorDetails } from './LegalOperatorDetails';
import { PageSection, PageShell } from './PageShell';

export default function TermsOfService() {
  const l = useLocalizer();
  const governingCountry = legalIdentity.country;

  return (
    <PageShell icon={FileText} title={l('Terms of Service')} subtitle={`${l('Last updated:')} ${LEGAL_LAST_UPDATED}`}>
      <PageSection title={l('1. Operator and agreement')}>
        <p>{l('These Terms govern your use of Tayar Intelligence. By creating an account or using the service, you agree to these Terms. If you use Tayar for an organization, you confirm that you are authorized to accept them for that organization.')}</p>
        <LegalOperatorDetails />
      </PageSection>

      <PageSection title={l('2. Accounts and access')}>
        <p>{l('You must provide accurate account information, protect your sign-in credentials and promptly report suspected unauthorized access. You are responsible for activity performed through your account and for choosing appropriate team permissions.')}</p>
      </PageSection>

      <PageSection title={l('3. Your content')}>
        <p>{l('You keep ownership of content you submit or create. You give the operator a limited permission to host, copy, process and transmit that content only as needed to provide, secure and support the service. You must have the rights and permissions needed for content you upload, publish or share.')}</p>
      </PageSection>

      <PageSection title={l('4. AI-assisted output')}>
        <p>{l('AI output may be inaccurate, incomplete or unsuitable. You are responsible for reviewing output before relying on it, publishing it or using it for legal, medical, financial, employment or other consequential decisions.')}</p>
      </PageSection>

      <PageSection title={l('5. Acceptable use')}>
        <p>{l('You may not use the service to violate law or third-party rights, process data without authorization, distribute malicious or deceptive content, abuse forms or APIs, bypass limits or security controls, scrape other accounts, or disrupt the platform.')}</p>
      </PageSection>

      <PageSection title={l('6. Published sites and visitor data')}>
        <p>{l('You are responsible for sites you publish, including their content, domains, legal notices, accessibility, visitor consent and handling of leads or analytics. Remove or correct unlawful content promptly.')}</p>
      </PageSection>

      <PageSection title={l('7. Plans, renewal and cancellation')}>
        <p>{l('The current features, usage limits, amount, currency and billing interval are shown in the product and Stripe Checkout. Paid subscriptions renew automatically until canceled. You can manage or cancel a subscription through the Stripe billing portal, with access continuing as shown there. Any taxes actually charged are shown in Checkout before purchase.')}</p>
        <p>{l('Nothing in these Terms removes mandatory consumer rights, including any applicable withdrawal, refund or digital-service remedies. Contact support promptly if you believe a charge is incorrect.')}</p>
      </PageSection>

      <PageSection title={l('8. Service changes and availability')}>
        <p>{l('Tayar may change, add or retire features and may interrupt access for maintenance, security or circumstances outside reasonable control. Pilot and preview features may change more frequently and are not promised for uninterrupted production use.')}</p>
      </PageSection>

      <PageSection title={l('9. Suspension, termination and deletion')}>
        <p>{l('Access may be limited or suspended when reasonably necessary to protect users, enforce these Terms, prevent abuse or comply with law. You may stop using the service at any time and can request account deletion in Settings. Subscription cancellation and account deletion are separate actions unless the deletion flow states otherwise.')}</p>
      </PageSection>

      <PageSection title={l('10. Disclaimers')}>
        <p>{l('Except for rights and guarantees that cannot legally be excluded, the service is provided as available without a promise that every feature or generated output will be error-free or fit for every purpose.')}</p>
      </PageSection>

      <PageSection title={l('11. Liability')}>
        <p>{l('Nothing limits liability that cannot legally be limited. Otherwise, each party is responsible for reasonably foreseeable direct loss caused by its breach, and the operator is not responsible for indirect loss or third-party services outside its control to the extent permitted by law.')}</p>
      </PageSection>

      <PageSection title={l('12. Governing law and disputes')}>
        <p>{governingCountry ? <>{l('These Terms are governed by the laws of')} {governingCountry}.</> : l('These Terms are governed by applicable law.')} {l('This does not deprive consumers of mandatory protections available in their country of residence. Contact support first so the parties can try to resolve a concern informally.')}</p>
      </PageSection>

      <PageSection title={l('13. Contact')}>
        <p>{l('Questions about these Terms, billing or the service can be submitted through the in-product support flow.')}</p>
      </PageSection>
    </PageShell>
  );
}
