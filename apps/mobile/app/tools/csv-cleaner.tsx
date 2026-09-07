import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseDelimitedText } from '@/lib/analytics';
import { assertToolAccess, recordLocalToolUsage } from '@/lib/tool-access';
import { colors, radius } from '@/lib/theme';

type CleanStats = { originalRows: number; cleanedRows: number; removedEmpty: number; removedDuplicates: number; columns: number };

type PickedFile = { uri: string; name: string; size?: number };

function cleanHeader(value: string, index: number, seen: Map<string, number>) {
  const base = value.trim().replace(/\s+/g, ' ').slice(0, 120) || `Column ${index + 1}`;
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base} (${count + 1})`;
}

function csvCell(value: string) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function cleanRows(rows: string[][]) {
  if (!rows.length) throw new Error('No readable CSV rows found.');
  const seenHeaders = new Map<string, number>();
  const width = Math.max(rows[0]?.length || 0, ...rows.slice(1, 1000).map((row) => row.length), 1);
  const header = Array.from({ length: width }, (_, index) => cleanHeader(rows[0]?.[index] || '', index, seenHeaders));
  const data = rows.slice(1);
  const unique = new Set<string>();
  const cleaned: string[][] = [];
  let removedEmpty = 0;
  let removedDuplicates = 0;

  for (const source of data) {
    const row = Array.from({ length: width }, (_, index) => String(source[index] ?? '').trim().replace(/\s+/g, ' '));
    if (row.every((value) => !value)) {
      removedEmpty += 1;
      continue;
    }
    const key = JSON.stringify(row);
    if (unique.has(key)) {
      removedDuplicates += 1;
      continue;
    }
    unique.add(key);
    cleaned.push(row);
  }

  const csv = [header, ...cleaned].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  return {
    csv,
    stats: {
      originalRows: data.length,
      cleanedRows: cleaned.length,
      removedEmpty,
      removedDuplicates,
      columns: width,
    } satisfies CleanStats,
  };
}

export default function CsvCleanerScreen() {
  const insets = useSafeAreaInsets();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [previewStats, setPreviewStats] = useState<CleanStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canRun = useMemo(() => Boolean(file && !busy), [file, busy]);

  async function pickFile() {
    setError('');
    setPreviewStats(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/tab-separated-values', 'text/plain', 'application/csv'], copyToCacheDirectory: true, multiple: false });
      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      if ((asset.size || 0) > 10 * 1024 * 1024) throw new Error('Choose a CSV/TSV file up to 10 MB.');
      const text = await new File(asset.uri).text();
      const rows = parseDelimitedText(text);
      if (rows.length < 2) throw new Error('The file needs a header row and at least one data row.');
      const { stats } = cleanRows(rows);
      setFile({ uri: asset.uri, name: asset.name || 'data.csv', size: asset.size });
      setPreviewStats(stats);
      void Haptics.selectionAsync();
    } catch (err) {
      setFile(null);
      setError(err instanceof Error ? err.message : 'Could not open this CSV file.');
    }
  }

  async function cleanAndSave() {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      await assertToolAccess('csv-cleaner');
      const text = await new File(file.uri).text();
      const { csv, stats } = cleanRows(parseDelimitedText(text));
      const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9._-]+/gi, '-').slice(0, 60) || 'data';
      const output = new File(Paths.cache, `${Date.now()}-${safeBase}-cleaned.csv`);
      output.create();
      output.write(new TextEncoder().encode(csv));
      await recordLocalToolUsage('csv-cleaner', 'clean_csv');
      setPreviewStats(stats);
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(output.uri, { mimeType: 'text/csv', dialogTitle: 'Save or share cleaned CSV' });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV cleaning failed.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}>
      <View style={styles.localCard}><MaterialCommunityIcons name="cellphone-lock" size={21} color="#86EFAC" /><View style={{ flex: 1 }}><Text style={styles.localTitle}>Processed on your phone</Text><Text style={styles.localText}>The CSV contents stay on-device. Tayar only records the successful tool action for plan and usage limits.</Text></View></View>

      <Pressable onPress={() => void pickFile()} style={styles.picker}><MaterialCommunityIcons name="file-delimited-outline" size={30} color="#C4B5FD" /><View style={{ flex: 1 }}><Text style={styles.pickerTitle}>{file?.name || 'Choose CSV / TSV file'}</Text><Text style={styles.pickerText}>{file ? `${Math.max(1, Math.round((file.size || 0) / 1024)).toLocaleString()} KB` : 'Up to 10 MB'}</Text></View><MaterialCommunityIcons name="chevron-right" size={24} color={colors.muted} /></Pressable>

      {previewStats ? <View style={styles.statsGrid}>
        <View style={styles.stat}><Text style={styles.statValue}>{previewStats.cleanedRows.toLocaleString()}</Text><Text style={styles.statLabel}>Clean rows</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{previewStats.removedDuplicates.toLocaleString()}</Text><Text style={styles.statLabel}>Duplicates</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{previewStats.removedEmpty.toLocaleString()}</Text><Text style={styles.statLabel}>Empty rows</Text></View>
      </View> : null}

      <View style={styles.rulesCard}><Text style={styles.rulesTitle}>Cleaning rules</Text><Text style={styles.rule}>• Trim leading/trailing whitespace in every cell</Text><Text style={styles.rule}>• Collapse repeated whitespace inside values</Text><Text style={styles.rule}>• Normalize and de-duplicate column names</Text><Text style={styles.rule}>• Remove fully empty rows</Text><Text style={styles.rule}>• Remove exact duplicate rows</Text></View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={!canRun} onPress={() => void cleanAndSave()} style={({ pressed }) => [styles.action, pressed && canRun && { opacity: 0.86 }, !canRun && styles.disabled]}>{busy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name="broom" size={21} color={colors.white} />}<Text style={styles.actionText}>{busy ? 'Cleaning…' : 'Clean & Save CSV'}</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg }, content: { paddingHorizontal: 18, paddingTop: 10 },
  localCard: { flexDirection: 'row', gap: 11, borderWidth: 1, borderColor: '#22543D', backgroundColor: '#0C1D17', borderRadius: radius.md, padding: 14 }, localTitle: { color: '#BBF7D0', fontSize: 13, fontWeight: '900' }, localText: { color: '#86CFA5', fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  picker: { marginTop: 14, minHeight: 84, borderRadius: radius.lg, borderWidth: 1, borderColor: '#3C3158', backgroundColor: '#12101D', padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 }, pickerTitle: { color: colors.text, fontSize: 14.5, fontWeight: '900' }, pickerText: { color: colors.muted, fontSize: 11, marginTop: 4 },
  statsGrid: { flexDirection: 'row', gap: 9, marginTop: 13 }, stat: { flex: 1, borderRadius: radius.md, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, padding: 12 }, statValue: { color: colors.text, fontSize: 18, fontWeight: '900' }, statLabel: { color: colors.muted, fontSize: 10, marginTop: 3 },
  rulesCard: { marginTop: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 15 }, rulesTitle: { color: colors.text, fontSize: 13.5, fontWeight: '900', marginBottom: 7 }, rule: { color: '#C8C5D4', fontSize: 12, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 12.5, lineHeight: 18, marginTop: 12 }, action: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, marginTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, disabled: { opacity: 0.42 }, actionText: { color: colors.white, fontSize: 14.5, fontWeight: '900' },
});
