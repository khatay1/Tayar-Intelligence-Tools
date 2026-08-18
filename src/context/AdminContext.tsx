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
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (data?.role === 'admin') {
      setIsAdmin(true);
    } else {
      // Auto-promote the very first user to admin if no admins exist
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin');
      if (count === 0) {
        const { data: firstUser } = await supabase
          .from('profiles')
          .select('id')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (firstUser?.id === user.id) {
          await supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id);
          setIsAdmin(true);
        }
      }
    }
    setAdminLoading(false);
  }, [user]);

  useEffect(() => {
    refreshAdminStatus();
  }, [refreshAdminStatus]);

  return (
    <AdminContext.Provider value={{ isAdmin, adminLoading, refreshAdminStatus }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
