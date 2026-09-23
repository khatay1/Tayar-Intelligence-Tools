import type { User } from '@supabase/supabase-js';
import { ChevronDown,ChevronLeft,ChevronRight,ChevronUp,Copy,Eye,Images,Trash2,Upload } from 'lucide-react';
import type * as React from 'react';
import { ELEMENT_LABELS } from '../core/defaults';
import type { Device,ElementAnimation,ElementShadow,SectionLayout,SectionResponsiveStyle,WebsiteElement,WebsiteElementContainer,WebsiteFormAutomation,WebsiteFormField,WebsiteFormFieldType,WebsiteSection } from '../core/types';
import type { WebsitePage,WebsiteSymbol,WebsiteTheme } from '../core/website-builder-model';
import { effectiveStyle,normalizeElementAnimation,sectionColumnCount } from '../core/website-builder-rendering';
import { BuilderLegacySectionSettings } from './BuilderLegacySectionSettings';

interface BuilderLegacyInspectorProps {
  addFormAutomation: (action: WebsiteFormAutomation["action"]) => void;
  addFormField: (type?: WebsiteFormFieldType) => void;
  aiBusy: boolean;
  aiQualityBusy: boolean;
  assignSelectedToContainer: (containerId?: string) => void;
  copySelectedElementResponsiveFrom: (sourceDevice: Device) => void;
  copySelectedSectionResponsiveFrom: (sourceDevice: Device) => void;
  createContainerForSelected: () => void;
  createSymbolFromSelected: () => void;
  darkMode: boolean;
  deleteFormAutomation: (automationId: string) => void;
  deleteFormField: (fieldId: string) => void;
  deleteSection: (id: string) => void;
  deleteSelectedContainer: () => void;
  deleteSelectedElement: () => void;
  deleteSymbol: (symbolId: string) => void;
  detachSelectedSymbol: () => void;
  device: Device;
  duplicateSelectedElement: () => void;
  generateImagePrompt: () => Promise<void>;
  generateRealImage: () => Promise<void>;
  insertSymbol: (symbol: WebsiteSymbol) => void;
  inspectorOpen: boolean;
  l: (text: string) => string;
  mediaUploading: boolean;
  moveFormField: (fieldId: string, direction: "up" | "down") => void;
  moveSection: (id: string, direction: "up" | "down") => void;
  moveSelectedElement: (direction: "up" | "down") => void;
  pages: WebsitePage[];
  resetContactForm: () => void;
  resetSelectedElementResponsive: () => void;
  resetSelectedSectionResponsive: () => void;
  sectionSettingsOpen: boolean;
  selectedContainer: WebsiteElementContainer | null;
  selectedElement: WebsiteElement | null;
  selectedSection: WebsiteSection | null;
  setInspectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMediaOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSectionSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedSectionLayout: (layout: SectionLayout) => void;
  symbols: WebsiteSymbol[];
  theme: WebsiteTheme;
  updateFormAutomation: (automationId: string, changes: Partial<WebsiteFormAutomation>) => void;
  updateFormField: (fieldId: string, changes: Partial<WebsiteFormField>) => void;
  updateSelected: (changes: Partial<Omit<WebsiteSection, "id" | "type">>) => void;
  updateSelectedContainer: (changes: Partial<WebsiteElementContainer>) => void;
  updateSelectedElement: (changes: Partial<WebsiteElement>, responsive?: boolean) => void;
  updateSelectedSectionResponsive: (changes: SectionResponsiveStyle) => void;
  uploadMediaFile: (file: File) => Promise<void>;
  user: User | null;
}

export function BuilderLegacyInspector({
  addFormAutomation,
  addFormField,
  aiBusy,
  aiQualityBusy,
  assignSelectedToContainer,
  copySelectedElementResponsiveFrom,
  copySelectedSectionResponsiveFrom,
  createContainerForSelected,
  createSymbolFromSelected,
  darkMode,
  deleteFormAutomation,
  deleteFormField,
  deleteSection,
  deleteSelectedContainer,
  deleteSelectedElement,
  deleteSymbol,
  detachSelectedSymbol,
  device,
  duplicateSelectedElement,
  generateImagePrompt,
  generateRealImage,
  insertSymbol,
  inspectorOpen,
  l,
  mediaUploading,
  moveFormField,
  moveSection,
  moveSelectedElement,
  pages,
  resetContactForm,
  resetSelectedElementResponsive,
  resetSelectedSectionResponsive,
  sectionSettingsOpen,
  selectedContainer,
  selectedElement,
  selectedSection,
  setInspectorOpen,
  setMediaOpen,
  setSectionSettingsOpen,
  setSelectedSectionLayout,
  symbols,
  theme,
  updateFormAutomation,
  updateFormField,
  updateSelected,
  updateSelectedContainer,
  updateSelectedElement,
  updateSelectedSectionResponsive,
  uploadMediaFile,
  user,
}: BuilderLegacyInspectorProps) {
  return (
<aside data-tayar-v1-inspector="true" data-tayar-v1-left="true"
          className={`w-full shrink-0 border-t p-3 transition-[width,padding] duration-200 lg:border-l lg:border-t-0 ${inspectorOpen ? 'lg:w-72 xl:w-80 lg:p-3' : 'lg:w-12 lg:p-2'} ${
            darkMode
              ? 'border-white/10 bg-[#0a0a1a]'
              : 'border-gray-200 bg-white'
          }`}
        >
          <div className="mb-2 hidden lg:flex lg:justify-start">
            <button
              type="button"
              onClick={() => setInspectorOpen((open) => !open)}
              className={`grid h-8 w-8 place-items-center rounded-lg border transition ${darkMode ? 'border-white/10 text-gray-400 hover:bg-white/5 hover:text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
              title={l(inspectorOpen ? 'Collapse inspector' : 'Expand inspector')}
              aria-label={l(inspectorOpen ? 'Collapse inspector' : 'Expand inspector')}
              aria-expanded={inspectorOpen}
            >
              {inspectorOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
          <div className={inspectorOpen ? 'block' : 'lg:hidden'}>
          <div className="mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4 text-violet-400" />
            <div>
              <h2 className="text-xs font-bold">{selectedElement ? `${l('Edit')} ${ELEMENT_LABELS[selectedElement.type]}` : l('Inspector')}</h2>
              <p className="mt-0.5 text-[9px] text-gray-500">{selectedElement ? (selectedElement.type === 'heading' || selectedElement.type === 'text' ? l('Double-click the text on the page for quick editing, or use the controls here.') : l('Change the basics here. Open Advanced only when you need it.')) : l('Select something on the page to start editing.')}</p>
            </div>
          </div>

          {selectedElement && (
            <div className={`mb-3 space-y-2.5 rounded-xl border p-2.5 ${darkMode ? 'border-violet-500/25 bg-violet-500/5' : 'border-violet-200 bg-violet-50'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold">{ELEMENT_LABELS[selectedElement.type]}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => moveSelectedElement('up')} title={l('Move element up')} className={`rounded p-1 ${darkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => moveSelectedElement('down')} title={l('Move element down')} className={`rounded p-1 ${darkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <span className="ml-1 text-[10px] uppercase text-gray-500">{device}</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-500">{l("Drag this element on the canvas to reorder it.")}</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={duplicateSelectedElement} className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-white'}`}>
                  <Copy className="h-3.5 w-3.5" />{l('Duplicate')}</button>
                <button onClick={deleteSelectedElement} className="flex items-center justify-center gap-2 rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10">
                  <Trash2 className="h-3.5 w-3.5" />{l('Delete')}</button>
              </div>
              <details className={`rounded-lg border ${darkMode ? 'border-white/10 bg-black/10' : 'border-violet-200 bg-white/70'}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[10px] font-semibold [&::-webkit-details-marker]:hidden">
                  <span>{l('Structure')}</span><span className="sr-only">{l('Structure & reusable components')}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                </summary>
                <div className="space-y-2 border-t border-white/10 p-2">
<div className={`space-y-2 rounded-lg border p-2 ${darkMode ? 'border-sky-500/20 bg-sky-500/5' : 'border-sky-200 bg-sky-50/70'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-sky-400">{l('Container / Group')}</span>
                  {!selectedContainer && <button type="button" onClick={createContainerForSelected} className="text-[9px] font-semibold text-sky-400">{l('+ New container')}</button>}
                </div>
                <select value={selectedElement.containerId || ''} onChange={(e) => assignSelectedToContainer(e.target.value || undefined)} className={`w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-sky-200 bg-white'}`}>
                  <option value="">{l('No container')}</option>
                  {(selectedSection?.containers || []).map((container) => <option key={container.id} value={container.id}>{container.name}</option>)}
                </select>
                {selectedContainer && (
                  <div className="space-y-2">
                    <input value={selectedContainer.name} onChange={(e) => updateSelectedContainer({ name: e.target.value })} maxLength={80} className={`w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-sky-200 bg-white'}`} />
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[9px] text-gray-500">{l('Layout')}<select value={selectedContainer.layout} onChange={(e) => updateSelectedContainer({ layout: e.target.value as 'stack' | 'row' })} className={`mt-1 w-full rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-sky-200 bg-white'}`}><option value="stack">{l('Stack')}</option><option value="row">{l('Row')}</option></select>
                      </label>
                      <label className="text-[9px] text-gray-500">{l('Align')}<select value={selectedContainer.align} onChange={(e) => updateSelectedContainer({ align: e.target.value as 'start' | 'center' | 'end' | 'stretch' })} className={`mt-1 w-full rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-sky-200 bg-white'}`}><option value="start">{l('Start')}</option><option value="center">{l('Center')}</option><option value="end">{l('End')}</option><option value="stretch">{l('Stretch')}</option></select>
                      </label>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="text-[9px] text-gray-500">{l('Gap')}<input type="number" min="0" max="80" value={selectedContainer.gap} onChange={(e) => updateSelectedContainer({ gap: Number(e.target.value) })} className={`mt-1 w-full rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-sky-200 bg-white'}`} /></label>
                      <label className="text-[9px] text-gray-500">{l('Padding')}<input type="number" min="0" max="120" value={selectedContainer.padding} onChange={(e) => updateSelectedContainer({ padding: Number(e.target.value) })} className={`mt-1 w-full rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-sky-200 bg-white'}`} /></label>
                      <label className="text-[9px] text-gray-500">{l('Radius')}<input type="number" min="0" max="120" value={selectedContainer.borderRadius} onChange={(e) => updateSelectedContainer({ borderRadius: Number(e.target.value) })} className={`mt-1 w-full rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-sky-200 bg-white'}`} /></label>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="text-[9px] text-gray-500">{l('Background')}<input type="color" value={/^#[0-9a-f]{6}$/i.test(selectedContainer.backgroundColor) ? selectedContainer.backgroundColor : '#111827'} onChange={(e) => updateSelectedContainer({ backgroundColor: e.target.value })} className="mt-1 h-7 w-full rounded border-0 bg-transparent p-0" /></label>
                      <label className="text-[9px] text-gray-500">{l('Border')}<input type="color" value={/^#[0-9a-f]{6}$/i.test(selectedContainer.borderColor) ? selectedContainer.borderColor : '#374151'} onChange={(e) => updateSelectedContainer({ borderColor: e.target.value })} className="mt-1 h-7 w-full rounded border-0 bg-transparent p-0" /></label>
                      <label className="text-[9px] text-gray-500">{l('Width')}<input type="number" min="0" max="16" value={selectedContainer.borderWidth} onChange={(e) => updateSelectedContainer({ borderWidth: Number(e.target.value) })} className={`mt-1 w-full rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-sky-200 bg-white'}`} /></label>
                    </div>
                    <select value={selectedContainer.shadow} onChange={(e) => updateSelectedContainer({ shadow: e.target.value as ElementShadow })} className={`w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-sky-200 bg-white'}`}><option value="none">{l('No shadow')}</option><option value="sm">{l('Small shadow')}</option><option value="md">{l('Medium shadow')}</option><option value="lg">{l('Large shadow')}</option><option value="xl">{l('XL shadow')}</option></select>
              {selectedContainer && selectedSection && sectionColumnCount(selectedSection.layout) > 1 && (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[9px] text-gray-500">{l('Container column')}<input type="number" min="1" max={sectionColumnCount(selectedSection.layout)} value={selectedContainer.layoutColumn || 1} onChange={(e) => updateSelectedContainer({ layoutColumn: Number(e.target.value) })} className={`mt-1 w-full rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-sky-200 bg-white'}`} /></label>
                        <label className="text-[9px] text-gray-500">{l('Span')}<input type="number" min="1" max={sectionColumnCount(selectedSection.layout)} value={selectedContainer.columnSpan || 1} onChange={(e) => updateSelectedContainer({ columnSpan: Number(e.target.value) })} className={`mt-1 w-full rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-sky-200 bg-white'}`} /></label>
                      </div>
                    )}
                    <button type="button" onClick={deleteSelectedContainer} className="w-full rounded border border-red-500/20 px-2 py-1.5 text-[10px] font-semibold text-red-400">{l('Delete container & ungroup')}</button>
                  </div>
                )}
              </div>

              <div className={`space-y-2 rounded-lg border p-2 ${darkMode ? 'border-amber-500/20 bg-amber-500/5' : 'border-amber-200 bg-amber-50/70'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-400">{l('Reusable Symbols')}</span>
                  {selectedElement.symbolId ? <button type="button" onClick={detachSelectedSymbol} className="text-[9px] font-semibold text-amber-400">{l('Detach')}</button> : <button type="button" onClick={createSymbolFromSelected} className="text-[9px] font-semibold text-amber-400">{l('Create symbol')}</button>}
                </div>
                {selectedElement.symbolId && <p className="text-[9px] text-amber-300">{l("Linked symbol — edits sync across all pages automatically.")}</p>}
                {!symbols.length ? <p className="text-[9px] text-gray-500">{l('No symbols yet. Create one from this element.')}</p> : (
                  <div className="max-h-40 space-y-1.5 overflow-auto">
                    {symbols.map((symbol) => (
                      <div key={symbol.id} className={`flex items-center gap-1.5 rounded border p-1.5 ${darkMode ? 'border-white/10' : 'border-amber-200 bg-white'}`}>
                        <button type="button" onClick={() => insertSymbol(symbol)} className="min-w-0 flex-1 truncate text-left text-[10px] font-semibold">+ {symbol.name}</button>
                        <button type="button" onClick={() => deleteSymbol(symbol.id)} title={l('Delete symbol')} className="text-[10px] text-red-400">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
                </div>
              </details>
              {selectedElement.type === 'image' ? (
                <div className="space-y-2">
                  <input
                    value={selectedElement.src || ''}
                    onChange={(e) => updateSelectedElement({ src: e.target.value })}
                    placeholder="https://..."
                    className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setMediaOpen(true)} disabled={!user} className={`flex items-center justify-center gap-2 rounded-lg border px-2 py-2 text-[11px] disabled:opacity-50 ${darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-white'}`}><Images className="h-3.5 w-3.5" />{l('Library')}</button>
                    <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-2 py-2 text-[11px] ${!user || mediaUploading ? 'pointer-events-none opacity-50' : ''} ${darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-white'}`}><Upload className="h-3.5 w-3.5" />{l('Upload')}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={!user || mediaUploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMediaFile(file); event.currentTarget.value = ''; }} /></label>
                  </div>
                </div>
              ) : selectedElement.type === 'video' ? (
                <div className="space-y-2">
                  <input value={selectedElement.src || ''} onChange={(e) => updateSelectedElement({ src: e.target.value })} placeholder={l('YouTube, Vimeo or direct video URL')} className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
                  <input value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} placeholder={l('Video title / accessibility label')} className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
                </div>
              ) : selectedElement.type === 'embed' ? (
                <div className="space-y-2">
                  <input value={selectedElement.src || ''} onChange={(e) => updateSelectedElement({ src: e.target.value })} placeholder="https://... map or embed URL" className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
                  <input value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} placeholder={l('Accessibility title')} className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
                </div>
              ) : selectedElement.type === 'gallery' ? (
                <textarea value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} rows={7} placeholder={l('One image URL per line')} className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
              ) : selectedElement.type === 'accordion' || selectedElement.type === 'tabs' ? (
                <div className="space-y-1.5"><textarea value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} rows={8} placeholder={l('Title | Content — one item per line')} className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} /><p className="text-[9px] text-gray-500">{l('Use one line per item: Title | Content')}</p></div>
              ) : selectedElement.type === 'countdown' ? (
                <div className="space-y-1.5"><textarea value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} rows={3} placeholder={l('2026-12-31T23:59:59 | Launching soon')} className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} /><p className="text-[9px] text-gray-500">{l('Format: ISO date/time | label')}</p></div>
              ) : selectedElement.type === 'stats' || selectedElement.type === 'testimonials-slider' ? (
                <div className="space-y-1.5"><textarea value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} rows={7} placeholder={selectedElement.type === 'stats' ? '120 | Projects completed\n98 | Satisfaction %' : 'Alex | Amazing experience\nSarah | Great service'} className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} /><p className="text-[9px] text-gray-500">{l('One item per line')}: {selectedElement.type === 'stats' ? l('value | label') : l('name | quote')}</p></div>
              ) : selectedElement.type === 'code' ? (
                <div className="space-y-1.5"><textarea value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} rows={10} placeholder={l('Custom HTML (scripts and inline event handlers are stripped)')} className={`w-full resize-none rounded-lg border px-3 py-2 font-mono text-[10px] outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} /><p className="text-[9px] text-emerald-500">{l('Safe HTML mode: script/object/embed tags and on* handlers are removed before preview/publish.')}</p></div>
              ) : selectedElement.type === 'divider' || selectedElement.type === 'spacer' ? (
                <p className="text-[10px] text-gray-500">{l('Use the styling controls below to adjust')} {selectedElement.type === 'divider' ? l('width, color and opacity') : l('height (Padding × 2)')}.</p>
              ) : (
                <textarea value={selectedElement.content} onChange={(e) => updateSelectedElement({ content: e.target.value })} rows={selectedElement.type === 'text' || selectedElement.type === 'list' ? 4 : 2} placeholder={selectedElement.type === 'list' ? l('One list item per line') : undefined} className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`} />
              )}
              {selectedElement.type === 'button' && (
                <div className="space-y-2">
                  <input
                    value={selectedElement.href || ''}
                    onChange={(e) => updateSelectedElement({ href: e.target.value })}
                    placeholder="#contact, https://... or page:about"
                    className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900'}`}
                  />
                  <select
                    value={(selectedElement.href || '').startsWith('page:') ? selectedElement.href : ''}
                    onChange={(e) => e.target.value && updateSelectedElement({ href: e.target.value })}
                    className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-[#111122] text-white' : 'border-gray-200 bg-white text-gray-900'}`}
                  >
                    <option value="">{l('Link to internal page…')}</option>
                    {pages.map((page) => <option key={page.id} value={`page:${page.slug}`}>{page.name} (/{page.slug})</option>)}
                  </select>
                </div>
              )}
              <div className={`space-y-2 rounded-lg border p-2.5 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-violet-400">{l('Quick style')}</span>
                  <span className="text-[9px] uppercase text-gray-500">{l(device)}</span>
                </div>
                {(selectedElement.type === 'heading' || selectedElement.type === 'text' || selectedElement.type === 'button' || selectedElement.type === 'list') && (
                  <>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] text-gray-500">{l('Size')}<input type="number" min="10" max="120" value={effectiveStyle(selectedElement, device).fontSize || 16} onChange={(e) => updateSelectedElement({ style: { fontSize: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} /></label>
                <label className="text-[10px] text-gray-500">{l('Text color')}<input type="color" value={effectiveStyle(selectedElement, device).color || '#ffffff'} onChange={(e) => updateSelectedElement({ style: { color: e.target.value } }, true)} className="mt-1 h-8 w-full rounded border-0 bg-transparent p-0" /></label>
              </div>
              <label className="block text-[10px] text-gray-500">{l('Alignment')}<select value={effectiveStyle(selectedElement, device).textAlign || 'center'} onChange={(e) => updateSelectedElement({ style: { textAlign: e.target.value as 'left' | 'center' | 'right' } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}><option value="left">{l('Left')}</option><option value="center">{l('Center')}</option><option value="right">{l('Right')}</option></select></label>
                  </>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-gray-500">{l('Width %')}<input type="number" min="10" max="100" value={effectiveStyle(selectedElement, device).width || 100} onChange={(e) => updateSelectedElement({ style: { width: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} /></label>
                  {selectedElement.type === 'button' ? (
              <label className="text-[10px] text-gray-500">{l('Background')}<input type="color" value={effectiveStyle(selectedElement, device).backgroundColor || '#7c3aed'} onChange={(e) => updateSelectedElement({ style: { backgroundColor: e.target.value } }, true)} className="mt-1 h-8 w-full rounded border-0 bg-transparent p-0" /></label>
                  ) : <div />}
                </div>

              </div>

              {selectedSection && sectionColumnCount(selectedSection.layout) > 1 && (
                <div className={`rounded-lg border p-2 ${darkMode ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-indigo-200 bg-indigo-50/60'}`}>
                  <label className="block text-[10px] font-semibold text-indigo-400">{l("Column")}<select value={Math.min(sectionColumnCount(selectedSection.layout), Math.max(1, Number(selectedElement.layoutColumn) || 1))} onChange={(e) => updateSelectedElement({ layoutColumn: Number(e.target.value) })} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-indigo-200 bg-white'}`}>
                      {Array.from({ length: sectionColumnCount(selectedSection.layout) }, (_, index) => <option key={index + 1} value={index + 1}>Column {index + 1}</option>)}
                    </select>
                  </label>
                </div>
              )}

              <details className={`rounded-lg border ${darkMode ? 'border-white/10 bg-black/10' : 'border-gray-200 bg-white/70'}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[10px] font-semibold [&::-webkit-details-marker]:hidden">
                  <span>{l('Advanced')}</span><span className="sr-only">{l('Advanced design & responsive')}</span>
                  <span className="flex items-center gap-2 text-[9px] uppercase text-gray-500">{device}<ChevronDown className="h-3.5 w-3.5" /></span>
                </summary>
                <div className="space-y-3 border-t border-white/10 p-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    <button type="button" onClick={resetSelectedElementResponsive} className={`rounded-lg border px-2.5 py-2 text-[10px] font-semibold ${darkMode ? 'border-white/10 text-gray-400 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {l('Reset')} {l(device)}
                    </button>
                    {(['desktop', 'tablet', 'mobile'] as Device[]).filter((sourceDevice) => sourceDevice !== device).map((sourceDevice) => (
                      <button
                        key={sourceDevice}
                        type="button"
                        onClick={() => copySelectedElementResponsiveFrom(sourceDevice)}
                        className={`rounded-lg border px-2.5 py-2 text-[10px] font-semibold ${darkMode ? 'border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/10' : 'border-cyan-200 text-cyan-700 hover:bg-cyan-50'}`}
                        title={`${l('Copy')} ${l(sourceDevice)} → ${l(device)}`}
                      >
                        {l('Copy')} {l(sourceDevice)}
                      </button>
                    ))}
                  </div>
<div className={`space-y-2 rounded-lg border p-2 ${darkMode ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50/60'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400">{l('Responsive layout')}</span>
                  <span className="text-[9px] uppercase text-gray-500">{l(device)}</span>
                </div>
                <label className="flex items-center justify-between gap-3 text-[10px] text-gray-500">
                  Visible on {device}
                  <input
                    type="checkbox"
                    checked={!effectiveStyle(selectedElement, device).hidden}
                    onChange={(e) => updateSelectedElement({ style: { hidden: !e.target.checked } }, true)}
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-gray-500">{l('Max width px')}<input
                      type="number"
                      min="0"
                      max="2000"
                      placeholder={l('Auto')}
                      value={effectiveStyle(selectedElement, device).maxWidth ?? ''}
                      onChange={(e) => updateSelectedElement({ style: { maxWidth: e.target.value ? Number(e.target.value) : undefined } }, true)}
                      className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`}
                    />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Order')}<input
                      type="number"
                      min="-50"
                      max="50"
                      value={effectiveStyle(selectedElement, device).order ?? 0}
                      onChange={(e) => updateSelectedElement({ style: { order: Number(e.target.value) } }, true)}
                      className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`}
                    />
                  </label>
                </div>
                <div className={`rounded-lg border p-2.5 ${darkMode ? 'border-violet-500/15 bg-violet-500/[0.04]' : 'border-violet-200 bg-violet-50/50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-violet-400">{l('Free position')}</span>
                    <button type="button" onClick={() => updateSelectedElement({ style: { positionX: 0, positionY: 0 } }, true)} className="text-[9px] font-semibold text-violet-400 hover:text-violet-300">{l('Reset')}</button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-gray-500">X<input type="number" min="-4000" max="4000" value={effectiveStyle(selectedElement, device).positionX ?? 0} onChange={(e) => updateSelectedElement({ style: { positionX: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-violet-200 bg-white'}`} /></label>
                    <label className="text-[10px] text-gray-500">Y<input type="number" min="-4000" max="4000" value={effectiveStyle(selectedElement, device).positionY ?? 0} onChange={(e) => updateSelectedElement({ style: { positionY: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-violet-200 bg-white'}`} /></label>
                  </div>
                  <p className="mt-1.5 text-[9px] text-gray-500">{l('Drag freely on the canvas. Hold Shift while dragging to reorder instead.')}</p>
                </div>
                <label className="block text-[10px] text-gray-500">{l('Element position')}<select
                    value={effectiveStyle(selectedElement, device).alignSelf || 'auto'}
                    onChange={(e) => updateSelectedElement({ style: { alignSelf: e.target.value as 'auto' | 'start' | 'center' | 'end' | 'stretch' } }, true)}
                    className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-cyan-200 bg-white'}`}
                  >
                    <option value="auto">{l('Auto')}</option>
                    <option value="start">{l('Start')}</option>
                    <option value="center">{l('Center')}</option>
                    <option value="end">{l('End')}</option>
                    <option value="stretch">{l('Stretch')}</option>
                  </select>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {([['T', 'marginTop'], ['R', 'marginRight'], ['B', 'marginBottom'], ['L', 'marginLeft']] as const).map(([label, key]) => (
                    <label key={key} className="text-[9px] text-gray-500">M {label}
                      <input
                        type="number"
                        min="-200"
                        max="400"
                        value={effectiveStyle(selectedElement, device)[key] ?? 0}
                        onChange={(e) => updateSelectedElement({ style: { [key]: Number(e.target.value) } }, true)}
                        className={`mt-1 w-full rounded border px-1.5 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-cyan-200 bg-white'}`}
                      />
                    </label>
                  ))}
                </div>
                {device === 'desktop' && selectedSection && sectionColumnCount(selectedSection.layout) > 1 && (
                  <label className="block text-[10px] text-gray-500">{l('Column span')}<select
                      value={Math.min(sectionColumnCount(selectedSection.layout), Math.max(1, Number(effectiveStyle(selectedElement, device).columnSpan) || 1))}
                      onChange={(e) => updateSelectedElement({ style: { columnSpan: Number(e.target.value) } }, true)}
                      className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-cyan-200 bg-white'}`}
                    >
                      {Array.from({ length: sectionColumnCount(selectedSection.layout) }, (_, index) => <option key={index + 1} value={index + 1}>Span {index + 1} column{index ? 's' : ''}</option>)}
                    </select>
                  </label>
                )}
              </div>

              {(selectedElement.type === 'heading' || selectedElement.type === 'text' || selectedElement.type === 'button' || selectedElement.type === 'list' || selectedElement.type === 'accordion' || selectedElement.type === 'tabs' || selectedElement.type === 'code' || selectedElement.type === 'countdown' || selectedElement.type === 'stats' || selectedElement.type === 'testimonials-slider') && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-gray-500">{l('Size')}<input type="number" min="10" max="120" value={effectiveStyle(selectedElement, device).fontSize || 16} onChange={(e) => updateSelectedElement({ style: { fontSize: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} />
                    </label>
                    <label className="text-[10px] text-gray-500">{l('Weight')}<select value={effectiveStyle(selectedElement, device).fontWeight || 400} onChange={(e) => updateSelectedElement({ style: { fontWeight: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}>
                        <option value="400">400</option><option value="500">500</option><option value="600">600</option><option value="700">700</option><option value="800">800</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-gray-500">{l('Text color')}<input type="color" value={effectiveStyle(selectedElement, device).color || '#ffffff'} onChange={(e) => updateSelectedElement({ style: { color: e.target.value } }, true)} className="mt-1 h-8 w-full rounded border-0 bg-transparent p-0" />
                    </label>
                    <label className="text-[10px] text-gray-500">{l('Background')}<input type="color" value={effectiveStyle(selectedElement, device).backgroundColor || '#7c3aed'} onChange={(e) => updateSelectedElement({ style: { backgroundColor: e.target.value } }, true)} className="mt-1 h-8 w-full rounded border-0 bg-transparent p-0" />
                    </label>
                  </div>
                  <label className="text-[10px] text-gray-500">{l('Alignment')}<select value={effectiveStyle(selectedElement, device).textAlign || 'center'} onChange={(e) => updateSelectedElement({ style: { textAlign: e.target.value as 'left' | 'center' | 'right' } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}>
                      <option value="left">{l('Left')}</option><option value="center">{l('Center')}</option><option value="right">{l('Right')}</option>
                    </select>
                  </label>
                </>
              )}
              {(selectedElement.type === 'heading' || selectedElement.type === 'text' || selectedElement.type === 'button' || selectedElement.type === 'list' || selectedElement.type === 'accordion' || selectedElement.type === 'tabs' || selectedElement.type === 'code' || selectedElement.type === 'countdown' || selectedElement.type === 'stats' || selectedElement.type === 'testimonials-slider') && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-gray-500">{l('Line height')}<input type="number" min="0.7" max="4" step="0.05" value={effectiveStyle(selectedElement, device).lineHeight ?? 1.4} onChange={(e) => updateSelectedElement({ style: { lineHeight: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Letter spacing')}<input type="number" min="-10" max="30" step="0.25" value={effectiveStyle(selectedElement, device).letterSpacing ?? 0} onChange={(e) => updateSelectedElement({ style: { letterSpacing: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} />
                  </label>
                </div>
              )}

              <div className={`space-y-3 rounded-xl border p-3 ${darkMode ? 'border-fuchsia-500/20 bg-fuchsia-500/5' : 'border-fuchsia-200 bg-fuchsia-50/60'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-fuchsia-400">{l('Effects')}</span>
                  <span className="text-[9px] uppercase text-gray-500">{l(device)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-gray-500">{l('Opacity %')}<input type="number" min="0" max="100" value={Math.round((effectiveStyle(selectedElement, device).opacity ?? 1) * 100)} onChange={(e) => updateSelectedElement({ style: { opacity: Math.max(0, Math.min(100, Number(e.target.value))) / 100 } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Rotate °')}<input type="number" min="-180" max="180" value={effectiveStyle(selectedElement, device).rotate ?? 0} onChange={(e) => updateSelectedElement({ style: { rotate: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-gray-500">{l('Border width')}<input type="number" min="0" max="24" value={effectiveStyle(selectedElement, device).borderWidth ?? 0} onChange={(e) => updateSelectedElement({ style: { borderWidth: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Border style')}<select value={effectiveStyle(selectedElement, device).borderStyle || 'solid'} onChange={(e) => updateSelectedElement({ style: { borderStyle: e.target.value as 'solid' | 'dashed' | 'dotted' } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-fuchsia-200 bg-white'}`}>
                      <option value="solid">{l('Solid')}</option><option value="dashed">{l('Dashed')}</option><option value="dotted">{l('Dotted')}</option>
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-gray-500">{l('Border color')}<input type="color" value={effectiveStyle(selectedElement, device).borderColor || '#ffffff'} onChange={(e) => updateSelectedElement({ style: { borderColor: e.target.value } }, true)} className="mt-1 h-8 w-full rounded border-0 bg-transparent p-0" />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Shadow')}<select value={effectiveStyle(selectedElement, device).shadow || 'none'} onChange={(e) => updateSelectedElement({ style: { shadow: e.target.value as ElementShadow } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-fuchsia-200 bg-white'}`}>
                      <option value="none">{l('None')}</option><option value="sm">{l('Small')}</option><option value="md">{l('Medium')}</option><option value="lg">{l('Large')}</option><option value="xl">{l('XL')}</option>
                    </select>
                  </label>
                </div>
                <div className="border-t border-fuchsia-500/15 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-fuchsia-400">{l('Entrance Animation')}</span>
                    <span className="text-[9px] text-gray-500">{device}</span>
                  </div>
                  <label className="mt-2 block text-[10px] text-gray-500">{l('Animation')}<select value={normalizeElementAnimation(effectiveStyle(selectedElement, device).animation)} onChange={(e) => updateSelectedElement({ style: { animation: e.target.value as ElementAnimation } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-fuchsia-200 bg-white'}`}>
                      <option value="none">{l('None')}</option>
                      <option value="fade">{l('Fade')}</option>
                      <option value="fade-up">{l('Fade Up')}</option>
                      <option value="fade-down">{l('Fade Down')}</option>
                      <option value="fade-left">{l('Fade Left')}</option>
                      <option value="fade-right">{l('Fade Right')}</option>
                      <option value="zoom-in">{l('Zoom In')}</option>
                      <option value="zoom-out">{l('Zoom Out')}</option>
                      <option value="slide-up">{l('Slide Up')}</option>
                      <option value="slide-down">{l('Slide Down')}</option>
                      <option value="slide-left">{l('Slide Left')}</option>
                      <option value="slide-right">{l('Slide Right')}</option>
                      <option value="blur-in">{l('Blur In')}</option>
                      <option value="flip-in">{l('Flip In')}</option>
                      <option value="bounce-in">{l('Bounce In')}</option>
                    </select>
                  </label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <label className="text-[9px] text-gray-500">{l('Duration ms')}<input type="number" min="100" max="4000" step="50" value={effectiveStyle(selectedElement, device).animationDuration ?? 650} onChange={(e) => updateSelectedElement({ style: { animationDuration: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-1.5 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                    </label>
                    <label className="text-[9px] text-gray-500">{l('Delay ms')}<input type="number" min="0" max="5000" step="50" value={effectiveStyle(selectedElement, device).animationDelay ?? 0} onChange={(e) => updateSelectedElement({ style: { animationDelay: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-1.5 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                    </label>
                    <label className="text-[9px] text-gray-500">{l('Distance px')}<input type="number" min="0" max="300" step="2" value={effectiveStyle(selectedElement, device).animationDistance ?? 36} onChange={(e) => updateSelectedElement({ style: { animationDistance: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-1.5 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                    </label>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-[9px] text-gray-500">{l('Trigger')}<select value={selectedElement.animationTrigger || 'scroll'} onChange={(e) => updateSelectedElement({ animationTrigger: e.target.value as 'scroll' | 'load' | 'hover' | 'click' })} className={`mt-1 w-full rounded border px-1.5 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-fuchsia-200 bg-white'}`}>
                        <option value="scroll">{l('On scroll')}</option><option value="load">{l('On load')}</option><option value="hover">{l('On hover')}</option><option value="click">{l('On click')}</option>
                      </select>
                    </label>
                    <label className="text-[9px] text-gray-500">{l('Easing')}<select value={effectiveStyle(selectedElement, device).animationEasing || 'smooth'} onChange={(e) => updateSelectedElement({ style: { animationEasing: e.target.value as 'smooth' | 'ease' | 'linear' | 'spring' } }, true)} className={`mt-1 w-full rounded border px-1.5 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-fuchsia-200 bg-white'}`}>
                        <option value="smooth">{l('Smooth')}</option><option value="ease">{l('Ease')}</option><option value="linear">{l('Linear')}</option><option value="spring">{l('Spring')}</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-[9px] text-gray-500">{l('Iterations')}<input type="number" min="1" max="20" value={effectiveStyle(selectedElement, device).animationIterations ?? 1} onChange={(e) => updateSelectedElement({ style: { animationIterations: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-1.5 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                    </label>
                    <label className="text-[9px] text-gray-500">{l('Parallax speed')}<input type="number" min="-1" max="1" step="0.05" value={effectiveStyle(selectedElement, device).parallaxSpeed ?? 0} onChange={(e) => updateSelectedElement({ style: { parallaxSpeed: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-1.5 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                    </label>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-[10px] text-gray-500">
                    <input type="checkbox" checked={selectedElement.animationOnce !== false} onChange={(e) => updateSelectedElement({ animationOnce: e.target.checked })} />{l("Play once per page view")}</label>
                  <p className="mt-1 text-[9px] text-gray-500">{l("Turn this off to replay when the element leaves and re-enters the viewport.")}</p>
                </div>

                <div className="border-t border-fuchsia-500/15 pt-3">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-fuchsia-400">{l('Hover')}</span>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-gray-500">{l('Scale')}<input type="number" min="0.5" max="1.6" step="0.01" value={effectiveStyle(selectedElement, device).hoverScale ?? 1} onChange={(e) => updateSelectedElement({ style: { hoverScale: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                    </label>
                    <label className="text-[10px] text-gray-500">{l('Opacity %')}<input type="number" min="0" max="100" value={Math.round((effectiveStyle(selectedElement, device).hoverOpacity ?? effectiveStyle(selectedElement, device).opacity ?? 1) * 100)} onChange={(e) => updateSelectedElement({ style: { hoverOpacity: Math.max(0, Math.min(100, Number(e.target.value))) / 100 } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                    </label>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <label className="text-[9px] text-gray-500">{l('Text')}<input type="color" value={effectiveStyle(selectedElement, device).hoverColor || effectiveStyle(selectedElement, device).color || '#ffffff'} onChange={(e) => updateSelectedElement({ style: { hoverColor: e.target.value } }, true)} className="mt-1 h-7 w-full rounded border-0 bg-transparent p-0" />
                    </label>
                    <label className="text-[9px] text-gray-500">{l('Background')}<input type="color" value={effectiveStyle(selectedElement, device).hoverBackgroundColor || effectiveStyle(selectedElement, device).backgroundColor || '#7c3aed'} onChange={(e) => updateSelectedElement({ style: { hoverBackgroundColor: e.target.value } }, true)} className="mt-1 h-7 w-full rounded border-0 bg-transparent p-0" />
                    </label>
                    <label className="text-[9px] text-gray-500">{l('Shadow')}<select value={effectiveStyle(selectedElement, device).hoverShadow || 'none'} onChange={(e) => updateSelectedElement({ style: { hoverShadow: e.target.value as ElementShadow } }, true)} className={`mt-1 w-full rounded border px-1.5 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-fuchsia-200 bg-white'}`}>
                        <option value="none">{l('None')}</option><option value="sm">S</option><option value="md">M</option><option value="lg">L</option><option value="xl">{l('XL')}</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <label className="text-[10px] text-gray-500">{l('Width %')}<input type="number" min="10" max="100" value={effectiveStyle(selectedElement, device).width || 100} onChange={(e) => updateSelectedElement({ style: { width: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} />
                </label>
                <label className="text-[10px] text-gray-500">{l('Padding')}<input type="number" min="0" max="80" value={effectiveStyle(selectedElement, device).padding || 0} onChange={(e) => updateSelectedElement({ style: { padding: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} />
                </label>
                <label className="text-[10px] text-gray-500">{l('Radius')}<input type="number" min="0" max="80" value={effectiveStyle(selectedElement, device).borderRadius || 0} onChange={(e) => updateSelectedElement({ style: { borderRadius: Number(e.target.value) } }, true)} className={`mt-1 w-full rounded border px-2 py-1.5 text-xs ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} />
                </label>
              </div>
                </div>
              </details>
            </div>
          )}

          {!selectedSection ? (
            <div className="py-10 text-center text-xs text-gray-500">{l("Select a section to edit it.")}</div>
          ) : (
            <BuilderLegacySectionSettings
              addFormAutomation={addFormAutomation}
              addFormField={addFormField}
              aiBusy={aiBusy}
              aiQualityBusy={aiQualityBusy}
              copySelectedSectionResponsiveFrom={copySelectedSectionResponsiveFrom}
              darkMode={darkMode}
              deleteFormAutomation={deleteFormAutomation}
              deleteFormField={deleteFormField}
              deleteSection={deleteSection}
              device={device}
              generateImagePrompt={generateImagePrompt}
              generateRealImage={generateRealImage}
              l={l}
              moveFormField={moveFormField}
              moveSection={moveSection}
              pages={pages}
              resetContactForm={resetContactForm}
              resetSelectedSectionResponsive={resetSelectedSectionResponsive}
              sectionSettingsOpen={sectionSettingsOpen}
              selectedElement={selectedElement}
              selectedSection={selectedSection}
              setSectionSettingsOpen={setSectionSettingsOpen}
              setSelectedSectionLayout={setSelectedSectionLayout}
              theme={theme}
              updateFormAutomation={updateFormAutomation}
              updateFormField={updateFormField}
              updateSelected={updateSelected}
              updateSelectedSectionResponsive={updateSelectedSectionResponsive}
            />
          )}
          </div>
        </aside>
  );
}
