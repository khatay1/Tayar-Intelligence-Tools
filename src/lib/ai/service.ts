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
    const response = await super.completeJSON<T>(input, history, options);
    bindAIResponseProjectContext(response.json, requestBinding);
    return response;
  }
}

export function createAIService(tool: ToolId, options?: string | AIServiceOptions): AIService {
  return new AIService(tool, options);
}
