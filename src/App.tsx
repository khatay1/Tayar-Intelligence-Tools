import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { PreferencesProvider } from '@/context/PreferencesContext';
import { AdminProvider } from '@/context/AdminContext';
import { OnboardingProvider } from '@/context/OnboardingContext';
import { ToastProvider } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { trackPageView, startAnalytics, track } from '@/lib/analytics';
import { updateSEO, PAGE_SEO } from '@/lib/seo';
import { Loader2 } from 'lucide-react';

// Lazy-load route-level chunks
const Navbar = lazy(() => import('@/components/Navbar'));
const Hero = lazy(() => import('@/components/Hero'));
const AITools = lazy(() => import('@/components/AITools'));
const BusinessSolutions = lazy(() => import('@/components/BusinessSolutions'));
const Stats = lazy(() => import('@/components/Stats'));
const Pricing = lazy(() => import('@/components/Pricing'));
const Testimonials = lazy(() => import('@/components/Testimonials'));
const FAQ = lazy(() => import('@/components/FAQ'));
const CTA = lazy(() => import('@/components/CTA'));
const Footer = lazy(() => import('@/components/Footer'));
const CookieConsent = lazy(() => import('@/components/workspace/CookieConsent'));
const Login = lazy(() => import('@/components/auth/Login'));
const Register = lazy(() => import('@/components/auth/Register'));
const ForgotPassword = lazy(() => import('@/components/auth/ForgotPassword'));
const EmailVerification = lazy(() => import('@/components/auth/EmailVerification'));
const ResetPassword = lazy(() => import('@/components/auth/ResetPassword'));
const Workspace = lazy(() => import('@/components/workspace/Workspace'));
const AdminPanel = lazy(() => import('@/components/admin/AdminPanel'));

function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-[#06060f] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}

type AuthPage = 'login' | 'register' | 'forgot' | 'verify' | 'reset' | null;

function useHashRoute() {
  const [hash, setHash] = useState<string>('');
  useEffect(() => {
    function sync() { setHash(window.location.hash.replace('#', '')); }
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  return hash;
}

function AppContent() {
  const { user, loading } = useAuth();
  const [authPage, setAuthPage] = useState<AuthPage>(null);
  const hashRoute = useHashRoute();

  useEffect(() => {
    startAnalytics();
  }, []);

  useEffect(() => {
    if (['login', 'register', 'forgot', 'verify', 'reset'].includes(hashRoute)) {
      setAuthPage(hashRoute as AuthPage);
    } else {
      setAuthPage(null);
    }
  }, [hashRoute]);

  // Track page views and update SEO
  useEffect(() => {
    if (loading) return;
    if (user) {
      updateSEO(PAGE_SEO.workspace);
      trackPageView('/workspace');
    } else if (authPage) {
      const seoConfig = PAGE_SEO[authPage] || PAGE_SEO.home;
      updateSEO(seoConfig);
      trackPageView(`/${authPage}`);
    } else {
      updateSEO(PAGE_SEO.home);
      trackPageView('/');
    }
  }, [user, loading, authPage]);

  function navigate(page: AuthPage) {
    setAuthPage(page);
    if (page) {
      window.location.hash = page;
    } else {
      window.location.hash = '';
    }
  }

  function goHome() {
    navigate(null);
  }

  if (loading) return <FullScreenLoader />;

  if (user) {
    if (hashRoute === 'admin') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<FullScreenLoader />}>
            <AdminPanel onExitToWorkspace={() => { window.location.hash = ''; }} />
          </Suspense>
        </ErrorBoundary>
      );
    }
    return (
      <ErrorBoundary>
        <Suspense fallback={<FullScreenLoader />}>
          <Workspace onExitToLanding={goHome} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (authPage === 'login') {
    return (
      <ErrorBoundary>
        <Suspense fallback={<FullScreenLoader />}>
          <Login onBack={goHome} onNavigate={p => navigate(p)} />
        </Suspense>
      </ErrorBoundary>
    );
  }
  if (authPage === 'register') {
    return (
      <ErrorBoundary>
        <Suspense fallback={<FullScreenLoader />}>
          <Register onBack={goHome} onNavigate={p => navigate(p)} />
        </Suspense>
      </ErrorBoundary>
    );
  }
  if (authPage === 'forgot') {
    return (
      <ErrorBoundary>
        <Suspense fallback={<FullScreenLoader />}>
          <ForgotPassword onBack={goHome} onNavigate={() => navigate('login')} />
        </Suspense>
      </ErrorBoundary>
    );
  }
  if (authPage === 'verify') {
    return (
      <ErrorBoundary>
        <Suspense fallback={<FullScreenLoader />}>
          <EmailVerification onBack={goHome} onNavigate={() => navigate('login')} />
        </Suspense>
      </ErrorBoundary>
    );
  }
  if (authPage === 'reset') {
    return (
      <ErrorBoundary>
        <Suspense fallback={<FullScreenLoader />}>
          <ResetPassword onBack={goHome} onNavigate={() => navigate('login')} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#06060e] text-white antialiased">
        <Suspense fallback={<FullScreenLoader />}>
          <Navbar onGetStarted={() => { track('sign_up_click', 'user_action'); navigate('register'); }} onLogin={() => navigate('login')} />
          <Hero onGetStarted={() => { track('sign_up_click', 'user_action'); navigate('register'); }} />
          <AITools />
          <BusinessSolutions />
          <Stats />
          <Pricing />
          <Testimonials />
          <FAQ />
          <CTA onGetStarted={() => { track('sign_up_click', 'user_action'); navigate('register'); }} />
          <Footer onNavigate={(page) => navigate(page as AuthPage)} />
          <CookieConsent />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <PreferencesProvider>
            <OnboardingProvider>
              <AdminProvider>
                <AppContent />
              </AdminProvider>
            </OnboardingProvider>
          </PreferencesProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
