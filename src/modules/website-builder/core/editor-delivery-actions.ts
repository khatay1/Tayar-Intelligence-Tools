import type { Dispatch, SetStateAction } from 'react';
import type { WebsiteDeliveryConfig } from './delivery-config';
import type { ApplicationDefinition } from './application-model';
import { applicationRequirementIssues } from './application-requirements';
import { normalizeSlug } from './project-identifiers';
import { downloadTextFile } from './website-builder-rendering';
import { buildDeliveryReportText } from './website-builder-reports';
import type { BillingFeature, WebsitePage } from './website-builder-model';

type DeliveryReport = Parameters<typeof buildDeliveryReportText>[0];

interface DeliveryActionsContext {
  application?: ApplicationDefinition;
  pages: WebsitePage[];
  deliveryConfig: WebsiteDeliveryConfig;
  approvalCurrent: boolean;
  siteName: string;
  getLaunchReadiness: () => DeliveryReport['launchReadiness'];
  siteAudit: DeliveryReport['siteAudit'];
  publishedUrl: string;
  previewUrl: string;
  deliveryUsage: DeliveryReport['deliveryUsage'];
  setDeliveryConfig: Dispatch<SetStateAction<WebsiteDeliveryConfig>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  buildDeliveryFingerprint: () => string;
  requireBillingFeature: (feature: BillingFeature, label: string) => boolean;
  l: (text: string) => string;
}

export function createDeliveryActions({
  application,
  pages,
  deliveryConfig, approvalCurrent, siteName, getLaunchReadiness, siteAudit,
  publishedUrl, previewUrl, deliveryUsage, setDeliveryConfig, setSaved,
  buildDeliveryFingerprint, requireBillingFeature, l,
}: DeliveryActionsContext) {
  const requirementsBlocker = () => applicationRequirementIssues(application, pages)[0];

  function approveForDelivery() {
    const blocker = requirementsBlocker();
    if (blocker) {
      window.alert(l('Application requirements are incomplete. Restore every required page, form and action before approval.'));
      return;
    }
    const approvedAt = new Date().toISOString();
    setDeliveryConfig((current) => ({
      ...current,
      status: 'approved',
      approvedAt,
      approvedFingerprint: buildDeliveryFingerprint(),
      deliveredAt: null,
    }));
    setSaved(false);
  }

  function clearDeliveryApproval() {
    setDeliveryConfig((current) => ({
      ...current,
      status: current.status === 'approved' ? 'review' : current.status,
      approvedAt: null,
      approvedFingerprint: '',
      deliveredAt: null,
    }));
    setSaved(false);
  }

  function markProjectDelivered() {
    const blocker = requirementsBlocker();
    if (blocker) {
      window.alert(l('Application requirements are incomplete. Restore every required page, form and action before approval.'));
      return;
    }
    if (!approvalCurrent) {
      window.alert(l('Approve the current build before marking it delivered.'));
      return;
    }
    if (!publishedUrl && !window.confirm(l('This project is not currently published. Mark it delivered anyway?'))) return;
    setDeliveryConfig((current) => ({ ...current, status: 'delivered', deliveredAt: new Date().toISOString() }));
    setSaved(false);
  }

  function buildDeliveryReport() {
    return buildDeliveryReportText({
      deliveryConfig,
      approvalCurrent,
      siteName,
      launchReadiness: getLaunchReadiness(),
      siteAudit,
      publishedUrl,
      previewUrl,
      deliveryUsage,
      localize: l,
    });
  }

  function exportDeliveryReport() {
    if (!requireBillingFeature('clientDelivery', 'Client delivery reports')) return;
    downloadTextFile(`${normalizeSlug(siteName || 'website')}-delivery-report.txt`, buildDeliveryReport());
  }



  return { approveForDelivery, clearDeliveryApproval, markProjectDelivered, buildDeliveryReport, exportDeliveryReport };
}
