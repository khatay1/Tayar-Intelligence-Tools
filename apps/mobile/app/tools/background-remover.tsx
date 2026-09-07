import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  assertBackgroundRemovalAccess,
  recordBackgroundRemovalUsage,
  removeBackgroundOnDevice,
  type LocalBackgroundResult,
} from '@/lib/background-removal';
import { colors, radius } from '@/lib/theme';

type SelectedImage = {
  uri: string;
  width: number;
  height: number;
  fileSize?: number;
  fileName?: string | null;
};

function prettyBytes(value?: number) {
  if (!value || value < 1) return '';
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackgroundRemoverScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<SelectedImage | null>(null);
  const [result, setResult] = useState<LocalBackgroundResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);

  const canRun = useMemo(() => Boolean(selected && !busy), [selected, busy]);

  async function chooseImage() {
    setError('');
    setNotice('');
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });
      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      if (!asset.width || !asset.height) throw new Error('Could not read the selected image dimensions.');
      if ((asset.fileSize || 0) > 15 * 1024 * 1024) throw new Error('Choose an image under 15 MB.');
      setSelected({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize,
        fileName: asset.fileName,
      });
      setResult(null);
      void Haptics.selectionAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open this image.');
    }
  }

  async function processImage() {
    if (!selected || !canRun) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const access = await assertBackgroundRemovalAccess();
      if (typeof access.usage_remaining === 'number') setRemaining(access.usage_remaining);

      const nextResult = await removeBackgroundOnDevice(selected.uri, selected.width, selected.height);
      setResult(nextResult);

      try {
        const updated = await recordBackgroundRemovalUsage();
        if (typeof updated.usage_remaining === 'number') setRemaining(updated.usage_remaining);
      } catch {
        setNotice('Your PNG is ready. Usage sync will retry the next time you use the tool.');
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Background removal failed.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  async function shareResult() {
    if (!result) return;
    setError('');
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(result.uri, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: 'Save or share transparent PNG',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the Save/Share sheet.');
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}>
      <View style={styles.localCard}>
        <MaterialCommunityIcons name="cellphone-lock" size={22} color="#86EFAC" />
        <View style={{ flex: 1 }}>
          <Text style={styles.localTitle}>100% on-device AI</Text>
          <Text style={styles.localText}>Your image never leaves your phone. Tayar runs U²-Net locally with TensorFlow Lite and creates a transparent PNG on-device.</Text>
        </View>
      </View>

      <Pressable onPress={() => void chooseImage()} style={styles.pickerCard}>
        <View style={styles.pickerIcon}>
          <MaterialCommunityIcons name="image-plus" size={28} color="#C4B5FD" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.pickerTitle}>{selected ? 'Change image' : 'Choose an image'}</Text>
          <Text style={styles.pickerText}>{selected ? `${selected.fileName || 'Selected image'}${selected.fileSize ? ` · ${prettyBytes(selected.fileSize)}` : ''}` : 'JPEG, PNG or WebP · up to 15 MB'}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.muted} />
      </Pressable>

      {selected ? (
        <View style={styles.previewCard}>
          <Text style={styles.eyebrow}>ORIGINAL</Text>
          <Image source={{ uri: selected.uri }} style={styles.previewImage} resizeMode="contain" />
          <Text style={styles.dimensions}>{selected.width} × {selected.height}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <Pressable disabled={!canRun} onPress={() => void processImage()} style={({ pressed }) => [styles.processButton, pressed && canRun && { opacity: 0.86 }, !canRun && styles.disabled]}>
        {busy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name="image-filter-center-focus-strong" size={21} color={colors.white} />}
        <Text style={styles.processText}>{busy ? 'Removing background…' : 'Remove background'}</Text>
      </Pressable>

      {remaining !== null ? <Text style={styles.remaining}>{remaining} use{remaining === 1 ? '' : 's'} remaining in your current period</Text> : null}

      {result ? (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View>
              <Text style={styles.resultEyebrow}>TRANSPARENT PNG</Text>
              <Text style={styles.resultTitle}>Background removed</Text>
            </View>
            <MaterialCommunityIcons name="check-circle" size={26} color="#86EFAC" />
          </View>
          <View style={styles.checker}>
            <Image source={{ uri: result.uri }} style={styles.resultImage} resizeMode="contain" />
          </View>
          <Text style={styles.resultMeta}>{result.width} × {result.height} · {prettyBytes(result.bytes)}</Text>
          <Pressable onPress={() => void shareResult()} style={styles.shareButton}>
            <MaterialCommunityIcons name="share-variant-outline" size={20} color={colors.text} />
            <Text style={styles.shareText}>Save or share PNG</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.footer}>The first run may take a little longer while the local AI model initializes. No provider credits or image upload are used.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingTop: 10 },
  localCard: { flexDirection: 'row', gap: 11, borderWidth: 1, borderColor: '#22543D', backgroundColor: '#0C1D17', borderRadius: radius.md, padding: 14 },
  localTitle: { color: '#BBF7D0', fontSize: 13, fontWeight: '900' },
  localText: { color: '#86CFA5', fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  pickerCard: { minHeight: 82, borderRadius: radius.lg, borderWidth: 1, borderColor: '#3C3158', backgroundColor: '#12101D', padding: 14, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pickerIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center' },
  pickerTitle: { color: colors.text, fontSize: 14.5, fontWeight: '900' },
  pickerText: { color: colors.muted, fontSize: 10.8, marginTop: 4 },
  previewCard: { marginTop: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 12 },
  eyebrow: { color: colors.muted, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.4, marginBottom: 8 },
  previewImage: { width: '100%', height: 260, borderRadius: 14, backgroundColor: '#090912' },
  dimensions: { color: colors.muted, fontSize: 10.5, textAlign: 'center', marginTop: 8 },
  error: { color: colors.danger, fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  notice: { color: '#F5D58C', fontSize: 11.5, lineHeight: 17, marginTop: 12 },
  processButton: { minHeight: 54, borderRadius: radius.md, backgroundColor: colors.violet, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  processText: { color: colors.white, fontSize: 14.5, fontWeight: '900' },
  disabled: { opacity: 0.42 },
  remaining: { color: colors.muted, fontSize: 10.5, textAlign: 'center', marginTop: 8 },
  resultCard: { marginTop: 20, borderRadius: radius.lg, borderWidth: 1, borderColor: '#27543E', backgroundColor: '#0C1713', padding: 14 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  resultEyebrow: { color: '#86EFAC', fontSize: 9.5, fontWeight: '900', letterSpacing: 1.3 },
  resultTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 3 },
  checker: { height: 300, borderRadius: 16, overflow: 'hidden', backgroundColor: '#23232C', borderWidth: 1, borderColor: '#353541' },
  resultImage: { width: '100%', height: '100%' },
  resultMeta: { color: colors.muted, fontSize: 10.5, textAlign: 'center', marginTop: 9 },
  shareButton: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.panelSoft, borderWidth: 1, borderColor: colors.border, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  footer: { color: colors.muted, fontSize: 10.5, lineHeight: 16, textAlign: 'center', marginTop: 14 },
});
