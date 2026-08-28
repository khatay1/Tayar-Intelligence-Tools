import { useState, FormEvent } from 'react';
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import AuthLayout from './AuthLayout';
import { useAuth } from '@/context/AuthContext';

interface ForgotPasswordProps {
  onBack: () => void;
  onNavigate: (page: 'login') => void;
}

export default function ForgotPassword({ onBack, onNavigate }: ForgotPasswordProps) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      setSent(true);
    }
  }

  return (
    <AuthLayout onBack={onBack}>
      {sent ? (
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
          <p className="text-gray-400 text-sm mb-6">
            We've sent a password reset link to <span className="text-white font-medium">{email}</span>.
            Follow the link to reset your password.
          </p>
          <button
            onClick={() => onNavigate('login')}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 rounded-xl transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Back to login
          </button>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-white mb-1">Forgot password?</h1>
          <p className="text-gray-400 text-sm mb-6">
            No worries — enter your email and we'll send you a reset link.
          </p>

          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
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
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <p className="text-center text-gray-400 text-sm mt-6">
            Remember your password?{' '}
            <button
              onClick={() => onNavigate('login')}
              className="text-violet-400 font-medium hover:text-violet-300 transition-colors"
            >
              Sign in
            </button>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
