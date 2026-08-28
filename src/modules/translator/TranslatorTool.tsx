import { useMemo, useState } from 'react';
import { Languages, Loader2, Copy, Check, ArrowLeftRight } from 'lucide-react';
import { ToolShell, ToolInputPanel, ToolOutputPanel, ToolField, toolInputClass, toolButtonClass } from '../shared/ToolShell';
import { createAIService } from '@/lib/ai/service';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/lib/i18n';

const LANGUAGES = [
  'English', 'Arabic', 'Swedish', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
  'Dutch', 'Russian', 'Ukrainian', 'Polish', 'Czech', 'Slovak', 'Danish', 'Norwegian',
  'Finnish', 'Icelandic', 'Estonian', 'Latvian', 'Lithuanian', 'Greek', 'Romanian',
  'Bulgarian', 'Hungarian', 'Serbian', 'Croatian', 'Bosnian', 'Slovenian', 'Albanian',
  'Turkish', 'Azerbaijani', 'Georgian', 'Armenian', 'Persian', 'Kurdish', 'Hebrew',
  'Urdu', 'Hindi', 'Bengali', 'Punjabi', 'Gujarati', 'Marathi', 'Tamil', 'Telugu',
  'Kannada', 'Malayalam', 'Nepali', 'Sinhala', 'Thai', 'Vietnamese', 'Indonesian',
  'Malay', 'Filipino', 'Chinese (Simplified)', 'Chinese (Traditional)', 'Japanese',
  'Korean', 'Mongolian', 'Kazakh', 'Uzbek', 'Afrikaans', 'Swahili', 'Somali', 'Amharic',
  'Hausa', 'Yoruba', 'Igbo', 'Zulu', 'Xhosa', 'Catalan', 'Basque', 'Galician',
  'Irish', 'Welsh', 'Maltese', 'Esperanto', 'Latin',
] as const;

const AUTO_DETECT = 'Auto-detect';
const MAX_INPUT_CHARS = 20_000;

export default function TranslatorTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const { t, language } = useTranslation();
  const { loading, update } = useToast();
  const [from, setFrom] = useState<string>(AUTO_DETECT);
  const [to, setTo] = useState<string>('English');
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const isRtlUi = language === 'ar';
  const canTranslate = text.trim().length > 0 && from !== to && text.length <= MAX_INPUT_CHARS;
  const targetOptions = useMemo(() => LANGUAGES.filter(l => l !== from), [from]);

  async function handleTranslate() {
    const cleanText = text.trim();
    if (!cleanText || !canTranslate || generating) return;

    setGenerating(true);
    setResult('');
    const toastId = loading(t('translator.translating'));
    try {
      const ai = createAIService('translator', { temperature: 0.2, maxTokens: 8192 });
      const response = await ai.stream(
        { action: 'translate', from, to, text: cleanText },
        [],
        (chunk) => setResult(prev => prev + chunk),
        { temperature: 0.2, maxTokens: 8192 },
      );

      // The current edge endpoint can return a single non-streamed payload. Ensure the UI
      // still receives it when no chunks were emitted.
      setResult(prev => prev || response.content || '');
      update(toastId, t('translator.complete'), 'success');
    } catch (err) {
      update(toastId, (err as Error).message || t('translator.failed'), 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked by browser permissions; keep the result intact.
    }
  }

  function swapLanguages() {
    if (from === AUTO_DETECT) return;
    const previousFrom = from;
    const previousText = text;
    setFrom(to);
    setTo(previousFrom);
    setText(result || previousText);
    setResult(result ? previousText : '');
  }

  function handleFromChange(nextFrom: string) {
    setFrom(nextFrom);
    if (nextFrom === to) {
      setTo(from !== AUTO_DETECT ? from : 'English');
    }
  }

  return (
    <ToolShell icon={Languages} title={t('translator.title')} description={t('translator.description')} badge="v2.1">
      <div className="grid lg:grid-cols-2 gap-6" dir={isRtlUi ? 'rtl' : 'ltr'}>
        <ToolInputPanel>
          <div className="flex items-end gap-2">
            <ToolField label={t('translator.from')}>
              <select value={from} onChange={e => handleFromChange(e.target.value)} className={toolInputClass}>
                <option value={AUTO_DETECT}>{t('translator.autoDetect')}</option>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </ToolField>
            <button
              type="button"
              onClick={swapLanguages}
              disabled={from === AUTO_DETECT}
              aria-label={t('translator.swap')}
              title={from === AUTO_DETECT ? t('translator.swapDisabled') : t('translator.swap')}
              className="p-2.5 mb-0.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
            <ToolField label={t('translator.to')}>
              <select value={to} onChange={e => setTo(e.target.value)} className={toolInputClass}>
                {targetOptions.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </ToolField>
          </div>

          <ToolField label={t('translator.textToTranslate')}>
            <textarea
              value={text}
              onChange={e => setText(e.target.value.slice(0, MAX_INPUT_CHARS))}
              className={`${toolInputClass} min-h-[180px] resize-y`}
              placeholder={t('translator.placeholder')}
              dir="auto"
              spellCheck
            />
          </ToolField>

          <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
            <span>{from === to ? t('translator.sameLanguage') : ''}</span>
            <span dir="ltr">{text.length.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()}</span>
          </div>

          <button onClick={handleTranslate} disabled={generating || !canTranslate} className={toolButtonClass}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
            {generating ? t('translator.translating') : t('translator.translate')}
          </button>
        </ToolInputPanel>

        <ToolOutputPanel loading={generating} hasContent={!!result}>
          {result && (
            <div>
              <div className="flex justify-end mb-2">
                <button onClick={copyResult} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-xs transition-colors">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? t('common.copied') : t('common.copy')}
                </button>
              </div>
              <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed" dir="auto">{result}</div>
            </div>
          )}
        </ToolOutputPanel>
      </div>
    </ToolShell>
  );
}
