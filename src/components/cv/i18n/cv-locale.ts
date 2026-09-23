export type CVLocale = 'en' | 'sv' | 'ar';
export type CVTextDirection = 'ltr' | 'rtl';

export interface CVLocaleProfile {
  locale: CVLocale;
  direction: CVTextDirection;
  dateLocale: string;
  defaultDateStyle: 'short' | 'month-year';
}

const PROFILES: Record<CVLocale, CVLocaleProfile> = {
  en: { locale: 'en', direction: 'ltr', dateLocale: 'en-US', defaultDateStyle: 'month-year' },
  sv: { locale: 'sv', direction: 'ltr', dateLocale: 'sv-SE', defaultDateStyle: 'month-year' },
  ar: { locale: 'ar', direction: 'rtl', dateLocale: 'ar', defaultDateStyle: 'month-year' },
};

export function getCVLocaleProfile(locale: CVLocale): CVLocaleProfile {
  return PROFILES[locale];
}

export function formatCVDate(value: string, locale: CVLocale): string {
  if (!value) return '';
  const profile = getCVLocaleProfile(locale);
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Intl.DateTimeFormat(profile.dateLocale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function cvDirection(locale: CVLocale): CVTextDirection {
  return getCVLocaleProfile(locale).direction;
}
