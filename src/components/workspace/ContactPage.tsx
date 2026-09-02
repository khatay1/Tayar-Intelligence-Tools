import { useLocalizer } from '@/lib/ui-localization';
import { useState } from 'react';
import { Mail, MapPin, Phone, Send, Loader2 } from 'lucide-react';
import { PageShell } from './PageShell';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { sanitizeText, validateEmail, validateName, validateMessage, validateSubject, checkRateLimit } from '@/lib/security';

export default function ContactPage() {
  const l = useLocalizer();
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const nameCheck = validateName(name);
    const emailCheck = validateEmail(email);
    const subjectCheck = validateSubject(subject);
    const messageCheck = validateMessage(message);

    const newErrors: Record<string, string> = {};
    if (!nameCheck.valid) newErrors.name = nameCheck.error!;
    if (!emailCheck) newErrors.email = l('Please enter a valid email address');
    if (!subjectCheck.valid) newErrors.subject = subjectCheck.error!;
    if (!messageCheck.valid) newErrors.message = messageCheck.error!;

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const rateLimit = checkRateLimit('contact', 3, 60_000);
    if (!rateLimit.allowed) {
      toast.error(l('Too many messages. Please wait {seconds}s and try again.').replace('{seconds}', String(Math.ceil(rateLimit.retryAfterMs / 1000))));
      return;
    }

    setSending(true);
    const toastId = toast.loading(l('Sending message...'));
    try {
      const cleanName = sanitizeText(name);
      const cleanEmail = sanitizeText(email);
      const cleanSubject = sanitizeText(subject);
      const cleanMessage = sanitizeText(message);

      const { error } = await supabase.from('support_tickets').insert({
        subject: cleanSubject || 'Contact request',
        body: `From ${cleanName} (${cleanEmail}): ${cleanMessage}`,
        type: 'contact',
        priority: 'medium',
      });

      if (error) throw error;

      toast.update(toastId, l('Message sent successfully! We will get back to you soon.'), 'success');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
      setErrors({});
    } catch {
      toast.update(toastId, l('Failed to send message. Please try again.'), 'error');
    }
    setSending(false);
  }

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-violet-500/50 focus:outline-none transition-colors";

  return (
    <PageShell icon={Mail} title={l('Contact Us')} subtitle={l("We'd love to hear from you. Reach out with any questions or feedback.")}>
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center"><Mail className="w-4 h-4 text-violet-400" /></div>
          <div><div className="text-white text-sm font-medium">{l('Account Support')}</div><div className="text-gray-500 text-xs">{l('Use the secure form below')}</div></div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center"><Phone className="w-4 h-4 text-violet-400" /></div>
          <div><div className="text-white text-sm font-medium">{l('Product Help')}</div><div className="text-gray-500 text-xs">{l('Help Center and troubleshooting')}</div></div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center"><MapPin className="w-4 h-4 text-violet-400" /></div>
          <div><div className="text-white text-sm font-medium">{l('Privacy Requests')}</div><div className="text-gray-500 text-xs">{l('Access, correction or deletion requests')}</div></div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={l('Your Name')}
              aria-label={l('Your name')}
              aria-invalid={!!errors.name}
              className={inputClass}
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={l('Your Email')}
              type="email"
              aria-label={l('Your email')}
              aria-invalid={!!errors.email}
              className={inputClass}
            />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
          </div>
        </div>
        <div>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder={l('Subject')}
            aria-label={l('Subject')}
            aria-invalid={!!errors.subject}
            className={inputClass}
          />
          {errors.subject && <p className="text-red-400 text-xs mt-1">{errors.subject}</p>}
        </div>
        <div>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={l('Message')}
            aria-label={l('Your message')}
            aria-invalid={!!errors.message}
            className={`${inputClass} min-h-[140px] resize-y`}
          />
          {errors.message && <p className="text-red-400 text-xs mt-1">{errors.message}</p>}
        </div>
        <button type="submit" disabled={sending} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {l('Send Message')}
        </button>
      </form>
    </PageShell>
  );
}
