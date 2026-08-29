import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface AdminContextValue {
  isAdmin: boolean;
  adminLoading: boolean;
  adminError: string | null;
  refreshAdminStatus: () => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [adminError, setAdminError] = useState<string | null>(null);

  const refreshAdminStatus = useCallback(async () => {
    if (!user) {
      setIsAdmin(false);
      setAdminError(null);
      setAdminLoading(false);
      return;
    }

    setAdminLoading(true);
    setAdminError(null);

    try {
      const { data, error } = await supabase.rpc('is_admin');

      if (error) {
        console.error('Failed to check admin status:', error);
        setIsAdmin(false);
        setAdminError(error.message || 'Admin access could not be verified.');
        return;
      }

      setIsAdmin(data === true);
    } catch (error) {
      console.error('Admin status check failed:', error);
      setIsAdmin(false);
      setAdminError(error instanceof Error ? error.message : 'Admin access could not be verified.');
    } finally {
      setAdminLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshAdminStatus();
  }, [refreshAdminStatus]);

  useEffect(() => {
    if (!user) return;

    const refreshOnFocus = () => { void refreshAdminStatus(); };
    const refreshOnVisibility = () => {
      if (document.visibilityState === 'visible') void refreshAdminStatus();
    };

    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnVisibility);
    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnVisibility);
    };
  }, [user, refreshAdminStatus]);

  return (
    <AdminContext.Provider
      value={{
        isAdmin,
        adminLoading,
        adminError,
        refreshAdminStatus,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdmin() {
  const ctx = useContext(AdminContext);

  if (!ctx) {
    throw new Error('useAdmin must be used within AdminProvider');
  }

  return ctx;
}