import assert from 'node:assert/strict';
import { hookHarness } from './test-support/hook-harness.mjs';

function elements(node, type) {
  if (!node || typeof node !== 'object') return [];
  return [...(node.type === type ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => elements(child, type))];
}
for (const raw of [null, 'null', '{', '42', '"invalid"', 'blocked']) {
  const timers = [], events = [];
  const component = hookHarness('src/components/workspace/CookieConsent.tsx', {
    '@/lib/ui-localization': { useLocalizer: () => text => text },
    '@/lib/analytics': { COOKIE_CONSENT_KEY: 'consent', COOKIE_CONSENT_EVENT: 'change' },
    'lucide-react': Object.fromEntries(['Cookie', 'X', 'Check', 'Settings'].map(name => [name, name])),
  }, {
    localStorage: { getItem: () => { if (raw === 'blocked') throw Error('SecurityError'); return raw; }, setItem: () => { throw Error('QuotaExceededError'); } },
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
    window: { location: {}, dispatchEvent: e => events.push(e) }, CustomEvent: class {},
  });
  assert.doesNotThrow(() => component.render('default'), 'Storage failures must not crash the app');
  timers.forEach(fn => fn());
  let view = component.render('default');
  assert.ok(view, 'Missing, corrupt or blocked consent must offer a fresh choice');
  const accept = elements(view, 'button').find(button => JSON.stringify(button.props.children).includes('Accept All'));
  assert.ok(accept);
  assert.doesNotThrow(() => accept.props.onClick(), 'Full/blocked storage must not crash consent actions');
  assert.deepEqual(events, [], 'Failed persistence must never announce analytics consent');
  assert.equal(component.render('default'), null);
  component.unmount();
}
console.log('PASS cookie consent: unavailable/full storage and malformed saved consent cannot crash the app or grant analytics consent');
