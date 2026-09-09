import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { runTayarAI } from '@/lib/ai';
import { colors, radius } from '@/lib/theme';

const tones = ['Professional', 'Friendly', 'Concise', 'Warm'] as const;
const modes = ['Compose', 'Reply', 'Improve'] as const;

type Tone = typeof tones[number];
type Mode = typeof modes[number];

export default function EmailWriterScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('Compose');
  const [tone, setTone] = useState<Tone>('Professional');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canRun = useMemo(() => details.trim().length >= 5 && !busy, [details, busy]);

  async function generate() {
    if (!canRun) return;
    setBusy(true);
    setError('');
    try {
      const system = `You are Tayar AI Email, a precise mobile email assistant. ${mode} an email in a ${tone.toLowerCase()} tone. Return only the final email ready to send. Keep formatting clean and mobile-readable.`;
      const user = [
        `Mode: ${mode}`,
        `Tone: ${tone}`,
        recipient.trim() ? `Recipient/context: ${recipient.trim()}` : '',
        subject.trim() ? `Subject/topic: ${subject.trim()}` : '',
        `Instructions or source email:\n${details.trim()}`,
      ].filter(Boolean).join('\n\n');
      const response = await runTayarAI('email-writer', system, user, { temperature: 0.4, maxTokens: 2200 });
      setResult(response.content);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate email.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    await Clipboard.setStringAsync(result);
    void Haptics.selectionAsync();
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <View style={styles.heroIcon}><MaterialCommunityIcons name="email-fast-outline" size={24} color={colors.violetBright} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>AI Email</Text>
          <Text style={styles.subtitle}>Write polished emails without leaving the app.</Text>
        </View>
      </View>

      <Text style={styles.label}>Mode</Text>
      <View style={styles.segmentRow}>
        {modes.map(item => (
          <Pressable key={item} onPress={() => setMode(item)} style={[styles.segment, mode === item && styles.segmentActive]}>
            <Text style={[styles.segmentText, mode === item && styles.segmentTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Tone</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {tones.map(item => (
          <Pressable key={item} onPress={() => setTone(item)} style={[styles.chip, tone === item && styles.chipActive]}>
            <Text style={[styles.chipText, tone === item && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.label}>Recipient or context</Text>
      <TextInput value={recipient} onChangeText={setRecipient} placeholder="e.g. manager, customer, supplier" placeholderTextColor={colors.muted} style={styles.input} />

      <Text style={styles.label}>Subject</Text>
      <TextInput value={subject} onChangeText={setSubject} placeholder="What is the email about?" placeholderTextColor={colors.muted} style={styles.input} />

      <Text style={styles.label}>{mode === 'Reply' ? 'Paste the email and tell Tayar how to reply' : mode === 'Improve' ? 'Paste the email you want to improve' : 'What should the email say?'}</Text>
      <TextInput
        value={details}
        onChangeText={setDetails}
        multiline
        textAlignVertical="top"
        placeholder="Add the key points, request, context and anything that must be included..."
        placeholderTextColor={colors.muted}
        style={styles.textarea}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable disabled={!canRun} onPress={() => void generate()} style={({ pressed }) => [styles.generate, pressed && canRun && { opacity: 0.86 }, !canRun && styles.disabled]}>
        {busy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name="creation" size={20} color={colors.white} />}
        <Text style={styles.generateText}>{busy ? 'Writing…' : `${mode} with AI`}</Text>
      </Pressable>

      {result ? (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View>
              <Text style={styles.resultEyebrow}>READY TO SEND</Text>
              <Text style={styles.resultTitle}>Generated email</Text>
            </View>
            <Pressable onPress={() => void copyResult()} style={styles.copyButton}>
              <MaterialCommunityIcons name="content-copy" size={18} color={colors.text} />
              <Text style={styles.copyText}>Copy</Text>
            </Pressable>
          </View>
          <Text selectable style={styles.resultText}>{result}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingTop: 10 },
  hero: { flexDirection: 'row', gap: 13, alignItems: 'center', paddingVertical: 10, marginBottom: 16 },
  heroIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.violetSoft },
  title: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 12.5, marginTop: 4 },
  label: { color: colors.text, fontSize: 12.5, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, minHeight: 42, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.violetSoft, borderColor: colors.violet },
  segmentText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  segmentTextActive: { color: '#DDD6FE' },
  chips: { gap: 8, paddingRight: 18 },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  chipActive: { borderColor: colors.violet, backgroundColor: colors.violetSoft },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#DDD6FE' },
  input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, paddingHorizontal: 14, fontSize: 15 },
  textarea: { minHeight: 150, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, padding: 14, fontSize: 15, lineHeight: 21 },
  error: { color: colors.danger, fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  generate: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  disabled: { opacity: 0.45 },
  generateText: { color: colors.white, fontSize: 14.5, fontWeight: '900' },
  resultCard: { marginTop: 22, borderRadius: radius.lg, borderWidth: 1, borderColor: '#3C3158', backgroundColor: '#11101B', padding: 16 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 },
  resultEyebrow: { color: colors.emerald, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.4 },
  resultTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 3 },
  copyButton: { minHeight: 40, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: colors.panelSoft, borderWidth: 1, borderColor: colors.border },
  copyText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  resultText: { color: '#E7E5F2', fontSize: 14, lineHeight: 22 },
});
