import type { Language } from '@/context/PreferencesContext';
import type { WebsiteDeliveryConfig } from '../core/delivery-config';
import { normalizeSlug } from '../core/project-identifiers';
import type { WebsiteBrand,WebsiteSection,WebsiteSEO } from '../core/types';
import { sanitizeRobotsRules } from '../core/website-builder-config';
import type { BillingFeature,ProjectHistoryEntry,WebsiteAnalyticsEvent,WebsiteFooterConfig,WebsiteHeaderConfig,WebsiteLead,WebsitePage,WebsiteProductionConfig,WebsitePublishVersion,WebsiteSiteEnhancements,WebsiteSymbol,WebsiteTheme } from '../core/website-builder-model';
import { buildCsv,crc32,createZipBlob,escapeHtml,normalizeSiteUrl } from '../core/website-builder-rendering';
import type { WebsiteCmsState } from '../core/website-cms';
import { getWebsiteLeadPhone,getWebsiteLeadSource } from '../core/website-lead-utils';
import type { WebsiteLocalizationConfig } from '../core/website-localization';
import { websitePathUrl } from '../core/website-localization';

interface createClientHandoffHandlerDependencies {
  launchReadiness: { score: number };
  analyticsEvents: WebsiteAnalyticsEvent[];
  buildDeliveryReport: () => string;
  buildProjectData: (historyEntries?: ProjectHistoryEntry[]) => { history: ProjectHistoryEntry[]; version: number; cloudProjectId: string | null; siteName: string; siteUrl: string; faviconUrl: string; publishedUrl: string; publishedAt: string | null; previewUrl: string; previewToken: string; previewCreatedAt: string | null; previewFingerprint: string; lastPublishedVersionId: string | null; lastPublishedFingerprint: string; activePageId: string; homePageId: string; pages: WebsitePage[]; cms: WebsiteCmsState; localization: WebsiteLocalizationConfig; brand: WebsiteBrand; theme: WebsiteTheme; headerConfig: WebsiteHeaderConfig; footerConfig: WebsiteFooterConfig; siteEnhancements: WebsiteSiteEnhancements; productionConfig: WebsiteProductionConfig; deliveryConfig: WebsiteDeliveryConfig; symbols: WebsiteSymbol[]; seo: WebsiteSEO; language: Language; updatedAt: string; };
  deliveryConfig: WebsiteDeliveryConfig;
  get404Html: (productionUrlOverride?: string, homeUsesIndexFile?: boolean, trackAnalytics?: boolean) => string;
  getHtml: (pageSections?: WebsiteSection[], pageId?: string, productionUrlOverride?: string, homeUsesIndexFile?: boolean, trackAnalytics?: boolean) => string;
  getOutputFilename: (page: WebsitePage) => string;
  getOutputPages: () => { outputPath: string; language: Language; id: string; name: string; slug: string; sections: WebsiteSection[]; showInNavigation: boolean; seoTitle?: string; seoDescription?: string; socialImage?: string; canonicalUrl?: string; translationKey?: string; noIndex?: boolean; cmsTemplate?: { collectionId: string; viewId?: string; routePattern?: string; }; }[];
  l: (text: string) => string;
  leads: WebsiteLead[];
  productionConfig: WebsiteProductionConfig;
  publishedUrl: string;
  publishVersions: WebsitePublishVersion[];
  requireBillingFeature: (feature: BillingFeature, label: string) => boolean;
  siteName: string;
  siteUrl: string;
}

export function createClientHandoffHandler({
  launchReadiness,
  analyticsEvents,
  buildDeliveryReport,
  buildProjectData,
  deliveryConfig,
  get404Html,
  getHtml,
  getOutputFilename,
  getOutputPages,
  l,
  leads,
  productionConfig,
  publishedUrl,
  publishVersions,
  requireBillingFeature,
  siteName,
  siteUrl,
}: createClientHandoffHandlerDependencies) {
  return function downloadClientHandoffZip() {
    if (!requireBillingFeature('clientDelivery', 'Client handoff ZIP')) return;
    const productionUrl = normalizeSiteUrl(siteUrl) || (publishedUrl ? publishedUrl.replace(/\/index\.html(?:[?#].*)?$/i, '') : '');
    if (!productionUrl) {
      window.alert(l('Add a Production URL or publish the website before creating the client handoff package.'));
      return;
    }

    const currentPages = getOutputPages();
    const files: Array<{ name: string; content: string }> = currentPages.map((page) => ({
      name: `site/${getOutputFilename(page)}`,
      content: getHtml(page.sections, page.id, productionUrl, false, true),
    }));
    const sitemapEntries = currentPages.filter((page) => page.noIndex !== true).map((page) => {
      const location = websitePathUrl(productionUrl, getOutputFilename(page), false);
      return `  <url><loc>${escapeHtml(location)}</loc></url>`;
    }).join('\n');
    const customRobotsRules = sanitizeRobotsRules(productionConfig.customRobotsRules);
    files.push(
      { name: 'site/404.html', content: get404Html(productionUrl, false, true) },
      { name: 'site/sitemap.xml', content: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>` },
      { name: 'site/robots.txt', content: `User-agent: *\nAllow: /\n${customRobotsRules ? `\n${customRobotsRules}\n` : '\n'}Sitemap: ${productionUrl}/sitemap.xml\n` },
    );

    const backupPayload = {
      exportedAt: new Date().toISOString(),
      app: deliveryConfig.whiteLabel ? 'Website Builder' : 'Tayar Website Builder',
      project: buildProjectData(),
    };
    files.push({ name: 'project/project-backup.json', content: JSON.stringify(backupPayload, null, 2) });
    files.push({ name: 'reports/delivery-report.txt', content: buildDeliveryReport() });

    const leadRows: unknown[][] = [[ 'id', 'status', 'stage', 'priority', 'tags', 'notes', 'created_at', 'name', 'email', 'phone', 'message', 'page_path', 'utm_source', 'utm_medium', 'utm_campaign', 'referrer' ]];
    leads.forEach((lead) => {
      const meta = getWebsiteLeadSource(lead);
      leadRows.push([lead.id, lead.status, lead.stage || 'new', Number(lead.priority || 0), (lead.tags || []).join('|'), lead.notes || '', lead.created_at, lead.name, lead.email, getWebsiteLeadPhone(lead), lead.message, lead.page_path || '', meta.source, meta.medium, meta.campaign, meta.referrer]);
    });
    files.push({ name: 'reports/leads.csv', content: `\uFEFF${buildCsv(leadRows)}` });

    const analyticsRows: unknown[][] = [[ 'created_at', 'event_type', 'page_path', 'referrer', 'session_id', 'event_data' ]];
    analyticsEvents.forEach((event) => analyticsRows.push([event.created_at, event.event_type || 'page_view', event.page_path, event.referrer || '', event.session_id, event.event_data || {}]));
    files.push({ name: 'reports/analytics.csv', content: `\uFEFF${buildCsv(analyticsRows)}` });
    files.push({ name: 'reports/releases.txt', content: publishVersions.length
      ? publishVersions.map((version, index) => `${index + 1}. ${version.created_at} | ${version.release_note || 'No release note'} | ${version.published_url}`).join('\n')
      : 'No release history loaded.' });

    const handoffTitle = deliveryConfig.whiteLabel ? 'CLIENT WEBSITE HANDOFF' : 'TAYAR WEBSITE BUILDER — CLIENT HANDOFF';
    files.push({ name: 'HANDOFF.txt', content: [
      handoffTitle,
      '',
      `Project: ${siteName}`,
      `Client: ${deliveryConfig.clientName || '—'}`,
      `Project code: ${deliveryConfig.projectCode || '—'}`,
      `Live URL: ${publishedUrl || productionUrl}`,
      `Launch readiness: ${launchReadiness.score}/100`,
      '',
      'Package contents:',
      '- site/ — production HTML, sitemap and robots.txt',
      '- project/project-backup.json — editable project backup',
      '- reports/delivery-report.txt — approval, readiness and audit',
      '- reports/leads.csv — currently loaded lead data',
      '- reports/analytics.csv — currently loaded analytics events',
      '- reports/releases.txt — currently loaded release history',
      '- MANIFEST.txt — file sizes and CRC32 checksums',
      '',
      deliveryConfig.handoffNotes || '',
    ].join('\n') });

    const encoder = new TextEncoder();
    const manifest = files.map((file) => {
      const bytes = encoder.encode(file.content);
      return `${file.name}\t${bytes.length} bytes\tCRC32 ${crc32(bytes).toString(16).padStart(8, '0')}`;
    });
    files.push({ name: 'MANIFEST.txt', content: [`Generated ${new Date().toISOString()}`, ...manifest].join('\n') });

    const blob = createZipBlob(files);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${normalizeSlug(siteName || 'website')}-client-handoff.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
}
