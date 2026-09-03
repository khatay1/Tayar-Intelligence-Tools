import { useLocalizer } from '@/lib/ui-localization';
import { useState, useMemo, useEffect } from 'react';
import {
  Sparkles, Search, Star, Pin, Clock, ArrowUpRight, Crown,
  Loader2, TrendingUp, Lightbulb, Zap, Lock,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAdmin } from '@/context/AdminContext';
import { supabase } from '@/lib/supabase';
import { Project } from '@/lib/use-projects';
import { useToolPreferences } from '@/lib/use-tool-preferences';
import { toolRegistry } from '@/modules/registry';
import { CATEGORIES, getCategory } from '@/modules/categories';
import { ToolModule, ToolCategory } from '@/modules/types';
import { ActivityEntry, ViewId, getFileMeta, timeAgo } from './workspace-config';

interface DashboardViewProps {
  onNavigate: (view: ViewId) => void;
}

const RECOMMENDATIONS: { icon: typeof TrendingUp; title: string; desc: string; action: ViewId; label: string }[] = [
  { icon: TrendingUp, title: 'Add more skills to your CV', desc: 'ATS systems look for 8+ relevant skills. You currently have 5.', action: 'cv-builder', label: 'Open CV Builder' },
  { icon: Lightbulb, title: 'Try the AI Writer', desc: 'You haven\'t used the AI Writer yet. It\'s great for creating blog posts and articles.', action: 'ai-writer', label: 'Try AI Writer' },
  { icon: Sparkles, title: 'Upgrade to Pro', desc: 'Unlock higher limits, publishing, analytics and collaboration features.', action: 'subscription', label: 'View Plans' },
];

export default function DashboardView({ onNavigate }: DashboardViewProps) {
  const l = useLocalizer();
  const { user, profile } = useAuth();
  const { isAdmin } = useAdmin();
  const prefs = useToolPreferences();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ToolCategory | 'all'>('all');

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'there';
  const allTools = toolRegistry.all();
  const availableTools = toolRegistry.available();

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setProjects((data as Project[]) || []);
        setLoading(false);
      });

    supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setActivity((data as ActivityEntry[]) || []));
  }, [user]);

  const filteredTools = useMemo(() => {
    let tools = availableTools;
    if (activeCategory !== 'all') {
      tools = tools.filter(t => t.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      tools = tools.filter(
        t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      );
    }
    return tools;
  }, [availableTools, activeCategory, search]);

  const pinnedTools = allTools.filter(t => prefs.pinned.has(t.id));
  const favoriteTools = allTools.filter(t => prefs.favorites.has(t.id));
  const recentTools = prefs.recentlyUsed.map(id => toolRegistry.get(id)).filter(Boolean) as ToolModule[];
  const continueProjects = projects.filter(p => p.status === 'draft').slice(0, 3);

  function handleToolClick(tool: ToolModule) {
    if (tool.status === 'soon') return;
    prefs.recordUsage(tool.id);
    onNavigate(tool.id as ViewId);
  }

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="relative bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(120,80,255,0.15),transparent_70%)]" />
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-violet-400 text-xs font-medium uppercase tracking-wider">{l('AI Workspace')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{l('Welcome back')}, {displayName}</h1>
            <p className="text-gray-400 text-sm">{allTools.length} {l('tools available')} · {availableTools.length} {l('ready to use')}</p>
          </div>
          <button
            onClick={() => onNavigate('ai-chat')}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/30 active:scale-95 whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" /> {l('Ask AI')}
          </button>
        </div>
      </div>

      {/* Global Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={l('Search tools... (e.g. CV, translate, quiz)')}
          className="w-full bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white text-sm placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none transition-all"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-sm"
          >
            {l('Clear')}
          </button>
        )}
      </div>

      {/* Category filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
            activeCategory === 'all'
              ? 'bg-violet-600 text-white'
              : 'bg-white/[0.03] border border-white/10 text-gray-400 hover:text-white hover:border-white/20'
          }`}
        >
          {l('All Tools')}
        </button>
        {CATEGORIES.map(cat => {
          const count = toolRegistry.byCategory(cat.id).filter(t => t.status !== 'soon').length;
          if (count === 0) return null;
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/[0.03] border border-white/10 text-gray-400 hover:text-white hover:border-white/20'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {l(cat.label)}
              <span className="text-xs opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Pinned tools */}
      {pinnedTools.length > 0 && !search && activeCategory === 'all' && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Pin className="w-4 h-4 text-amber-400" />
            <h2 className="text-white font-bold text-base">{l('Pinned')}</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {pinnedTools.map(tool => (
              <ToolCard key={tool.id} tool={tool} prefs={prefs} onClick={() => handleToolClick(tool)} compact />
            ))}
          </div>
        </div>
      )}

      {/* Tool grid (search results or all) */}
      <div>
        {search ? (
          <h2 className="text-white font-bold text-base mb-3">
            {filteredTools.length} result{filteredTools.length !== 1 ? 's' : ''} for "{search}"
          </h2>
        ) : (
          <h2 className="text-white font-bold text-base mb-3">
            {activeCategory === 'all' ? l('All Tools') : l(getCategory(activeCategory)?.label || '')}
          </h2>
        )}
        {filteredTools.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 text-center">
            <Search className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">{l('No tools found')}</p>
            <p className="text-gray-600 text-xs mt-1">{l('Try a different search or category.')}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTools.map((tool, i) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                prefs={prefs}
                onClick={() => handleToolClick(tool)}
                index={i}
              />
            ))}
          </div>
        )}
      </div>

      {/* Favorites + Recently Used */}
      {!search && activeCategory === 'all' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Favorites */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-amber-400" />
              <h2 className="text-white font-bold text-base">{l('Favorites')}</h2>
            </div>
            {favoriteTools.length === 0 ? (
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-center">
                <Star className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-xs">{l('Click the star on any tool to add it here.')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {favoriteTools.map(tool => (
                  <ToolRow key={tool.id} tool={tool} prefs={prefs} onClick={() => handleToolClick(tool)} />
                ))}
              </div>
            )}
          </div>

          {/* Recently Used */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-sky-400" />
              <h2 className="text-white font-bold text-base">{l('Recently Used')}</h2>
            </div>
            {recentTools.length === 0 ? (
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-center">
                <Clock className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-xs">{l('Tools you use will appear here for quick access.')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentTools.map(tool => (
                  <ToolRow key={tool.id} tool={tool} prefs={prefs} onClick={() => handleToolClick(tool)} showUsage />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Continue Working */}
      {!search && activeCategory === 'all' && (
        <div>
          <h2 className="text-white font-bold text-base mb-3">{l('Continue Working')}</h2>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
            </div>
          ) : continueProjects.length === 0 ? (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-center">
              <Clock className="w-6 h-6 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-xs">{l("No drafts in progress. Start a new document and it'll show up here.")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {continueProjects.map(project => {
                const meta = getFileMeta(project.type);
                return (
                  <button
                    key={project.id}
                    onClick={() => onNavigate(project.type as ViewId)}
                    className="w-full flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-2xl p-4 hover:border-violet-500/30 hover:bg-white/[0.05] transition-all text-left"
                  >
                    <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                      <div className={`w-4 h-4 rounded ${meta.color.replace('text-', 'bg-')}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium truncate">{project.title}</div>
                      <div className="text-gray-500 text-xs">{l(meta.label)} · {l('Updated')} {timeAgo(project.updated_at)}</div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">{l('Draft')}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* AI Recommendations + Activity */}
      {!search && activeCategory === 'all' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <h2 className="text-white font-bold text-base">{l('AI Recommendations')}</h2>
            </div>
            <div className="space-y-3">
              {RECOMMENDATIONS.filter((rec) => !isAdmin || rec.action !== 'subscription').map((rec, i) => {
                const Icon = rec.icon;
                return (
                  <div key={i} className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-4 hover:border-violet-500/20 transition-all">
                    <div className="flex items-start gap-2.5 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-violet-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white text-sm font-semibold">{l(rec.title)}</h3>
                        <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{l(rec.desc)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => onNavigate(rec.action)}
                      className="text-violet-400 text-xs font-medium hover:text-violet-300 transition-colors flex items-center gap-1 ml-10"
                    >
                      {l(rec.label)} <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-violet-400" />
              <h2 className="text-white font-bold text-base">{l('Recent Activity')}</h2>
            </div>
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-4">
              {activity.length === 0 ? (
                <div className="py-6 text-center">
                  <Clock className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 text-xs">{l('No recent activity')}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {activity.map((entry, i) => (
                    <div key={entry.id} className={`flex items-start gap-3 py-2.5 ${i !== activity.length - 1 ? 'border-b border-white/5' : ''}`}>
                      <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div className="w-2 h-2 rounded-full bg-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-xs font-medium">{entry.action}</div>
                        <div className="text-gray-500 text-xs">{entry.tool} · {timeAgo(entry.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!isAdmin && <div className="mt-4 relative bg-gradient-to-br from-violet-600/20 to-fuchsia-600/10 border border-violet-500/20 rounded-2xl p-4 overflow-hidden">
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-violet-500/20 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-1.5">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <p className="text-white text-sm font-semibold">{l('Upgrade to Pro')}</p>
                </div>
                <p className="text-gray-400 text-xs mb-3">{l('Unlock higher limits, publishing, analytics and collaboration features.')}</p>
                <button
                  onClick={() => onNavigate('subscription')}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
                >
                  {l('Upgrade Now')}
                </button>
              </div>
            </div>}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolCard({
  tool, prefs, onClick, compact, index = 0,
}: {
  tool: ToolModule;
  prefs: ReturnType<typeof useToolPreferences>;
  onClick: () => void;
  compact?: boolean;
  index?: number;
}) {
  const l = useLocalizer();
  const Icon = tool.icon;
  const cat = getCategory(tool.category);
  const isFav = prefs.favorites.has(tool.id);
  const isPinned = prefs.pinned.has(tool.id);
  const isSoon = tool.status === 'soon';

  return (
    <div
      className={`group relative bg-white/[0.03] backdrop-blur-xl border rounded-2xl ${compact ? 'p-4' : 'p-5'} transition-all duration-300 ${
        isSoon ? 'border-white/5 opacity-60' : 'border-white/10 hover:border-violet-500/30'
      }`}
      style={{ animation: 'fadeInUp 0.3s ease-out both', animationDelay: `${index * 0.04}s` }}
    >
      <div className="flex items-start justify-between mb-3">
        <button
          onClick={onClick}
          disabled={isSoon}
          className={`w-11 h-11 rounded-xl ${cat?.bg || 'bg-white/5'} flex items-center justify-center ${!isSoon ? 'group-hover:scale-110' : ''} transition-transform`}
        >
          <Icon className={`w-5 h-5 ${cat?.color || 'text-gray-400'}`} />
        </button>
        <div className="flex items-center gap-1">
          {tool.tier === 'premium' && (
            <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
              <Crown className="w-2.5 h-2.5" />
            </span>
          )}
          {isSoon && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-500">{l('Soon')}</span>
          )}
          {!isSoon && (
            <button
              onClick={(e) => { e.stopPropagation(); prefs.togglePin(tool.id); }}
              className={`p-1 rounded-lg transition-colors ${isPinned ? 'text-amber-400' : 'text-gray-600 hover:text-white opacity-0 group-hover:opacity-100'}`}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
          )}
          {!isSoon && (
            <button
              onClick={(e) => { e.stopPropagation(); prefs.toggleFavorite(tool.id); }}
              className={`p-1 rounded-lg transition-colors ${isFav ? 'text-amber-400' : 'text-gray-600 hover:text-white opacity-0 group-hover:opacity-100'}`}
            >
              <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400' : ''}`} />
            </button>
          )}
        </div>
      </div>
      <button onClick={onClick} disabled={isSoon} className="block w-full text-left">
        <h3 className="text-white text-sm font-semibold mb-0.5 flex items-center gap-1.5">
          {l(tool.name)}
          {tool.tier === 'premium' && !compact && <Lock className="w-3 h-3 text-amber-400/60" />}
        </h3>
        <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{l(tool.description)}</p>
        {!compact && (
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-600">
            <span>{cat?.label ? l(cat.label) : ''}</span>
            <span>·</span>
            <span>v{tool.version}</span>
            {tool.status === 'beta' && <span className="text-sky-400">{l('Beta')}</span>}
          </div>
        )}
      </button>
    </div>
  );
}

function ToolRow({
  tool, prefs, onClick, showUsage,
}: {
  tool: ToolModule;
  prefs: ReturnType<typeof useToolPreferences>;
  onClick: () => void;
  showUsage?: boolean;
}) {
  const l = useLocalizer();
  const Icon = tool.icon;
  const cat = getCategory(tool.category);
  const isFav = prefs.favorites.has(tool.id);
  const usageCount = prefs.usageCounts[tool.id] || 0;

  return (
    <div className="group flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-2xl p-3 hover:border-violet-500/30 hover:bg-white/[0.05] transition-all">
      <button onClick={onClick} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <div className={`w-9 h-9 rounded-lg ${cat?.bg || 'bg-white/5'} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${cat?.color || 'text-gray-400'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-medium truncate">{l(tool.name)}</div>
          <div className="text-gray-500 text-xs">
            {cat?.label ? l(cat.label) : ''}
            {showUsage && usageCount > 0 && ` · ${l('Used')} ${usageCount}x`}
          </div>
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); prefs.toggleFavorite(tool.id); }}
        className={`p-1.5 rounded-lg transition-colors ${isFav ? 'text-amber-400' : 'text-gray-600 hover:text-white'}`}
      >
        <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400' : ''}`} />
      </button>
    </div>
  );
}
