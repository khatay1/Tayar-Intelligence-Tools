import type { Language } from '@/context/PreferencesContext';
import { normalizeSlug } from './project-identifiers';
import {
  createWebsiteCmsCollection,
  createWebsiteCmsEntry,
  normalizeWebsiteCms,
  validateWebsiteCms,
  WEBSITE_CMS_LANGUAGES,
  WEBSITE_CMS_LIMITS,
  type WebsiteCmsFieldType,
  type WebsiteCmsFilter,
  type WebsiteCmsFilterOperator,
  type WebsiteCmsIssue,
  type WebsiteCmsState,
  type WebsiteCmsValue,
} from './website-cms';

export type WebsiteCmsAIAction =
  | 'add_collection'
  | 'update_collection'
  | 'add_field'
  | 'update_field'
  | 'add_entry'
  | 'update_entry'
  | 'translate_entry'
  | 'add_view';

export interface WebsiteCmsAIOperation {
  action: WebsiteCmsAIAction;
  collectionId?: string;
  entryId?: string;
  fieldId?: string;
  language?: Language;
  name?: string;
  slug?: string;
  slugField?: string;
  field?: {
    name: string;
    key?: string;
    type: WebsiteCmsFieldType;
    required?: boolean;
    referenceCollectionId?: string;
  };
  values?: Record<string, WebsiteCmsValue>;
  filters?: WebsiteCmsFilter[];
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  limit?: number;
}

export interface WebsiteCmsAIPlan {
  summary: string;
  warnings: string[];
  operations: WebsiteCmsAIOperation[];
}

export interface WebsiteCmsAIApplyResult {
  cms: WebsiteCmsState;
  applied: number;
  warnings: string[];
}

export const WEBSITE_CMS_AI_LIMITS = { operations: 30, warnings: 10, summaryChars: 400 } as const;
const ACTIONS = new Set<WebsiteCmsAIAction>(['add_collection', 'update_collection', 'add_field', 'update_field', 'add_entry', 'update_entry', 'translate_entry', 'add_view']);
const FIELD_TYPES = new Set<WebsiteCmsFieldType>(['text', 'rich-text', 'number', 'boolean', 'date', 'image', 'url', 'reference']);
const FILTER_OPERATORS = new Set<WebsiteCmsFilterOperator>(['equals', 'not-equals', 'contains', 'truthy']);
const LOCALIZABLE_FIELD_TYPES = new Set<WebsiteCmsFieldType>(['text', 'rich-text', 'date', 'image', 'url']);

function uid(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown, max = 160): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeValues(value: unknown): Record<string, WebsiteCmsValue> | undefined {
  const source = object(value);
  const entries = Object.entries(source).flatMap(([key, candidate]) => {
    if (typeof candidate !== 'string' && typeof candidate !== 'number' && typeof candidate !== 'boolean') return [];
    return [[key.slice(0, 80), typeof candidate === 'string' ? candidate.slice(0, 20_000) : candidate] as const];
  });
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function safeFilters(value: unknown): WebsiteCmsFilter[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const filters = value.slice(0, WEBSITE_CMS_LIMITS.filters).flatMap((candidate) => {
    const source = object(candidate);
    const fieldKey = text(source.fieldKey, 80);
    const operator = FILTER_OPERATORS.has(source.operator as WebsiteCmsFilterOperator) ? source.operator as WebsiteCmsFilterOperator : 'equals';
    if (!fieldKey) return [];
    const filter: WebsiteCmsFilter = { fieldKey, operator };
    if (typeof source.value === 'string' || typeof source.value === 'number' || typeof source.value === 'boolean') filter.value = source.value;
    return [filter];
  });
  return filters.length ? filters : undefined;
}

function issueKey(issue: WebsiteCmsIssue): string {
  return `${issue.severity}|${issue.collectionId || ''}|${issue.entryId || ''}|${issue.message}`;
}

export function normalizeWebsiteCmsAIPlan(input: unknown): WebsiteCmsAIPlan {
  const source = object(input);
  const operations = Array.isArray(source.operations) ? source.operations.slice(0, WEBSITE_CMS_AI_LIMITS.operations).flatMap((candidate) => {
    const operation = object(candidate);
    const action = text(operation.action, 40) as WebsiteCmsAIAction;
    if (!ACTIONS.has(action)) return [];
    const rawField = object(operation.field);
    const fieldType = FIELD_TYPES.has(rawField.type as WebsiteCmsFieldType) ? rawField.type as WebsiteCmsFieldType : 'text';
    const language = WEBSITE_CMS_LANGUAGES.includes(operation.language as Language) ? operation.language as Language : undefined;
    const normalized: WebsiteCmsAIOperation = {
      action,
      collectionId: text(operation.collectionId, 120) || undefined,
      entryId: text(operation.entryId, 120) || undefined,
      fieldId: text(operation.fieldId, 120) || undefined,
      language,
      name: text(operation.name, 80) || undefined,
      slug: text(operation.slug, 120) || undefined,
      slugField: text(operation.slugField, 80) || undefined,
      values: safeValues(operation.values),
      filters: safeFilters(operation.filters),
      sortField: text(operation.sortField, 80) || undefined,
      sortDirection: operation.sortDirection === 'desc' ? 'desc' : operation.sortDirection === 'asc' ? 'asc' : undefined,
      limit: Number.isFinite(Number(operation.limit)) ? Math.min(500, Math.max(1, Math.round(Number(operation.limit)))) : undefined,
    };
    if (Object.keys(rawField).length) normalized.field = {
      name: text(rawField.name, 80),
      key: text(rawField.key, 80) || undefined,
      type: fieldType,
      required: typeof rawField.required === 'boolean' ? rawField.required : undefined,
      referenceCollectionId: text(rawField.referenceCollectionId, 120) || undefined,
    };
    return [normalized];
  }) : [];
  const warnings = Array.isArray(source.warnings)
    ? source.warnings.slice(0, WEBSITE_CMS_AI_LIMITS.warnings).map((value) => text(value, 300)).filter(Boolean)
    : [];
  return {
    summary: text(source.summary, WEBSITE_CMS_AI_LIMITS.summaryChars) || 'CMS AI plan',
    warnings,
    operations,
  };
}

function uniqueFieldKey(requested: string, existing: Set<string>, fallback: string): string {
  const base = normalizeSlug(requested || fallback).replace(/-/g, '_').slice(0, 80) || fallback;
  let key = base;
  let suffix = 2;
  while (existing.has(key)) key = `${base}_${suffix++}`.slice(0, 80);
  return key;
}

export function applyWebsiteCmsAIPlan(inputCms: WebsiteCmsState, rawPlan: WebsiteCmsAIPlan): WebsiteCmsAIApplyResult {
  const plan = normalizeWebsiteCmsAIPlan(rawPlan);
  const originalCms = normalizeWebsiteCms(inputCms);
  const baselineErrorKeys = new Set(validateWebsiteCms(originalCms).filter((issue) => issue.severity === 'error').map(issueKey));
  let cms = originalCms;
  const warnings = [...plan.warnings];
  let applied = 0;
  const skip = (message: string) => warnings.push(message);

  for (const operation of plan.operations) {
    if (operation.action === 'add_collection') {
      if (cms.collections.length >= WEBSITE_CMS_LIMITS.collections) { skip('Skipped AI collection: collection limit reached.'); continue; }
      const name = operation.name?.trim();
      if (!name) { skip('Skipped AI collection without a name.'); continue; }
      const next = createWebsiteCmsCollection(name, uid('collection'));
      if (operation.slug) next.slug = normalizeSlug(operation.slug);
      cms = { ...cms, collections: [...cms.collections, next] };
      applied += 1;
      continue;
    }

    const collectionIndex = cms.collections.findIndex((item) => item.id === operation.collectionId);
    if (collectionIndex < 0) { skip(`Skipped ${operation.action}: CMS collection was not found.`); continue; }
    const collection = cms.collections[collectionIndex];

    if (operation.action === 'update_collection') {
      const name = operation.name?.trim().slice(0, 80);
      const slug = operation.slug ? normalizeSlug(operation.slug) : undefined;
      const slugField = operation.slugField && collection.fields.some((field) => field.key === operation.slugField) ? operation.slugField : undefined;
      const next = { ...collection, ...(name ? { name } : {}), ...(slug ? { slug } : {}), ...(slugField ? { slugField } : {}) };
      cms = { ...cms, collections: cms.collections.map((item, index) => index === collectionIndex ? next : item) };
      applied += 1;
      continue;
    }

    if (operation.action === 'add_field') {
      if (collection.fields.length >= WEBSITE_CMS_LIMITS.fields) { skip(`Skipped AI field in ${collection.name}: field limit reached.`); continue; }
      const field = operation.field;
      if (!field?.name) { skip(`Skipped AI field in ${collection.name}: field name is required.`); continue; }
      if (field.type === 'reference' && (!field.referenceCollectionId || !cms.collections.some((candidate) => candidate.id === field.referenceCollectionId && candidate.id !== collection.id))) {
        skip(`Skipped AI reference field in ${collection.name}: target collection is invalid.`); continue;
      }
      const existing = new Set(collection.fields.map((candidate) => candidate.key));
      const key = uniqueFieldKey(field.key || field.name, existing, `field_${collection.fields.length + 1}`);
      const nextField = { id: uid('field'), name: field.name.slice(0, 80), key, type: field.type, required: field.required === true, referenceCollectionId: field.type === 'reference' ? field.referenceCollectionId : undefined };
      const next = {
        ...collection,
        fields: [...collection.fields, nextField],
        entries: collection.entries.map((entry) => ({ ...entry, values: { ...entry.values, [key]: field.type === 'boolean' ? false : field.type === 'number' ? 0 : '' } })),
      };
      cms = { ...cms, collections: cms.collections.map((item, index) => index === collectionIndex ? next : item) };
      applied += 1;
      continue;
    }

    if (operation.action === 'update_field') {
      const fieldIndex = collection.fields.findIndex((field) => field.id === operation.fieldId);
      if (fieldIndex < 0) { skip(`Skipped AI field update in ${collection.name}: field was not found.`); continue; }
      const requested = operation.field;
      const fields = collection.fields.map((field, index) => index === fieldIndex ? {
        ...field,
        ...(requested?.name ? { name: requested.name.slice(0, 80) } : {}),
        ...(typeof requested?.required === 'boolean' ? { required: requested.required } : {}),
      } : field);
      cms = { ...cms, collections: cms.collections.map((item, index) => index === collectionIndex ? { ...collection, fields } : item) };
      applied += 1;
      continue;
    }

    if (operation.action === 'add_entry') {
      if (collection.entries.length >= WEBSITE_CMS_LIMITS.entries) { skip(`Skipped AI entry in ${collection.name}: entry limit reached.`); continue; }
      const entry = createWebsiteCmsEntry(collection, uid('entry'));
      const allowedKeys = new Set(collection.fields.map((field) => field.key));
      const values = { ...entry.values };
      Object.entries(operation.values || {}).forEach(([key, value]) => { if (allowedKeys.has(key)) values[key] = value; });
      const nextEntry = { ...entry, values, draft: true };
      cms = { ...cms, collections: cms.collections.map((item, index) => index === collectionIndex ? { ...collection, entries: [...collection.entries, nextEntry] } : item) };
      applied += 1;
      continue;
    }

    const entryIndex = collection.entries.findIndex((entry) => entry.id === operation.entryId);
    if (entryIndex < 0) { skip(`Skipped ${operation.action} in ${collection.name}: entry was not found.`); continue; }
    const entry = collection.entries[entryIndex];

    if (operation.action === 'update_entry') {
      const allowedKeys = new Set(collection.fields.map((field) => field.key));
      const values = { ...entry.values };
      Object.entries(operation.values || {}).forEach(([key, value]) => { if (allowedKeys.has(key)) values[key] = value; });
      const entries = collection.entries.map((candidate, index) => index === entryIndex ? { ...entry, values } : candidate);
      cms = { ...cms, collections: cms.collections.map((item, index) => index === collectionIndex ? { ...collection, entries } : item) };
      applied += 1;
      continue;
    }

    if (operation.action === 'translate_entry') {
      if (!operation.language) { skip(`Skipped AI translation in ${collection.name}: language is required.`); continue; }
      const allowedKeys = new Set(collection.fields.filter((field) => LOCALIZABLE_FIELD_TYPES.has(field.type)).map((field) => field.key));
      const languageValues = { ...(entry.localizedValues?.[operation.language] || {}) };
      Object.entries(operation.values || {}).forEach(([key, value]) => { if (allowedKeys.has(key)) languageValues[key] = value; });
      const localizedValues = { ...(entry.localizedValues || {}), [operation.language]: languageValues };
      const entries = collection.entries.map((candidate, index) => index === entryIndex ? { ...entry, localizedValues } : candidate);
      cms = { ...cms, collections: cms.collections.map((item, index) => index === collectionIndex ? { ...collection, entries } : item) };
      applied += 1;
      continue;
    }

    if (operation.action === 'add_view') {
      if (collection.views.length >= WEBSITE_CMS_LIMITS.views) { skip(`Skipped AI view in ${collection.name}: view limit reached.`); continue; }
      const name = operation.name?.trim();
      if (!name) { skip(`Skipped AI view in ${collection.name}: view name is required.`); continue; }
      const fieldKeys = new Set(collection.fields.map((field) => field.key));
      const filters = (operation.filters || []).filter((filter) => fieldKeys.has(filter.fieldKey)).slice(0, WEBSITE_CMS_LIMITS.filters);
      const view = {
        id: uid('view'),
        name: name.slice(0, 80),
        filters,
        sortField: operation.sortField && fieldKeys.has(operation.sortField) ? operation.sortField : undefined,
        sortDirection: operation.sortDirection === 'desc' ? 'desc' as const : 'asc' as const,
        limit: operation.limit,
      };
      cms = { ...cms, collections: cms.collections.map((item, index) => index === collectionIndex ? { ...collection, views: [...collection.views, view] } : item) };
      applied += 1;
    }
  }

  cms = normalizeWebsiteCms(cms);
  const newErrors = validateWebsiteCms(cms)
    .filter((issue) => issue.severity === 'error' && !baselineErrorKeys.has(issueKey(issue)));
  if (newErrors.length) {
    warnings.push(...newErrors.slice(0, 5).map((issue) => `AI plan rejected: ${issue.message}`));
    return { cms: originalCms, applied: 0, warnings: [...new Set(warnings)].slice(0, 20) };
  }
  return { cms, applied, warnings: [...new Set(warnings)].slice(0, 20) };
}
