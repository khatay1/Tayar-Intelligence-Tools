/// <reference types="vite/client" />

interface Window {
  Sentry?: {
    init: (config: Record<string, unknown>) => void;
    captureException: (error: Error, context?: Record<string, unknown>) => void;
    captureMessage: (message: string) => void;
  };
  posthog?: {
    capture: (event: string, properties?: Record<string, unknown>) => void;
    identify: (id: string, properties?: Record<string, unknown>) => void;
  };
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
}
