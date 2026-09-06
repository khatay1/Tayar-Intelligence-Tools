import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = 'supabase/functions';

function collectTypeScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.ts') ? [entryPath] : [];
  });
}

const files = collectTypeScriptFiles(root).sort();
let failed = 0;

for (const file of files) {
  const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const errors = (result.diagnostics || []).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
  if (!errors.length) continue;

  failed += 1;
  console.error(`✗ ${file}`);
  for (const diagnostic of errors) {
    console.error(`  ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  }
}

if (failed) {
  console.error(`Edge Function syntax smoke test: ${files.length - failed} passed, ${failed} failed`);
  process.exit(1);
}

console.log(`Edge Function syntax smoke test: ${files.length} passed, 0 failed`);
