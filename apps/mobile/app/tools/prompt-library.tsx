import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '@/lib/theme';
import { personalizePrompt, searchPrompts, type PromptTemplate } from '@/lib/prompt-library';

const categories = ['all', 'business', 'career', 'writing', 'social'] as const;

export default function PromptLibraryScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]>('all');
  const [selected, setSelected] = useState<PromptTemplate | null>(null);
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('');
  const [goal, setGoal] = useState('');
  const [copied, setCopied] = useState(false);

  const prompts = useMemo(() => searchPrompts(query, category), [query, category]);
  const personalized = selected ? personalizePrompt(selected, { topic, audience, goal }) : '';

  async function copyPrompt() {
    if (!personalized) return;
    await Clipboard.setStringAsync(personalized);
    setCopied(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 42 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <View style={styles.iconWrap}><MaterialCommunityIcons name="creation-outline" size={25} color={colors.violetBright} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Prompt Library</Text>
          <Text style={styles.subtitle}>Original Tayar prompts, stored in the app and usable without AI credits.</Text>
        </View>
      </View>

      <View style={styles.originalCard}>
        <MaterialCommunityIcons name="shield-check-outline" size={20} color="#86EFAC" />
        <View style={{ flex: 1 }}>
          <Text style={styles.originalTitle}>Original Tayar library</Text>
          <Text style={styles.originalText}>12 practical templates for business, career, writing and social workflows. Personalization happens locally.</Text>
        </View>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search prompts"
        placeholderTextColor={colors.muted}
        style={styles.search}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
        {categories.map((item) => (
          <Pressable key={item} onPress={() => setCategory(item)} style={[styles.category, category === item && styles.categoryActive]}>
            <Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item === 'all' ? 'All' : item[0].toUpperCase() + item.slice(1)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>{prompts.length} templates</Text>
      <View style={styles.promptList}>
        {prompts.map((prompt) => (
          <Pressable
            key={prompt.id}
            onPress={() => { setSelected(prompt); setCopied(false); void Haptics.selectionAsync(); }}
            style={[styles.promptCard, selected?.id === prompt.id && styles.promptCardActive]}
          >
            <View style={styles.promptHeader}>
              <Text style={styles.promptTitle}>{prompt.title}</Text>
              <Text style={styles.promptCategory}>{prompt.category.toUpperCase()}</Text>
            </View>
            <Text style={styles.promptDescription}>{prompt.description}</Text>
            <View style={styles.tags}>
              {prompt.tags.map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}
            </View>
          </Pressable>
        ))}
      </View>

      {selected ? (
        <View style={styles.editorCard}>
          <Text style={styles.editorEyebrow}>PERSONALIZE</Text>
          <Text style={styles.editorTitle}>{selected.title}</Text>
          <Text style={styles.editorHint}>Empty fields stay as placeholders, so you can also copy a reusable template.</Text>

          <Text style={styles.label}>Topic</Text>
          <TextInput value={topic} onChangeText={setTopic} multiline maxLength={500} placeholder="What is this about?" placeholderTextColor={colors.muted} style={styles.input} />
          <Text style={styles.label}>Audience</Text>
          <TextInput value={audience} onChangeText={setAudience} multiline maxLength={500} placeholder="Who is it for?" placeholderTextColor={colors.muted} style={styles.input} />
          <Text style={styles.label}>Goal</Text>
          <TextInput value={goal} onChangeText={setGoal} multiline maxLength={500} placeholder="What outcome do you want?" placeholderTextColor={colors.muted} style={styles.input} />

          <View style={styles.preview}>
            <Text selectable style={styles.previewText}>{personalized}</Text>
          </View>

          <Pressable onPress={() => void copyPrompt()} style={styles.copyButton}>
            <MaterialCommunityIcons name={copied ? 'check' : 'content-copy'} size={19} color={colors.white} />
            <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy Prompt'}</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingTop: 10 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 10, marginBottom: 12 },
  iconWrap: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.violetSoft },
  title: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  originalCard: { flexDirection: 'row', gap: 10, borderRadius: radius.md, borderWidth: 1, borderColor: '#22543D', backgroundColor: '#0C1D17', padding: 13 },
  originalTitle: { color: '#BBF7D0', fontSize: 12.5, fontWeight: '900' },
  originalText: { color: '#86CFA5', fontSize: 11, lineHeight: 16, marginTop: 2 },
  search: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, paddingHorizontal: 14, marginTop: 14, fontSize: 14.5 },
  categories: { gap: 8, paddingTop: 12, paddingRight: 18 },
  category: { minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  categoryActive: { borderColor: colors.violet, backgroundColor: colors.violetSoft },
  categoryText: { color: colors.muted, fontSize: 11.5, fontWeight: '800' },
  categoryTextActive: { color: '#DDD6FE' },
  sectionTitle: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 18, marginBottom: 9 },
  promptList: { gap: 9 },
  promptCard: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 14 },
  promptCardActive: { borderColor: colors.violet, backgroundColor: '#171126' },
  promptHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  promptTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '900' },
  promptCategory: { color: colors.violetBright, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.1 },
  promptDescription: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 5 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { color: '#A8A4B8', fontSize: 9.5, backgroundColor: colors.panelSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  editorCard: { marginTop: 20, borderRadius: radius.lg, borderWidth: 1, borderColor: '#3C3158', backgroundColor: '#11101B', padding: 16 },
  editorEyebrow: { color: colors.violetBright, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  editorTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 3 },
  editorHint: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 5, marginBottom: 4 },
  label: { color: colors.text, fontSize: 11.5, fontWeight: '800', marginTop: 12, marginBottom: 6 },
  input: { minHeight: 54, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, padding: 12, fontSize: 13.5, textAlignVertical: 'top' },
  preview: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#090911', padding: 13, marginTop: 14 },
  previewText: { color: '#E7E5F2', fontSize: 12.5, lineHeight: 19 },
  copyButton: { minHeight: 50, borderRadius: radius.md, backgroundColor: colors.violet, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  copyText: { color: colors.white, fontSize: 13.5, fontWeight: '900' },
});
