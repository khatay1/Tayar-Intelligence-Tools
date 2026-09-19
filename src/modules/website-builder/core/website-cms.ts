import { normalizeSlug } from './project-identifiers';
import type { WebsiteCmsBinding, WebsiteSection } from './types';
import type { WebsitePage } from './website-builder-model';

export type WebsiteCmsFieldType = 'text' | 'rich-text' | 'number' | 'boolean' | 'date' | 'image' | 'url';
export type WebsiteCmsValue = string | number | boolean;

export interface WebsiteCmsField {
  id: string;
  name: string;
  key: string;
  type: WebsiteCmsFieldType;
  required: boolean;
}

export interface WebsiteCmsEntry {
  id: string;
  values: Record<string, WebsiteCmsValue>;
  draft: boolean;
}

export interface WebsiteCmsCollection {
  id: string;
  name: string;
  slug: string;
  slugField: string;
  fields: WebsiteCmsField[];
  entries: WebsiteCmsEntry[];
}

export interface WebsiteCmsState {
  version: 1;
  collections: WebsiteCmsCollection[];
}

export interface WebsiteCmsIssue {
  severity: 'error' | 'warning';
  message: string;
  collectionId?: string;
  entryId?: string;
}

export const EMPTY_WEBSITE_CMS: WebsiteCmsState = { version: 1, collections: [] };
export const WEBSITE_CMS_LIMITS = { collections: 20, fields: 30, entries: 500 } as const;

const FIELD_TYPES = new Set<WebsiteCmsFieldType>(['text', 'rich-text', 'number', 'boolean', 'date', 'image', 'url']);

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
        draft: sourceEntry.draft === true,
      } satisfies WebsiteCmsEntry;
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
    } satisfies WebsiteCmsCollection;
  });
  return { version: 1, collections };
}

export function createWebsiteCmsCollection(name: string, id = `collection-${Date.now()}`): WebsiteCmsCollection {
  const safe = safeId(id, `collection-${Date.now()}`);
  return normalizeWebsiteCms({ collections: [{ id: safe, name, slug: normalizeSlug(name), fields: [], entries: [] }] }).collections[0];
}

export function createWebsiteCmsEntry(collection: WebsiteCmsCollection, id = `${collection.id}-entry-${Date.now()}`): WebsiteCmsEntry {
  return { id: safeId(id, `${collection.id}-entry`), draft: true, values: Object.fromEntries(collection.fields.map((field) => [field.key, field.type === 'boolean' ? false : field.type === 'number' ? 0 : ''])) };
}

export function resolveWebsiteCmsValue(cms: WebsiteCmsState, binding: WebsiteCmsBinding, contextEntryId?: string): WebsiteCmsValue | undefined {
  const collection = cms.collections.find((item) => item.id === binding.collectionId);
  const entry = collection?.entries.find((item) => item.id === (binding.entryId || contextEntryId));
  return entry?.values[binding.fieldKey];
}

export function materializeWebsiteCmsSections(sections: WebsiteSection[], cms: WebsiteCmsState, contextEntryId?: string): WebsiteSection[] {
  return sections.map((section) => ({
    ...section,
    elements: section.elements.map((element) => {
      if (!element.cmsBinding) return element;
      const value = resolveWebsiteCmsValue(cms, element.cmsBinding, contextEntryId);
      if (value === undefined || value === '') return element;
      return { ...element, [element.cmsBinding.target]: String(value) };
    }),
  }));
}

export function expandWebsiteCmsPages(pages: WebsitePage[], cmsInput: WebsiteCmsState): WebsitePage[] {
  const cms = normalizeWebsiteCms(cmsInput);
  return pages.flatMap((page) => {
    const template = page.cmsTemplate;
    if (!template) return [{ ...page, sections: materializeWebsiteCmsSections(page.sections, cms) }];
    const collection = cms.collections.find((item) => item.id === template.collectionId);
    const publishedEntries = collection?.entries.filter((entry) => !entry.draft) || [];
    if (!collection || !publishedEntries.length) return [];
    return publishedEntries.map((entry) => {
      const entrySlug = normalizeSlug(String(entry.values[collection.slugField] || entry.id));
      const entryName = String(entry.values.title || entry.values.name || entrySlug);
      return {
        ...page,
        id: `${page.id}--${entry.id}`,
        name: entryName,
        slug: `${normalizeSlug(collection.slug || page.slug)}-${entrySlug}`,
        showInNavigation: false,
        cmsTemplate: undefined,
        sections: materializeWebsiteCmsSections(page.sections, cms, entry.id),
      };
    });
  });
}

export function validateWebsiteCms(cmsInput: WebsiteCmsState, pages: WebsitePage[] = []): WebsiteCmsIssue[] {
  const cms = normalizeWebsiteCms(cmsInput);
  const issues: WebsiteCmsIssue[] = [];
  cms.collections.forEach((collection) => {
    const publishedSlugs = new Set<string>();
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
      }
    });
  });
  pages.filter((page) => page.cmsTemplate).forEach((page) => {
    if (!cms.collections.some((collection) => collection.id === page.cmsTemplate?.collectionId)) issues.push({ severity: 'error', message: `${page.name}: dynamic collection is missing.` });
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
    if (binding.entryId) {
      const entry = collection.entries.find((item) => item.id === binding.entryId);
      if (!entry) issues.push({ severity: 'error', message: `${page.name}: an element references a missing CMS entry.`, collectionId: collection.id });
      else if (entry.draft) issues.push({ severity: 'error', message: `${page.name}: a bound CMS entry is still a draft.`, collectionId: collection.id, entryId: entry.id });
    }
  })));
  return issues;
}
