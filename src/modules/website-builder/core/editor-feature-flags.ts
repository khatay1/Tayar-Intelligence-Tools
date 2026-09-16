export interface EditorV2FeatureFlags {
  shell: boolean;
  controller: boolean;
  nativePatchGateway: boolean;
  autosave: boolean;
  publishReadiness: boolean;
}

export const DEFAULT_EDITOR_V2_FEATURE_FLAGS: EditorV2FeatureFlags = {
  shell: true,
  controller: true,
  nativePatchGateway: true,
  autosave: true,
  publishReadiness: true,
};

export function resolveEditorV2FeatureFlags(
  overrides: Partial<EditorV2FeatureFlags> = {},
): EditorV2FeatureFlags {
  return { ...DEFAULT_EDITOR_V2_FEATURE_FLAGS, ...overrides };
}

export function parseEditorV2FeatureFlags(value: string | null | undefined): Partial<EditorV2FeatureFlags> {
  if (!value) return {};
  const enabled = new Set(value.split(',').map((entry) => entry.trim()).filter(Boolean));
  return {
    ...(enabled.has('shell') ? { shell: true } : {}),
    ...(enabled.has('no-controller') ? { controller: false } : {}),
    ...(enabled.has('no-native-patch') ? { nativePatchGateway: false } : {}),
    ...(enabled.has('no-autosave') ? { autosave: false } : {}),
    ...(enabled.has('no-publish-readiness') ? { publishReadiness: false } : {}),
  };
}

export const EDITOR_V2_FLAGS_STORAGE_KEY = 'tayar.website-builder.v2.flags';

export function resolveWebsiteBuilderV2Flags() {
  if (typeof window === 'undefined') {
    return resolveEditorV2FeatureFlags();
  }

  const params = new URLSearchParams(window.location.search);
  const queryFlag = params.get('builderV2');

  const overrides = parseEditorV2FeatureFlags(
    window.localStorage.getItem(EDITOR_V2_FLAGS_STORAGE_KEY),
  );

  if (queryFlag === '1') {
    overrides.shell = true;
  } else if (queryFlag === '0') {
    overrides.shell = false;
  }

  return resolveEditorV2FeatureFlags(overrides);
}
