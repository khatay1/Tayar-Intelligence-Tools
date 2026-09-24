import type { Dispatch, SetStateAction } from 'react';
import { normalizeSlug } from './project-identifiers';
import { sanitizeRobotsRules } from './website-builder-config';
import { buildWebsiteAnalyticsCsv, buildWebsiteLeadsCsv, buildWebsiteProjectBackupText } from './website-builder-export-data';
import { buildAuditReportText } from './website-builder-reports';
import { createZipBlob, downloadTextFile, escapeHtml, normalizeSiteUrl } from './website-builder-rendering';
import { websitePathUrl } from './website-localization';
import type { BillingFeature, WebsiteAnalyticsEvent, WebsiteLead, WebsitePage, WebsiteProductionConfig } from './website-builder-model';
import type { WebsiteSection } from './types';

interface EditorExportContext {
  siteName: string;
  siteUrl: string;
  siteAudit: Parameters<typeof buildAuditReportText>[0]['siteAudit'];
  pages: WebsitePage[];
  networkOnline: boolean;
  cloudSyncFailed: boolean;
  qualityDiagnostics: Parameters<typeof buildAuditReportText>[0]['qualityDiagnostics'];
  leads: WebsiteLead[];
  analyticsEvents: WebsiteAnalyticsEvent[];
  publishedUrl: string;
  productionConfig: WebsiteProductionConfig;
  buildProjectData: () => unknown;
  getCurrentPages: () => WebsitePage[];
  getOutputPages: () => WebsitePage[];
  getOutputFilename: (page: WebsitePage) => string;
  getHtml: (sections?: WebsiteSection[], pageId?: string, productionUrlOverride?: string, homeUsesIndexFile?: boolean, trackAnalytics?: boolean) => string;
  get404Html: (productionUrlOverride?: string, homeUsesIndexFile?: boolean, trackAnalytics?: boolean) => string;
  requireBillingFeature: (feature: BillingFeature, label: string) => boolean;
  setCopied: Dispatch<SetStateAction<boolean>>;
  l: (text: string) => string;
}

export function createEditorExportHandlers({
  siteName, siteUrl, siteAudit, pages, networkOnline, cloudSyncFailed, qualityDiagnostics,
  leads, analyticsEvents, publishedUrl, productionConfig, buildProjectData, getCurrentPages,
  getOutputPages, getOutputFilename, getHtml, get404Html, requireBillingFeature, setCopied, l,
}: EditorExportContext) {
  function exportProjectBackup() {
    downloadTextFile(
      `${normalizeSlug(siteName || 'website')}-backup.json`,
      buildWebsiteProjectBackupText(buildProjectData()),
      'application/json;charset=utf-8',
    );
  }

  function exportLeadsCsv() {
    downloadTextFile(
      `${normalizeSlug(siteName || 'website')}-leads.csv`,
      buildWebsiteLeadsCsv(leads),
      'text/csv;charset=utf-8',
    );
  }

  function exportAnalyticsCsv() {
    downloadTextFile(
      `${normalizeSlug(siteName || 'website')}-analytics.csv`,
      buildWebsiteAnalyticsCsv(analyticsEvents),
      'text/csv;charset=utf-8',
    );
  }

  function exportAuditReport() {
    const content = buildAuditReportText({
      siteName,
      siteAudit,
      pageCount: pages.length,
      networkOnline,
      cloudSyncFailed,
      qualityDiagnostics,
    });
    downloadTextFile(`${normalizeSlug(siteName || 'website')}-audit.txt`, content);
  }

  async function copyProjectSummary() {
    const currentPages = getCurrentPages();
    const sectionCount = currentPages.reduce((sum, page) => sum + page.sections.length, 0);
    const elementCount = currentPages.reduce((sum, page) => sum + page.sections.reduce((s, section) => s + (section.elements?.length || 0), 0), 0);
    const summary = [
      `Site: ${siteName}`,
      `Pages: ${currentPages.length}`,
      `Sections: ${sectionCount}`,
      `Elements: ${elementCount}`,
      `Audit: ${siteAudit.score}/100`,
      `Leads loaded: ${leads.length}`,
      `Analytics events loaded: ${analyticsEvents.length}`,
      `Published: ${publishedUrl || 'No'}`,
    ].join('\n');
    try { await navigator.clipboard.writeText(summary); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { /* Clipboard access is optional. */ }
  }

  function previewWebsite() {
    const blob = new Blob([getHtml()], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function downloadProductionZip() {
    if (!requireBillingFeature('exportZip', 'Production ZIP export')) return;
    const productionUrl = normalizeSiteUrl(siteUrl);
    if (!productionUrl) {
      window.alert(l('Add your production URL first, for example https://example.com. It is required for canonical URLs and sitemap.xml.'));
      return;
    }

    const currentPages = getOutputPages();
    const files: Array<{ name: string; content: string }> = currentPages.map((page) => {
      const filename = getOutputFilename(page);
      return { name: filename, content: getHtml(page.sections, page.id, undefined, false, true) };
    });

    const sitemapEntries = currentPages.filter((page) => page.noIndex !== true).map((page) => {
      const location = websitePathUrl(productionUrl, getOutputFilename(page), false);
      return `  <url><loc>${escapeHtml(location)}</loc></url>`;
    }).join('\n');
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>`;
    const customRobotsRules = sanitizeRobotsRules(productionConfig.customRobotsRules);
    const robots = `User-agent: *\nAllow: /\n${customRobotsRules ? `\n${customRobotsRules}\n` : '\n'}Sitemap: ${productionUrl}/sitemap.xml\n`;
    const readme = `Tayar Website Builder production export\n\nSite: ${siteName}\nProduction URL: ${productionUrl}\nPages: ${currentPages.length}\n\nUpload all files in this ZIP to the root of your static hosting provider.`;

    files.push(
      { name: '404.html', content: get404Html(undefined, false, true) },
      { name: 'sitemap.xml', content: sitemap },
      { name: 'robots.txt', content: robots },
      { name: 'README.txt', content: readme },
    );

    const blob = createZipBlob(files);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${normalizeSlug(siteName || 'website')}-production.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyHtml() {
    try {
      await navigator.clipboard.writeText(getHtml());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert(l('Could not copy HTML. Please use Download Website instead.'));
    }
  }

  return { exportProjectBackup, exportLeadsCsv, exportAnalyticsCsv, exportAuditReport, copyProjectSummary, previewWebsite, downloadProductionZip, copyHtml };
}
