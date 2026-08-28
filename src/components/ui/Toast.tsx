import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X, Loader2 } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => string;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
  loading: (message: string) => string;
  dismiss: (id: string) => void;
  update: (id: string, message: string, type: ToastType) => void;
  toastWithAction: (message: string, type: ToastType, action: { label: string; onClick: () => void }) => string;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info'): string => {
    const id = Math.random().toString(36).substring(2, 11);
    setToasts(prev => [...prev, { id, type, message }]);
    if (type !== 'loading') {
      setTimeout(() => dismiss(id), 5000);
    }
    return id;
  }, [dismiss]);

  const toastWithAction = useCallback((message: string, type: ToastType, action: { label: string; onClick: () => void }): string => {
    const id = Math.random().toString(36).substring(2, 11);
    setToasts(prev => [...prev, { id, type, message, action }]);
    if (type !== 'loading') {
      setTimeout(() => dismiss(id), 8000);
    }
    return id;
  }, [dismiss]);

  const update = useCallback((id: string, message: string, type: ToastType) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, message, type } : t));
    if (type !== 'loading') {
      setTimeout(() => dismiss(id), 5000);
    }
  }, [dismiss]);

  const success = useCallback((message: string) => toast(message, 'success'), [toast]);
  const error = useCallback((message: string) => toast(message, 'error'), [toast]);
  const info = useCallback((message: string) => toast(message, 'info'), [toast]);
  const warning = useCallback((message: string) => toast(message, 'warning'), [toast]);
  const loading = useCallback((message: string) => toast(message, 'loading'), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info, warning, loading, dismiss, update, toastWithAction }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-[100] flex flex-col gap-2 w-[calc(100vw-3rem)] sm:w-96" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const config = {
    success: { icon: CheckCircle2, color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5' },
    error: { icon: XCircle, color: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-500/5' },
    info: { icon: Info, color: 'text-sky-400', border: 'border-sky-500/30', bg: 'bg-sky-500/5' },
    warning: { icon: AlertTriangle, color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/5' },
    loading: { icon: Loader2, color: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/5' },
  };
  const c = config[toast.type];
  const Icon = c.icon;

  return (
    <div
      className={`flex items-center gap-3 ${c.bg} backdrop-blur-xl border ${c.border} rounded-xl px-4 py-3 shadow-2xl shadow-black/50`}
      style={{ animation: 'fadeInUp 0.25s ease-out' }}
    >
      <Icon className={`w-5 h-5 ${c.color} flex-shrink-0 ${toast.type === 'loading' ? 'animate-spin' : ''}`} />
      <span className="text-white text-sm flex-1">{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => { toast.action!.onClick(); onDismiss(); }}
          className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors flex-shrink-0"
        >
          {toast.action.label}
        </button>
      )}
      {toast.type !== 'loading' && (
        <button onClick={onDismiss} className="text-gray-500 hover:text-white transition-colors flex-shrink-0" aria-label="Dismiss notification">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
