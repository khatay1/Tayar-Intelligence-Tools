import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const workspace = read('src/components/workspace/Workspace.tsx');
const commandBar = read('src/components/workspace/CommandBar.tsx');
const commandPalette = read('src/components/workspace/CommandPalette.tsx');
const keyboardShortcuts = read('src/lib/use-keyboard-shortcuts.ts');
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
const fileManager = read('src/components/workspace/FileManager.impl.tsx');
const notificationCenter = read('src/components/workspace/NotificationCenter.tsx');
const notificationsHook = read('src/lib/use-notifications.ts');

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
  ['Mobile AI usage explicitly scopes to signed-in user', mobileProfile.includes('const userId = user?.id ?? null') && mobileProfile.includes(".eq('user_id', userId)") && mobileProfile.includes("select('id', { count: 'exact', head: true })")],
  ['Mobile user usage does not request detailed AI analytics', !mobileProfile.includes('tokens_in') && !mobileProfile.includes('tokens_out') && !mobileProfile.includes('cost_usd') && !mobileProfile.includes("select('provider")],
  ['Admin AI panel retains protected platform usage analytics', adminAi.includes("from('ai_usage')")],
  ['Signed-in auth hashes normalize to a workspace route', app.includes("replaceHash('#workspace/my-workspace')")],
  ['Workspace navigation persists the active view in the URL', workspace.includes('const nextHash = `#workspace/${view}`')],
  ['Workspace restores the active view from the URL', workspace.includes('getWorkspaceViewFromHash') && workspace.includes("window.addEventListener('hashchange', syncViewFromHash)")],
  ['Workspace labels admin Business access', workspace.includes("isAdmin ? 'Admin · Business access'")],
  ['Workspace registers command palette shortcut once', workspace.match(/key: 'k', ctrl: true/g)?.length === 1 && !workspace.includes("window.addEventListener('keydown', handleKey)")],
  ['Desktop sidebar supports localized tool filtering', workspace.includes("type=\"search\"") && workspace.includes('visibleGroups') && workspace.includes("l('No tools found')")],
  ['Registry tools are localized before sidebar rendering and filtering', workspace.includes('label: translations[item.id] || l(item.label)') && workspace.includes('badge: item.badge ? l(item.badge) : undefined')],
  ['Command palette ignores closed-state searches and stale requests', commandPalette.includes('if (!open) return undefined') && commandPalette.includes('requestSequenceRef.current += 1')],
  ['Command palette exposes accessible dialog and listbox semantics', commandPalette.includes('role="dialog"') && commandPalette.includes('role="combobox"') && commandPalette.includes('role="listbox"') && commandPalette.includes('role="option"')],
  ['Command palette searches localized navigation tools and AI commands', commandPalette.includes('matchesLocalizedText') && commandPalette.includes('matchedCommands') && commandPalette.includes('englishToolMatches')],
  ['Command palette preserves tool results when project search fails', commandPalette.includes('projectSearchError') && commandPalette.includes("l('Projects could not be loaded. Tool results are still available.')")],
  ['Command palette keeps keyboard selection visible', commandPalette.includes("scrollIntoView({ block: 'nearest' })")],
  ['Desktop header popovers are mutually exclusive and expose ARIA state', workspace.includes('aria-controls="workspace-language-menu"') && workspace.includes('aria-controls="workspace-notifications-panel"') && workspace.includes('aria-controls="workspace-account-menu"') && workspace.includes('setNotifOpen(false); setProfileOpen(false)')],
  ['Desktop overlays close consistently with Escape', workspace.includes("if (event.key !== 'Escape') return") && workspace.includes('setShortcutsOpen(false)') && workspace.includes('setSidebarOpen(false)')],
  ['Keyboard shortcut help is a focus-contained accessible dialog', workspace.includes('aria-labelledby="workspace-shortcuts-title"') && workspace.includes('handleShortcutsKeyDown') && workspace.includes('shortcutsReturnFocusRef.current?.focus()')],
  ['Advertised G navigation shortcuts are implemented', workspace.includes("sequence: ['g', 'd']") && workspace.includes("sequence: ['g', 'f']") && workspace.includes("sequence: ['g', 'c']") && keyboardShortcuts.includes('exactMatch.handler()')],
  ['Desktop command bar searches and renders localized AI commands', commandBar.includes("from '@/lib/ui-localization-workspace'") && commandBar.includes('localizedText.includes(normalizedQuery)') && commandBar.includes('{l(cmd.label)}') && commandBar.includes('{l(cmd.description)}')],
  ['Desktop command bar exposes combobox and listbox semantics', commandBar.includes('role="combobox"') && commandBar.includes('role="listbox"') && commandBar.includes('role="option"') && commandBar.includes('aria-activedescendant')],
  ['Command palette traps and restores keyboard focus', commandPalette.includes("if (e.key === 'Tab')") && commandPalette.includes('previousFocusRef.current?.focus()') && commandPalette.includes('ref={dialogRef}')],
  ['File Manager contains load failures and exposes retry', fileManager.includes('setLoadError(true)') && fileManager.includes("l('Files could not be loaded.')") && fileManager.includes('void refreshProjects()')],
  ['File actions require confirmation before moving to Trash', fileManager.includes('setDeletingItem(project)') && fileManager.includes('role="alertdialog"') && fileManager.includes('void handleDelete(deletingItem.id)')],
  ['File mutations fail closed before local optimistic updates', fileManager.includes("showError(l('Failed to update favorite'))") && fileManager.includes("showError(l('Failed to update pin'))") && fileManager.includes("showError(l('Failed to move'))")],
  ['File menus and filters expose desktop accessibility state', fileManager.includes('aria-haspopup="menu"') && fileManager.includes('role="menuitem"') && fileManager.includes('aria-pressed={showFavoritesOnly}') && fileManager.includes("aria-label={l('Sort files')}")],
  ['File overlays and action menus close with Escape or outside click', fileManager.includes("document.addEventListener('click', closeMenu)") && fileManager.includes("if (event.key !== 'Escape') return") && fileManager.includes('setDeletingItem(null)')],
  ['Notification mutations only update UI after server success', notificationsHook.includes('if (updateError)') && notificationsHook.includes('if (deleteError)') && notificationsHook.includes('setError(true)')],
  ['Notification center localizes relative time and contains failures', notificationCenter.includes('Intl.RelativeTimeFormat') && notificationCenter.includes("l('Notifications could not be updated.')") && notificationCenter.includes('void refresh()')],
  ['Notification icon actions have accessible names', notificationCenter.includes("aria-label={l('Mark as read')}") && notificationCenter.includes("aria-label={l('Delete notification')}")],
  ['Admin upgrade prompt is hidden in sidebar', workspace.includes('!isAdmin && <div className="px-3 pb-3">')],
  ['Admin panel link is only rendered for admins', workspace.includes('{isAdmin && <a role="menuitem" href="#admin"')],
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
