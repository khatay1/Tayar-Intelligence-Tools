import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { assertToolAccess, recordLocalToolUsage } from '@/lib/tool-access';
import { downloadTemplateToWorkspace, listMobileTemplates, templateSize, type MobileTemplateAsset } from '@/lib/template-library';
import { colors, radius } from '@/lib/theme';

const formats = ['all', 'xlsx', 'xls', 'csv', 'pdf', 'docx', 'pptx'] as const;

function formatIcon(format: string) {
  if (format.includes('xls') || format === 'csv') return 'file-excel-outline';
  if (format === 'pdf') return 'file-pdf-box';
  if (format.includes('doc')) return 'file-word-outline';
  if (format.includes('ppt')) return 'file-powerpoint-outline';
  return 'file-outline';
}

export default function TemplatesHubScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [format, setFormat] = useState<(typeof formats)[number]>('all');
  const [items, setItems] = useState<MobileTemplateAsset[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [downloadingId, setDownloadingId] = useState('');
  const [error, setError] = useState('');
  const canLoadMore = page < totalPages && !loadingMore;

  const load = useCallback(async (nextPage: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setBusy(true);
    setError('');
    try {
      const result = await listMobileTemplates({ query: submittedQuery, format, page: nextPage, pageSize: 24 });
      setItems((current) => append ? [...current, ...result.items] : result.items);
      setPage(result.page);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the template library.');
      if (!append) setItems([]);
    } finally {
      setBusy(false);
      setLoadingMore(false);
    }
  }, [submittedQuery, format]);

  useEffect(() => { void load(1, false); }, [load]);

  function search() {
    setSubmittedQuery(query.trim());
    void Haptics.selectionAsync();
  }

  async function download(asset: MobileTemplateAsset) {
    if (downloadingId) return;
    setDownloadingId(asset.id);
    setError('');
    try {
      await assertToolAccess('templates-hub');
      const file = await downloadTemplateToWorkspace(asset);
      await recordLocalToolUsage('templates-hub', 'download_template');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: asset.mimeType || undefined, dialogTitle: `Save or share ${asset.title}` });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download this template.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setDownloadingId('');
    }
  }

  const resultText = useMemo(() => busy ? 'Loading…' : `${total.toLocaleString()} templates`, [busy, total]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 42 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <View style={styles.iconWrap}><MaterialCommunityIcons name="view-grid-plus-outline" size={25} color={colors.violetBright} /></View>
        <View style={{ flex: 1 }}><Text style={styles.title}>Templates Hub</Text><Text style={styles.subtitle}>Browse Tayar-hosted office templates and save them directly to your phone.</Text></View>
      </View>

      <View style={styles.storageCard}>
        <MaterialCommunityIcons name="cloud-download-outline" size={21} color="#86EFAC" />
        <View style={{ flex: 1 }}><Text style={styles.storageTitle}>Direct from Tayar R2</Text><Text style={styles.storageText}>Template files download from templates.tayar.se into your private Local Workspace. No Supabase Storage egress is used.</Text></View>
      </View>

      <View style={styles.searchRow}>
        <TextInput value={query} onChangeText={setQuery} onSubmitEditing={search} returnKeyType="search" placeholder="Search templates" placeholderTextColor={colors.muted} style={styles.search} />
        <Pressable onPress={search} style={styles.searchButton}><MaterialCommunityIcons name="magnify" size={21} color={colors.white} /></Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {formats.map((item) => <Pressable key={item} onPress={() => { setFormat(item); void Haptics.selectionAsync(); }} style={[styles.chip, format === item && styles.chipActive]}><Text style={[styles.chipText, format === item && styles.chipTextActive]}>{item === 'all' ? 'All' : item.toUpperCase()}</Text></Pressable>)}
      </ScrollView>

      <View style={styles.resultHeader}><Text style={styles.resultCount}>{resultText}</Text>{submittedQuery ? <Pressable onPress={() => { setQuery(''); setSubmittedQuery(''); }}><Text style={styles.clear}>Clear search</Text></Pressable> : null}</View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {busy ? <View style={styles.loading}><ActivityIndicator size="large" color={colors.violetBright} /><Text style={styles.loadingText}>Loading Tayar library…</Text></View> : (
        <View style={styles.list}>
          {items.map((asset) => <View key={asset.id} style={styles.card}>
            <View style={styles.fileIcon}><MaterialCommunityIcons name={formatIcon(asset.format) as never} size={24} color={colors.violetBright} /></View>
            <View style={styles.cardCopy}>
              <Text numberOfLines={2} style={styles.cardTitle}>{asset.title}</Text>
              <Text numberOfLines={1} style={styles.meta}>{asset.category} · {asset.format.toUpperCase()}{asset.fileSizeBytes ? ` · ${templateSize(asset.fileSizeBytes)}` : ''}</Text>
              <Text numberOfLines={1} style={styles.filename}>{asset.originalFilename}</Text>
            </View>
            <Pressable disabled={Boolean(downloadingId)} onPress={() => void download(asset)} style={styles.downloadButton}>
              {downloadingId === asset.id ? <ActivityIndicator color={colors.white} size="small" /> : <MaterialCommunityIcons name="download" size={20} color={colors.white} />}
            </Pressable>
          </View>)}
          {!items.length ? <View style={styles.empty}><MaterialCommunityIcons name="file-search-outline" size={34} color={colors.muted} /><Text style={styles.emptyTitle}>No templates found</Text><Text style={styles.emptyText}>Try another search or file format.</Text></View> : null}
        </View>
      )}

      {canLoadMore ? <Pressable onPress={() => void load(page + 1, true)} style={styles.moreButton}>{loadingMore ? <ActivityIndicator color={colors.violetBright} /> : <MaterialCommunityIcons name="chevron-down" size={20} color={colors.violetBright} />}<Text style={styles.moreText}>{loadingMore ? 'Loading…' : `Load more · page ${page + 1} of ${totalPages}`}</Text></Pressable> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg }, content: { paddingHorizontal: 18, paddingTop: 10 }, hero: { flexDirection: 'row', gap: 13, alignItems: 'center', paddingVertical: 10, marginBottom: 10 }, iconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center' }, title: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }, subtitle: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  storageCard: { flexDirection: 'row', gap: 10, borderRadius: radius.md, borderWidth: 1, borderColor: '#22543D', backgroundColor: '#0C1D17', padding: 13 }, storageTitle: { color: '#BBF7D0', fontSize: 12.5, fontWeight: '900' }, storageText: { color: '#86CFA5', fontSize: 11, lineHeight: 16, marginTop: 2 }, searchRow: { flexDirection: 'row', gap: 8, marginTop: 14 }, search: { flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, paddingHorizontal: 14, fontSize: 14 }, searchButton: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: 8, paddingTop: 11, paddingRight: 18 }, chip: { minHeight: 36, minWidth: 57, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }, chipActive: { borderColor: colors.violet, backgroundColor: colors.violetSoft }, chipText: { color: colors.muted, fontSize: 10.5, fontWeight: '800' }, chipTextActive: { color: '#DDD6FE' },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 9 }, resultCount: { color: colors.text, fontSize: 13, fontWeight: '900' }, clear: { color: colors.violetBright, fontSize: 11, fontWeight: '800' }, error: { color: colors.danger, fontSize: 12, lineHeight: 18, marginBottom: 10 }, loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 11 }, loadingText: { color: colors.muted, fontSize: 12 }, list: { gap: 9 },
  card: { minHeight: 88, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 12, flexDirection: 'row', gap: 11, alignItems: 'center' }, fileIcon: { width: 45, height: 45, borderRadius: 14, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center' }, cardCopy: { flex: 1, minWidth: 0 }, cardTitle: { color: colors.text, fontSize: 13.5, fontWeight: '900', lineHeight: 18 }, meta: { color: colors.muted, fontSize: 9.5, marginTop: 4 }, filename: { color: '#787384', fontSize: 9, marginTop: 3 }, downloadButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', padding: 30, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel }, emptyTitle: { color: colors.text, fontSize: 14.5, fontWeight: '900', marginTop: 9 }, emptyText: { color: colors.muted, fontSize: 11.5, marginTop: 4 }, moreButton: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, moreText: { color: colors.violetBright, fontSize: 11.5, fontWeight: '800' },
});
