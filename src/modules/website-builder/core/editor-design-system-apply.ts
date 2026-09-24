import type { EditorNativeOperation } from './editor-native-operation';
import type { EditorDesignToken, EditorStylePreset } from './editor-design-system';
import type { ElementStyle } from './types';

export interface EditorDesignSystemSelection {
  pageId: string;
  sectionId: string;
  elementId: string;
  currentStyle?: ElementStyle;
}

function finiteNumber(value: string): number | null {
  const parsed=Number(value.replace(/px$/i,'').trim());
  return Number.isFinite(parsed)?parsed:null;
}

export function designTokenStylePatch(token: EditorDesignToken): Partial<ElementStyle> {
  if(token.kind==='color') return {color:token.value};
  if(token.kind==='spacing'){const value=finiteNumber(token.value);return value===null?{}:{padding:value};}
  if(token.kind==='radius'){const value=finiteNumber(token.value);return value===null?{}:{borderRadius:value};}
  if(token.kind==='font-size'){const value=finiteNumber(token.value);return value===null?{}:{fontSize:value};}
  return {};
}

export function designPresetStylePatch(preset: EditorStylePreset): Partial<ElementStyle> {
  const allowed = new Set<keyof ElementStyle>(['color','backgroundColor','fontSize','fontWeight','textAlign','padding','borderRadius','width','minWidth','maxWidth','height','minHeight','maxHeight','marginTop','marginRight','marginBottom','marginLeft','lineHeight','letterSpacing','opacity','rotate','borderWidth','borderColor','borderStyle','shadow']);
  const patch: Record<string, unknown>={};
  for(const [key,value] of Object.entries(preset.values)) if(allowed.has(key as keyof ElementStyle)) patch[key]=value;
  return patch as Partial<ElementStyle>;
}

function updateStyleOperation(selection: EditorDesignSystemSelection, patch: Partial<ElementStyle>): EditorNativeOperation[] {
  if(!Object.keys(patch).length) return [];
  return [{action:'update_element',source:'manual',pageId:selection.pageId,sectionId:selection.sectionId,elementId:selection.elementId,changes:{style:{...(selection.currentStyle??{}),...patch}}}];
}

export function applyDesignTokenOperation(selection: EditorDesignSystemSelection, token: EditorDesignToken): EditorNativeOperation[] {
  return updateStyleOperation(selection,designTokenStylePatch(token));
}

export function applyDesignPresetOperation(selection: EditorDesignSystemSelection, preset: EditorStylePreset): EditorNativeOperation[] {
  return updateStyleOperation(selection,designPresetStylePatch(preset));
}
