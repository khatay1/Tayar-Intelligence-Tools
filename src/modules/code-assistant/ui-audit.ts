import type { CodePatchPlan } from './patch-plan';
import type { CodeProjectContext } from './project-context';

export type UIAuditCategory = 'accessibility' | 'responsive' | 'consistency' | 'motion' | 'dependencies' | 'duplication';
export type UIAuditSeverity = 'high' | 'medium' | 'low';

export interface UIAuditFinding {
  id: string;
  category: UIAuditCategory;
  severity: UIAuditSeverity;
  path: string | null;
  message: string;
  evidence: string;
  suggestion: string;
  fixable: boolean;
}

export interface UIAuditReport {
  score: number;
  scannedFiles: number;
  totalFiles: number;
  truncated: boolean;
  fingerprint: string;
  findings: UIAuditFinding[];
  counts: Record<UIAuditSeverity, number>;
}

const MAX_FINDINGS = 160;
const UI_FILE = /\.(?:[cm]?[jt]sx?|css|scss|sass|less|html?)$/i;
const EXTERNAL_IMPORT = /(?:from\s+|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g;
const NODE_BUILTINS = new Set(['fs','path','url','crypto','util','events','stream','buffer','os','http','https','zlib','assert','module','child_process']);

function externalPackage(spec: string): string | null {
  if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@/') || spec.startsWith('#')) return null;
  if (spec.startsWith('node:')) return null;
  const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
  if (!name || NODE_BUILTINS.has(name)) return null;
  return name;
}

function occurrences(source: string, pattern: RegExp): string[] {
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
  return Array.from(source.matchAll(new RegExp(pattern.source, flags)), (match) => match[0]);
}

function compact(value: string, max = 180): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function classValues(source: string): string[] {
  const values: string[] = [];
  for (const match of source.matchAll(/className\s*=\s*["'\x60]([^"'\x60]{20,400})["'\x60]/g)) {
    values.push(match[1].replace(/\s+/g, ' ').trim());
  }
  return values;
}

function fixablePaths(project: CodeProjectContext): Set<string> {
  return new Set(project.files.filter((file) => !file.truncated).map((file) => file.path));
}

function severityWeight(severity: UIAuditSeverity): number {
  return severity === 'high' ? 8 : severity === 'medium' ? 4 : 1;
}

export function runProjectUIAudit(project: CodeProjectContext): UIAuditReport {
  const findings: UIAuditFinding[] = [];
  const canFix = fixablePaths(project);
  let nextId = 1;

  const add = (
    category: UIAuditCategory,
    severity: UIAuditSeverity,
    path: string | null,
    message: string,
    evidence: string,
    suggestion: string,
  ) => {
    if (findings.length >= MAX_FINDINGS) return;
    findings.push({
      id: `audit-${nextId++}`,
      category,
      severity,
      path,
      message,
      evidence: compact(evidence),
      suggestion,
      fixable: Boolean(path && canFix.has(path)),
    });
  };

  const classUsage = new Map<string, Set<string>>();
  const importedPackages = new Map<string, Set<string>>();
  const installed = new Set([...Object.keys(project.dependencies), ...Object.keys(project.devDependencies)]);

  for (const file of project.auditFiles.filter((entry) => UI_FILE.test(entry.path))) {
    const source = file.content;

    const missingAlt = occurrences(source, /<img\b(?![^>]*\balt\s*=)[^>]*>/gi);
    if (missingAlt.length) add(
      'accessibility', 'high', file.path,
      `${missingAlt.length} image element(s) do not expose alt text.`,
      missingAlt[0],
      'Add meaningful alt text, or alt="" for intentionally decorative images.',
    );

    let unlabeledButtons = 0;
    let unlabeledButtonEvidence = '';
    for (const match of source.matchAll(/<button\b([^>]*)>([\s\S]{0,500}?)<\/button>/gi)) {
      const attrs = match[1] || '';
      if (/\baria-label\s*=|\baria-labelledby\s*=|\btitle\s*=/.test(attrs)) continue;
      const visible = (match[2] || '').replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();
      if (!visible) {
        unlabeledButtons++;
        if (!unlabeledButtonEvidence) unlabeledButtonEvidence = match[0];
      }
    }
    if (unlabeledButtons) add(
      'accessibility', 'high', file.path,
      `${unlabeledButtons} icon/empty button(s) appear to have no accessible name.`,
      unlabeledButtonEvidence,
      'Add visible button text or aria-label/aria-labelledby.',
    );

    const clickOnly = occurrences(source, /<(?:div|span)\b(?=[^>]*\bonClick\s*=)(?![^>]*\brole\s*=)(?![^>]*\btabIndex\s*=)[^>]*>/gi);
    if (clickOnly.length) add(
      'accessibility', 'medium', file.path,
      `${clickOnly.length} clickable div/span element(s) lack keyboard-role hints.`,
      clickOnly[0],
      'Prefer a native button/link, or add the correct role, tabIndex and keyboard handling.',
    );

    const weakInputs = occurrences(source, /<input\b(?![^>]*type\s*=\s*["']hidden["'])(?![^>]*(?:aria-label|aria-labelledby|\bid\s*=|\bname\s*=))[^>]*>/gi);
    if (weakInputs.length) add(
      'accessibility', 'medium', file.path,
      `${weakInputs.length} input(s) have no obvious label association metadata.`,
      weakInputs[0],
      'Associate inputs with labels using id/htmlFor or aria-labelledby/aria-label.',
    );

    const fixedWidths = [
      ...occurrences(source, /(?:min-)?w-\[(?:[4-9]\d{2}|\d{4,})px\]/g),
      ...occurrences(source, /\bwidth\s*:\s*(?:[6-9]\d{2}|\d{4,})px\b/gi),
    ];
    if (fixedWidths.length) add(
      'responsive', 'medium', file.path,
      `${fixedWidths.length} large fixed-width rule(s) may overflow smaller screens.`,
      fixedWidths[0],
      'Use max-width, fluid sizing, responsive breakpoints or overflow-safe containers.',
    );

    let rigidGrid = '';
    for (const value of classValues(source)) {
      if (/\bgrid-cols-[3-9]\b/.test(value) && !/(?:sm|md|lg|xl|2xl):grid-cols-/.test(value)) {
        rigidGrid = value;
        break;
      }
    }
    if (rigidGrid) add(
      'responsive', 'medium', file.path,
      'A multi-column grid has no obvious responsive column override.',
      rigidGrid,
      'Add smaller-screen grid columns and scale up at breakpoints.',
    );

    const usesMotion = /from\s+['"](?:framer-motion|motion|gsap|@react-spring\/web)['"]|\bgsap\.|\bmotion\./.test(source);
    const reducedMotion = /prefers-reduced-motion|useReducedMotion|matchMedia\([^)]*reduced-motion/i.test(source);
    if (usesMotion && !reducedMotion) add(
      'motion', 'medium', file.path,
      'Animation code is present without an obvious reduced-motion path.',
      source.match(/.{0,80}(?:framer-motion|motion|gsap|react-spring).{0,80}/)?.[0] || 'animation dependency detected',
      'Respect prefers-reduced-motion or use the library reduced-motion helper.',
    );

    const hardColors = occurrences(source, /#[0-9a-fA-F]{3,8}\b/g);
    if (project.styleProfile.cssVariables.length > 0 && hardColors.length >= 5) add(
      'consistency', 'low', file.path,
      `${hardColors.length} hard-coded color values bypass detected project CSS variables.`,
      hardColors.slice(0, 6).join(', '),
      'Prefer the project color tokens/CSS variables for maintainable theme consistency.',
    );

    for (const value of classValues(source)) {
      if (value.length < 45) continue;
      const paths = classUsage.get(value) || new Set<string>();
      paths.add(file.path);
      classUsage.set(value, paths);
    }

    for (const match of source.matchAll(EXTERNAL_IMPORT)) {
      const name = externalPackage(match[1] || '');
      if (!name) continue;
      const paths = importedPackages.get(name) || new Set<string>();
      paths.add(file.path);
      importedPackages.set(name, paths);
    }
  }

  for (const [classes, paths] of classUsage) {
    if (paths.size < 3) continue;
    add(
      'duplication', 'low', null,
      `The same long class pattern is repeated across ${paths.size} files.`,
      `${Array.from(paths).slice(0, 4).join(', ')} · ${classes}`,
      'Consider extracting a shared UI primitive or reusable variant when the semantics match.',
    );
  }

  for (const [name, paths] of importedPackages) {
    if (installed.has(name) || name === 'react' || name === 'react-dom') continue;
    add(
      'dependencies', 'high', paths.values().next().value || null,
      `Imported package "${name}" is not declared in project dependencies.`,
      Array.from(paths).slice(0, 4).join(', '),
      'Declare the package explicitly or replace the import with an existing project dependency.',
    );
  }

  const dependencyGroups: Array<{ label: string; names: string[] }> = [
    { label: 'animation libraries', names: ['framer-motion', 'motion', 'gsap', '@react-spring/web'] },
    { label: 'icon libraries', names: ['lucide-react', 'react-icons', '@heroicons/react', '@tabler/icons-react'] },
    { label: 'UI frameworks', names: ['@mui/material', 'antd', '@chakra-ui/react', '@mantine/core'] },
  ];
  for (const group of dependencyGroups) {
    const found = group.names.filter((name) => installed.has(name));
    if (found.length > 1) add(
      'dependencies', 'low', null,
      `Multiple ${group.label} are installed: ${found.join(', ')}.`,
      found.join(', '),
      'Confirm each library is intentionally used; consolidate overlapping UI dependencies when practical.',
    );
  }

  const counts = {
    high: findings.filter((finding) => finding.severity === 'high').length,
    medium: findings.filter((finding) => finding.severity === 'medium').length,
    low: findings.filter((finding) => finding.severity === 'low').length,
  };
  const penalty = findings.reduce((total, finding) => total + severityWeight(finding.severity), 0);
  return {
    score: Math.max(0, 100 - Math.min(100, penalty)),
    scannedFiles: project.auditFiles.length,
    totalFiles: project.totalCandidateFiles,
    truncated: project.auditTruncated,
    fingerprint: project.fileStoreFingerprint,
    findings,
    counts,
  };
}

export function auditFixableFindings(report: UIAuditReport): UIAuditFinding[] {
  return report.findings.filter((finding) => finding.fixable && finding.path).slice(0, 20);
}

export function validateAuditFixPlan(
  project: CodeProjectContext,
  report: UIAuditReport,
  plan: CodePatchPlan,
): void {
  if (report.fingerprint !== project.fileStoreFingerprint) throw new Error('Project changed since the UI audit. Run the audit again.');
  if (plan.operations.length > 10) throw new Error('UI audit fix plan exceeds the 10-file review limit.');
  if (plan.dependenciesToInstall.length || plan.registryDependencies.length) {
    throw new Error('UI audit fixes may not add package or registry dependencies.');
  }
  const allowedPaths = new Set(auditFixableFindings(report).map((finding) => finding.path).filter((path): path is string => Boolean(path)));
  for (const operation of plan.operations) {
    if (operation.type !== 'replace' || !allowedPaths.has(operation.path)) {
      throw new Error(`UI audit fix plan attempted to modify unapproved path "${operation.path}".`);
    }
    const snapshot = project.files.find((file) => file.path === operation.path);
    if (!snapshot || snapshot.truncated) throw new Error(`UI audit fix path "${operation.path}" is not available as a complete safe snapshot.`);
  }
}
