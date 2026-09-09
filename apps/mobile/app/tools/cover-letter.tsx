import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { runTayarAI } from '@/lib/ai';
import { colors, radius } from '@/lib/theme';

const tones = ['Professional', 'Confident', 'Warm', 'Concise'] as const;
type Tone = typeof tones[number];

export default function CoverLetterScreen() {
  const insets = useSafeAreaInsets();
  const [tone, setTone] = useState<Tone>('Professional');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [highlights, setHighlights] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canRun = useMemo(() => role.trim().length >= 2 && highlights.trim().length >= 10 && !busy, [role, highlights, busy]);

  async function generate() {
    if (!canRun) return;
    setBusy(true);
    setError('');
    try {
      const system = `You are Tayar Cover Letter Writer. Write a persuasive, truthful and specific cover letter in a ${tone.toLowerCase()} tone. Do not invent qualifications. Avoid clichés and generic filler. Connect the candidate's supplied experience to the role. Return only the final cover letter ready to copy.`;
      const user = [
        `Target role: ${role.trim()}`,
        company.trim() ? `Company: ${company.trim()}` : '',
        `Candidate highlights:\n${highlights.trim()}`,
        jobDescription.trim() ? `Job description / requirements:\n${jobDescription.trim()}` : '',
      ].filter(Boolean).join('\n\n');
      const response = await runTayarAI('cover-letter', system, user, { temperature: 0.4, maxTokens: 2600 });
      setResult(response.content);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the cover letter.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!result) return;
    await Clipboard.setStringAsync(result);
    void Haptics.selectionAsync();
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <View style={styles.heroIcon}><MaterialCommunityIcons name="email-edit-outline" size={24} color={colors.violetBright} /></View>
        <View style={{ flex: 1 }}><Text style={styles.title}>Cover Letter</Text><Text style={styles.subtitle}>Turn your real experience into a tailored application letter.</Text></View>
      </View>

      <Text style={styles.label}>Tone</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {tones.map((item) => (
          <Pressable key={item} onPress={() => { setTone(item); void Haptics.selectionAsync(); }} style={[styles.chip, tone === item && styles.chipActive]}>
            <Text style={[styles.chipText, tone === item && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.label}>Role</Text>
      <TextInput value={role} onChangeText={setRole} placeholder="e.g. Production Technician" placeholderTextColor={colors.muted} style={styles.input} />
      <Text style={styles.label}>Company</Text>
      <TextInput value={company} onChangeText={setCompany} placeholder="Company name (optional)" placeholderTextColor={colors.muted} style={styles.input} />
      <Text style={styles.label}>Your strongest experience and achievements</Text>
      <TextInput value={highlights} onChangeText={setHighlights} multiline textAlignVertical="top" placeholder="Skills, years of experience, results, responsibilities, certifications..." placeholderTextColor={colors.muted} style={styles.textarea} />
      <Text style={styles.label}>Job description</Text>
      <TextInput value={jobDescription} onChangeText={setJobDescription} multiline textAlignVertical="top" placeholder="Paste the job ad or key requirements for better tailoring (optional)..." placeholderTextColor={colors.muted} style={styles.textareaSmall} />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={!canRun} onPress={() => void generate()} style={({ pressed }) => [styles.action, pressed && canRun && { opacity: 0.86 }, !canRun && styles.disabled]}>
        {busy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name="creation" size={20} color={colors.white} />}
        <Text style={styles.actionText}>{busy ? 'Writing…' : 'Create Cover Letter'}</Text>
      </Pressable>

      {result ? (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>READY TO APPLY</Text><Text style={styles.resultTitle}>{role.trim()}</Text></View><Pressable onPress={() => void copy()} style={styles.copyButton}><MaterialCommunityIcons name="content-copy" size={18} color={colors.text} /><Text style={styles.copyText}>Copy</Text></Pressable></View>
          <Text selectable style={styles.resultText}>{result}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingTop: 10 },
  hero: { flexDirection: 'row', gap: 13, alignItems: 'center', paddingVertical: 10, marginBottom: 14 },
  heroIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.violetSoft },
  title: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  label: { color: colors.text, fontSize: 12.5, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  chips: { gap: 8, paddingRight: 18 },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  chipActive: { borderColor: colors.violet, backgroundColor: colors.violetSoft },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  chipTextActive: { color: '#DDD6FE' },
  input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, paddingHorizontal: 14, fontSize: 14.5 },
  textarea: { minHeight: 130, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, padding: 14, fontSize: 14, lineHeight: 20 },
  textareaSmall: { minHeight: 105, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, padding: 14, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  action: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  disabled: { opacity: 0.44 },
  actionText: { color: colors.white, fontSize: 14.5, fontWeight: '900' },
  resultCard: { marginTop: 22, borderRadius: radius.lg, borderWidth: 1, borderColor: '#3C3158', backgroundColor: '#11101B', padding: 16 },
  resultHeader: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 14 },
  eyebrow: { color: colors.emerald, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.3 },
  resultTitle: { color: colors.text, fontSize: 15.5, fontWeight: '900', marginTop: 3 },
  copyButton: { minHeight: 40, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: colors.panelSoft, borderWidth: 1, borderColor: colors.border },
  copyText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  resultText: { color: '#E7E5F2', fontSize: 13.5, lineHeight: 21 },
});
