import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { File } from 'expo-file-system';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { runTayarAI } from '@/lib/ai';
import { colors, radius } from '@/lib/theme';

const modes = ['Summarize', 'Extract', 'Ask', 'Rewrite'] as const;
type Mode = typeof modes[number];
const MAX_TEXT = 45_000;

export default function DocumentAIScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('Summarize');
  const [fileName, setFileName] = useState('');
  const [documentText, setDocumentText] = useState('');
  const [instruction, setInstruction] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const needsInstruction = mode === 'Ask' || mode === 'Rewrite';
  const canRun = useMemo(() => documentText.trim().length >= 20 && (!needsInstruction || instruction.trim().length >= 3) && !busy, [documentText, instruction, needsInstruction, busy]);

  async function pickTextFile() {
    setError('');
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/markdown', 'text/csv', 'text/tab-separated-values', 'application/json', 'application/csv'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      if ((asset.size || 0) > 750 * 1024) throw new Error('Choose a text-based document up to 750 KB.');
      const text = await new File(asset.uri).text();
      if (text.length > MAX_TEXT) throw new Error('This document is too long for the mobile AI workspace. Keep it under 45,000 characters.');
      setFileName(asset.name || 'document');
      setDocumentText(text);
      setResult('');
      void Haptics.selectionAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read this document.');
    }
  }

  async function analyze() {
    if (!canRun) return;
    setBusy(true);
    setError('');
    try {
      const systemByMode: Record<Mode, string> = {
        Summarize: 'You are Tayar Document AI. Summarize the supplied document accurately. Preserve important names, dates, amounts, decisions, obligations and open questions. Use concise headings and bullets. Do not invent facts.',
        Extract: 'You are Tayar Document AI. Extract the most useful structured facts from the supplied document: people/organizations, dates, amounts, obligations, deadlines, risks, decisions, action items and unusual clauses when present. If a category is absent, omit it. Do not invent facts.',
        Ask: 'You are Tayar Document AI. Answer the user question using only the supplied document. If the document does not contain enough evidence, say so clearly. Quote minimally and prefer concise evidence-based explanation.',
        Rewrite: 'You are Tayar Document AI. Rewrite the supplied document according to the user instruction while preserving its factual meaning unless the user explicitly asks for a substantive change. Return only the rewritten document.',
      };
      const prompt = [
        fileName ? `Document: ${fileName}` : '',
        needsInstruction ? `User instruction/question: ${instruction.trim()}` : '',
        `Document text:\n${documentText.trim()}`,
      ].filter(Boolean).join('\n\n');
      const response = await runTayarAI('document-ai', systemByMode[mode], prompt, { temperature: mode === 'Rewrite' ? 0.45 : 0.2, maxTokens: 3600 });
      setResult(response.content);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Document AI failed.');
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
      <View style={styles.privacyCard}><MaterialCommunityIcons name="file-lock-outline" size={22} color="#86EFAC" /><View style={{ flex: 1 }}><Text style={styles.privacyTitle}>Native document workspace</Text><Text style={styles.privacyText}>Text files are read on your phone. Only the text you place in this workspace is sent to Tayar AI for the requested analysis.</Text></View></View>

      <Text style={styles.label}>Mode</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {modes.map((item) => <Pressable key={item} onPress={() => { setMode(item); setError(''); void Haptics.selectionAsync(); }} style={[styles.chip, mode === item && styles.chipActive]}><Text style={[styles.chipText, mode === item && styles.chipTextActive]}>{item}</Text></Pressable>)}
      </ScrollView>

      <Pressable onPress={() => void pickTextFile()} style={styles.picker}><MaterialCommunityIcons name="file-document-outline" size={27} color="#C4B5FD" /><View style={{ flex: 1 }}><Text style={styles.pickerTitle}>{fileName || 'Import text document'}</Text><Text style={styles.pickerText}>TXT · Markdown · CSV/TSV · JSON, or paste below</Text></View><MaterialCommunityIcons name="chevron-right" size={24} color={colors.muted} /></Pressable>

      <Text style={styles.label}>Document text</Text>
      <TextInput value={documentText} onChangeText={(value) => { if (value.length <= MAX_TEXT) setDocumentText(value); }} multiline textAlignVertical="top" placeholder="Paste document text here..." placeholderTextColor={colors.muted} style={styles.documentInput} />
      <Text style={styles.counter}>{documentText.length.toLocaleString()} / {MAX_TEXT.toLocaleString()} characters</Text>

      {needsInstruction ? <><Text style={styles.label}>{mode === 'Ask' ? 'Question' : 'Rewrite instruction'}</Text><TextInput value={instruction} onChangeText={setInstruction} multiline textAlignVertical="top" placeholder={mode === 'Ask' ? 'What do you want to know from this document?' : 'e.g. Make this clearer and more professional without changing the meaning...'} placeholderTextColor={colors.muted} style={styles.instructionInput} /></> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={!canRun} onPress={() => void analyze()} style={({ pressed }) => [styles.action, pressed && canRun && { opacity: 0.86 }, !canRun && styles.disabled]}>{busy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name="creation" size={20} color={colors.white} />}<Text style={styles.actionText}>{busy ? 'Working…' : `${mode} with AI`}</Text></Pressable>

      {result ? <View style={styles.resultCard}><View style={styles.resultHeader}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>DOCUMENT RESULT</Text><Text style={styles.resultTitle}>{fileName || 'Pasted document'}</Text></View><Pressable onPress={() => void copy()} style={styles.copyButton}><MaterialCommunityIcons name="content-copy" size={18} color={colors.text} /><Text style={styles.copyText}>Copy</Text></Pressable></View><Text selectable style={styles.resultText}>{result}</Text></View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg }, content: { paddingHorizontal: 18, paddingTop: 10 },
  privacyCard: { flexDirection: 'row', gap: 11, borderWidth: 1, borderColor: '#22543D', backgroundColor: '#0C1D17', borderRadius: radius.md, padding: 14 },
  privacyTitle: { color: '#BBF7D0', fontSize: 13, fontWeight: '900' }, privacyText: { color: '#86CFA5', fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  label: { color: colors.text, fontSize: 12.5, fontWeight: '800', marginTop: 15, marginBottom: 8 }, chips: { gap: 8, paddingRight: 18 },
  chip: { minHeight: 39, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' }, chipActive: { borderColor: colors.violet, backgroundColor: colors.violetSoft }, chipText: { color: colors.muted, fontSize: 12, fontWeight: '800' }, chipTextActive: { color: '#DDD6FE' },
  picker: { marginTop: 15, minHeight: 78, borderRadius: radius.lg, borderWidth: 1, borderColor: '#3C3158', backgroundColor: '#12101D', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, pickerTitle: { color: colors.text, fontSize: 14, fontWeight: '900' }, pickerText: { color: colors.muted, fontSize: 10.5, marginTop: 4 },
  documentInput: { minHeight: 220, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, padding: 14, fontSize: 13.5, lineHeight: 20 }, counter: { color: colors.muted, fontSize: 10.5, textAlign: 'right', marginTop: 6 },
  instructionInput: { minHeight: 100, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, padding: 14, fontSize: 14, lineHeight: 20 }, error: { color: colors.danger, fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  action: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, disabled: { opacity: 0.44 }, actionText: { color: colors.white, fontSize: 14.5, fontWeight: '900' },
  resultCard: { marginTop: 22, borderRadius: radius.lg, borderWidth: 1, borderColor: '#3C3158', backgroundColor: '#11101B', padding: 16 }, resultHeader: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 14 }, eyebrow: { color: '#C4B5FD', fontSize: 9.5, fontWeight: '900', letterSpacing: 1.3 }, resultTitle: { color: colors.text, fontSize: 15.5, fontWeight: '900', marginTop: 3 }, copyButton: { minHeight: 40, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: colors.panelSoft, borderWidth: 1, borderColor: colors.border }, copyText: { color: colors.text, fontSize: 12, fontWeight: '800' }, resultText: { color: '#E7E5F2', fontSize: 13.5, lineHeight: 21 },
});
