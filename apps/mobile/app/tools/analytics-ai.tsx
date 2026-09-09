import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { File } from 'expo-file-system';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { analyticsPromptPayload, parseDelimitedText, profileRows, type AnalyticsProfile } from '@/lib/analytics';
import { runTayarAI } from '@/lib/ai';
import { colors, radius } from '@/lib/theme';

export default function AnalyticsAIScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<AnalyticsProfile | null>(null);
  const [question, setQuestion] = useState('Give me the most important trends, data-quality issues, KPI ideas and practical next actions.');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canAnalyze = useMemo(() => Boolean(profile && !busy), [profile, busy]);

  async function pickFile() {
    setError('');
    setResult('');
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/tab-separated-values', 'text/plain', 'application/csv'], copyToCacheDirectory: true, multiple: false });
      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      if ((asset.size || 0) > 10 * 1024 * 1024) throw new Error('Choose a CSV/TSV file up to 10 MB.');
      const text = await new File(asset.uri).text();
      const rows = parseDelimitedText(text);
      if (rows.length < 2) throw new Error('The file needs a header row and at least one data row.');
      setProfile(profileRows(asset.name || 'dataset.csv', rows));
      void Haptics.selectionAsync();
    } catch (err) {
      setProfile(null);
      setError(err instanceof Error ? err.message : 'Could not read this file.');
    }
  }

  async function analyze() {
    if (!profile || busy) return;
    setBusy(true);
    setError('');
    try {
      const system = 'You are Tayar AI Data Analytics. Analyze only the evidence supplied in the compact dataset profile. Be precise, avoid inventing row-level facts, distinguish data-quality concerns from business insights, and return concise sections for Executive summary, Trends, Data quality, KPI ideas, and Recommended actions.';
      const user = `User question:\n${question.trim() || 'Analyze this dataset.'}\n\nLocal dataset profile:\n${analyticsPromptPayload(profile)}`;
      const response = await runTayarAI('analytics-ai', system, user, { temperature: 0.25, maxTokens: 3200 });
      setResult(response.content);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not analyze this dataset.');
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
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.privacyCard}>
        <MaterialCommunityIcons name="shield-lock-outline" size={21} color="#86EFAC" />
        <View style={{ flex: 1 }}>
          <Text style={styles.privacyTitle}>Privacy-first analytics</Text>
          <Text style={styles.privacyText}>Your CSV is parsed on the phone. Tayar AI receives only statistics and a distributed sample of up to 12 rows, not the full file.</Text>
        </View>
      </View>

      <Pressable onPress={() => void pickFile()} style={styles.picker}>
        <MaterialCommunityIcons name="file-delimited-outline" size={28} color="#C4B5FD" />
        <View style={{ flex: 1 }}>
          <Text style={styles.pickerTitle}>{profile ? profile.fileName : 'Choose CSV / TSV file'}</Text>
          <Text style={styles.pickerText}>{profile ? `${profile.rowCount.toLocaleString()} rows · ${profile.columnCount} columns` : 'Up to 10 MB · analyzed locally first'}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.muted} />
      </Pressable>

      {profile ? (
        <View style={styles.statsGrid}>
          <View style={styles.statCard}><Text style={styles.statValue}>{profile.rowCount.toLocaleString()}</Text><Text style={styles.statLabel}>Rows</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{profile.columnCount}</Text><Text style={styles.statLabel}>Columns</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{profile.columns.filter((column) => column.type === 'numeric').length}</Text><Text style={styles.statLabel}>Numeric</Text></View>
        </View>
      ) : null}

      {profile ? (
        <View style={styles.columnsCard}>
          <Text style={styles.sectionTitle}>Column snapshot</Text>
          {profile.columns.slice(0, 6).map((column) => (
            <View key={column.name} style={styles.columnRow}>
              <View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.columnName}>{column.name}</Text><Text style={styles.columnMeta}>{column.nonEmpty.toLocaleString()} filled · {column.missing.toLocaleString()} missing</Text></View>
              <View style={styles.typePill}><Text style={styles.typeText}>{column.type}</Text></View>
            </View>
          ))}
          {profile.columns.length > 6 ? <Text style={styles.moreText}>+ {profile.columns.length - 6} more columns included in the analysis profile</Text> : null}
        </View>
      ) : null}

      <Text style={styles.label}>What should Tayar analyze?</Text>
      <TextInput value={question} onChangeText={setQuestion} multiline textAlignVertical="top" placeholder="Ask about trends, anomalies, KPIs, quality or next actions..." placeholderTextColor={colors.muted} style={styles.textarea} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={!canAnalyze} onPress={() => void analyze()} style={({ pressed }) => [styles.analyzeButton, pressed && canAnalyze && { opacity: 0.86 }, !canAnalyze && styles.disabled]}>
        {busy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name="chart-box-outline" size={21} color={colors.white} />}
        <Text style={styles.analyzeText}>{busy ? 'Analyzing…' : 'Analyze with Tayar AI'}</Text>
      </Pressable>

      {result ? (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View style={{ flex: 1 }}><Text style={styles.resultEyebrow}>AI ANALYSIS</Text><Text style={styles.resultTitle}>{profile?.fileName || 'Dataset insights'}</Text></View>
            <Pressable onPress={() => void copyResult()} style={styles.copyButton}><MaterialCommunityIcons name="content-copy" size={18} color={colors.text} /><Text style={styles.copyText}>Copy</Text></Pressable>
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
  privacyCard: { flexDirection: 'row', gap: 11, borderWidth: 1, borderColor: '#22543D', backgroundColor: '#0C1D17', borderRadius: radius.md, padding: 14 },
  privacyTitle: { color: '#BBF7D0', fontSize: 13, fontWeight: '900' },
  privacyText: { color: '#86CFA5', fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  picker: { marginTop: 14, minHeight: 82, borderRadius: radius.lg, borderWidth: 1, borderColor: '#3C3158', backgroundColor: '#12101D', padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pickerTitle: { color: colors.text, fontSize: 14.5, fontWeight: '900' },
  pickerText: { color: colors.muted, fontSize: 11.5, marginTop: 4 },
  statsGrid: { flexDirection: 'row', gap: 9, marginTop: 12 },
  statCard: { flex: 1, borderRadius: radius.md, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, padding: 12 },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '900' },
  statLabel: { color: colors.muted, fontSize: 10.5, marginTop: 3 },
  columnsCard: { marginTop: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 14 },
  sectionTitle: { color: colors.text, fontWeight: '900', fontSize: 13.5, marginBottom: 6 },
  columnRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  columnName: { color: colors.text, fontSize: 12.5, fontWeight: '800' },
  columnMeta: { color: colors.muted, fontSize: 10.5, marginTop: 2 },
  typePill: { borderRadius: 99, backgroundColor: colors.violetSoft, paddingHorizontal: 9, paddingVertical: 5 },
  typeText: { color: '#DDD6FE', fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase' },
  moreText: { color: colors.muted, fontSize: 10.5, marginTop: 10 },
  label: { color: colors.text, fontSize: 12.5, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  textarea: { minHeight: 112, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, padding: 14, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  analyzeButton: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  analyzeText: { color: colors.white, fontSize: 14.5, fontWeight: '900' },
  disabled: { opacity: 0.42 },
  resultCard: { marginTop: 22, borderRadius: radius.lg, borderWidth: 1, borderColor: '#3C3158', backgroundColor: '#11101B', padding: 16 },
  resultHeader: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 14 },
  resultEyebrow: { color: '#C4B5FD', fontSize: 9.5, fontWeight: '900', letterSpacing: 1.3 },
  resultTitle: { color: colors.text, fontSize: 15.5, fontWeight: '900', marginTop: 3 },
  copyButton: { minHeight: 40, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: colors.panelSoft, borderWidth: 1, borderColor: colors.border },
  copyText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  resultText: { color: '#E7E5F2', fontSize: 13.5, lineHeight: 21 },
});
