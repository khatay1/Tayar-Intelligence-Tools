import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { readAllRows } from '@/lib/paginated-query';

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  plan: string;
  role: string;
  suspended: boolean;
  created_at: string;
  project_count: number;
  ai_request_count: number;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  totalAIRequests: number;
  totalDocuments: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  serverStatus: 'online' | 'degraded' | 'offline';
}

export interface UserGrowthPoint { date: string; users: number; }
export interface RevenuePoint { month: string; revenue: number; }
export interface AIUsagePoint { date: string; requests: number; tokens: number; }
export interface ToolPopularityPoint { tool: string; count: number; }

const BILLING_ACTIVE_STATUSES = new Set(['active', 'trialing']);

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profilesRes, projectsRes, aiRes, subsRes, recentAiRes] = await Promise.all([
        readAllRows(() => supabase.from('profiles').select('id, created_at, plan, suspended').order('id')),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('ai_usage').select('id', { count: 'exact', head: true }),
        readAllRows(() => supabase.from('subscriptions').select('id, plan, status').order('id')),
        readAllRows(() => supabase.from('ai_usage').select('user_id').gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()).order('id')),
      ]);

      const queryError = profilesRes.error || projectsRes.error || aiRes.error || subsRes.error || recentAiRes.error;
      if (queryError) throw queryError;

      const profiles = profilesRes.data || [];
      const subs = subsRes.data || [];

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const newUsersToday = profiles.filter(p => new Date(p.created_at) >= today).length;
      const activeSubscriptions = subs.filter(s => BILLING_ACTIVE_STATUSES.has(s.status) && s.plan !== 'free').length;

      // Estimated MRR at the current public plan prices. This is intentionally
      // a run-rate estimate, not recognized revenue from Stripe invoices.
      const planPrices: Record<string, number> = { pro: 19, business: 49, enterprise: 99 };
      const monthlyRevenue = subs
        .filter(s => BILLING_ACTIVE_STATUSES.has(s.status))
        .reduce((sum, s) => sum + (planPrices[s.plan] || 0), 0);

      // AI-active users: users with AI requests in the last 7 days.
      const activeUserIds = new Set(recentAiRes.data.map(u => u.user_id).filter(Boolean));

      setStats({
        totalUsers: profiles.length,
        activeUsers: activeUserIds.size,
        newUsersToday,
        totalAIRequests: aiRes.count || 0,
        totalDocuments: projectsRes.count || 0,
        activeSubscriptions,
        monthlyRevenue,
        serverStatus: 'online',
      });
    } catch (loadError) {
      console.error('Failed to load admin dashboard:', loadError);
      setStats(null);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load admin dashboard.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  return { stats, loading, error, refresh: load };
}

export function useUserGrowth() {
  const [data, setData] = useState<UserGrowthPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: profiles, error: queryError } = await readAllRows(() => supabase.from('profiles').select('created_at').order('id'));
      if (queryError) { setError(queryError.message); setLoading(false); return; }
      const profilesData = (profiles || []) as { created_at: string }[];

      // Group by day for the last 30 days while preserving users created
      // before the window as the cumulative baseline.
      const days: Record<string, number> = {};
      const now = new Date();
      const firstDay = new Date(now);
      firstDay.setUTCDate(firstDay.getUTCDate() - 29);
      firstDay.setUTCHours(0, 0, 0, 0);

      for (let i = 29; i >= 0; i--) {
        const d = new Date(now); d.setUTCDate(d.getUTCDate() - i);
        const key = d.toISOString().split('T')[0];
        days[key] = 0;
      }

      let cumulative = profilesData.filter((profile) => new Date(profile.created_at) < firstDay).length;
      const dailyCounts: Record<string, number> = {};
      for (const profile of profilesData) {
        const created = new Date(profile.created_at);
        if (created < firstDay) continue;
        const key = created.toISOString().split('T')[0];
        if (days[key] !== undefined) dailyCounts[key] = (dailyCounts[key] || 0) + 1;
      }

      const result = Object.keys(days).map((date) => {
        cumulative += dailyCounts[date] || 0;
        return { date, users: cumulative };
      });
      setData(result);
      setLoading(false);
    })();
  }, []);

  return { data, loading, error };
}

export function useRevenueData() {
  const [data, setData] = useState<RevenuePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: subs, error: queryError } = await readAllRows(() => supabase.from('subscriptions').select('plan, status, created_at').order('id'));
      if (queryError) { setError(queryError.message); setLoading(false); return; }
      const subsData = (subs || []) as { plan: string; status: string; created_at: string }[];
      const planPrices: Record<string, number> = { pro: 19, business: 49, enterprise: 99, free: 0 };

      // Last six subscription-start cohorts. Use a year-month key so an old
      // subscription from the same month name cannot leak into the current year.
      const months: Record<string, { month: string; revenue: number }> = {};
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months[key] = { month: d.toLocaleString('en', { month: 'short' }), revenue: 0 };
      }
      for (const s of subsData) {
        if (!BILLING_ACTIVE_STATUSES.has(s.status)) continue;
        const d = new Date(s.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (months[key]) months[key].revenue += planPrices[s.plan] || 0;
      }
      setData(Object.values(months));
      setLoading(false);
    })();
  }, []);

  return { data, loading, error };
}

export function useAIUsageData() {
  const [data, setData] = useState<AIUsagePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const windowStart = new Date(); windowStart.setUTCDate(windowStart.getUTCDate() - 29); windowStart.setUTCHours(0, 0, 0, 0);
      const { data: usage, error: queryError } = await readAllRows(() => supabase.from('ai_usage').select('created_at, tokens_in, tokens_out').gte('created_at', windowStart.toISOString()).order('id'));
      if (queryError) { setError(queryError.message); setLoading(false); return; }
      const usageData = (usage || []) as { created_at: string; tokens_in: number; tokens_out: number }[];

      const days: Record<string, { requests: number; tokens: number }> = {};
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now); d.setUTCDate(d.getUTCDate() - i);
        const key = d.toISOString().split('T')[0];
        days[key] = { requests: 0, tokens: 0 };
      }
      for (const u of usageData) {
        const key = new Date(u.created_at).toISOString().split('T')[0];
        if (days[key]) {
          days[key].requests++;
          days[key].tokens += u.tokens_in + u.tokens_out;
        }
      }
      setData(Object.entries(days).map(([date, v]) => ({ date, requests: v.requests, tokens: v.tokens })));
      setLoading(false);
    })();
  }, []);

  return { data, loading, error };
}

export function useToolPopularity() {
  const [data, setData] = useState<ToolPopularityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: usage, error: queryError } = await readAllRows(() => supabase.from('ai_usage').select('tool').order('id'));
      if (queryError) { setError(queryError.message); setLoading(false); return; }
      const usageData = (usage || []) as { tool: string }[];
      const counts: Record<string, number> = {};
      for (const u of usageData) counts[u.tool] = (counts[u.tool] || 0) + 1;
      const sorted = Object.entries(counts).map(([tool, count]) => ({ tool, count })).sort((a, b) => b.count - a.count);
      setData(sorted);
      setLoading(false);
    })();
  }, []);

  return { data, loading, error };
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_list_users');
      if (rpcError) throw rpcError;

      const result = ((data || []) as AdminUser[]).map((user) => ({
        ...user,
        email: user.email || '',
        full_name: user.full_name || '',
        project_count: Number(user.project_count || 0),
        ai_request_count: Number(user.ai_request_count || 0),
      }));

      setUsers(result);
    } catch (error) {
      console.error('Failed to load admin users:', error);
      setUsers([]);
      setError(error && typeof error === 'object' && 'message' in error
        ? String(error.message || 'Failed to load users.')
        : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { users, loading, error, refresh: load };
}
