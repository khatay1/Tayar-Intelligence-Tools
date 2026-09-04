import { useLocalizer } from '@/lib/ui-localization';
import { useState, useEffect } from 'react';
import {
  ArrowRight, ArrowLeft, Check, Sparkles, Loader2,
  GraduationCap, Briefcase, User, Building2, Laptop,
  FileText, PenLine, Languages, BookOpen, Mail,
  MessageSquare, TrendingUp, Rocket, Target,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { usePreferences } from '@/context/PreferencesContext';
import { useToast } from '@/components/ui/Toast';
import {
  UserType, Language, USER_TYPES, LANGUAGES, COUNTRIES, GOALS,
  getRecommendedTools,
} from '@/lib/onboarding-types';
import { toolRegistry } from '@/modules/registry';

type Step = 'welcome' | 'language' | 'user-type' | 'personalize' | 'goals' | 'recommendations';

const STEP_ORDER: Step[] = ['welcome', 'language', 'user-type', 'personalize', 'goals', 'recommendations'];
const DEFAULT_RECOMMENDED_TOOLS = ['website-builder', 'translator', 'cv-builder', 'document-ai'];
const ICON_MAP: Record<string, typeof FileText> = {
  GraduationCap, Briefcase, User, Building2, Laptop,
  FileText, PenLine, Languages, BookOpen, Mail, MessageSquare, TrendingUp, Rocket, Target,
};

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const l = useLocalizer();
  const { user } = useAuth();
  const { completeWizard } = useOnboarding();
  const { prefs, setLanguage } = usePreferences();
  const toast = useToast();
  const [step, setStep] = useState<Step>('welcome');
  const [submitting, setSubmitting] = useState(false);

  const [language, setLang] = useState<Language>(() => prefs.language);
  const [userType, setUserType] = useState<UserType | ''>('');
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('');
  const [profession, setProfession] = useState('');
  const [goal, setGoal] = useState('');

  useEffect(() => {
    if (user?.email) {
      const name = user.user_metadata?.full_name || user.email.split('@')[0];
      setFullName(name);
    }
  }, [user]);

  const stepIndex = STEP_ORDER.indexOf(step);
  const progress = ((stepIndex + 1) / STEP_ORDER.length) * 100;

  function next() {
    const idx = STEP_ORDER.indexOf(step);
    if (idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1]);
  }

  function prev() {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  }

  async function finish() {
    if (!user || !userType || !goal) return;
    setSubmitting(true);
    try {
      const tools = getRecommendedTools(userType, goal);
      await setLanguage(language);
      await completeWizard({
        user_type: userType,
        full_name: fullName.trim(),
        country,
        profession,
        main_goal: goal,
        language,
        recommended_tools: tools,
        sample_content_seeded: false,
      });
      toast.success(l('Welcome to Tayar Intelligence!'));
      onComplete();
    } finally {
      setSubmitting(false);
    }
  }

  async function skipSetup() {
    if (!user) return;
    setSubmitting(true);
    try {
      const displayName = fullName.trim() || user.user_metadata?.full_name || user.email?.split('@')[0] || '';
      await setLanguage(language);
      await completeWizard({
        user_type: '',
        full_name: displayName,
        country: '',
        profession: '',
        main_goal: '',
        language,
        recommended_tools: DEFAULT_RECOMMENDED_TOOLS,
        sample_content_seeded: false,
      });
      toast.success(l('Welcome to Tayar Intelligence!'));
      onComplete();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#06060f] text-white flex flex-col overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-600/8 rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-600/6 rounded-full blur-[130px] animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-600/4 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 px-4 sm:px-6 pt-5 sm:pt-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-xs font-medium">{l('Quick setup')}</span>
            <span className="text-gray-400 text-xs font-medium">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-center gap-2 mt-4">
            {STEP_ORDER.map((s, i) => (
              <button
                key={s}
                onClick={() => i <= stepIndex && setStep(s)}
                disabled={i > stepIndex}
                aria-label={`${l('Quick setup')} ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === stepIndex ? 'w-8 bg-violet-500' :
                  i < stepIndex ? 'w-1.5 bg-violet-500/50' : 'w-1.5 bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-6 sm:py-8">
        <div className="w-full max-w-2xl" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
          {step === 'welcome' && (
            <div className="text-center">
              <div className="relative inline-flex items-center justify-center mb-6 sm:mb-8">
                <div className="absolute inset-0 bg-violet-500/20 rounded-full blur-2xl animate-ping" style={{ animationDuration: '3s' }} />
                <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-3 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                {l('Welcome to Tayar Intelligence')}
              </h1>
              <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto mb-7 leading-relaxed">
                {l('One workspace for websites, documents, AI tools and client work. Personalize your setup, or skip and explore right away.')}
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                <button
                  onClick={next}
                  disabled={submitting}
                  className="min-h-11 inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-7 py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/30 active:scale-95"
                >
                  {l('Personalize my workspace')} <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => void skipSetup()}
                  disabled={submitting}
                  className="min-h-11 inline-flex items-center justify-center gap-2 border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] disabled:opacity-60 text-gray-300 text-sm font-semibold px-7 py-3 rounded-xl transition-all"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {l('Skip for now')}
                </button>
              </div>
              <p className="text-gray-600 text-xs mt-4">{l('You can change your language, profile and preferences later in Settings.')}</p>
            </div>
          )}

          {step === 'language' && (
            <div>
              <StepHeader title={l('Choose your language')} subtitle={l('You can change this anytime in settings')} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLang(lang.code);
                      void setLanguage(lang.code);
                    }}
                    className={`min-h-11 flex flex-col items-center gap-2 p-5 rounded-2xl border transition-all ${
                      language === lang.code
                        ? 'border-violet-500/50 bg-violet-600/10 shadow-lg shadow-violet-500/10'
                        : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-3xl">{lang.flag}</span>
                    <span className="text-white text-sm font-medium">{lang.labelNative}</span>
                    <span className="text-gray-500 text-xs">{l(lang.label)}</span>
                  </button>
                ))}
              </div>
              <StepNav onBack={prev} onNext={next} nextLabel={l('Continue')} />
            </div>
          )}

          {step === 'user-type' && (
            <div>
              <StepHeader title={l('What best describes you?')} subtitle={l("We'll tailor your experience based on this")} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {USER_TYPES.map(ut => {
                  const Icon = ICON_MAP[ut.icon] || User;
                  const labels = { en: ut.label, ar: ut.labelAr, sv: ut.labelSv };
                  return (
                    <button
                      key={ut.id}
                      onClick={() => setUserType(ut.id)}
                      className={`min-h-11 flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
                        userType === ut.id
                          ? 'border-violet-500/50 bg-violet-600/10 shadow-lg shadow-violet-500/10'
                          : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        userType === ut.id ? 'bg-violet-500/20' : 'bg-white/5'
                      }`}>
                        <Icon className={`w-5 h-5 ${userType === ut.id ? 'text-violet-400' : 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium">{labels[language]}</div>
                        <div className="text-gray-500 text-xs mt-0.5 leading-5">{l(ut.description)}</div>
                      </div>
                      {userType === ut.id && <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <StepNav onBack={prev} onNext={() => userType && next()} nextLabel={l('Continue')} disabled={!userType} />
            </div>
          )}

          {step === 'personalize' && (
            <div>
              <StepHeader title={l('Tell us about you')} subtitle={l("Just the basics — we'll use this to personalize your workspace")} />
              <div className="space-y-4 mb-8">
                <div>
                  <label className="text-gray-400 text-xs font-medium mb-1.5 block">{l('Full Name')}</label>
                  <input
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder={l('Your name')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500/50 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-medium mb-1.5 block">{l('Country')}</label>
                  <select
                    value={country}
                    onChange={e => setCountry(e.target.value)}
                    className="w-full bg-[#12122a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500/50 focus:outline-none transition-colors"
                  >
                    <option value="" className="bg-[#12122a]">{l('Select your country')}</option>
                    {COUNTRIES.map(c => <option key={c} value={c} className="bg-[#12122a]">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-medium mb-1.5 block">{l('Profession')}</label>
                  <input
                    value={profession}
                    onChange={e => setProfession(e.target.value)}
                    placeholder={l('e.g. Software Engineer, Student, Designer')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500/50 focus:outline-none transition-colors"
                  />
                </div>
              </div>
              <StepNav onBack={prev} onNext={next} nextLabel={l('Continue')} disabled={!fullName.trim()} />
            </div>
          )}

          {step === 'goals' && (
            <div>
              <StepHeader title={l("What's your main goal?")} subtitle={l("Pick one — we'll recommend the best tools for it")} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-8">
                {GOALS.map(g => {
                  const Icon = ICON_MAP[g.icon] || Target;
                  return (
                    <button
                      key={g.id}
                      onClick={() => setGoal(g.id)}
                      className={`min-h-11 flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                        goal === g.id
                          ? 'border-violet-500/50 bg-violet-600/10'
                          : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                      }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${goal === g.id ? 'text-violet-400' : 'text-gray-400'}`} />
                      <span className="text-white text-xs font-medium">{l(g.label)}</span>
                      {goal === g.id && <Check className="w-4 h-4 text-violet-400 flex-shrink-0 ml-auto" />}
                    </button>
                  );
                })}
              </div>
              <StepNav onBack={prev} onNext={next} nextLabel={l('Continue')} disabled={!goal} />
            </div>
          )}

          {step === 'recommendations' && (
            <div>
              <StepHeader title={l('Your recommended tools')} subtitle={l('Based on your profile, these will help you get started fast')} />
              <div className="space-y-2.5 mb-8">
                {getRecommendedTools(userType as UserType, goal).map(toolId => {
                  const tool = toolRegistry.get(toolId);
                  if (!tool) return null;
                  const Icon = tool.icon;
                  return (
                    <div
                      key={toolId}
                      className="flex items-center gap-3 p-4 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-violet-500/30 transition-all"
                      style={{ animation: 'fadeInUp 0.3s ease-out both' }}
                    >
                      <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium">{l(tool.name)}</div>
                        <div className="text-gray-500 text-xs leading-5">{l(tool.description)}</div>
                      </div>
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
              <StepNav
                onBack={prev}
                onNext={() => void finish()}
                nextLabel={l(submitting ? 'Setting up...' : 'Enter Workspace')}
                disabled={submitting}
                loading={submitting}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-white mb-1.5">{title}</h2>
      <p className="text-gray-500 text-sm leading-6">{subtitle}</p>
    </div>
  );
}

function StepNav({ onBack, onNext, nextLabel, disabled, loading }: { onBack: () => void; onNext: () => void; nextLabel: string; disabled?: boolean; loading?: boolean }) {
  const l = useLocalizer();
  return (
    <div className="flex items-center justify-between gap-3">
      <button onClick={onBack} className="min-h-11 flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" /> {l('Back')}
      </button>
      <button
        onClick={onNext}
        disabled={disabled}
        className="min-h-11 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 sm:px-6 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/30 active:scale-95"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : nextLabel}
        {!loading && <ArrowRight className="w-4 h-4" />}
      </button>
    </div>
  );
}
