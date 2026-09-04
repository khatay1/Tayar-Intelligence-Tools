import { useLocalizer } from '@/lib/ui-localization';
import { useState, useEffect } from 'react';
import {
  FileText, LayoutGrid, Sparkles, Rocket,
  Trophy, Lock, CheckCircle2, ArrowRight, TrendingUp,
  Zap, Target, CreditCard,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useOnboarding, ACHIEVEMENTS } from '@/context/OnboardingContext';
import { toolRegistry } from '@/modules/registry';
import { ViewId } from '@/components/workspace/workspace-config';
import { supabase } from '@/lib/supabase';

interface WelcomeDashboardProps {
  onNavigate: (view: ViewId) => void;
  onStartTour: () => void;
}

const ACHIEVEMENT_ICONS: Record<string, typeof FileText> = {
  LogIn: Rocket, Sparkles: Sparkles, FileText: FileText, Download: FileText,
};

export default function WelcomeDashboard({ onNavigate, onStartTour }: WelcomeDashboardProps) {
  const l = useLocalizer();
  const { user, profile } = useAuth();
  const { state, hasAchievement } = useOnboarding();
  const [projectCount, setProjectCount] = useState(0);

  const displayName = state.full_name || profile?.full_name || user?.email?.split('@')[0] || 'there';

  useEffect(() => {
    if (!user) return;
    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => setProjectCount(count || 0));
  }, [user]);

  const unlockedCount = Object.keys(state.achievements).length;
  const achievementsProgress = (unlockedCount / ACHIEVEMENTS.length) * 100;

  const recommendedTools = state.recommended_tools
    .map(id => toolRegistry.get(id))
    .filter(Boolean)
    .slice(0, 4);

  const primaryTool = recommendedTools[0] || toolRegistry.get('website-builder');

  const quickActions = [
    primaryTool ? {
      id: `recommended-${primaryTool.id}`,
      label: primaryTool.name,
      description: primaryTool.description,
      icon: primaryTool.icon,
      action: () => onNavigate(primaryTool.id as ViewId),
      color: 'from-violet-500/20 to-violet-600/5',
      iconColor: 'text-violet-400',
    } : null,
    {
      id: 'explore-tools',
      label: 'Explore all tools',
      description: 'Browse every available tool and choose what you need.',
      icon: LayoutGrid,
      action: () => onNavigate('dashboard'),
      color: 'from-blue-500/20 to-blue-600/5',
      iconColor: 'text-blue-400',
    },
    {
      id: 'product-tour',
      label: 'Take the product tour',
      description: 'See where projects, tools and plan controls live.',
      icon: Rocket,
      action: onStartTour,
      color: 'from-emerald-500/20 to-emerald-600/5',
      iconColor: 'text-emerald-400',
    },
  ].filter(Boolean) as Array<{
    id: string;
    label: string;
    description: string;
    icon: typeof FileText;
    action: () => void;
    color: string;
    iconColor: string;
  }>;

  const nextSteps = [
    { label: 'Take the product tour', done: state.tour_completed, action: onStartTour },
    { label: 'Start with your recommended tool', done: projectCount > 0, action: () => primaryTool && onNavigate(primaryTool.id as ViewId) },
    { label: 'Review your plan and limits', done: false, action: () => onNavigate('subscription') },
    { label: 'Explore all tools', done: false, action: () => onNavigate('dashboard') },
  ];

  return (
    <div className="space-y-6">
      <div className="relative bg-gradient-to-br from-violet-600/15 via-fuchsia-600/8 to-transparent border border-violet-500/20 rounded-3xl p-6 sm:p-8 overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-fuchsia-500/8 rounded-full blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-violet-400 text-xs font-medium uppercase tracking-wider">{l("You're all set")}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            {l('Welcome')}, {displayName}! 👋
          </h1>
          <p className="text-gray-400 text-sm max-w-2xl leading-relaxed">
            {l('Your Tayar workspace is ready. Start with the recommendation below or explore everything at your own pace.')}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <span className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300">
              {projectCount} {l(projectCount === 1 ? 'project' : 'projects')}
            </span>
            <span className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300">
              {recommendedTools.length} {l('recommended tools')}
            </span>
            {!state.tour_completed && (
              <button onClick={onStartTour} className="min-h-9 text-xs px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-colors flex items-center gap-1">
                <Rocket className="w-3 h-3" /> {l('Take tour')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-white font-bold text-base mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-violet-400" /> {l('Quick Start')}
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {quickActions.map((qa, i) => {
            const Icon = qa.icon;
            return (
              <button
                key={qa.id}
                onClick={qa.action}
                className={`min-h-11 group relative bg-gradient-to-br ${qa.color} border border-white/10 hover:border-violet-500/30 rounded-2xl p-5 text-left transition-all hover:scale-[1.02] active:scale-95 overflow-hidden`}
                style={{ animation: 'fadeInUp 0.3s ease-out both', animationDelay: `${i * 0.08}s` }}
              >
                <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Icon className={`w-5 h-5 ${qa.iconColor}`} />
                </div>
                <h3 className="text-white text-sm font-semibold mb-1">{l(qa.label)}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{l(qa.description)}</p>
                <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-violet-400 group-hover:translate-x-1 transition-all absolute top-5 right-5" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-violet-400" />
            <h2 className="text-white font-bold text-sm">{l('Your Progress')}</h2>
          </div>
          <div className="space-y-3">
            {nextSteps.map((step, i) => (
              <button
                key={i}
                onClick={step.action}
                className="min-h-11 w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors text-left"
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.done ? 'bg-emerald-500/20' : 'bg-white/5 border border-white/10'
                }`}>
                  {step.done ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <div className="w-2 h-2 rounded-full bg-gray-600" />}
                </div>
                <span className={`text-sm flex-1 ${step.done ? 'text-gray-500 line-through' : 'text-white'}`}>{l(step.label)}</span>
                {!step.done && <ArrowRight className="w-3.5 h-3.5 text-gray-600" />}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h2 className="text-white font-bold text-sm">{l('Achievements')}</h2>
            </div>
            <span className="text-xs text-gray-500">{unlockedCount}/{ACHIEVEMENTS.length}</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-gradient-to-r from-amber-500 to-violet-500 rounded-full transition-all duration-500" style={{ width: `${achievementsProgress}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ACHIEVEMENTS.map(ach => {
              const unlocked = hasAchievement(ach.id);
              const Icon = ACHIEVEMENT_ICONS[ach.icon] || Lock;
              return (
                <div
                  key={ach.id}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
                    unlocked
                      ? 'border-amber-500/20 bg-amber-500/5'
                      : 'border-white/5 bg-white/[0.01] opacity-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    unlocked ? 'bg-amber-500/15' : 'bg-white/5'
                  }`}>
                    {unlocked ? <Icon className="w-4 h-4 text-amber-400" /> : <Lock className="w-3.5 h-3.5 text-gray-600" />}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-xs font-medium truncate ${unlocked ? 'text-white' : 'text-gray-500'}`}>{l(ach.label)}</div>
                    <div className="text-gray-600 text-[10px] truncate">{l(ach.description)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            <h2 className="text-white font-bold text-sm">{l('Recommended For You')}</h2>
          </div>
          <button onClick={() => onNavigate('subscription')} className="min-h-9 flex items-center gap-1.5 text-xs text-gray-500 hover:text-violet-300 transition-colors">
            <CreditCard className="w-3.5 h-3.5" /> {l('Review your plan and limits')}
          </button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {recommendedTools.map((tool, i) => {
            if (!tool) return null;
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => onNavigate(tool.id as ViewId)}
                className="min-h-11 group bg-white/[0.03] border border-white/10 hover:border-violet-500/30 rounded-2xl p-4 text-left transition-all hover:scale-[1.02] active:scale-95"
                style={{ animation: 'fadeInUp 0.3s ease-out both', animationDelay: `${i * 0.06}s` }}
              >
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5 text-violet-400" />
                </div>
                <h3 className="text-white text-sm font-semibold mb-0.5">{l(tool.name)}</h3>
                <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{l(tool.description)}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
