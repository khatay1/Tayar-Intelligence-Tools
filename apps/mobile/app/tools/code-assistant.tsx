import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { runTayarAI } from '@/lib/ai';
import { colors, radius } from '@/lib/theme';

type Mode = 'Build' | 'Fix' | 'Explain' | 'Review';
type Language = 'Auto' | 'TypeScript' | 'React' | 'Python' | 'CSS' | 'SQL';
const modes: Mode[] = ['Build', 'Fix', 'Explain', 'Review'];
const languages: Language[] = ['Auto', 'TypeScript', 'React', 'Python', 'CSS', 'SQL'];

export default function CodeAssistantScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('Build');
  const [language, setLanguage] = useState<Language>('Auto');
  const [request, setRequest] = useState('');
  const [source, setSource] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canRun = useMemo(() => request.trim().length >= 5 && !busy, [request, busy]);

  async function run() {
    if (!canRun) return;
    setBusy(true);
    setError('');
    try {
      const system = `You are Tayar Coding Assistance in a mobile coding workspace. Mode: ${mode}. Preferred language/framework: ${language}. Be precise and production-minded. When code is requested, return the complete useful code first, then only brief implementation notes. Never pretend code was executed. When reviewing or fixing, preserve working behavior unless the user asks otherwise.`;
      const user = [
        `Task:\n${request.trim()}`,
        source.trim() ? `Existing code/context:\n${source.trim()}` : '',
      ].filter(Boolean).join('\n\n');
      const response = await runTayarAI('code-assistant', system, user, { temperature: mode === 'Build' ? 0.35 : 0.2, maxTokens: 5200 });
      setResult(response.content);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete the coding request.');
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
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <View style={styles.iconWrap}><MaterialCommunityIcons name="code-braces" size={25} color={colors.violetBright} /></View>
        <View style={{ flex: 1 }}><Text style={styles.title}>Coding Assistance</Text><Text style={styles.subtitle}>Build, inspect and fix code in a mobile-first AI workspace.</Text></View>
      </View>

      <Text style={styles.label}>Mode</Text>
      <View style={styles.modeRow}>{modes.map((item) => <Pressable key={item} onPress={() => setMode(item)} style={[styles.mode, mode === item && styles.active]}><Text style={[styles.modeText, mode === item && styles.activeText]}>{item}</Text></Pressable>)}</View>

      <Text style={styles.label}>Language / framework</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{languages.map((item) => <Pressable key={item} onPress={() => setLanguage(item)} style={[styles.chip, language === item && styles.active]}><Text style={[styles.modeText, language === item && styles.activeText]}>{item}</Text></Pressable>)}</ScrollView>

      <Text style={styles.label}>What should Tayar do?</Text>
      <TextInput value={request} onChangeText={setRequest} multiline textAlignVertical="top" placeholder="Example: Build a reusable React Native pricing card with monthly/yearly toggle..." placeholderTextColor={colors.muted} style={styles.requestInput} />

      <Text style={styles.label}>Existing code or context <Text style={styles.optional}>optional</Text></Text>
      <TextInput value={source} onChangeText={setSource} multiline textAlignVertical="top" autoCapitalize="none" autoCorrect={false} placeholder="Paste code, error output or constraints here..." placeholderTextColor={colors.muted} style={styles.codeInput} />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={!canRun} onPress={() => void run()} style={({ pressed }) => [styles.action, pressed && canRun && { opacity: 0.86 }, !canRun && styles.disabled]}>
        {busy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name="creation" size={21} color={colors.white} />}
        <Text style={styles.actionText}>{busy ? 'Working…' : `${mode} with Tayar AI`}</Text>
      </Pressable>

      {result ? <View style={styles.resultCard}>
        <View style={styles.resultHeader}><View style={{ flex: 1 }}><Text style={styles.resultEyebrow}>CODE ASSISTANT</Text><Text style={styles.resultTitle}>{mode} result</Text></View><Pressable onPress={() => void copyResult()} style={styles.copy}><MaterialCommunityIcons name="content-copy" size={18} color={colors.text} /><Text style={styles.copyText}>Copy</Text></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}><Text selectable style={styles.resultText}>{result}</Text></ScrollView>
      </View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg }, content: { paddingHorizontal: 18, paddingTop: 10 },
  hero: { flexDirection: 'row', gap: 13, alignItems: 'center', paddingVertical: 10, marginBottom: 8 }, iconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center' }, title: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }, subtitle: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  label: { color: colors.text, fontSize: 12.5, fontWeight: '800', marginTop: 14, marginBottom: 8 }, optional: { color: colors.muted, fontWeight: '600' }, modeRow: { flexDirection: 'row', gap: 7 }, mode: { flex: 1, minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' }, chips: { gap: 8, paddingRight: 18 }, chip: { minHeight: 38, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' }, active: { borderColor: colors.violet, backgroundColor: colors.violetSoft }, modeText: { color: colors.muted, fontSize: 11.5, fontWeight: '800' }, activeText: { color: '#DDD6FE' },
  requestInput: { minHeight: 112, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, padding: 14, fontSize: 14, lineHeight: 20 }, codeInput: { minHeight: 170, borderRadius: radius.md, borderWidth: 1, borderColor: '#302B3B', backgroundColor: '#09090F', color: '#E7E5F2', padding: 14, fontSize: 12.5, lineHeight: 19, fontFamily: 'monospace' }, error: { color: colors.danger, fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  action: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, marginTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, disabled: { opacity: 0.42 }, actionText: { color: colors.white, fontSize: 14.5, fontWeight: '900' },
  resultCard: { marginTop: 20, borderRadius: radius.lg, borderWidth: 1, borderColor: '#3C3158', backgroundColor: '#0B0A11', padding: 15 }, resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 13 }, resultEyebrow: { color: colors.violetBright, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 }, resultTitle: { color: colors.text, fontSize: 15.5, fontWeight: '900', marginTop: 3 }, copy: { minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelSoft, paddingHorizontal: 11, flexDirection: 'row', gap: 6, alignItems: 'center' }, copyText: { color: colors.text, fontSize: 11.5, fontWeight: '800' }, resultText: { color: '#E7E5F2', fontSize: 12.5, lineHeight: 19, fontFamily: 'monospace', minWidth: 330, maxWidth: 900 },
});
