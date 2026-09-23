import type * as React from 'react';
import type { BillingEntitlements, BillingFeature, LiveVerification, WebsiteProductionConfig } from '../core/website-builder-model';
import type { WebsiteSEO } from '../core/types';

interface BuilderSettingsPanelProps {
  billingEntitlements: BillingEntitlements;
  cloudError: string;
  hasUnpublishedChanges: boolean;
  l: (text: string) => string;
  launchCheckBusy: boolean;
  launchLastCheckedAt: string | null;
  liveVerification: LiveVerification;
  productionConfig: WebsiteProductionConfig;
  publishBlocker: string;
  publishBusy: boolean;
  publishedAt: string | null;
  publishedUrl: string | null;
  publishError: string;
  publishWebsite: (fromStaging?: boolean) => Promise<void>;
  requireBillingFeature: (feature: BillingFeature, label: string) => boolean;
  runV1LaunchChecks: () => Promise<void>;
  seo: WebsiteSEO;
  setDeliveryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setProductionConfig: React.Dispatch<React.SetStateAction<WebsiteProductionConfig>>;
  setReleaseHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSaved: React.Dispatch<React.SetStateAction<boolean>>;
  setSeo: React.Dispatch<React.SetStateAction<WebsiteSEO>>;
  siteAudit: { errors: string[]; warnings: string[]; score: number; };
  unpublishWebsite: () => Promise<void>;
  verifyLiveDeployment: (expectedProjectId?: string | null, expectedOwnerId?: string, expectedLoadSequence?: number) => Promise<boolean>;
}

export function BuilderSettingsPanel({
  billingEntitlements,
  cloudError,
  hasUnpublishedChanges,
  l,
  launchCheckBusy,
  launchLastCheckedAt,
  liveVerification,
  productionConfig,
  publishBlocker,
  publishBusy,
  publishedAt,
  publishedUrl,
  publishError,
  publishWebsite,
  requireBillingFeature,
  runV1LaunchChecks,
  seo,
  setDeliveryOpen,
  setProductionConfig,
  setReleaseHistoryOpen,
  setSaved,
  setSeo,
  siteAudit,
  unpublishWebsite,
  verifyLiveDeployment,
}: BuilderSettingsPanelProps) {
  return (
    <div className="tayar-v2-manual-panel">
      <div className="tayar-v2-panel-heading">
        <strong>{l("Settings")}</strong>
      </div>

      <details open className="tayar-v2-manual-section">
        <summary>{l("Site Check")}</summary>
        <div className="tayar-v2-manual-fields">
          <div className="tayar-v2-check-score" data-ok={siteAudit.errors.length === 0 ? 'true' : 'false'}>
            <strong>{siteAudit.score}/100</strong>
            <span>
              {siteAudit.errors.length} {l('critical')} · {siteAudit.warnings.length} {l('warnings')}
            </span>
          </div>
          {launchLastCheckedAt && (
            <div className="tayar-v2-manual-note">
              {l('Last checked')} {new Date(launchLastCheckedAt).toLocaleString()}
            </div>
          )}
          {siteAudit.errors.length > 0 && (
            <div className="tayar-v2-check-list is-error">
              {siteAudit.errors.map((item) => <p key={item}>• {item}</p>)}
            </div>
          )}
          {siteAudit.warnings.length > 0 && (
            <div className="tayar-v2-check-list">
              {siteAudit.warnings.slice(0, 12).map((item) => <p key={item}>• {item}</p>)}
            </div>
          )}
          {!siteAudit.errors.length && !siteAudit.warnings.length && (
            <div className="tayar-v2-manual-note">{l("No site issues detected.")}</div>
          )}
          <button
            type="button"
            className="tayar-v2-manual-action"
            disabled={launchCheckBusy}
            onClick={() => void runV1LaunchChecks()}
          >
            {launchCheckBusy ? l('Checking…') : l('Run check again')}
          </button>
        </div>
      </details>

      <details open className="tayar-v2-manual-section">
        <summary>{l("Publishing")}</summary>
        <div className="tayar-v2-manual-fields">
          <div
            className="tayar-v2-publish-state"
            data-live={publishedUrl && liveVerification === 'healthy' ? 'true' : 'false'}
          >
            <strong>
              {!publishedUrl
                ? l('DRAFT')
                : hasUnpublishedChanges
                  ? l('CHANGES WAITING')
                : liveVerification === 'checking'
                  ? l('VERIFYING')
                  : liveVerification === 'failed'
                    ? l('CHECK FAILED')
                    : liveVerification === 'healthy'
                      ? l('LIVE')
                      : l('PUBLISHED')}
            </strong>
            <span>
              {!publishedUrl
                ? l('Your website is saved but not public.')
                : hasUnpublishedChanges
                  ? l('Your latest editor changes are not live yet.')
                : liveVerification === 'failed'
                  ? l('A published URL is saved, but the live file could not be verified.')
                  : liveVerification === 'checking'
                    ? l('Checking the public website now…')
                    : liveVerification === 'healthy'
                      ? l('Your website is public.')
                      : l('The website is published. Verify the live renderer before treating it as live.')}
            </span>
          </div>
          {publishedUrl && (
            <>
              <label>
                <span>{l("Live URL")}</span>
                <input value={publishedUrl} readOnly />
              </label>
              {publishedAt && <div className="tayar-v2-manual-note">{l('Published')} {new Date(publishedAt).toLocaleString()}</div>}
              <div className="tayar-v2-publish-actions">
                <button type="button" className="tayar-v2-manual-action" onClick={() => window.open(publishedUrl, '_blank', 'noopener,noreferrer')}>{l("Open live site")}</button>
                <button type="button" className="tayar-v2-manual-action" onClick={() => void navigator.clipboard.writeText(publishedUrl)}>{l("Copy URL")}</button>
                <button type="button" className="tayar-v2-manual-action" disabled={liveVerification === 'checking'} onClick={() => void verifyLiveDeployment()}>
                  {liveVerification === 'checking' ? l('Verifying…') : l('Verify live')}
                </button>
                {hasUnpublishedChanges && (
                  <button type="button" className="tayar-v2-manual-action" disabled={Boolean(publishBlocker) || publishBusy} onClick={() => void publishWebsite()} title={publishBlocker || l('Publish production changes')}>
                    {publishBusy ? l('Publishing…') : l('Publish production changes')}
                  </button>
                )}
                <button type="button" className="tayar-v2-manual-action is-danger" disabled={publishBusy} onClick={() => void unpublishWebsite()}>{l("Unpublish")}</button>
              </div>
            </>
          )}
          {publishError && (
            <div className="tayar-v2-publish-error">{publishError}</div>
          )}
          {cloudError && (
            <div className="tayar-v2-publish-error">{cloudError}</div>
          )}
          {!publishedUrl && (
            <button type="button" className="tayar-v2-manual-action" disabled={publishBusy || Boolean(publishBlocker)} onClick={() => void publishWebsite()} title={publishBlocker || l('Publish website')}>
              {publishBusy ? l('Publishing…') : publishBlocker ? l('Resolve publish blockers first') : l('Publish website')}
            </button>
          )}
        </div>
      </details>

      <details className="tayar-v2-manual-section">
        <summary>{l('SEO')}</summary>
        <div className="tayar-v2-manual-fields">
          <label><span>{l("Site title")}</span><input value={seo.title} onChange={(e) => { setSeo((current) => ({ ...current, title: e.target.value })); setSaved(false); }} /></label>
          <label><span>{l("Description")}</span><textarea rows={4} value={seo.description} onChange={(e) => { setSeo((current) => ({ ...current, description: e.target.value })); setSaved(false); }} /></label>
          <label><span>{l("Keywords")}</span><textarea rows={3} value={seo.keywords.join(', ')} onChange={(e) => { setSeo((current) => ({ ...current, keywords: e.target.value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 40) })); setSaved(false); }} /></label>
          <div className="tayar-v2-manual-note">Audit: {siteAudit.score}/100 · {siteAudit.errors.length} critical · {siteAudit.warnings.length} warnings</div>
        </div>
      </details>

      <details className="tayar-v2-manual-section">
        <summary>{l("Analytics & verification")}</summary>
        <div className="tayar-v2-manual-fields">
          <label><span>Google Analytics 4</span><input value={productionConfig.ga4Id} disabled={!billingEntitlements.features.productionIntegrations} placeholder="G-XXXX" onChange={(e) => { if (!requireBillingFeature('productionIntegrations', 'Production tracking integrations')) return; setProductionConfig((current) => ({ ...current, ga4Id: e.target.value })); setSaved(false); }} /></label>
          <label><span>Google Tag Manager</span><input value={productionConfig.gtmId} disabled={!billingEntitlements.features.productionIntegrations} placeholder="GTM-XXXX" onChange={(e) => { if (!requireBillingFeature('productionIntegrations', 'Production tracking integrations')) return; setProductionConfig((current) => ({ ...current, gtmId: e.target.value })); setSaved(false); }} /></label>
          <label><span>Meta Pixel</span><input value={productionConfig.metaPixelId} disabled={!billingEntitlements.features.productionIntegrations} onChange={(e) => { if (!requireBillingFeature('productionIntegrations', 'Production tracking integrations')) return; setProductionConfig((current) => ({ ...current, metaPixelId: e.target.value })); setSaved(false); }} /></label>
          <label><span>{l("Plausible domain")}</span><input value={productionConfig.plausibleDomain} disabled={!billingEntitlements.features.productionIntegrations} onChange={(e) => { if (!requireBillingFeature('productionIntegrations', 'Production tracking integrations')) return; setProductionConfig((current) => ({ ...current, plausibleDomain: e.target.value })); setSaved(false); }} /></label>
          <label><span>{l("Google verification")}</span><input value={productionConfig.googleVerification} onChange={(e) => { setProductionConfig((current) => ({ ...current, googleVerification: e.target.value })); setSaved(false); }} /></label>
          <label><span>{l("Bing verification")}</span><input value={productionConfig.bingVerification} onChange={(e) => { setProductionConfig((current) => ({ ...current, bingVerification: e.target.value })); setSaved(false); }} /></label>
        </div>
      </details>

      <details className="tayar-v2-manual-section">
        <summary>{l("Structured data")}</summary>
        <div className="tayar-v2-manual-fields">
          <label className="tayar-v2-manual-toggle"><span>{l("Organization schema")}</span><input type="checkbox" checked={productionConfig.organizationSchema} onChange={(e) => { setProductionConfig((current) => ({ ...current, organizationSchema: e.target.checked })); setSaved(false); }} /></label>
          <label className="tayar-v2-manual-toggle"><span>{l("Local business schema")}</span><input type="checkbox" checked={productionConfig.localBusinessSchema} onChange={(e) => { setProductionConfig((current) => ({ ...current, localBusinessSchema: e.target.checked })); setSaved(false); }} /></label>
          <label><span>{l("Organization name")}</span><input value={productionConfig.organizationName} onChange={(e) => { setProductionConfig((current) => ({ ...current, organizationName: e.target.value })); setSaved(false); }} /></label>
          <label><span>{l("Organization URL")}</span><input value={productionConfig.organizationUrl} onChange={(e) => { setProductionConfig((current) => ({ ...current, organizationUrl: e.target.value })); setSaved(false); }} /></label>
          <label><span>{l("Organization logo")}</span><input value={productionConfig.organizationLogo} onChange={(e) => { setProductionConfig((current) => ({ ...current, organizationLogo: e.target.value })); setSaved(false); }} /></label>
          {productionConfig.localBusinessSchema && <>
            <label><span>{l("Business type")}</span><input value={productionConfig.localBusinessType} onChange={(e) => { setProductionConfig((current) => ({ ...current, localBusinessType: e.target.value })); setSaved(false); }} /></label>
            <label><span>{l("Phone")}</span><input value={productionConfig.localBusinessPhone} onChange={(e) => { setProductionConfig((current) => ({ ...current, localBusinessPhone: e.target.value })); setSaved(false); }} /></label>
            <label><span>{l("Address")}</span><input value={productionConfig.localBusinessAddress} onChange={(e) => { setProductionConfig((current) => ({ ...current, localBusinessAddress: e.target.value })); setSaved(false); }} /></label>
          </>}
        </div>
      </details>

      <details className="tayar-v2-manual-section">
        <summary>{l("Production")}</summary>
        <div className="tayar-v2-manual-fields">
          <label className="tayar-v2-manual-toggle"><span>{l("Maintenance mode")}</span><input type="checkbox" checked={productionConfig.maintenanceMode} onChange={(e) => { setProductionConfig((current) => ({ ...current, maintenanceMode: e.target.checked })); setSaved(false); }} /></label>
          {productionConfig.maintenanceMode && <>
            <label><span>{l("Maintenance title")}</span><input value={productionConfig.maintenanceTitle} onChange={(e) => { setProductionConfig((current) => ({ ...current, maintenanceTitle: e.target.value })); setSaved(false); }} /></label>
            <label><span>{l("Maintenance message")}</span><textarea rows={3} value={productionConfig.maintenanceText} onChange={(e) => { setProductionConfig((current) => ({ ...current, maintenanceText: e.target.value })); setSaved(false); }} /></label>
          </>}
          <label><span>{l("Global custom CSS")}</span><textarea rows={7} value={productionConfig.customCss} disabled={!billingEntitlements.features.customCss} onChange={(e) => { if (!requireBillingFeature('customCss', 'Global custom CSS')) return; setProductionConfig((current) => ({ ...current, customCss: e.target.value })); setSaved(false); }} /></label>
          <label><span>{l("Extra robots.txt rules")}</span><textarea rows={5} value={productionConfig.customRobotsRules} onChange={(e) => { setProductionConfig((current) => ({ ...current, customRobotsRules: e.target.value })); setSaved(false); }} /></label>
          <button type="button" className="tayar-v2-manual-action" onClick={() => setReleaseHistoryOpen(true)}>{l("Release history")}</button>
          <button type="button" className="tayar-v2-manual-action" onClick={() => setDeliveryOpen(true)}>{l("Client delivery")}</button>
        </div>
      </details>
    </div>
  );
}
