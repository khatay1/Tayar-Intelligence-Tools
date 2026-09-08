import { useState } from 'react';
import { AlertTriangle, Check, Copy, FileSearch, FileSignature, Loader2, PenLine, Sparkles } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization-release';
import { useToast } from '@/components/ui/Toast';
import {
  ToolField,
  ToolInputPanel,
  ToolOutputPanel,
  ToolShell,
  toolButtonClass,
  toolInputClass,
} from '../shared/ToolShell';
import { runBusinessAI } from './business-ai';

type ContractMode = 'generate' | 'review' | 'clause';

const MODE_ICONS = {
  generate: FileSignature,
  review: FileSearch,
  clause: PenLine,
} as const;

export default function ContractWriterTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const { loading, update } = useToast();
  const [mode, setMode] = useState<ContractMode>('generate');
  const [contractType, setContractType] = useState('Service Agreement');
  const [parties, setParties] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [language, setLanguage] = useState('English');
  const [riskStyle, setRiskStyle] = useState('balanced');
  const [keyTerms, setKeyTerms] = useState('');
  const [existingText, setExistingText] = useState('');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    if (mode === 'generate' && !keyTerms.trim()) {
      setError(l('Describe the key terms you want in the agreement.'));
      return;
    }
    if (mode !== 'generate' && !existingText.trim()) {
      setError(l('Paste the contract or clause you want to review.'));
      return;
    }

    setGenerating(true);
    setResult('');
    setError('');
    const toastId = loading(l(mode === 'generate' ? 'Drafting contract...' : 'Reviewing contract...'));

    try {
      const system = `You are Tayar AI Contract, a careful contract drafting and issue-spotting assistant.
You create practical, plain-language starting drafts and explain contract text clearly.
You are not a lawyer and must not claim that a draft is legally valid, enforceable, complete, or suitable for a jurisdiction without professional review.
Never invent party identities, registration numbers, addresses, dates, prices, governing law, signatures, or facts the user did not provide. Use clear [PLACEHOLDER] markers when important information is missing.
Do not assist with fraudulent contracts, forged signatures, deceptive backdating, evasion of law, or disguising unlawful activity.
For jurisdiction-sensitive matters, explicitly flag clauses that should be checked by a qualified local lawyer.
Return the requested contract/review directly, without meta commentary about being an AI.`;

      let prompt = '';
      if (mode === 'generate') {
        prompt = `Draft a ${contractType} as a professional starting template.

Output language: ${language}
Parties: ${parties || 'Not fully provided — use descriptive placeholders'}
Jurisdiction / governing-law preference: ${jurisdiction || 'Not provided — leave a clear placeholder and flag for local legal review'}
Risk allocation preference: ${riskStyle}
Key business terms and requirements:
${keyTerms.slice(0, 14000)}

Structure the agreement with a clear title, parties, purpose/scope, obligations, payment/consideration if relevant, term and termination, confidentiality/data clauses if relevant, liability/risk clauses appropriate to the requested balance, dispute/governing-law placeholders, notices, amendments, entire-agreement language where appropriate, and signature blocks.
Do not add commercial terms the user did not provide. Mark missing material terms with [PLACEHOLDER].
End with a short section titled "Review before signing" listing the jurisdiction-specific or high-impact items a lawyer should verify.`;
      } else if (mode === 'review') {
        prompt = `Review the following contract for a business user.

Output language: ${language}
Jurisdiction if known: ${jurisdiction || 'Not provided'}
User's focus/question: ${question || 'General risk and clarity review'}

<contract>
${existingText.slice(0, 22000)}
</contract>

Return these sections:
1. Plain-language summary
2. Important obligations and deadlines
3. Financial/payment terms found
4. Termination and renewal terms
5. Risk flags (High / Medium / Low) with the exact clause/topic they relate to
6. Missing or ambiguous items worth clarifying
7. Questions to ask the other party or a lawyer

Do not state that a clause is definitely legal or illegal unless the text and jurisdiction make that certain. Distinguish business-risk observations from legal conclusions.`;
      } else {
        prompt = `Improve or rewrite this contract clause while preserving the user's intended business purpose.

Output language: ${language}
Jurisdiction if known: ${jurisdiction || 'Not provided'}
Risk allocation preference: ${riskStyle}
What the user wants changed: ${question || 'Improve clarity, balance, and precision'}

<clause>
${existingText.slice(0, 14000)}
</clause>

Return:
A) Revised clause
B) Short explanation of what changed
C) Any legal/jurisdiction point that should be verified before use.
Do not invent facts or commercial terms.`;
      }

      const response = await runBusinessAI('contract-writer', system, prompt, {
        temperature: 0.2,
        maxTokens: mode === 'generate' ? 4800 : 3200,
      });
      setResult(response.content);
      update(toastId, l(mode === 'generate' ? 'Contract draft ready' : 'Contract review ready'), 'success');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : l('Could not process the contract.');
      setError(message);
      update(toastId, message, 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(l('Could not copy the result.'));
    }
  }

  return (
    <ToolShell
      icon={FileSignature}
      title={l('AI Contract Writer')}
      description={l('Draft agreements, review contract risks, and improve clauses with AI.')}
      badge="Beta · Pro"
    >
      <div className="mb-4 flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
        <div>
          <div className="font-medium">{l('Drafting assistant — not legal advice')}</div>
          <div className="mt-0.5 text-xs leading-5 text-amber-200/65">
            {l('Review important contracts with a qualified lawyer in the relevant jurisdiction before signing or relying on them.')}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <ToolInputPanel>
          <div className="grid grid-cols-3 gap-2">
            {(['generate', 'review', 'clause'] as ContractMode[]).map((value) => {
              const Icon = MODE_ICONS[value];
              const label = value === 'generate' ? 'Draft' : value === 'review' ? 'Review' : 'Clause';
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setMode(value);
                    setResult('');
                    setError('');
                  }}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                    mode === value
                      ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
                      : 'border-white/10 bg-white/[0.025] text-gray-400 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {l(label)}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <ToolField label={l('Language')}>
              <select value={language} onChange={(event) => setLanguage(event.target.value)} className={toolInputClass}>
                <option value="English">{l('English')}</option>
                <option value="Swedish">{l('Swedish')}</option>
                <option value="Arabic">{l('Arabic')}</option>
                <option value="German">{l('German')}</option>
                <option value="French">{l('French')}</option>
              </select>
            </ToolField>
            <ToolField label={l('Risk Style')}>
              <select value={riskStyle} onChange={(event) => setRiskStyle(event.target.value)} className={toolInputClass}>
                <option value="balanced">{l('Balanced / mutual')}</option>
                <option value="protect-user">{l('Protect my side')}</option>
                <option value="collaborative">{l('Collaborative / light')}</option>
              </select>
            </ToolField>
          </div>

          {mode === 'generate' && (
            <>
              <ToolField label={l('Contract Type')}>
                <select value={contractType} onChange={(event) => setContractType(event.target.value)} className={toolInputClass}>
                  <option value="Service Agreement">{l('Service Agreement')}</option>
                  <option value="Freelance Agreement">{l('Freelance Agreement')}</option>
                  <option value="Non-Disclosure Agreement (NDA)">{l('Non-Disclosure Agreement (NDA)')}</option>
                  <option value="Consulting Agreement">{l('Consulting Agreement')}</option>
                  <option value="Sales Agreement">{l('Sales Agreement')}</option>
                  <option value="Loan Agreement">{l('Loan Agreement')}</option>
                  <option value="Employment Agreement">{l('Employment Agreement')}</option>
                  <option value="Lease / Rental Agreement">{l('Lease / Rental Agreement')}</option>
                  <option value="Partnership / Collaboration Agreement">{l('Partnership / Collaboration Agreement')}</option>
                  <option value="Custom Agreement">{l('Custom Agreement')}</option>
                </select>
              </ToolField>

              <ToolField label={l('Parties')}>
                <textarea
                  value={parties}
                  onChange={(event) => setParties(event.target.value)}
                  className={`${toolInputClass} min-h-[80px] resize-y`}
                  placeholder={l('Who are the parties and what are their roles?')}
                  maxLength={3000}
                />
              </ToolField>

              <ToolField label={l('Key Terms')}>
                <textarea
                  value={keyTerms}
                  onChange={(event) => setKeyTerms(event.target.value)}
                  className={`${toolInputClass} min-h-[180px] resize-y`}
                  placeholder={l('Scope, price/payment, dates, deliverables, termination, confidentiality, ownership, special conditions...')}
                  maxLength={14000}
                />
              </ToolField>
            </>
          )}

          {mode !== 'generate' && (
            <ToolField label={l(mode === 'review' ? 'Contract Text' : 'Clause Text')}>
              <textarea
                value={existingText}
                onChange={(event) => setExistingText(event.target.value)}
                className={`${toolInputClass} min-h-[220px] resize-y font-mono text-xs leading-5`}
                placeholder={l('Paste the text here...')}
                maxLength={22000}
              />
            </ToolField>
          )}

          <ToolField label={l('Jurisdiction / Country')}>
            <input
              value={jurisdiction}
              onChange={(event) => setJurisdiction(event.target.value)}
              className={toolInputClass}
              placeholder={l('e.g. Sweden — optional')}
              maxLength={180}
            />
          </ToolField>

          {mode !== 'generate' && (
            <ToolField label={l(mode === 'review' ? 'What should AI focus on?' : 'How should the clause change?')}>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                className={`${toolInputClass} min-h-[80px] resize-y`}
                placeholder={l('Optional: payment risk, termination, liability, make it more balanced...')}
                maxLength={4000}
              />
            </ToolField>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs leading-5 text-red-200">
              {error}
            </div>
          )}

          <button type="button" onClick={() => void generate()} disabled={generating} className={toolButtonClass}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {l(generating ? 'Working...' : mode === 'generate' ? 'Draft Contract' : mode === 'review' ? 'Review Contract' : 'Improve Clause')}
          </button>
        </ToolInputPanel>

        <ToolOutputPanel
          loading={generating}
          hasContent={Boolean(result)}
          empty={<div className="py-16 text-center text-sm text-gray-600">{l('Your contract draft or review will appear here.')}</div>}
        >
          {result && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <div className="text-sm font-semibold text-white">{l(mode === 'generate' ? 'Draft output' : 'Review output')}</div>
                  <div className="mt-0.5 text-xs text-gray-500">{l('Verify names, numbers, dates, obligations, and local-law requirements before use.')}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void copyResult()}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {l(copied ? 'Copied' : 'Copy')}
                </button>
              </div>
              <div className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-200">{result}</div>
            </div>
          )}
        </ToolOutputPanel>
      </div>
    </ToolShell>
  );
}
