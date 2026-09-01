export interface WebsiteLeadLike {
  form_data?: Record<string, unknown> | null;
}

export function getWebsiteLeadPhone(lead: WebsiteLeadLike): string {
  const entry = Object.entries(lead.form_data || {}).find(([key, value]) =>
    (key.toLowerCase().includes('phone') || key.toLowerCase().includes('tel')) &&
    String(value || '').trim(),
  );

  return entry ? String(entry[1] || '').trim() : '';
}

export function getWebsiteLeadSource(lead: WebsiteLeadLike) {
  const data = lead.form_data || {};
  return {
    source: String(data._utm_source || '').trim(),
    medium: String(data._utm_medium || '').trim(),
    campaign: String(data._utm_campaign || '').trim(),
    referrer: String(data._referrer || '').trim(),
  };
}
