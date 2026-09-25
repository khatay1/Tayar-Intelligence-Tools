import { useState, useEffect, useCallback, useRef } from 'react';
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
  const userId = user?.id;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestRevision = useRef(0);
  const currentUserId = useRef(userId);
  currentUserId.current = userId;
  const [loadedUserId, setLoadedUserId] = useState<string>();

  const fetchNotifications = useCallback(async () => {
    const revision = ++requestRevision.current;
    const isCurrent = () => revision === requestRevision.current && currentUserId.current === userId;
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoadedUserId(undefined);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const [rows, unread] = await Promise.all([
        supabase.from('notifications').select('*').eq('user_id', userId)
          .order('created_at', { ascending: false }).limit(20),
        supabase.from('notifications').select('id', { count: 'exact', head: true })
          .eq('user_id', userId).eq('read', false),
      ]);
      if (!isCurrent()) return;
      if (rows.error || unread.error) throw rows.error || unread.error;
      setNotifications((rows.data as Notification[]) || []);
      setUnreadCount(unread.count || 0);
      setLoadedUserId(userId);
    } catch {
      if (isCurrent()) setError(true);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchNotifications();
    return () => { requestRevision.current += 1; };
  }, [fetchNotifications]);

  // Refresh after confirmed writes: repeated clicks and overlapping operations
  // cannot double-decrement a locally maintained count or revive stale rows.
  const markAsRead = useCallback(async (id: string) => {
    if (!userId || currentUserId.current !== userId) return;
    try {
      const { error: updateError } = await supabase.from('notifications')
        .update({ read: true }).eq('id', id).eq('user_id', userId).eq('read', false);
      if (currentUserId.current !== userId) return;
      if (updateError) throw updateError;
      await fetchNotifications();
    } catch { if (currentUserId.current === userId) setError(true); }
  }, [userId, fetchNotifications]);

  const markAllRead = useCallback(async () => {
    if (!userId || currentUserId.current !== userId) return;
    try {
      const { error: updateError } = await supabase.from('notifications')
        .update({ read: true }).eq('user_id', userId).eq('read', false);
      if (currentUserId.current !== userId) return;
      if (updateError) throw updateError;
      await fetchNotifications();
    } catch { if (currentUserId.current === userId) setError(true); }
  }, [userId, fetchNotifications]);

  const deleteNotification = useCallback(async (id: string) => {
    if (!userId || currentUserId.current !== userId) return;
    try {
      const { error: deleteError } = await supabase.from('notifications')
        .delete().eq('id', id).eq('user_id', userId);
      if (currentUserId.current !== userId) return;
      if (deleteError) throw deleteError;
      await fetchNotifications();
    } catch { if (currentUserId.current === userId) setError(true); }
  }, [userId, fetchNotifications]);

  return {
    notifications: loadedUserId === userId ? notifications : [],
    unreadCount: loadedUserId === userId ? unreadCount : 0,
    loading, error, markAsRead, markAllRead, deleteNotification,
    refresh: fetchNotifications,
  };
}
