export type ProviderHealthState = 'not-configured' | 'disabled' | 'ready' | 'default';

export interface ProviderHealthInput {
  configured: boolean;
  enabled: boolean;
  secretConfigured: boolean;
  isDefault: boolean;
}

export interface ProviderHealthView {
  state: ProviderHealthState;
  canTest: boolean;
  canActivate: boolean;
  severity: 'neutral' | 'warning' | 'healthy';
}

export function deriveProviderHealth(input: ProviderHealthInput): ProviderHealthView {
  if (!input.configured || !input.secretConfigured) {
    return { state: 'not-configured', canTest: false, canActivate: false, severity: 'neutral' };
  }
  if (!input.enabled) {
    return { state: 'disabled', canTest: false, canActivate: false, severity: 'warning' };
  }
  if (input.isDefault) {
    return { state: 'default', canTest: true, canActivate: false, severity: 'healthy' };
  }
  return { state: 'ready', canTest: true, canActivate: true, severity: 'healthy' };
}
