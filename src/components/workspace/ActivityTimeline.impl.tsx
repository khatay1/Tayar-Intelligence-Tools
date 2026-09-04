import { useLocalizer } from '@/lib/ui-localization';
import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Mail, Languages, GraduationCap, PenLine, Folder,
  Plus, Clock, Activity as ActivityIcon, Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getFileMeta, timeAgo, ViewId } from './workspace-config';

interface ActivityTimelineProps {
  darkMode: boolean;
  onNavigate: (view: ViewId, projectId?: string) => void;
}

interface ActivityRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const TYPE_ICONS: Record<string, typeof FileText> = {
  'cv': FileText,
  'cover-letter': Mail,
  'document': FileText,
  'writer': PenLine,
  'translation': Languages,
  'study': GraduationCap,
  'project': Folder,
};

function actionLabel(action: string, entityType: string, metadata: Record<string, unknown>): string {
  const entityName = (metadata?.entity_title as string) || entityType || 'item';
  switch (action) {
    case 'created': return `Created ${entityName}`;
    case 'updated': return `Updated ${entityName}`;
    case 'exported': return `Exported ${entityName}`;
    case 'deleted': return `Deleted ${entityName}`;
    case 'ai_generated': return `AI generated ${entityName}`;
    case 'ai_analyzed': return `AI analyzed ${entityName}`;
    case 'shared': return `Shared ${entityName}`;
    default: return `${action} ${entityName}`;
  }
}

export default function ActivityTimeline({ darkMode, onNavigate }: ActivityTimelineProps) {
  const l = useLocalizer();
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const loadActivities = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from('activity_log')
      .select('id, action, entity_type, entity_id, metadata, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (filter !== 'all') {
      query = query.eq('entity_type', filter);
    }
    const { data } = await query;
    setActivities((data || []) as unknown as ActivityRow[]);
    setLoading(false);
  }, [user, filter]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Group activities by date
  const grouped: { label: string; items: ActivityRow[] }[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

  let currentGroup = '';
  for (const act of activities) {
    const d = new Date(act.created_at);
    let label: string;
    if (d >= today) label = 'Today';
    else if (d >= yesterday) label = 'Yesterday';
    else if (d >= weekAgo) label = 'This Week';
    else label = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

    if (label !== currentGroup) {
      currentGroup = label;
      grouped.push({ label, items: [act] });
    } else {
      grouped[grouped.length - 1].items.push(act);
    }
  }

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'cv', label: 'CVs' },
    { id: 'cover-letter', label: 'Cover Letters' },
    { id: 'document', label: 'Documents' },
    { id: 'writer', label: 'Writing' },
    { id: 'translation', label: 'Translations' },
    { id: 'study', label: 'Study' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600/20 to-fuchsia-600/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
          <ActivityIcon className="w-6 h-6 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{l('Recent Activity')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{l("Everything you've done across all tools")}</p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              filter === f.id
                ? 'bg-violet-600 text-white'
                : darkMode
                ? 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
            }`}
          >
            {l(f.label)}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className={`w-16 h-16 rounded-2xl ${darkMode ? 'bg-white/5' : 'bg-gray-100'} flex items-center justify-center mb-4`}>
            <Clock className={`w-8 h-8 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} />
          </div>
          <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{l('No activity yet')}</p>
          <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{l('Start using a tool to see your activity here')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.label}>
              <div className={`text-xs font-semibold uppercase tracking-wider mb-3 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                {group.label}
              </div>
              <div className={`relative ${darkMode ? 'bg-white/[0.02]' : 'bg-white'} border ${darkMode ? 'border-white/10' : 'border-gray-200'} rounded-2xl overflow-hidden`}>
                {group.items.map((act, i) => {
                  const Icon = TYPE_ICONS[act.entity_type] || FileText;
                  const meta = getFileMeta(act.entity_type);
                  const label = actionLabel(act.action, act.entity_type, act.metadata);
                  const isLast = i === group.items.length - 1;
                  return (
                    <button
                      key={act.id}
                      onClick={() => act.entity_id && onNavigate(act.entity_type as ViewId, act.entity_id)}
                      className={`w-full flex items-center gap-3.5 px-4 py-3.5 ${!isLast ? `border-b ${darkMode ? 'border-white/5' : 'border-gray-100'}` : ''} hover:bg-white/5 transition-colors text-left group`}
                    >
                      <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${meta.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{label}</div>
                        <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{timeAgo(act.created_at)}</div>
                      </div>
                      <Plus className={`w-4 h-4 ${darkMode ? 'text-gray-700' : 'text-gray-300'} group-hover:text-violet-400 transition-colors flex-shrink-0 rotate-45`} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
