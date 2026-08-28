import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const workspace = read('src/components/workspace/Workspace.tsx');
const help = read('src/components/workspace/HelpCenter.tsx');
const contact = read('src/components/workspace/ContactPage.tsx');
const feedback = read('src/components/workspace/FeedbackPage.tsx');
const bug = read('src/components/workspace/BugReportPage.tsx');
const subscription = read('src/components/workspace/SubscriptionView.tsx');
const support = read('src/components/workspace/SupportView.tsx');
const register = read('src/components/auth/Register.tsx');

const checks = [
  ['Subscription view exists', subscription.includes('create-checkout-session') && subscription.includes('billing-portal')],
  ['Workspace renders real subscription view', workspace.includes("activeView === 'subscription' && <SubscriptionView")],
  ['Support hub exists', support.includes("id: 'help'") && support.includes("id: 'bug-report'")],
  ['Workspace renders real support view', workspace.includes("activeView === 'support' && <SupportView")],
  ['Help requests use support tickets', help.includes("from('support_tickets').insert")],
  ['Contact requests use support tickets', contact.includes("from('support_tickets').insert")],
  ['Feedback uses support tickets', feedback.includes("from('support_tickets').insert")],
  ['Bug reports use support tickets', bug.includes("from('support_tickets').insert")],
  ['Fake contact phone removed', !contact.includes('+46 8 123 45 67')],
  ['Help center old 50+ claim removed', !help.includes('50+ tools')],
  ['Register old 50+ claim removed', !register.includes('50+ AI tools')],
  ['Workspace billing placeholder removed', !workspace.includes("activeView === 'subscription' && <PlaceholderView")],
  ['Workspace support placeholder removed', !workspace.includes("activeView === 'support' && <PlaceholderView")],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (ok) console.log(`✓ ${name}`);
  else { console.error(`✗ ${name}`); failed += 1; }
}
console.log(`Workspace production smoke test: ${checks.length - failed} passed, ${failed} failed`);
if (failed) process.exit(1);
