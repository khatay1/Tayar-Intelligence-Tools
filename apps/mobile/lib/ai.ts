import { recordAiOutput } from './ai-output-report';
import { supabase } from './supabase';

export async function runTayarAI(tool: string, systemPrompt: string, userPrompt: string, options: { temperature?: number; maxTokens?: number } = {}) {
  const { data, error } = await supabase.functions.invoke('ai-engine', {
    body: {
      tool,
      messages: [
        { role: 'system', content: systemPrompt.trim() },
        { role: 'user', content: userPrompt.trim() },
      ],
      temperature: options.temperature ?? 0.45,
      maxTokens: options.maxTokens ?? 3000,
    },
  });

  if (error) {
    let message = error.message || 'AI request failed.';
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: unknown };
        if (typeof payload.error === 'string' && payload.error.trim()) message = payload.error.trim();
      } catch {
        // Keep the safe SDK message.
      }
    }
    throw new Error(message);
  }

  const payload = data as Record<string, unknown> | null;
  const content = typeof payload?.content === 'string' ? payload.content.trim() : '';
  if (!content) throw new Error('AI returned an empty response.');

  // Keep the most recent generated output locally so every tool using the
  // shared AI client can expose the in-app Report AI control required for
  // content-safety feedback. The reporting flow sends only a bounded output
  // excerpt; prompts and source documents are not attached to the report.
  recordAiOutput(tool, content);

  return {
    content,
    provider: typeof payload?.provider === 'string' ? payload.provider : '',
    model: typeof payload?.model === 'string' ? payload.model : '',
  };
}
