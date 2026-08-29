/* eslint-disable react-refresh/only-export-components */
import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home, WifiOff, Lock, ServerCrash, Search } from 'lucide-react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error?: Error;
  errorType?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    const msg = error.message.toLowerCase();
    let errorType = 'unknown';
    if (msg.includes('network') || msg.includes('fetch')) errorType = 'network';
    else if (msg.includes('permission') || msg.includes('forbidden')) errorType = 'permission';
    else if (msg.includes('not found')) errorType = 'not_found';
    else if (msg.includes('jwt') || msg.includes('session')) errorType = 'auth';
    else if (msg.includes('server')) errorType = 'server';
    return { hasError: true, error, errorType };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
    try {
      const events = JSON.parse(localStorage.getItem('tayar-error-log') || '[]');
      events.push({
        message: error.message,
        stack: error.stack?.slice(0, 500),
        componentStack: info.componentStack?.slice(0, 500),
        timestamp: new Date().toISOString(),
        url: window.location.href,
      });
      localStorage.setItem('tayar-error-log', JSON.stringify(events.slice(-20)));
    } catch {
      // ignore storage errors
    }
  }

  render() {
    if (this.state.hasError) {
      return <ErrorPage error={this.state.error} errorType={this.state.errorType} onReset={() => { this.setState({ hasError: false, error: undefined, errorType: undefined }); }} />;
    }
    return this.props.children;
  }
}

function ErrorPage({ error, errorType, onReset }: { error?: Error; errorType?: string; onReset: () => void }) {
  const config = getErrorConfig(errorType);

  return (
    <div className="min-h-screen bg-[#06060f] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-600/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-violet-600/6 rounded-full blur-[130px]" />
      </div>

      <div className="relative z-10 max-w-md w-full text-center" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
        <div className={`w-20 h-20 rounded-3xl ${config.bg} flex items-center justify-center mx-auto mb-6`} style={{ animation: 'pulse 2s ease-in-out infinite' }}>
          <config.Icon className={`w-10 h-10 ${config.color}`} />
        </div>

        <div className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-2">{config.code}</div>
        <h1 className="text-2xl font-bold text-white mb-3">{config.title}</h1>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">{config.description}</p>

        {error && (
          <pre className="text-left text-xs text-gray-600 bg-white/[0.03] border border-white/10 rounded-xl p-3 mb-6 overflow-x-auto max-h-32">
            {error.message}
          </pre>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/30 active:scale-95"
          >
            <RefreshCw className="w-4 h-4" /> Reload
          </button>
          <button
            onClick={() => { onReset(); window.location.hash = ''; }}
            className="flex items-center gap-2 text-gray-300 border border-white/10 hover:border-white/20 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <Home className="w-4 h-4" /> Home
          </button>
        </div>

        <p className="text-gray-700 text-xs mt-6">
          If this keeps happening, <a href="#contact" className="text-violet-500 hover:text-violet-400 underline">contact support</a>.
        </p>
      </div>
    </div>
  );
}

function getErrorConfig(errorType?: string) {
  switch (errorType) {
    case 'network':
      return { Icon: WifiOff, title: 'Connection Lost', description: 'We could not reach the server. Check your internet connection and try again.', code: 'ERR_NETWORK', color: 'text-amber-400', bg: 'bg-amber-500/10' };
    case 'permission':
      return { Icon: Lock, title: 'Access Denied', description: "You don't have permission to view this page. If you believe this is an error, contact support.", code: 'ERR_FORBIDDEN', color: 'text-red-400', bg: 'bg-red-500/10' };
    case 'auth':
      return { Icon: Lock, title: 'Session Expired', description: 'Your session has expired. Please sign in again to continue.', code: 'ERR_AUTH', color: 'text-violet-400', bg: 'bg-violet-500/10' };
    case 'not_found':
      return { Icon: Search, title: 'Page Not Found', description: 'The page you are looking for may have been moved or deleted.', code: 'ERR_404', color: 'text-sky-400', bg: 'bg-sky-500/10' };
    case 'server':
      return { Icon: ServerCrash, title: 'Server Error', description: 'Something went wrong on our end. We are working to fix it.', code: 'ERR_500', color: 'text-red-400', bg: 'bg-red-500/10' };
    default:
      return { Icon: AlertTriangle, title: 'Something Went Wrong', description: 'The application encountered an unexpected error. Try reloading the page.', code: 'ERR_UNKNOWN', color: 'text-red-400', bg: 'bg-red-500/10' };
  }
}
