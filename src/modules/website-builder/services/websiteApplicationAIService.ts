import { supabase } from '@/lib/supabase';
import { applicationFingerprint, applicationPageContracts, createApplicationCommand, type ApplicationOperation, type ApplicationProject } from '../core/application-operations';
import { runEditorCommand } from '../core/editor-command';
import { createEditorHistory } from '../core/editor-history';
import { buildApplicationRequirementCoverage } from '../core/application-requirements';
import { readApplicationDefinition } from '../core/application-validation';

export interface ApplicationAIPlan {
  summary: string;
  warnings: string[];
  operations: ApplicationOperation[];
  fingerprint: string;
}

const system = `You are the Tayar Website Builder application planner. Return only JSON: {"summary":"short summary","warnings":[],"operations":[]}.
Use the supplied existing application definition, pageContracts and requirementChecks. Preserve existing native form/data-view mappings and every passing requirement check; never weaken a page policy or change a tested payload to make a repair appear successful. Requirement checks are bounded local contract evidence, not live database/provider proof. Use exact supplied field/section/action IDs when preserving bindings. Allowed operation types: put_table, put_role, set_auth, set_page_access. Each operation must match the validated ApplicationOperation shape exactly. Never return SQL, code, credentials, secret values, runtime user/row data, deletion or publishing actions. Keep existing IDs exact; new IDs must be unique alphanumeric IDs. Table/field keys are lower-case SQL-safe identifiers. The initial schema has generated id, owner_id, created_at and updated_at; do not redefine them. Public writes are forbidden. Authentication must be enabled before access rules need it. Optional table.booking defines resourceFieldId (required uuid/reference), startFieldId and endFieldId (distinct required datetime), optional statusFieldId (required enum) and blockingStatuses (nonempty declared enum values). Optional booking.schedule defines timeZone (IANA name such as Europe/Stockholm), weekly [{day:1–7 Monday–Sunday,startMinute:0–1439,endMinute:1–1440}] with non-overlapping windows on each day and maxDurationMinutes:1–1440. A booking must fit one window and its elapsed duration limit; endMinute 1440 means next midnight. Blocking states obey these hours; cancelled/nonblocking states are exempt. This enforces single-resource overlap and working hours, not a live calendar. Optional booking.recurrence={timeZone:"Europe/Stockholm",maxOccurrences:12} enables native daily/weekly creation with 2–52 occurrences, interval 1–12 and a maximum 366-day horizon. Match schedule timeZone when present. The series preserves local wall-clock time, rejects ambiguous/nonexistent DST times and saves in one atomic INSERT; each appointment remains individually editable/cancellable. It does not provide whole-series editing. Never remove or change deployed booking rules in an additive upgrade. Optional table.counter defines fieldId (required number with defaultValue equal to minimum), minimum, optional maximum and integer boolean; it enforces atomic single-record quantity adjustments with read/update permissions. Optional parent table.transaction defines itemTableId (a counter table), lineTableId, required lineTransactionFieldId/lineItemFieldId references, required numeric lineQuantityFieldId and counterDirection decrement/increment. It atomically creates the parent and lines and updates all quantities. The parent needs read/create, item read/update and line table read-only permissions. Never remove or change deployed native rules in an additive upgrade. Optional table.workflow defines fieldId (required enum with a declared defaultValue) and transitions [{id,label,from:[declared source states],to:declared destination state,access:owner/authenticated/role,roleId:only for role,effects?:bounded changes}]. Effects are at most 20 typed set/increment/timestamp assignments to ordinary non-state, non-formula, non-counter fields; a transition may additionally update at most one row in each of up to four distinct related tables using a required reference and one declared read/update permission check per target. Related targets lock in stable table-key order, and any missing/unauthorized target or constraint failure aborts the entire transition. No fan-out, self-table reference, arbitrary expression or code is supported. Both source table read/update permissions and transition-specific access apply. State changes must use atomic workflow actions. Never remove or change deployed workflows in an additive upgrade. Booking rules may declare additionalResourceFieldIds (1–4 required reference fields pointing to distinct resource tables, including a primary reference); all resources reserve the same interval atomically. A schedule may include exceptions [{date:valid YYYY-MM-DD,windows:[{startMinute,endMinute}]}], up to 366 unique dates and four non-overlapping windows per date; empty windows closes the date. Optional waitlistStatus is a declared nonblocking status outside workflow-protected fields. Waiting entries reserve no interval and require an authorized manual status update for confirmation. Availability checks expose only a boolean to authorized creators, validate resource visibility and working hours, and never replace the database conflict guard. Optional table.reports declares 1–8 aggregates [{id,name,operation:count/sum/min/max/avg,fieldId:required numeric field except count}]. Auth and table read permission are required. Published bound data views show totals for all RLS-readable records, independently of search and pagination. Numeric values stay exact text. Optional groupByFieldId selects a declared text/enum/boolean/uuid/reference field. Optional period={fieldId:date or datetime field ID,unit:day/week/month/year,timeZone:IANA name,offset:integer -120–0,comparePrevious:boolean} uses local calendar boundaries; the preceding whole period is compared. Current periods may be incomplete. Grouped reports disclose truncation at 100 groups while totals cover all readable rows, and authorized JSON downloads preserve exact decimals. These analytics are not accounting ledgers. Optional table.attachments defines maxBytes (1–26214400) and mimeTypes (nonempty subset of application/pdf, image/jpeg, image/png, image/webp, text/plain or OpenXML docx/xlsx MIME types). It requires Auth and read/update permissions, privately attaches files to existing records and provides download-only access following record RLS. Bind the data view attachments action. Never remove or change deployed attachment rules in an additive upgrade. A calculated field is a required number without a default and formula {operation:sum/subtract/multiply,fieldIds:[required ordinary numeric source IDs]}; subtract/multiply need two sources and sum needs 2–20. Calculated fields are read-only and never form inputs. Preserve any existing table.notifications exactly. Notification rules are configured manually; do not add them or claim live email delivery in an AI plan before customer worker provisioning is available. Keep the plan under 40 operations. Do not claim that a backend has been provisioned or that changes have already been applied.`;

/** Existing AI engine produces a review plan; the shared editor command validates and applies it. */
export async function planWebsiteApplicationWithAI(project: ApplicationProject, instruction: string): Promise<ApplicationAIPlan> {
  const request = instruction.trim();
  if (!request) throw new Error('Describe the application changes first.');
  if (request.length > 4_000) throw new Error('Describe application changes in at most 4,000 characters; no request was sent.');
  const application = readApplicationDefinition(project.application, new Set(project.pages.map(page => page.id)));
  const fingerprint = applicationFingerprint(project);
  const pages = project.pages.map(page => ({ id: page.id, sections: page.sections ?? [] }));
  const content = JSON.stringify({ instruction: request, application, pageIds: project.pages.map(page => page.id),
    pageContracts: applicationPageContracts(project).map(page => ({ id: page.id,
      sections: page.sections.map(section => ({
        id: section.id, type: section.type, applicationFormBinding: section.applicationFormBinding,
        applicationDataView: section.applicationDataView, formSuccessAction: section.formSuccessAction,
        hasEnabledFormAutomations: section.formAutomations?.some(item => item.enabled) ?? false,
        formFields: section.formFields?.map(field => ({
          id: field.id, name: field.name, type: field.type, required: field.required, options: field.options,
          conditional: !!field.conditions?.length,
          validation: field.validation && { min: field.validation.min, max: field.validation.max,
            minLength: field.validation.minLength, maxLength: field.validation.maxLength, hasPattern: !!field.validation.pattern },
        })),
        customOperations: section.elements?.map(element => ({ id: element.id, operationId: element.customOperationId,
          bindFormValues: element.customOperationBindFormValues === true })),
      })),
    })),
    requirementChecks: buildApplicationRequirementCoverage(application, pages).map(row => ({
      requirementId: row.requirementId,
      tests: row.tests.map(test => ({ id: test.id, kind: test.kind, result: test.result })),
    })),
  });
  const body = {
    tool: 'website-builder',
    messages: [{ role: 'system', content: system }, { role: 'user', content }],
    jsonMode: true, temperature: 0.2, maxTokens: 4_096,
  };
  // Keep complete JSON within the existing AI engine's default request bounds.
  // Never silently cut schema, native bindings, criteria or the user's request.
  if (content.length > 32_000 || system.length + content.length > 40_000 || JSON.stringify(body).length > 60_000) {
    throw new Error("The complete application planning context exceeds this planner's limit. No request was sent; reduce the project scope before planning these changes.");
  }
  const { data, error } = await supabase.functions.invoke('ai-engine', { body });
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
