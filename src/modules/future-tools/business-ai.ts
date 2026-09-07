import { supabase } from '@/lib/supabase';
import { assertToolActionAvailable } from '@/lib/tool-usage';

export type BusinessAITool = 'email-writer' | 'contract-writer' | 'analytics-ai';

export interface BusinessAIResult {
  content: string;
  model: string;
  provider: string;
  tokensIn: number;
  tokensOut: number;
}

interface BusinessAIOptions {
  temperature?: number;
  maxTokens?: number;
}

async function functionErrorMessage(error: unknown): Promise<string> {
  if (!error || typeof error !== 'object') return 'AI request failed.';

  const source = error as { message?: unknown; context?: unknown };
  const fallback = typeof source.message === 'string' && source.message.trim()
    ? source.message.trim()
    : 'AI request failed.';

  if (source.context instanceof Response) {
    try {
      const payload = await source.context.clone().json() as { error?: unknown };
      if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    } catch {
      try {
        const text = await source.context.clone().text();
        if (text.trim()) return text.trim().slice(0, 500);
      } catch {
        // Keep the safe fallback below.
      }
    }
  }

  return fallback;
}

export async function runBusinessAI(
  tool: BusinessAITool,
  systemPrompt: string,
  userPrompt: string,
  options: BusinessAIOptions = {},
): Promise<BusinessAIResult> {
  await assertToolActionAvailable(tool);

  const trimmedSystem = systemPrompt.trim();
  const trimmedUser = userPrompt.trim();
  if (!trimmedSystem || !trimmedUser) throw new Error('AI instructions are incomplete.');

  const { data, error } = await supabase.functions.invoke('ai-engine', {
    body: {
      tool,
      messages: [
        { role: 'system', content: trimmedSystem },
        { role: 'user', content: trimmedUser },
      ],
      temperature: options.temperature ?? 0.45,
      maxTokens: options.maxTokens ?? 4096,
    },
  });

  if (error) throw new Error(await functionErrorMessage(error));
  if (!data || typeof data !== 'object') throw new Error('AI returned an invalid response.');

  const payload = data as Record<string, unknown>;
  const content = typeof payload.content === 'string' ? payload.content.trim() : '';
  if (!content) throw new Error('AI returned an empty response.');

  return {
    content,
    model: typeof payload.model === 'string' ? payload.model : '',
    provider: typeof payload.provider === 'string' ? payload.provider : '',
    tokensIn: Math.max(0, Number(payload.tokensIn) || 0),
    tokensOut: Math.max(0, Number(payload.tokensOut) || 0),
  };
}
