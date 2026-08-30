import type {
  EditorInspectorField,
} from '../core/editor-inspector-model';

export interface BuilderInspectorFieldsProps {
  fields: EditorInspectorField[];
  group:
    EditorInspectorField['group'];

  onChange(
    key: string,
    value: unknown,
  ): void;
}

export function BuilderInspectorFields({
  fields,
  group,
  onChange,
}: BuilderInspectorFieldsProps) {
  const visible =
    fields.filter(
      (field) =>
        field.group === group,
    );

  if (!visible.length) {
    return (
      <div className="tayar-v2-empty-panel">
        —
      </div>
    );
  }

  return (
    <div
      className="tayar-v2-inspector-fields"
      data-group={group}
    >
      {visible.map((field) => (
        <label
          className="tayar-v2-inspector-field"
          key={field.key}
        >
          <span>
            {field.label}
          </span>

          {field.kind === 'toggle' ? (
            <input
              type="checkbox"
              checked={
                Boolean(field.value)
              }
              onChange={(event: any) =>
                onChange(
                  field.key,
                  event.currentTarget.checked,
                )
              }
            />
          ) : field.kind === 'select' ? (
            <select
              value={
                String(
                  field.value ?? '',
                )
              }
              onChange={(event: any) =>
                onChange(
                  field.key,
                  event.currentTarget.value,
                )
              }
            >
              {(field.options || []).map(
                (option) => (
                  <option
                    key={option}
                    value={option}
                  >
                    {option}
                  </option>
                ),
              )}
            </select>
          ) : (
            <input
              type={
                field.kind === 'number'
                  ? 'number'
                  : field.kind === 'color'
                    ? 'color'
                    : 'text'
              }
              value={
                String(
                  field.value ?? '',
                )
              }
              onChange={(event: any) =>
                onChange(
                  field.key,
                  field.kind === 'number'
                    ? Number(
                        event.currentTarget.value,
                      )
                    : event.currentTarget.value,
                )
              }
            />
          )}
        </label>
      ))}
    </div>
  );
}
