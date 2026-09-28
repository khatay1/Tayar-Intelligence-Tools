import { useMemo } from 'react';
import { createEditorIntegrationsConfig, normalizeEditorIntegrationsConfig, type EditorIntegrationsConfig } from '../core/editor-integrations';
import { BuilderIntegrationsMaxPanel } from './BuilderIntegrationsMaxPanel';
import type { WebsiteSecretInventory } from '../services/websiteProjectSecretService';

export interface BuilderIntegrationsSettingsSlotProps {
  value?: EditorIntegrationsConfig | null;
  onChange?(config: EditorIntegrationsConfig): void;
  onSetSecret?(connectionId: string, field: string, value: string): void | Promise<void>;
  onInspectSecrets?(): Promise<WebsiteSecretInventory>;
  secretScope?: string;
  onTestConnection?(connectionId: string): void | Promise<void>;
}

/**
 * Boundary between the V2 settings surface and project persistence/runtime.
 * It deliberately stays inert until the host supplies onChange so older
 * projects can render the MAX workspace without mutating project data.
 */
export function BuilderIntegrationsSettingsSlot({ value, onChange, onSetSecret, onInspectSecrets, secretScope, onTestConnection }: BuilderIntegrationsSettingsSlotProps) {
  const config = useMemo(
    () => value ? normalizeEditorIntegrationsConfig(value) : createEditorIntegrationsConfig(),
    [value],
  );

  if (!onChange) return null;
  return <BuilderIntegrationsMaxPanel config={config} onChange={onChange} onSetSecret={onSetSecret} onInspectSecrets={onInspectSecrets} secretScope={secretScope} onTestConnection={onTestConnection} />;
}

export default BuilderIntegrationsSettingsSlot;
