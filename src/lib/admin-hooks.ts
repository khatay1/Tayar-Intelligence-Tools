import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

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

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, projectsRes, aiRes, subsRes] = await Promise.all([
        supabase.from('profiles').select('id, created_at, plan, suspended'),
        supabase.from('projects').select('id, created_at', { count: 'exact', head: false }),
        supabase.from('ai_usage').select('id, user_id, created_at, status, cost_usd'),
        supabase.from('subscriptions').select('id, plan, status'),
      ]);

      const queryError = profilesRes.error || projectsRes.error || aiRes.error || subsRes.error;
      if (queryError) throw queryError;

      const profiles = profilesRes.data || [];
      const projects = projectsRes.data || [];
      const aiUsage = aiRes.data || [];
      const subs = subsRes.data || [];

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const newUsersToday = profiles.filter(p => new Date(p.created_at) >= today).length;
      const activeSubscriptions = subs.filter(s => s.status === 'active' && s.plan !== 'free').length;

      const planPrices: Record<string, number> = { pro: 19, business: 49, enterprise: 99 };
      const monthlyRevenue = subs
        .filter(s => s.status === 'active')
        .reduce((sum, s) => sum + (planPrices[s.plan] || 0), 0);

      // Active users: users with AI requests in last 7 days
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const activeUserIds = new Set(aiUsage.filter(u => new Date(u.created_at) >= weekAgo).map(u => u.user_id).filter(Boolean));

      setStats({
        totalUsers: profiles.length,
        activeUsers: activeUserIds.size,
        newUsersToday,
        totalAIRequests: aiUsage.length,
        totalDocuments: projects.length,
        activeSubscriptions,
        monthlyRevenue,
        serverStatus: 'online',
      });
    } catch {
      setStats(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { stats, loading, refresh: load };
}

export function useUserGrowth() {
  const [data, setData] = useState<UserGrowthPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('created_at')
        .order('created_at', { ascending: true });
      const profilesData = (profiles || []) as { created_at: string }[];

      // Group by day for last 30 days
      const days: Record<string, number> = {};
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        days[key] = 0;
      }
      let cumulative = 0;
      const allTimeCount: Record<string, number> = {};
      for (const p of profilesData) {
        const key = new Date(p.created_at).toISOString().split('T')[0];
        allTimeCount[key] = (allTimeCount[key] || 0) + 1;
      }
      const sortedKeys = Object.keys(allTimeCount).sort();
      for (const key of sortedKeys) {
        cumulative += allTimeCount[key];
        if (days[key] !== undefined) days[key] = cumulative;
      }
      // Fill forward cumulative
      let lastVal = 0;
      const result = Object.entries(days).map(([date, val]) => {
        if (val === 0 && lastVal > 0) val = lastVal;
        lastVal = val;
        return { date, users: val };
      });
      setData(result);
      setLoading(false);
    })();
  }, []);

  return { data, loading };
}

export function useRevenueData() {
  const [data, setData] = useState<RevenuePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: subs } = await supabase.from('subscriptions').select('plan, status, created_at');
      const subsData = (subs || []) as { plan: string; status: string; created_at: string }[];
      const planPrices: Record<string, number> = { pro: 19, business: 49, enterprise: 99, free: 0 };

      // Last 6 months
      const months: Record<string, number> = {};
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toLocaleString('en', { month: 'short' });
        months[key] = 0;
      }
      for (const s of subsData) {
        if (s.status !== 'active') continue;
        const d = new Date(s.created_at);
        const key = d.toLocaleString('en', { month: 'short' });
        if (key in months) months[key] += planPrices[s.plan] || 0;
      }
      setData(Object.entries(months).map(([month, revenue]) => ({ month, revenue })));
      setLoading(false);
    })();
  }, []);

  return { data, loading };
}

export function useAIUsageData() {
  const [data, setData] = useState<AIUsagePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: usage } = await supabase
        .from('ai_usage')
        .select('created_at, tokens_in, tokens_out')
        .order('created_at', { ascending: true })
        .limit(5000);
      const usageData = (usage || []) as { created_at: string; tokens_in: number; tokens_out: number }[];

      const days: Record<string, { requests: number; tokens: number }> = {};
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
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

  return { data, loading };
}

export function useToolPopularity() {
  const [data, setData] = useState<ToolPopularityPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: usage } = await supabase
        .from('ai_usage')
        .select('tool')
        .limit(10000);
      const usageData = (usage || []) as { tool: string }[];
      const counts: Record<string, number> = {};
      for (const u of usageData) counts[u.tool] = (counts[u.tool] || 0) + 1;
      const sorted = Object.entries(counts).map(([tool, count]) => ({ tool, count })).sort((a, b) => b.count - a.count);
      setData(sorted);
      setLoading(false);
    })();
  }, []);

  return { data, loading };
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('admin_list_users');

    if (rpcError) {
      console.error('Failed to load admin users:', rpcError);
      setUsers([]);
      setError(rpcError.message || 'Failed to load users.');
      setLoading(false);
      return;
    }

    const result = ((data || []) as AdminUser[]).map((user) => ({
      ...user,
      email: user.email || '',
      project_count: Number(user.project_count || 0),
      ai_request_count: Number(user.ai_request_count || 0),
    }));

    setUsers(result);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { users, loading, error, refresh: load };
}
