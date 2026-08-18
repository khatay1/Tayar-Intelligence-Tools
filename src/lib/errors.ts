// Centralized error classification and handling utilities

export type ErrorType =
  | 'network'
  | 'api'
  | 'auth'
  | 'permission'
  | 'not_found'
  | 'validation'
  | 'rate_limit'
  | 'server'
  | 'unknown';

export interface ClassifiedError {
  type: ErrorType;
  message: string;
  userMessage: string;
  retryable: boolean;
  status?: number;
}

export function classifyError(error: unknown): ClassifiedError {
  // Supabase / PostgrestError shape
  const err = error as Record<string, unknown> | null;
  const message = (err?.message as string) || (error instanceof Error ? error.message : 'An unexpected error occurred');
  const status = (err?.code as number) || (err?.status as number);

  // Auth errors
  if (message.includes('JWT') || message.includes('session') || message.includes('not authenticated') || message.includes('Invalid login')) {
    return { type: 'auth', message, userMessage: 'Your session has expired. Please sign in again.', retryable: false, status };
  }
  if (message.includes('permission') || message.includes('RLS') || message.includes('policy') || message.includes('forbidden') || status === 403) {
    return { type: 'permission', message, userMessage: "You don't have permission to do this.", retryable: false, status };
  }
  if (message.includes('rate limit') || status === 429) {
    return { type: 'rate_limit', message, userMessage: 'Too many requests. Please wait a moment and try again.', retryable: true, status };
  }
  if (message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('network') || status === 503) {
    return { type: 'network', message, userMessage: 'Connection problem. Check your internet and try again.', retryable: true, status };
  }
  if (message.includes('not found') || status === 404) {
    return { type: 'not_found', message, userMessage: 'The item you are looking for could not be found.', retryable: false, status };
  }
  if (message.includes('validation') || message.includes('invalid') || status === 422) {
    return { type: 'validation', message, userMessage: 'Some information was invalid. Please check your input.', retryable: false, status };
  }
  if (status && status >= 500) {
    return { type: 'server', message, userMessage: 'Something went wrong on our end. Please try again.', retryable: true, status };
  }
  // API errors (any non-2xx with a status)
  if (status && status >= 400) {
    return { type: 'api', message, userMessage: 'The request could not be completed. Please try again.', retryable: true, status };
  }
  return { type: 'unknown', message, userMessage: 'An unexpected error occurred. Please try again.', retryable: true };
}

// Wrap any async operation and return a ClassifiedError instead of throwing
export async function safeAsync<T>(fn: () => Promise<T>): Promise<{ data: T | null; error: ClassifiedError | null }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (e) {
    return { data: null, error: classifyError(e) };
  }
}
