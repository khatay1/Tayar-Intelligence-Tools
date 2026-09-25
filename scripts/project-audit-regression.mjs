import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
import { hookHarness, deferred, settle, queryMock } from './test-support/hook-harness.mjs';

const notices = [];
let nextQuery = () => ({ data: null, error: null });
const projects = hookHarness('src/lib/use-projects.ts', {
  '@/lib/supabase': { supabase: { from: () => queryMock(state => nextQuery(state)) } },
  '@/components/ui/Toast': { useToast: () => ({ error: x => notices.push(x), success: x => notices.push(x), loading: () => 'toast', update: (...x) => notices.push(x) }) },
});
let project = projects.render('useProjects');
assert.equal(await project.saveProject('deleted', { title: 'Not saved' }), false, 'zero-row save must fail');
assert.equal(await project.renameProject('deleted', 'Not renamed'), false, 'zero-row rename must fail');
assert.equal(await project.deleteProject('deleted'), false, 'zero-row delete must fail');
nextQuery = () => { throw new Error('offline'); };
assert.equal(await project.saveProject('p', {}), false);
assert.equal(projects.render('useProjects').saving, false, 'failed transport must release saving indicator');
const saveA = deferred(), saveB = deferred();
let calls = 0;
nextQuery = () => ++calls === 1 ? saveA.promise : saveB.promise;
const a = project.saveProject('a', {}), b = project.saveProject('b', {});
await settle(); saveA.resolve({ data: { id: 'a' }, error: null }); await a;
assert.equal(projects.render('useProjects').saving, true, 'another save is still running');
saveB.resolve({ data: { id: 'b' }, error: null }); await b;
assert.equal(projects.render('useProjects').saving, false);

let authUser = { id: 'admin' };
const checks = [];
const admin = hookHarness('src/context/AdminContext.tsx', {
  '@/context/AuthContext': { useAuth: () => ({ user: authUser }) },
  '@/lib/supabase': { supabase: { rpc: () => { const d = deferred(); checks.push(d); return d.promise; } } },
});
admin.render('AdminProvider');
checks[0].resolve({ data: true, error: null }); await settle();
assert.equal(admin.render('AdminProvider').isAdmin, true);
const refresh = admin.render('AdminProvider').refreshAdminStatus();
assert.equal(admin.render('AdminProvider').adminLoading, false, 'focus refresh preserves unsaved admin forms');
authUser = { id: 'regular' };
assert.equal(admin.render('AdminProvider').isAdmin, false, 'previous account access never leaks into next render');
checks[1].resolve({ data: true, error: null }); await refresh;
checks[2].resolve({ data: false, error: null }); await settle();
assert.equal(admin.render('AdminProvider').isAdmin, false);
assert.equal(admin.render('AdminProvider').adminLoading, false);

const initial = deferred(), profile = deferred();
let authEvent;
const auth = hookHarness('src/context/AuthContext.tsx', {
  '@/lib/supabase': { supabase: {
    auth: {
      getSession: () => initial.promise,
      onAuthStateChange: callback => { authEvent = callback; return { data: { subscription: { unsubscribe() {} } } }; },
    },
    rpc: async () => ({ data: false, error: null }),
    from: () => queryMock(() => profile.promise),
  } },
});
auth.render('AuthProvider');
authEvent('SIGNED_IN', { user: { id: 'a' } }); await settle();
authEvent('SIGNED_OUT', null);
profile.resolve({ data: { id: 'a', role: 'admin' }, error: null });
initial.resolve({ data: { session: { user: { id: 'a' } } }, error: null });
await settle();
const signedOut = auth.render('AuthProvider');
assert.equal(signedOut.user, null, 'late initialization cannot restore a signed-out account');
assert.equal(signedOut.profile, null, 'late profile cannot restore old privileges');
assert.equal(signedOut.loading, false);

let rows = Array.from({ length: 25 }, (_, i) => ({ id: String(i), user_id: 'a', read: false }));
authUser = { id: 'a' };
const notifications = hookHarness('src/lib/use-notifications.ts', {
  '@/context/AuthContext': { useAuth: () => ({ user: authUser }) },
  '@/lib/supabase': { supabase: { from: () => queryMock(state => {
    const matched = rows.filter(row => state.filters.every(([key, value]) => row[key] === value));
    if (state.action === 'update') matched.forEach(row => Object.assign(row, state.value));
    if (state.action === 'delete') rows = rows.filter(row => !matched.includes(row));
    return { data: matched.slice(0, state.limit ?? matched.length).map(x => ({ ...x })), count: matched.length, error: null };
  }) } },
});
notifications.render('useNotifications'); await settle();
let inbox = notifications.render('useNotifications');
assert.equal(inbox.notifications.length, 20);
assert.equal(inbox.unreadCount, 25, 'count includes older unread notifications');
await Promise.all([inbox.markAsRead('0'), inbox.markAsRead('0')]);
inbox = notifications.render('useNotifications');
assert.equal(inbox.unreadCount, 24, 'duplicate read is idempotent');
await inbox.deleteNotification('0');
assert.equal(notifications.render('useNotifications').unreadCount, 24, 'deleting a read item does not decrement unread');
authUser = { id: 'b' };
assert.equal(notifications.render('useNotifications').notifications.length, 0, 'hide previous account notifications immediately');
await settle();
assert.equal(notifications.render('useNotifications').unreadCount, 0);

const { code } = await transform(readFileSync('src/lib/paginated-query.ts', 'utf8'), { loader: 'ts', format: 'esm' });
const { readAllRows } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const all = Array.from({ length: 1203 }, (_, id) => ({ id }));
const collected = await readAllRows(() => ({ range: async from => ({ data: all.slice(from, from + 100), error: null }) }));
assert.equal(collected.data.length, 1203, 'read every page even when the server caps pages below requested size');
let page = 0;
const failed = await readAllRows(() => ({ range: async () => ++page === 1 ? { data: [{ id: 1 }], error: null } : { data: null, error: { message: 'offline' } } }));
assert.equal(failed.data.length, 0, 'partial statistics must not be reported as complete');
assert.equal(failed.error.message, 'offline');
const storage = new Map();
const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
const prefsLoad = deferred();
const savedPrefs = [];
authUser = { id: 'a' };
storage.set('tayar-prefs', JSON.stringify({ language: 'invalid', theme: 'unknown', marketing_emails: 'true' }));
const preferences = hookHarness('src/context/PreferencesContext.tsx', {
  './AuthContext': { useAuth: () => ({ user: authUser }) },
  '@/lib/supabase': { supabase: { from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: () => prefsLoad.promise }) }),
    upsert: async value => { savedPrefs.push(value); return { error: null }; },
  }) } },
}, { localStorage, document: { documentElement: { classList: { add() {}, remove() {} }, style: {} } } });
preferences.render('PreferencesProvider');
let settings = preferences.render('PreferencesProvider');
assert.equal(settings.prefs.language, 'ar', 'invalid stored languages cannot break the public UI');
assert.equal(settings.prefs.marketing_emails, false, 'string booleans do not enable consent');
const prefA = settings.updatePrefs({ language: 'sv' });
const prefB = settings.updatePrefs({ theme: 'light' });
await Promise.all([prefA, prefB]);
prefsLoad.resolve({ data: { language: 'en', theme: 'dark' }, error: null }); await settle();
settings = preferences.render('PreferencesProvider');
assert.equal(settings.prefs.language, 'sv', 'late cloud load cannot replace a newer language choice');
assert.equal(settings.prefs.theme, 'light', 'rapid preferences updates preserve both choices');
assert.equal(savedPrefs.at(-1).language, 'sv');
assert.equal(savedPrefs.at(-1).theme, 'light');
preferences.unmount();

const draftModule = hookHarness('src/lib/admin-content-draft.ts');
const defaults = { landing: { title: 'Landing', sections: [{ id: 'hero', value: 'Default' }] } };
const restored = draftModule.exports.restoreAdminContentDraft(defaults, { landing: { title: null, sections: [{ id: 'hero', value: 'Saved' }] }, unexpected: null });
assert.equal(restored.landing.sections[0].value, 'Saved');
assert.equal(restored.landing.title, 'Landing');
assert.equal(defaults.landing.sections[0].value, 'Default', 'draft restoration never mutates defaults');
assert.equal(draftModule.exports.restoreAdminContentDraft(defaults, { landing: null }).landing.sections[0].value, 'Default');

let analyticsError = null;
const batches = [];
const analytics = hookHarness('src/lib/analytics.ts', {
  './supabase': { supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'a' } } } }) },
    from: () => ({ insert: async rows => { batches.push(rows); return { error: analyticsError }; } }),
  } },
}, { localStorage, sessionStorage: localStorage });
storage.set('tayar-cookie-consent', JSON.stringify({ analytics: true }));
const events = Array.from({ length: 25 }, (_, id) => ({ event: String(id), category: 'tool_usage' }));
storage.set('tayar-analytics-queue', JSON.stringify(events));
await analytics.exports.flush();
assert.equal(batches[0].length, 10);
assert.equal(JSON.parse(storage.get('tayar-analytics-queue')).length, 15, 'flushing one batch keeps later events');
analyticsError = { message: 'offline' };
await analytics.exports.flush();
assert.equal(JSON.parse(storage.get('tayar-analytics-queue')).length, 15, 'database errors requeue only the failed batch');
analyticsError = null;
await Promise.all([analytics.exports.flush(), analytics.exports.flush()]);
assert.equal(JSON.parse(storage.get('tayar-analytics-queue')).length, 5, 'overlapping flushes do not send the same batch twice');
storage.set('tayar-analytics-queue', '{}');
assert.doesNotThrow(() => analytics.exports.track('test'), 'malformed browser queue is recoverable');

let scheduleInserts = 0;
let schedulerReady = false;
let executorReady = false;
const scheduleService = hookHarness('src/modules/website-builder/services/publishScheduleService.ts', {
  '@/lib/supabase': { supabase: {
    rpc: async () => ({ data: schedulerReady, error: null }),
    functions: { invoke: async () => ({ data: { ready: executorReady }, error: null }) },
    from: () => { scheduleInserts++; return { insert: () => ({ select: () => ({ single: async () => ({ data: { id: 's1' }, error: null }) }) }) }; },
  } },
  '../core/editor-publishing': {
    normalizeEditorPublishPlan: plan => plan,
    validateEditorPublishPlan: () => [],
  },
});
const schedule = { id: 's1', ownerId: 'u1', projectId: 'p1', plan: { scheduledAt: new Date(Date.now() + 3600000).toISOString(), environment: 'production', mode: 'full', pageIds: [], releaseNote: '' }, allPageIds: [] };
assert.match((await scheduleService.exports.createWebsitePublishSchedule(schedule)).error.message, /unavailable/);
assert.equal(scheduleInserts, 0, 'no schedule is silently queued when cron is absent');
schedulerReady = true;
assert.match((await scheduleService.exports.createWebsitePublishSchedule(schedule)).error.message, /unavailable/);
assert.equal(scheduleInserts, 0, 'deployed executor also has to report readiness');
executorReady = true;
assert.match((await scheduleService.exports.createWebsitePublishSchedule({ ...schedule, plan: { ...schedule.plan, mode: 'selective' } })).error.message, /full production/);
assert.equal(scheduleInserts, 0, 'unsupported selective jobs never enter a queue');
assert.equal((await scheduleService.exports.createWebsitePublishSchedule(schedule)).data.id, 's1');
assert.equal(scheduleInserts, 1);

projects.unmount(); admin.unmount(); auth.unmount(); notifications.unmount();
console.log('PASS project audit: confirmed writes, save concurrency, auth races, admin isolation, notifications, full pagination, preferences, content drafts, analytics, publishing readiness');
