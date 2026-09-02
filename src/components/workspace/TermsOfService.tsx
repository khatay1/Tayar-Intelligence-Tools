import { useLocalizer } from '@/lib/ui-localization';
import { FileText } from 'lucide-react';
import { PageSection, PageShell } from './PageShell';

export default function TermsOfService() {
  const l = useLocalizer();
  return (
    <PageShell icon={FileText} title={l('Terms of Service')} subtitle={l('Last updated: August 28, 2026')}>
      <PageSection title={l("1. Using the service")}>
        <p>{l('By using Tayar Intelligence, you agree to use the service lawfully and in a way that does not interfere with other users, the platform or its infrastructure.')}</p>
      </PageSection>
      <PageSection title={l("2. Accounts")}>
        <p>{l('You are responsible for the accuracy of information submitted through your account and for keeping access to your account secure. Team and shared-project permissions should only be granted to people you intend to collaborate with.')}</p>
      </PageSection>
      <PageSection title={l("3. Projects and generated content")}>
        <p>{l('You remain responsible for reviewing the content, websites, documents and other outputs you create or publish through the platform. Automated or AI-assisted output should be checked before it is relied on or published.')}</p>
      </PageSection>
      <PageSection title={l("4. Acceptable use")}>
        <p>{l('You may not use the service to break the law, abuse public forms or APIs, bypass product limits or access controls, distribute malicious content, interfere with the service, or attempt unauthorized access to other accounts or projects.')}</p>
      </PageSection>
      <PageSection title={l("5. Plans and billing")}>
        <p>{l('Free, Pro and Business features and usage limits are displayed in the product. Paid pricing, renewal details, cancellation options and any applicable billing terms are presented through the configured checkout and billing portal. Applicable consumer rights remain unaffected.')}</p>
      </PageSection>
      <PageSection title={l("6. Availability and changes")}>
        <p>{l('Features may evolve as the product is improved. We may change, add or retire features when needed for security, reliability or product development. Important changes should be reflected in the product or these terms.')}</p>
      </PageSection>
      <PageSection title={l("7. Responsibility")}>
        <p>{l('The service is provided as a productivity platform. You are responsible for the final decisions, publications and actions taken using the outputs of the service, including websites published to third-party or configured hosting destinations.')}</p>
      </PageSection>
      <PageSection title={l("8. Support")}>
        <p>{l('Questions about these terms can be submitted through the support options available in the product.')}</p>
      </PageSection>
    </PageShell>
  );
}
