import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generateNames, type GeneratedName, type NameTone, type NameUseCase } from '@/lib/name-generator';
import { assertToolAccess, recordLocalToolUsage } from '@/lib/tool-access';
import { colors, radius } from '@/lib/theme';

const useCases: Array<{ value: NameUseCase; label: string }> = [
  { value: 'business', label: 'Business' }, { value: 'product', label: 'Product' }, { value: 'brand', label: 'Brand' }, { value: 'youtube', label: 'YouTube' }, { value: 'instagram', label: 'Instagram' },
];
const tones: Array<{ value: NameTone; label: string }> = [
  { value: 'modern', label: 'Modern' }, { value: 'professional', label: 'Professional' }, { value: 'friendly', label: 'Friendly' }, { value: 'bold', label: 'Bold' }, { value: 'minimal', label: 'Minimal' },
];

export default function NameGeneratorScreen() {
  const insets = useSafeAreaInsets();
  const [keyword, setKeyword] = useState('');
  const [useCase, setUseCase] = useState<NameUseCase>('business');
  const [tone, setTone] = useState<NameTone>('modern');
  const [count, setCount] = useState(18);
  const [nonce, setNonce] = useState(0);
  const [results, setResults] = useState<GeneratedName[]>([]);
  const [error, setError] = useState('');
  const canRun = useMemo(() => keyword.trim().length >= 2, [keyword]);

  async function generate() {
    if (!canRun) return;
    setError('');
    try {
      await assertToolAccess('name-generator');
      const nextNonce = nonce + 1;
      const next = generateNames({ keyword, useCase, tone, count, nonce: nextNonce });
      if (!next.length) throw new Error('Could not generate names.');
      await recordLocalToolUsage('name-generator', 'generate_names');
      setNonce(nextNonce);
      setResults(next);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate names.');
    }
  }

  async function copyName(name: string) {
    await Clipboard.setStringAsync(name);
    void Haptics.selectionAsync();
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.localCard}><MaterialCommunityIcons name="cellphone-lock" size={21} color="#86EFAC" /><View style={{ flex: 1 }}><Text style={styles.localTitle}>No AI credits</Text><Text style={styles.localText}>Names are generated locally from Tayar's original word banks. Availability is not checked.</Text></View></View>
      <Text style={styles.label}>Keyword or idea</Text><TextInput value={keyword} onChangeText={setKeyword} maxLength={40} placeholder="coffee, fitness, design..." placeholderTextColor={colors.muted} style={styles.input} />
      <Text style={styles.label}>Name type</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{useCases.map((item) => <Pressable key={item.value} onPress={() => setUseCase(item.value)} style={[styles.chip, useCase === item.value && styles.chipActive]}><Text style={[styles.chipText, useCase === item.value && styles.chipTextActive]}>{item.label}</Text></Pressable>)}</ScrollView>
      <Text style={styles.label}>Tone</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{tones.map((item) => <Pressable key={item.value} onPress={() => setTone(item.value)} style={[styles.chip, tone === item.value && styles.chipActive]}><Text style={[styles.chipText, tone === item.value && styles.chipTextActive]}>{item.label}</Text></Pressable>)}</ScrollView>
      <Text style={styles.label}>Ideas</Text><View style={styles.countRow}>{[12, 18, 24, 30].map((value) => <Pressable key={value} onPress={() => setCount(value)} style={[styles.countButton, count === value && styles.countActive]}><Text style={[styles.countText, count === value && styles.countTextActive]}>{value}</Text></Pressable>)}</View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={!canRun} onPress={() => void generate()} style={[styles.action, !canRun && styles.disabled]}><MaterialCommunityIcons name="creation" size={20} color={colors.white} /><Text style={styles.actionText}>{results.length ? 'Generate New Ideas' : 'Generate Names'}</Text></Pressable>
      {results.length ? <View style={styles.results}><Text style={styles.resultsTitle}>{results.length} original combinations</Text>{results.map((item) => <View key={item.name} style={styles.nameCard}><View style={{ flex: 1 }}><Text style={styles.name}>{item.name}</Text><Text style={styles.slug}>@{item.slug}</Text><Text style={styles.reason}>{item.reason}</Text></View><Pressable onPress={() => void copyName(item.name)} style={styles.copy}><MaterialCommunityIcons name="content-copy" size={18} color={colors.text} /></Pressable></View>)}</View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg }, content: { paddingHorizontal: 18, paddingTop: 10 }, localCard: { flexDirection: 'row', gap: 11, borderWidth: 1, borderColor: '#22543D', backgroundColor: '#0C1D17', borderRadius: radius.md, padding: 14 }, localTitle: { color: '#BBF7D0', fontSize: 13, fontWeight: '900' }, localText: { color: '#86CFA5', fontSize: 11.5, lineHeight: 17, marginTop: 3 }, label: { color: colors.text, fontSize: 12.5, fontWeight: '800', marginTop: 15, marginBottom: 8 }, input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, paddingHorizontal: 14, fontSize: 14.5 }, chips: { gap: 8, paddingRight: 18 }, chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' }, chipActive: { borderColor: colors.violet, backgroundColor: colors.violetSoft }, chipText: { color: colors.muted, fontSize: 12, fontWeight: '800' }, chipTextActive: { color: '#DDD6FE' }, countRow: { flexDirection: 'row', gap: 8 }, countButton: { flex: 1, minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' }, countActive: { borderColor: colors.violet, backgroundColor: colors.violetSoft }, countText: { color: colors.muted, fontWeight: '800' }, countTextActive: { color: '#DDD6FE' }, error: { color: colors.danger, fontSize: 12.5, lineHeight: 18, marginTop: 12 }, action: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, disabled: { opacity: 0.42 }, actionText: { color: colors.white, fontSize: 14.5, fontWeight: '900' }, results: { marginTop: 20, gap: 10 }, resultsTitle: { color: colors.muted, fontSize: 11.5, fontWeight: '800', marginBottom: 2 }, nameCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 14 }, name: { color: colors.text, fontSize: 16, fontWeight: '900' }, slug: { color: '#C4B5FD', fontSize: 11, marginTop: 3 }, reason: { color: colors.muted, fontSize: 10.5, marginTop: 5 }, copy: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panelSoft, borderWidth: 1, borderColor: colors.border },
});
