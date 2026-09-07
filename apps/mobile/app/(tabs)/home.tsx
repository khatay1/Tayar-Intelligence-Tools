import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { ToolCard } from '@/components/ToolCard';
import { mobileTools } from '@/data/tools';
import { getToolAccessState, type ToolAccessState } from '@/lib/tool-access';
import { colors, radius } from '@/lib/theme';

function displayPlan(value?: string) {
  const plan = String(value || '').toLowerCase();
  if (plan === 'business') return 'Business';
  if (plan === 'pro') return 'Pro';
  if (plan === 'free') return 'Free';
  return '—';
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const firstName = String(user?.user_metadata?.full_name || user?.email || 'there').split(/[ @]/)[0];
  const featured = mobileTools.slice(0, 3);
  const [accessByTool, setAccessByTool] = useState<Record<string, ToolAccessState>>({});

  useEffect(() => {
    let cancelled = false;
    void Promise.all(featured.map(async (tool) => {
      try {
        return [tool.id, await getToolAccessState(tool.id)] as const;
      } catch {
        return [tool.id, null] as const;
      }
    })).then((entries) => {
      if (cancelled) return;
      const next: Record<string, ToolAccessState> = {};
      for (const [toolId, state] of entries) if (state) next[toolId] = state;
      setAccessByTool(next);
    });
    return () => { cancelled = true; };
  }, []);

  const currentPlan = useMemo(() => {
    for (const tool of featured) {
      const plan = accessByTool[tool.id]?.effective_plan;
      if (plan) return displayPlan(plan);
    }
    return '—';
  }, [accessByTool, featured]);
  const categoryCount = new Set(mobileTools.map((tool) => tool.category)).size;

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: 110 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>TAYAR TOOLS</Text>
          <Text style={styles.greeting}>Hi, {firstName}</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/profile')} style={styles.avatar}>
          <MaterialCommunityIcons name="account" size={24} color={colors.text} />
        </Pressable>
      </View>

      <LinearGradient colors={['#2B1760', '#16132A']} style={styles.hero}>
        <View style={styles.heroIcon}><MaterialCommunityIcons name="creation" size={28} color="#D8B4FE" /></View>
        <Text style={styles.heroTitle}>What do you want to get done?</Text>
        <Text style={styles.heroText}>Jump into AI, documents, images and productivity tools built as native mobile workflows.</Text>
        <Pressable onPress={() => router.push('/(tabs)/tools')} style={styles.heroButton}>
          <Text style={styles.heroButtonText}>Browse all tools</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color={colors.white} />
        </Pressable>
      </LinearGradient>

      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statValue}>{currentPlan}</Text><Text style={styles.statLabel}>Current plan</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{mobileTools.length}</Text><Text style={styles.statLabel}>Native tools</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{categoryCount}</Text><Text style={styles.statLabel}>Categories</Text></View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recommended</Text>
        <Pressable onPress={() => router.push('/(tabs)/tools')}><Text style={styles.sectionLink}>See all</Text></Pressable>
      </View>
      <View style={styles.list}>
        {featured.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            access={accessByTool[tool.id]}
            onPress={() => tool.route ? router.push(tool.route) : router.push('/(tabs)/tools')}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  kicker: { color: colors.violetBright, fontSize: 11, fontWeight: '900', letterSpacing: 2.2 },
  greeting: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 3, letterSpacing: -0.8 },
  avatar: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.panelSoft, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: radius.xl, padding: 22, borderWidth: 1, borderColor: '#44306F' },
  heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(139,92,246,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  heroTitle: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.6 },
  heroText: { color: '#B8B6C9', fontSize: 14, lineHeight: 21, marginTop: 9 },
  heroButton: { marginTop: 20, minHeight: 48, borderRadius: 16, backgroundColor: colors.violet, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroButtonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 9, marginTop: 14 },
  stat: { flex: 1, minHeight: 76, borderRadius: 18, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, padding: 12, justifyContent: 'center' },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '900' },
  statLabel: { color: colors.muted, fontSize: 10.5, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '900' },
  sectionLink: { color: colors.violetBright, fontSize: 13, fontWeight: '800' },
  list: { gap: 10 },
});
