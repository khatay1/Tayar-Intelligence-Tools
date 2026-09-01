export interface WebsiteAnalyticsEventLike {
  page_path?: string | null;
  referrer?: string | null;
  session_id: string;
  event_type?: 'page_view' | 'cta_click' | 'form_submit';
  created_at: string;
}

export function summarizeWebsiteAnalytics(
  events: WebsiteAnalyticsEventLike[],
  now = Date.now(),
) {
  const pageViews = events.filter(
    (event) => !event.event_type || event.event_type === 'page_view',
  );
  const conversions = events.filter(
    (event) =>
      event.event_type === 'cta_click' ||
      event.event_type === 'form_submit',
  );
  const formSubmits = events.filter(
    (event) => event.event_type === 'form_submit',
  ).length;
  const ctaClicks = events.filter(
    (event) => event.event_type === 'cta_click',
  ).length;
  const sessions = new Set(pageViews.map((event) => event.session_id)).size;

  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const today = new Date(now);
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  const last7Days = pageViews.filter(
    (event) => new Date(event.created_at).getTime() >= sevenDaysAgo,
  ).length;

  const todayViews = pageViews.filter((event) => {
    const date = new Date(event.created_at);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` === todayKey;
  }).length;

  const pageCounts = new Map<string, number>();
  const referrerCounts = new Map<string, number>();

  pageViews.forEach((event) => {
    const page = event.page_path || '/';
    pageCounts.set(page, (pageCounts.get(page) || 0) + 1);

    let source = 'Direct';
    if (event.referrer) {
      try {
        source = new URL(event.referrer).hostname.replace(/^www\./, '') || 'Direct';
      } catch {
        source = event.referrer.slice(0, 80);
      }
    }
    referrerCounts.set(source, (referrerCounts.get(source) || 0) + 1);
  });

  return {
    views: pageViews.length,
    sessions,
    last7Days,
    todayViews,
    conversions: conversions.length,
    ctaClicks,
    formSubmits,
    conversionRate: sessions
      ? Math.round((formSubmits / sessions) * 1000) / 10
      : 0,
    topPages: [...pageCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    topReferrers: [...referrerCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
  };
}
