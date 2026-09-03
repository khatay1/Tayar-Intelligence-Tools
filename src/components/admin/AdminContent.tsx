import { useLocalizer } from '@/lib/ui-localization';
import { useEffect, useState } from 'react';
import { FileText, Save, Loader2, Eye } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';

type ContentType = 'landing' | 'pricing' | 'faq' | 'terms' | 'privacy';

const CONTENT: Record<ContentType, { title: string; description: string; sections: { id: string; label: string; placeholder: string; value: string }[] }> = {
  landing: {
    title: 'Landing Page',
    description: 'Edit the hero section and key messaging on your homepage.',
    sections: [
      { id: 'hero_title', label: 'Hero Title', placeholder: 'AI-Powered Career Intelligence', value: 'AI-Powered Career Intelligence' },
      { id: 'hero_subtitle', label: 'Hero Subtitle', placeholder: 'Build, optimize, and manage...', value: 'Build, optimize, and manage your professional documents with AI-powered tools designed for the modern workforce.' },
      { id: 'cta_text', label: 'Call to Action Text', placeholder: 'Get Started Free', value: 'Get Started Free' },
      { id: 'stats_users', label: 'Users Stat', placeholder: '50K+', value: '50K+' },
    ],
  },
  pricing: {
    title: 'Pricing Page',
    description: 'Manage pricing tiers and features displayed to users.',
    sections: [
      { id: 'free_price', label: 'Free Plan Price', placeholder: '$0', value: '$0' },
      { id: 'pro_price', label: 'Pro Plan Price', placeholder: '$19', value: '$19' },
      { id: 'business_price', label: 'Business Plan Price', placeholder: '$49', value: '$49' },
      { id: 'free_features', label: 'Free Plan Features (one per line)', placeholder: '5 AI requests/day\nBasic CV builder', value: '5 AI requests/day\nBasic CV builder\n1 active document' },
      { id: 'pro_features', label: 'Pro Plan Features (one per line)', placeholder: 'Unlimited AI requests\nAll tools unlocked', value: 'Unlimited AI requests\nAll tools unlocked\nPriority support\nATS optimization' },
    ],
  },
  faq: {
    title: 'FAQ Section',
    description: 'Frequently asked questions shown on the landing page.',
    sections: [
      { id: 'faq_1_q', label: 'Question 1', placeholder: 'What is Tayar Intelligence?', value: 'What is Tayar Intelligence?' },
      { id: 'faq_1_a', label: 'Answer 1', placeholder: 'Tayar Intelligence is...', value: 'Tayar Intelligence is an AI-powered platform that helps you create, optimize, and manage professional documents like CVs, cover letters, and more.' },
      { id: 'faq_2_q', label: 'Question 2', placeholder: 'Is there a free plan?', value: 'Is there a free plan?' },
      { id: 'faq_2_a', label: 'Answer 2', placeholder: 'Yes! We offer...', value: 'Yes! We offer a free plan with limited AI requests and basic tools. You can upgrade to Pro or Business anytime for full access.' },
    ],
  },
  terms: {
    title: 'Terms of Service',
    description: 'Legal terms and conditions for using the platform.',
    sections: [
      { id: 'terms_intro', label: 'Introduction', placeholder: 'By using Tayar Intelligence...', value: 'By using Tayar Intelligence, you agree to these terms and conditions. Please read them carefully.' },
      { id: 'terms_usage', label: 'Usage Terms', placeholder: 'You may use...', value: 'You may use our platform for personal and professional document creation. You may not resell or redistribute AI-generated content as your own service.' },
      { id: 'terms_liability', label: 'Liability', placeholder: 'Tayar Intelligence is not liable...', value: 'Tayar Intelligence is not liable for any damages arising from the use of AI-generated content. Users are responsible for reviewing all output before use.' },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'How user data is collected, used, and protected.',
    sections: [
      { id: 'privacy_intro', label: 'Introduction', placeholder: 'We take your privacy seriously...', value: 'We take your privacy seriously. This policy explains how we collect, use, and protect your data.' },
      { id: 'privacy_data', label: 'Data Collection', placeholder: 'We collect...', value: 'We collect your name, email, and document content you create using our tools. AI interactions are processed securely and are not shared with third parties.' },
      { id: 'privacy_rights', label: 'Your Rights', placeholder: 'You have the right to...', value: 'You have the right to access, modify, or delete your data at any time. Contact us at privacy@tayar.ai for any data requests.' },
    ],
  },
};

export default function AdminContent() {
  const l = useLocalizer();
  const { success, error: showError } = useToast();
  const [activeType, setActiveType] = useState<ContentType>('landing');
  const [content, setContent] = useState(CONTENT);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'content_draft')
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error('Failed to load admin content draft:', error);
        showError(l('Failed to load saved content draft'));
      } else if (data?.value && typeof data.value === 'object' && !Array.isArray(data.value)) {
        setContent((current) => ({ ...current, ...(data.value as Partial<typeof CONTENT>) }));
      }
      setLoading(false);
    })();

    return () => { active = false; };
  }, [showError]);

  function updateValue(type: ContentType, sectionId: string, value: string) {
    setContent(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        sections: prev[type].sections.map(s => s.id === sectionId ? { ...s, value } : s),
      },
    }));
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from('admin_settings')
      .upsert({
        key: 'content_draft',
        value: content,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    setSaving(false);

    if (error) {
      showError(error.message || l('Failed to save content draft'));
      return;
    }

    success(l('Content draft saved'));
  }

  const current = content[activeType];

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-violet-500" /></div>;
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Content type tabs */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(content) as ContentType[]).map(type => {
          const Icon = FileText;
          const active = activeType === type;
          return (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active ? 'bg-violet-600/15 text-violet-300 border border-violet-500/20' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/10'
              }`}
            >
              <Icon className="w-4 h-4" />
              {l(content[type].title)}
            </button>
          );
        })}
      </div>

      {/* Editor */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-white font-semibold">{l(current.title)}</h3>
            <p className="text-gray-500 text-sm mt-0.5">{l(current.description)}</p>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? l('Saving...') : l('Save Changes')}
          </button>
        </div>

        <div className="space-y-4">
          {current.sections.map(section => (
            <div key={section.id}>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">{l(section.label)}</label>
              {section.value.length > 80 || section.value.includes('\n') ? (
                <textarea
                  value={section.value}
                  onChange={e => updateValue(activeType, section.id, e.target.value)}
                  placeholder={l(section.placeholder)}
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/40 resize-none"
                />
              ) : (
                <input
                  value={section.value}
                  onChange={e => updateValue(activeType, section.id, e.target.value)}
                  placeholder={l(section.placeholder)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/40"
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/5 text-xs text-gray-500">
          <Eye className="w-3.5 h-3.5" />
          <span>{l('Saved here as an admin content draft. Public pages are not changed until live-content wiring is enabled.')}</span>
        </div>
      </div>
    </div>
  );
}
