import type { Language } from '@/context/PreferencesContext';
import { normalizePageLanguage, normalizeSlug } from './project-identifiers';
import type { WebsiteCmsBinding, WebsiteSection } from './types';
import type { WebsitePage } from './website-builder-model';

export type WebsiteCmsFieldType = 'text' | 'rich-text' | 'number' | 'boolean' | 'date' | 'image' | 'url' | 'reference';
export type WebsiteCmsValue = string | number | boolean;
export type WebsiteCmsFilterOperator = 'equals' | 'not-equals' | 'contains' | 'truthy';
export type WebsiteCmsLocalizedValues = Partial<Record<Language, Record<string, WebsiteCmsValue>>>;

export interface WebsiteCmsField {
  id: string;
  name: string;
  key: string;
  type: WebsiteCmsFieldType;
  required: boolean;
  referenceCollectionId?: string;
}

export interface WebsiteCmsEntry {
  id: string;
  values: Record<string, WebsiteCmsValue>;
  localizedValues?: WebsiteCmsLocalizedValues;
  draft: boolean;
  publishAt?: string;
  unpublishAt?: string;
}

export interface WebsiteCmsFilter {
  fieldKey: string;
  operator: WebsiteCmsFilterOperator;
  value?: WebsiteCmsValue;
}

export interface WebsiteCmsView {
  id: string;
  name: string;
  filters: WebsiteCmsFilter[];
  sortField?: string;
  sortDirection: 'asc' | 'desc';
  limit?: number;
}

export interface WebsiteCmsCollection {
  id: string;
  name: string;
  slug: string;
  slugField: string;
  fields: WebsiteCmsField[];
  entries: WebsiteCmsEntry[];
  views: WebsiteCmsView[];
}

export interface WebsiteCmsState {
  version: 2;
  collections: WebsiteCmsCollection[];
}

export interface WebsiteCmsIssue {
  severity: 'error' | 'warning';
  message: string;
  collectionId?: string;
  entryId?: string;
}

export const EMPTY_WEBSITE_CMS: WebsiteCmsState = { version: 2, collections: [] };
export const WEBSITE_CMS_LIMITS = { collections: 20, fields: 30, entries: 500, views: 20, filters: 8 } as const;
export const WEBSITE_CMS_LANGUAGES: Language[] = ['en', 'sv', 'ar'];

const FIELD_TYPES = new Set<WebsiteCmsFieldType>(['text', 'rich-text', 'number', 'boolean', 'date', 'image', 'url', 'reference']);
const FILTER_OPERATORS = new Set<WebsiteCmsFilterOperator>(['equals', 'not-equals', 'contains', 'truthy']);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanText(value: unknown, fallback = '', max = 240): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback;
}

function safeId(value: unknown, fallback: string): string {
  return cleanText(value, fallback, 120).replace(/[^a-zA-Z0-9_-]/g, '-') || fallback;
}

function fieldKey(value: unknown, fallback: string): string {
  return normalizeSlug(cleanText(value, fallback, 80)).replace(/-/g, '_') || fallback;
}

function normalizeValue(value: unknown, type: WebsiteCmsFieldType): WebsiteCmsValue {
  if (type === 'boolean') return value === true || value === 'true';
  if (type === 'number') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return typeof value === 'string' ? value.slice(0, type === 'rich-text' ? 20000 : 4000) : String(value ?? '');
}

function normalizeTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function normalizeLocalizedValues(source: unknown, fieldsByKey: Map<string, WebsiteCmsField>): WebsiteCmsLocalizedValues | undefined {
  const localizedSource = record(source);
  const localizedValues: WebsiteCmsLocalizedValues = {};
  for (const language of WEBSITE_CMS_LANGUAGES) {
    const rawValues = record(localizedSource[language]);
    const values: Record<string, WebsiteCmsValue> = {};
    fieldsByKey.forEach((field, key) => {
      if (key in rawValues) values[key] = normalizeValue(rawValues[key], field.type);
    });
    if (Object.keys(values).length) localizedValues[language] = values;
  }
  return Object.keys(localizedValues).length ? localizedValues : undefined;
}

export function normalizeWebsiteCms(input: unknown): WebsiteCmsState {
  const source = record(input);
  const rawCollections = Array.isArray(source.collections) ? source.collections : [];
  const collectionIds = new Set<string>();
  const collections = rawCollections.slice(0, WEBSITE_CMS_LIMITS.collections).map((candidate, collectionIndex) => {
    const item = record(candidate);
    let id = safeId(item.id, `collection-${collectionIndex + 1}`);
    while (collectionIds.has(id)) id = `${id}-${collectionIndex + 1}`;
    collectionIds.add(id);

    const rawFields = Array.isArray(item.fields) ? item.fields : [];
    const keys = new Set<string>();
    const fields = rawFields.slice(0, WEBSITE_CMS_LIMITS.fields).map((candidateField, fieldIndex) => {
      const sourceField = record(candidateField);
      let key = fieldKey(sourceField.key, `field_${fieldIndex + 1}`);
      while (keys.has(key)) key = `${key}_${fieldIndex + 1}`;
      keys.add(key);
      const type = FIELD_TYPES.has(sourceField.type as WebsiteCmsFieldType) ? sourceField.type as WebsiteCmsFieldType : 'text';
      return {
        id: safeId(sourceField.id, `${id}-field-${fieldIndex + 1}`),
        name: cleanText(sourceField.name, `Field ${fieldIndex + 1}`, 80),
        key,
        type,
        required: sourceField.required === true,
        referenceCollectionId: type === 'reference'
          ? safeId(sourceField.referenceCollectionId, '') || undefined
          : undefined,
      } satisfies WebsiteCmsField;
    });

    const effectiveFields = fields.length ? fields : [
      { id: `${id}-title`, name: 'Title', key: 'title', type: 'text' as const, required: true },
      { id: `${id}-slug`, name: 'Slug', key: 'slug', type: 'text' as const, required: true },
    ];
    const fieldsByKey = new Map(effectiveFields.map((field) => [field.key, field]));
    const rawEntries = Array.isArray(item.entries) ? item.entries : [];
    const entryIds = new Set<string>();
    const entries = rawEntries.slice(0, WEBSITE_CMS_LIMITS.entries).map((candidateEntry, entryIndex) => {
      const sourceEntry = record(candidateEntry);
      const sourceValues = record(sourceEntry.values);
      const values: Record<string, WebsiteCmsValue> = {};
      fieldsByKey.forEach((field, key) => {
        if (key in sourceValues) values[key] = normalizeValue(sourceValues[key], field.type);
      });
      let entryId = safeId(sourceEntry.id, `${id}-entry-${entryIndex + 1}`);
      while (entryIds.has(entryId)) entryId = `${entryId}-${entryIndex + 1}`;
      entryIds.add(entryId);
      return {
        id: entryId,
        values,
        localizedValues: normalizeLocalizedValues(sourceEntry.localizedValues, fieldsByKey),
        draft: sourceEntry.draft === true,
        publishAt: normalizeTimestamp(sourceEntry.publishAt),
        unpublishAt: normalizeTimestamp(sourceEntry.unpublishAt),
      } satisfies WebsiteCmsEntry;
    });

    const rawViews = Array.isArray(item.views) ? item.views : [];
    const viewIds = new Set<string>();
    const views = rawViews.slice(0, WEBSITE_CMS_LIMITS.views).map((candidateView, viewIndex) => {
      const sourceView = record(candidateView);
      let viewId = safeId(sourceView.id, `${id}-view-${viewIndex + 1}`);
      while (viewIds.has(viewId)) viewId = `${viewId}-${viewIndex + 1}`;
      viewIds.add(viewId);
      const rawFilters = Array.isArray(sourceView.filters) ? sourceView.filters : [];
      const filters = rawFilters.slice(0, WEBSITE_CMS_LIMITS.filters).map((candidateFilter) => {
        const sourceFilter = record(candidateFilter);
        const operator = FILTER_OPERATORS.has(sourceFilter.operator as WebsiteCmsFilterOperator)
          ? sourceFilter.operator as WebsiteCmsFilterOperator
          : 'equals';
        const filter: WebsiteCmsFilter = {
          fieldKey: fieldKey(sourceFilter.fieldKey, ''),
          operator,
        };
        if (typeof sourceFilter.value === 'string' || typeof sourceFilter.value === 'number' || typeof sourceFilter.value === 'boolean') filter.value = sourceFilter.value;
        return filter;
      }).filter((filter) => fieldsByKey.has(filter.fieldKey));
      const requestedSortField = fieldKey(sourceView.sortField, '');
      return {
        id: viewId,
        name: cleanText(sourceView.name, `View ${viewIndex + 1}`, 80),
        filters,
        sortField: fieldsByKey.has(requestedSortField) ? requestedSortField : undefined,
        sortDirection: sourceView.sortDirection === 'desc' ? 'desc' : 'asc',
        limit: Number.isFinite(Number(sourceView.limit)) ? Math.min(500, Math.max(1, Math.round(Number(sourceView.limit)))) : undefined,
      } satisfies WebsiteCmsView;
    });

    const slug = normalizeSlug(cleanText(item.slug, cleanText(item.name, `collection-${collectionIndex + 1}`)));
    const requestedSlugField = fieldKey(item.slugField, 'slug');
    return {
      id,
      name: cleanText(item.name, `Collection ${collectionIndex + 1}`, 80),
      slug,
      slugField: fieldsByKey.has(requestedSlugField) ? requestedSlugField : (fieldsByKey.has('slug') ? 'slug' : effectiveFields[0].key),
      fields: effectiveFields,
      entries,
      views,
    } satisfies WebsiteCmsCollection;
  });
  return { version: 2, collections };
}

export function createWebsiteCmsCollection(name: string, id = `collection-${Date.now()}`): WebsiteCmsCollection {
  const safe = safeId(id, `collection-${Date.now()}`);
  return normalizeWebsiteCms({ collections: [{ id: safe, name, slug: normalizeSlug(name), fields: [], entries: [] }] }).collections[0];
}

export function createWebsiteCmsEntry(collection: WebsiteCmsCollection, id = `${collection.id}-entry-${Date.now()}`): WebsiteCmsEntry {
  return { id: safeId(id, `${collection.id}-entry`), draft: true, values: Object.fromEntries(collection.fields.map((field) => [field.key, field.type === 'boolean' ? false : field.type === 'number' ? 0 : ''])) };
}

export function isWebsiteCmsEntryPublished(entry: WebsiteCmsEntry, now: Date | number | string = Date.now()): boolean {
  if (entry.draft) return false;
  const timestamp = now instanceof Date ? now.getTime() : typeof now === 'number' ? now : Date.parse(now);
  if (!Number.isFinite(timestamp)) return false;
  if (entry.publishAt && Date.parse(entry.publishAt) > timestamp) return false;
  if (entry.unpublishAt && Date.parse(entry.unpublishAt) <= timestamp) return false;
  return true;
}

function matchesWebsiteCmsFilter(value: WebsiteCmsValue | undefined, filter: WebsiteCmsFilter): boolean {
  if (filter.operator === 'truthy') return Boolean(value);
  const left = String(value ?? '').toLocaleLowerCase();
  const right = String(filter.value ?? '').toLocaleLowerCase();
  if (filter.operator === 'not-equals') return left !== right;
  if (filter.operator === 'contains') return left.includes(right);
  return left === right;
}

export function queryWebsiteCmsEntries(
  collection: WebsiteCmsCollection,
  viewId?: string,
  now: Date | number | string = Date.now(),
): WebsiteCmsEntry[] {
  const view = collection.views.find((candidate) => candidate.id === viewId);
  const entries = collection.entries
    .filter((entry) => isWebsiteCmsEntryPublished(entry, now))
    .filter((entry) => !view || view.filters.every((filter) => matchesWebsiteCmsFilter(entry.values[filter.fieldKey], filter)));
  if (view?.sortField) {
    const direction = view.sortDirection === 'desc' ? -1 : 1;
    entries.sort((left, right) => String(left.values[view.sortField!] ?? '').localeCompare(String(right.values[view.sortField!] ?? ''), undefined, { numeric: true }) * direction);
  }
  return view?.limit ? entries.slice(0, view.limit) : entries;
}

export function resolveWebsiteCmsEntryValue(
  entry: WebsiteCmsEntry,
  fieldKeyValue: string,
  language?: Language,
  defaultLanguage: Language = 'en',
): WebsiteCmsValue | undefined {
  if (language && language !== defaultLanguage) {
    const localized = entry.localizedValues?.[language]?.[fieldKeyValue];
    if (localized !== undefined && localized !== '') return localized;
  }
  return entry.values[fieldKeyValue];
}

export function resolveWebsiteCmsValue(
  cms: WebsiteCmsState,
  binding: WebsiteCmsBinding,
  contextEntryId?: string,
  language?: Language,
  defaultLanguage: Language = 'en',
): WebsiteCmsValue | undefined {
  const collection = cms.collections.find((item) => item.id === binding.collectionId);
  const entry = collection?.entries.find((item) => item.id === (binding.entryId || contextEntryId));
  if (!entry) return undefined;
  const value = resolveWebsiteCmsEntryValue(entry, binding.fieldKey, language, defaultLanguage);
  const field = collection?.fields.find((item) => item.key === binding.fieldKey);
  if (field?.type !== 'reference' || !binding.referenceFieldKey || typeof value !== 'string') return value;
  const targetCollection = cms.collections.find((item) => item.id === field.referenceCollectionId);
  const targetEntry = targetCollection?.entries.find((item) => item.id === value);
  return targetEntry ? resolveWebsiteCmsEntryValue(targetEntry, binding.referenceFieldKey, language, defaultLanguage) : undefined;
}

export function materializeWebsiteCmsSections(
  sections: WebsiteSection[],
  cms: WebsiteCmsState,
  contextEntryId?: string,
  language?: Language,
  defaultLanguage: Language = 'en',
): WebsiteSection[] {
  return sections.map((section) => ({
    ...section,
    elements: section.elements.map((element) => {
      if (!element.cmsBinding) return element;
      const value = resolveWebsiteCmsValue(cms, element.cmsBinding, contextEntryId, language, defaultLanguage);
      if (value === undefined || value === '') return element;
      return { ...element, [element.cmsBinding.target]: String(value) };
    }),
  }));
}

export function expandWebsiteCmsPages(
  pages: WebsitePage[],
  cmsInput: WebsiteCmsState,
  now: Date | number | string = Date.now(),
  defaultLanguage: Language = 'en',
): WebsitePage[] {
  const cms = normalizeWebsiteCms(cmsInput);
  return pages.flatMap((page) => {
    const language = normalizePageLanguage(page.language, defaultLanguage);
    const template = page.cmsTemplate;
    if (!template) return [{ ...page, sections: materializeWebsiteCmsSections(page.sections, cms, undefined, language, defaultLanguage) }];
    const collection = cms.collections.find((item) => item.id === template.collectionId);
    const publishedEntries = collection ? queryWebsiteCmsEntries(collection, template.viewId, now) : [];
    if (!collection || !publishedEntries.length) return [];
    return publishedEntries.map((entry) => {
      const localizedSlug = resolveWebsiteCmsEntryValue(entry, collection.slugField, language, defaultLanguage);
      const entrySlug = normalizeSlug(String(localizedSlug || entry.id));
      const entryName = String(
        resolveWebsiteCmsEntryValue(entry, 'title', language, defaultLanguage)
        || resolveWebsiteCmsEntryValue(entry, 'name', language, defaultLanguage)
        || entrySlug,
      );
      const routePattern = cleanText(template.routePattern, `${collection.slug}-{slug}`, 160);
      const pageSlug = normalizeSlug(routePattern
        .replace(/\{collection\}/g, collection.slug)
        .replace(/\{slug\}/g, entrySlug)
        .replace(/\{id\}/g, entry.id));
      return {
        ...page,
        id: `${page.id}--${entry.id}`,
        name: entryName,
        slug: pageSlug,
        showInNavigation: false,
        cmsTemplate: undefined,
        sections: materializeWebsiteCmsSections(page.sections, cms, entry.id, language, defaultLanguage),
      };
    });
  });
}

export function validateWebsiteCms(cmsInput: WebsiteCmsState, pages: WebsitePage[] = []): WebsiteCmsIssue[] {
  const cms = normalizeWebsiteCms(cmsInput);
  const issues: WebsiteCmsIssue[] = [];
  cms.collections.forEach((collection) => {
    const publishedSlugs = new Set<string>();
    const localizedPublishedSlugs = new Map<Language, Set<string>>(WEBSITE_CMS_LANGUAGES.map((language) => [language, new Set<string>()]));
    collection.entries.forEach((entry) => {
      collection.fields.filter((field) => field.required && !entry.draft).forEach((field) => {
        if (entry.values[field.key] === undefined || entry.values[field.key] === '') issues.push({ severity: 'error', message: `${collection.name}: ${field.name} is required.`, collectionId: collection.id, entryId: entry.id });
      });
      if (!entry.draft) {
        const rawSlug = String(entry.values[collection.slugField] || '').trim();
        const slug = normalizeSlug(rawSlug);
        if (!rawSlug) issues.push({ severity: 'error', message: `${collection.name}: published entry needs a slug.`, collectionId: collection.id, entryId: entry.id });
        else if (publishedSlugs.has(slug)) issues.push({ severity: 'error', message: `${collection.name}: duplicate published slug “${slug}”.`, collectionId: collection.id, entryId: entry.id });
        publishedSlugs.add(slug);
        for (const language of WEBSITE_CMS_LANGUAGES) {
          const localizedRaw = String(entry.localizedValues?.[language]?.[collection.slugField] ?? '').trim();
          if (!localizedRaw) continue;
          const localizedSlug = normalizeSlug(localizedRaw);
          const seen = localizedPublishedSlugs.get(language)!;
          if (seen.has(localizedSlug)) issues.push({ severity: 'error', message: `${collection.name}: duplicate ${language.toUpperCase()} published slug “${localizedSlug}”.`, collectionId: collection.id, entryId: entry.id });
          seen.add(localizedSlug);
        }
      }
      if (entry.publishAt && entry.unpublishAt && Date.parse(entry.publishAt) >= Date.parse(entry.unpublishAt)) issues.push({ severity: 'error', message: `${collection.name}: publishing window must end after it starts.`, collectionId: collection.id, entryId: entry.id });
      collection.fields.filter((field) => field.type === 'reference').forEach((field) => {
        const targetCollection = cms.collections.find((candidate) => candidate.id === field.referenceCollectionId);
        if (!targetCollection) {
          issues.push({ severity: 'error', message: `${collection.name}: ${field.name} references a missing collection.`, collectionId: collection.id });
          return;
        }
        const targetIds = [entry.values[field.key], ...WEBSITE_CMS_LANGUAGES.map((language) => entry.localizedValues?.[language]?.[field.key])];
        for (const targetId of targetIds) {
          if (typeof targetId === 'string' && targetId && !targetCollection.entries.some((candidate) => candidate.id === targetId)) issues.push({ severity: 'error', message: `${collection.name}: ${field.name} references a missing entry.`, collectionId: collection.id, entryId: entry.id });
        }
      });
    });
    collection.views.forEach((view) => {
      view.filters.forEach((filter) => {
        if (!collection.fields.some((field) => field.key === filter.fieldKey)) issues.push({ severity: 'error', message: `${collection.name}: ${view.name} filters a missing field.`, collectionId: collection.id });
      });
    });
  });
  pages.filter((page) => page.cmsTemplate).forEach((page) => {
    const collection = cms.collections.find((candidate) => candidate.id === page.cmsTemplate?.collectionId);
    if (!collection) issues.push({ severity: 'error', message: `${page.name}: dynamic collection is missing.` });
    else if (page.cmsTemplate?.viewId && !collection.views.some((view) => view.id === page.cmsTemplate?.viewId)) issues.push({ severity: 'error', message: `${page.name}: dynamic CMS view is missing.`, collectionId: collection.id });
  });
  pages.forEach((page) => page.sections.forEach((section) => section.elements.forEach((element) => {
    const binding = element.cmsBinding;
    if (!binding) return;
    const collection = cms.collections.find((item) => item.id === binding.collectionId);
    if (!collection) {
      issues.push({ severity: 'error', message: `${page.name}: an element references a missing CMS collection.` });
      return;
    }
    if (!collection.fields.some((field) => field.key === binding.fieldKey)) issues.push({ severity: 'error', message: `${page.name}: an element references a missing CMS field.`, collectionId: collection.id });
    const boundField = collection.fields.find((field) => field.key === binding.fieldKey);
    if (binding.referenceFieldKey) {
      const targetCollection = cms.collections.find((candidate) => candidate.id === boundField?.referenceCollectionId);
      if (boundField?.type !== 'reference' || !targetCollection?.fields.some((field) => field.key === binding.referenceFieldKey)) issues.push({ severity: 'error', message: `${page.name}: an element references a missing related CMS field.`, collectionId: collection.id });
    }
    if (binding.entryId) {
      const entry = collection.entries.find((item) => item.id === binding.entryId);
      if (!entry) issues.push({ severity: 'error', message: `${page.name}: an element references a missing CMS entry.`, collectionId: collection.id });
      else if (entry.draft) issues.push({ severity: 'error', message: `${page.name}: a bound CMS entry is still a draft.`, collectionId: collection.id, entryId: entry.id });
    }
  })));
  return issues;
}
