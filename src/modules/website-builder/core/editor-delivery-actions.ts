import type { Dispatch, SetStateAction } from 'react';
import type { WebsiteDeliveryConfig } from './delivery-config';
import { normalizeSlug } from './project-identifiers';
import { downloadTextFile } from './website-builder-rendering';
import { buildDeliveryReportText } from './website-builder-reports';
import type { BillingFeature } from './website-builder-model';

type DeliveryReport = Parameters<typeof buildDeliveryReportText>[0];

interface DeliveryActionsContext {
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
  deliveryConfig, approvalCurrent, siteName, getLaunchReadiness, siteAudit,
  publishedUrl, previewUrl, deliveryUsage, setDeliveryConfig, setSaved,
  buildDeliveryFingerprint, requireBillingFeature, l,
}: DeliveryActionsContext) {
  function approveForDelivery() {
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
