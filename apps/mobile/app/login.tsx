import { useState } from 'react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { colors, radius, spacing } from '@/lib/theme';

type Mode = 'signin' | 'signup';

const PRIVACY_URL = 'https://tayar.se/#privacy';
const TERMS_URL = 'https://tayar.se/#terms';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function selectMode(next: Mode) {
    setMode(next);
    setError('');
    setNotice('');
    void Haptics.selectionAsync();
  }

  async function openLegal(url: string) {
    await WebBrowser.openBrowserAsync(url);
    void Haptics.selectionAsync();
  }

  async function submit() {
    if (!email.trim() || !password) return;
    if (mode === 'signup' && password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)/home');
        return;
      }

      const result = await signUp(email, password, fullName);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (result.needsEmailConfirmation) {
        setMode('signin');
        setPassword('');
        setNotice('Account created. Check your email to confirm it, then sign in here.');
      } else {
        router.replace('/(tabs)/home');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === 'signin' ? 'Could not sign in.' : 'Could not create account.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    if (!email.trim()) {
      setError('Enter your email first.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await resetPassword(email);
      setNotice('Password reset email sent. Open the secure link in your email to choose a new password.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send password reset email.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <LinearGradient colors={['#17102B', colors.bg, '#05050B']} style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 30 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandMark}><Text style={styles.brandLetter}>T</Text></View>
          <Text style={styles.brand}>Tayar Tools</Text>
          <Text style={styles.tagline}>Your AI and productivity workspace, built as a real mobile app.</Text>

          <View style={styles.card}>
            <View style={styles.segmentRow}>
              <Pressable onPress={() => selectMode('signin')} style={[styles.segment, mode === 'signin' && styles.segmentActive]}>
                <Text style={[styles.segmentText, mode === 'signin' && styles.segmentTextActive]}>Sign in</Text>
              </Pressable>
              <Pressable onPress={() => selectMode('signup')} style={[styles.segment, mode === 'signup' && styles.segmentActive]}>
                <Text style={[styles.segmentText, mode === 'signup' && styles.segmentTextActive]}>Create account</Text>
              </Pressable>
            </View>

            <Text style={styles.title}>{mode === 'signin' ? 'Welcome back' : 'Create your Tayar account'}</Text>
            <Text style={styles.subtitle}>{mode === 'signin' ? 'Use the same account you use on Tayar.se.' : 'Your account works across web, Android and iOS.'}</Text>

            {mode === 'signup' ? (
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoComplete="name"
                placeholder="Full name"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            ) : null}

            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="Email"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder={mode === 'signin' ? 'Password' : 'Password · 8+ characters'}
              placeholderTextColor={colors.muted}
              style={styles.input}
              onSubmitEditing={() => void submit()}
            />

            {mode === 'signin' ? (
              <Pressable disabled={busy} onPress={() => void forgotPassword()} style={styles.forgotButton}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            ) : null}

            {notice ? <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable onPress={() => void submit()} disabled={busy || !email.trim() || !password} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, (busy || !email.trim() || !password) && styles.buttonDisabled]}>
              {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>}
            </Pressable>

            {mode === 'signup' ? (
              <Text style={styles.legalText}>
                By creating an account, you agree to the{' '}
                <Text onPress={() => void openLegal(TERMS_URL)} style={styles.legalLink}>Terms of Service</Text>
                {' '}and acknowledge the{' '}
                <Text onPress={() => void openLegal(PRIVACY_URL)} style={styles.legalLink}>Privacy Policy</Text>.
              </Text>
            ) : null}

            <Text style={styles.securityNote}>Authentication is handled by the same secured Supabase account system used by Tayar.</Text>
          </View>

          <View style={styles.legalRow}>
            <Pressable onPress={() => void openLegal(PRIVACY_URL)} hitSlop={10}><Text style={styles.footerLink}>Privacy Policy</Text></Pressable>
            <Text style={styles.legalDot}>•</Text>
            <Pressable onPress={() => void openLegal(TERMS_URL)} hitSlop={10}><Text style={styles.footerLink}>Terms of Service</Text></Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 22, justifyContent: 'center' },
  brandMark: { width: 58, height: 58, borderRadius: 18, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  brandLetter: { color: colors.white, fontSize: 28, fontWeight: '900' },
  brand: { color: colors.text, fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  tagline: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 30, maxWidth: 340 },
  card: { backgroundColor: 'rgba(16,16,26,0.94)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: 13 },
  segmentRow: { flexDirection: 'row', gap: 7, padding: 4, borderRadius: 14, backgroundColor: colors.panelSoft, marginBottom: 3 },
  segment: { flex: 1, minHeight: 39, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.violetSoft, borderWidth: 1, borderColor: colors.violet },
  segmentText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  segmentTextActive: { color: '#DDD6FE' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 3 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 5 },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelSoft, color: colors.text, paddingHorizontal: 16, fontSize: 16 },
  forgotButton: { alignSelf: 'flex-end', paddingVertical: 3 },
  forgotText: { color: colors.violetBright, fontSize: 12, fontWeight: '800' },
  notice: { borderRadius: radius.md, borderWidth: 1, borderColor: '#22543D', backgroundColor: '#0C1D17', padding: 11 },
  noticeText: { color: '#A7E7C2', fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  button: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  buttonPressed: { opacity: 0.86, transform: [{ scale: 0.995 }] },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  legalText: { color: colors.muted, fontSize: 10.5, lineHeight: 16, textAlign: 'center' },
  legalLink: { color: colors.violetBright, fontWeight: '800' },
  securityNote: { color: colors.muted, fontSize: 10.5, lineHeight: 16, textAlign: 'center', marginTop: 2 },
  legalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 18 },
  footerLink: { color: colors.violetBright, fontSize: 11.5, fontWeight: '800' },
  legalDot: { color: colors.muted, fontSize: 12 },
});
