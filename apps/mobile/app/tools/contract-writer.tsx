import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { runTayarAI } from '@/lib/ai';
import { colors, radius } from '@/lib/theme';

const modes = ['Generate', 'Review', 'Clause'] as const;
const riskLevels = ['Balanced', 'Protective', 'Simple'] as const;
type Mode = typeof modes[number];
type Risk = typeof riskLevels[number];

export default function ContractWriterScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('Generate');
  const [risk, setRisk] = useState<Risk>('Balanced');
  const [jurisdiction, setJurisdiction] = useState('Sweden');
  const [contractType, setContractType] = useState('Service agreement');
  const [details, setDetails] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canRun = useMemo(() => details.trim().length >= 10 && !busy, [details, busy]);

  async function generate() {
    if (!canRun) return;
    setBusy(true);
    setError('');
    try {
      const system = `You are Tayar AI Contract, a careful contract drafting assistant. Task mode: ${mode}. Jurisdiction/context: ${jurisdiction}. Risk style: ${risk}. Produce practical, clearly structured contract language. Do not claim to replace a licensed lawyer. If facts are missing, use neutral placeholders rather than inventing them.`;
      const user = [
        `Contract type: ${contractType}`,
        `Mode: ${mode}`,
        `Jurisdiction/context: ${jurisdiction}`,
        `Risk style: ${risk}`,
        `User material:\n${details.trim()}`,
      ].join('\n\n');
      const response = await runTayarAI('contract-writer', system, user, { temperature: 0.3, maxTokens: 3800 });
      setResult(response.content);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate contract content.');
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
      <View style={styles.notice}>
        <MaterialCommunityIcons name="shield-alert-outline" size={20} color={colors.amber} />
        <Text style={styles.noticeText}>AI drafting assistant only. Important contracts should be reviewed by a qualified professional.</Text>
      </View>

      <Text style={styles.label}>Mode</Text>
      <View style={styles.segmentRow}>
        {modes.map(item => (
          <Pressable key={item} onPress={() => setMode(item)} style={[styles.segment, mode === item && styles.segmentActive]}>
            <Text style={[styles.segmentText, mode === item && styles.segmentTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Contract type</Text>
      <TextInput value={contractType} onChangeText={setContractType} placeholder="e.g. Service agreement" placeholderTextColor={colors.muted} style={styles.input} />

      <Text style={styles.label}>Jurisdiction / country</Text>
      <TextInput value={jurisdiction} onChangeText={setJurisdiction} placeholder="e.g. Sweden" placeholderTextColor={colors.muted} style={styles.input} />

      <Text style={styles.label}>Risk style</Text>
      <View style={styles.segmentRow}>
        {riskLevels.map(item => (
          <Pressable key={item} onPress={() => setRisk(item)} style={[styles.segment, risk === item && styles.segmentActive]}>
            <Text style={[styles.segmentText, risk === item && styles.segmentTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>{mode === 'Review' ? 'Paste the contract to review' : mode === 'Clause' ? 'Describe or paste the clause' : 'Agreement details'}</Text>
      <TextInput
        value={details}
        onChangeText={setDetails}
        multiline
        textAlignVertical="top"
        placeholder="Parties, scope, payment, dates, responsibilities, termination, confidentiality and any special terms..."
        placeholderTextColor={colors.muted}
        style={styles.textarea}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable disabled={!canRun} onPress={() => void generate()} style={({ pressed }) => [styles.generate, pressed && canRun && { opacity: 0.86 }, !canRun && styles.disabled]}>
        {busy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name="file-sign" size={20} color={colors.white} />}
        <Text style={styles.generateText}>{busy ? 'Working…' : `${mode} with AI`}</Text>
      </Pressable>

      {result ? (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultEyebrow}>AI DRAFT</Text>
              <Text style={styles.resultTitle}>{contractType || 'Contract result'}</Text>
            </View>
            <Pressable onPress={() => void copy()} style={styles.copyButton}>
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
  notice: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderColor: '#5A4420', backgroundColor: '#211A0D', borderRadius: radius.md, padding: 13, marginBottom: 8 },
  noticeText: { flex: 1, color: '#F5D58C', fontSize: 11.5, lineHeight: 17 },
  label: { color: colors.text, fontSize: 12.5, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, minHeight: 42, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.violetSoft, borderColor: colors.violet },
  segmentText: { color: colors.muted, fontSize: 11.5, fontWeight: '800' },
  segmentTextActive: { color: '#DDD6FE' },
  input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, paddingHorizontal: 14, fontSize: 15 },
  textarea: { minHeight: 190, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, padding: 14, fontSize: 14, lineHeight: 21 },
  error: { color: colors.danger, fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  generate: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  disabled: { opacity: 0.45 },
  generateText: { color: colors.white, fontSize: 14.5, fontWeight: '900' },
  resultCard: { marginTop: 22, borderRadius: radius.lg, borderWidth: 1, borderColor: '#3C3158', backgroundColor: '#11101B', padding: 16 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 },
  resultEyebrow: { color: '#C4B5FD', fontSize: 9.5, fontWeight: '900', letterSpacing: 1.4 },
  resultTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 3 },
  copyButton: { minHeight: 40, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: colors.panelSoft, borderWidth: 1, borderColor: colors.border },
  copyText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  resultText: { color: '#E7E5F2', fontSize: 13.5, lineHeight: 21 },
});
