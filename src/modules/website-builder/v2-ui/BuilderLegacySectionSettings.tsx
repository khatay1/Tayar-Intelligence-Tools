import type * as React from 'react';
import { ChevronDown, ChevronUp, Link, Palette, Trash2, Type } from 'lucide-react';
import { SECTION_LABELS, createDefaultContactFormFields } from '../core/defaults';
import {
  normalizeAnchorId, sectionDomId, sectionLayoutGap, effectiveSectionStyle,
  sectionLayoutAlign, sectionBackgroundMode, safeSectionColor, sectionVisualNumber,
  sectionBackgroundPosition, sectionBackgroundSize, sectionContentWidth,
} from '../core/website-builder-rendering';
import type {
  Device, SectionLayout, SectionLayoutAlign, SectionBackgroundMode,
  SectionBackgroundPosition, SectionBackgroundSize, SectionContentWidth,
  WebsiteFormFieldType, WebsiteFormField, WebsiteFormAutomation,
  WebsiteElement, WebsiteSection, SectionResponsiveStyle,
} from '../core/types';
import type { WebsitePage, WebsiteTheme } from '../core/website-builder-model';

interface BuilderLegacySectionSettingsProps {
  addFormAutomation: (action: WebsiteFormAutomation["action"]) => void;
  addFormField: (type?: WebsiteFormFieldType) => void;
  aiBusy: boolean;
  aiQualityBusy: boolean;
  copySelectedSectionResponsiveFrom: (sourceDevice: Device) => void;
  darkMode: boolean;
  deleteFormAutomation: (automationId: string) => void;
  deleteFormField: (fieldId: string) => void;
  deleteSection: (id: string) => void;
  device: Device;
  generateImagePrompt: () => Promise<void>;
  generateRealImage: () => Promise<void>;
  l: (text: string) => string;
  moveFormField: (fieldId: string, direction: "up" | "down") => void;
  moveSection: (id: string, direction: "up" | "down") => void;
  pages: WebsitePage[];
  resetContactForm: () => void;
  resetSelectedSectionResponsive: () => void;
  sectionSettingsOpen: boolean;
  selectedElement: WebsiteElement | null;
  selectedSection: WebsiteSection;
  setSectionSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedSectionLayout: (layout: SectionLayout) => void;
  theme: WebsiteTheme;
  updateFormAutomation: (automationId: string, changes: Partial<WebsiteFormAutomation>) => void;
  updateFormField: (fieldId: string, changes: Partial<WebsiteFormField>) => void;
  updateSelected: (changes: Partial<Omit<WebsiteSection, "id" | "type">>) => void;
  updateSelectedSectionResponsive: (changes: SectionResponsiveStyle) => void;
}

export function BuilderLegacySectionSettings({
  addFormAutomation,
  addFormField,
  aiBusy,
  aiQualityBusy,
  copySelectedSectionResponsiveFrom,
  darkMode,
  deleteFormAutomation,
  deleteFormField,
  deleteSection,
  device,
  generateImagePrompt,
  generateRealImage,
  l,
  moveFormField,
  moveSection,
  pages,
  resetContactForm,
  resetSelectedSectionResponsive,
  sectionSettingsOpen,
  selectedElement,
  selectedSection,
  setSectionSettingsOpen,
  setSelectedSectionLayout,
  theme,
  updateFormAutomation,
  updateFormField,
  updateSelected,
  updateSelectedSectionResponsive,
}: BuilderLegacySectionSettingsProps) {
  return (
<details
              open={sectionSettingsOpen}
              onToggle={(event) => setSectionSettingsOpen(event.currentTarget.open)}
              className={`rounded-xl border ${darkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50'}`}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <p className="text-xs font-semibold">{l('Section settings')}</p>
                  <p className="truncate text-[9px] text-gray-500">{SECTION_LABELS[selectedSection.type]}{selectedElement ? ` · ${l('collapsed while editing element')}` : ''}</p>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform ${sectionSettingsOpen ? 'rotate-180' : ''}`} />
              </summary>
              <div className="space-y-5 border-t border-white/10 p-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">{l("Section")}</label>
                <div
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    darkMode
                      ? 'border-white/10 bg-white/5 text-gray-300'
                      : 'border-gray-200 bg-gray-50 text-gray-700'
                  }`}
                >
                  {SECTION_LABELS[selectedSection.type]}
                </div>
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-400">
                  <Type className="h-3.5 w-3.5" />{l("Title")}</label>
                <input
                  value={selectedSection.title}
                  onChange={(e) => updateSelected({ title: e.target.value })}
                  className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${
                    darkMode
                      ? 'border-white/10 bg-white/5 text-white'
                      : 'border-gray-200 bg-gray-50 text-gray-900'
                  }`}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">{l("Description")}</label>
                <textarea
                  value={selectedSection.description}
                  onChange={(e) =>
                    updateSelected({ description: e.target.value })
                  }
                  rows={4}
                  className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${
                    darkMode
                      ? 'border-white/10 bg-white/5 text-white'
                      : 'border-gray-200 bg-gray-50 text-gray-900'
                  }`}
                />
              </div>

              <div className={`rounded-xl border p-3 ${darkMode ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50/60'}`}>
                <label className="block text-[10px] font-semibold text-cyan-400">{l('Section Anchor / ID')}<input value={selectedSection.anchorId || ''} onChange={(e) => updateSelected({ anchorId: normalizeAnchorId(e.target.value, selectedSection.type) })} placeholder={selectedSection.type} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5 text-white' : 'border-cyan-200 bg-white text-gray-900'}`} />
                </label>
                <p className="mt-1 text-[9px] text-gray-500">Link to this section with #{sectionDomId(selectedSection)}.</p>
              </div>

              <div className={`rounded-xl border p-2.5 ${darkMode ? 'border-violet-500/20 bg-violet-500/5' : 'border-violet-200 bg-violet-50/60'}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-violet-400">{l('Responsive layout')}</span>
                  <span className="text-[9px] uppercase text-gray-500">{l(device)}</span>
                </div>
                {device === 'desktop' ? (
                  <p className="text-[9px] text-gray-500">{l('Desktop')} · {l('styles')}</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    <button type="button" onClick={resetSelectedSectionResponsive} className={`rounded-lg border px-2 py-1.5 text-[9px] font-semibold ${darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-violet-200 bg-white text-violet-700'}`}>{l('Reset')} {l(device)}</button>
                    {(['desktop', 'tablet', 'mobile'] as Device[]).filter((sourceDevice) => sourceDevice !== device).map((sourceDevice) => (
                      <button key={sourceDevice} type="button" onClick={() => copySelectedSectionResponsiveFrom(sourceDevice)} className={`rounded-lg border px-2 py-1.5 text-[9px] font-semibold ${darkMode ? 'border-violet-500/20 text-violet-300 hover:bg-violet-500/10' : 'border-violet-200 bg-white text-violet-700'}`}>{l('Copy')} {l(sourceDevice)}</button>
                    ))}
                  </div>
                )}
              </div>

              <div className={`space-y-3 rounded-xl border p-3 ${darkMode ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-indigo-200 bg-indigo-50/60'}`}>
                <div>
                  <p className="text-xs font-bold text-indigo-400">{l('Section Layout')}</p>
                  <p className="mt-0.5 text-[10px] text-gray-500">{l("Choose columns for this section. Mobile automatically collapses to one column.")}</p>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {([['stack', 'Stack'], ['two-column', '2 Columns'], ['three-column', '3 Columns']] as const).map(([layout, label]) => (
                    <button key={layout} type="button" onClick={() => setSelectedSectionLayout(layout)} className={`rounded-lg border px-2 py-2 text-[10px] font-semibold ${(selectedSection.layout || 'stack') === layout ? 'border-indigo-400 bg-indigo-500 text-white' : darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100'}`}>{label}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-gray-500">{l('Gap')}<input type="number" min="0" max="80" value={sectionLayoutGap(effectiveSectionStyle(selectedSection, device))} onChange={(e) => updateSelectedSectionResponsive({ layoutGap: Math.min(80, Math.max(0, Number(e.target.value) || 0)) })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-indigo-200 bg-white'}`} />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Alignment')}<select value={sectionLayoutAlign(selectedSection)} onChange={(e) => updateSelected({ layoutAlign: e.target.value as SectionLayoutAlign })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-indigo-200 bg-white'}`}>
                      <option value="start">{l('Start')}</option><option value="center">{l('Center')}</option><option value="end">{l('End')}</option><option value="stretch">{l('Stretch')}</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className={`space-y-3 rounded-xl border p-3 ${darkMode ? 'border-fuchsia-500/20 bg-fuchsia-500/5' : 'border-fuchsia-200 bg-fuchsia-50/60'}`}>
                <div>
                  <p className="text-xs font-bold text-fuchsia-400">{l('Section Visuals')}</p>
                  <p className="mt-0.5 text-[10px] text-gray-500">{l("Control background, spacing, height and content width for this section.")}</p>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {([['color', 'Color'], ['gradient', 'Gradient'], ['image', 'Image']] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateSelected({ backgroundMode: mode as SectionBackgroundMode })}
                      className={`rounded-lg border px-2 py-2 text-[10px] font-semibold ${sectionBackgroundMode(selectedSection) === mode ? 'border-fuchsia-400 bg-fuchsia-500 text-white' : darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-fuchsia-200 bg-white text-fuchsia-700 hover:bg-fuchsia-100'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {sectionBackgroundMode(selectedSection) === 'gradient' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] text-gray-500">{l('From')}<div className="mt-1 flex gap-1.5">
                          <input type="color" value={safeSectionColor(selectedSection.gradientFrom, selectedSection.background || '#111827')} onChange={(e) => updateSelected({ gradientFrom: e.target.value })} className="h-8 w-10 rounded border-0 bg-transparent" />
                          <input value={safeSectionColor(selectedSection.gradientFrom, selectedSection.background || '#111827')} onChange={(e) => updateSelected({ gradientFrom: e.target.value })} className={`min-w-0 flex-1 rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                        </div>
                      </label>
                      <label className="text-[10px] text-gray-500">{l('To')}<div className="mt-1 flex gap-1.5">
                          <input type="color" value={safeSectionColor(selectedSection.gradientTo, selectedSection.accent || '#7c3aed')} onChange={(e) => updateSelected({ gradientTo: e.target.value })} className="h-8 w-10 rounded border-0 bg-transparent" />
                          <input value={safeSectionColor(selectedSection.gradientTo, selectedSection.accent || '#7c3aed')} onChange={(e) => updateSelected({ gradientTo: e.target.value })} className={`min-w-0 flex-1 rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                        </div>
                      </label>
                    </div>
                    <label className="block text-[10px] text-gray-500">{l('Gradient angle')}<input type="range" min="0" max="360" value={sectionVisualNumber(selectedSection.gradientAngle, 135, 0, 360)} onChange={(e) => updateSelected({ gradientAngle: Number(e.target.value) })} className="mt-1 w-full" />
                      <span className="text-[9px] text-gray-500">{sectionVisualNumber(selectedSection.gradientAngle, 135, 0, 360)}°</span>
                    </label>
                  </div>
                )}

                {sectionBackgroundMode(selectedSection) === 'image' && (
                  <div className="space-y-2">
                    <label className="block text-[10px] text-gray-500">{l('Background image URL')}<input
                        value={selectedSection.backgroundImage || ''}
                        onChange={(e) => updateSelected({ backgroundImage: e.target.value })}
                        placeholder="https://..."
                        className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`}
                      />
                    </label>
                    {selectedElement?.type === 'image' && selectedElement.src && (
                      <button type="button" onClick={() => updateSelected({ backgroundImage: selectedElement.src, backgroundMode: 'image' })} className="w-full rounded-lg border border-fuchsia-500/30 px-2 py-1.5 text-[10px] font-semibold text-fuchsia-400">{l("Use selected image as background")}</button>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] text-gray-500">{l('Position')}<select value={sectionBackgroundPosition(selectedSection)} onChange={(e) => updateSelected({ backgroundPosition: e.target.value as SectionBackgroundPosition })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-fuchsia-200 bg-white'}`}>
                          <option value="center">{l('Center')}</option><option value="top">{l('Top')}</option><option value="bottom">{l('Bottom')}</option><option value="left">{l('Left')}</option><option value="right">{l('Right')}</option>
                        </select>
                      </label>
                      <label className="text-[10px] text-gray-500">{l('Size')}<select value={sectionBackgroundSize(selectedSection)} onChange={(e) => updateSelected({ backgroundSize: e.target.value as SectionBackgroundSize })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-fuchsia-200 bg-white'}`}>
                          <option value="cover">{l('Cover')}</option><option value="contain">{l('Contain')}</option><option value="auto">{l('Auto')}</option>
                        </select>
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] text-gray-500">{l('Overlay')}<input type="color" value={safeSectionColor(selectedSection.overlayColor, '#000000')} onChange={(e) => updateSelected({ overlayColor: e.target.value })} className="mt-1 h-8 w-full rounded border-0 bg-transparent" />
                      </label>
                      <label className="text-[10px] text-gray-500">{l('Opacity')}<input type="range" min="0" max="1" step="0.05" value={sectionVisualNumber(selectedSection.overlayOpacity, 0.35, 0, 1)} onChange={(e) => updateSelected({ overlayOpacity: Number(e.target.value) })} className="mt-2 w-full" />
                        <span className="text-[9px] text-gray-500">{Math.round(sectionVisualNumber(selectedSection.overlayOpacity, 0.35, 0, 1) * 100)}%</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-gray-500">{l('Min height')}<input type="number" min="0" max="1200" value={sectionVisualNumber(effectiveSectionStyle(selectedSection, device).minHeight, 0, 0, 1200)} onChange={(e) => updateSelectedSectionResponsive({ minHeight: Math.min(1200, Math.max(0, Number(e.target.value) || 0)) })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Corner radius')}<input type="number" min="0" max="80" value={sectionVisualNumber(selectedSection.sectionRadius, 0, 0, 80)} onChange={(e) => updateSelected({ sectionRadius: Math.min(80, Math.max(0, Number(e.target.value) || 0)) })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Vertical padding')}<input type="number" min="0" max="240" value={sectionVisualNumber(effectiveSectionStyle(selectedSection, device).sectionPaddingY, theme.sectionSpacing, 0, 240)} onChange={(e) => updateSelectedSectionResponsive({ sectionPaddingY: Math.min(240, Math.max(0, Number(e.target.value) || 0)) })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                  </label>
                  <label className="text-[10px] text-gray-500">{l('Horizontal padding')}<input type="number" min="0" max="160" value={sectionVisualNumber(effectiveSectionStyle(selectedSection, device).sectionPaddingX, 24, 0, 160)} onChange={(e) => updateSelectedSectionResponsive({ sectionPaddingX: Math.min(160, Math.max(0, Number(e.target.value) || 0)) })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-fuchsia-200 bg-white'}`} />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {([['boxed', 'Boxed'], ['full', 'Full width']] as const).map(([width, label]) => (
                    <button key={width} type="button" onClick={() => updateSelected({ contentWidth: width as SectionContentWidth })} className={`rounded-lg border px-2 py-2 text-[10px] font-semibold ${sectionContentWidth(selectedSection) === width ? 'border-fuchsia-400 bg-fuchsia-500 text-white' : darkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-fuchsia-200 bg-white text-fuchsia-700 hover:bg-fuchsia-100'}`}>{label}</button>
                  ))}
                </div>
              </div>

              {selectedSection.type === 'contact' && (
                <div className={`space-y-3 rounded-xl border p-3 ${darkMode ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50/60'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-cyan-400">{l('Form Builder')}</p>
                      <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{l("Add, edit and reorder the fields visitors must fill in.")}</p>
                    </div>
                    <button type="button" onClick={resetContactForm} className="text-[10px] font-semibold text-cyan-400">{l('Reset')}</button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-gray-500">{l('Form name')}<input value={selectedSection.formName || selectedSection.title || 'Contact form'} onChange={(e) => updateSelected({ formName: e.target.value })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} /></label>
                    <label className="text-[10px] text-gray-500">{l('Spam protection')}<select value={selectedSection.formSpamProtection === 'enhanced' ? 'enhanced' : 'standard'} onChange={(e) => updateSelected({ formSpamProtection: e.target.value === 'enhanced' ? 'enhanced' : 'standard' })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}><option value="standard">{l('Standard')}</option><option value="enhanced">{l('Enhanced')}</option></select></label>
                  </div>
                  <label className="block text-[10px] text-gray-500">{l('Minimum completion time')}<input type="number" min="1" max="60" value={selectedSection.formMinimumCompletionSeconds || 3} onChange={(e) => updateSelected({ formMinimumCompletionSeconds: Math.min(60, Math.max(1, Number(e.target.value) || 3)) })} className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} /></label>

                  <div className="space-y-2">
                    {(selectedSection.formFields ?? createDefaultContactFormFields()).map((field, fieldIndex, fieldList) => (
                      <div key={field.id} className={`rounded-lg border p-2 ${darkMode ? 'border-white/10 bg-black/10' : 'border-gray-200 bg-white'}`}>
                        <div className="mb-2 flex items-center gap-1">
                          <select
                            value={field.type}
                            onChange={(e) => updateFormField(field.id, {
                              type: e.target.value as WebsiteFormFieldType,
                              options: e.target.value === 'select' || e.target.value === 'radio' ? (field.options?.length ? field.options : ['Option 1', 'Option 2']) : undefined,
                            })}
                            className={`min-w-0 flex-1 rounded border px-2 py-1 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}
                          >
                            <option value="text">{l('Text')}</option>
                            <option value="email">{l('Email')}</option>
                            <option value="tel">{l('Phone')}</option>
                            <option value="url">URL</option>
                            <option value="number">{l('Number')}</option>
                            <option value="date">{l('Date')}</option>
                            <option value="textarea">{l('Textarea')}</option>
                            <option value="select">{l('Select')}</option>
                            <option value="radio">{l('Radio')}</option>
                            <option value="checkbox">{l('Checkbox')}</option>
                            <option value="file">{l('File upload')}</option>
                          </select>
                          <button type="button" onClick={() => moveFormField(field.id, 'up')} disabled={fieldIndex === 0} className="rounded p-1 text-gray-400 disabled:opacity-25" title={l('Move up')}><ChevronUp className="h-3 w-3" /></button>
                          <button type="button" onClick={() => moveFormField(field.id, 'down')} disabled={fieldIndex === fieldList.length - 1} className="rounded p-1 text-gray-400 disabled:opacity-25" title={l('Move down')}><ChevronDown className="h-3 w-3" /></button>
                          <button type="button" onClick={() => deleteFormField(field.id)} className="rounded p-1 text-rose-400" title={l('Delete field')}><Trash2 className="h-3 w-3" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={field.label}
                            onChange={(e) => updateFormField(field.id, { label: e.target.value })}
                            placeholder={l('Label')}
                            className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}
                          />
                          <input
                            value={field.name}
                            onChange={(e) => updateFormField(field.id, { name: e.target.value })}
                            placeholder="field_name"
                            className={`rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}
                          />
                        </div>
                        {field.type !== 'checkbox' && field.type !== 'file' && (
                          <input
                            value={field.placeholder || ''}
                            onChange={(e) => updateFormField(field.id, { placeholder: e.target.value })}
                            placeholder={l('Placeholder')}
                            className={`mt-2 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}
                          />
                        )}
                        {(field.type === 'select' || field.type === 'radio') && (
                          <textarea
                            value={(field.options || []).join('\n')}
                            onChange={(e) => updateFormField(field.id, { options: e.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })}
                            rows={3}
                            placeholder={'One option per line'}
                            className={`mt-2 w-full resize-none rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}
                          />
                        )}
                        <input value={field.helpText || ''} onChange={(e) => updateFormField(field.id, { helpText: e.target.value })} placeholder={l('Help text')} className={`mt-2 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} />
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <label className="text-[9px] text-gray-500">{l('Width')}<select value={field.width || 'full'} onChange={(e) => updateFormField(field.id, { width: e.target.value === 'half' ? 'half' : 'full' })} className={`mt-1 w-full rounded border px-2 py-1 text-[9px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}><option value="full">{l('Full width')}</option><option value="half">{l('Half width')}</option></select></label>
                          {field.type === 'file' ? <label className="text-[9px] text-gray-500">{l('Max file MB')}<input type="number" min="1" max="10" value={field.validation?.maxFileSizeMb || 5} onChange={(e) => updateFormField(field.id, { validation: { ...field.validation, maxFileSizeMb: Math.min(10, Math.max(1, Number(e.target.value) || 5)) } })} className={`mt-1 w-full rounded border px-2 py-1 text-[9px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} /></label> : field.type === 'number' ? <label className="text-[9px] text-gray-500">{l('Minimum')} / {l('Maximum')}<div className="mt-1 flex gap-1"><input type="number" value={field.validation?.min ?? ''} onChange={(e) => updateFormField(field.id, { validation: { ...field.validation, min: e.target.value === '' ? undefined : Number(e.target.value) } })} className={`min-w-0 flex-1 rounded border px-2 py-1 text-[9px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} /><input type="number" value={field.validation?.max ?? ''} onChange={(e) => updateFormField(field.id, { validation: { ...field.validation, max: e.target.value === '' ? undefined : Number(e.target.value) } })} className={`min-w-0 flex-1 rounded border px-2 py-1 text-[9px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} /></div></label> : <label className="text-[9px] text-gray-500">{l('Min length')} / {l('Max length')}<div className="mt-1 flex gap-1"><input type="number" min="0" max="10000" value={field.validation?.minLength ?? ''} onChange={(e) => updateFormField(field.id, { validation: { ...field.validation, minLength: e.target.value === '' ? undefined : Number(e.target.value) } })} className={`min-w-0 flex-1 rounded border px-2 py-1 text-[9px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} /><input type="number" min="1" max="10000" value={field.validation?.maxLength ?? ''} onChange={(e) => updateFormField(field.id, { validation: { ...field.validation, maxLength: e.target.value === '' ? undefined : Number(e.target.value) } })} className={`min-w-0 flex-1 rounded border px-2 py-1 text-[9px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} /></div></label>}
                        </div>
                        {field.type === 'file' && <input value={(field.validation?.accept || []).join(',')} onChange={(e) => updateFormField(field.id, { validation: { ...field.validation, accept: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) } })} placeholder="image/png, application/pdf" className={`mt-2 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} />}
                        {!['file', 'number', 'date', 'checkbox', 'select', 'radio'].includes(field.type) && <input value={field.validation?.pattern || ''} onChange={(e) => updateFormField(field.id, { validation: { ...field.validation, pattern: e.target.value } })} placeholder={l('Validation pattern')} className={`mt-2 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} />}
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <select value={field.conditions?.[0]?.fieldName || ''} onChange={(e) => updateFormField(field.id, { conditions: e.target.value ? [{ fieldName: e.target.value, operator: field.conditions?.[0]?.operator || 'equals', value: field.conditions?.[0]?.value || '' }] : [] })} className={`rounded border px-2 py-1 text-[9px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}><option value="">{l('Always visible')}</option>{fieldList.filter((candidate) => candidate.id !== field.id).map((candidate) => <option key={candidate.id} value={candidate.name}>{l('When')} {candidate.label}</option>)}</select>
                          {field.conditions?.[0] && <select value={field.conditions[0].operator} onChange={(e) => updateFormField(field.id, { conditions: [{ ...field.conditions![0], operator: e.target.value as NonNullable<WebsiteFormField['conditions']>[number]['operator'] }] })} className={`rounded border px-2 py-1 text-[9px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}><option value="equals">{l('Equals')}</option><option value="not-equals">{l('Not equal')}</option><option value="contains">{l('Contains')}</option><option value="not-empty">{l('Is not empty')}</option><option value="empty">{l('Is empty')}</option></select>}
                          {field.conditions?.[0] && !['empty', 'not-empty'].includes(field.conditions[0].operator) && <input value={field.conditions[0].value || ''} onChange={(e) => updateFormField(field.id, { conditions: [{ ...field.conditions![0], value: e.target.value }] })} placeholder={l('Equals value')} className={`rounded border px-2 py-1 text-[9px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} />}
                        </div>
                        <label className="mt-2 flex items-center gap-2 text-[10px] text-gray-400">
                          <input type="checkbox" checked={field.required} onChange={(e) => updateFormField(field.id, { required: e.target.checked })} />{l("Required field")}</label>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {(['text', 'email', 'tel', 'number', 'date', 'textarea', 'select', 'radio', 'checkbox', 'file'] as WebsiteFormFieldType[]).map((type) => (
                      <button key={type} type="button" onClick={() => addFormField(type)} className={`rounded-lg border px-2 py-1.5 text-[10px] font-semibold ${darkMode ? 'border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/10' : 'border-cyan-200 text-cyan-700 hover:bg-cyan-100'}`}>
                        + {type === 'tel' ? 'Phone' : type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>

                  <div className={`space-y-2 rounded-lg border p-2 ${darkMode ? 'border-violet-500/20 bg-violet-500/5' : 'border-violet-200 bg-violet-50'}`}>
                    <div className="flex items-center justify-between"><strong className="text-[10px] text-violet-400">{l('Automations')}</strong><div className="flex gap-1"><button type="button" onClick={() => addFormAutomation('email')} className="text-[9px] font-semibold text-cyan-400">+ {l('Email')}</button><button type="button" onClick={() => addFormAutomation('webhook')} className="text-[9px] font-semibold text-cyan-400">+ {l('Webhook')}</button></div></div>
                    {!(selectedSection.formAutomations || []).length && <p className="text-[9px] text-gray-500">{l('No automation runs after submission.')}</p>}
                    {(selectedSection.formAutomations || []).map((automation) => <div key={automation.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2"><input type="checkbox" checked={automation.enabled} onChange={(e) => updateFormAutomation(automation.id, { enabled: e.target.checked })} /><input value={automation.destination} onChange={(e) => updateFormAutomation(automation.id, { destination: e.target.value })} placeholder={automation.action === 'email' ? 'team@example.com' : 'https://api.example.com/hook'} className={`min-w-0 rounded border px-2 py-1 text-[9px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`} /><button type="button" onClick={() => deleteFormAutomation(automation.id)} className="text-rose-400" aria-label={l('Delete automation')}>×</button></div>)}
                    <p className="text-[8px] text-gray-500">{l('Webhook payloads are signed and delivery attempts appear in the submission log.')}</p>
                  </div>

                  <label className="block text-[10px] text-gray-500">{l('After submit')}<select
                      value={selectedSection.formSuccessAction === 'redirect' ? 'redirect' : 'message'}
                      onChange={(e) => updateSelected({ formSuccessAction: e.target.value === 'redirect' ? 'redirect' : 'message' })}
                      className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-[#111122]' : 'border-gray-200 bg-white'}`}
                    >
                      <option value="message">{l('Show success message')}</option>
                      <option value="redirect">{l('Redirect to thank-you page / URL')}</option>
                    </select>
                  </label>

                  {selectedSection.formSuccessAction === 'redirect' ? (
                    <div className="space-y-2">
                      <label className="block text-[10px] text-gray-500">{l('Redirect target')}<input
                          value={selectedSection.formRedirectUrl || ''}
                          onChange={(e) => updateSelected({ formRedirectUrl: e.target.value })}
                          placeholder="page:thank-you or https://example.com/thanks"
                          className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}
                        />
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {pages.map((page) => (
                          <button key={page.id} type="button" onClick={() => updateSelected({ formRedirectUrl: `page:${page.slug}` })} className={`rounded border px-2 py-1 text-[9px] ${darkMode ? 'border-white/10 text-gray-300' : 'border-gray-200 text-gray-600'}`}>{page.name}</button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <label className="block text-[10px] text-gray-500">{l('Success message')}<input
                        value={selectedSection.formSuccessMessage || 'Thanks! Your message has been sent.'}
                        onChange={(e) => updateSelected({ formSuccessMessage: e.target.value })}
                        className={`mt-1 w-full rounded border px-2 py-1.5 text-[10px] ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}
                      />
                    </label>
                  )}
                </div>
              )}

              {selectedSection.type !== 'footer' && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-400">{l("Button Text")}</label>
                    <input
                      value={selectedSection.buttonText}
                      onChange={(e) =>
                        updateSelected({ buttonText: e.target.value })
                      }
                      className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${
                        darkMode
                          ? 'border-white/10 bg-white/5 text-white'
                          : 'border-gray-200 bg-gray-50 text-gray-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-400">
                      <Link className="h-3.5 w-3.5" />{l("Button Link")}</label>
                    <input
                      value={selectedSection.buttonUrl}
                      onChange={(e) =>
                        updateSelected({ buttonUrl: e.target.value })
                      }
                      placeholder="#contact or https://..."
                      className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${
                        darkMode
                          ? 'border-white/10 bg-white/5 text-white'
                          : 'border-gray-200 bg-gray-50 text-gray-900'
                      }`}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-400">
                  <Palette className="h-3.5 w-3.5" />{l('Background')}</label>

                <div className="flex gap-2">
                  <input
                    type="color"
                    value={selectedSection.background}
                    onChange={(e) =>
                      updateSelected({ background: e.target.value })
                    }
                    className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent"
                  />
                  <input
                    value={selectedSection.background}
                    onChange={(e) =>
                      updateSelected({ background: e.target.value })
                    }
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs uppercase outline-none focus:border-violet-500 ${
                      darkMode
                        ? 'border-white/10 bg-white/5 text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">{l("Accent")}</label>

                <div className="flex gap-2">
                  <input
                    type="color"
                    value={selectedSection.accent}
                    onChange={(e) =>
                      updateSelected({ accent: e.target.value })
                    }
                    className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent"
                  />
                  <input
                    value={selectedSection.accent}
                    onChange={(e) =>
                      updateSelected({ accent: e.target.value })
                    }
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs uppercase outline-none focus:border-violet-500 ${
                      darkMode
                        ? 'border-white/10 bg-white/5 text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-900'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-violet-300">{l("AI Image")}</label>

                  <textarea
                    value={selectedSection.imagePrompt || ''}
                    onChange={(e) =>
                      updateSelected({ imagePrompt: e.target.value })
                    }
                    rows={3}
                    placeholder={l('Describe the image you want for this section...')}
                    className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${
                      darkMode
                        ? 'border-white/10 bg-white/5 text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-900'
                    }`}
                  />
                </div>

                <button
                  onClick={generateImagePrompt}
                  disabled={aiBusy || aiQualityBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-300 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {aiBusy ? 'Generating...' : '✨ Generate AI Prompt'}
                </button>

                <button
                  onClick={generateRealImage}
                  disabled={aiBusy || aiQualityBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {aiBusy ? 'Generating Image...' : '🖼️ Generate Image'}
                </button>

                {selectedSection.image &&
                  /^https?:\/\//i.test(selectedSection.image) && (
                    <img
                      src={selectedSection.image}
                      alt={selectedSection.title}
                      className="mt-2 w-full rounded-lg border border-white/10 object-cover"
                    />
                  )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => moveSection(selectedSection.id, 'up')}
                  className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs ${
                    darkMode
                      ? 'border-white/10 text-gray-300 hover:bg-white/5'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                  Up
                </button>

                <button
                  onClick={() => moveSection(selectedSection.id, 'down')}
                  className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs ${
                    darkMode
                      ? 'border-white/10 text-gray-300 hover:bg-white/5'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <ChevronDown className="h-3.5 w-3.5" />{l("Down")}</button>
              </div>

              <button
                onClick={() => deleteSection(selectedSection.id)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />{l("Delete Section")}</button>
              </div>
            </details>
  );
}
