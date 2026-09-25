import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
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
  const userId = user?.id;
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);
  const requestRevision = useRef(0);
  const activeUserId = useRef(user?.id);
  activeUserId.current = user?.id;
  const lastCheckedUserId = useRef<string | null>(null);

  const refreshAdminStatus = useCallback(async () => {
    const revision = ++requestRevision.current;
    const isCurrent = () => requestRevision.current === revision && activeUserId.current === userId;
    if (!userId) {
      setIsAdmin(false);
      setCheckedUserId(null);
      lastCheckedUserId.current = null;
      setAdminError(null);
      setAdminLoading(false);
      return;
    }

    if (lastCheckedUserId.current !== userId) setAdminLoading(true);
    setAdminError(null);

    try {
      const { data, error } = await supabase.rpc('is_admin');
      if (!isCurrent()) return;

      if (error) {
        console.error('Failed to check admin status:', error);
        setIsAdmin(false);
        setAdminError(error.message || 'Admin access could not be verified.');
        return;
      }

      setIsAdmin(data === true);
    } catch (error) {
      if (!isCurrent()) return;
      console.error('Admin status check failed:', error);
      setIsAdmin(false);
      setAdminError(error instanceof Error ? error.message : 'Admin access could not be verified.');
    } finally {
      if (isCurrent()) {
        setCheckedUserId(userId ?? null);
        lastCheckedUserId.current = userId ?? null;
        setAdminLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    void refreshAdminStatus();
    return () => { requestRevision.current += 1; };
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
        isAdmin: isAdmin && checkedUserId === user?.id,
        adminLoading: adminLoading || Boolean(user && checkedUserId !== user.id),
        adminError: checkedUserId === user?.id ? adminError : null,
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