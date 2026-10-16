import { APPLICATION_FILE_TYPES, APPLICATION_FILE_MAX_BYTES } from './application-files';
import { projectSpecificationIssues } from './project-specification';
import { validateApplicationEmailNotification } from './application-email-notifications';
import { validApplicationBookingSchedule } from './application-booking-schedule';
import { validBookingRecurrenceRule } from './application-booking-recurrence';
import { APPLICATION_LIMITS, APPLICATION_SYSTEM_FIELDS, createApplicationDefinition, type ApplicationDefinition, type ApplicationTable } from './application-model';

export interface ApplicationIssue { path: string; code: string; message: string }
type RecordValue = Record<string, unknown>;
const object = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9_]{0,47}$/.test(value);
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(value);
const isoDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const name = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 160;

export function validateApplicationDefinition(value: unknown, pageIds?: ReadonlySet<string>): ApplicationIssue[] {
  const issues: ApplicationIssue[] = [];
  const issue = (path: string, code: string, message: string) => issues.push({ path, code, message });
  function shape(item: unknown, keys: string[], path: string): item is RecordValue {
    if (!object(item)) { issue(path, 'invalid-object', 'Expected an application configuration object.'); return false; }
    if (Object.keys(item).some(key => !keys.includes(key))) issue(path, 'unknown-property', 'Unsupported configuration property; credentials and runtime data cannot be stored here.');
    return true;
  }
  function list(input: unknown, limit: number, path: string): unknown[] {
    if (!Array.isArray(input) || input.length > limit) { issue(path, 'invalid-list', `Expected a list with at most ${limit} items.`); return []; }
    return input;
  }
  if (!shape(value, ['version', 'tables', 'roles', 'auth', 'pageAccess', 'requirements'], 'application')) return issues;
  if (value.version !== 1) issue('application.version', 'unsupported-version', 'Unsupported application schema version. Keep the source project and use a compatible editor.');
  const tables = list(value.tables, APPLICATION_LIMITS.tables, 'application.tables');
  const roles = list(value.roles, APPLICATION_LIMITS.roles, 'application.roles');
  const tableIds = new Set<string>();
  const roleIds = new Set<string>();
  const allIds = new Set<string>();
  const tableKeys = new Set<string>();
  function identity(candidate: unknown, path: string, bucket?: Set<string>) {
    if (!id(candidate) || allIds.has(candidate)) { issue(path, 'invalid-id', 'IDs must be valid and globally unique within the application definition.'); return; }
    allIds.add(candidate); bucket?.add(candidate);
  }
  roles.forEach((role, index) => {
    const path = `application.roles[${index}]`;
    if (!shape(role, ['id', 'name'], path)) return;
    identity(role.id, `${path}.id`, roleIds);
    if (!name(role.name)) issue(`${path}.name`, 'invalid-name', 'A role requires a display name.');
  });
  const auth = value.auth;
  if (shape(auth, ['enabled', 'signUpEnabled', 'emailVerificationRequired'], 'application.auth')) {
    for (const key of ['enabled', 'signUpEnabled', 'emailVerificationRequired']) if (typeof auth[key] !== 'boolean') issue(`application.auth.${key}`, 'invalid-boolean', 'Expected a boolean setting.');
    if (auth.signUpEnabled && !auth.enabled) issue('application.auth', 'auth-disabled', 'Enable authentication before allowing registration.');
  }
  const authEnabled = object(auth) && auth.enabled === true;
  tables.forEach((table, index) => {
    const path = `application.tables[${index}]`;
    if (!shape(table, ['id', 'key', 'name', 'fields', 'permissions', 'booking', 'counter', 'stockReservations', 'transaction', 'payment', 'workflow', 'attachments', 'notifications', 'reports'], path)) return;
    identity(table.id, `${path}.id`, tableIds);
    if (!identifier(table.key) || tableKeys.has(table.key) || table.key.startsWith('tayar_') || table.key === 'user_roles') issue(`${path}.key`, 'invalid-key', 'Table keys must be unique lower-case identifiers outside reserved namespaces.');
    else tableKeys.add(table.key);
    if (!name(table.name)) issue(`${path}.name`, 'invalid-name', 'A table requires a display name.');
  });
  function access(rule: RecordValue, path: string, allowOwner: boolean) {
    const allowed = allowOwner ? ['public', 'authenticated', 'owner', 'role'] : ['public', 'authenticated', 'role'];
    if (!allowed.includes(String(rule.access))) issue(`${path}.access`, 'invalid-access', 'Unsupported access rule.');
    if (rule.access !== 'public' && !authEnabled) issue(path, 'auth-disabled', 'Authentication is required for this permission.');
    if (rule.access === 'role' && !roleIds.has(String(rule.roleId))) issue(`${path}.roleId`, 'missing-role', 'Select an existing application role.');
    if (rule.access !== 'role' && rule.roleId !== undefined) issue(`${path}.roleId`, 'unexpected-role', 'Role restrictions require role-based access.');
  }
  tables.forEach((table, tableIndex) => {
    if (!object(table)) return;
    const path = `application.tables[${tableIndex}]`;
    const keys = new Set<string>(APPLICATION_SYSTEM_FIELDS);
    list(table.fields, APPLICATION_LIMITS.fields, `${path}.fields`).forEach((field, fieldIndex) => {
      const fieldPath = `${path}.fields[${fieldIndex}]`;
      if (!shape(field, ['id', 'key', 'name', 'type', 'required', 'unique', 'indexed', 'defaultValue', 'options', 'referenceTableId', 'formula'], fieldPath)) return;
      identity(field.id, `${fieldPath}.id`);
      if (!identifier(field.key) || keys.has(field.key)) issue(`${fieldPath}.key`, 'invalid-key', 'Field keys must be unique lower-case identifiers and cannot replace system fields.');
      else keys.add(field.key);
      if (!name(field.name)) issue(`${fieldPath}.name`, 'invalid-name', 'A field requires a display name.');
      if (!['text', 'number', 'boolean', 'date', 'datetime', 'uuid', 'json', 'enum', 'reference'].includes(String(field.type))) issue(`${fieldPath}.type`, 'invalid-type', 'Unsupported field type.');
      if (typeof field.required !== 'boolean' || ['unique', 'indexed'].some(key => field[key] !== undefined && typeof field[key] !== 'boolean')) issue(fieldPath, 'invalid-boolean', 'Field constraint flags must be booleans.');
      if (field.type === 'reference' && !tableIds.has(String(field.referenceTableId))) issue(fieldPath, 'missing-table', 'A relationship requires an existing target table.');
      if (field.type !== 'reference' && field.referenceTableId !== undefined) issue(fieldPath, 'unexpected-reference', 'Only reference fields can target a table.');
      if (field.formula !== undefined) {
        const formulaPath = `${fieldPath}.formula`, formula = field.formula;
        if (!shape(formula, ['operation', 'fieldIds'], formulaPath) || field.type !== 'number' || field.required !== true
          || field.defaultValue !== undefined || !['sum', 'subtract', 'multiply'].includes(String(formula.operation))
          || !Array.isArray(formula.fieldIds) || formula.fieldIds.length < 2 || formula.fieldIds.length > 20
          || formula.operation !== 'sum' && formula.fieldIds.length !== 2 || new Set(formula.fieldIds).size !== formula.fieldIds.length
          || formula.fieldIds.some(sourceId => sourceId === field.id || !(table.fields as unknown[]).some(source => object(source)
            && source.id === sourceId && source.type === 'number' && source.required === true && source.formula === undefined))) {
          issue(formulaPath, 'invalid-formula', 'A formula needs a required numeric result and 2–20 distinct required numeric source fields.');
        }
      }
      if (field.type === 'enum') {
        if (!Array.isArray(field.options) || field.options.length < 1 || field.options.length > 100 || field.options.some(item => typeof item !== 'string' || !item || item.length > 200) || new Set(field.options).size !== field.options.length) issue(fieldPath, 'invalid-options', 'An enum requires 1–100 unique nonempty options.');
      } else if (field.options !== undefined) issue(fieldPath, 'unexpected-options', 'Only enum fields can define options.');
      const def = field.defaultValue;
      if (def !== undefined) {
        const validDefault = def === null ? !field.required
          : field.type === 'number' ? typeof def === 'number' && Number.isFinite(def)
          : field.type === 'boolean' ? typeof def === 'boolean'
          : field.type === 'text' ? typeof def === 'string' && def.length <= 4000
          : field.type === 'enum' ? Array.isArray(field.options) && field.options.includes(def)
          : false;
        if (!validDefault) issue(`${fieldPath}.defaultValue`, 'invalid-default', 'The default must match the field type. Computed, relationship and structured defaults are not accepted.');
      }
    });
    if (table.reports !== undefined) {
      if (!authEnabled || !Array.isArray(table.reports) || !table.reports.length || table.reports.length > 8
        || !Array.isArray(table.permissions) || !table.permissions.some(rule => object(rule) && rule.operation === 'read')) issue(`${path}.reports`, 'invalid-reports', 'Reports require Auth, read permission and 1–8 declarations.');
      else {
        const reportIds = new Set<string>();
        table.reports.forEach((report, index) => {
          const reportPath = `${path}.reports[${index}]`;
          if (!shape(report, ['id', 'name', 'operation', 'fieldId', 'groupByFieldId', 'period'], reportPath)) return;
          const field = Array.isArray(table.fields) && table.fields.find(field => object(field) && field.id === report.fieldId);
          if (!id(report.id) || reportIds.has(String(report.id)) || !name(report.name) || !['count', 'sum', 'min', 'max', 'avg'].includes(String(report.operation))
            || (report.operation === 'count' ? report.fieldId !== undefined : !object(field) || field.type !== 'number')) issue(reportPath, 'invalid-report', 'Reports need unique IDs, a name and an ordinary count or declared numeric field.');
          reportIds.add(String(report.id));
          if (report.groupByFieldId !== undefined) {
            const group = Array.isArray(table.fields) && table.fields.find(field => object(field) && field.id === report.groupByFieldId);
            if (!object(group) || !['text', 'enum', 'boolean', 'uuid', 'reference'].includes(String(group.type)))
              issue(reportPath, 'invalid-report-group', 'Report grouping requires a declared categorical field.');
          }
          if (report.period !== undefined) {
            const period = report.period;
            if (shape(period, ['fieldId', 'unit', 'timeZone', 'offset', 'comparePrevious'], `${reportPath}.period`)) {
              const date = Array.isArray(table.fields) && table.fields.find(field => object(field) && field.id === period.fieldId);
              let zone = false;
              if (typeof period.timeZone === 'string' && period.timeZone.length <= 80 && /^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/.test(period.timeZone)) {
                try { new Intl.DateTimeFormat('en', { timeZone: period.timeZone }).format(0); zone = true; } catch { zone = false; }
              }
              if (!object(date) || !['date', 'datetime'].includes(String(date.type)) || !['day', 'week', 'month', 'year'].includes(String(period.unit))
                || !zone || !Number.isInteger(period.offset) || Number(period.offset) < -120 || Number(period.offset) > 0 || typeof period.comparePrevious !== 'boolean')
                issue(reportPath, 'invalid-report-period', 'Report periods require a date field, valid time zone, calendar unit and offset -120–0.');
            }
          }
        });
      }
    }
    if (table.booking !== undefined) {
      const bookingPath = `${path}.booking`;
      if (shape(table.booking, ['resourceFieldId', 'additionalResourceFieldIds', 'startFieldId', 'endFieldId', 'statusFieldId', 'blockingStatuses', 'waitlistStatus', 'schedule', 'recurrence'], bookingPath)) {
        const rule = table.booking;
        if (rule.recurrence !== undefined && (!validBookingRecurrenceRule(rule.recurrence)
          || (object(rule.schedule) && rule.recurrence.timeZone !== rule.schedule.timeZone)
          || !Array.isArray(table.permissions) || !['read', 'create'].every(operation => (table.permissions as unknown[]).some(permission => object(permission) && permission.operation === operation))))
          issue(`${bookingPath}.recurrence`, 'invalid-booking-recurrence', 'Recurrence requires read/create access, a valid zone matching the schedule and a 2–52 occurrence limit.');
        if (rule.schedule !== undefined && !validApplicationBookingSchedule(rule.schedule)) issue(`${bookingPath}.schedule`, 'invalid-booking-schedule', 'Booking schedule requires a valid time zone, non-overlapping weekly windows and a bounded duration.');
        const fields = Array.isArray(table.fields) ? table.fields.filter(object) : [];
        const find = (fieldId: unknown) => fields.find(field => field.id === fieldId);
        const resource = find(rule.resourceFieldId), start = find(rule.startFieldId), end = find(rule.endFieldId);
        if (rule.waitlistStatus !== undefined) {
          const state = find(rule.statusFieldId);
          if (typeof rule.waitlistStatus !== 'string' || !Array.isArray(state?.options) || !state.options.includes(rule.waitlistStatus)
            || !Array.isArray(rule.blockingStatuses) || rule.blockingStatuses.includes(rule.waitlistStatus)
            || object(table.workflow) && table.workflow.fieldId === rule.statusFieldId)
            issue(bookingPath, 'invalid-waitlist', 'Waiting lists need a declared nonblocking status outside protected workflow fields.');
        }
        if (rule.additionalResourceFieldIds !== undefined) {
          const extras = rule.additionalResourceFieldIds;
          const allocation = Array.isArray(extras) ? [resource, ...extras.map(find)] : [];
          if (!Array.isArray(extras) || !extras.length || extras.length > 4 || new Set([rule.resourceFieldId, ...extras]).size !== extras.length + 1
            || allocation.some(field => !field?.required || field.type !== 'reference')
            || new Set(allocation.map(field => field?.referenceTableId)).size !== allocation.length)
            issue(bookingPath, 'invalid-booking-resources', 'Additional resources require 1–4 distinct required references to separate resource tables.');
        }
        if (!authEnabled || !id(rule.resourceFieldId) || !id(rule.startFieldId) || !id(rule.endFieldId)
          || new Set([rule.resourceFieldId, rule.startFieldId, rule.endFieldId]).size !== 3
          || !resource?.required || !['uuid', 'reference'].includes(String(resource.type))
          || !start?.required || start.type !== 'datetime' || !end?.required || end.type !== 'datetime') {
          issue(bookingPath, 'invalid-booking', 'Booking needs Auth, a required UUID/resource reference and two distinct required datetime fields.');
        }
        if (rule.statusFieldId !== undefined || rule.blockingStatuses !== undefined) {
          const status = find(rule.statusFieldId);
          if (!id(rule.statusFieldId) || !status?.required || status.type !== 'enum'
            || !Array.isArray(rule.blockingStatuses) || !rule.blockingStatuses.length
            || rule.blockingStatuses.length > 100 || new Set(rule.blockingStatuses).size !== rule.blockingStatuses.length
            || rule.blockingStatuses.some(value => typeof value !== 'string' || !Array.isArray(status.options) || !status.options.includes(value))) {
            issue(bookingPath, 'invalid-booking-status', 'Blocking statuses must reference a required enum and declared unique values.');
          }
        }
      }
    }
    if (table.attachments !== undefined) {
      const filePath = `${path}.attachments`, rule = table.attachments;
      if (!shape(rule, ['maxBytes', 'mimeTypes'], filePath) || !authEnabled || !Number.isSafeInteger(rule.maxBytes)
        || Number(rule.maxBytes) < 1 || Number(rule.maxBytes) > APPLICATION_FILE_MAX_BYTES
        || !Array.isArray(rule.mimeTypes) || !rule.mimeTypes.length || rule.mimeTypes.length > APPLICATION_FILE_TYPES.length
        || new Set(rule.mimeTypes).size !== rule.mimeTypes.length
        || rule.mimeTypes.some(type => !APPLICATION_FILE_TYPES.includes(type as typeof APPLICATION_FILE_TYPES[number]))) {
        issue(filePath, 'invalid-files', 'Attachments need Auth, a size limit up to 25 MiB and declared download-safe MIME types.');
      }
      if (!Array.isArray(table.permissions) || !table.permissions.some(rule => object(rule) && rule.operation === 'read')
        || !table.permissions.some(rule => object(rule) && rule.operation === 'update')) issue(filePath, 'files-permissions', 'Attachments require read and update permissions.');
    }
    if (table.counter !== undefined) {
      const counterPath = `${path}.counter`;
      if (shape(table.counter, ['fieldId', 'minimum', 'maximum', 'integer'], counterPath)) {
        const rule = table.counter;
        const field = Array.isArray(table.fields) ? table.fields.find(field => object(field) && field.id === rule.fieldId) : undefined;
        if (!authEnabled || !id(rule.fieldId) || !object(field) || field.type !== 'number' || field.required !== true
          || typeof rule.minimum !== 'number' || !Number.isFinite(rule.minimum) || Math.abs(rule.minimum) > 1e12
          || field.defaultValue !== rule.minimum || typeof rule.integer !== 'boolean'
          || (rule.integer === true && !Number.isSafeInteger(rule.minimum))
          || (rule.maximum !== undefined && (typeof rule.maximum !== 'number' || !Number.isFinite(rule.maximum)
            || rule.maximum < Number(rule.minimum) || Math.abs(rule.maximum) > 1e12 || (rule.integer === true && !Number.isSafeInteger(rule.maximum))))) {
          issue(counterPath, 'invalid-counter', 'A counter needs Auth, a required numeric field defaulting to its finite minimum, and valid optional bounds.');
        }
        if (!Array.isArray(table.permissions) || !table.permissions.some(rule => object(rule) && rule.operation === 'read')
          || !table.permissions.some(rule => object(rule) && rule.operation === 'update')) issue(counterPath, 'counter-permissions', 'Counter adjustment requires explicit read and update permissions.');
      }
    }
    if (table.stockReservations !== undefined) {
      const rulePath = `${path}.stockReservations`, rule = table.stockReservations;
      const ownerOnly = Array.isArray(table.permissions)
        && (['read', 'update'] as const).every(operation =>
          table.permissions.some(candidate => object(candidate) && candidate.operation === operation && candidate.access === 'owner'))
        && !table.permissions.some(candidate => object(candidate)
          && ['read', 'update'].includes(String(candidate.operation)) && candidate.access !== 'owner');
      if (!shape(rule, ['mode'], rulePath) || rule.mode !== 'owner' || !authEnabled
        || !object(table.counter) || table.counter.integer !== true || table.counter.minimum !== 0
        || !ownerOnly) issue(rulePath, 'invalid-stock-reservations',
          'Stock reservation SQL requires an authenticated owner-only nonnegative integer counter.');
    }
    if (table.transaction !== undefined) {
      const transactionPath = `${path}.transaction`;
      if (shape(table.transaction, ['itemTableId', 'lineTableId', 'lineTransactionFieldId', 'lineItemFieldId', 'lineQuantityFieldId', 'counterDirection'], transactionPath)) {
        const rule = table.transaction;
        const itemTable = tables.find(candidate => object(candidate) && candidate.id === rule.itemTableId);
        const lineTable = tables.find(candidate => object(candidate) && candidate.id === rule.lineTableId);
        const lineFields = object(lineTable) && Array.isArray(lineTable.fields) ? lineTable.fields.filter(object) : [];
        const transactionField = lineFields.find(field => field.id === rule.lineTransactionFieldId);
        const itemField = lineFields.find(field => field.id === rule.lineItemFieldId);
        const quantityField = lineFields.find(field => field.id === rule.lineQuantityFieldId);
        const distinct = new Set([rule.lineTransactionFieldId, rule.lineItemFieldId, rule.lineQuantityFieldId]);
        if (!authEnabled || !id(rule.itemTableId) || !id(rule.lineTableId) || rule.itemTableId === table.id || rule.lineTableId === table.id
          || rule.itemTableId === rule.lineTableId || !object(itemTable) || !object(itemTable.counter) || !object(lineTable)
          || distinct.size !== 3 || !id(rule.lineTransactionFieldId) || !id(rule.lineItemFieldId) || !id(rule.lineQuantityFieldId)
          || transactionField?.type !== 'reference' || transactionField.required !== true || transactionField.referenceTableId !== table.id
          || itemField?.type !== 'reference' || itemField.required !== true || itemField.referenceTableId !== rule.itemTableId
          || quantityField?.type !== 'number' || quantityField.required !== true || quantityField.formula !== undefined
          || !['decrement', 'increment'].includes(String(rule.counterDirection)) || table.booking !== undefined || table.counter !== undefined) {
          issue(transactionPath, 'invalid-transaction', 'A transaction needs Auth, a counter item table and a separate line table with required parent, item and numeric quantity fields.');
        }
        const has = (candidate: unknown, operation: string) => object(candidate)
          && Array.isArray(candidate.permissions) && candidate.permissions.some(permission => object(permission) && permission.operation === operation);
        if (!has(table, 'read') || !has(table, 'create') || !has(itemTable, 'read') || !has(itemTable, 'update') || !has(lineTable, 'read')
          || (object(lineTable) && Array.isArray(lineTable.permissions) && lineTable.permissions.some(permission => object(permission) && permission.operation !== 'read'))) {
          issue(transactionPath, 'transaction-permissions', 'Transactions require parent read/create, item read/update and read-only line permissions.');
        }
      }
    }
    if(table.payment!==undefined){
      const paymentPath=`${path}.payment`,rule=table.payment;
      if(shape(rule,['provider','currency','itemUnitAmountFieldId','refundRoleId'],paymentPath)){
        const transaction=object(table.transaction)?table.transaction:null;
        const itemTable=transaction?tables.find(candidate=>object(candidate)&&candidate.id===transaction.itemTableId):null;
        const amountField=object(itemTable)&&Array.isArray(itemTable.fields)
          ?itemTable.fields.find(field=>object(field)&&field.id===rule.itemUnitAmountFieldId):null;
        if(rule.provider!=='stripe'||!transaction||typeof rule.currency!=='string'||!/^[a-z]{3}$/.test(rule.currency)
          ||!id(rule.itemUnitAmountFieldId)||!object(amountField)||amountField.type!=='number'||amountField.required!==true
          ||amountField.formula!==undefined||amountField.id===(object(itemTable)&&object(itemTable.counter)?itemTable.counter.fieldId:null)
          ||transaction.counterDirection!=='decrement'||!authEnabled||!object(auth)||auth.emailVerificationRequired!==true
          ||!id(rule.refundRoleId)||!roleIds.has(String(rule.refundRoleId))){
          issue(paymentPath,'invalid-payment','Stripe payment needs a transaction, a required ordinary item price in minor units, a currency and a declared refund role.');
        }
      }
    }
    if (table.workflow !== undefined) {
      const workflowPath = `${path}.workflow`;
      if (shape(table.workflow, ['fieldId', 'transitions'], workflowPath)) {
        const workflow = table.workflow;
        const field = Array.isArray(table.fields) ? table.fields.find(candidate => object(candidate) && candidate.id === workflow.fieldId) : undefined;
        const options = object(field) && Array.isArray(field.options) ? field.options.filter(value => typeof value === 'string') : [];
        if (!authEnabled || !id(workflow.fieldId) || !object(field) || field.type !== 'enum' || field.required !== true
          || typeof field.defaultValue !== 'string' || !options.includes(field.defaultValue)) {
          issue(workflowPath, 'invalid-workflow', 'A workflow needs Auth and a required enum state field with a declared default state.');
        }
        const transitionIds = new Set<string>();
        const transitions = list(workflow.transitions, 100, `${workflowPath}.transitions`);
        if (!transitions.length) issue(`${workflowPath}.transitions`, 'missing-transitions', 'A workflow needs at least one transition.');
        transitions.forEach((transition, transitionIndex) => {
          const transitionPath = `${workflowPath}.transitions[${transitionIndex}]`;
          if (!shape(transition, ['id', 'label', 'from', 'to', 'access', 'roleId', 'conditionMode', 'conditions', 'effects'], transitionPath)) return;
          if (!id(transition.id) || transitionIds.has(String(transition.id))) issue(`${transitionPath}.id`, 'invalid-id', 'Workflow transition IDs must be valid and unique.');
          else transitionIds.add(String(transition.id));
          if (!name(transition.label)) issue(`${transitionPath}.label`, 'invalid-name', 'A workflow transition requires a label.');
          if (!Array.isArray(transition.from) || !transition.from.length || transition.from.length > 100
            || new Set(transition.from).size !== transition.from.length || transition.from.some(value => typeof value !== 'string' || !options.includes(value))) {
            issue(`${transitionPath}.from`, 'invalid-workflow-state', 'Workflow source states must be unique declared enum options.');
          }
          if (typeof transition.to !== 'string' || !options.includes(transition.to) || (Array.isArray(transition.from) && transition.from.includes(transition.to))) {
            issue(`${transitionPath}.to`, 'invalid-workflow-state', 'Workflow destination must be a different declared enum option.');
          }
          if (!['authenticated', 'owner', 'role'].includes(String(transition.access))) issue(`${transitionPath}.access`, 'invalid-access', 'Workflow transitions require authenticated, owner or role access.');
          if (transition.access === 'role' && !roleIds.has(String(transition.roleId))) issue(`${transitionPath}.roleId`, 'missing-role', 'Role workflow access requires an existing role.');
          if (transition.access !== 'role' && transition.roleId !== undefined) issue(`${transitionPath}.roleId`, 'unexpected-role', 'Only role transitions can specify a role.');
          if (transition.conditionMode !== undefined && !['all', 'any'].includes(String(transition.conditionMode))) issue(`${transitionPath}.conditionMode`, 'invalid-condition-mode', 'Workflow predicates must use all or any matching.');
          if (transition.conditionMode !== undefined && transition.conditions === undefined) issue(`${transitionPath}.conditionMode`, 'unexpected-condition-mode', 'A condition mode requires at least one predicate.');
          if (transition.conditions !== undefined) {
            const conditionKeys = new Set<string>();
            const conditions = list(transition.conditions, 10, `${transitionPath}.conditions`);
            if (!conditions.length) issue(`${transitionPath}.conditions`, 'empty-conditions', 'Workflow conditions must contain at least one predicate.');
            conditions.forEach((condition, conditionIndex) => {
              const conditionPath = `${transitionPath}.conditions[${conditionIndex}]`;
              if (!object(condition)) { issue(conditionPath, 'invalid-condition', 'Expected a workflow condition object.'); return; }
              const noValue = condition.operator === 'is-null' || condition.operator === 'not-null';
              const allowed = noValue ? ['fieldId', 'operator'] : ['fieldId', 'operator', 'value'];
              if (Object.keys(condition).some(key => !allowed.includes(key))) issue(conditionPath, 'unknown-property', 'Unsupported workflow condition property.');
              const conditionField = Array.isArray(table.fields) ? table.fields.find(candidate => object(candidate) && candidate.id === condition.fieldId) : undefined;
              const operator = String(condition.operator);
              const conditionKey = JSON.stringify(condition);
              if (!id(condition.fieldId) || conditionKeys.has(conditionKey) || !object(conditionField)
                || conditionField.id === workflow.fieldId || conditionField.formula !== undefined) {
                issue(conditionPath, 'invalid-condition-field', 'Conditions require valid ordinary fields and unique predicates.');
                return;
              }
              conditionKeys.add(conditionKey);
              if (noValue) {
                if (conditionField.required === true && operator === 'is-null') issue(conditionPath, 'required-null-condition', 'A required field cannot use an is-null condition.');
                return;
              }
              if (!['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(operator)
                || !Object.prototype.hasOwnProperty.call(condition, 'value')) {
                issue(conditionPath, 'invalid-condition-operator', 'Conditions require a supported comparison and a typed value.');
                return;
              }
              const conditionValue = condition.value;
              const comparable = ['number', 'text', 'date', 'datetime'].includes(String(conditionField.type));
              if (['gt', 'gte', 'lt', 'lte'].includes(operator) && !comparable) {
                issue(conditionPath, 'unordered-condition-field', 'Ordered comparisons require a number, text, date or datetime field.');
                return;
              }
              const valid = conditionValue === null ? conditionField.required !== true && ['eq', 'neq'].includes(operator)
                : conditionField.type === 'number' ? typeof conditionValue === 'number' && Number.isFinite(conditionValue)
                : conditionField.type === 'boolean' ? typeof conditionValue === 'boolean'
                : conditionField.type === 'text' ? typeof conditionValue === 'string' && conditionValue.length <= 4000
                : conditionField.type === 'enum' ? typeof conditionValue === 'string' && Array.isArray(conditionField.options) && conditionField.options.includes(conditionValue)
                : conditionField.type === 'date' ? isoDate(conditionValue)
                : conditionField.type === 'datetime' ? typeof conditionValue === 'string' && Number.isFinite(Date.parse(conditionValue))
                : ['uuid', 'reference'].includes(String(conditionField.type)) ? typeof conditionValue === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conditionValue)
                : false;
              if (!valid) issue(conditionPath, 'invalid-condition-value', 'Condition values must match their field type and be bounded.');
            });
          }
          if (transition.effects !== undefined) {
            const effectFields = new Set<string>();
            const relatedTargetTables = new Set<string>();
            const effects = list(transition.effects, 20, `${transitionPath}.effects`);
            if (!effects.length) issue(`${transitionPath}.effects`, 'missing-effects', 'Workflow effects must contain at least one bounded change.');
            effects.forEach((effect, effectIndex) => {
              const effectPath = `${transitionPath}.effects[${effectIndex}]`;
              if (!object(effect)) { issue(effectPath, 'invalid-object', 'Expected a workflow effect object.'); return; }
              const related = effect.operation === 'related';
              const change = related && object(effect.change) ? effect.change : effect;
              const allowed = related ? ['operation', 'referenceFieldId', 'fieldId', 'change']
                : effect.operation === 'set' ? ['operation', 'fieldId', 'value']
                  : effect.operation === 'increment' ? ['operation', 'fieldId', 'amount'] : ['operation', 'fieldId'];
              if (Object.keys(effect).some(key => !allowed.includes(key))) issue(effectPath, 'unknown-property', 'Unsupported workflow effect property.');
              if (related && (!object(effect.change) || Object.keys(effect.change).some(key => !['operation', 'value', 'amount'].includes(key)))) issue(`${effectPath}.change`, 'invalid-related-change', 'A related effect needs one bounded set, increment or timestamp change.');
              const referenceField = related && Array.isArray(table.fields) ? table.fields.find(candidate => object(candidate) && candidate.id === effect.referenceFieldId) : undefined;
              const targetTable = related && object(referenceField) && referenceField.type === 'reference' && Array.isArray(value.tables)
                ? value.tables.find(candidate => object(candidate) && candidate.id === referenceField.referenceTableId) : undefined;
              if (related && object(targetTable)) {
                if (relatedTargetTables.has(String(targetTable.id))) issue(effectPath, 'duplicate-related-table', 'A transition can update one row per related table.');
                else if (relatedTargetTables.size >= 4) issue(effectPath, 'too-many-related-effects', 'A transition can update at most four related tables atomically.');
                else relatedTargetTables.add(String(targetTable.id));
              }
              const effectField = related && object(targetTable) && Array.isArray(targetTable.fields)
                ? targetTable.fields.find(candidate => object(candidate) && candidate.id === effect.fieldId)
                : Array.isArray(table.fields) ? table.fields.find(candidate => object(candidate) && candidate.id === effect.fieldId) : undefined;
              const fieldKey = `${related ? String(referenceField?.id ?? 'invalid') : table.id}:${String(effect.fieldId)}`;
              if (related && (effectFields.has(fieldKey) || !object(referenceField) || referenceField.type !== 'reference' || referenceField.required !== true
                || !object(targetTable) || targetTable.id === table.id
                || !Array.isArray(targetTable.permissions) || !targetTable.permissions.some(rule => object(rule) && rule.operation === 'read')
                || !targetTable.permissions.some(rule => object(rule) && rule.operation === 'update'))) {
                issue(effectPath, 'invalid-related-target', 'Related effects require one required reference to another table with declared read and update permissions.');
              }
              const operation = String(change.operation);
              if ((!related && !['set', 'increment', 'timestamp'].includes(operation)) || (related && !['set', 'increment', 'timestamp'].includes(operation))
                || !id(effect.fieldId) || effectFields.has(fieldKey)
                || !object(effectField) || effectField.id === workflow.fieldId || effectField.formula !== undefined
                || object(related ? targetTable : table) && object((related ? targetTable : table).counter) && effectField.id === (related ? targetTable : table).counter.fieldId
                || object(related ? targetTable : table) && object((related ? targetTable : table).workflow) && effectField.id === (related ? targetTable : table).workflow.fieldId) {
                issue(effectPath, 'invalid-effect-field', 'Effects require distinct ordinary fields outside workflow, formula and protected counter fields.');
                return;
              }
              effectFields.add(fieldKey);
              if (operation === 'increment') {
                if (effectField.type !== 'number' || effectField.required !== true || typeof change.amount !== 'number'
                  || !Number.isFinite(change.amount) || change.amount === 0 || Math.abs(change.amount) > 1_000_000_000_000) {
                  issue(effectPath, 'invalid-increment-effect', 'Increment effects require a required number field and a finite nonzero bounded amount.');
                }
              } else if (operation === 'timestamp') {
                if (effectField.type !== 'datetime') issue(effectPath, 'invalid-timestamp-effect', 'Timestamp effects require a datetime field.');
              } else if (operation === 'set') {
                const effectValue = change.value;
                const valid = effectValue === null ? effectField.required !== true
                  : effectField.type === 'number' ? typeof effectValue === 'number' && Number.isFinite(effectValue)
                  : effectField.type === 'boolean' ? typeof effectValue === 'boolean'
                  : effectField.type === 'text' ? typeof effectValue === 'string' && effectValue.length <= 4000
                  : effectField.type === 'enum' ? typeof effectValue === 'string' && Array.isArray(effectField.options) && effectField.options.includes(effectValue)
                  : effectField.type === 'date' ? typeof effectValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(effectValue)
                  : effectField.type === 'datetime' ? typeof effectValue === 'string' && Number.isFinite(Date.parse(effectValue))
                  : ['uuid', 'reference'].includes(String(effectField.type)) ? typeof effectValue === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(effectValue)
                  : false;
                if (!valid) issue(effectPath, 'invalid-set-effect', 'Set effects require a bounded literal matching the declared field type.');
              }
            });
          }
        });
        if (!Array.isArray(table.permissions) || !table.permissions.some(rule => object(rule) && rule.operation === 'read')
          || !table.permissions.some(rule => object(rule) && rule.operation === 'update')) issue(workflowPath, 'workflow-permissions', 'Workflow transitions require explicit read and update permissions.');
      }
    }
    const permissionKeys = new Set<string>();
    list(table.permissions, APPLICATION_LIMITS.permissions, `${path}.permissions`).forEach((permission, index) => {
      const permissionPath = `${path}.permissions[${index}]`;
      if (!shape(permission, ['operation', 'access', 'roleId'], permissionPath)) return;
      if (!['read', 'create', 'update', 'delete'].includes(String(permission.operation))) issue(permissionPath, 'invalid-operation', 'Unsupported database operation.');
      access(permission, permissionPath, true);
      if (permission.access === 'public' && permission.operation !== 'read') issue(permissionPath, 'public-write', 'Anonymous database writes require a validated server action.');
      const key = `${permission.operation}:${permission.access}:${permission.roleId ?? ''}`;
      if (permissionKeys.has(key)) issue(permissionPath, 'duplicate-permission', 'Duplicate permission rule.');
      permissionKeys.add(key);
    });
    if (Array.isArray(table.permissions) && table.permissions.some(p => object(p) && ['update', 'delete'].includes(String(p.operation))) && !table.permissions.some(p => object(p) && p.operation === 'read')) issue(`${path}.permissions`, 'read-required', 'Update and delete require a read policy.');
  });
  let notificationCount = 0;
  tables.forEach((table, index) => {
    if (!object(table) || table.notifications === undefined) return;
    const path = `application.tables[${index}]`, rulePath = `${path}.notifications`;
    const rules = list(table.notifications, 50, rulePath);
    notificationCount += rules.length;
    if (!authEnabled || !object(auth) || auth.emailVerificationRequired !== true) issue(rulePath, 'email-auth-required', 'Email notifications require authentication and verified email addresses.');
    // Invalid table fields/workflows must remain ordinary validation issues,
    // rather than throwing while inspecting an untrusted configuration.
    const validTable = !issues.some(item => item.path === path || item.path.startsWith(`${path}.`));
    rules.forEach((rule, ruleIndex) => {
      const itemPath = `${rulePath}[${ruleIndex}]`;
      if (object(rule)) identity(rule.id, `${itemPath}.id`);
      if (validTable) {
        const error = validateApplicationEmailNotification(rule, table as unknown as ApplicationTable);
        if (error) issue(itemPath, 'invalid-email-notification', error);
      }
    });
  });
  if (notificationCount > 50) issue('application.tables', 'too-many-email-notifications', 'An application supports at most 50 email notification rules.');
  const lineTables = new Set<string>();
  tables.forEach((table, index) => {
    if (!object(table) || !object(table.transaction)) return;
    const line = String(table.transaction.lineTableId);
    if (lineTables.has(line)) issue(`application.tables[${index}].transaction.lineTableId`, 'duplicate-transaction-line-table', 'A line table can belong to only one native transaction.');
    lineTables.add(line);
  });
  const protectedPages = new Set<string>();
  list(value.pageAccess, APPLICATION_LIMITS.pageAccess, 'application.pageAccess').forEach((rule, index) => {
    const path = `application.pageAccess[${index}]`;
    if (!shape(rule, ['pageId', 'access', 'roleId'], path)) return;
    if (!id(rule.pageId) || protectedPages.has(rule.pageId) || (pageIds && !pageIds.has(rule.pageId))) issue(path, 'invalid-page', 'Access rules require a unique existing page.');
    else protectedPages.add(rule.pageId);
    access(rule, path, false);
  });
  if (value.requirements !== undefined && shape(value.requirements, ['version', 'request', 'items', 'specification'], 'application.requirements')) {
    const manifest = value.requirements;
    if (manifest.version !== 1) issue('application.requirements.version', 'unsupported-version', 'Unsupported requirements manifest version.');
    if (typeof manifest.request !== 'string' || !manifest.request.trim() || manifest.request.length > 4000) issue('application.requirements.request', 'invalid-request', 'Requirements need the original nonempty request.');
    const requirementIds = new Set<string>();
    const capabilities = new Set(['page', 'auth', 'form', 'records', 'booking', 'counter', 'transaction', 'workflow', 'formula', 'files', 'payment', 'email', 'reports']);
    list(manifest.items, APPLICATION_LIMITS.requirements, 'application.requirements.items').forEach((item, index) => {
      const path = `application.requirements.items[${index}]`;
      if (!shape(item, ['id', 'summary', 'capability', 'evidence'], path)) return;
      if (!id(item.id) || requirementIds.has(String(item.id))) issue(`${path}.id`, 'invalid-id', 'Requirement IDs must be valid and unique.');
      else requirementIds.add(String(item.id));
      if (typeof item.summary !== 'string' || !item.summary.trim() || item.summary.length > 300) issue(`${path}.summary`, 'invalid-summary', 'A requirement needs a concise summary.');
      if (!capabilities.has(String(item.capability))) issue(`${path}.capability`, 'invalid-capability', 'Unsupported requirement capability.');
      const evidence = list(item.evidence, APPLICATION_LIMITS.requirementEvidence, `${path}.evidence`);
      if (!evidence.length) issue(`${path}.evidence`, 'missing-evidence', 'A completed requirement needs verified implementation evidence.');
      evidence.forEach((entry, evidenceIndex) => {
        const evidencePath = `${path}.evidence[${evidenceIndex}]`;
        if (typeof entry !== 'string' || entry.length > 260) { issue(evidencePath, 'invalid-evidence', 'Invalid requirement evidence.'); return; }
        if (entry === 'auth') { if (!authEnabled) issue(evidencePath, 'missing-auth', 'Auth evidence requires enabled authentication.'); return; }
        const match = /^(page|form|view|booking|counter|transaction|workflow|formula|files|payment|email|reports):([a-zA-Z0-9_-]{1,120})(?::(read|create|update|delete|adjust|transact|transition|attachments|pay|refund))?$/.exec(entry);
        if (!match) { issue(evidencePath, 'invalid-evidence', 'Evidence must reference a supported page, table or action.'); return; }
        if (match[1] === 'page') { if (match[3] || (pageIds && !pageIds.has(match[2]))) issue(evidencePath, 'missing-page', 'Page evidence requires an existing page.'); return; }
        const table = tables.find(candidate => object(candidate) && candidate.id === match[2]);
        if (!object(table)) { issue(evidencePath, 'missing-table', 'Requirement evidence requires an existing table.'); return; }
        if (match[1] === 'booking' && !object(table.booking)) issue(evidencePath, 'missing-booking', 'Booking evidence requires a native booking rule.');
        if (match[1] === 'counter' && !object(table.counter)) issue(evidencePath, 'missing-counter', 'Counter evidence requires a native counter rule.');
        if (match[1] === 'transaction' && !object(table.transaction)) issue(evidencePath, 'missing-transaction', 'Transaction evidence requires a native transaction rule.');
        if (match[1] === 'files' && !object(table.attachments)) issue(evidencePath, 'missing-files', 'Files evidence requires an attachment rule.');
        if (match[1] === 'workflow' && !object(table.workflow)) issue(evidencePath, 'missing-workflow', 'Workflow evidence requires a native workflow rule.');
        if (match[1] === 'formula' && !(table.fields as unknown[]).some(field => object(field) && object(field.formula))) issue(evidencePath, 'missing-formula', 'Formula evidence requires a server-computed field.');
        if (match[1] === 'payment' && !object(table.payment)) issue(evidencePath, 'missing-payment', 'Payment evidence requires a native payment rule.');
        if (match[1] === 'email' && (!Array.isArray(table.notifications) || !table.notifications.length)) issue(evidencePath, 'missing-email', 'Email evidence requires a declared notification rule.');
        if (match[1] === 'reports' && (!Array.isArray(table.reports) || !table.reports.length)) issue(evidencePath, 'missing-reports', 'Report evidence requires a declared aggregate report.');
        if (match[1] === 'view' && !match[3]) issue(evidencePath, 'missing-action', 'Data-view evidence requires an action.');
        if (match[1] !== 'view' && match[3]) issue(evidencePath, 'unexpected-action', 'Only data-view evidence can include an action.');
      });
    });
    if (!Array.isArray(manifest.items) || !manifest.items.length) issue('application.requirements.items', 'missing-requirements', 'An application requirements manifest cannot be empty.');
    if (manifest.specification !== undefined) for (const message of projectSpecificationIssues(manifest.specification, value as unknown as ApplicationDefinition)) {
      issue('application.requirements.specification', 'invalid-specification', message);
    }
  }
  return issues;
}

/** Reject unsupported data instead of silently resetting an application's security configuration. */
export function readApplicationDefinition(value: unknown, pageIds?: ReadonlySet<string>): ApplicationDefinition {
  if (value === undefined) return createApplicationDefinition();
  const issues = validateApplicationDefinition(value, pageIds);
  if (issues.length) throw new Error(issues.map(item => `${item.path}: ${item.message}`).join('\n'));
  return structuredClone(value as ApplicationDefinition);
}
