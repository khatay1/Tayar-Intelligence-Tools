import { useLocalizer } from '@/lib/ui-localization';
import { useState, FormEvent } from 'react';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import AuthLayout from './AuthLayout';
import { useAuth } from '@/context/AuthContext';

interface ResetPasswordProps {
  onBack: () => void;
  onNavigate: (page: 'login') => void;
}

export default function ResetPassword({ onBack, onNavigate }: ResetPasswordProps) {
  const l = useLocalizer();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError(l('Password must be at least 6 characters.'));
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <AuthLayout onBack={onBack}>
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{l('Password updated')}</h1>
          <p className="text-gray-400 text-sm mb-6">
            {l('Your password has been changed successfully. You can now sign in with your new password.')}
          </p>
          <button
            onClick={() => onNavigate('login')}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 rounded-xl transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> {l('Back to login')}
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout onBack={onBack}>
      <h1 className="text-2xl font-bold text-white mb-1">{l('Set a new password')}</h1>
      <p className="text-gray-400 text-sm mb-6">{l('Choose a strong password for your account')}</p>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-1.5">{l('New Password')}</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={l('At least 6 characters')}
              className="w-full bg-[#0c0c20] border border-white/10 rounded-xl pl-10 pr-10 py-3 text-white text-sm placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-gray-300 text-sm font-medium mb-1.5">{l('Confirm Password')}</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder={l('Re-enter your password')}
              className="w-full bg-[#0c0c20] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/30 active:scale-95"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {l(loading ? 'Updating...' : 'Update Password')}
        </button>
      </form>
    </AuthLayout>
  );
}
