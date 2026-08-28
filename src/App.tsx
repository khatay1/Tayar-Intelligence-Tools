import { lazy, Suspense, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { PreferencesProvider } from '@/context/PreferencesContext';
import { AdminProvider } from '@/context/AdminContext';
import { OnboardingProvider } from '@/context/OnboardingContext';
import { ToastProvider } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { startAnalytics, track, trackPageView } from '@/lib/analytics';
import { PAGE_SEO, updateSEO } from '@/lib/seo';

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
const AboutPage = lazy(() => import('@/components/workspace/AboutPage'));
const PrivacyPolicy = lazy(() => import('@/components/workspace/PrivacyPolicy'));
const TermsOfService = lazy(() => import('@/components/workspace/TermsOfService'));

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#06060e]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
        <p className="text-sm text-gray-500">Loading Tayar Intelligenceâ€¦</p>
      </div>
    </div>
  );
}

type AuthPage = 'login' | 'register' | 'forgot' | 'verify' | 'reset';
type PublicPage = 'about' | 'privacy' | 'terms';

const AUTH_PAGES: AuthPage[] = ['login', 'register', 'forgot', 'verify', 'reset'];
const PUBLIC_PAGES: PublicPage[] = ['about', 'privacy', 'terms'];

function useHashRoute() {
  const [hash, setHash] = useState('');
  useEffect(() => {
    const sync = () => setHash(window.location.hash.replace('#', ''));
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  return hash;
}

function AppContent() {
  const { user, loading } = useAuth();
  const hashRoute = useHashRoute();
  const authPage = AUTH_PAGES.includes(hashRoute as AuthPage) ? hashRoute as AuthPage : null;
  const publicPage = PUBLIC_PAGES.includes(hashRoute as PublicPage) ? hashRoute as PublicPage : null;

  useEffect(() => { startAnalytics(); }, []);

  useEffect(() => {
    if (loading) return;
    if (user) {
      updateSEO(PAGE_SEO.workspace);
      trackPageView('/workspace');
      return;
    }
    if (authPage) {
      updateSEO(PAGE_SEO[authPage] || PAGE_SEO.home);
      trackPageView(`/${authPage}`);
      return;
    }
    if (publicPage) {
      updateSEO(PAGE_SEO[publicPage] || PAGE_SEO.home);
      trackPageView(`/${publicPage}`);
      return;
    }
    updateSEO(PAGE_SEO.home);
    trackPageView('/');
  }, [user, loading, authPage, publicPage]);

  const navigate = (page?: string | null) => { window.location.hash = page || ''; };
  const goHome = () => navigate(null);
  const startFree = () => { track('sign_up_click', 'user_action'); navigate('register'); };

  if (loading) return <FullScreenLoader />;

  if (user) {
    if (hashRoute === 'admin') {
      return <ErrorBoundary><Suspense fallback={<FullScreenLoader />}><AdminPanel onExitToWorkspace={goHome} /></Suspense></ErrorBoundary>;
    }
    return <ErrorBoundary><Suspense fallback={<FullScreenLoader />}><Workspace onExitToLanding={goHome} /></Suspense></ErrorBoundary>;
  }

  if (authPage === 'login') return <ErrorBoundary><Suspense fallback={<FullScreenLoader />}><Login onBack={goHome} onNavigate={p => navigate(p)} /></Suspense></ErrorBoundary>;
  if (authPage === 'register') return <ErrorBoundary><Suspense fallback={<FullScreenLoader />}><Register onBack={goHome} onNavigate={p => navigate(p)} /></Suspense></ErrorBoundary>;
  if (authPage === 'forgot') return <ErrorBoundary><Suspense fallback={<FullScreenLoader />}><ForgotPassword onBack={goHome} onNavigate={() => navigate('login')} /></Suspense></ErrorBoundary>;
  if (authPage === 'verify') return <ErrorBoundary><Suspense fallback={<FullScreenLoader />}><EmailVerification onBack={goHome} onNavigate={() => navigate('login')} /></Suspense></ErrorBoundary>;
  if (authPage === 'reset') return <ErrorBoundary><Suspense fallback={<FullScreenLoader />}><ResetPassword onBack={goHome} onNavigate={() => navigate('login')} /></Suspense></ErrorBoundary>;

  if (publicPage) {
    const PublicComponent = publicPage === 'about' ? AboutPage : publicPage === 'privacy' ? PrivacyPolicy : TermsOfService;
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-[#06060e] text-white antialiased">
          <Suspense fallback={<FullScreenLoader />}>
            <Navbar onGetStarted={startFree} onLogin={() => navigate('login')} />
            <main id="main-content" className="site-public-page"><PublicComponent /></main>
            <Footer onNavigate={navigate} />
            <CookieConsent />
          </Suspense>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen tayar-space-bg text-white antialiased">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <Suspense fallback={<FullScreenLoader />}>
          <Navbar onGetStarted={startFree} onLogin={() => navigate('login')} />
          <main id="main-content">
            <Hero onGetStarted={startFree} />
            <AITools onGetStarted={startFree} />
            <BusinessSolutions />
            <Stats />
            <Pricing onGetStarted={startFree} />
            <Testimonials />
            <FAQ />
            <CTA onGetStarted={startFree} />
          </main>
          <Footer onNavigate={navigate} />
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
              <AdminProvider><AppContent /></AdminProvider>
            </OnboardingProvider>
          </PreferencesProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

