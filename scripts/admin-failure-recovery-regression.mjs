import assert from 'node:assert/strict';
import { hookHarness, settle } from './test-support/hook-harness.mjs';

let userCalls = 0;
const users = hookHarness('src/lib/admin-hooks.ts', {
  '@/lib/supabase': { supabase: { rpc: async () => {
    userCalls++;
    if (userCalls === 1) throw new Error('Network offline');
    return { data: [{ id: 'one', email: null, full_name: null }], error: null };
  } } },
  '@/lib/paginated-query': { readAllRows: async () => [] },
});
users.render('useAdminUsers');
await settle();
let state = users.render('useAdminUsers');
assert.equal(state.loading, false, 'a rejected user lookup releases the spinner');
assert.equal(state.error, 'Network offline');
await state.refresh();
state = users.render('useAdminUsers');
assert.equal(state.error, null);
assert.equal(state.users[0].full_name, '');
assert.equal(userCalls, 2);

let billingCalls = 0;
const billing = hookHarness('src/components/admin/AdminSubscriptions.tsx', {
  '@/lib/ui-localization': { useLocalizer: () => s => s },
  'lucide-react': Object.fromEntries(['AlertCircle', 'CheckCircle', 'CreditCard', 'ExternalLink', 'Landmark', 'Loader2', 'RefreshCw', 'Settings', 'Tag', 'TrendingUp', 'Webhook', 'XCircle'].map(name => [name, name])),
  '@/lib/supabase': { supabase: {
    rpc: async () => ({ data: [], error: null }),
    from: () => ({ select: () => ({ order: async () => ({ data: [], error: null }) }) }),
    functions: { invoke: async () => { billingCalls++; throw new Error('Billing network offline'); } },
  } },
  './Charts': { BarChart: 'chart' },
});
const findButton = (node, name) => {
  if (!node || typeof node !== 'object') return null;
  const children = node.props?.children;
  if (node.type === 'button' && JSON.stringify(children)?.includes(name)) return node;
  for (const child of Array.isArray(children) ? children : [children]) {
    const result = findButton(child, name);
    if (result) return result;
  }
  return null;
};
billing.render('default');
await settle();
let tree = billing.render('default');
findButton(tree, 'Payment Settings').props.onClick();
billing.render('default');
await settle();
for (let i = 0; i < 4; i++) billing.render('default');
assert.equal(billingCalls, 1, 'failed billing status must not cause an effect retry loop');
tree = billing.render('default');
findButton(tree, 'Subscriptions Overview').props.onClick();
tree = billing.render('default');
findButton(tree, 'Payment Settings').props.onClick();
billing.render('default');
await settle();
assert.equal(billingCalls, 2, 'returning to payment settings retries explicitly');
console.log('PASS admin failure recovery: user lookup retry and bounded billing status requests');
