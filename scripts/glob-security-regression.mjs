import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const rootRequire = createRequire(import.meta.url);
const tailwindRequire = createRequire(rootRequire.resolve('tailwindcss/package.json'));
const require = createRequire(tailwindRequire.resolve('micromatch'));
const braces = require('braces');
const micromatch = require('micromatch');
assert.equal(require('braces/package.json').version, '3.0.3-tayar.1');
assert.deepEqual(braces.expand('src/{a,b}/{1..3}.tsx'), ['src/a/1.tsx', 'src/a/2.tsx', 'src/a/3.tsx', 'src/b/1.tsx', 'src/b/2.tsx', 'src/b/3.tsx']);
assert.deepEqual(micromatch(['src/a.tsx', 'src/b.ts', 'api/a.js'], 'src/*.{ts,tsx}'), ['src/a.tsx', 'src/b.ts']);
for (const nesting of ['{', '(']) for (const n of [65, 1000, 4000]) {
  const close = nesting === '{' ? '}' : ')';
  const pattern = nesting.repeat(n) + 'a,b' + close.repeat(n);
  for (const method of ['parse', 'compile', 'stringify', 'expand']) assert.throws(() => braces[method](pattern), /safety limit/, `${method} must bound ${nesting} depth`);
}
let tree = { type: 'text', value: 'a' };
for (let n = 0; n < 1000; n++) tree = { type: 'root', nodes: [tree] };
for (const method of ['compile', 'stringify', 'expand']) assert.throws(() => braces[method](tree), /safety limit/);
const cyclic = { type: 'root', nodes: [] }; cyclic.nodes.push(cyclic);
for (const method of ['compile', 'stringify', 'expand']) assert.throws(() => braces[method](cyclic), /safety limit/);
console.log('PASS glob security: normal brace/range/glob compatibility, bounded 4000-deep patterns within the character limit, cyclic/deep AST denial');
