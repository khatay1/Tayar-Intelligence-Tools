import { useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import type { ApplicationTable } from '../core/application-model';
import { APPLICATION_FILE_TYPES } from '../core/application-files';

export function BuilderApplicationFilesRule({ table, disabled, onSave }: {
  table: ApplicationTable; disabled?: boolean; onSave(value?: ApplicationTable['attachments']): void;
}) {
  const l = useLocalizer();
  const [size, setSize] = useState((table.attachments?.maxBytes ?? 10 * 1024 * 1024) / (1024 * 1024));
  const [types, setTypes] = useState<string[]>(table.attachments?.mimeTypes ?? ['application/pdf', 'image/jpeg', 'image/png']);
  const valid = Number.isInteger(size) && size >= 1 && size <= 25 && types.length > 0
    && table.permissions.some(rule => rule.operation === 'read') && table.permissions.some(rule => rule.operation === 'update');
  return <fieldset><legend>{l('Record attachments')}</legend>
    <p>{l('Private files follow record permissions. Downloads require sign-in; uploads and deletion require update access.')}</p>
    <label>{l('Maximum file size (MiB)')}<input type="number" min={1} max={25} step={1} disabled={disabled} value={size} onChange={event => setSize(Number(event.target.value))} /></label>
    {APPLICATION_FILE_TYPES.map(type => <label key={type}><input type="checkbox" disabled={disabled} checked={types.includes(type)}
      onChange={event => setTypes(current => event.target.checked ? [...current, type] : current.filter(value => value !== type))} />{type}</label>)}
    <button type="button" disabled={disabled || !valid} onClick={() => onSave({ maxBytes: size * 1024 * 1024, mimeTypes: types })}>{l('Save attachment rule')}</button>
    {table.attachments && <button type="button" disabled={disabled} onClick={() => onSave(undefined)}>{l('Remove attachment rule')}</button>}
  </fieldset>;
}
