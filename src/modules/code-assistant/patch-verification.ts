import { normalizeNpmDependencyNames } from './dependency-spec';
import type { CodePatchPlan } from './patch-plan';
import type { CodeProjectContext } from './project-context';

export type PatchVerificationSeverity = 'error' | 'warning';

export interface PatchVerificationDiagnostic {
  code: 'unresolved-local-import' | 'undeclared-package' | 'removed-export' | 'unfinished-code';
  severity: PatchVerificationSeverity;
  path: string;
  message: string;
}

export interface PatchVerificationReport {
  ok: boolean;
  errors: number;
  warnings: number;
  diagnostics: PatchVerificationDiagnostic[];
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.scss', '.sass', '.less', '.json'];
const ASSET_EXTENSION = /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp|woff2?|ttf|eot|mp[34]|wav|webm)$/i;
const NODE_BUILTINS = new Set([
  'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'events',
  'fs', 'http', 'http2', 'https', 'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'querystring',
  'readline', 'repl', 'stream', 'string_decoder', 'timers', 'tls', 'tty', 'url', 'util', 'v8', 'vm',
  'worker_threads', 'zlib',
]);

function normalizePath(value: string): string {
  const output: string[] = [];
  for (const part of value.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') output.pop();
    else output.push(part);
  }
  return output.join('/');
}

function directory(path: string): string {
  const index = path.lastIndexOf('/');
  return index < 0 ? '' : path.slice(0, index);
}

function importSpecifiers(source: string): string[] {
  const output = new Set<string>();
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^\n;]*?\s+from\s+)?['"]([^'"\n]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source))) output.add(match[1]);
  }
  return Array.from(output);
}

function localImportBase(ownerPath: string, specifier: string): string | null {
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return normalizePath(`${directory(ownerPath)}/${specifier}`);
  }
  if (specifier.startsWith('@/')) return normalizePath(`src/${specifier.slice(2)}`);
  return null;
}

function localImportCandidates(base: string): string[] {
  const candidates = new Set<string>([base]);
  for (const extension of SOURCE_EXTENSIONS) {
    candidates.add(`${base}${extension}`);
    candidates.add(`${base}/index${extension}`);
  }
  return Array.from(candidates);
}

function packageName(specifier: string): string | null {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('@/')) return null;
  if (/^(?:https?:|data:|virtual:)/i.test(specifier)) return null;
  const clean = specifier.startsWith('node:') ? specifier.slice(5) : specifier;
  const parts = clean.split('/');
  if (NODE_BUILTINS.has(parts[0])) return null;
  return clean.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function exportedNames(source: string): Set<string> {
  const names = new Set<string>();
  if (/\bexport\s+default\b/.test(source)) names.add('default');
  const declaration = /\bexport\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  let match: RegExpExecArray | null;
  while ((match = declaration.exec(source))) names.add(match[1]);
  const lists = /\bexport\s*{([^}]+)}/g;
  while ((match = lists.exec(source))) {
    for (const entry of match[1].split(',')) {
      const cleaned = entry.trim().replace(/^type\s+/, '');
      const alias = cleaned.split(/\s+as\s+/i).pop()?.trim();
      if (alias && /^[A-Za-z_$][\w$]*$/.test(alias)) names.add(alias);
    }
  }
  return names;
}

function pushDiagnostic(
  diagnostics: PatchVerificationDiagnostic[],
  diagnostic: PatchVerificationDiagnostic,
): void {
  if (diagnostics.some((entry) => entry.code === diagnostic.code && entry.path === diagnostic.path && entry.message === diagnostic.message)) return;
  diagnostics.push(diagnostic);
}

export function verifyCodePatchPlan(project: CodeProjectContext, plan: CodePatchPlan): PatchVerificationReport {
  const diagnostics: PatchVerificationDiagnostic[] = [];
  const resultingPaths = new Set([...project.filePaths, ...plan.operations.map((operation) => operation.path)]);
  const declaredPackages = new Set([
    ...Object.keys(project.dependencies),
    ...Object.keys(project.devDependencies),
    ...normalizeNpmDependencyNames(plan.dependenciesToInstall),
  ]);
  const incompletePathInventory = project.filePaths.length < project.totalCandidateFiles;

  for (const operation of plan.operations) {
    for (const specifier of importSpecifiers(operation.content)) {
      const localBase = localImportBase(operation.path, specifier);
      if (localBase !== null) {
        if (ASSET_EXTENSION.test(localBase)) continue;
        if (!localImportCandidates(localBase).some((candidate) => resultingPaths.has(candidate))) {
          pushDiagnostic(diagnostics, {
            code: 'unresolved-local-import',
            severity: incompletePathInventory ? 'warning' : 'error',
            path: operation.path,
            message: `Local import "${specifier}" does not resolve to a generated or known project file.`,
          });
        }
        continue;
      }

      const dependency = packageName(specifier);
      if (dependency && !declaredPackages.has(dependency)) {
        pushDiagnostic(diagnostics, {
          code: 'undeclared-package',
          severity: 'error',
          path: operation.path,
          message: `Package "${dependency}" is imported but is neither installed nor listed in dependenciesToInstall.`,
        });
      }
    }

    if (/\b(?:TODO|FIXME)\b|throw\s+new\s+Error\s*\(\s*['"](?:not implemented|todo)/i.test(operation.content)) {
      pushDiagnostic(diagnostics, {
        code: 'unfinished-code',
        severity: 'warning',
        path: operation.path,
        message: 'Generated file contains an unfinished-code marker that requires review.',
      });
    }

    if (operation.type === 'replace') {
      const existing = project.files.find((file) => file.path === operation.path && !file.truncated);
      if (!existing) continue;
      const before = exportedNames(existing.content);
      const after = exportedNames(operation.content);
      for (const exportedName of before) {
        if (!after.has(exportedName)) {
          pushDiagnostic(diagnostics, {
            code: 'removed-export',
            severity: 'error',
            path: operation.path,
            message: `Replacement removes the existing "${exportedName}" export.`,
          });
        }
      }
    }
  }

  diagnostics.sort((a, b) => a.severity.localeCompare(b.severity) || a.path.localeCompare(b.path) || a.message.localeCompare(b.message));
  const errors = diagnostics.filter((entry) => entry.severity === 'error').length;
  const warnings = diagnostics.length - errors;
  return { ok: errors === 0, errors, warnings, diagnostics };
}

export function patchVerificationRepairPayload(report: PatchVerificationReport) {
  return report.diagnostics.slice(0, 24).map(({ code, severity, path, message }) => ({ code, severity, path, message }));
}
