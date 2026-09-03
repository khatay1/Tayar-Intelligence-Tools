import {
  LayoutGrid, MessageSquare, FileText, Mail, BookOpen, PenLine,
  Languages, GraduationCap, FileStack, Image, FolderOpen,
  CreditCard, Settings, LifeBuoy, BarChart3, Shield, Info,
  HelpCircle, Bug, User, Folder, Trash2, Sparkles, Activity,
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export type ViewId =
  | 'dashboard' | 'my-workspace' | 'ai-chat' | 'cv-builder' | 'cover-letter'
  | 'document-ai' | 'ai-writer' | 'translator' | 'study-assistant'
  | 'pdf-tools' | 'image-tools' | 'my-files' | 'my-projects' | 'trash'
  | 'subscription' | 'settings' | 'support' | 'ai-usage' | 'profile'
  | 'privacy' | 'terms' | 'contact' | 'about' | 'help'
  | 'feedback' | 'bug-report' | 'activity-timeline' | 'invoice-generator' | 'templates-hub' | 'name-generator' | 'letter-generator' | 'prompt-library' | 'batch-image-tools' | 'image-cropper' | 'background-remover' | 'image-to-pdf' | 'code-assistant';

export interface NavItem {
  id: ViewId;
  label: string;
  icon: LucideIcon;
  badge?: string;
  group: 'main' | 'tools' | 'account';
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, group: 'main' },
  { id: 'my-workspace', label: 'My Workspace', icon: Sparkles, group: 'main' },
  { id: 'ai-chat', label: 'AI Chat', icon: MessageSquare, group: 'main' },
  { id: 'cv-builder', label: 'CV Builder', icon: FileText, group: 'tools' },
  { id: 'cover-letter', label: 'Cover Letter', icon: Mail, group: 'tools' },
  { id: 'document-ai', label: 'Document AI', icon: BookOpen, group: 'tools' },
  { id: 'ai-writer', label: 'AI Writer', icon: PenLine, group: 'tools' },
  { id: 'translator', label: 'Translator', icon: Languages, group: 'tools' },
  { id: 'study-assistant', label: 'Study Assistant', icon: GraduationCap, group: 'tools' },
  { id: 'pdf-tools', label: 'PDF Tools', icon: FileStack, group: 'tools' },
  { id: 'image-tools', label: 'Image Tools', icon: Image, badge: 'Soon', group: 'tools' },
  { id: 'my-files', label: 'My Files', icon: FolderOpen, group: 'main' },
  { id: 'my-projects', label: 'Projects', icon: Folder, group: 'main' },
  { id: 'trash', label: 'Trash', icon: Trash2, group: 'main' },
  { id: 'activity-timeline', label: 'Recent Activity', icon: Activity, group: 'main' },
  { id: 'ai-usage', label: 'AI Usage', icon: BarChart3, group: 'account' },
  { id: 'subscription', label: 'Subscription', icon: CreditCard, group: 'account' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'account' },
  { id: 'support', label: 'Support', icon: LifeBuoy, group: 'account' },
  { id: 'help', label: 'Help Center', icon: HelpCircle, group: 'account' },
  { id: 'about', label: 'About', icon: Info, group: 'account' },
  { id: 'contact', label: 'Contact', icon: Mail, group: 'account' },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare, group: 'account' },
  { id: 'bug-report', label: 'Report a Bug', icon: Bug, group: 'account' },
  { id: 'privacy', label: 'Privacy Policy', icon: Shield, group: 'account' },
  { id: 'terms', label: 'Terms of Service', icon: FileText, group: 'account' },
  { id: 'profile', label: 'Profile', icon: User, group: 'account' },
];

export interface WorkspaceFile {
  id: string;
  name: string;
  type: string;
  status: string;
  favorite: boolean;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  type: string;
  content: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityEntry {
  id: string;
  action: string;
  tool: string;
  created_at: string;
}

export const FILE_TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  'cv': { label: 'CV', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  'cover-letter': { label: 'Cover Letter', color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10' },
  'document': { label: 'Document', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  'writer': { label: 'Article', color: 'text-violet-400', bg: 'bg-violet-500/10' },
  'translation': { label: 'Translation', color: 'text-sky-400', bg: 'bg-sky-500/10' },
  'study': { label: 'Study', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  'project': { label: 'Project', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  'website-builder': { label: 'Website', color: 'text-sky-400', bg: 'bg-sky-500/10' },
};

export function getFileMeta(type: string) {
  return FILE_TYPE_META[type] || { label: 'File', color: 'text-gray-400', bg: 'bg-white/5' };
}

export function timeAgo(dateStr: string): string {
  const locale = typeof document !== 'undefined' ? (document.documentElement.lang || 'en') : 'en';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (mins < 1) return rtf.format(0, 'minute');
  if (mins < 60) return rtf.format(-mins, 'minute');
  const hours = Math.floor(mins / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 7) return rtf.format(-days, 'day');
  return new Date(dateStr).toLocaleDateString(locale);
}
