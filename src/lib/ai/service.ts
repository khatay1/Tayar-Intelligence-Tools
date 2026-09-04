import { AIService as BaseAIService } from './service.impl';
import type {
  AIJSONResponse,
  AIServiceOptions,
  ChatMessage,
} from './service.impl';
import type { ToolId } from './prompts';
import {
  bindAIResponseProjectContext,
  captureAIProjectRequestContext,
} from './request-context';

export { AIError, getUsageStats } from './service.impl';
export type {
  AIErrorCode,
  AIJSONResponse,
  AIResponse,
  AIServiceOptions,
  ChatMessage,
  UsageStats,
} from './service.impl';

// Keep the edge-response contract explicit at the public service boundary even
// though the base implementation performs the actual response parsing.
export function isJsonAIEdgeResponseContentType(contentType: string): boolean {
  return contentType.includes('application/json');
}

function preserveStructuredAIInput(input: Record<string, unknown>): Record<string, unknown> {
  return {
    ...input,
    ...(typeof input.action === 'string' ? { action: input.action } : {}),
    ...(typeof input.prompt === 'string' ? { prompt: input.prompt } : {}),
  };
}

export class AIService extends BaseAIService {
  private readonly requestContextTool: ToolId;

  constructor(tool: ToolId, options?: string | AIServiceOptions) {
    super(tool, options);
    this.requestContextTool = tool;
  }

  async completeJSON<T = unknown>(
    input: Record<string, unknown>,
    history: ChatMessage[] = [],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<AIJSONResponse<T>> {
    const requestBinding = captureAIProjectRequestContext(this.requestContextTool);
    const response = await super.completeJSON<T>(
      preserveStructuredAIInput(input),
      history,
      options,
    );
    bindAIResponseProjectContext(response.json, requestBinding);
    return response;
  }
}

export function createAIService(tool: ToolId, options?: string | AIServiceOptions): AIService {
  return new AIService(tool, options);
}
