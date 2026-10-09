import { supabase } from '@/lib/supabase';
import { applicationFingerprint, createApplicationCommand, type ApplicationOperation, type ApplicationProject } from '../core/application-operations';
import { runEditorCommand } from '../core/editor-command';
import { createEditorHistory } from '../core/editor-history';
import { readApplicationDefinition } from '../core/application-validation';

export interface ApplicationAIPlan {
  summary: string;
  warnings: string[];
  operations: ApplicationOperation[];
  fingerprint: string;
}

const system = `You are the Tayar Website Builder application planner. Return only JSON: {"summary":"short summary","warnings":[],"operations":[]}.
Use the supplied existing application definition and page IDs. Allowed operation types: put_table, put_role, set_auth, set_page_access. Each operation must match the validated ApplicationOperation shape exactly. Never return SQL, code, credentials, secret values, runtime user/row data, deletion or publishing actions. Keep existing IDs exact; new IDs must be unique alphanumeric IDs. Table/field keys are lower-case SQL-safe identifiers. The initial schema has generated id, owner_id, created_at and updated_at; do not redefine them. Public writes are forbidden. Authentication must be enabled before access rules need it. Optional table.booking defines resourceFieldId (required uuid/reference), startFieldId and endFieldId (distinct required datetime), optional statusFieldId (required enum) and blockingStatuses (nonempty declared enum values). This enforces single-resource overlap exclusion, not a calendar or recurring scheduling engine. Never remove or change deployed booking rules in an additive upgrade. Optional table.counter defines fieldId (required number with defaultValue equal to minimum), minimum, optional maximum and integer boolean; it enforces atomic single-record quantity adjustments with read/update permissions. Optional parent table.transaction defines itemTableId (a counter table), lineTableId, required lineTransactionFieldId/lineItemFieldId references, required numeric lineQuantityFieldId and counterDirection decrement/increment. It atomically creates the parent and lines and updates all quantities. The parent needs read/create, item read/update and line table read-only permissions. Never remove or change deployed native rules in an additive upgrade. Optional table.workflow defines fieldId (required enum with a declared defaultValue) and transitions [{id,label,from:[declared source states],to:declared destination state,access:owner/authenticated/role,roleId:only for role}]. Both table read/update permissions and transition-specific access apply. State changes must use atomic workflow actions. Never remove or change deployed workflows in an additive upgrade. Optional table.attachments defines maxBytes (1–26214400) and mimeTypes (nonempty subset of application/pdf, image/jpeg, image/png, image/webp, text/plain or OpenXML docx/xlsx MIME types). It requires Auth and read/update permissions, privately attaches files to existing records and provides download-only access following record RLS. Bind the data view attachments action. Never remove or change deployed attachment rules in an additive upgrade. A calculated field is a required number without a default and formula {operation:sum/subtract/multiply,fieldIds:[required ordinary numeric source IDs]}; subtract/multiply need two sources and sum needs 2–20. Calculated fields are read-only and never form inputs. Keep the plan under 40 operations. Do not claim that a backend has been provisioned or that changes have already been applied.`;

/** Existing AI engine produces a review plan; the shared editor command validates and applies it. */
export async function planWebsiteApplicationWithAI(project: ApplicationProject, instruction: string): Promise<ApplicationAIPlan> {
  const request = instruction.trim().slice(0, 4_000);
  if (!request) throw new Error('Describe the application changes first.');
  const application = readApplicationDefinition(project.application, new Set(project.pages.map(page => page.id)));
  const fingerprint = applicationFingerprint(project);
  const { data, error } = await supabase.functions.invoke('ai-engine', { body: {
    tool: 'website-builder',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify({ instruction: request, application, pageIds: project.pages.map(page => page.id) }).slice(0, 32_000) },
    ],
    jsonMode: true, temperature: 0.2, maxTokens: 4_096,
  } });
  if (error) throw new Error('Application AI planning failed.');
  const response = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  let raw: unknown = response.json;
  if (!raw && typeof response.content === 'string') {
    try { raw = JSON.parse(response.content); } catch { throw new Error('AI returned an invalid application plan.'); }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('AI returned an invalid application plan.');
  const plan = raw as Record<string, unknown>;
  if (typeof plan.summary !== 'string' || plan.summary.length > 400 || !Array.isArray(plan.warnings) || plan.warnings.length > 10 || plan.warnings.some(item => typeof item !== 'string' || item.length > 300) || !Array.isArray(plan.operations) || plan.operations.length < 1 || plan.operations.length > 40) throw new Error('AI returned an invalid application plan.');
  for (const operation of plan.operations) {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation) || !['put_table', 'put_role', 'set_auth', 'set_page_access'].includes((operation as Record<string, unknown>).type as string)) throw new Error('AI returned an unsupported application operation.');
    const keys = Object.keys(operation);
    const allowed = { put_table: ['type', 'table'], put_role: ['type', 'role'], set_auth: ['type', 'auth'], set_page_access: ['type', 'rules'] }[(operation as Record<string, unknown>).type as 'put_table' | 'put_role' | 'set_auth' | 'set_page_access'];
    if (keys.some(key => !allowed.includes(key))) throw new Error('AI returned an unsupported application operation.');
  }
  const operations = structuredClone(plan.operations) as ApplicationOperation[];
  const result = runEditorCommand(project, createApplicationCommand(operations, { projectId: project.cloudProjectId ?? null, fingerprint, reviewed: true }, 'ai'), { history: createEditorHistory() });
  if (!result.transaction.ok) throw new Error(result.transaction.errors.join(' ') || 'AI plan violates the application schema.');
  return { summary: plan.summary, warnings: plan.warnings as string[], operations, fingerprint };
}
