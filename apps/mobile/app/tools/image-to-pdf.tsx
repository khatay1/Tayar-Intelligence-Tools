import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { PDFDocument } from '@pdfme/pdf-lib';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { assertToolAccess, recordLocalToolUsage } from '@/lib/tool-access';
import { colors, radius } from '@/lib/theme';

type PickedImage = { uri: string; width: number; height: number; fileName?: string | null; fileSize?: number | null };
const MAX_IMAGES = 20;
const MAX_EDGE = 2600;
const A4_PORTRAIT: [number, number] = [595.28, 841.89];
const A4_LANDSCAPE: [number, number] = [841.89, 595.28];

function fitInside(width: number, height: number, boxWidth: number, boxHeight: number) {
  const scale = Math.min(boxWidth / width, boxHeight / height);
  return { width: width * scale, height: height * scale };
}

export default function ImageToPdfScreen() {
  const insets = useSafeAreaInsets();
  const [images, setImages] = useState<PickedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canRun = useMemo(() => images.length > 0 && !busy, [images.length, busy]);

  async function pickImages() {
    setError('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Photo library access is required to select images.');
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES,
        quality: 1,
        exif: false,
      });
      if (picked.canceled) return;
      const next = picked.assets.slice(0, MAX_IMAGES).map((asset) => ({ uri: asset.uri, width: asset.width, height: asset.height, fileName: asset.fileName, fileSize: asset.fileSize }));
      const total = next.reduce((sum, item) => sum + (item.fileSize || 0), 0);
      if (total > 80 * 1024 * 1024) throw new Error('Keep the selected images under 80 MB total.');
      setImages(next);
      void Haptics.selectionAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the photo library.');
    }
  }

  function removeImage(index: number) {
    setImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
    void Haptics.selectionAsync();
  }

  async function createPdf() {
    if (!canRun) return;
    setBusy(true);
    setError('');
    try {
      await assertToolAccess('image-to-pdf');
      const pdf = await PDFDocument.create();
      for (const source of images) {
        const largest = Math.max(source.width, source.height);
        const scale = largest > MAX_EDGE ? MAX_EDGE / largest : 1;
        const resizedWidth = Math.max(1, Math.round(source.width * scale));
        const resizedHeight = Math.max(1, Math.round(source.height * scale));
        const normalized = await ImageManipulator.manipulateAsync(
          source.uri,
          scale < 1 ? [{ resize: { width: resizedWidth, height: resizedHeight } }] : [],
          { format: ImageManipulator.SaveFormat.JPEG, compress: 0.9 },
        );
        const bytes = await new File(normalized.uri).bytes();
        const embedded = await pdf.embedJpg(bytes);
        const pageSize = source.width >= source.height ? A4_LANDSCAPE : A4_PORTRAIT;
        const page = pdf.addPage(pageSize);
        const margin = 28;
        const fitted = fitInside(embedded.width, embedded.height, pageSize[0] - margin * 2, pageSize[1] - margin * 2);
        page.drawImage(embedded, {
          x: (pageSize[0] - fitted.width) / 2,
          y: (pageSize[1] - fitted.height) / 2,
          width: fitted.width,
          height: fitted.height,
        });
      }
      pdf.setProducer('Tayar Tools Mobile');
      pdf.setCreator('Tayar Tools');
      const outputBytes = await pdf.save({ useObjectStreams: true, addDefaultPage: false });
      const output = new File(Paths.cache, `tayar-images-${Date.now()}.pdf`);
      output.create();
      output.write(outputBytes);
      await recordLocalToolUsage('image-to-pdf', 'images_to_pdf');
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(output.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Save or share PDF' });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the PDF.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}>
      <View style={styles.localCard}><MaterialCommunityIcons name="cellphone-lock" size={21} color="#86EFAC" /><View style={{ flex: 1 }}><Text style={styles.localTitle}>Images stay on your phone</Text><Text style={styles.localText}>Tayar converts the selected photos to a PDF locally and opens the system Save/Share sheet.</Text></View></View>

      <Pressable onPress={() => void pickImages()} style={styles.picker}><MaterialCommunityIcons name="image-multiple-outline" size={31} color="#C4B5FD" /><View style={{ flex: 1 }}><Text style={styles.pickerTitle}>{images.length ? `${images.length} image${images.length === 1 ? '' : 's'} selected` : 'Choose images'}</Text><Text style={styles.pickerText}>Up to {MAX_IMAGES} images · Gallery selection order becomes PDF order</Text></View><MaterialCommunityIcons name="chevron-right" size={24} color={colors.muted} /></Pressable>

      {images.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previews}>{images.map((item, index) => <View key={`${item.uri}-${index}`} style={styles.previewCard}><Image source={{ uri: item.uri }} style={styles.previewImage} resizeMode="cover" /><View style={styles.previewFooter}><Text style={styles.previewIndex}>{index + 1}</Text><Pressable onPress={() => removeImage(index)} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={22} color="#FCA5A5" /></Pressable></View></View>)}</ScrollView> : null}

      <View style={styles.infoCard}><Text style={styles.infoTitle}>PDF output</Text><Text style={styles.infoText}>• One image per A4 page</Text><Text style={styles.infoText}>• Portrait/landscape chosen automatically</Text><Text style={styles.infoText}>• Large images are downscaled locally to control file size</Text><Text style={styles.infoText}>• JPEG normalization avoids unsupported image formats in PDF</Text></View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={!canRun} onPress={() => void createPdf()} style={({ pressed }) => [styles.action, pressed && canRun && { opacity: 0.86 }, !canRun && styles.disabled]}>{busy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name="file-pdf-box" size={22} color={colors.white} />}<Text style={styles.actionText}>{busy ? 'Creating PDF…' : 'Create & Save PDF'}</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg }, content: { paddingHorizontal: 18, paddingTop: 10 },
  localCard: { flexDirection: 'row', gap: 11, borderWidth: 1, borderColor: '#22543D', backgroundColor: '#0C1D17', borderRadius: radius.md, padding: 14 }, localTitle: { color: '#BBF7D0', fontSize: 13, fontWeight: '900' }, localText: { color: '#86CFA5', fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  picker: { marginTop: 14, minHeight: 84, borderRadius: radius.lg, borderWidth: 1, borderColor: '#3C3158', backgroundColor: '#12101D', padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 }, pickerTitle: { color: colors.text, fontSize: 14.5, fontWeight: '900' }, pickerText: { color: colors.muted, fontSize: 10.7, lineHeight: 16, marginTop: 4 },
  previews: { gap: 10, paddingVertical: 14, paddingRight: 18 }, previewCard: { width: 112, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel }, previewImage: { width: 112, height: 92, backgroundColor: colors.panelSoft }, previewFooter: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 }, previewIndex: { color: colors.text, fontSize: 11, fontWeight: '900' },
  infoCard: { marginTop: 2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 15 }, infoTitle: { color: colors.text, fontSize: 13.5, fontWeight: '900', marginBottom: 7 }, infoText: { color: '#C8C5D4', fontSize: 12, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 12.5, lineHeight: 18, marginTop: 12 }, action: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, marginTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, disabled: { opacity: 0.42 }, actionText: { color: colors.white, fontSize: 14.5, fontWeight: '900' },
});
