import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '@/lib/theme';

type PickedFile = { name: string; size?: number | null; mimeType?: string | null; uri: string };

function formatBytes(value?: number | null) {
  if (!value || value <= 0) return 'Unknown size';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export default function FilesScreen() {
  const insets = useSafeAreaInsets();
  const [recent, setRecent] = useState<PickedFile[]>([]);

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    setRecent(previous => [
      ...result.assets.map(asset => ({ name: asset.name, size: asset.size, mimeType: asset.mimeType, uri: asset.uri })),
      ...previous,
    ].slice(0, 20));
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: 110 }]}>
      <Text style={styles.kicker}>FILES</Text>
      <Text style={styles.title}>Work with files from your phone.</Text>
      <Text style={styles.subtitle}>Choose files directly from iCloud Drive, Files, Downloads or your Android storage and send them into Tayar tools.</Text>

      <Pressable onPress={() => void pickFile()} style={({ pressed }) => [styles.pickButton, pressed && { opacity: 0.85 }]}>
        <MaterialCommunityIcons name="file-plus-outline" size={22} color={colors.white} />
        <Text style={styles.pickText}>Choose files</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Recent in app</Text>
      {recent.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="folder-open-outline" size={34} color={colors.muted} />
          <Text style={styles.emptyTitle}>No files selected yet</Text>
          <Text style={styles.emptyText}>Your Tayar mobile file history will appear here as native tools are connected.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {recent.map((file, index) => (
            <View key={`${file.uri}-${index}`} style={styles.fileRow}>
              <View style={styles.fileIcon}><MaterialCommunityIcons name="file-outline" size={22} color={colors.violetBright} /></View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.fileName}>{file.name}</Text>
                <Text style={styles.fileMeta}>{formatBytes(file.size)}{file.mimeType ? ` · ${file.mimeType}` : ''}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18 },
  kicker: { color: colors.violetBright, fontSize: 11, fontWeight: '900', letterSpacing: 2.2 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.8, marginTop: 4 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 10 },
  pickButton: { marginTop: 22, minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  pickText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 28, marginBottom: 12 },
  empty: { alignItems: 'center', padding: 28, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 10 },
  emptyText: { color: colors.muted, fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  list: { gap: 10 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  fileIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center' },
  fileName: { color: colors.text, fontSize: 14, fontWeight: '800' },
  fileMeta: { color: colors.muted, fontSize: 10.5, marginTop: 4 },
});
