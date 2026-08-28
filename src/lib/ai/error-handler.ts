// Global AI Error Handler
// Maps AIError codes to user-friendly messages and toast notifications.

import { AIError, AIErrorCode } from './service';

export interface ErrorInfo {
  title: string;
  message: string;
  severity: 'error' | 'warning';
  icon: string;
  retryable: boolean;
}

const ERROR_MAP: Record<AIErrorCode, ErrorInfo> = {
  RATE_LIMIT: {
    title: 'Rate Limit Reached',
    message: 'You\'re sending requests too fast. Please wait a moment and try again.',
    severity: 'warning',
    icon: 'gauge',
    retryable: true,
  },
  TIMEOUT: {
    title: 'Request Timed Out',
    message: 'The AI is taking longer than expected. Please try again.',
    severity: 'warning',
    icon: 'clock',
    retryable: true,
  },
  PROVIDER_ERROR: {
    title: 'AI Provider Unavailable',
    message: 'The AI service is temporarily unavailable. We\'re retrying your request.',
    severity: 'error',
    icon: 'server-off',
    retryable: true,
  },
  PROVIDER_NOT_CONFIGURED: {
    title: 'AI Provider Not Configured',
    message: 'This AI provider has not been set up yet. Please contact an administrator.',
    severity: 'error',
    icon: 'settings',
    retryable: false,
  },
  INVALID_PROVIDER: {
    title: 'Invalid Provider',
    message: 'The selected AI provider is not recognized. Please choose a different one.',
    severity: 'error',
    icon: 'alert-circle',
    retryable: false,
  },
  STREAM_ERROR: {
    title: 'Stream Interrupted',
    message: 'The response stream was interrupted. Please try again.',
    severity: 'error',
    icon: 'wifi-off',
    retryable: true,
  },
  REQUEST_FAILED: {
    title: 'Request Failed',
    message: 'Your request could not be completed. Please check your connection and try again.',
    severity: 'error',
    icon: 'alert-circle',
    retryable: true,
  },
  INVALID_RESPONSE: {
    title: 'Invalid Response',
    message: 'The AI returned an unexpected response. Please try rephrasing your request.',
    severity: 'error',
    icon: 'file-question',
    retryable: false,
  },
  NETWORK_ERROR: {
    title: 'Network Error',
    message: 'Unable to reach the AI service. Please check your internet connection.',
    severity: 'error',
    icon: 'wifi-off',
    retryable: true,
  },
  AI_ERROR: {
    title: 'AI Error',
    message: 'An unexpected error occurred. Please try again.',
    severity: 'error',
    icon: 'alert-triangle',
    retryable: false,
  },
};

export function getErrorInfo(error: unknown): ErrorInfo {
  if (error instanceof AIError) {
    return ERROR_MAP[error.code] || ERROR_MAP.AI_ERROR;
  }
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return ERROR_MAP.TIMEOUT;
  }
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return ERROR_MAP.NETWORK_ERROR;
  }
  return ERROR_MAP.AI_ERROR;
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof AIError) return error.retryable;
  if (error instanceof DOMException && error.name === 'TimeoutError') return true;
  if (error instanceof TypeError && error.message.includes('fetch')) return true;
  return false;
}

