import { useState } from 'react';
import { MailCheck, Loader2, ArrowLeft, Mail } from 'lucide-react';
import AuthLayout from './AuthLayout';
import { useAuth } from '@/context/AuthContext';

interface EmailVerificationProps {
  onBack: () => void;
  onNavigate: (page: 'login') => void;
}

export default function EmailVerification({ onBack, onNavigate }: EmailVerificationProps) {
  const { resendVerification } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function handleResend() {
    if (!email) {
      setError('Enter your email first.');
      return;
    }
    setError(null);
    setLoading(true);
    const { error } = await resendVerification(email);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      setResent(true);
      setTimeout(() => setResent(false), 3000);
    }
  }

  return (
    <AuthLayout onBack={onBack}>
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-5">
          <MailCheck className="w-8 h-8 text-violet-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Verify your email</h1>
        <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
          We've sent a verification link to your email address. Click the link inside to activate your account.
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-1.5">Didn't get it? Enter your email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-[#0c0c20] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-all"
            />
          </div>
        </div>

        <button
          onClick={handleResend}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/30 active:scale-95"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Sending...' : resent ? 'Email sent!' : 'Resend Verification Email'}
        </button>

        <button
          onClick={() => onNavigate('login')}
          className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-white text-sm font-medium py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Back to login
        </button>
      </div>
    </AuthLayout>
  );
}
