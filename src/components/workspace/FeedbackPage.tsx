import { useState } from 'react';
import { MessageSquare, Star, Send, Loader2 } from 'lucide-react';
import { PageShell } from './PageShell';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { sanitizeText, validateMessage, checkRateLimit } from '@/lib/security';

export default function FeedbackPage() {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [category, setCategory] = useState('general');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }
    const msgCheck = validateMessage(comment);
    if (!msgCheck.valid) {
      setError(msgCheck.error!);
      return;
    }

    const rateLimit = checkRateLimit('feedback', 3, 60_000);
    if (!rateLimit.allowed) {
      setError(`Too many submissions. Please wait ${Math.ceil(rateLimit.retryAfterMs / 1000)}s.`);
      return;
    }

    setSending(true);
    const toastId = toast.loading('Sending feedback...');
    try {
      const cleanComment = sanitizeText(comment);
      const { error: dbError } = await supabase.from('notifications').insert({
        title: `Feedback (${rating}/5) - ${category}`,
        message: cleanComment,
        type: 'feedback',
      });
      if (dbError) throw dbError;

      toast.update(toastId, 'Thank you for your feedback!', 'success');
      setRating(0);
      setComment('');
      setCategory('general');
    } catch {
      toast.update(toastId, 'Failed to send feedback. Please try again.', 'error');
    }
    setSending(false);
  }

  return (
    <PageShell icon={MessageSquare} title="Send Feedback" subtitle="Help us improve Tayar Intelligence Tools. Share your thoughts, ideas, and suggestions.">
      <div className="space-y-6">
        <div>
          <label className="text-gray-400 text-xs font-medium mb-2 block uppercase tracking-wider">How would you rate your experience?</label>
          <div className="flex gap-2" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                aria-checked={rating === n}
                role="radio"
                className="p-1 transition-transform hover:scale-110"
              >
                <Star className={`w-8 h-8 ${(hover || rating) >= n ? 'fill-amber-400 text-amber-400' : 'text-gray-600'}`} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-gray-400 text-xs font-medium mb-1.5 block uppercase tracking-wider">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-violet-500/50 focus:outline-none">
            <option value="general">General</option>
            <option value="feature-request">Feature Request</option>
            <option value="ui-feedback">UI / Design</option>
            <option value="performance">Performance</option>
            <option value="praise">Praise</option>
          </select>
        </div>

        <div>
          <label className="text-gray-400 text-xs font-medium mb-1.5 block uppercase tracking-wider">Your Feedback</label>
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Tell us what you think..." aria-label="Your feedback" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-violet-500/50 focus:outline-none min-h-[140px] resize-y" />
        </div>

        {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

        <button onClick={handleSubmit} disabled={sending || rating === 0 || !comment} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send Feedback
        </button>
      </div>
    </PageShell>
  );
}
