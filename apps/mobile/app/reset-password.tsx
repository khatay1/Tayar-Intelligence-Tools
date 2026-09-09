import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { colors, radius } from '@/lib/theme';

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { user, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const valid = useMemo(() => password.length >= 8 && password === confirm && !busy, [password, confirm, busy]);

  async function savePassword() {
    if (!valid) return;
    setBusy(true);
    setError('');
    try {
      await updatePassword(password);
      setDone(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your password.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.iconWrap}><MaterialCommunityIcons name="lock-alert-outline" size={30} color={colors.violetBright} /></View>
        <Text style={styles.title}>Open your recovery link</Text>
        <Text style={styles.subtitle}>A valid password-recovery session is required before Tayar can change your password. Open the secure link from your reset email, then return here.</Text>
        <Pressable onPress={() => router.replace('/login')} style={styles.secondaryButton}><Text style={styles.secondaryText}>Back to sign in</Text></Pressable>
      </View>
    );
  }

  if (done) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.successIcon}><MaterialCommunityIcons name="check" size={32} color="#BBF7D0" /></View>
        <Text style={styles.title}>Password updated</Text>
        <Text style={styles.subtitle}>Your new password is active for Tayar on web, Android and iOS.</Text>
        <Pressable onPress={() => router.replace('/(tabs)/home')} style={styles.primaryButton}><Text style={styles.primaryText}>Continue to Tayar</Text></Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <View style={[styles.content, { paddingTop: insets.top + 42, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.iconWrap}><MaterialCommunityIcons name="lock-reset" size={30} color={colors.violetBright} /></View>
        <Text style={styles.title}>Choose a new password</Text>
        <Text style={styles.subtitle}>Use at least 8 characters. This changes the password for your existing Tayar account.</Text>

        <Text style={styles.label}>New password</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="8+ characters" placeholderTextColor={colors.muted} style={styles.input} />
        <Text style={styles.label}>Confirm password</Text>
        <TextInput value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" placeholder="Repeat new password" placeholderTextColor={colors.muted} style={styles.input} onSubmitEditing={() => void savePassword()} />

        {confirm && password !== confirm ? <Text style={styles.hintError}>Passwords do not match.</Text> : null}
        {password && password.length < 8 ? <Text style={styles.hintError}>Password must be at least 8 characters.</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable disabled={!valid} onPress={() => void savePassword()} style={({ pressed }) => [styles.primaryButton, pressed && valid && { opacity: 0.86 }, !valid && styles.disabled]}>
          {busy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name="shield-check-outline" size={20} color={colors.white} />}
          <Text style={styles.primaryText}>{busy ? 'Updating…' : 'Update password'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, paddingHorizontal: 22, justifyContent: 'center' },
  centered: { paddingHorizontal: 26, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 60, height: 60, borderRadius: 19, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  successIcon: { width: 60, height: 60, borderRadius: 19, backgroundColor: '#123527', alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  title: { color: colors.text, fontSize: 27, fontWeight: '900', letterSpacing: -0.7, textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 9, marginBottom: 20, maxWidth: 360 },
  label: { color: colors.text, fontSize: 12, fontWeight: '800', marginTop: 10, marginBottom: 7 },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, paddingHorizontal: 15, fontSize: 16 },
  hintError: { color: '#FCA5A5', fontSize: 11.5, marginTop: 7 },
  error: { color: colors.danger, fontSize: 12.5, lineHeight: 18, marginTop: 10 },
  primaryButton: { width: '100%', minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  primaryText: { color: colors.white, fontSize: 14.5, fontWeight: '900' },
  secondaryButton: { width: '100%', maxWidth: 360, minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.42 },
});
