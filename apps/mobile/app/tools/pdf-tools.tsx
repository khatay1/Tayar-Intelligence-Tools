import { PDFDocument } from '@pdfme/pdf-lib';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '@/lib/theme';

type Mode = 'Merge' | 'Extract';
type PickedPdf = { uri: string; name: string; size?: number };

function safeName(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'tayar-pdf';
}

function parsePages(value: string, total: number): number[] {
  const result = new Set<number>();
  for (const part of value.split(',').map((item) => item.trim()).filter(Boolean)) {
    if (/^\d+$/.test(part)) {
      const page = Number(part);
      if (page < 1 || page > total) throw new Error(`Page ${page} is outside 1-${total}.`);
      result.add(page - 1);
      continue;
    }
    const match = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!match) throw new Error(`Invalid page selection: ${part}`);
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (start < 1 || end > total || start > end) throw new Error(`Invalid page range: ${part}`);
    for (let page = start; page <= end; page += 1) result.add(page - 1);
  }
  if (!result.size) throw new Error('Choose at least one page, for example 1-3,5.');
  return [...result].sort((a, b) => a - b);
}

async function loadPdf(file: PickedPdf) {
  const bytes = await new File(file.uri).bytes();
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const count = document.getPageCount();
  if (count < 1 || count > 150) throw new Error('PDFs must contain between 1 and 150 pages.');
  return document;
}

async function saveAndShare(bytes: Uint8Array, filename: string) {
  const output = new File(Paths.cache, `${Date.now()}-${safeName(filename)}`);
  output.create();
  output.write(bytes);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(output.uri, { mimeType: 'application/pdf', dialogTitle: 'Save or share PDF', UTI: 'com.adobe.pdf' });
}

export default function PdfToolsScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('Merge');
  const [files, setFiles] = useState<PickedPdf[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [pages, setPages] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canRun = useMemo(() => !busy && (mode === 'Merge' ? files.length >= 2 : files.length === 1 && pageCount > 0), [busy, files.length, mode, pageCount]);

  function switchMode(next: Mode) {
    setMode(next);
    setFiles([]);
    setPageCount(0);
    setPages('1');
    setError('');
    void Haptics.selectionAsync();
  }

  async function chooseFiles() {
    setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', multiple: mode === 'Merge', copyToCacheDirectory: true });
      if (result.canceled) return;
      const picked = result.assets.map((asset) => ({ uri: asset.uri, name: asset.name || 'document.pdf', size: asset.size }));
      const totalSize = picked.reduce((sum, item) => sum + (item.size || 0), 0);
      if (picked.some((item) => (item.size || 0) > 25 * 1024 * 1024) || totalSize > 50 * 1024 * 1024) throw new Error('Keep each PDF under 25 MB and the selection under 50 MB.');
      if (mode === 'Merge' && picked.length < 2) throw new Error('Choose at least two PDFs to merge.');
      setFiles(picked);
      if (mode === 'Extract' && picked[0]) {
        const document = await loadPdf(picked[0]);
        setPageCount(document.getPageCount());
        setPages(document.getPageCount() > 1 ? '1-2' : '1');
      }
      void Haptics.selectionAsync();
    } catch (err) {
      setFiles([]);
      setPageCount(0);
      setError(err instanceof Error ? err.message : 'Could not open these PDF files.');
    }
  }

  async function process() {
    if (!canRun) return;
    setBusy(true);
    setError('');
    try {
      if (mode === 'Merge') {
        const output = await PDFDocument.create();
        let totalPages = 0;
        for (const file of files) {
          const source = await loadPdf(file);
          totalPages += source.getPageCount();
          if (totalPages > 150) throw new Error('The merged PDF cannot exceed 150 pages.');
          const copied = await output.copyPages(source, source.getPageIndices());
          copied.forEach((page) => output.addPage(page));
        }
        output.setProducer('Tayar PDF Studio Mobile');
        await saveAndShare(await output.save({ useObjectStreams: true, addDefaultPage: false }), 'tayar-merged.pdf');
      } else {
        const source = await loadPdf(files[0]);
        const selected = parsePages(pages, source.getPageCount());
        const output = await PDFDocument.create();
        const copied = await output.copyPages(source, selected);
        copied.forEach((page) => output.addPage(page));
        output.setProducer('Tayar PDF Studio Mobile');
        await saveAndShare(await output.save({ useObjectStreams: true, addDefaultPage: false }), `${safeName(files[0].name.replace(/\.pdf$/i, ''))}-extract.pdf`);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF processing failed.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}>
      <View style={styles.localCard}>
        <MaterialCommunityIcons name="cellphone-lock" size={21} color="#86EFAC" />
        <View style={{ flex: 1 }}><Text style={styles.localTitle}>Processed on your phone</Text><Text style={styles.localText}>PDF bytes stay on-device. Tayar only opens the system Save/Share sheet for the result.</Text></View>
      </View>

      <View style={styles.segmentRow}>
        {(['Merge', 'Extract'] as const).map((item) => (
          <Pressable key={item} onPress={() => switchMode(item)} style={[styles.segment, mode === item && styles.segmentActive]}>
            <MaterialCommunityIcons name={item === 'Merge' ? 'file-link-outline' : 'file-export-outline'} size={19} color={mode === item ? '#DDD6FE' : colors.muted} />
            <Text style={[styles.segmentText, mode === item && styles.segmentTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={() => void chooseFiles()} style={styles.picker}>
        <MaterialCommunityIcons name="file-pdf-box" size={30} color="#C4B5FD" />
        <View style={{ flex: 1 }}>
          <Text style={styles.pickerTitle}>{files.length ? `${files.length} PDF${files.length === 1 ? '' : 's'} selected` : mode === 'Merge' ? 'Choose PDFs to merge' : 'Choose a PDF'}</Text>
          <Text style={styles.pickerText}>{files.length ? files.map((file) => file.name).slice(0, 2).join(' · ') : mode === 'Merge' ? 'Select 2 or more PDFs' : 'Then choose the pages to extract'}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.muted} />
      </Pressable>

      {mode === 'Extract' && pageCount > 0 ? (
        <View style={styles.pageCard}>
          <Text style={styles.label}>Pages to extract</Text>
          <Text style={styles.helper}>This PDF has {pageCount} page{pageCount === 1 ? '' : 's'}. Use ranges like 1-3,5.</Text>
          <TextInput value={pages} onChangeText={setPages} placeholder="1-3,5" placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="none" />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable disabled={!canRun} onPress={() => void process()} style={({ pressed }) => [styles.processButton, pressed && canRun && { opacity: 0.86 }, !canRun && styles.disabled]}>
        {busy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name={mode === 'Merge' ? 'file-link' : 'content-cut'} size={21} color={colors.white} />}
        <Text style={styles.processText}>{busy ? 'Processing…' : mode === 'Merge' ? 'Merge & Save' : 'Extract & Save'}</Text>
      </Pressable>

      <Text style={styles.footer}>Native PDF Studio · first mobile actions. More PDF operations will be added here without opening the website.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingTop: 10 },
  localCard: { flexDirection: 'row', gap: 11, borderWidth: 1, borderColor: '#22543D', backgroundColor: '#0C1D17', borderRadius: radius.md, padding: 14 },
  localTitle: { color: '#BBF7D0', fontSize: 13, fontWeight: '900' },
  localText: { color: '#86CFA5', fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  segmentRow: { flexDirection: 'row', gap: 9, marginTop: 14 },
  segment: { flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  segmentActive: { backgroundColor: colors.violetSoft, borderColor: colors.violet },
  segmentText: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  segmentTextActive: { color: '#DDD6FE' },
  picker: { marginTop: 14, minHeight: 86, borderRadius: radius.lg, borderWidth: 1, borderColor: '#3C3158', backgroundColor: '#12101D', padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pickerTitle: { color: colors.text, fontSize: 14.5, fontWeight: '900' },
  pickerText: { color: colors.muted, fontSize: 10.8, marginTop: 4 },
  pageCard: { marginTop: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 14 },
  label: { color: colors.text, fontSize: 12.5, fontWeight: '900' },
  helper: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 4, marginBottom: 10 },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelSoft, color: colors.text, paddingHorizontal: 13, fontSize: 14 },
  error: { color: colors.danger, fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  processButton: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, marginTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  processText: { color: colors.white, fontSize: 14.5, fontWeight: '900' },
  disabled: { opacity: 0.42 },
  footer: { color: colors.muted, fontSize: 10.5, lineHeight: 16, textAlign: 'center', marginTop: 14 },
});
