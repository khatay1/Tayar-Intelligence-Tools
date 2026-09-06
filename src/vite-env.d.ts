/// <reference types="vite/client" />

interface Window {
  Sentry?: {
    init: (config: Record<string, unknown>) => void;
    captureException: (error: Error, context?: Record<string, unknown>) => void;
    captureMessage: (message: string) => void;
    getClient?: () => { getOptions?: () => { enabled?: boolean } } | undefined;
  };
  posthog?: {
    capture: (event: string, properties?: Record<string, unknown>) => void;
    identify: (id: string, properties?: Record<string, unknown>) => void;
    opt_in_capturing?: () => void;
    opt_out_capturing?: () => void;
    stopSessionRecording?: () => void;
  };
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
}
