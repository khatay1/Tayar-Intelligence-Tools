import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const workspace = read('src/components/workspace/Workspace.tsx');
const workspaceConfig = read('src/components/workspace/workspace-config.ts');
const aiUsage = read('src/components/workspace/AIUsageAnalytics.impl.tsx');
const toolUsage = read('src/lib/tool-usage.ts');
const adminAi = read('src/components/admin/AdminAI.tsx');
const mobileProfile = read('apps/mobile/app/(tabs)/profile.tsx');
const help = read('src/components/workspace/HelpCenter.tsx');
const contact = read('src/components/workspace/ContactPage.tsx');
const feedback = read('src/components/workspace/FeedbackPage.tsx');
const bug = read('src/components/workspace/BugReportPage.tsx');
const subscription = read('src/components/workspace/SubscriptionView.tsx');
const support = read('src/components/workspace/SupportView.tsx');
const register = read('src/components/auth/Register.tsx');
const app = read('src/App.tsx');
const dashboard = read('src/components/workspace/DashboardView.tsx');
const myWorkspace = read('src/components/workspace/MyWorkspace.tsx');
const settings = read('src/components/workspace/SettingsPage.tsx');

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
  ['Normal workspace exposes signed-in AI usage status', workspaceConfig.includes("{ id: 'ai-usage'") && workspace.includes("activeView === 'ai-usage' && <AIUsageAnalytics")],
  ['User AI usage uses auth-scoped server status', aiUsage.includes('getToolUsageState') && toolUsage.includes("supabase.rpc('tool_access_state'")],
  ['User AI usage does not query platform analytics directly', !aiUsage.includes("from('ai_usage')") && !aiUsage.includes('AI_PROVIDERS')],
  ['Mobile AI usage explicitly scopes to signed-in user', mobileProfile.includes(".eq('user_id', user.id)") && mobileProfile.includes("select('id', { count: 'exact', head: true })")],
  ['Mobile user usage does not request detailed AI analytics', !mobileProfile.includes('tokens_in') && !mobileProfile.includes('tokens_out') && !mobileProfile.includes('cost_usd') && !mobileProfile.includes("select('provider")],
  ['Admin AI panel retains protected platform usage analytics', adminAi.includes("from('ai_usage')")],
  ['Signed-in auth hashes normalize to a workspace route', app.includes("replaceHash('#workspace/my-workspace')")],
  ['Workspace navigation persists the active view in the URL', workspace.includes('const nextHash = `#workspace/${view}`')],
  ['Workspace restores the active view from the URL', workspace.includes('getWorkspaceViewFromHash') && workspace.includes("window.addEventListener('hashchange', syncViewFromHash)")],
  ['Workspace labels admin Business access', workspace.includes("isAdmin ? 'Admin · Business access'")],
  ['Admin upgrade prompt is hidden in sidebar', workspace.includes('!isAdmin && <div className="px-3 pb-3">')],
  ['Admin panel link is only rendered for admins', workspace.includes('{isAdmin && <a href="#admin"')],
  ['Admin upgrade recommendations are hidden', dashboard.includes("!isAdmin || rec.action !== 'subscription'")],
  ['Admin workspace upgrade card is hidden', myWorkspace.includes('{!isAdmin && <div className="relative mt-4')],
  ['Settings identifies admin Business access', settings.includes("isAdmin ? l('Admin · Business access')")],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (ok) console.log(`✓ ${name}`);
  else { console.error(`✗ ${name}`); failed += 1; }
}
console.log(`Workspace production smoke test: ${checks.length - failed} passed, ${failed} failed`);
if (failed) process.exit(1);
