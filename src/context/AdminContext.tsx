import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface AdminContextValue {
  isAdmin: boolean;
  adminLoading: boolean;
  refreshAdminStatus: () => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  const refreshAdminStatus = useCallback(async () => {
    if (!user) {
      setIsAdmin(false);
      setAdminLoading(false);
      return;
    }

    setAdminLoading(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to check admin status:', error);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(data?.role === 'admin');
    } catch (error) {
      console.error('Admin status check failed:', error);
      setIsAdmin(false);
    } finally {
      setAdminLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshAdminStatus();
  }, [refreshAdminStatus]);

  return (
    <AdminContext.Provider
      value={{
        isAdmin,
        adminLoading,
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