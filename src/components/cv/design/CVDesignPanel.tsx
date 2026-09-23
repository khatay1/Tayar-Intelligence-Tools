import React from 'react';
import { GripVertical, Type } from 'lucide-react';
import { COLOR_THEMES, ColorTheme, FONT_OPTIONS, SectionConfig, TEMPLATES, TemplateId } from '@/lib/cv-types';

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
  return <div className="space-y-6">
    <div><h3 className="text-white text-sm font-semibold mb-3">Resume Template</h3><div className="grid grid-cols-2 gap-2">{TEMPLATES.map(t => <button key={t.id} onClick={() => props.setTemplate(t.id)} className={`p-3 rounded-xl border text-left ${props.template === t.id ? 'border-violet-500/50 bg-violet-600/10' : 'border-white/10'}`}><div className="text-white text-xs font-medium">{t.name}</div><div className="text-gray-500 text-[10px] mt-0.5">{t.description}</div></button>)}</div></div>
    <div><h3 className="text-white text-sm font-semibold mb-3">Color Theme</h3><div className="grid grid-cols-3 gap-2">{COLOR_THEMES.map(c => <button key={c.id} onClick={() => props.setColorTheme(c.id)} className={`flex items-center gap-2 p-2.5 rounded-xl border ${props.colorTheme === c.id ? 'border-violet-500/50 bg-violet-600/10' : 'border-white/10'}`}><span className="w-5 h-5 rounded-full" style={{ background: c.primary }} /><span className="text-white text-xs">{c.name}</span></button>)}</div></div>
    <div><h3 className="text-white text-sm font-semibold mb-3 flex items-center gap-1.5"><Type className="w-4 h-4 text-gray-500" />Font Family</h3><div className="grid grid-cols-2 gap-2">{FONT_OPTIONS.map(f => <button key={f.id} onClick={() => props.setFontId(f.id)} className={`p-2.5 rounded-xl border text-left ${props.fontId === f.id ? 'border-violet-500/50 bg-violet-600/10' : 'border-white/10'}`}><div className="text-white text-xs" style={{ fontFamily: f.family }}>{f.name}</div><div className="text-gray-500 text-[10px] capitalize">{f.category}</div></button>)}</div></div>
    <div><h3 className="text-white text-sm font-semibold mb-3 flex items-center gap-1.5"><GripVertical className="w-4 h-4 text-gray-500" />Section Order</h3><div className="space-y-1.5">{props.sections.map((section, index) => <div key={section.id} draggable onDragStart={() => props.dragStart(index)} onDragEnd={props.dragEnd} onDragOver={e => e.preventDefault()} onDrop={() => props.drop(index)} className={`flex items-center gap-2 rounded-lg border p-2 ${props.draggedIndex === index ? 'opacity-50 border-violet-500/50' : 'border-white/10'}`}><GripVertical className="w-4 h-4 text-gray-600 cursor-grab" /><span className="flex-1 text-xs text-gray-300">{section.label}</span><button onClick={() => props.toggle(section.id)} className={`w-8 h-4 rounded-full p-0.5 ${section.visible ? 'bg-violet-600' : 'bg-gray-700'}`}><span className={`block w-3 h-3 rounded-full bg-white transition-transform ${section.visible ? 'translate-x-4' : ''}`} /></button></div>)}</div></div>
  </div>;
}
