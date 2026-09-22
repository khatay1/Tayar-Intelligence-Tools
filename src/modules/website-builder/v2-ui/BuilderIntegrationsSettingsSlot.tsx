import { useMemo } from 'react';
import { createEditorIntegrationsConfig, normalizeEditorIntegrationsConfig, type EditorIntegrationsConfig } from '../core/editor-integrations';
import { BuilderIntegrationsMaxPanel } from './BuilderIntegrationsMaxPanel';

export interface BuilderIntegrationsSettingsSlotProps {
  value?: EditorIntegrationsConfig | null;
  onChange?(config: EditorIntegrationsConfig): void;
  onSetSecret?(connectionId: string, field: string, value: string): void | Promise<void>;
  onTestConnection?(connectionId: string): void | Promise<void>;
}

/**
 * Boundary between the V2 settings surface and project persistence/runtime.
 * It deliberately stays inert until the host supplies onChange so older
 * projects can render the MAX workspace without mutating project data.
 */
export function BuilderIntegrationsSettingsSlot({ value, onChange, onSetSecret, onTestConnection }: BuilderIntegrationsSettingsSlotProps) {
  const config = useMemo(
    () => value ? normalizeEditorIntegrationsConfig(value) : createEditorIntegrationsConfig(),
    [value],
  );

  if (!onChange) return null;
  return <BuilderIntegrationsMaxPanel config={config} onChange={onChange} onSetSecret={onSetSecret} onTestConnection={onTestConnection} />;
}

export default BuilderIntegrationsSettingsSlot;
