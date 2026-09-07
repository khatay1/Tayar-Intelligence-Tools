import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { getToolAccessState } from '@/lib/tool-access';
import { supabase } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';

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
  const email = user?.email || '—';
  const name = String(user?.user_metadata?.full_name || email.split('@')[0] || 'Tayar user');
  const [plan, setPlan] = useState('');
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState('');

  async function loadPlan() {
    try {
      const state = await getToolAccessState('email-writer');
      setPlan(String(state.effective_plan || 'free'));
    } catch {
      setPlan('');
    }
  }

  useEffect(() => { void loadPlan(); }, []);

  async function logout() {
    await signOut();
    router.replace('/login');
  }

  async function openBilling() {
    if (billingBusy) return;
    setBillingBusy(true);
    setBillingError('');
    try {
      const { data, error } = await supabase.functions.invoke('billing-portal', { body: {} });
      if (error) throw error;
      const url = data && typeof data === 'object' && typeof (data as { url?: unknown }).url === 'string'
        ? String((data as { url: string }).url)
        : '';
      if (!url) throw new Error('Billing portal is not available for this account yet.');
      await WebBrowser.openBrowserAsync(url);
      await loadPlan();
      void Haptics.selectionAsync();
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : 'Could not open billing.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBillingBusy(false);
    }
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
          <View style={styles.planPill}><Text style={styles.planText}>{displayPlan(plan)} plan</Text></View>
        </View>
      </View>

      <View style={styles.menu}>
        <View style={styles.row}>
          <MaterialCommunityIcons name="shield-account-outline" size={21} color={colors.violetBright} />
          <View style={{ flex: 1 }}><Text style={styles.rowTitle}>Account</Text><Text style={styles.rowSub}>The same secure Tayar identity is used across web, Android and iOS.</Text></View>
        </View>

        <Pressable onPress={() => void openBilling()} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.panelSoft }]}>
          <MaterialCommunityIcons name="credit-card-outline" size={21} color={colors.violetBright} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Manage subscription</Text>
            <Text style={styles.rowSub}>{plan ? `${displayPlan(plan)} plan · Stripe billing portal` : 'Secure Stripe billing portal'}</Text>
          </View>
          {billingBusy ? <ActivityIndicator color={colors.violetBright} /> : <MaterialCommunityIcons name="open-in-new" size={19} color={colors.muted} />}
        </Pressable>

        <View style={[styles.row, styles.lastRow]}>
          <MaterialCommunityIcons name="cellphone-lock" size={21} color={colors.violetBright} />
          <View style={{ flex: 1 }}><Text style={styles.rowTitle}>Local processing</Text><Text style={styles.rowSub}>PDF, CSV and supported image workflows run on-device whenever possible.</Text></View>
        </View>
      </View>

      {billingError ? <Text style={styles.error}>{billingError}</Text> : null}

      <Pressable onPress={() => void logout()} style={({ pressed }) => [styles.logout, pressed && { opacity: 0.82 }]}>
        <MaterialCommunityIcons name="logout" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
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
});
