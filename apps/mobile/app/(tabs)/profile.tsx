import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/useAuth';
import { getToolAccessState } from '@/lib/tool-access';
import { supabase } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';

const PRIVACY_URL = 'https://tayar.se/#privacy';
const TERMS_URL = 'https://tayar.se/#terms';

function displayPlan(value?: string) {
  const plan = String(value || '').toLowerCase();
  if (plan === 'business') return 'Business';
  if (plan === 'pro') return 'Pro';
  if (plan === 'free') return 'Free';
  return 'Loading…';
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const userId = user?.id ?? null;
  const email = user?.email || '—';
  const name = String(user?.user_metadata?.full_name || email.split('@')[0] || 'Tayar user');
  const iosCompanion = Platform.OS === 'ios';
  const [plan, setPlan] = useState('');
  const [aiUsageCount, setAiUsageCount] = useState<number | null>(null);
  const [aiUsageError, setAiUsageError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let active = true;
    setPlan('');
    setAiUsageCount(null);
    setAiUsageError('');

    async function loadPlanStatus() {
      if (iosCompanion) return;
      try {
        const state = await getToolAccessState('email-writer');
        if (active) setPlan(String(state.effective_plan || 'free'));
      } catch {
        if (active) setPlan('');
      }
    }

    async function loadAiUsageStatus() {
      if (!userId) return;
      try {
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
        const { count, error } = await supabase
          .from('ai_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'success')
          .gte('created_at', monthStart);
        if (error) throw error;
        if (active) setAiUsageCount(count || 0);
      } catch {
        if (active) {
          setAiUsageCount(null);
          setAiUsageError('Could not load your AI usage status.');
        }
      }
    }

    void Promise.all([loadPlanStatus(), loadAiUsageStatus()]);
    return () => { active = false; };
  }, [iosCompanion, userId]);

  async function logout() {
    await signOut();
    router.replace('/login');
  }

  async function openLegal(url: string) {
    await WebBrowser.openBrowserAsync(url);
    void Haptics.selectionAsync();
  }

  async function deleteAccount() {
    if (deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: { confirmation: 'DELETE' },
      });
      if (error) throw error;
      if (!data || typeof data !== 'object' || (data as { deleted?: unknown }).deleted !== true) {
        throw new Error('Account deletion did not complete.');
      }

      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/login');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete your account.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setDeleteBusy(false);
    }
  }

  function confirmDeleteAccount() {
    if (deleteBusy) return;
    Alert.alert(
      'Delete your Tayar account?',
      'This permanently deletes your Tayar account and associated Tayar data. Active subscriptions are cancelled first. This action cannot be undone.',
      [
        { text: 'Keep account', style: 'cancel' },
        { text: 'Delete permanently', style: 'destructive', onPress: () => void deleteAccount() },
      ],
      { cancelable: true },
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: 110 }]}>
      <Text style={styles.kicker}>PROFILE</Text>
      <Text style={styles.title}>Your Tayar account.</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.name}>{name}</Text>
          <Text numberOfLines={1} style={styles.email}>{email}</Text>
          <View style={styles.planPill}><Text style={styles.planText}>{iosCompanion ? 'Included mobile access' : `${displayPlan(plan)} plan`}</Text></View>
        </View>
      </View>

      <View style={styles.menu}>
        <View style={styles.row}>
          <MaterialCommunityIcons name="shield-account-outline" size={21} color={colors.violetBright} />
          <View style={{ flex: 1 }}><Text style={styles.rowTitle}>Account</Text><Text style={styles.rowSub}>The same secure Tayar identity is used across web, Android and iOS.</Text></View>
        </View>

        <View style={styles.row}>
          <MaterialCommunityIcons name="account-key-outline" size={21} color={colors.violetBright} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{iosCompanion ? 'Mobile access' : 'Plan access'}</Text>
            <Text style={styles.rowSub}>{iosCompanion
              ? 'This iOS release provides the same included companion toolset to every signed-in account. No purchase is required in the app.'
              : plan ? `${displayPlan(plan)} plan · your Tayar account access is active on this device.` : 'Your Tayar account access is available on this device.'}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <MaterialCommunityIcons name="chart-timeline-variant" size={21} color={colors.violetBright} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>AI usage</Text>
            <Text style={styles.rowSub}>{aiUsageError
              ? aiUsageError
              : aiUsageCount === null
                ? 'Loading your AI usage status…'
                : `${aiUsageCount} successful AI requests this month · only your signed-in account is shown here.`}</Text>
          </View>
        </View>

        <View style={[styles.row, styles.lastRow]}>
          <MaterialCommunityIcons name="cellphone-lock" size={21} color={colors.violetBright} />
          <View style={{ flex: 1 }}><Text style={styles.rowTitle}>Local processing</Text><Text style={styles.rowSub}>PDF, CSV and supported image workflows run on-device whenever possible.</Text></View>
        </View>
      </View>

      <View style={styles.menu}>
        <Pressable onPress={() => void openLegal(PRIVACY_URL)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.panelSoft }]}>
          <MaterialCommunityIcons name="shield-lock-outline" size={21} color={colors.violetBright} />
          <View style={{ flex: 1 }}><Text style={styles.rowTitle}>Privacy Policy</Text><Text style={styles.rowSub}>How Tayar handles account, tool and service data.</Text></View>
          <MaterialCommunityIcons name="open-in-new" size={19} color={colors.muted} />
        </Pressable>

        <Pressable onPress={() => void openLegal(TERMS_URL)} style={({ pressed }) => [styles.row, styles.lastRow, pressed && { backgroundColor: colors.panelSoft }]}>
          <MaterialCommunityIcons name="file-document-outline" size={21} color={colors.violetBright} />
          <View style={{ flex: 1 }}><Text style={styles.rowTitle}>Terms of Service</Text><Text style={styles.rowSub}>The terms that apply when using Tayar Tools.</Text></View>
          <MaterialCommunityIcons name="open-in-new" size={19} color={colors.muted} />
        </Pressable>
      </View>

      <Pressable onPress={() => void logout()} style={({ pressed }) => [styles.logout, pressed && { opacity: 0.82 }]}>
        <MaterialCommunityIcons name="logout" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>

      <View style={styles.dangerZone}>
        <View style={styles.dangerHeader}>
          <MaterialCommunityIcons name="alert-octagon-outline" size={20} color={colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={styles.dangerTitle}>Delete account</Text>
            <Text style={styles.dangerSub}>Permanently remove your account and associated Tayar data.</Text>
          </View>
        </View>
        <Pressable
          disabled={deleteBusy}
          onPress={confirmDeleteAccount}
          style={({ pressed }) => [styles.deleteButton, pressed && !deleteBusy && { opacity: 0.82 }, deleteBusy && styles.disabled]}
        >
          {deleteBusy ? <ActivityIndicator color={colors.danger} /> : <MaterialCommunityIcons name="delete-forever-outline" size={20} color={colors.danger} />}
          <Text style={styles.deleteText}>{deleteBusy ? 'Deleting account…' : 'Delete account permanently'}</Text>
        </Pressable>
      </View>

      {deleteError ? <Text style={styles.error}>{deleteError}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18 },
  kicker: { color: colors.violetBright, fontSize: 11, fontWeight: '900', letterSpacing: 2.2 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.8, marginTop: 4, marginBottom: 20 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  avatar: { width: 58, height: 58, borderRadius: 19, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 24, fontWeight: '900' },
  name: { color: colors.text, fontSize: 18, fontWeight: '900' },
  email: { color: colors.muted, fontSize: 12, marginTop: 4 },
  planPill: { alignSelf: 'flex-start', marginTop: 8, borderRadius: 999, backgroundColor: colors.violetSoft, paddingHorizontal: 9, paddingVertical: 4 },
  planText: { color: '#DDD6FE', fontSize: 10, fontWeight: '900' },
  menu: { marginTop: 18, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, overflow: 'hidden' },
  row: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  lastRow: { borderBottomWidth: 0 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  rowSub: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18, marginTop: 12 },
  logout: { marginTop: 18, minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: '#4B2430', backgroundColor: '#1E1116', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  logoutText: { color: colors.danger, fontSize: 14, fontWeight: '800' },
  dangerZone: { marginTop: 18, borderRadius: radius.lg, borderWidth: 1, borderColor: '#4B2430', backgroundColor: '#140D11', padding: 16 },
  dangerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  dangerTitle: { color: colors.danger, fontSize: 14, fontWeight: '900' },
  dangerSub: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  deleteButton: { minHeight: 48, marginTop: 14, borderRadius: radius.md, borderWidth: 1, borderColor: '#63313F', backgroundColor: '#1E1116', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 12 },
  deleteText: { color: colors.danger, fontSize: 13.5, fontWeight: '900' },
  disabled: { opacity: 0.48 },
});
