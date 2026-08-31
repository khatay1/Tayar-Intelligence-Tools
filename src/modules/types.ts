import { LucideIcon } from 'lucide-react';
import { ComponentType } from 'react';

export type ToolCategory = 'career' | 'writing' | 'study' | 'business' | 'productivity' | 'images';
export type ToolStatus = 'active' | 'beta' | 'soon';
export type ToolTier = 'free' | 'premium';

export interface ToolModule {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  status: ToolStatus;
  tier: ToolTier;
  version: string;
  icon: LucideIcon;
  component: ComponentType<{ darkMode: boolean; projectId?: string | null }>;
  defaultModel?: string;
}

export interface CategoryMeta {
  id: ToolCategory;
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}
