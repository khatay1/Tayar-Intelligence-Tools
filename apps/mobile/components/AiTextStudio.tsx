import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { runTayarAI } from '@/lib/ai';
import { colors, radius } from '@/lib/theme';

type Props = {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  toolId: string;
  modes: readonly string[];
  defaultMode: string;
  inputLabel: (mode: string) => string;
  placeholder: (mode: string) => string;
  systemPrompt: (mode: string) => string;
  userPrompt: (mode: string, input: string) => string;
  actionLabel?: (mode: string) => string;
  resultLabel?: string;
  maxTokens?: number;
  temperature?: number;
};

export default function AiTextStudio({
  title,
  subtitle,
  icon,
  toolId,
  modes,
  defaultMode,
  inputLabel,
  placeholder,
  systemPrompt,
  userPrompt,
  actionLabel,
  resultLabel = 'AI RESULT',
  maxTokens = 3200,
  temperature = 0.45,
}: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState(defaultMode);
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canRun = useMemo(() => input.trim().length >= 5 && !busy, [input, busy]);

  async function run() {
    if (!canRun) return;
    setBusy(true);
    setError('');
    try {
      const response = await runTayarAI(toolId, systemPrompt(mode), userPrompt(mode, input.trim()), {
        temperature,
        maxTokens,
      });
      setResult(response.content);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI request failed.');
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
        <View style={styles.heroIcon}><MaterialCommunityIcons name={icon} size={24} color={colors.violetBright} /></View>
        <View style={{ flex: 1 }}><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View>
      </View>

      <Text style={styles.label}>Mode</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {modes.map((item) => (
          <Pressable key={item} onPress={() => { setMode(item); setError(''); void Haptics.selectionAsync(); }} style={[styles.chip, mode === item && styles.chipActive]}>
            <Text style={[styles.chipText, mode === item && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.label}>{inputLabel(mode)}</Text>
      <TextInput
        value={input}
        onChangeText={setInput}
        multiline
        textAlignVertical="top"
        placeholder={placeholder(mode)}
        placeholderTextColor={colors.muted}
        style={styles.textarea}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={!canRun} onPress={() => void run()} style={({ pressed }) => [styles.action, pressed && canRun && { opacity: 0.86 }, !canRun && styles.disabled]}>
        {busy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name="creation" size={20} color={colors.white} />}
        <Text style={styles.actionText}>{busy ? 'Working…' : actionLabel?.(mode) || `${mode} with AI`}</Text>
      </Pressable>

      {result ? (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View style={{ flex: 1 }}><Text style={styles.eyebrow}>{resultLabel}</Text><Text style={styles.resultTitle}>{title}</Text></View>
            <Pressable onPress={() => void copy()} style={styles.copyButton}><MaterialCommunityIcons name="content-copy" size={18} color={colors.text} /><Text style={styles.copyText}>Copy</Text></Pressable>
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
  hero: { flexDirection: 'row', gap: 13, alignItems: 'center', paddingVertical: 10, marginBottom: 14 },
  heroIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.violetSoft },
  title: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  label: { color: colors.text, fontSize: 12.5, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  chips: { gap: 8, paddingRight: 18 },
  chip: { minHeight: 39, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  chipActive: { borderColor: colors.violet, backgroundColor: colors.violetSoft },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  chipTextActive: { color: '#DDD6FE' },
  textarea: { minHeight: 190, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, padding: 14, fontSize: 14.5, lineHeight: 21 },
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
