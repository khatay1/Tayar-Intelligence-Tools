import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ToolCard } from '@/components/ToolCard';
import { mobileTools } from '@/data/tools';
import { colors, radius } from '@/lib/theme';

export default function ToolsScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mobileTools;
    return mobileTools.filter(tool => `${tool.name} ${tool.description} ${tool.category}`.toLowerCase().includes(q));
  }, [query]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: 110 }]} keyboardShouldPersistTaps="handled">
      <Text style={styles.kicker}>TOOLS</Text>
      <Text style={styles.title}>Everything in one mobile workspace.</Text>
      <Text style={styles.subtitle}>Native tools open directly in the app. More tools are being converted from web workflows to mobile-first screens.</Text>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search tools" placeholderTextColor={colors.muted} style={styles.search} />
      <View style={styles.list}>
        {filtered.map(tool => <ToolCard key={tool.id} tool={tool} onPress={() => tool.route ? router.push(tool.route) : undefined} />)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18 },
  kicker: { color: colors.violetBright, fontSize: 11, fontWeight: '900', letterSpacing: 2.2 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.8, marginTop: 4, maxWidth: 340 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 10, maxWidth: 360 },
  search: { height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, paddingHorizontal: 15, marginTop: 20, marginBottom: 14, fontSize: 15 },
  list: { gap: 10 },
});
