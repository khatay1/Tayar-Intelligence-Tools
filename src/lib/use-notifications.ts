import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  action_url: string | null;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    const { data, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (fetchError) {
      setError(true);
      setLoading(false);
      return;
    }
    const rows = (data as Notification[]) || [];
    setNotifications(rows);
    setUnreadCount(rows.filter(n => !n.read).length);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    const { error: updateError } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (updateError) { setError(true); return; }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const { error: updateError } = await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    if (updateError) { setError(true); return; }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [user]);

  const deleteNotification = useCallback(async (id: string) => {
    const removed = notifications.find(notification => notification.id === id);
    const { error: deleteError } = await supabase.from('notifications').delete().eq('id', id);
    if (deleteError) { setError(true); return; }
    setNotifications(prev => prev.filter(notification => notification.id !== id));
    if (removed && !removed.read) setUnreadCount(count => Math.max(0, count - 1));
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllRead,
    deleteNotification,
    refresh: fetchNotifications,
  };
}
