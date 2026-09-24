import { useMemo, useSyncExternalStore } from 'react';
import { useLocalizer } from '@/lib/ui-localization';
import {
  getEditorDesignSystemHostState,
  patchEditorDesignSystemHostState,
  subscribeEditorDesignSystemHost,
} from '../core/editor-design-system-host-store';
import type { EditorDesignTokenKind } from '../core/editor-design-system';

const TOKEN_KINDS: EditorDesignTokenKind[] = ['color','spacing','radius','font-size','font-family'];
const id = (prefix:string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2,8)}`}`;

export function BuilderDesignSystemSettingsSlot() {
  const l=useLocalizer();
  const state=useSyncExternalStore(subscribeEditorDesignSystemHost,getEditorDesignSystemHostState,getEditorDesignSystemHostState);
  const tokenNames=useMemo(()=>new Set(state.tokens.map(token=>token.name.toLowerCase())),[state.tokens]);
  const addToken=()=>{let n=state.tokens.length+1;while(tokenNames.has(`token ${n}`))n++;patchEditorDesignSystemHostState({tokens:[...state.tokens,{id:id('token'),name:`Token ${n}`,kind:'color',value:'#7c3aed'}]});};
  const addPreset=()=>patchEditorDesignSystemHostState({presets:[...state.presets,{id:id('preset'),name:`Preset ${state.presets.length+1}`,values:{}}]});
  return <section className="tayar-v2-design-system-max"><div className="tayar-v2-panel-heading"><strong>{l('Design System MAX')}</strong></div>
    <div className="tayar-v2-panel-heading"><span>{l('Design tokens')}</span><button type="button" onClick={addToken}>{l('Add token')}</button></div>
    {state.tokens.map(token=><div key={token.id} className="tayar-v2-design-token-row"><input aria-label={l('Token name')} value={token.name} onChange={e=>patchEditorDesignSystemHostState({tokens:state.tokens.map(x=>x.id===token.id?{...x,name:e.target.value}:x)})}/><select aria-label={l('Token type')} value={token.kind} onChange={e=>patchEditorDesignSystemHostState({tokens:state.tokens.map(x=>x.id===token.id?{...x,kind:e.target.value as EditorDesignTokenKind}:x)})}>{TOKEN_KINDS.map(kind=><option key={kind} value={kind}>{kind}</option>)}</select><input aria-label={l('Token value')} value={token.value} onChange={e=>patchEditorDesignSystemHostState({tokens:state.tokens.map(x=>x.id===token.id?{...x,value:e.target.value}:x)})}/><button type="button" onClick={()=>patchEditorDesignSystemHostState({tokens:state.tokens.filter(x=>x.id!==token.id)})}>{l('Remove')}</button></div>)}
    <div className="tayar-v2-panel-heading"><span>{l('Style presets')}</span><button type="button" onClick={addPreset}>{l('Add preset')}</button></div>
    {state.presets.map(preset=><div key={preset.id} className="tayar-v2-design-preset-row"><input aria-label={l('Preset name')} value={preset.name} onChange={e=>patchEditorDesignSystemHostState({presets:state.presets.map(x=>x.id===preset.id?{...x,name:e.target.value}:x)})}/><button type="button" onClick={()=>patchEditorDesignSystemHostState({presets:state.presets.filter(x=>x.id!==preset.id)})}>{l('Remove')}</button></div>)}
  </section>;
}
export default BuilderDesignSystemSettingsSlot;
