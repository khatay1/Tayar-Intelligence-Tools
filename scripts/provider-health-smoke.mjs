import fs from 'node:fs';

const source = fs.readFileSync('src/lib/ai/provider-health.ts', 'utf8');
const requiredStates = ['not-configured', 'disabled', 'ready', 'default'];
for (const state of requiredStates) {
  if (!source.includes(`'${state}'`)) throw new Error(`Provider health state missing: ${state}`);
}
const guards = [
  '!input.configured || !input.secretConfigured',
  '!input.enabled',
  'input.isDefault',
  "canTest: false, canActivate: false",
  "canTest: true, canActivate: true",
];
for (const guard of guards) {
  if (!source.includes(guard)) throw new Error(`Provider health safety guard missing: ${guard}`);
}
console.log(`provider-health smoke: OK (${requiredStates.length} states)`);
