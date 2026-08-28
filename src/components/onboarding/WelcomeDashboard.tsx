import { useLocalizer } from '@/lib/ui-localization';
import { useState, useEffect } from 'react';
import {
  FileText, Upload, MessageSquare, Sparkles, Rocket,
  Trophy, Lock, CheckCircle2, ArrowRight, TrendingUp,
  Zap, Target, BookOpen, PenLine, Mail, Languages,
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

const QUICK_ACTIONS = [
  { id: 'create-cv', label: 'Create My First CV', description: 'Build an ATS-friendly resume with AI', icon: FileText, action: 'cv-builder' as ViewId, color: 'from-blue-500/20 to-blue-600/5', iconColor: 'text-blue-400' },
  { id: 'upload-doc', label: 'Upload a Document', description: 'Analyze, summarize, or translate any file', icon: Upload, action: 'document-ai' as ViewId, color: 'from-emerald-500/20 to-emerald-600/5', iconColor: 'text-emerald-400' },
  { id: 'start-chat', label: 'Start AI Chat', description: 'Ask anything — your AI assistant is ready', icon: MessageSquare, action: 'ai-chat' as ViewId, color: 'from-violet-500/20 to-violet-600/5', iconColor: 'text-violet-400' },
];

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

  const nextSteps = [
    { label: 'Take the product tour', done: state.tour_completed, action: onStartTour },
    { label: 'Create your first CV', done: hasAchievement('first_resume'), action: () => onNavigate('cv-builder') },
    { label: 'Try the AI Chat', done: false, action: () => onNavigate('ai-chat') },
    { label: 'Explore all AI tools', done: false, action: () => onNavigate('dashboard') },
  ];

  const recommendedTools = state.recommended_tools
    .map(id => toolRegistry.get(id))
    .filter(Boolean)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Welcome hero */}
      <div className="relative bg-gradient-to-br from-violet-600/15 via-fuchsia-600/8 to-transparent border border-violet-500/20 rounded-3xl p-6 sm:p-8 overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-fuchsia-500/8 rounded-full blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-violet-400 text-xs font-medium uppercase tracking-wider">{l("You're all set")}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Welcome, {displayName}! 👋
          </h1>
          <p className="text-gray-400 text-sm max-w-lg leading-relaxed">
            Your AI workspace is ready. We've added some sample content to get you started. Pick a quick action below, or explore the tools we recommended for you.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <span className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300">
              {projectCount} {projectCount === 1 ? 'file' : 'files'} ready
            </span>
            <span className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300">
              {recommendedTools.length} recommended tools
            </span>
            {!state.tour_completed && (
              <button onClick={onStartTour} className="text-xs px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-colors flex items-center gap-1">
                <Rocket className="w-3 h-3" /> Take tour
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-white font-bold text-base mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-violet-400" /> Quick Start
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {QUICK_ACTIONS.map((qa, i) => {
            const Icon = qa.icon;
            return (
              <button
                key={qa.id}
                onClick={() => onNavigate(qa.action)}
                className={`group relative bg-gradient-to-br ${qa.color} border border-white/10 hover:border-violet-500/30 rounded-2xl p-5 text-left transition-all hover:scale-[1.02] active:scale-95 overflow-hidden`}
                style={{ animation: 'fadeInUp 0.3s ease-out both', animationDelay: `${i * 0.08}s` }}
              >
                <div className={`w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-5 h-5 ${qa.iconColor}`} />
                </div>
                <h3 className="text-white text-sm font-semibold mb-1">{qa.label}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{qa.description}</p>
                <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-violet-400 group-hover:translate-x-1 transition-all absolute top-5 right-5" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Two-column: Progress + Achievements */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Progress tracker */}
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
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors text-left"
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.done ? 'bg-emerald-500/20' : 'bg-white/5 border border-white/10'
                }`}>
                  {step.done ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <div className="w-2 h-2 rounded-full bg-gray-600" />}
                </div>
                <span className={`text-sm flex-1 ${step.done ? 'text-gray-500 line-through' : 'text-white'}`}>{step.label}</span>
                {!step.done && <ArrowRight className="w-3.5 h-3.5 text-gray-600" />}
              </button>
            ))}
          </div>
        </div>

        {/* Achievements */}
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
                    <div className={`text-xs font-medium truncate ${unlocked ? 'text-white' : 'text-gray-500'}`}>{ach.label}</div>
                    <div className="text-gray-600 text-[10px] truncate">{ach.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recommended tools */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-violet-400" />
          <h2 className="text-white font-bold text-sm">{l('Recommended For You')}</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {recommendedTools.map((tool, i) => {
            if (!tool) return null;
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => onNavigate(tool.id as ViewId)}
                className="group bg-white/[0.03] border border-white/10 hover:border-violet-500/30 rounded-2xl p-4 text-left transition-all hover:scale-[1.02] active:scale-95"
                style={{ animation: 'fadeInUp 0.3s ease-out both', animationDelay: `${i * 0.06}s` }}
              >
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5 text-violet-400" />
                </div>
                <h3 className="text-white text-sm font-semibold mb-0.5">{tool.name}</h3>
                <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{tool.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
