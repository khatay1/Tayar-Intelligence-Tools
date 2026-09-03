import { useLocalizer } from '@/lib/ui-localization';
import { useState, type ChangeEvent } from 'react';

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

function fieldValue(
  value: unknown,
) {
  return value === undefined ||
    value === null
    ? ''
    : String(value);
}

function validColorValue(
  value: unknown,
) {
  const normalized =
    fieldValue(value);

  return /^#[0-9a-f]{6}$/i.test(
    normalized,
  )
    ? normalized
    : '#000000';
}

function renderFieldControl(
  field: EditorInspectorField,
  onChange:
    BuilderInspectorFieldsProps['onChange'],
  l: (text: string) => string,
) {
  if (field.kind === 'toggle') {
    return (
      <input
        type="checkbox"
        checked={
          Boolean(field.value)
        }
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(
            field.key,
            event.currentTarget.checked,
          )
        }
      />
    );
  }

  if (field.kind === 'select') {
    return (
      <select
        value={
          fieldValue(
            field.value,
          )
        }
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange(
            field.key,
            event.currentTarget.value,
          )
        }
      >
        {(field.options || []).map(
          (option) => (
            <option
              key={
                option || '__default'
              }
              value={option}
            >
              {option ? l(option) : l('Default')}
            </option>
          ),
        )}
      </select>
    );
  }

  if (field.kind === 'textarea') {
    return (
      <textarea
        rows={4}
        value={
          fieldValue(
            field.value,
          )
        }
        placeholder={
          field.placeholder ? l(field.placeholder) : undefined
        }
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
          onChange(
            field.key,
            event.currentTarget.value,
          )
        }
      />
    );
  }

  if (field.kind === 'color') {
    return (
      <div className="tayar-v2-color-control">
        <input
          type="color"
          value={
            validColorValue(
              field.value,
            )
          }
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange(
              field.key,
              event.currentTarget.value,
            )
          }
          aria-label={
            `${l(field.label)} ${l('color picker')}`
          }
        />

        <input
          type="text"
          value={
            fieldValue(
              field.value,
            )
          }
          placeholder={
            field.placeholder ? l(field.placeholder) : '#000000 or transparent'
          }
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange(
              field.key,
              event.currentTarget.value,
            )
          }
        />
      </div>
    );
  }

  return (
    <input
      type={
        field.kind === 'number'
          ? 'number'
          : 'text'
      }
      value={
        fieldValue(
          field.value,
        )
      }
      min={field.min}
      max={field.max}
      step={field.step}
      placeholder={
        field.placeholder ? l(field.placeholder) : undefined
      }
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        const raw =
          event.currentTarget.value;

        onChange(
          field.key,
          field.kind === 'number'
            ? raw === ''
              ? undefined
              : Number(raw)
            : raw,
        );
      }}
    />
  );
}

export function BuilderInspectorFields({
  fields,
  group,
  onChange,
}: BuilderInspectorFieldsProps) {
  const l = useLocalizer();
  const [openSections, setOpenSections] =
    useState<Record<string, boolean>>({});

  const visible =
    fields.filter(
      (field) =>
        field.group === group,
    );

  if (!visible.length) {
    return (
      <div className="tayar-v2-empty-panel">
        {l('No controls for this selection.')}
      </div>
    );
  }

  const sections =
    visible.reduce<
      Array<{
        name: string;
        fields: EditorInspectorField[];
      }>
    >(
      (result, field) => {
        const name =
          field.section ||
          'General';

        const existing =
          result.find(
            (entry) =>
              entry.name === name,
          );

        if (existing) {
          existing.fields.push(field);
        } else {
          result.push({
            name,
            fields: [field],
          });
        }

        return result;
      },
      [],
    );

  return (
    <div
      className="tayar-v2-inspector-fields"
      data-group={group}
    >
      {sections.map(
        (section, index) => (
          <details
            className="tayar-v2-inspector-section"
            key={section.name}
            open={
              openSections[section.name] ??
              index === 0
            }
            onToggle={(event) => {
              const nextOpen =
                event.currentTarget.open;

              setOpenSections(
                (current) =>
                  current[section.name] ===
                  nextOpen
                    ? current
                    : {
                        ...current,
                        [section.name]:
                          nextOpen,
                      },
              );
            }}
          >
            <summary>
              <span>
                {l(section.name)}
              </span>

              <small>
                {section.fields.length}
              </small>
            </summary>

            <div className="tayar-v2-inspector-section__fields">
              {section.fields.map(
                (field) => (
                  <label
                    className="tayar-v2-inspector-field"
                    data-kind={field.kind}
                    key={field.key}
                  >
                    <span>
                      {l(field.label)}
                    </span>

                    {renderFieldControl(
                      field,
                      onChange,
                      l,
                    )}
                  </label>
                ),
              )}
            </div>
          </details>
        ),
      )}
    </div>
  );
}
