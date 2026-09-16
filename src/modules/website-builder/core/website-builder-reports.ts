import type { WebsiteDeliveryConfig } from './delivery-config';

interface AuditSummary {
  score: number;
  errors: string[];
  warnings: string[];
}

interface LaunchReadinessSummary {
  score: number;
  checks: Array<{ ok: boolean; label: string }>;
}

interface DeliveryUsageSummary {
  pages: number;
  sections: number;
  elements: number;
  forms: number;
  releases: number;
  leads: number;
  analyticsEvents: number;
}

export interface AuditReportContext {
  siteName: string;
  siteAudit: AuditSummary;
  pageCount: number;
  networkOnline: boolean;
  cloudSyncFailed: boolean;
  qualityDiagnostics: { snapshotKb: number; elements: number };
}

export interface DeliveryReportContext {
  deliveryConfig: WebsiteDeliveryConfig;
  approvalCurrent: boolean;
  siteName: string;
  launchReadiness: LaunchReadinessSummary;
  siteAudit: AuditSummary;
  publishedUrl: string;
  previewUrl: string;
  deliveryUsage: DeliveryUsageSummary;
  localize: (value: string) => string;
}

export interface V1LaunchReportContext {
  launchManualChecks: { stripe: boolean; domain: boolean; support: boolean };
  siteName: string;
  cloudProjectId: string | null;
  planLabel: string;
  v1LaunchStatus: {
    status: string;
    score: number;
    checks: Array<{ ok: boolean; label: string; detail: string }>;
    blockers: string[];
  };
  siteAudit: AuditSummary;
  productionUrl: string;
  publishedUrl: string;
  liveVerification: string;
  cloudSyncFailed: boolean;
  autoSaveStatus: string;
  networkOnline: boolean;
}

export function buildAuditReportText({
  siteName,
  siteAudit,
  pageCount,
  networkOnline,
  cloudSyncFailed,
  qualityDiagnostics,
}: AuditReportContext) {
  const lines = [
    'Tayar Website Builder — Pre-publish Audit',
    `Site: ${siteName}`,
    `Generated: ${new Date().toISOString()}`,
    `Score: ${siteAudit.score}/100`,
    `Pages: ${pageCount}`,
    `Errors: ${siteAudit.errors.length}`,
    `Warnings: ${siteAudit.warnings.length}`,
    `Online: ${networkOnline ? 'yes' : 'no'}`,
    `Cloud sync: ${cloudSyncFailed ? 'needs retry' : 'healthy'}`,
    `Snapshot: ${qualityDiagnostics.snapshotKb} KB`,
    `Elements: ${qualityDiagnostics.elements}`,
    '',
    'ERRORS',
    ...(siteAudit.errors.length ? siteAudit.errors.map((item) => `- ${item}`) : ['- None']),
    '',
    'WARNINGS',
    ...(siteAudit.warnings.length ? siteAudit.warnings.map((item) => `- ${item}`) : ['- None']),
  ];
  return lines.join('\n');
}

export function buildDeliveryReportText({
  deliveryConfig,
  approvalCurrent,
  siteName,
  launchReadiness,
  siteAudit,
  publishedUrl,
  previewUrl,
  deliveryUsage,
  localize,
}: DeliveryReportContext) {
  const due = deliveryConfig.dueDate || 'Not set';
  const approval = deliveryConfig.approvedAt
    ? `${new Date(deliveryConfig.approvedAt).toLocaleString()}${approvalCurrent ? ' (current build)' : ' (site changed after approval)'}`
    : 'Not approved';
  return [
    deliveryConfig.whiteLabel ? 'Website Delivery Report' : 'Tayar Website Builder — Client Delivery Report',
    '',
    `Project: ${siteName}`,
    `Project code: ${deliveryConfig.projectCode || '—'}`,
    `Client: ${deliveryConfig.clientName || '—'}`,
    `Client email: ${deliveryConfig.clientEmail || '—'}`,
    `Status: ${deliveryConfig.status}`,
    `Due date: ${due}`,
    `Generated: ${new Date().toISOString()}`,
    `Launch readiness: ${launchReadiness.score}/100`,
    `Audit score: ${siteAudit.score}/100`,
    `Approval: ${approval}`,
    `Delivered: ${deliveryConfig.deliveredAt ? new Date(deliveryConfig.deliveredAt).toLocaleString() : 'No'}`,
    `Live URL: ${publishedUrl || 'Not published'}`,
    `Share preview: ${previewUrl || 'Not created'}`,
    '',
    'USAGE',
    `Pages: ${deliveryUsage.pages}`,
    `Sections: ${deliveryUsage.sections}`,
    `Elements: ${deliveryUsage.elements}`,
    `Forms: ${deliveryUsage.forms}`,
    `Releases: ${deliveryUsage.releases}`,
    `Leads loaded: ${deliveryUsage.leads}`,
    `Analytics events loaded: ${deliveryUsage.analyticsEvents}`,
    '',
    'LAUNCH CHECKS',
    ...launchReadiness.checks.map((item) => `- ${item.ok ? '[x]' : '[ ]'} ${localize(item.label)}`),
    '',
    'AUDIT ERRORS',
    ...(siteAudit.errors.length ? siteAudit.errors.map((item) => `- ${item}`) : ['- None']),
    '',
    'AUDIT WARNINGS',
    ...(siteAudit.warnings.length ? siteAudit.warnings.map((item) => `- ${item}`) : ['- None']),
    '',
    'HANDOFF NOTES',
    deliveryConfig.handoffNotes || '—',
  ].join('\n');
}

export function buildV1LaunchReportText({
  launchManualChecks,
  siteName,
  cloudProjectId,
  planLabel,
  v1LaunchStatus,
  siteAudit,
  productionUrl,
  publishedUrl,
  liveVerification,
  cloudSyncFailed,
  autoSaveStatus,
  networkOnline,
}: V1LaunchReportContext) {
  const manual = [
    ['Stripe test payment + webhook', launchManualChecks.stripe],
    ['Production domain / DNS', launchManualChecks.domain],
    ['Support + legal contact review', launchManualChecks.support],
  ] as const;
  const lines = [
    'Tayar Website Builder V1 — Final Launch Report',
    `Generated: ${new Date().toISOString()}`,
    `Project: ${siteName || 'Untitled website'}`,
    `Cloud project: ${cloudProjectId || 'Not saved'}`,
    `Plan: ${planLabel}`,
    `Launch status: ${v1LaunchStatus.status}`,
    `Launch score: ${v1LaunchStatus.score}/100`,
    `Audit score: ${siteAudit.score}/100`,
    `Production URL: ${productionUrl || 'Not configured'}`,
    `Published URL: ${publishedUrl || 'Not published'}`,
    `Live verification: ${liveVerification}`,
    `Cloud sync: ${cloudSyncFailed || autoSaveStatus === 'failed' ? 'needs attention' : networkOnline ? 'healthy' : 'offline'}`,
    '',
    'Automated launch checks',
    ...v1LaunchStatus.checks.map((check) => `- ${check.ok ? '[x]' : '[ ]'} ${check.label}: ${check.detail}`),
    '',
    'Manual production checks',
    ...manual.map(([label, ok]) => `- ${ok ? '[x]' : '[ ]'} ${label}`),
    '',
    'Blockers',
    ...(v1LaunchStatus.blockers.length ? v1LaunchStatus.blockers.map((item) => `- ${item}`) : ['- None']),
    '',
    'Audit errors',
    ...(siteAudit.errors.length ? siteAudit.errors.map((item) => `- ${item}`) : ['- None']),
    '',
    'Audit warnings',
    ...(siteAudit.warnings.length ? siteAudit.warnings.map((item) => `- ${item}`) : ['- None']),
  ];
  return lines.join('\n');
}
