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

export interface ApplicationAIPlanningScope { tableId: string }

const system = `You are the Tayar Website Builder application planner. Return only JSON: {"summary":"short summary","warnings":[],"operations":[]}.
Use the supplied existing application definition, pageContracts and requirementChecks. If planningScope is supplied, context is explicitly limited to the selected table and its complete outgoing dependencies, relevant native bindings and requirement checks; related tables, Auth, roles and page policies are read-only. Return only put_table operations for planningScope.tableId, never new tables or changes outside that selected table. The full project is validated locally before any application; do not claim the scoped context describes the entire project. Preserve existing native form/data-view mappings and every passing requirement check. Existing table/field storage identities, constraints, defaults, references, formulas and native business rules cannot be removed or changed by AI repairs; use warnings to explain when a reviewed manual configuration/data migration is required. Never broaden existing table-operation, page or workflow audiences, change refund authorization, weaken authentication/email verification or enable registration. Adding new tables/fields and changing display labels or ordinary indexes remain supported; never weaken a page policy or change a tested payload to make a repair appear successful. Requirement checks are bounded local contract evidence, not live database/provider proof. Use exact supplied field/section/action IDs when preserving bindings. Allowed operation types: put_table, put_role, set_auth, set_page_access. Each operation must match the validated ApplicationOperation shape exactly. Never return SQL, code, credentials, secret values, runtime user/row data, deletion or publishing actions. Keep existing IDs exact; new IDs must be unique alphanumeric IDs. Table/field keys are lower-case SQL-safe identifiers. The initial schema has generated id, owner_id, created_at and updated_at; do not redefine them. Public writes are forbidden. Authentication must be enabled before access rules need it. Optional table.booking defines resourceFieldId (required uuid/reference), startFieldId and endFieldId (distinct required datetime), optional statusFieldId (required enum) and blockingStatuses (nonempty declared enum values). Optional booking.schedule defines timeZone (IANA name such as Europe/Stockholm), weekly [{day:1–7 Monday–Sunday,startMinute:0–1439,endMinute:1–1440}] with non-overlapping windows on each day and maxDurationMinutes:1–1440. A booking must fit one window and its elapsed duration limit; endMinute 1440 means next midnight. Blocking states obey these hours; cancelled/nonblocking states are exempt. This enforces single-resource overlap and working hours, not a live calendar. Optional booking.recurrence={timeZone:"Europe/Stockholm",maxOccurrences:12} enables native daily/weekly creation with 2–52 occurrences, interval 1–12 and a maximum 366-day horizon. Match schedule timeZone when present. The series preserves local wall-clock time, rejects ambiguous/nonexistent DST times and saves in one atomic INSERT; each appointment remains individually editable/cancellable. It does not provide whole-series editing. Never remove or change deployed booking rules in an additive upgrade. Optional table.counter defines fieldId (required number with defaultValue equal to minimum), minimum, optional maximum and integer boolean; it enforces atomic single-record quantity adjustments with read/update permissions. For a new dedicated database only, optional table.stockReservations=true explicitly enables owner-only integer stock reservations when counter.minimum is zero and all read/update permissions use owner access. Preserve existing stockReservations declarations exactly. Preserve stockLocations exactly: it declares immutable required item and warehouse references on a physical stock-level row, with one owner/item/warehouse counter. Stock controls must display both references and quantity. The stock-transfer action moves one item between existing stockLocations level rows atomically, preserving held units and durable request identity. Bind a stock-availability data-view action to show available stock minus unexpired holds. This is an informational query, not authorization to commit stock. For reservation requests, bind a stock-reservation data-view action to the same owner-only table. The runtime saves a browser-session receipt before the RPC and retries lost responses using the same hold and settlement decision. The supplied location UUID is only a label, not a physical warehouse allocation; holds expire after 15 minutes. Do not claim cross-device receipt management or customer activation. Never add a stock opt-in to a deployed database. A location label without stockLocations cannot imply warehouse balances; never claim provisioning or live readiness. Optional parent table.transaction defines itemTableId (a counter table), lineTableId, required lineTransactionFieldId/lineItemFieldId references, required numeric lineQuantityFieldId and counterDirection decrement/increment. It atomically creates the parent and lines and updates all quantities. The parent needs read/create, item read/update and line table read-only permissions. Never remove or change deployed native rules in an additive upgrade. Optional table.workflow defines fieldId (required enum with a declared defaultValue) and transitions [{id,label,from:[declared source states],to:declared destination state,access:owner/authenticated/role,roleId:only for role,effects?:bounded changes}]. Effects are at most 20 typed set/increment/timestamp assignments to ordinary non-state, non-formula, non-counter fields; a transition may additionally update at most one row in each of up to four distinct related tables using a required reference and one declared read/update permission check per target. Related targets lock in stable table-key order, and any missing/unauthorized target or constraint failure aborts the entire transition. No fan-out, self-table reference, arbitrary expression or code is supported. Both source table read/update permissions and transition-specific access apply. State changes must use atomic workflow actions. Never remove or change deployed workflows in an additive upgrade. Booking rules may declare additionalResourceFieldIds (1–4 required reference fields pointing to distinct resource tables, including a primary reference); all resources reserve the same interval atomically. A schedule may include exceptions [{date:valid YYYY-MM-DD,windows:[{startMinute,endMinute}]}], up to 366 unique dates and four non-overlapping windows per date; empty windows closes the date. Optional waitlistStatus is a declared nonblocking status outside workflow-protected fields. Waiting entries reserve no interval and require an authorized manual status update for confirmation. Availability checks expose only a boolean to authorized creators, validate resource visibility and working hours, and never replace the database conflict guard. Optional table.reports declares 1–8 aggregates [{id,name,operation:count/sum/min/max/avg,fieldId:required numeric field except count}]. Auth and table read permission are required. Published bound data views show totals for all RLS-readable records, independently of search and pagination. Numeric values stay exact text. Optional groupByFieldId selects a declared text/enum/boolean/uuid/reference field. Optional period={fieldId:date or datetime field ID,unit:day/week/month/year,timeZone:IANA name,offset:integer -120–0,comparePrevious:boolean} uses local calendar boundaries; the preceding whole period is compared. Current periods may be incomplete. Grouped reports disclose truncation at 100 groups while totals cover all readable rows, and authorized JSON downloads preserve exact decimals. These analytics are not accounting ledgers. Optional table.attachments defines maxBytes (1–26214400) and mimeTypes (nonempty subset of application/pdf, image/jpeg, image/png, image/webp, text/plain or OpenXML docx/xlsx MIME types). It requires Auth and read/update permissions, privately attaches files to existing records and provides download-only access following record RLS. Bind the data view attachments action. Never remove or change deployed attachment rules in an additive upgrade. A calculated field is a required number without a default and formula {operation:sum/subtract/multiply,fieldIds:[required ordinary numeric source IDs]}; subtract/multiply need two sources and sum needs 2–20. Calculated fields are read-only and never form inputs. Preserve any existing table.notifications exactly. Notification rules are configured manually; do not add them or claim live email delivery in an AI plan before customer worker provisioning is available. Keep the plan under 40 operations. Do not claim that a backend has been provisioned or that changes have already been applied.`;

/** Existing AI engine produces a review plan; the shared editor command validates and applies it. */
export async function planWebsiteApplicationWithAI(project: ApplicationProject, instruction: string, scope?: ApplicationAIPlanningScope): Promise<ApplicationAIPlan> {
  const request = instruction.trim();
  if (!request) throw new Error('Describe the application changes first.');
  if (request.length > 4_000) throw new Error('Describe application changes in at most 4,000 characters; no request was sent.');
  const application = readApplicationDefinition(project.application, new Set(project.pages.map(page => page.id)));
  const fingerprint = applicationFingerprint(project);
  const pages = project.pages.map(page => ({ id: page.id, sections: page.sections ?? [] }));
  let tableIds: Set<string> | undefined;
  if (scope !== undefined) {
    if (!scope || Object.keys(scope).some(key => key !== 'tableId') || typeof scope.tableId !== 'string'
      || !application.tables.some(table => table.id === scope.tableId)) throw new Error('Select an existing table for scoped application planning; no request was sent.');
    tableIds = new Set([scope.tableId]);
    // Include the complete outgoing dependency closure, including cycles. The
    // related definitions are context only; only the selected table may change.
    for (const tableId of tableIds) {
      const table = application.tables.find(candidate => candidate.id === tableId)!;
      for (const field of table.fields) if (field.referenceTableId) tableIds.add(field.referenceTableId);
      if (table.transaction) { tableIds.add(table.transaction.itemTableId); tableIds.add(table.transaction.lineTableId); }
    }
  }
  const contracts = applicationPageContracts(project).map(page => ({ ...page,
    sections: tableIds ? page.sections.filter(section => (section.applicationFormBinding && tableIds.has(section.applicationFormBinding.tableId))
      || (section.applicationDataView && tableIds.has(section.applicationDataView.tableId))) : page.sections,
  })).filter(page => !tableIds || page.sections.length > 0);
  const pageIds = contracts.map(page => page.id);
  const checks = buildApplicationRequirementCoverage(application, pages).filter(row => !tableIds
    || row.implementation.some(reference => tableIds.has(reference.split(':')[1])
      || reference === 'auth' || (reference.startsWith('page:') && pageIds.includes(reference.slice(5)))));
  const content = JSON.stringify({ instruction: request,
    application: tableIds ? { ...application, tables: application.tables.filter(table => tableIds.has(table.id)),
      pageAccess: application.pageAccess.filter(rule => pageIds.includes(rule.pageId)), requirements: undefined } : application,
    planningScope: scope && { tableId: scope.tableId, readOnlyTableIds: [...tableIds!].filter(id => id !== scope.tableId) },
    pageIds,
    pageContracts: contracts.map(page => ({ id: page.id,
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
    requirementChecks: checks.map(row => ({
      requirementId: row.requirementId,
      ...(scope ? { requirement: row.requirement, acceptanceCriteria: row.acceptanceCriteria } : {}),
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
    if (scope && ((operation as ApplicationOperation).type !== 'put_table'
      || (operation as { table?: { id?: unknown } }).table?.id !== scope.tableId)) {
      throw new Error('The AI plan exceeds the selected table scope. No changes were applied.');
    }
  }
  const operations = structuredClone(plan.operations) as ApplicationOperation[];
  const result = runEditorCommand(project, createApplicationCommand(operations, { projectId: project.cloudProjectId ?? null, fingerprint, reviewed: true }, 'ai'), { history: createEditorHistory() });
  if (!result.transaction.ok) throw new Error(result.transaction.errors.join(' ') || 'AI plan violates the application schema.');
  if (scope) {
    const table = result.project.application!.tables.find(candidate => candidate.id === scope.tableId)!;
    const dependencies = table.fields.flatMap(field => field.referenceTableId ? [field.referenceTableId] : []);
    if (table.transaction) dependencies.push(table.transaction.itemTableId, table.transaction.lineTableId);
    if (dependencies.some(id => !tableIds!.has(id))) throw new Error('The AI plan introduces dependencies outside the selected table context. Plan with all application data instead.');
  }
  return { summary: plan.summary, warnings: plan.warnings as string[], operations, fingerprint };
}
