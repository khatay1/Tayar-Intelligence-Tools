import { supabase } from '@/lib/supabase';
import { normalizeWebsiteCmsAIPlan, type WebsiteCmsAIPlan } from '../core/editor-ai-cms';
import type { WebsiteCmsState, WebsiteCmsValue } from '../core/website-cms';

const MAX_COLLECTIONS = 20;
const MAX_FIELDS = 30;
const MAX_ENTRIES_PER_COLLECTION = 40;
const MAX_VALUE_CHARS = 800;
const MAX_PROMPT_CHARS = 32_000;

function clampValue(value: WebsiteCmsValue): WebsiteCmsValue {
  return typeof value === 'string' ? value.slice(0, MAX_VALUE_CHARS) : value;
}

function boundedCmsSnapshot(cms: WebsiteCmsState) {
  return {
    version: cms.version,
    collections: cms.collections.slice(0, MAX_COLLECTIONS).map((collection) => ({
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      slugField: collection.slugField,
      fields: collection.fields.slice(0, MAX_FIELDS).map((field) => ({
        id: field.id,
        name: field.name,
        key: field.key,
        type: field.type,
        required: field.required,
        referenceCollectionId: field.referenceCollectionId,
      })),
      entries: collection.entries.slice(0, MAX_ENTRIES_PER_COLLECTION).map((entry) => ({
        id: entry.id,
        draft: entry.draft,
        values: Object.fromEntries(Object.entries(entry.values).map(([key, value]) => [key, clampValue(value)])),
        localizedValues: entry.localizedValues
          ? Object.fromEntries(Object.entries(entry.localizedValues).map(([language, values]) => [language,
              Object.fromEntries(Object.entries(values || {}).map(([key, value]) => [key, clampValue(value)])),
            ]))
          : undefined,
      })),
      views: collection.views.map((view) => ({
        id: view.id,
        name: view.name,
        filters: view.filters,
        sortField: view.sortField,
        sortDirection: view.sortDirection,
        limit: view.limit,
      })),
    })),
  };
}

const CMS_AI_SYSTEM = `You are Tayar CMS Assistant. Plan safe native CMS edits for Tayar Website Builder.
Return ONLY valid JSON with this exact top-level shape:
{"summary":"short summary","warnings":[],"operations":[]}

Allowed operation actions only:
- add_collection
- update_collection
- add_field
- update_field
- add_entry
- update_entry
- translate_entry
- add_view

Safety rules:
- Never return delete/remove operations, publish/unpublish actions, code, HTML, SQL, migrations, network calls, secrets or deployment actions.
- Existing collection/entry/field targets MUST use exact IDs from the supplied snapshot.
- add_entry always becomes a draft in Tayar; do not claim it will publish automatically.
- translate_entry requires collectionId, entryId, language (en|sv|ar), and values. Translate only fields present in the collection.
- add_field requires field.name and field.type. Reference fields must target an existing different collection ID.
- update_field is limited to safe metadata such as name/required; do not rename field keys or change field types.
- add_view may use only existing field keys and valid filters.
- Preserve unrelated collections, entries, fields, localized values and views.
- Keep the plan small: maximum 30 operations.
- If the request is ambiguous or destructive, return a warning and only the safe subset. Do not invent IDs.
- This is a review plan only. Never claim changes have already been applied.`;

function buildUserPrompt(cms: WebsiteCmsState, instruction: string): string {
  const snapshot = JSON.stringify(boundedCmsSnapshot(cms));
  const prompt = `USER REQUEST:\n${instruction.trim().slice(0, 4_000)}\n\nCURRENT CMS SNAPSHOT:\n${snapshot}\n\nReturn the reviewable CMS plan JSON only.`;
  return prompt.slice(0, MAX_PROMPT_CHARS);
}

function parsePlanResponse(data: unknown): WebsiteCmsAIPlan {
  if (!data || typeof data !== 'object') throw new Error('AI returned an invalid CMS plan.');
  const record = data as Record<string, unknown>;
  let raw: unknown = record.json;
  if (!raw && typeof record.content === 'string') {
    try { raw = JSON.parse(record.content); } catch { raw = null; }
  }
  if (!raw) throw new Error('AI returned an invalid CMS plan.');
  const plan = normalizeWebsiteCmsAIPlan(raw);
  if (!plan.operations.length) {
    const warning = plan.warnings[0] || 'No safe CMS operations were returned.';
    throw new Error(warning);
  }
  return plan;
}

export async function planWebsiteCmsWithAI(cms: WebsiteCmsState, instruction: string): Promise<WebsiteCmsAIPlan> {
  const prompt = instruction.trim();
  if (!prompt) throw new Error('Describe the CMS changes you want first.');
  const { data, error } = await supabase.functions.invoke('ai-engine', {
    body: {
      tool: 'website-builder',
      messages: [
        { role: 'system', content: CMS_AI_SYSTEM },
        { role: 'user', content: buildUserPrompt(cms, prompt) },
      ],
      jsonMode: true,
      temperature: 0.2,
      maxTokens: 4_096,
    },
  });
  if (error) throw new Error(error.message || 'CMS AI planning failed.');
  return parsePlanResponse(data);
}
