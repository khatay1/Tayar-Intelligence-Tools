import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { colors, radius } from '@/lib/theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const email = user?.email || '—';
  const name = String(user?.user_metadata?.full_name || email.split('@')[0] || 'Tayar user');

  async function logout() {
    await signOut();
    router.replace('/login');
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
        </View>
      </View>

      <View style={styles.menu}>
        <View style={styles.row}><MaterialCommunityIcons name="shield-account-outline" size={21} color={colors.violetBright} /><View style={{ flex: 1 }}><Text style={styles.rowTitle}>Account</Text><Text style={styles.rowSub}>Same Tayar identity across web, Android and iOS.</Text></View></View>
        <View style={styles.row}><MaterialCommunityIcons name="credit-card-outline" size={21} color={colors.violetBright} /><View style={{ flex: 1 }}><Text style={styles.rowTitle}>Subscription</Text><Text style={styles.rowSub}>Native billing screen will use your existing Tayar plan.</Text></View></View>
        <View style={styles.row}><MaterialCommunityIcons name="translate" size={21} color={colors.violetBright} /><View style={{ flex: 1 }}><Text style={styles.rowTitle}>Language</Text><Text style={styles.rowSub}>English, Arabic and Swedish mobile UI is planned in the shared app layer.</Text></View></View>
      </View>

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
  menu: { marginTop: 18, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, overflow: 'hidden' },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  rowSub: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  logout: { marginTop: 18, minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: '#4B2430', backgroundColor: '#1E1116', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  logoutText: { color: colors.danger, fontSize: 14, fontWeight: '800' },
});
