import React from 'react';
import { Award, Briefcase, FileText, FolderOpen, Trash2, Type, Zap } from 'lucide-react';
import { CVData } from '@/lib/cv-types';
import { CVCollectionKey } from '../core/cv-operations';

interface Props {
  cv: CVData;
  section: string;
  setCV: (next: CVData | ((current: CVData) => CVData)) => void;
  editor: {
    updateItem: <K extends CVCollectionKey>(collection: K, id: string, patch: Partial<CVData[K][number]>) => void;
    deleteItem: <K extends CVCollectionKey>(collection: K, id: string) => void;
    addExperience: () => void; addEducation: () => void; addSkill: () => void; addLanguage: () => void;
    addProject: () => void; addCertificate: () => void; addAward: () => void;
  };
}

const input = 'w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50';
const Add = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => <button onClick={onClick} className="w-full border border-dashed border-white/15 hover:border-violet-500/40 text-gray-400 hover:text-violet-300 rounded-xl py-2 text-xs">+ {children}</button>;
const Empty = ({ icon: Icon, text }: { icon: React.ElementType; text: string }) => <div className="py-6 text-center text-gray-500 text-xs"><Icon className="w-5 h-5 mx-auto mb-2 opacity-50" />{text}</div>;

export function CVContentEditor({ cv, section, setCV, editor }: Props) {
  if (section === 'summary') return <textarea className={input + ' min-h-[200px] resize-y'} value={cv.summary} onChange={e => setCV({ ...cv, summary: e.target.value })} />;
  if (section === 'experience') return <div className="space-y-3">{!cv.experience.length && <Empty icon={Briefcase} text="No experience yet" />}{cv.experience.map(item => <div key={item.id} className="border border-white/10 rounded-xl p-3 space-y-2"><div className="flex justify-end"><button onClick={() => editor.deleteItem('experience', item.id)}><Trash2 className="w-4 h-4 text-red-400" /></button></div><input className={input} value={item.jobTitle} placeholder="Job title" onChange={e => editor.updateItem('experience', item.id, { jobTitle: e.target.value })} /><input className={input} value={item.company} placeholder="Company" onChange={e => editor.updateItem('experience', item.id, { company: e.target.value })} /><textarea className={input + ' min-h-[90px]'} value={item.description} placeholder="Description" onChange={e => editor.updateItem('experience', item.id, { description: e.target.value })} /></div>)}<Add onClick={editor.addExperience}>Add Experience</Add></div>;
  if (section === 'education') return <div className="space-y-3">{!cv.education.length && <Empty icon={FileText} text="No education yet" />}{cv.education.map(item => <div key={item.id} className="border border-white/10 rounded-xl p-3 space-y-2"><button className="float-right" onClick={() => editor.deleteItem('education', item.id)}><Trash2 className="w-4 h-4 text-red-400" /></button><input className={input} value={item.degree} placeholder="Degree" onChange={e => editor.updateItem('education', item.id, { degree: e.target.value })} /><input className={input} value={item.institution} placeholder="Institution" onChange={e => editor.updateItem('education', item.id, { institution: e.target.value })} /></div>)}<Add onClick={editor.addEducation}>Add Education</Add></div>;
  if (section === 'skills') return <div className="space-y-2">{!cv.skills.length && <Empty icon={Zap} text="No skills yet" />}{cv.skills.map(item => <div key={item.id} className="flex gap-2"><input className={input} value={item.name} onChange={e => editor.updateItem('skills', item.id, { name: e.target.value })} /><button onClick={() => editor.deleteItem('skills', item.id)}><Trash2 className="w-4 h-4 text-red-400" /></button></div>)}<Add onClick={editor.addSkill}>Add Skill</Add></div>;
  if (section === 'languages') return <div className="space-y-2">{!cv.languages.length && <Empty icon={Type} text="No languages yet" />}{cv.languages.map(item => <div key={item.id} className="flex gap-2"><input className={input} value={item.name} onChange={e => editor.updateItem('languages', item.id, { name: e.target.value })} /><button onClick={() => editor.deleteItem('languages', item.id)}><Trash2 className="w-4 h-4 text-red-400" /></button></div>)}<Add onClick={editor.addLanguage}>Add Language</Add></div>;
  if (section === 'projects') return <div className="space-y-3">{!cv.projects.length && <Empty icon={FolderOpen} text="No projects yet" />}{cv.projects.map(item => <div key={item.id} className="border border-white/10 rounded-xl p-3 space-y-2"><button className="float-right" onClick={() => editor.deleteItem('projects', item.id)}><Trash2 className="w-4 h-4 text-red-400" /></button><input className={input} value={item.name} onChange={e => editor.updateItem('projects', item.id, { name: e.target.value })} /><textarea className={input} value={item.description} onChange={e => editor.updateItem('projects', item.id, { description: e.target.value })} /></div>)}<Add onClick={editor.addProject}>Add Project</Add></div>;
  if (section === 'certificates') return <div className="space-y-2">{cv.certificates.map(item => <div key={item.id} className="flex gap-2"><input className={input} value={item.name} onChange={e => editor.updateItem('certificates', item.id, { name: e.target.value })} /><button onClick={() => editor.deleteItem('certificates', item.id)}><Trash2 className="w-4 h-4 text-red-400" /></button></div>)}<Add onClick={editor.addCertificate}>Add Certificate</Add></div>;
  if (section === 'awards') return <div className="space-y-2">{!cv.awards.length && <Empty icon={Award} text="No awards yet" />}{cv.awards.map(item => <div key={item.id} className="flex gap-2"><input className={input} value={item.title} onChange={e => editor.updateItem('awards', item.id, { title: e.target.value })} /><button onClick={() => editor.deleteItem('awards', item.id)}><Trash2 className="w-4 h-4 text-red-400" /></button></div>)}<Add onClick={editor.addAward}>Add Award</Add></div>;
  return null;
}
