import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '@/lib/theme';

type WorkspaceFile = { name: string; storageName: string; size: number; mimeType: string; uri: string; modified: number };

function formatBytes(value?: number | null) {
  if (!value || value <= 0) return 'Unknown size';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function safeName(value: string) {
  const cleaned = value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 100);
  return cleaned || 'file';
}

function displayName(storageName: string) {
  return storageName.replace(/^\d+-\d+-/, '') || storageName;
}

function workspaceDirectory() {
  const directory = new Directory(Paths.document, 'tayar-files');
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function listWorkspaceFiles(): WorkspaceFile[] {
  const directory = workspaceDirectory();
  return directory.list()
    .filter((entry): entry is File => entry instanceof File)
    .map((file) => ({
      name: displayName(file.name),
      storageName: file.name,
      size: file.size || 0,
      mimeType: file.type || '',
      uri: file.uri,
      modified: file.modificationTime || file.creationTime || 0,
    }))
    .sort((a, b) => b.modified - a.modified)
    .slice(0, 100);
}

function fileIcon(file: WorkspaceFile) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'file-pdf-box';
  if (/\.(png|jpg|jpeg|webp|heic)$/.test(name)) return 'file-image-outline';
  if (/\.(csv|tsv|xlsx|xls)$/.test(name)) return 'file-table-outline';
  if (/\.(doc|docx|txt|md|rtf)$/.test(name)) return 'file-document-outline';
  if (name.endsWith('.zip')) return 'folder-zip-outline';
  return 'file-outline';
}

export default function FilesScreen() {
  const insets = useSafeAreaInsets();
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [error, setError] = useState('');

  function refresh() {
    try {
      setFiles(listWorkspaceFiles());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the local workspace.');
    }
  }

  useEffect(() => { refresh(); }, []);

  async function pickFiles() {
    setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
      if (result.canceled) return;
      const directory = workspaceDirectory();
      const stamp = Date.now();
      for (let index = 0; index < result.assets.length; index += 1) {
        const asset = result.assets[index];
        if ((asset.size || 0) > 100 * 1024 * 1024) throw new Error(`${asset.name} is larger than the 100 MB mobile workspace limit.`);
        const target = new File(directory, `${stamp}-${index}-${safeName(asset.name)}`);
        const source = new File(asset.uri);
        await source.copy(target);
      }
      refresh();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import these files.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  async function shareFile(file: WorkspaceFile) {
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(file.uri, { mimeType: file.mimeType || undefined, dialogTitle: `Share ${file.name}` });
      void Haptics.selectionAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share this file.');
    }
  }

  function deleteFile(file: WorkspaceFile) {
    try {
      new File(file.uri).delete();
      refresh();
      void Haptics.selectionAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this file.');
    }
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: 110 }]}>
      <Text style={styles.kicker}>FILES</Text>
      <Text style={styles.title}>Your local Tayar workspace.</Text>
      <Text style={styles.subtitle}>Imported files are copied into the app's private document storage and stay available after you close Tayar.</Text>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}><Text style={styles.summaryValue}>{files.length}</Text><Text style={styles.summaryLabel}>Saved files</Text></View>
        <View style={styles.summaryCard}><Text style={styles.summaryValue}>{formatBytes(totalSize)}</Text><Text style={styles.summaryLabel}>Local storage</Text></View>
      </View>

      <Pressable onPress={() => void pickFiles()} style={({ pressed }) => [styles.pickButton, pressed && { opacity: 0.85 }]}>
        <MaterialCommunityIcons name="file-plus-outline" size={22} color={colors.white} />
        <Text style={styles.pickText}>Import files</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>On this device</Text>
        {files.length ? <Pressable onPress={refresh}><MaterialCommunityIcons name="refresh" size={20} color={colors.violetBright} /></Pressable> : null}
      </View>

      {files.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="folder-open-outline" size={34} color={colors.muted} />
          <Text style={styles.emptyTitle}>Your workspace is empty</Text>
          <Text style={styles.emptyText}>Import PDFs, images, CSVs or documents from Files, iCloud Drive, Downloads or Android storage.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {files.map((file) => (
            <View key={file.uri} style={styles.fileRow}>
              <View style={styles.fileIcon}><MaterialCommunityIcons name={fileIcon(file) as never} size={22} color={colors.violetBright} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={styles.fileName}>{file.name}</Text>
                <Text numberOfLines={1} style={styles.fileMeta}>{formatBytes(file.size)}{file.mimeType ? ` · ${file.mimeType}` : ''}</Text>
              </View>
              <Pressable onPress={() => void shareFile(file)} hitSlop={8} style={styles.iconButton}><MaterialCommunityIcons name="share-variant-outline" size={19} color={colors.text} /></Pressable>
              <Pressable onPress={() => deleteFile(file)} hitSlop={8} style={styles.iconButton}><MaterialCommunityIcons name="trash-can-outline" size={19} color={colors.danger} /></Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={styles.privacyCard}>
        <MaterialCommunityIcons name="shield-lock-outline" size={20} color="#86EFAC" />
        <Text style={styles.privacyText}>This workspace is local to Tayar on this device. Importing a file here does not upload it to Supabase or any AI provider.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18 },
  kicker: { color: colors.violetBright, fontSize: 11, fontWeight: '900', letterSpacing: 2.2 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.8, marginTop: 4 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 10 },
  summaryRow: { flexDirection: 'row', gap: 9, marginTop: 18 },
  summaryCard: { flex: 1, minHeight: 72, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 12, justifyContent: 'center' },
  summaryValue: { color: colors.text, fontSize: 17, fontWeight: '900' },
  summaryLabel: { color: colors.muted, fontSize: 10.5, marginTop: 3 },
  pickButton: { marginTop: 12, minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  pickText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18, marginTop: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  empty: { alignItems: 'center', padding: 28, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 10 },
  emptyText: { color: colors.muted, fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  list: { gap: 10 },
  fileRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  fileIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center' },
  fileName: { color: colors.text, fontSize: 13.5, fontWeight: '800' },
  fileMeta: { color: colors.muted, fontSize: 9.5, marginTop: 4 },
  iconButton: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.panelSoft, alignItems: 'center', justifyContent: 'center' },
  privacyCard: { marginTop: 18, borderRadius: radius.md, borderWidth: 1, borderColor: '#22543D', backgroundColor: '#0C1D17', padding: 13, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  privacyText: { flex: 1, color: '#86CFA5', fontSize: 11, lineHeight: 17 },
});
