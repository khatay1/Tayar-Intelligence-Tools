// Client-side AI Service Layer
// Unified interface for all AI tools. Handles streaming, conversation history,
// token tracking, cost tracking, error handling, retry, timeout, and usage analytics.
// All AI requests go through the edge function â€” API keys are never exposed to the frontend.

import { supabase } from '@/lib/supabase';
import { promptManager, ToolId } from './prompts';
import { getDefaultModel } from './types';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  content: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
  provider: string;
  costUsd: number;
}

export interface AIJSONResponse<T = unknown> extends AIResponse {
  json: T | null;
}

export interface UsageStats {
  totalRequests: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  byProvider: Record<string, { requests: number; tokensIn: number; tokensOut: number; costUsd: number }>;
  byTool: Record<string, { requests: number; tokensIn: number; tokensOut: number; costUsd: number }>;
  last7Days: Array<{ date: string; requests: number; tokens: number; cost: number }>;
  last30Days: Array<{ date: string; requests: number; tokens: number; cost: number }>;
}

export type AIErrorCode =
  | 'RATE_LIMIT' | 'TIMEOUT' | 'PROVIDER_ERROR' | 'STREAM_ERROR'
  | 'REQUEST_FAILED' | 'INVALID_RESPONSE' | 'NETWORK_ERROR' | 'AI_ERROR'
  | 'PROVIDER_NOT_CONFIGURED' | 'INVALID_PROVIDER';

export class AIError extends Error {
  constructor(
    message: string,
    public code: AIErrorCode = 'AI_ERROR',
    public retryable: boolean = false,
    public retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export interface AIServiceOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

function getFunctionUrl() {
  const url = import.meta.env.VITE_SUPABASE_URL || (window as unknown as Record<string, unknown>).__SUPABASE_URL__ as string;
  return `${url}/functions/v1/ai-engine`;
}

function getApiKey() {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || (window as unknown as Record<string, unknown>).__SUPABASE_ANON_KEY__ as string;
}

async function getAuthHeaders() {
  let { data } = await supabase.auth.getSession();

  if (!data.session) {
    await new Promise(resolve => setTimeout(resolve, 300));
    ({ data } = await supabase.auth.getSession());
  }

  if (!data.session?.access_token) {
    throw new AIError(
      "You must be signed in to use AI.",
      "AI_ERROR",
      false,
    );
  }

  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${data.session.access_token}`,
    "apikey": getApiKey(),
  };
}

// --- Retry with exponential backoff ---
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  isRetryable: (err: unknown) => boolean = () => true,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === maxRetries - 1) break;
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// --- Load user's per-tool AI settings from database ---
async function loadToolSettings(tool: string): Promise<{ model?: string; temperature?: number; maxTokens?: number } | null> {
  try {
    const { data } = await supabase
      .from('ai_settings')
      .select('model, temperature, max_tokens')
      .eq('tool', tool)
      .maybeSingle();
    if (data) {
      return {
        model: data.model || undefined,
        temperature: data.temperature ?? undefined,
        maxTokens: data.max_tokens ?? undefined,
      };
    }
  } catch {
    // Table might not exist or query failed â€” use defaults
  }
  return null;
}

export class AIService {
  private model: string;
  private tool: ToolId;
  private temperature: number;
  private maxTokens: number;
  private settingsLoaded: boolean = false;

  constructor(tool: ToolId, options?: string | AIServiceOptions) {
    this.tool = tool;
    if (typeof options === 'string') {
      this.model = options;
      this.temperature = 0.7;
      this.maxTokens = 4096;
    } else {
      this.model = options?.model || getDefaultModel(tool);
      this.temperature = options?.temperature ?? 0.7;
      this.maxTokens = options?.maxTokens ?? 4096;
    }
  }

  setModel(model: string) { this.model = model; }
  getModel() { return this.model; }
  setTemperature(t: number) { this.temperature = t; }
  setMaxTokens(n: number) { this.maxTokens = n; }

  // Load per-tool settings from the database (user preferences)
  async loadSettings(): Promise<void> {
    if (this.settingsLoaded) return;
    const settings = await loadToolSettings(this.tool);
    if (settings) {
      if (settings.model) this.model = settings.model;
      if (settings.temperature !== undefined) this.temperature = settings.temperature;
      if (settings.maxTokens !== undefined) this.maxTokens = settings.maxTokens;
    }
    this.settingsLoaded = true;
  }

  buildMessages(input: Record<string, unknown>, history: ChatMessage[] = []): ChatMessage[] {
    return promptManager.buildMessages(this.tool, input, history) as ChatMessage[];
  }

  // Stream a response. Calls onChunk for each text chunk, returns full response.
  async stream(
    input: Record<string, unknown>,
    history: ChatMessage[] = [],
    onChunk?: (chunk: string) => void,
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<AIResponse> {
    await this.loadSettings();
    const messages = this.buildMessages(input, history);
    const temperature = options?.temperature ?? this.temperature;
    const maxTokens = options?.maxTokens ?? this.maxTokens;

    let conversationId: string | null = null;

    const { data: conv } = await supabase
      .from('ai_conversations')
      .insert({
        tool: this.tool,
        title: (input.message as string || input.topic as string || input.text as string || 'New conversation').slice(0, 80),
        model: this.model,
      })
      .select('id')
      .single();

    if (conv) conversationId = conv.id;

    const userMessage = messages[messages.length - 1];
    if (conversationId) {
      await supabase.from('ai_messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: userMessage.content,
      });
    }

    const doFetch = async () => {
      const headers = await getAuthHeaders();
      return fetch(getFunctionUrl(), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tool: this.tool,
          messages,
          model: this.model,
          stream: false,
          conversationId,
          temperature,
          maxTokens,
        }),
        signal: AbortSignal.timeout(90_000),
      });
    };

    const response = await withRetry(
      doFetch,
      3,
      (err) => {
        if (err instanceof AIError) return err.retryable;
        if (err instanceof DOMException && err.name === 'TimeoutError') return true;
        return false;
      },
    );

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ error: 'Request failed' }));
      if (response.status === 429) {
        throw new AIError(
          'Rate limit exceeded. Please wait a moment and try again.',
          'RATE_LIMIT',
          true,
          (errBody as { retryAfterMs?: number }).retryAfterMs,
        );
      }
      if (response.status === 503) {
        throw new AIError(
          (errBody as { error?: string }).error || 'AI provider not configured.',
          'PROVIDER_NOT_CONFIGURED',
          false,
        );
      }
      if (response.status === 502) {
        throw new AIError(
          (errBody as { error?: string }).error || 'AI provider is temporarily unavailable.',
          'PROVIDER_ERROR',
          true,
        );
      }
      throw new AIError(
        (errBody as { error?: string }).error || `Request failed (${response.status})`,
        'REQUEST_FAILED',
        response.status >= 500,
      );
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let tokensIn = 0;
    let tokensOut = 0;
    let costUsd = 0;
    let provider = '';

    const processEvent = (event: string) => {
      const lines = event.split(/\r?\n/);

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed.startsWith('data:')) continue;

        const payload = trimmed.slice(5).trim();

        if (!payload) continue;

        try {
          const data = JSON.parse(payload);

          if (data.error) {
            throw new AIError(
              data.error,
              (data.code as AIErrorCode) || 'STREAM_ERROR',
              data.code === 'PROVIDER_ERROR',
            );
          }

          if (data.content) {
            fullContent += String(data.content);
            onChunk?.(String(data.content));
          }

          if (data.done) {
            tokensIn = data.tokensIn || 0;
            tokensOut = data.tokensOut || 0;
            costUsd = data.costUsd || 0;
            provider = data.provider || '';
          }
        } catch (e) {
          if (e instanceof AIError) throw e;
          console.warn('[AIService] Failed to parse SSE event:', payload);
        }
      }
    };

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        buffer += decoder.decode();
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';

      for (const event of events) {
        processEvent(event);
      }
    }

    if (buffer.trim()) {
      processEvent(buffer);
    }

    if (conversationId) {
      await supabase.from('ai_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: fullContent,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
      });
    }

    return { content: fullContent, tokensIn, tokensOut, model: this.model, provider, costUsd };
  }

  // Non-streaming request
  async complete(
    input: Record<string, unknown>,
    history: ChatMessage[] = [],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<AIResponse> {
    await this.loadSettings();
    const messages = this.buildMessages(input, history);
    const temperature = options?.temperature ?? this.temperature;
    const maxTokens = options?.maxTokens ?? this.maxTokens;

    const doFetch = async () => {
      const headers = await getAuthHeaders();
      return fetch(getFunctionUrl(), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tool: this.tool,
          messages,
          model: this.model,
          stream: false,
          temperature,
          maxTokens,
        }),
        signal: AbortSignal.timeout(90_000),
      });
    };

    const response = await withRetry(
      doFetch,
      3,
      (err) => {
        if (err instanceof AIError) return err.retryable;
        if (err instanceof DOMException && err.name === 'TimeoutError') return true;
        return false;
      },
    );

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ error: 'Request failed' }));
      if (response.status === 429) {
        throw new AIError('Rate limit exceeded. Please wait a moment and try again.', 'RATE_LIMIT', true);
      }
      if (response.status === 503) {
        throw new AIError((errBody as { error?: string }).error || 'AI provider not configured.', 'PROVIDER_NOT_CONFIGURED', false);
      }
      throw new AIError((errBody as { error?: string }).error || `Request failed (${response.status})`, 'REQUEST_FAILED', response.status >= 500);
    }

    const data = await response.json();
    return {
      content: data.content,
      tokensIn: data.tokensIn,
      tokensOut: data.tokensOut,
      model: data.model,
      provider: data.provider,
      costUsd: data.costUsd || 0,
    };
  }

  // Structured JSON response â€” requests jsonMode from the edge function
  async completeJSON<T = unknown>(
    input: Record<string, unknown>,
    history: ChatMessage[] = [],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<AIJSONResponse<T>> {
    await this.loadSettings();
    const messages = this.buildMessages(input, history);
    const temperature = options?.temperature ?? this.temperature;
    const maxTokens = options?.maxTokens ?? this.maxTokens;

    const doFetch = async () => {
      const headers = await getAuthHeaders();
      return fetch(getFunctionUrl(), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tool: this.tool,
          messages,
          model: this.model,
          stream: false,
          jsonMode: true,
          temperature,
          maxTokens,
        }),
        signal: AbortSignal.timeout(90_000),
      });
    };

    const response = await withRetry(doFetch, 3, (err) => {
      if (err instanceof AIError) return err.retryable;
      if (err instanceof DOMException && err.name === 'TimeoutError') return true;
      return false;
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new AIError(
        (errBody as { error?: string }).error || `Request failed (${response.status})`,
        'REQUEST_FAILED',
        response.status >= 500,
      );
    }

    const data = await response.json();
    return {
      content: data.content,
      json: data.json as T | null,
      tokensIn: data.tokensIn,
      tokensOut: data.tokensOut,
      model: data.model,
      provider: data.provider,
      costUsd: data.costUsd || 0,
    };
  }

  async getConversations(): Promise<Array<{ id: string; title: string; tool: string; updated_at: string }>> {
    const { data } = await supabase
      .from('ai_conversations')
      .select('id, title, tool, updated_at')
      .order('updated_at', { ascending: false });
    return data || [];
  }

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const { data } = await supabase
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    return (data as ChatMessage[]) || [];
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await supabase.from('ai_conversations').delete().eq('id', conversationId);
  }
}

// --- Usage Analytics ---
export async function getUsageStats(): Promise<UsageStats> {
  const { data } = await supabase
    .from('ai_usage')
    .select('provider, model, tool, tokens_in, tokens_out, status, cost_usd, created_at')
    .order('created_at', { ascending: false })
    .limit(5000);

  const rows = (data || []) as Array<{
    provider: string; model: string; tool: string;
    tokens_in: number; tokens_out: number; status: string;
    cost_usd: number; created_at: string;
  }>;

  const byProvider: Record<string, { requests: number; tokensIn: number; tokensOut: number; costUsd: number }> = {};
  const byTool: Record<string, { requests: number; tokensIn: number; tokensOut: number; costUsd: number }> = {};
  const dayMap: Record<string, { requests: number; tokens: number; cost: number }> = {};

  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalCostUsd = 0;

  for (const row of rows) {
    const p = row.provider;
    const t = row.tool;
    if (!byProvider[p]) byProvider[p] = { requests: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 };
    byProvider[p].requests++;
    byProvider[p].tokensIn += row.tokens_in;
    byProvider[p].tokensOut += row.tokens_out;
    byProvider[p].costUsd += Number(row.cost_usd) || 0;

    if (!byTool[t]) byTool[t] = { requests: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 };
    byTool[t].requests++;
    byTool[t].tokensIn += row.tokens_in;
    byTool[t].tokensOut += row.tokens_out;
    byTool[t].costUsd += Number(row.cost_usd) || 0;

    totalTokensIn += row.tokens_in;
    totalTokensOut += row.tokens_out;
    totalCostUsd += Number(row.cost_usd) || 0;

    const date = new Date(row.created_at).toISOString().split('T')[0];
    if (!dayMap[date]) dayMap[date] = { requests: 0, tokens: 0, cost: 0 };
    dayMap[date].requests++;
    dayMap[date].tokens += row.tokens_in + row.tokens_out;
    dayMap[date].cost += Number(row.cost_usd) || 0;
  }

  const sortedDays = Object.entries(dayMap).sort((a, b) => a[0].localeCompare(b[0]));
  const last7Days = sortedDays.slice(-7).map(([date, v]) => ({ date, ...v }));
  const last30Days = sortedDays.slice(-30).map(([date, v]) => ({ date, ...v }));

  return {
    totalRequests: rows.length,
    totalTokensIn,
    totalTokensOut,
    totalCostUsd,
    byProvider,
    byTool,
    last7Days,
    last30Days,
  };
}

// Factory: create an AIService for any tool
export function createAIService(tool: ToolId, options?: string | AIServiceOptions): AIService {
  return new AIService(tool, options);
}



