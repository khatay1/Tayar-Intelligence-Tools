import { build } from 'esbuild';

const bundled = await build({
  stdin: {
    contents: `export { verifyCodePatchPlan } from './src/modules/code-assistant/patch-verification.ts';`,
    resolveDir: process.cwd(),
    sourcefile: 'patch-verification-test-entry.ts',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  write: false,
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`;
const { verifyCodePatchPlan } = await import(moduleUrl);

const project = {
  id: 'project-1',
  title: 'Verification fixture',
  type: 'code',
  status: 'draft',
  framework: 'React + Vite',
  packageManager: 'npm',
  styleProfile: {},
  dependencies: { react: '^18.3.1' },
  devDependencies: {},
  files: [{ path: 'src/Existing.tsx', content: 'export function Existing() { return null; }', truncated: false }],
  auditFiles: [],
  auditTruncated: false,
  packageJsonFile: null,
  filePaths: ['src/Existing.tsx'],
  totalCandidateFiles: 1,
  truncated: false,
  fileStoreKind: 'object',
  fileStoreFingerprint: 'fixture',
  canApply: true,
};

const valid = verifyCodePatchPlan(project, {
  summary: 'valid',
  dependenciesToInstall: [],
  registryDependencies: [],
  warnings: [],
  operations: [
    { type: 'create', path: 'src/Helper.ts', content: 'export const value = 1;', reason: '' },
    { type: 'create', path: 'src/New.tsx', content: "import React from 'react';\nimport { value } from './Helper';\nexport const New = () => <div>{value}</div>;", reason: '' },
    { type: 'replace', path: 'src/Existing.tsx', content: 'export function Existing() { return <div />; }', reason: '' },
  ],
});
if (!valid.ok || valid.errors !== 0 || valid.warnings !== 0) {
  throw new Error(`Expected valid patch, received ${JSON.stringify(valid)}`);
}

const invalid = verifyCodePatchPlan(project, {
  summary: 'invalid',
  dependenciesToInstall: [],
  registryDependencies: [],
  warnings: [],
  operations: [
    {
      type: 'replace',
      path: 'src/Existing.tsx',
      content: "import { format } from 'date-fns';\nimport { missing } from './Missing';\n// TODO finish behavior\nexport const Changed = () => format(new Date(), 'yyyy');",
      reason: '',
    },
  ],
});
const invalidCodes = new Set(invalid.diagnostics.map((entry) => entry.code));
for (const code of ['unresolved-local-import', 'undeclared-package', 'removed-export', 'unfinished-code']) {
  if (!invalidCodes.has(code)) throw new Error(`Expected ${code} diagnostic.`);
}
if (invalid.ok || invalid.errors !== 3 || invalid.warnings !== 1) {
  throw new Error(`Expected three blocking errors and one warning, received ${JSON.stringify(invalid)}`);
}

const incomplete = verifyCodePatchPlan({ ...project, totalCandidateFiles: 2 }, {
  summary: 'incomplete inventory',
  dependenciesToInstall: [],
  registryDependencies: [],
  warnings: [],
  operations: [{ type: 'create', path: 'src/New.ts', content: "import './PossiblyUnlisted';\nexport const value = 1;", reason: '' }],
});
if (!incomplete.ok || incomplete.errors !== 0 || incomplete.warnings !== 1) {
  throw new Error(`Incomplete path inventory should downgrade unresolved local imports to warnings: ${JSON.stringify(incomplete)}`);
}

console.log('[code-assistant-patch-verification] PASS');
