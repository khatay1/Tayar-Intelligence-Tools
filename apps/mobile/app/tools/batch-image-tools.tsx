import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { zipSync } from 'fflate';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { assertToolAccess, recordLocalToolUsage } from '@/lib/tool-access';
import { colors, radius } from '@/lib/theme';

type OutputFormat = 'JPEG' | 'PNG' | 'WEBP';
type MaxWidth = 'Original' | '1920' | '1280' | '1024';
type PickedImage = { uri: string; width: number; height: number; fileName: string; fileSize: number };

const formats: OutputFormat[] = ['JPEG', 'PNG', 'WEBP'];
const widths: MaxWidth[] = ['Original', '1920', '1280', '1024'];

function safeBaseName(name: string, index: number) {
  return (name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 55) || `image-${index + 1}`);
}

function saveFormat(format: OutputFormat) {
  if (format === 'PNG') return ImageManipulator.SaveFormat.PNG;
  if (format === 'WEBP') return ImageManipulator.SaveFormat.WEBP;
  return ImageManipulator.SaveFormat.JPEG;
}

function extension(format: OutputFormat) {
  return format === 'JPEG' ? 'jpg' : format.toLowerCase();
}


export default function BatchImageToolsScreen() {
  const insets = useSafeAreaInsets();
  const [images, setImages] = useState<PickedImage[]>([]);
  const [format, setFormat] = useState<OutputFormat>('JPEG');
  const [maxWidth, setMaxWidth] = useState<MaxWidth>('1920');
  const [busy, setBusy] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [error, setError] = useState('');

  const totalMb = useMemo(() => images.reduce((sum, image) => sum + image.fileSize, 0) / (1024 * 1024), [images]);
  const canRun = images.length > 0 && !busy;

  async function chooseImages() {
    setError('');
    setProcessed(0);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Photo library access is required.');
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 20,
        quality: 1,
        exif: false,
      });
      if (picked.canceled) return;
      const next = picked.assets.slice(0, 20).map((asset, index) => ({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileName: asset.fileName || `image-${index + 1}`,
        fileSize: asset.fileSize || 0,
      }));
      const bytes = next.reduce((sum, image) => sum + image.fileSize, 0);
      if (bytes > 100 * 1024 * 1024) throw new Error('Choose up to 100 MB of images per batch.');
      setImages(next);
      void Haptics.selectionAsync();
    } catch (err) {
      setImages([]);
      setError(err instanceof Error ? err.message : 'Could not open these images.');
    }
  }

  async function convertAndZip() {
    if (!canRun) return;
    setBusy(true);
    setProcessed(0);
    setError('');
    try {
      await assertToolAccess('batch-image-tools');
      const zipEntries: Record<string, Uint8Array> = {};
      const usedNames = new Set<string>();

      for (let index = 0; index < images.length; index += 1) {
        const image = images[index];
        const targetWidth = maxWidth === 'Original' ? null : Number(maxWidth);
        const actions: ImageManipulator.Action[] = targetWidth && image.width > targetWidth
          ? [{ resize: { width: targetWidth } }]
          : [];
        const result = await ImageManipulator.manipulateAsync(image.uri, actions, {
          format: saveFormat(format),
          compress: format === 'PNG' ? 1 : 0.88,
        });
        const bytes = await new File(result.uri).bytes();
        const base = safeBaseName(image.fileName, index);
        let fileName = `${base}.${extension(format)}`;
        let suffix = 2;
        while (usedNames.has(fileName.toLowerCase())) {
          fileName = `${base}-${suffix}.${extension(format)}`;
          suffix += 1;
        }
        usedNames.add(fileName.toLowerCase());
        zipEntries[fileName] = bytes;
        setProcessed(index + 1);
      }

      const zipped = zipSync(zipEntries, { level: 6 });
      const output = new File(Paths.cache, `tayar-images-${Date.now()}.zip`);
      output.create();
      output.write(zipped);
      await recordLocalToolUsage('batch-image-tools', 'convert_batch');
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(output.uri, { mimeType: 'application/zip', dialogTitle: 'Save or share converted images ZIP' });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch image conversion failed.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
      <View style={styles.localCard}>
        <MaterialCommunityIcons name="cellphone-lock" size={21} color="#86EFAC" />
        <View style={{ flex: 1 }}>
          <Text style={styles.localTitle}>Local batch processing</Text>
          <Text style={styles.localText}>Resize and conversion happen on your phone. Only the successful tool usage event is recorded.</Text>
        </View>
      </View>

      <Pressable onPress={() => void chooseImages()} style={styles.picker}>
        <MaterialCommunityIcons name="image-multiple-outline" size={30} color="#C4B5FD" />
        <View style={{ flex: 1 }}>
          <Text style={styles.pickerTitle}>{images.length ? `${images.length} images selected` : 'Choose up to 20 images'}</Text>
          <Text style={styles.pickerText}>{images.length ? `${totalMb.toFixed(1)} MB total` : 'JPEG · PNG · WebP · up to 100 MB'}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.muted} />
      </Pressable>

      {images.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
          {images.slice(0, 10).map((image, index) => (
            <View key={`${image.uri}-${index}`} style={styles.previewItem}>
              <Image source={{ uri: image.uri }} style={styles.previewImage} />
              <Text numberOfLines={1} style={styles.previewName}>{image.fileName}</Text>
            </View>
          ))}
          {images.length > 10 ? <View style={styles.moreCard}><Text style={styles.moreValue}>+{images.length - 10}</Text><Text style={styles.moreLabel}>more</Text></View> : null}
        </ScrollView>
      ) : null}

      <Text style={styles.label}>Output format</Text>
      <View style={styles.segmentRow}>
        {formats.map((item) => (
          <Pressable key={item} onPress={() => setFormat(item)} style={[styles.segment, format === item && styles.segmentActive]}>
            <Text style={[styles.segmentText, format === item && styles.segmentTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Maximum width</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {widths.map((item) => (
          <Pressable key={item} onPress={() => setMaxWidth(item)} style={[styles.chip, maxWidth === item && styles.segmentActive]}>
            <Text style={[styles.segmentText, maxWidth === item && styles.segmentTextActive]}>{item === 'Original' ? item : `${item}px`}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.summaryCard}>
        <View><Text style={styles.summaryLabel}>FILES</Text><Text style={styles.summaryValue}>{images.length || '—'}</Text></View>
        <View><Text style={styles.summaryLabel}>FORMAT</Text><Text style={styles.summaryValue}>{format}</Text></View>
        <View><Text style={styles.summaryLabel}>ZIP</Text><Text style={styles.summaryValue}>One file</Text></View>
      </View>

      {busy ? (
        <View style={styles.progressCard}>
          <ActivityIndicator color={colors.violetBright} />
          <Text style={styles.progressText}>Processing {processed} / {images.length}</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable disabled={!canRun} onPress={() => void convertAndZip()} style={({ pressed }) => [styles.action, pressed && canRun && { opacity: 0.86 }, !canRun && styles.disabled]}>
        {busy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name="folder-zip-outline" size={21} color={colors.white} />}
        <Text style={styles.actionText}>{busy ? 'Converting…' : 'Convert & Save ZIP'}</Text>
      </Pressable>
      <Text style={styles.footerNote}>Large batches use device memory. Tayar caps each batch at 20 images / 100 MB to keep the app responsive.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingTop: 10 },
  localCard: { flexDirection: 'row', gap: 11, borderWidth: 1, borderColor: '#22543D', backgroundColor: '#0C1D17', borderRadius: radius.md, padding: 14 },
  localTitle: { color: '#BBF7D0', fontSize: 13, fontWeight: '900' },
  localText: { color: '#86CFA5', fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  picker: { marginTop: 14, minHeight: 84, borderRadius: radius.lg, borderWidth: 1, borderColor: '#3C3158', backgroundColor: '#12101D', padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pickerTitle: { color: colors.text, fontSize: 14.5, fontWeight: '900' },
  pickerText: { color: colors.muted, fontSize: 11, marginTop: 4 },
  previewRow: { gap: 9, paddingTop: 13, paddingRight: 18 },
  previewItem: { width: 88 },
  previewImage: { width: 88, height: 88, borderRadius: 14, backgroundColor: colors.panel },
  previewName: { color: colors.muted, fontSize: 9.5, marginTop: 5 },
  moreCard: { width: 76, height: 88, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  moreValue: { color: colors.text, fontSize: 18, fontWeight: '900' },
  moreLabel: { color: colors.muted, fontSize: 10, marginTop: 2 },
  label: { color: colors.text, fontSize: 12.5, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { borderColor: colors.violet, backgroundColor: colors.violetSoft },
  segmentText: { color: colors.muted, fontSize: 11.5, fontWeight: '800' },
  segmentTextActive: { color: '#DDD6FE' },
  chips: { gap: 8, paddingRight: 18 },
  chip: { minHeight: 39, minWidth: 82, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 15 },
  summaryLabel: { color: colors.muted, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.1 },
  summaryValue: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 4 },
  progressCard: { marginTop: 12, minHeight: 46, borderRadius: radius.md, backgroundColor: colors.panelSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  progressText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  error: { color: colors.danger, fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  action: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, marginTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  disabled: { opacity: 0.42 },
  actionText: { color: colors.white, fontSize: 14.5, fontWeight: '900' },
  footerNote: { color: colors.muted, fontSize: 10.5, lineHeight: 16, textAlign: 'center', marginTop: 10 },
});
