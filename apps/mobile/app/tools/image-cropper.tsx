import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { assertToolAccess, recordLocalToolUsage } from '@/lib/tool-access';
import { colors, radius } from '@/lib/theme';

type Aspect = 'Original' | '1:1' | '4:5' | '16:9' | '3:2';
type OutputFormat = 'JPEG' | 'PNG';
type Picked = { uri: string; width: number; height: number; fileSize?: number | null };
const aspects: Aspect[] = ['Original', '1:1', '4:5', '16:9', '3:2'];
const aspectRatios: Record<Exclude<Aspect, 'Original'>, number> = { '1:1': 1, '4:5': 4 / 5, '16:9': 16 / 9, '3:2': 3 / 2 };

function cropAction(width: number, height: number, aspect: Aspect): ImageManipulator.Action[] {
  if (aspect === 'Original') return [];
  const target = aspectRatios[aspect];
  const current = width / height;
  if (current > target) {
    const cropWidth = Math.max(1, Math.round(height * target));
    return [{ crop: { originX: Math.max(0, Math.round((width - cropWidth) / 2)), originY: 0, width: cropWidth, height } }];
  }
  const cropHeight = Math.max(1, Math.round(width / target));
  return [{ crop: { originX: 0, originY: Math.max(0, Math.round((height - cropHeight) / 2)), width, height: cropHeight } }];
}

export default function ImageCropperScreen() {
  const insets = useSafeAreaInsets();
  const [image, setImage] = useState<Picked | null>(null);
  const [aspect, setAspect] = useState<Aspect>('1:1');
  const [format, setFormat] = useState<OutputFormat>('JPEG');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canRun = useMemo(() => Boolean(image && !busy), [image, busy]);

  async function chooseImage() {
    setError('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Photo library access is required.');
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1, exif: false });
      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      if ((asset.fileSize || 0) > 30 * 1024 * 1024) throw new Error('Choose an image up to 30 MB.');
      setImage({ uri: asset.uri, width: asset.width, height: asset.height, fileSize: asset.fileSize });
      void Haptics.selectionAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open this image.');
    }
  }

  async function cropAndShare() {
    if (!image || busy) return;
    setBusy(true);
    setError('');
    try {
      await assertToolAccess('image-cropper');
      const result = await ImageManipulator.manipulateAsync(
        image.uri,
        cropAction(image.width, image.height, aspect),
        {
          format: format === 'PNG' ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG,
          compress: format === 'PNG' ? 1 : 0.92,
        },
      );
      await recordLocalToolUsage('image-cropper', 'crop_image');
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(result.uri, { mimeType: format === 'PNG' ? 'image/png' : 'image/jpeg', dialogTitle: 'Save or share cropped image' });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image cropping failed.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}>
      <View style={styles.localCard}><MaterialCommunityIcons name="cellphone-lock" size={21} color="#86EFAC" /><View style={{ flex: 1 }}><Text style={styles.localTitle}>Local image editing</Text><Text style={styles.localText}>Cropping and format conversion happen on your phone. The original image is never uploaded.</Text></View></View>
      <Pressable onPress={() => void chooseImage()} style={styles.picker}><MaterialCommunityIcons name="image-outline" size={30} color="#C4B5FD" /><View style={{ flex: 1 }}><Text style={styles.pickerTitle}>{image ? 'Change image' : 'Choose image'}</Text><Text style={styles.pickerText}>{image ? `${image.width} × ${image.height}` : 'JPEG · PNG · WebP'}</Text></View><MaterialCommunityIcons name="chevron-right" size={24} color={colors.muted} /></Pressable>
      {image ? <View style={styles.previewWrap}><Image source={{ uri: image.uri }} style={styles.preview} resizeMode="contain" /></View> : null}
      <Text style={styles.label}>Aspect ratio</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{aspects.map((item) => <Pressable key={item} onPress={() => { setAspect(item); void Haptics.selectionAsync(); }} style={[styles.chip, aspect === item && styles.chipActive]}><Text style={[styles.chipText, aspect === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</ScrollView>
      <Text style={styles.label}>Output</Text><View style={styles.formatRow}>{(['JPEG', 'PNG'] as const).map((item) => <Pressable key={item} onPress={() => setFormat(item)} style={[styles.formatButton, format === item && styles.chipActive]}><Text style={[styles.chipText, format === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</View>
      <View style={styles.note}><Text style={styles.noteText}>Crop is centered automatically. A precise drag-to-crop editor can be layered on this native screen later without changing the local-processing architecture.</Text></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={!canRun} onPress={() => void cropAndShare()} style={({ pressed }) => [styles.action, pressed && canRun && { opacity: 0.86 }, !canRun && styles.disabled]}>{busy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name="crop" size={21} color={colors.white} />}<Text style={styles.actionText}>{busy ? 'Cropping…' : 'Crop & Save'}</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg }, content: { paddingHorizontal: 18, paddingTop: 10 }, localCard: { flexDirection: 'row', gap: 11, borderWidth: 1, borderColor: '#22543D', backgroundColor: '#0C1D17', borderRadius: radius.md, padding: 14 }, localTitle: { color: '#BBF7D0', fontSize: 13, fontWeight: '900' }, localText: { color: '#86CFA5', fontSize: 11.5, lineHeight: 17, marginTop: 3 }, picker: { marginTop: 14, minHeight: 82, borderRadius: radius.lg, borderWidth: 1, borderColor: '#3C3158', backgroundColor: '#12101D', padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 }, pickerTitle: { color: colors.text, fontSize: 14.5, fontWeight: '900' }, pickerText: { color: colors.muted, fontSize: 11, marginTop: 4 }, previewWrap: { marginTop: 14, height: 260, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: '#0C0B12' }, preview: { width: '100%', height: '100%' }, label: { color: colors.text, fontSize: 12.5, fontWeight: '800', marginTop: 15, marginBottom: 8 }, chips: { gap: 8, paddingRight: 18 }, chip: { minHeight: 38, minWidth: 66, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' }, chipActive: { borderColor: colors.violet, backgroundColor: colors.violetSoft }, chipText: { color: colors.muted, fontSize: 12, fontWeight: '800' }, chipTextActive: { color: '#DDD6FE' }, formatRow: { flexDirection: 'row', gap: 9 }, formatButton: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' }, note: { marginTop: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelSoft, padding: 12 }, noteText: { color: colors.muted, fontSize: 11, lineHeight: 17 }, error: { color: colors.danger, fontSize: 12.5, lineHeight: 18, marginTop: 12 }, action: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, marginTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, disabled: { opacity: 0.42 }, actionText: { color: colors.white, fontSize: 14.5, fontWeight: '900' },
});
