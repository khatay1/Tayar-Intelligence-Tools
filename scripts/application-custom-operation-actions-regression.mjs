import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-custom-operation-actions-'));
try {
  const outfile = join(dir, 'actions.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/application-custom-operation-actions.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile });
  const { parseApplicationCustomOperationAction } = (await import(pathToFileURL(outfile))).default;
  const allowed = new Set(['approve_case', 'calculate_total']);
  assert.deepEqual(parseApplicationCustomOperationAction('approve_case', '{"caseId":"c-7","force":false}', allowed), {
    operationId: 'approve_case', input: { caseId: 'c-7', force: false },
  });
  for (const [id, input] of [
    ['missing', '{}'], ['bad id', '{}'], ['approve_case', '[]'], ['approve_case', 'null'],
    ['approve_case', '{broken'], ['approve_case', '{"nested":{"value":1},"__proto__":{"polluted":true}}'],
    ['approve_case', `{"value":"${'x'.repeat(32 * 1024)}"}`],
    ['approve_case', `{"a":${'['.repeat(21)}0${']'.repeat(21)}}`],
  ]) assert.equal(parseApplicationCustomOperationAction(id, input, allowed), null, `${id} / ${input.slice(0, 40)}`);
  console.log('PASS declarative custom operation actions: trusted ID allowlist, bounded JSON input and unsafe key/depth rejection');
} finally {
  await rm(dir, { recursive: true, force: true });
}
