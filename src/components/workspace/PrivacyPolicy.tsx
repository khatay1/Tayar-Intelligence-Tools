import { Shield } from 'lucide-react';
import { PageShell, PageSection } from './PageShell';

export default function PrivacyPolicy() {
  return (
    <PageShell icon={Shield} title="Privacy Policy" subtitle="Last updated: August 4, 2026">
      <PageSection title="1. Introduction">
        <p>Tayar Intelligence Tools ("we", "us", "our") is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your personal information when you use our platform.</p>
      </PageSection>
      <PageSection title="2. Information We Collect">
        <p>We collect information you provide directly to us, including:</p>
        <p>- Account information: name, email address, password (encrypted)</p>
        <p>- Usage data: tools used, documents created, AI interactions</p>
        <p>- Device information: browser type, IP address, operating system</p>
        <p>- Cookies and similar technologies for authentication and analytics</p>
      </PageSection>
      <PageSection title="3. How We Use Your Information">
        <p>We use your information to:</p>
        <p>- Provide and maintain the AI tools and services</p>
        <p>- Authenticate your account and secure the platform</p>
        <p>- Personalize your experience and improve our tools</p>
        <p>- Send important account and security notifications</p>
        <p>- Analyze usage patterns to improve performance and reliability</p>
      </PageSection>
      <PageSection title="4. Data Storage and Security">
        <p>Your data is stored securely using Supabase (PostgreSQL) with Row Level Security enabled. All data in transit is encrypted via TLS. Passwords are hashed using bcrypt. We do not store your AI API keys on our servers — they are passed securely to the AI providers.</p>
      </PageSection>
      <PageSection title="5. Data Retention">
        <p>We retain your data for as long as your account is active. You may request deletion of your account and all associated data at any time. Upon deletion, your data is permanently removed within 30 days.</p>
      </PageSection>
      <PageSection title="6. Your Rights (GDPR)">
        <p>Under the General Data Protection Regulation, you have the right to:</p>
        <p>- Access your personal data</p>
        <p>- Rectify inaccurate information</p>
        <p>- Erase your data ("right to be forgotten")</p>
        <p>- Restrict or object to processing</p>
        <p>- Data portability</p>
        <p>To exercise these rights, contact us at privacy@tayar.ai</p>
      </PageSection>
      <PageSection title="7. Cookies">
        <p>We use cookies for authentication, remembering your preferences (theme, language), and analyzing traffic. You can manage cookie preferences through our cookie consent banner or your browser settings.</p>
      </PageSection>
      <PageSection title="8. Third-Party Services">
        <p>We use the following third-party services: Supabase (database and authentication), OpenAI, Anthropic, and Google Gemini (AI processing). Each has their own privacy policy. We do not share your personal data with third parties for marketing purposes.</p>
      </PageSection>
      <PageSection title="9. Contact">
        <p>For privacy questions or requests, contact us at privacy@tayar.ai</p>
      </PageSection>
    </PageShell>
  );
}
