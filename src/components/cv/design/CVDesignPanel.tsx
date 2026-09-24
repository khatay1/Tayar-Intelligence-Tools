import React from 'react';
import { ArrowDown, ArrowUp, GripVertical, Type } from 'lucide-react';
import { COLOR_THEMES, ColorTheme, FONT_OPTIONS, SectionConfig, TEMPLATES, TemplateId } from '@/lib/cv-types';
import { useCVText } from '../i18n/use-cv-text';

interface Props {
  template: TemplateId;
  colorTheme: ColorTheme;
  fontId: string;
  sections: SectionConfig[];
  setTemplate: (value: TemplateId) => void;
  setColorTheme: (value: ColorTheme) => void;
  setFontId: (value: string) => void;
  draggedIndex: number | null;
  dragStart: (index: number) => void;
  dragEnd: () => void;
  drop: (index: number) => void;
  toggle: (id: SectionConfig['id']) => void;
}

export function CVDesignPanel(props: Props) {
  const t = useCVText();
  const move = (from: number, to: number) => {
    if (to < 0 || to >= props.sections.length || from === to) return;
    props.dragStart(from);
    props.drop(to);
    props.dragEnd();
  };

  return <div className="space-y-6">
    <div><h3 className="text-white text-sm font-semibold mb-3">{t('Resume Template')}</h3><div className="grid grid-cols-2 gap-2">{TEMPLATES.map(item => <button type="button" aria-pressed={props.template === item.id} key={item.id} onClick={() => props.setTemplate(item.id)} className={`p-3 rounded-xl border text-left ${props.template === item.id ? 'border-violet-500/50 bg-violet-600/10' : 'border-white/10'}`}><div className="text-white text-xs font-medium">{t(item.name)}</div><div className="text-gray-500 text-[10px] mt-0.5">{t(item.description)}</div></button>)}</div></div>
    <div><h3 className="text-white text-sm font-semibold mb-3">{t('Color Theme')}</h3><div className="grid grid-cols-3 gap-2">{COLOR_THEMES.map(theme => <button type="button" aria-pressed={props.colorTheme === theme.id} aria-label={`${t(theme.name)} ${t('color theme')}`} key={theme.id} onClick={() => props.setColorTheme(theme.id)} className={`flex items-center gap-2 p-2.5 rounded-xl border ${props.colorTheme === theme.id ? 'border-violet-500/50 bg-violet-600/10' : 'border-white/10'}`}><span aria-hidden="true" className="w-5 h-5 rounded-full" style={{ background: theme.primary }} /><span className="text-white text-xs">{t(theme.name)}</span></button>)}</div></div>
    <div><h3 className="text-white text-sm font-semibold mb-3 flex items-center gap-1.5"><Type aria-hidden="true" className="w-4 h-4 text-gray-500" />{t('Font Family')}</h3><div className="grid grid-cols-2 gap-2">{FONT_OPTIONS.map(font => <button type="button" aria-pressed={props.fontId === font.id} key={font.id} onClick={() => props.setFontId(font.id)} className={`p-2.5 rounded-xl border text-left ${props.fontId === font.id ? 'border-violet-500/50 bg-violet-600/10' : 'border-white/10'}`}><div className="text-white text-xs" style={{ fontFamily: font.family }}>{font.name}</div><div className="text-gray-500 text-[10px] capitalize">{t(font.category)}</div></button>)}</div></div>
    <div><h3 className="text-white text-sm font-semibold mb-3 flex items-center gap-1.5"><GripVertical aria-hidden="true" className="w-4 h-4 text-gray-500" />{t('Section Order')}</h3><div className="space-y-1.5">{props.sections.map((section, index) => <div key={section.id} draggable onDragStart={() => props.dragStart(index)} onDragEnd={props.dragEnd} onDragOver={event => event.preventDefault()} onDrop={() => props.drop(index)} className={`flex items-center gap-2 rounded-lg border p-2 ${props.draggedIndex === index ? 'opacity-50 border-violet-500/50' : 'border-white/10'}`}><GripVertical aria-hidden="true" className="w-4 h-4 text-gray-600 cursor-grab" /><span className="flex-1 text-xs text-gray-300">{t(section.label)}</span><button type="button" disabled={index === 0} aria-label={`${t('Move')} ${t(section.label)} ${t('up')}`} onClick={() => move(index, index - 1)} className="disabled:opacity-30"><ArrowUp aria-hidden="true" className="w-3.5 h-3.5" /></button><button type="button" disabled={index === props.sections.length - 1} aria-label={`${t('Move')} ${t(section.label)} ${t('down')}`} onClick={() => move(index, index + 1)} className="disabled:opacity-30"><ArrowDown aria-hidden="true" className="w-3.5 h-3.5" /></button><button type="button" role="switch" aria-checked={section.visible} aria-label={`${t(section.visible ? 'Hide' : 'Show')} ${t(section.label)}`} onClick={() => props.toggle(section.id)} className={`w-8 h-4 rounded-full p-0.5 ${section.visible ? 'bg-violet-600' : 'bg-gray-700'}`}><span aria-hidden="true" className={`block w-3 h-3 rounded-full bg-white transition-transform ${section.visible ? 'translate-x-4' : ''}`} /></button></div>)}</div></div>
  </div>;
}
