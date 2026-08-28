import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export interface ToolPreference {
  tool_id: string;
  is_favorite: boolean;
  is_pinned: boolean;
  last_used: string | null;
  use_count: number;
}

export interface ToolPreferencesState {
  favorites: Set<string>;
  pinned: Set<string>;
  recentlyUsed: string[];
  usageCounts: Record<string, number>;
  loading: boolean;
  toggleFavorite: (toolId: string) => Promise<void>;
  togglePin: (toolId: string) => Promise<void>;
  recordUsage: (toolId: string) => Promise<void>;
}

export function useToolPreferences(): ToolPreferencesState {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Record<string, ToolPreference>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    supabase
      .from('tool_preferences')
      .select('tool_id, is_favorite, is_pinned, last_used, use_count')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const map: Record<string, ToolPreference> = {};
        for (const row of (data || []) as ToolPreference[]) {
          map[row.tool_id] = row;
        }
        setPrefs(map);
        setLoading(false);
      });
  }, [user]);

  const upsertPref = useCallback(async (toolId: string, updates: Partial<ToolPreference>) => {
    if (!user) return;
    const existing = prefs[toolId] || {
      tool_id: toolId,
      is_favorite: false,
      is_pinned: false,
      last_used: null,
      use_count: 0,
    };
    const updated = { ...existing, ...updates };
    setPrefs(prev => ({ ...prev, [toolId]: updated }));

    await supabase
      .from('tool_preferences')
      .upsert({
        user_id: user.id,
        tool_id: toolId,
        is_favorite: updated.is_favorite,
        is_pinned: updated.is_pinned,
        last_used: updated.last_used,
        use_count: updated.use_count,
      }, { onConflict: 'user_id,tool_id' });
  }, [user, prefs]);

  const toggleFavorite = useCallback(async (toolId: string) => {
    const current = prefs[toolId]?.is_favorite || false;
    await upsertPref(toolId, { is_favorite: !current });
  }, [prefs, upsertPref]);

  const togglePin = useCallback(async (toolId: string) => {
    const current = prefs[toolId]?.is_pinned || false;
    await upsertPref(toolId, { is_pinned: !current });
  }, [prefs, upsertPref]);

  const recordUsage = useCallback(async (toolId: string) => {
    const current = prefs[toolId]?.use_count || 0;
    await upsertPref(toolId, {
      use_count: current + 1,
      last_used: new Date().toISOString(),
    });
  }, [prefs, upsertPref]);

  const favorites = new Set(Object.values(prefs).filter(p => p.is_favorite).map(p => p.tool_id));
  const pinned = new Set(Object.values(prefs).filter(p => p.is_pinned).map(p => p.tool_id));
  const recentlyUsed = Object.values(prefs)
    .filter(p => p.last_used)
    .sort((a, b) => new Date(b.last_used!).getTime() - new Date(a.last_used!).getTime())
    .slice(0, 6)
    .map(p => p.tool_id);
  const usageCounts: Record<string, number> = {};
  for (const p of Object.values(prefs)) {
    usageCounts[p.tool_id] = p.use_count;
  }

  return {
    favorites,
    pinned,
    recentlyUsed,
    usageCounts,
    loading,
    toggleFavorite,
    togglePin,
    recordUsage,
  };
}
