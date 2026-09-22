import type { WebsiteFormAutomation, WebsiteFormCondition, WebsiteFormField, WebsiteSection } from './types';
import type { WebsitePage } from './website-builder-model';

export const WEBSITE_FORM_MAX_FIELDS = 45;
export const WEBSITE_FORM_MAX_FILE_BYTES = 10 * 1024 * 1024;

const FIELD_TYPES = new Set(['text', 'email', 'tel', 'url', 'number', 'date', 'textarea', 'select', 'radio', 'checkbox', 'file']);
const OPERATORS = new Set(['equals', 'not-equals', 'contains', 'not-empty', 'empty']);

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function normalizeWebsiteFormCondition(value: unknown): WebsiteFormCondition | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<WebsiteFormCondition>;
  const fieldName = cleanText(source.fieldName, 80).replace(/[^a-z0-9_-]/gi, '_');
  if (!fieldName || !OPERATORS.has(String(source.operator))) return null;
  return { fieldName, operator: source.operator!, value: cleanText(source.value, 300) };
}

export function normalizeWebsiteFormField(field: WebsiteFormField, index = 0): WebsiteFormField {
  const type = FIELD_TYPES.has(field.type) ? field.type : 'text';
  const number = (value: unknown, min: number, max: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : undefined;
  };
  const validation = field.validation || {};
  return {
    id: cleanText(field.id, 120) || `field-${index + 1}`,
    name: cleanText(field.name, 80).toLowerCase().replace(/[^a-z0-9_]+/g, '_') || `field_${index + 1}`,
    label: cleanText(field.label, 160) || `Field ${index + 1}`,
    type,
    placeholder: cleanText(field.placeholder, 300),
    required: field.required === true,
    options: ['select', 'radio'].includes(type) ? (field.options || []).map((item) => cleanText(item, 160)).filter(Boolean).slice(0, 50) : undefined,
    helpText: cleanText(field.helpText, 500),
    width: field.width === 'half' ? 'half' : 'full',
    validation: {
      minLength: number(validation.minLength, 0, 10_000),
      maxLength: number(validation.maxLength, 1, 10_000),
      min: number(validation.min, -1_000_000_000, 1_000_000_000),
      max: number(validation.max, -1_000_000_000, 1_000_000_000),
      pattern: cleanText(validation.pattern, 500),
      accept: type === 'file' ? (validation.accept || []).map((item) => cleanText(item, 100)).filter(Boolean).slice(0, 20) : undefined,
      maxFileSizeMb: type === 'file' ? number(validation.maxFileSizeMb, 1, 10) || 5 : undefined,
    },
    conditions: (field.conditions || []).map(normalizeWebsiteFormCondition).filter((item): item is WebsiteFormCondition => Boolean(item)).slice(0, 5),
  };
}

export function normalizeWebsiteFormAutomation(value: unknown, index = 0): WebsiteFormAutomation | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<WebsiteFormAutomation>;
  if (source.action !== 'email' && source.action !== 'webhook') return null;
  const destination = cleanText(source.destination, 1000);
  if (source.action === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) return null;
  if (source.action === 'webhook' && !/^https:\/\//i.test(destination)) return null;
  return {
    id: cleanText(source.id, 120) || `automation-${index + 1}`,
    name: cleanText(source.name, 120) || (source.action === 'email' ? 'Email notification' : 'Webhook'),
    enabled: source.enabled !== false,
    trigger: 'submission-created',
    action: source.action,
    destination,
  };
}

export function websiteFormDefinition(section: WebsiteSection, page: WebsitePage) {
  const fields = (section.formFields || []).map(normalizeWebsiteFormField).slice(0, WEBSITE_FORM_MAX_FIELDS);
  return {
    id: section.id,
    name: cleanText(section.formName, 120) || cleanText(section.title, 120) || 'Contact form',
    pageId: page.id,
    pagePath: page.outputPath || page.slug,
    fields,
    spamProtection: section.formSpamProtection === 'enhanced' ? 'enhanced' : 'standard',
    minimumCompletionSeconds: Math.min(60, Math.max(1, Number(section.formMinimumCompletionSeconds) || 3)),
    automations: (section.formAutomations || []).map(normalizeWebsiteFormAutomation).filter((item): item is WebsiteFormAutomation => Boolean(item)).slice(0, 10),
  };
}

export function collectWebsiteFormDefinitions(pages: WebsitePage[]) {
  return pages.flatMap((page) => page.sections.filter((section) => section.type === 'contact').map((section) => websiteFormDefinition(section, page)));
}

export function conditionMatches(condition: WebsiteFormCondition, values: Record<string, unknown>): boolean {
  const actual = String(values[condition.fieldName] ?? '');
  const expected = condition.value || '';
  if (condition.operator === 'equals') return actual === expected;
  if (condition.operator === 'not-equals') return actual !== expected;
  if (condition.operator === 'contains') return actual.toLowerCase().includes(expected.toLowerCase());
  if (condition.operator === 'not-empty') return actual.trim().length > 0;
  return actual.trim().length === 0;
}

export function fieldIsVisible(field: WebsiteFormField, values: Record<string, unknown>): boolean {
  return !(field.conditions || []).length || field.conditions!.every((condition) => conditionMatches(condition, values));
}
