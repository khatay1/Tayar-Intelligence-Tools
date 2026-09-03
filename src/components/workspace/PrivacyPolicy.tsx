import { useLocalizer } from '@/lib/ui-localization';
import { Shield } from 'lucide-react';
import { PageSection, PageShell } from './PageShell';

export default function PrivacyPolicy() {
  const l = useLocalizer();
  return (
    <PageShell icon={Shield} title={l('Privacy Policy')} subtitle={l('Last updated: August 28, 2026')}>
      <PageSection title={l('1. Overview')}>
        <p>{l('This page describes the main categories of information Tayar Intelligence may process when you use the product. The exact data involved depends on the features you choose to use.')}</p>
      </PageSection>
      <PageSection title={l('2. Account and workspace data')}>
        <p>{l('Account details, profile settings, projects, files, preferences and collaboration data may be stored so the service can authenticate you, save your work and enforce access permissions.')}</p>
      </PageSection>
      <PageSection title={l('3. Website Builder data')}>
        <p>{l('Website Builder projects can include pages, media references, form submissions, leads, analytics events, release history, publishing settings and team permissions. Public website forms and analytics use dedicated server-side controls and rate limits.')}</p>
      </PageSection>
      <PageSection title={l('4. Infrastructure and processors')}>
        <p>{l('The application uses third-party infrastructure such as Supabase for authentication, database and storage capabilities. Features that use external AI or payment services may send the information required to complete that specific request to the configured provider.')}</p>
      </PageSection>
      <PageSection title={l('5. Security')}>
        <p>{l('The application uses encrypted network connections and database access controls, including Row Level Security for user and workspace data. Authentication credentials are handled through the authentication provider rather than being stored as plaintext application data.')}</p>
      </PageSection>
      <PageSection title={l('6. Cookies and local storage')}>
        <p>{l('Browser storage may be used for authentication sessions, interface preferences, recovery data and consent choices. Analytics or production integrations are controlled by the relevant product and website settings.')}</p>
      </PageSection>
      <PageSection title={l('7. Your choices')}>
        <p>{l('You can manage account preferences and many stored project settings inside the product. Requests relating to access, correction or deletion of personal data should be made through the support options available in your account.')}</p>
      </PageSection>
      <PageSection title={l('8. Changes')}>
        <p>{l('This policy may be updated as the product, infrastructure or legal requirements change. The date at the top of this page shows the latest published revision.')}</p>
      </PageSection>
    </PageShell>
  );
}
