import { Briefcase, PenLine, GraduationCap, Building2, Zap, Image } from 'lucide-react';
import { CategoryMeta, ToolCategory } from './types';

export const CATEGORIES: CategoryMeta[] = [
  { id: 'career', label: 'Career', icon: Briefcase, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { id: 'writing', label: 'Writing', icon: PenLine, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  { id: 'study', label: 'Study', icon: GraduationCap, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { id: 'business', label: 'Business', icon: Building2, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { id: 'productivity', label: 'Productivity', icon: Zap, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10' },
  { id: 'images', label: 'Images', icon: Image, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
];

export function getCategory(id: ToolCategory): CategoryMeta | undefined {
  return CATEGORIES.find(c => c.id === id);
}
