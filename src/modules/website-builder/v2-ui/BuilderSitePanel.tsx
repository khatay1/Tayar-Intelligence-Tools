import type * as React from 'react';
import type { Language } from '@/context/PreferencesContext';
import { PAGE_LANGUAGE_LABELS } from '../core/project-identifiers';
import { WEBSITE_DESIGN_SYSTEM_PRESETS, type WebsiteDesignSystemPreset, type WebsiteDesignSystemReport } from '../core/website-design-system';
import { FONT_OPTIONS, normalizeTheme } from '../core/website-builder-config';
import type { WebsiteCustomDomain } from '../services/websiteDomainService';
import type { WebsiteFooterConfig, WebsiteHeaderConfig, WebsiteSiteEnhancements, WebsiteTheme } from '../core/website-builder-model';
import type { WebsiteLocalizationConfig, WebsiteLocalizationIssue } from '../core/website-localization';
import type { EditorProjectAccess } from '../core/editor-project-access';

interface BuilderSitePanelProps {
  applyDesignSystemPreset: (preset: WebsiteDesignSystemPreset) => void;
  checkCustomDomain: () => Promise<void>;
  cloudProjectId: string | null;
  connectCustomDomain: () => Promise<void>;
  customDomain: WebsiteCustomDomain | null;
  customDomainBusy: boolean;
  customDomainDraft: string;
  customDomainError: string;
  designSystemReport: WebsiteDesignSystemReport;
  faviconUrl: string;
  footerConfig: WebsiteFooterConfig;
  headerConfig: WebsiteHeaderConfig;
  l: (text: string) => string;
  localization: WebsiteLocalizationConfig;
  localizationIssues: WebsiteLocalizationIssue[];
  projectTeamAccess: EditorProjectAccess;
  removeCustomDomain: () => Promise<void>;
  repairActiveDesignSystem: () => void;
  setCustomDomainDraft: React.Dispatch<React.SetStateAction<string>>;
  setFaviconUrl: React.Dispatch<React.SetStateAction<string>>;
  setFooterConfig: React.Dispatch<React.SetStateAction<WebsiteFooterConfig>>;
  setHeaderConfig: React.Dispatch<React.SetStateAction<WebsiteHeaderConfig>>;
  setLocalization: React.Dispatch<React.SetStateAction<WebsiteLocalizationConfig>>;
  setSaved: React.Dispatch<React.SetStateAction<boolean>>;
  setSiteEnhancements: React.Dispatch<React.SetStateAction<WebsiteSiteEnhancements>>;
  setSiteName: React.Dispatch<React.SetStateAction<string>>;
  setSiteUrl: React.Dispatch<React.SetStateAction<string>>;
  setTheme: React.Dispatch<React.SetStateAction<WebsiteTheme>>;
  siteEnhancements: WebsiteSiteEnhancements;
  siteName: string;
  siteUrl: string;
  theme: WebsiteTheme;
}

export function BuilderSitePanel({
  applyDesignSystemPreset,
  checkCustomDomain,
  cloudProjectId,
  connectCustomDomain,
  customDomain,
  customDomainBusy,
  customDomainDraft,
  customDomainError,
  designSystemReport,
  faviconUrl,
  footerConfig,
  headerConfig,
  l,
  localization,
  localizationIssues,
  projectTeamAccess,
  removeCustomDomain,
  repairActiveDesignSystem,
  setCustomDomainDraft,
  setFaviconUrl,
  setFooterConfig,
  setHeaderConfig,
  setLocalization,
  setSaved,
  setSiteEnhancements,
  setSiteName,
  setSiteUrl,
  setTheme,
  siteEnhancements,
  siteName,
  siteUrl,
  theme,
}: BuilderSitePanelProps) {
  return (
    <div className="tayar-v2-manual-panel">
      <div className="tayar-v2-panel-heading">
        <strong>{l("Site")}</strong>
      </div>

      <details open className="tayar-v2-manual-section">
        <summary>{l("Identity")}</summary>
        <div className="tayar-v2-manual-fields">
          <label>
            <span>{l("Site name")}</span>
            <input value={siteName} onChange={(e) => { setSiteName(e.target.value); setSaved(false); }} />
          </label>
          <label>
            <span>{l("Production URL")}</span>
            <input value={siteUrl} placeholder="https://example.com" onChange={(e) => { setSiteUrl(e.target.value); setSaved(false); }} />
          </label>
          <label>
            <span>{l("Favicon URL")}</span>
            <input value={faviconUrl} placeholder="https://..." onChange={(e) => { setFaviconUrl(e.target.value); setSaved(false); }} />
          </label>
        </div>
      </details>

      <details open className="tayar-v2-manual-section">
        <summary>{l("Localization")}</summary>
        <div className="tayar-v2-manual-fields tayar-v2-manual-fields--two">
          <label>
            <span>{l("Default language")}</span>
            <select value={localization.defaultLanguage} onChange={(e) => { setLocalization((current) => ({ ...current, defaultLanguage: e.target.value as Language })); setSaved(false); }}>
              <option value="en">{l(PAGE_LANGUAGE_LABELS.en)}</option>
              <option value="sv">{PAGE_LANGUAGE_LABELS.sv}</option>
              <option value="ar">{PAGE_LANGUAGE_LABELS.ar}</option>
            </select>
          </label>
          <label>
            <span>{l("Locale routes")}</span>
            <select value={localization.routeStrategy} onChange={(e) => { setLocalization((current) => ({ ...current, routeStrategy: e.target.value === 'flat' ? 'flat' : 'subdirectory' })); setSaved(false); }}>
              <option value="subdirectory">/sv/page.html</option>
              <option value="flat">/page.html</option>
            </select>
          </label>
        </div>
        {localizationIssues.length > 0 && <ul className="tayar-v2-manual-note">{localizationIssues.map((issue, index) => <li key={`${issue.code}-${index}`}>{l(issue.message)}</li>)}</ul>}
      </details>

      <details open className="tayar-v2-manual-section">
        <summary>{l("Custom domain")}</summary>
        <div className="tayar-v2-manual-fields">
          <label>
            <span>{l("Domain name")}</span>
            <input value={customDomainDraft} disabled={customDomainBusy || !cloudProjectId || !projectTeamAccess.canPublish} placeholder="www.example.com" onChange={(event) => setCustomDomainDraft(event.target.value.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))} />
          </label>
          {!cloudProjectId && <p className="tayar-v2-manual-note">{l('Save this project to the cloud before connecting a domain.')}</p>}
          {customDomain && (
            <p className="tayar-v2-manual-note">
              {l('Status')}: <strong>{l(customDomain.status)}</strong>
              {customDomain.status === 'verified' && <> · <a href={`https://${customDomain.hostname}`} target="_blank" rel="noreferrer">https://{customDomain.hostname}</a></>}
            </p>
          )}
          {customDomain?.status === 'verified' && <p className="tayar-v2-manual-note">{l('Publish again to update canonical URLs and activate the latest website on this domain.')}</p>}
          {!!customDomain?.verification?.length && (
            <div className="tayar-v2-manual-note">
              <strong>{l('DNS records required')}</strong>
              {customDomain.verification.map((record, index) => (
                <p key={`${record.type}-${index}`}><code>{record.type || 'TXT'} {record.domain || customDomain.hostname} {record.value || record.reason || ''}</code></p>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="tayar-v2-manual-action" disabled={customDomainBusy || !cloudProjectId || !customDomainDraft.trim() || !projectTeamAccess.canPublish} onClick={() => void connectCustomDomain()}>{customDomainBusy ? l('Working…') : customDomain ? l('Update domain') : l('Connect domain')}</button>
            {customDomain && <button type="button" className="tayar-v2-manual-action" disabled={customDomainBusy} onClick={() => void checkCustomDomain()}>{l('Check DNS')}</button>}
            {customDomain && <button type="button" className="tayar-v2-manual-action is-danger" disabled={customDomainBusy} onClick={() => void removeCustomDomain()}>{l('Disconnect')}</button>}
          </div>
          {customDomainError && <p className="tayar-v2-manual-note text-rose-400">{l(customDomainError)}</p>}
        </div>
      </details>

      <details open className="tayar-v2-manual-section">
        <summary>{l("Global theme")}</summary>
        <div className="tayar-v2-manual-note">
          <strong>{l('Design system score')}: {designSystemReport.score}/100</strong>
          <p>{designSystemReport.metrics.contrastFailures} {l('contrast issues')} · {designSystemReport.metrics.customColors} {l('off-token colors')} · {designSystemReport.metrics.fontSizes} {l('type sizes')}</p>
        </div>
        <div className="tayar-v2-manual-fields tayar-v2-manual-fields--two">
          <label><span>{l('System preset')}</span><select value="" onChange={(event) => { const preset = WEBSITE_DESIGN_SYSTEM_PRESETS.find((item) => item.id === event.target.value); if (preset) applyDesignSystemPreset(preset); }}><option value="">{l('Choose a system…')}</option>{WEBSITE_DESIGN_SYSTEM_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{l(preset.name)}</option>)}</select></label>
          <button type="button" className="tayar-v2-manual-action" disabled={!designSystemReport.issues.length} onClick={repairActiveDesignSystem}>{l('Auto-balance tokens')}</button>
        </div>
        <div className="tayar-v2-manual-fields tayar-v2-manual-fields--two">
          <label><span>{l("Primary")}</span><input type="color" value={theme.primaryColor} onChange={(e) => { setTheme((current) => ({ ...current, primaryColor: e.target.value })); setSaved(false); }} /></label>
          <label><span>{l("Secondary")}</span><input type="color" value={theme.secondaryColor} onChange={(e) => { setTheme((current) => ({ ...current, secondaryColor: e.target.value })); setSaved(false); }} /></label>
          <label><span>{l("Background")}</span><input type="color" value={theme.backgroundColor} onChange={(e) => { setTheme((current) => ({ ...current, backgroundColor: e.target.value })); setSaved(false); }} /></label>
          <label><span>{l("Text")}</span><input type="color" value={theme.textColor} onChange={(e) => { setTheme((current) => ({ ...current, textColor: e.target.value })); setSaved(false); }} /></label>
          <label><span>{l("Muted text")}</span><input type="color" value={theme.mutedTextColor} onChange={(e) => { setTheme((current) => ({ ...current, mutedTextColor: e.target.value })); setSaved(false); }} /></label>
          <label>
            <span>{l("Font")}</span>
            <select value={theme.fontFamily} onChange={(e) => { setTheme((current) => ({ ...current, fontFamily: e.target.value })); setSaved(false); }}>
              {FONT_OPTIONS.map((font) => <option key={font} value={font}>{font}</option>)}
            </select>
          </label>
          <label><span>{l("Content width")}</span><input type="number" min="720" max="1440" step="20" value={theme.contentWidth} onChange={(e) => { setTheme((current) => normalizeTheme({ ...current, contentWidth: Number(e.target.value) })); setSaved(false); }} /></label>
          <label><span>{l("Section spacing")}</span><input type="number" min="0" max="240" value={theme.sectionSpacing} onChange={(e) => { setTheme((current) => normalizeTheme({ ...current, sectionSpacing: Number(e.target.value) })); setSaved(false); }} /></label>
          <label><span>{l("Button radius")}</span><input type="number" min="0" max="80" value={theme.buttonRadius} onChange={(e) => { setTheme((current) => normalizeTheme({ ...current, buttonRadius: Number(e.target.value) })); setSaved(false); }} /></label>
        </div>
      </details>

      <details className="tayar-v2-manual-section">
        <summary>{l("Header")}</summary>
        <div className="tayar-v2-manual-fields">
          <label className="tayar-v2-manual-toggle"><span>{l("Enable header")}</span><input type="checkbox" checked={headerConfig.enabled} onChange={(e) => { setHeaderConfig((current) => ({ ...current, enabled: e.target.checked })); setSaved(false); }} /></label>
          <label className="tayar-v2-manual-toggle"><span>{l("Sticky")}</span><input type="checkbox" checked={headerConfig.sticky} onChange={(e) => { setHeaderConfig((current) => ({ ...current, sticky: e.target.checked })); setSaved(false); }} /></label>
          <label className="tayar-v2-manual-toggle"><span>{l("Mobile menu")}</span><input type="checkbox" checked={headerConfig.mobileMenu} onChange={(e) => { setHeaderConfig((current) => ({ ...current, mobileMenu: e.target.checked })); setSaved(false); }} /></label>
          <label className="tayar-v2-manual-toggle"><span>{l("Language switcher")}</span><input type="checkbox" checked={headerConfig.languageSwitcher} onChange={(e) => { setHeaderConfig((current) => ({ ...current, languageSwitcher: e.target.checked })); setSaved(false); }} /></label>
          <label><span>{l("Brand text")}</span><input value={headerConfig.brandText} onChange={(e) => { setHeaderConfig((current) => ({ ...current, brandText: e.target.value })); setSaved(false); }} /></label>
          <label><span>{l("Logo URL")}</span><input value={headerConfig.logoUrl} placeholder="https://..." onChange={(e) => { setHeaderConfig((current) => ({ ...current, logoUrl: e.target.value })); setSaved(false); }} /></label>
          <label className="tayar-v2-manual-toggle"><span>{l("Show CTA")}</span><input type="checkbox" checked={headerConfig.showCta} onChange={(e) => { setHeaderConfig((current) => ({ ...current, showCta: e.target.checked })); setSaved(false); }} /></label>
          <label><span>{l("CTA label")}</span><input value={headerConfig.ctaLabel} onChange={(e) => { setHeaderConfig((current) => ({ ...current, ctaLabel: e.target.value })); setSaved(false); }} /></label>
          <label><span>{l("CTA link")}</span><input value={headerConfig.ctaHref} onChange={(e) => { setHeaderConfig((current) => ({ ...current, ctaHref: e.target.value })); setSaved(false); }} /></label>
          <div className="tayar-v2-manual-fields tayar-v2-manual-fields--two">
            <label><span>{l("Background")}</span><input type="color" value={headerConfig.backgroundColor} onChange={(e) => { setHeaderConfig((current) => ({ ...current, backgroundColor: e.target.value })); setSaved(false); }} /></label>
            <label><span>{l("Text")}</span><input type="color" value={headerConfig.textColor} onChange={(e) => { setHeaderConfig((current) => ({ ...current, textColor: e.target.value })); setSaved(false); }} /></label>
            <label><span>{l("Active")}</span><input type="color" value={headerConfig.activeColor} onChange={(e) => { setHeaderConfig((current) => ({ ...current, activeColor: e.target.value })); setSaved(false); }} /></label>
            <label><span>{l("Hover")}</span><input type="color" value={headerConfig.hoverColor} onChange={(e) => { setHeaderConfig((current) => ({ ...current, hoverColor: e.target.value })); setSaved(false); }} /></label>
            <label><span>{l("CTA background")}</span><input type="color" value={headerConfig.ctaBackgroundColor} onChange={(e) => { setHeaderConfig((current) => ({ ...current, ctaBackgroundColor: e.target.value })); setSaved(false); }} /></label>
            <label><span>{l("CTA text")}</span><input type="color" value={headerConfig.ctaTextColor} onChange={(e) => { setHeaderConfig((current) => ({ ...current, ctaTextColor: e.target.value })); setSaved(false); }} /></label>
            <label><span>{l("Nav gap")}</span><input type="number" min="0" max="80" value={headerConfig.navGap} onChange={(e) => { setHeaderConfig((current) => ({ ...current, navGap: Number(e.target.value) })); setSaved(false); }} /></label>
            <label><span>{l("Brand size")}</span><input type="number" min="10" max="60" value={headerConfig.brandSize} onChange={(e) => { setHeaderConfig((current) => ({ ...current, brandSize: Number(e.target.value) })); setSaved(false); }} /></label>
            <label><span>{l("Nav size")}</span><input type="number" min="8" max="40" value={headerConfig.navSize} onChange={(e) => { setHeaderConfig((current) => ({ ...current, navSize: Number(e.target.value) })); setSaved(false); }} /></label>
          </div>
        </div>
      </details>

      <details className="tayar-v2-manual-section">
        <summary>{l("Footer")}</summary>
        <div className="tayar-v2-manual-fields">
          <label className="tayar-v2-manual-toggle"><span>{l("Enable footer")}</span><input type="checkbox" checked={footerConfig.enabled} onChange={(e) => { setFooterConfig((current) => ({ ...current, enabled: e.target.checked })); setSaved(false); }} /></label>
          <label className="tayar-v2-manual-toggle"><span>{l("Show navigation")}</span><input type="checkbox" checked={footerConfig.showNavigation} onChange={(e) => { setFooterConfig((current) => ({ ...current, showNavigation: e.target.checked })); setSaved(false); }} /></label>
          <label><span>{l("Footer text")}</span><textarea rows={3} value={footerConfig.text} onChange={(e) => { setFooterConfig((current) => ({ ...current, text: e.target.value })); setSaved(false); }} /></label>
          <label><span>Instagram</span><input value={footerConfig.instagramUrl} onChange={(e) => { setFooterConfig((current) => ({ ...current, instagramUrl: e.target.value })); setSaved(false); }} /></label>
          <label><span>Facebook</span><input value={footerConfig.facebookUrl} onChange={(e) => { setFooterConfig((current) => ({ ...current, facebookUrl: e.target.value })); setSaved(false); }} /></label>
          <label><span>LinkedIn</span><input value={footerConfig.linkedinUrl} onChange={(e) => { setFooterConfig((current) => ({ ...current, linkedinUrl: e.target.value })); setSaved(false); }} /></label>
          <label><span>X</span><input value={footerConfig.xUrl} onChange={(e) => { setFooterConfig((current) => ({ ...current, xUrl: e.target.value })); setSaved(false); }} /></label>
        </div>
      </details>

      <details className="tayar-v2-manual-section">
        <summary>{l("Site features")}</summary>
        <div className="tayar-v2-manual-fields">
          {([
            ['cookieBanner', 'Cookie banner'],
            ['scrollProgress', 'Scroll progress'],
            ['backToTop', 'Back to top'],
            ['announcementBar', 'Announcement bar'],
            ['popupEnabled', 'Popup'],
            ['siteSearch', 'Site search'],
            ['galleryLightbox', 'Gallery lightbox'],
            ['floatingCta', 'Floating CTA'],
            ['shareButtons', 'Share buttons'],
          ] as const).map(([key, label]) => (
            <label key={key} className="tayar-v2-manual-toggle">
              <span>{l(label)}</span>
              <input type="checkbox" checked={siteEnhancements[key]} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, [key]: e.target.checked })); setSaved(false); }} />
            </label>
          ))}
          {siteEnhancements.announcementBar && <>
            <label><span>{l("Announcement")}</span><input value={siteEnhancements.announcementText} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, announcementText: e.target.value })); setSaved(false); }} /></label>
            <label><span>{l("Announcement link")}</span><input value={siteEnhancements.announcementHref} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, announcementHref: e.target.value })); setSaved(false); }} /></label>
          </>}
          {siteEnhancements.floatingCta && <>
            <label><span>{l("Floating CTA label")}</span><input value={siteEnhancements.floatingCtaLabel} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, floatingCtaLabel: e.target.value })); setSaved(false); }} /></label>
            <label><span>{l("Floating CTA link")}</span><input value={siteEnhancements.floatingCtaHref} onChange={(e) => { setSiteEnhancements((current) => ({ ...current, floatingCtaHref: e.target.value })); setSaved(false); }} /></label>
          </>}
        </div>
      </details>
    </div>
  );
}
