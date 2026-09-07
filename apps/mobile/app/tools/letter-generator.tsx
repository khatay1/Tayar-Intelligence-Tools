import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generateLetter, LETTER_TONES, LETTER_TYPES, safeLetterFileName, type LetterTone, type LetterType } from '@/lib/letter-generator';
import { assertToolAccess, recordLocalToolUsage } from '@/lib/tool-access';
import { colors, radius } from '@/lib/theme';

function todayIso() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function LetterGeneratorScreen() {
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<LetterType>('recommendation');
  const [tone, setTone] = useState<LetterTone>('professional');
  const [senderName, setSenderName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [organization, setOrganization] = useState('');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [date, setDate] = useState(todayIso());
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const selected = useMemo(() => LETTER_TYPES.find((item) => item.value === type) || LETTER_TYPES[0], [type]);

  async function generate() {
    setError('');
    try {
      await assertToolAccess('letter-generator');
      const next = generateLetter({ type, tone, senderName, recipientName, organization, subject, details, date });
      if (!next.trim()) throw new Error('Could not generate this letter.');
      await recordLocalToolUsage('letter-generator', 'generate_letter');
      setResult(next);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate this letter.');
    }
  }

  async function copy() {
    if (!result) return;
    await Clipboard.setStringAsync(result);
    void Haptics.selectionAsync();
  }

  async function shareTxt() {
    if (!result) return;
    try {
      const output = new File(Paths.cache, safeLetterFileName(subject, type));
      output.create();
      output.write(new TextEncoder().encode(result));
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(output.uri, { mimeType: 'text/plain', dialogTitle: 'Save or share letter' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share this letter.');
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.localCard}><MaterialCommunityIcons name="cellphone-lock" size={21} color="#86EFAC" /><View style={{ flex: 1 }}><Text style={styles.localTitle}>No API</Text><Text style={styles.localText}>Letters are created locally from Tayar templates and remain fully editable before you copy or save them.</Text></View></View>
      <Text style={styles.label}>Letter type</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{LETTER_TYPES.map((item) => <Pressable key={item.value} onPress={() => setType(item.value)} style={[styles.chip, type === item.value && styles.chipActive]}><Text style={[styles.chipText, type === item.value && styles.chipTextActive]}>{item.label}</Text></Pressable>)}</ScrollView>
      <View style={styles.hint}><Text style={styles.hintText}>{selected.hint}</Text></View>
      <Text style={styles.label}>Tone</Text><View style={styles.toneRow}>{LETTER_TONES.map((item) => <Pressable key={item.value} onPress={() => setTone(item.value)} style={[styles.toneButton, tone === item.value && styles.chipActive]}><Text style={[styles.chipText, tone === item.value && styles.chipTextActive]}>{item.label}</Text></Pressable>)}</View>
      <Text style={styles.label}>Your name</Text><TextInput value={senderName} onChangeText={setSenderName} maxLength={120} placeholder="Sender name" placeholderTextColor={colors.muted} style={styles.input} />
      <Text style={styles.label}>Recipient</Text><TextInput value={recipientName} onChangeText={setRecipientName} maxLength={120} placeholder="Recipient name" placeholderTextColor={colors.muted} style={styles.input} />
      <Text style={styles.label}>Organization</Text><TextInput value={organization} onChangeText={setOrganization} maxLength={120} placeholder="Optional" placeholderTextColor={colors.muted} style={styles.input} />
      <Text style={styles.label}>Subject or purpose</Text><TextInput value={subject} onChangeText={setSubject} maxLength={120} placeholder="What is this letter about?" placeholderTextColor={colors.muted} style={styles.input} />
      <Text style={styles.label}>Important details</Text><TextInput value={details} onChangeText={setDetails} maxLength={2500} multiline textAlignVertical="top" placeholder="Facts, dates, context or the outcome you want..." placeholderTextColor={colors.muted} style={styles.textarea} />
      <Text style={styles.label}>Date</Text><TextInput value={date} onChangeText={setDate} maxLength={10} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} style={styles.input} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable onPress={() => void generate()} style={styles.action}><MaterialCommunityIcons name="file-document-edit-outline" size={20} color={colors.white} /><Text style={styles.actionText}>{result ? 'Regenerate Letter' : 'Generate Letter'}</Text></Pressable>
      {result ? <View style={styles.resultCard}><View style={styles.resultHeader}><Text style={styles.resultTitle}>Edit the result</Text><View style={styles.resultActions}><Pressable onPress={() => void copy()} style={styles.smallButton}><MaterialCommunityIcons name="content-copy" size={17} color={colors.text} /><Text style={styles.smallText}>Copy</Text></Pressable><Pressable onPress={() => void shareTxt()} style={styles.smallButton}><MaterialCommunityIcons name="share-variant-outline" size={17} color={colors.text} /><Text style={styles.smallText}>Share</Text></Pressable></View></View><TextInput value={result} onChangeText={setResult} multiline textAlignVertical="top" style={styles.resultInput} /></View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg }, content: { paddingHorizontal: 18, paddingTop: 10 }, localCard: { flexDirection: 'row', gap: 11, borderWidth: 1, borderColor: '#22543D', backgroundColor: '#0C1D17', borderRadius: radius.md, padding: 14 }, localTitle: { color: '#BBF7D0', fontSize: 13, fontWeight: '900' }, localText: { color: '#86CFA5', fontSize: 11.5, lineHeight: 17, marginTop: 3 }, label: { color: colors.text, fontSize: 12.5, fontWeight: '800', marginTop: 15, marginBottom: 8 }, chips: { gap: 8, paddingRight: 18 }, chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' }, chipActive: { borderColor: colors.violet, backgroundColor: colors.violetSoft }, chipText: { color: colors.muted, fontSize: 12, fontWeight: '800' }, chipTextActive: { color: '#DDD6FE' }, hint: { marginTop: 10, borderRadius: radius.md, backgroundColor: colors.panelSoft, borderWidth: 1, borderColor: colors.border, padding: 11 }, hintText: { color: colors.muted, fontSize: 11.5, lineHeight: 17 }, toneRow: { flexDirection: 'row', gap: 8 }, toneButton: { flex: 1, minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' }, input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, paddingHorizontal: 14, fontSize: 14.5 }, textarea: { minHeight: 125, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, padding: 14, fontSize: 14, lineHeight: 20 }, error: { color: colors.danger, fontSize: 12.5, lineHeight: 18, marginTop: 12 }, action: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, actionText: { color: colors.white, fontSize: 14.5, fontWeight: '900' }, resultCard: { marginTop: 20, borderRadius: radius.lg, borderWidth: 1, borderColor: '#3C3158', backgroundColor: '#11101B', padding: 14 }, resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }, resultTitle: { color: colors.text, fontSize: 14, fontWeight: '900' }, resultActions: { flexDirection: 'row', gap: 7 }, smallButton: { minHeight: 38, paddingHorizontal: 10, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelSoft, flexDirection: 'row', gap: 6, alignItems: 'center' }, smallText: { color: colors.text, fontSize: 11, fontWeight: '800' }, resultInput: { minHeight: 260, color: '#E7E5F2', fontSize: 13.5, lineHeight: 21, textAlignVertical: 'top' },
});
