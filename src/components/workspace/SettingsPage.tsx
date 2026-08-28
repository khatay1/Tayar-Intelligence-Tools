import { useState } from 'react';
import {
  User as UserIcon, Shield, Bell, Palette, Globe, Mail,
  Check, Loader2, AlertTriangle, Crown, Lock, Eye, EyeOff,
  Download, Trash2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAdmin } from '@/context/AdminContext';
import { usePreferences, Theme, Language } from '@/context/PreferencesContext';
import { LANGUAGE_LABELS } from '@/lib/i18n';
import { useLocalizer } from '@/lib/ui-localization';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';

type Tab = 'profile' | 'security' | 'preferences' | 'notifications' | 'privacy';

export default function SettingsPage({ darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const [tab, setTab] = useState<Tab>('profile');
  const { user, profile, updateProfile, updatePassword, signOut } = useAuth();
  const { prefs, setTheme, setLanguage, updatePrefs } = usePreferences();
  const toast = useToast();

  const tabs: { id: Tab; label: string; icon: typeof UserIcon }[] = [
    { id: 'profile', label: l('Profile'), icon: UserIcon },
    { id: 'security', label: l('Security'), icon: Shield },
    { id: 'preferences', label: l('Preferences'), icon: Palette },
    { id: 'notifications', label: l('Notifications'), icon: Bell },
    { id: 'privacy', label: l('Privacy'), icon: Shield },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">{l('Settings')}</h1>
        <p className="text-gray-500 text-sm">{l('Manage your account, security, and preferences.')}</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/10 rounded-2xl p-1 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                tab === t.id
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Profile Tab */}
      {tab === 'profile' && (
        <ProfileTab
          user={user}
          profile={profile}
          updateProfile={updateProfile}
          darkMode={darkMode}
          toast={toast}
        />
      )}

      {/* Security Tab */}
      {tab === 'security' && (
        <SecurityTab
          user={user}
          updatePassword={updatePassword}
          signOut={signOut}
          darkMode={darkMode}
          toast={toast}
        />
      )}

      {/* Preferences Tab */}
      {tab === 'preferences' && (
        <PreferencesTab
          prefs={prefs}
          setTheme={setTheme}
          setLanguage={setLanguage}
          darkMode={darkMode}
        />
      )}

      {/* Notifications Tab */}
      {tab === 'notifications' && (
        <NotificationsTab
          prefs={prefs}
          updatePrefs={updatePrefs}
          darkMode={darkMode}
        />
      )}

      {/* Privacy Tab */}
      {tab === 'privacy' && <PrivacyTab toast={toast} />}
    </div>
  );
}

// --- Privacy Tab ---
function PrivacyTab({ toast }: { toast: ReturnType<typeof useToast> }) {
  const l = useLocalizer();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [analyticsEnabled, setAnalyticsEnabled] = useState(() => localStorage.getItem('tayar-analytics-opt-in') !== 'false');
  const [aiTrainingOptOut, setAiTrainingOptOut] = useState(() => localStorage.getItem('tayar-ai-training-opt-out') === 'true');

  async function handleExport() {
    setExporting(true);
    const toastId = toast.loading(l('Preparing your data...'));
    try {
      const { data: profile } = await supabase.from('profiles').select('*').single();
      const { data: projects } = await supabase.from('projects').select('*');
      const { data: files } = await supabase.from('workspace_files').select('*');
      const { data: conversations } = await supabase.from('ai_conversations').select('*');
      const { data: activity } = await supabase.from('activity_log').select('*');
      const { data: onboarding } = await supabase.from('user_onboarding').select('*').single();
      const exportData = {
        profile, projects, files, conversations, activity, onboarding,
        exported_at: new Date().toISOString(),
        format: 'GDPR Data Portability',
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tayar-data-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.update(toastId, 'Data exported successfully', 'success');
    } catch {
      toast.update(toastId, 'Failed to export data', 'error');
    }
    setExporting(false);
  }

  function handleDownloadPersonalData() {
    const personalData = {
      browser: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      cookies_enabled: navigator.cookieEnabled,
      online: navigator.onLine,
      screen_resolution: `${screen.width}x${screen.height}`,
      collected_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(personalData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tayar-personal-data.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(l('Personal data downloaded'));
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') {
      toast.error(l('Type "DELETE" to confirm'));
      return;
    }
    setDeleting(true);
    const toastId = toast.loading('Deleting account...');
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      if (userId) {
        await supabase.from('tool_preferences').delete().eq('user_id', userId);
        await supabase.from('user_onboarding').delete().eq('user_id', userId);
        await supabase.from('ai_messages').delete().eq('user_id', userId);
        await supabase.from('ai_conversations').delete().eq('user_id', userId);
        await supabase.from('ai_usage').delete().eq('user_id', userId);
        await supabase.from('projects').delete().eq('user_id', userId);
        await supabase.from('workspace_files').delete().eq('user_id', userId);
        await supabase.from('activity_log').delete().eq('user_id', userId);
        await supabase.from('profiles').delete().eq('id', userId);
      }
      await supabase.auth.signOut();
      toast.update(toastId, 'Account deleted', 'success');
      window.location.hash = '';
      window.location.reload();
    } catch {
      toast.update(toastId, l('Failed to delete account. Please contact support.'), 'error');
    }
    setDeleting(false);
  }

  return (
    <div className="space-y-6">
      {/* Data Export */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Download className="w-5 h-5 text-violet-400" />
          <h3 className="text-white font-semibold">{l('Data Export (GDPR)')}</h3>
        </div>
        <p className="text-gray-500 text-sm mb-4">{l('Download a complete copy of all your data stored on Tayar Intelligence Tools. This includes your profile, projects, files, conversations, and activity log.')}</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleExport} disabled={exporting} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export All Data
          </button>
          <button onClick={handleDownloadPersonalData} className="flex items-center gap-2 text-gray-300 border border-white/10 hover:border-white/20 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
            <Eye className="w-4 h-4" />
            Download Personal Data
          </button>
        </div>
      </div>

      {/* Privacy Controls */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-5 h-5 text-violet-400" />
          <h3 className="text-white font-semibold">{l('Privacy Controls')}</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div>
              <div className="text-white text-sm font-medium">{l('Analytics Tracking')}</div>
              <div className="text-gray-500 text-xs">{l('Help us improve by sharing anonymous usage data')}</div>
            </div>
            <button
              onClick={() => {
                const newVal = !analyticsEnabled;
                setAnalyticsEnabled(newVal);
                localStorage.setItem('tayar-analytics-opt-in', String(newVal));
                toast.success(l(newVal ? 'Analytics enabled' : 'Analytics disabled'));
              }}
              className={`relative w-11 h-6 rounded-full transition-colors ${analyticsEnabled ? 'bg-violet-600' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${analyticsEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div>
              <div className="text-white text-sm font-medium">{l('AI Training Opt-Out')}</div>
              <div className="text-gray-500 text-xs">{l('Prevent your content from being used to improve AI models')}</div>
            </div>
            <button
              onClick={() => {
                const newVal = !aiTrainingOptOut;
                setAiTrainingOptOut(newVal);
                localStorage.setItem('tayar-ai-training-opt-out', String(newVal));
                toast.success(l(newVal ? 'AI training opt-out enabled' : 'AI training opt-out disabled'));
              }}
              className={`relative w-11 h-6 rounded-full transition-colors ${aiTrainingOptOut ? 'bg-violet-600' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${aiTrainingOptOut ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div>
              <div className="text-white text-sm font-medium">{l('Data Storage Location')}</div>
              <div className="text-gray-500 text-xs">{l('Your data is stored in EU (Stockholm) servers')}</div>
            </div>
            <Check className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div>
              <div className="text-white text-sm font-medium">{l('Data Encryption')}</div>
              <div className="text-gray-500 text-xs">{l('All data is encrypted in transit and at rest')}</div>
            </div>
            <Check className="w-4 h-4 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* Delete Account */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <Trash2 className="w-5 h-5 text-red-400" />
          <h3 className="text-red-400 font-semibold">{l('Delete Account')}</h3>
        </div>
        <p className="text-gray-500 text-sm mb-4">{l('Permanently delete your account and all associated data — projects, files, conversations, and activity. This action cannot be undone.')}</p>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="text-sm text-red-400 border border-red-500/20 hover:bg-red-500/10 px-4 py-2 rounded-xl transition-colors">
            {l('Delete My Account')}
          </button>
        ) : (
          <div className="space-y-4">
            <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
              <p className="text-red-400 text-sm font-medium mb-2">{l('This will permanently delete:')}</p>
              <ul className="text-gray-500 text-xs space-y-1 ml-4 list-disc">
                <li>{l('Your profile and account credentials')}</li>
                <li>{l('All projects (CVs, cover letters, documents)')}</li>
                <li>{l('All files and exports')}</li>
                <li>{l('All AI conversations and usage history')}</li>
                <li>{l('All activity logs and preferences')}</li>
              </ul>
            </div>
            <div>
              <label className="text-gray-400 text-xs font-medium mb-1.5 block">{l('Type')} <span className="text-red-400 font-mono">DELETE</span> {l('to confirm')}</label>
              <input
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-red-500/50 focus:outline-none"
                placeholder="DELETE"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={handleDeleteAccount} disabled={deleting || deleteConfirmText !== 'DELETE'} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {l('Yes, Delete Everything')}
              </button>
              <button onClick={() => { setConfirmDelete(false); setDeleteConfirmText(''); }} className="text-sm text-gray-300 border border-white/10 hover:border-white/20 px-4 py-2 rounded-xl transition-colors">
                {l('Cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Profile Tab ---
function ProfileTab({
  user, profile, updateProfile, darkMode, toast,
}: {
  user: ReturnType<typeof useAuth>['user'];
  profile: ReturnType<typeof useAuth>['profile'];
  updateProfile: ReturnType<typeof useAuth>['updateProfile'];
  darkMode: boolean;
  toast: ReturnType<typeof useToast>;
}) {
  void darkMode;
  const l = useLocalizer();
  const { isAdmin } = useAdmin();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const toastId = toast.loading(l('Saving profile...'));
    const { error: err } = await updateProfile({ full_name: fullName });
    if (err) {
      toast.update(toastId, err, 'error');
    } else {
      toast.update(toastId, l('Profile saved'), 'success');
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {/* Avatar + basic info */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-2xl font-bold">
            {(fullName || user?.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-white font-semibold">{fullName || l('Your Name')}</h3>
            <p className="text-gray-500 text-sm">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 capitalize">
                {isAdmin ? l('Admin · Business access') : `${profile?.plan || 'free'} ${l('plan')}`}
              </span>
              {user?.email_confirmed_at ? (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <Check className="w-3 h-3" /> {l('Verified')}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <AlertTriangle className="w-3 h-3" /> {l('Not verified')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-xs font-medium mb-1.5 block uppercase tracking-wider">{l('Full Name')}</label>
            <input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-violet-500/50 focus:outline-none"
              placeholder={l('Your name')}
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs font-medium mb-1.5 block uppercase tracking-wider">{l('Email Address')}</label>
            <input
              value={user?.email || ''}
              disabled
              className="w-full bg-white/[0.02] border border-white/10 rounded-xl px-4 py-2.5 text-gray-500 text-sm cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs font-medium mb-1.5 block uppercase tracking-wider">{l('Bio')}</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-violet-500/50 focus:outline-none min-h-[80px] resize-y"
              placeholder={l('Tell us about yourself...')}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {l('Save Changes')}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Security Tab ---
function SecurityTab({
  user, updatePassword, signOut, darkMode, toast,
}: {
  user: ReturnType<typeof useAuth>['user'];
  updatePassword: ReturnType<typeof useAuth>['updatePassword'];
  signOut: ReturnType<typeof useAuth>['signOut'];
  darkMode: boolean;
  toast: ReturnType<typeof useToast>;
}) {
  void darkMode;
  const l = useLocalizer();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      toast.error(l('Passwords do not match'));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(l('Password must be at least 8 characters'));
      return;
    }
    setSaving(true);
    const toastId = toast.loading(l('Updating password...'));
    const { error: err } = await updatePassword(newPassword);
    if (err) {
      toast.update(toastId, err, 'error');
    } else {
      toast.update(toastId, l('Password updated successfully'), 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {/* Email verification */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-violet-400" />
          <h3 className="text-white font-semibold">{l('Email Verification')}</h3>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
          {user?.email_confirmed_at ? (
            <>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">{l('Email verified')}</p>
                <p className="text-gray-500 text-xs">{l('Your email address has been confirmed.')}</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{l('Email not verified')}</p>
                <p className="text-gray-500 text-xs">{l('Please verify your email address to secure your account.')}</p>
              </div>
              <button
                onClick={async () => {
                  const toastId = toast.loading(l('Sending verification email...'));
                  const { error: err } = await supabase.auth.resend({ type: 'signup', email: user?.email || '' });
                  if (err) toast.update(toastId, err.message, 'error');
                  else toast.update(toastId, l('Verification email sent'), 'success');
                }}
                className="text-xs bg-violet-600 hover:bg-violet-500 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                {l('Verify Now')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-violet-400" />
          <h3 className="text-white font-semibold">{l('Change Password')}</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-xs font-medium mb-1.5 block uppercase tracking-wider">{l('New Password')}</label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-white text-sm focus:border-violet-500/50 focus:outline-none"
                placeholder={l('Enter new password')}
              />
              <button
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-gray-400 text-xs font-medium mb-1.5 block uppercase tracking-wider">{l('Confirm New Password')}</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-violet-500/50 focus:outline-none"
              placeholder={l('Confirm new password')}
            />
          </div>
          <button
            onClick={handleChangePassword}
            disabled={saving || !newPassword}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {l('Update Password')}
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h3 className="text-red-400 font-semibold">{l('Danger Zone')}</h3>
        </div>
        <p className="text-gray-500 text-sm mb-4">{l('Sign out from all devices or permanently delete your account.')}</p>
        <div className="flex gap-3">
          <button
            onClick={signOut}
            className="text-sm text-gray-300 border border-white/10 hover:border-white/20 px-4 py-2 rounded-xl transition-colors"
          >
            {l('Sign Out')}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Preferences Tab ---
function PreferencesTab({
  prefs, setTheme, setLanguage, darkMode,
}: {
  prefs: ReturnType<typeof usePreferences>['prefs'];
  setTheme: (t: Theme) => void;
  setLanguage: (l: Language) => void;
  darkMode: boolean;
}) {
  const l = useLocalizer();
  const languages: Language[] = ['en', 'ar', 'sv'];

  return (
    <div className="space-y-6">
      {/* Theme */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-violet-400" />
          <h3 className="text-white font-semibold">{l('Theme')}</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(['dark', 'light'] as Theme[]).map(t => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                prefs.theme === t
                  ? 'border-violet-500/50 bg-violet-600/10'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg ${t === 'dark' ? 'bg-[#06060f]' : 'bg-gray-100'} border ${t === 'dark' ? 'border-white/10' : 'border-gray-300'}`} />
              <div className="text-left">
                <div className="text-white text-sm font-medium capitalize">{l(t === 'dark' ? 'Dark Mode' : 'Light Mode')}</div>
                <div className="text-gray-500 text-xs">{l(t === 'dark' ? 'Easy on the eyes' : 'Bright and clean')}</div>
              </div>
              {prefs.theme === t && <Check className="w-4 h-4 text-violet-400 ml-auto" />}
            </button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-violet-400" />
          <h3 className="text-white font-semibold">{l('Language')}</h3>
        </div>
        <div className="space-y-2">
          {languages.map(lang => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                prefs.language === lang
                  ? 'border-violet-500/50 bg-violet-600/10'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{lang === 'en' ? '🇬🇧' : lang === 'ar' ? '🇸🇦' : '🇸🇪'}</span>
                <span className="text-white text-sm font-medium">{LANGUAGE_LABELS[lang]}</span>
              </div>
              {prefs.language === lang && <Check className="w-4 h-4 text-violet-400" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Notifications Tab ---
function NotificationsTab({
  prefs, updatePrefs, darkMode,
}: {
  prefs: ReturnType<typeof usePreferences>['prefs'];
  updatePrefs: ReturnType<typeof usePreferences>['updatePrefs'];
  darkMode: boolean;
}) {
  const l = useLocalizer();
  const toggles: { key: 'email_notifications' | 'push_notifications' | 'marketing_emails'; label: string; desc: string }[] = [
    { key: 'email_notifications', label: 'Email Notifications', desc: 'Important account and security emails' },
    { key: 'push_notifications', label: 'Push Notifications', desc: 'Real-time updates in your browser' },
    { key: 'marketing_emails', label: 'Marketing Emails', desc: 'Product updates, tips, and special offers' },
  ];

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-5 h-5 text-violet-400" />
        <h3 className="text-white font-semibold">{l('Notification Preferences')}</h3>
      </div>
      <div className="space-y-4">
        {toggles.map(t => (
          <div key={t.key} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div>
              <div className="text-white text-sm font-medium">{l(t.label)}</div>
              <div className="text-gray-500 text-xs">{l(t.desc)}</div>
            </div>
            <button
              onClick={() => updatePrefs({ [t.key]: !prefs[t.key] })}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                prefs[t.key] ? 'bg-violet-600' : 'bg-white/10'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${prefs[t.key] ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
