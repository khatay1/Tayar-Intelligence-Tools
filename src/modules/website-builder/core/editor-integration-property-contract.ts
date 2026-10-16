/**
 * Editor-only property contracts inspired by the MIT Activepieces action
 * metadata approach (activepieces/activepieces, framework property schemas,
 * reviewed at 82300fe8029390e614f63eeac079ccc6db60eba6).
 *
 * Original Tayar implementation. No Activepieces code, dependencies,
 * credentials or execution engine are embedded here.
 *
 * This is an editor preflight, NOT an outbound server authorization gate:
 * deployed integrations need their own trusted server-side validation.
 */
export interface EditorPropertyContract {
  key: string;
  label: string;
  type: 'text' | 'url' | 'secret' | 'select' | 'boolean';
  required?: boolean;
  secret?: boolean;
  options?: ReadonlyArray<{ value: string }>;
}

export interface EditorPropertyContractIssue {
  field: string;
  code: 'invalid-config';
  message: string;
}

export function validateEditorPropertyValues(
  fields: ReadonlyArray<EditorPropertyContract>,
  config: unknown,
): EditorPropertyContractIssue[] {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return [{ field: '*', code: 'invalid-config', message: 'Integration property values are unavailable.' }];
  }
  const values = config as Record<string, unknown>;
  const result: EditorPropertyContractIssue[] = [];
  for (const field of fields) {
    if (field.secret || field.type === 'url') continue;
    const value = Object.hasOwn(values, field.key) ? values[field.key] : undefined;
    if (value === undefined || value === '') continue; // Required checks are elsewhere.
    const invalid = field.type === 'boolean'
      ? typeof value !== 'boolean'
      : field.type === 'select'
        ? typeof value !== 'string' || value.length > 200
          || !Array.isArray(field.options) || !field.options.some(option => option.value === value)
        : typeof value !== 'string' || value.length > 5000
          || (field.required === true && !value.trim());
    if (invalid) result.push({
      field: field.key, code: 'invalid-config',
      message: `${field.label} has an invalid declared field value.`,
    });
  }
  return result;
}
