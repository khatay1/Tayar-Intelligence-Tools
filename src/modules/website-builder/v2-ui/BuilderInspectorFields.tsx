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

  disabled?: boolean;
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
  disabled: boolean,
) {
  if (field.kind === 'toggle') {
    return (
      <input
        type="checkbox"
        aria-label={l(field.label)}
        disabled={disabled}
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
        aria-label={l(field.label)}
        disabled={disabled}
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
        aria-label={l(field.label)}
        rows={4}
        disabled={disabled}
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
          disabled={disabled}
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
          disabled={disabled}
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

  if (field.kind === 'number') {
    const hasValue = field.value !== '' && field.value !== undefined && field.value !== null;
    const numeric = hasValue ? Number(field.value) : Number.NaN;
    const fallback = Number(field.inheritedValue);
    const current = Number.isFinite(numeric) ? numeric : Number.isFinite(fallback) ? fallback : 0;
    const baseStep = field.step || 1;
    const adjust = (direction: -1 | 1, precise: boolean) => {
      const step = precise ? baseStep / 10 : baseStep;
      const candidate = current + direction * step;
      const bounded = Math.min(field.max ?? candidate, Math.max(field.min ?? candidate, candidate));
      onChange(field.key, Number(bounded.toFixed(4)));
    };
    return (
      <div className="tayar-v2-number-control">
        <button type="button" disabled={disabled} aria-label={`${l('Decrease')} ${l(field.label)}`} title={l('Hold Alt for precision')} onClick={(event) => adjust(-1, event.altKey)}>−</button>
        <input
          aria-label={l(field.label)}
          disabled={disabled}
          type="number"
          value={fieldValue(field.value)}
          min={field.min}
          max={field.max}
          step={field.step}
          placeholder={field.value === '' || field.value === undefined
            ? field.inheritedValue === undefined ? field.placeholder ? l(field.placeholder) : undefined : `${l('Inherited')}: ${field.inheritedValue}`
            : undefined}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            const raw = event.currentTarget.value;
            onChange(field.key, raw === '' ? undefined : Number(raw));
          }}
        />
        <span aria-hidden="true">{field.unit || ''}</span>
        <button type="button" disabled={disabled} aria-label={`${l('Increase')} ${l(field.label)}`} title={l('Hold Alt for precision')} onClick={(event) => adjust(1, event.altKey)}>+</button>
        {field.overridden && (
          <button type="button" className="tayar-v2-number-control__reset" disabled={disabled} onClick={() => onChange(field.key, undefined)} title={l('Reset to inherited value')} aria-label={`${l('Reset')} ${l(field.label)}`}>↺</button>
        )}
      </div>
    );
  }

  return (
    <input
      aria-label={l(field.label)}
      disabled={disabled}
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
  disabled = false,
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
      aria-busy={disabled}
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
                  <div
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
                      disabled,
                    )}
                    {field.inheritedValue !== undefined && !field.overridden && field.kind !== 'number' && (
                      <small className="tayar-v2-inherited-hint">
                        {l('Inherited')}: {String(field.inheritedValue)}
                      </small>
                    )}
                    {field.kind !== 'number' && field.overridden && (
                      <button type="button" className="tayar-v2-field-reset" disabled={disabled} onClick={() => onChange(field.key, undefined)} title={l('Reset to inherited value')}>
                        {l('Reset')}
                      </button>
                    )}
                  </div>
                ),
              )}
            </div>
          </details>
        ),
      )}
    </div>
  );
}
