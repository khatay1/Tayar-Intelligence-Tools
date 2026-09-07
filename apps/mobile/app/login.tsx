import { useState } from 'react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { colors, radius, spacing } from '@/lib/theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
      router.replace('/(tabs)/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <LinearGradient colors={['#17102B', colors.bg, '#05050B']} style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24 }]}
      >
        <View style={styles.brandMark}><Text style={styles.brandLetter}>T</Text></View>
        <Text style={styles.brand}>Tayar Tools</Text>
        <Text style={styles.tagline}>Your AI and productivity workspace, built for mobile.</Text>

        <View style={styles.card}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in with your existing Tayar account.</Text>

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
            autoComplete="current-password"
            placeholder="Password"
            placeholderTextColor={colors.muted}
            style={styles.input}
            onSubmitEditing={() => void submit()}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={() => void submit()} disabled={busy} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, busy && styles.buttonDisabled]}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Sign in</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 22, justifyContent: 'center' },
  brandMark: { width: 58, height: 58, borderRadius: 18, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  brandLetter: { color: colors.white, fontSize: 28, fontWeight: '900' },
  brand: { color: colors.text, fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  tagline: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 30, maxWidth: 340 },
  card: { backgroundColor: 'rgba(16,16,26,0.94)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: 14 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 6 },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelSoft, color: colors.text, paddingHorizontal: 16, fontSize: 16 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  button: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonPressed: { opacity: 0.86, transform: [{ scale: 0.995 }] },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});
