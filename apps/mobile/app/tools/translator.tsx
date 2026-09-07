import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { runTayarAI } from '@/lib/ai';
import { colors, radius } from '@/lib/theme';

const languages = ['Auto', 'English', 'Arabic', 'Swedish', 'German', 'French', 'Spanish'] as const;

export default function TranslatorScreen() {
  const insets = useSafeAreaInsets();
  const [source, setSource] = useState<(typeof languages)[number]>('Auto');
  const [target, setTarget] = useState<(typeof languages)[number]>('English');
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canTranslate = useMemo(() => text.trim().length > 0 && !busy && target !== 'Auto', [text, busy, target]);

  async function translate() {
    if (!canTranslate) return;
    setBusy(true);
    setError('');
    try {
      const system = `You are Tayar AI Translator. Translate naturally and faithfully from ${source === 'Auto' ? 'the detected source language' : source} to ${target}. Preserve meaning, tone, names, formatting, lists and numbers. Return only the translated text unless a tiny clarification is absolutely necessary.`;
      const response = await runTayarAI('translator', system, text.trim(), { temperature: 0.15, maxTokens: 3000 });
      setResult(response.content);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not translate this text.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  function swap() {
    if (source === 'Auto') {
      setSource(target);
      setTarget('English');
    } else {
      setSource(target);
      setTarget(source);
    }
    if (result) {
      setText(result);
      setResult('');
    }
    void Haptics.selectionAsync();
  }

  async function copyResult() {
    if (!result) return;
    await Clipboard.setStringAsync(result);
    void Haptics.selectionAsync();
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.languageBlock}>
        <Text style={styles.smallLabel}>FROM</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.languageRow}>
          {languages.map((item) => (
            <Pressable key={`from-${item}`} onPress={() => setSource(item)} style={[styles.languagePill, source === item && styles.languagePillActive]}>
              <Text style={[styles.languageText, source === item && styles.languageTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <Pressable onPress={swap} style={styles.swapButton}>
        <MaterialCommunityIcons name="swap-vertical" size={21} color="#DDD6FE" />
      </Pressable>

      <View style={styles.languageBlock}>
        <Text style={styles.smallLabel}>TO</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.languageRow}>
          {languages.filter((item) => item !== 'Auto').map((item) => (
            <Pressable key={`to-${item}`} onPress={() => setTarget(item)} style={[styles.languagePill, target === item && styles.languagePillActive]}>
              <Text style={[styles.languageText, target === item && styles.languageTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.editorCard}>
        <View style={styles.editorHeader}>
          <Text style={styles.editorTitle}>{source}</Text>
          <Text style={styles.counter}>{text.length.toLocaleString()} chars</Text>
        </View>
        <TextInput value={text} onChangeText={setText} multiline textAlignVertical="top" placeholder="Type or paste text to translate..." placeholderTextColor={colors.muted} style={styles.textarea} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable disabled={!canTranslate} onPress={() => void translate()} style={({ pressed }) => [styles.translateButton, pressed && canTranslate && { opacity: 0.86 }, !canTranslate && styles.disabled]}>
        {busy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name="translate" size={21} color={colors.white} />}
        <Text style={styles.translateText}>{busy ? 'Translating…' : `Translate to ${target}`}</Text>
      </Pressable>

      {result ? (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View style={{ flex: 1 }}><Text style={styles.resultEyebrow}>TRANSLATION</Text><Text style={styles.resultTitle}>{target}</Text></View>
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
  content: { paddingHorizontal: 18, paddingTop: 12 },
  languageBlock: { gap: 7 },
  smallLabel: { color: colors.muted, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.3 },
  languageRow: { gap: 8, paddingRight: 12 },
  languagePill: { minHeight: 38, paddingHorizontal: 13, borderRadius: 99, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, justifyContent: 'center' },
  languagePillActive: { backgroundColor: colors.violetSoft, borderColor: colors.violet },
  languageText: { color: colors.muted, fontSize: 11.5, fontWeight: '800' },
  languageTextActive: { color: '#DDD6FE' },
  swapButton: { alignSelf: 'center', width: 42, height: 42, borderRadius: 21, marginVertical: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#211A35', borderWidth: 1, borderColor: '#4C3B70' },
  editorCard: { marginTop: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, overflow: 'hidden' },
  editorHeader: { minHeight: 45, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  editorTitle: { color: colors.text, fontSize: 12.5, fontWeight: '900' },
  counter: { color: colors.muted, fontSize: 10.5 },
  textarea: { minHeight: 180, color: colors.text, padding: 14, fontSize: 15, lineHeight: 22 },
  error: { color: colors.danger, fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  translateButton: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  translateText: { color: colors.white, fontSize: 14.5, fontWeight: '900' },
  disabled: { opacity: 0.42 },
  resultCard: { marginTop: 20, borderRadius: radius.lg, borderWidth: 1, borderColor: '#3C3158', backgroundColor: '#11101B', padding: 16 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  resultEyebrow: { color: '#C4B5FD', fontSize: 9.5, fontWeight: '900', letterSpacing: 1.3 },
  resultTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 3 },
  copyButton: { minHeight: 40, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: colors.panelSoft, borderWidth: 1, borderColor: colors.border },
  copyText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  resultText: { color: '#E7E5F2', fontSize: 14, lineHeight: 22 },
});
