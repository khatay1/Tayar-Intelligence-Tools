import { getWebsiteLeadPhone, getWebsiteLeadSource } from './website-lead-utils';
import { buildCsv } from './website-builder-rendering';
import type { WebsiteAnalyticsEvent, WebsiteLead } from './website-builder-model';

export function buildWebsiteProjectBackupText(project: unknown): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    app: 'Tayar Website Builder',
    project,
  }, null, 2);
}

export function buildWebsiteLeadsCsv(leads: WebsiteLead[]): string {
  const rows: unknown[][] = [[
    'id', 'status', 'stage', 'priority', 'tags', 'notes', 'created_at', 'updated_at',
    'name', 'email', 'phone', 'message', 'page_path', 'utm_source', 'utm_medium',
    'utm_campaign', 'referrer', 'form_data',
  ]];
  leads.forEach((lead) => {
    const meta = getWebsiteLeadSource(lead);
    rows.push([
      lead.id, lead.status, lead.stage || 'new', Number(lead.priority || 0),
      (lead.tags || []).join('|'), lead.notes || '', lead.created_at, lead.updated_at || '',
      lead.name, lead.email, getWebsiteLeadPhone(lead), lead.message,
      lead.page_path || '', meta.source, meta.medium, meta.campaign, meta.referrer, lead.form_data || {},
    ]);
  });
  return `\uFEFF${buildCsv(rows)}`;
}

export function buildWebsiteAnalyticsCsv(events: WebsiteAnalyticsEvent[]): string {
  const rows: unknown[][] = [[
    'created_at', 'event_type', 'page_path', 'referrer', 'session_id', 'event_data',
  ]];
  events.forEach((event) => {
    rows.push([
      event.created_at, event.event_type || 'page_view', event.page_path, event.referrer || '',
      event.session_id, event.event_data ? JSON.stringify(event.event_data) : '',
    ]);
  });
  return `\uFEFF${buildCsv(rows)}`;
}
