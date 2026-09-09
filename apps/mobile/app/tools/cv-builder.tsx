import { PDFDocument, StandardFonts, rgb } from '@pdfme/pdf-lib';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '@/lib/theme';

function wrapText(text: string, maxChars: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export default function CvBuilderScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [summary, setSummary] = useState('');
  const [experience, setExperience] = useState('');
  const [education, setEducation] = useState('');
  const [skills, setSkills] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canGenerate = useMemo(() => name.trim().length >= 2 && !busy, [name, busy]);

  async function generate() {
    if (!canGenerate) return;
    setBusy(true);
    setError('');
    try {
      const pdf = await PDFDocument.create();
      const page = pdf.addPage([595.28, 841.89]);
      const regular = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const dark = rgb(0.08, 0.07, 0.12);
      const muted = rgb(0.39, 0.37, 0.47);
      const violet = rgb(0.45, 0.29, 0.88);
      const divider = rgb(0.88, 0.87, 0.92);
      const margin = 52;
      let y = 782;

      page.drawText(name.trim().slice(0, 60), { x: margin, y, size: 25, font: bold, color: dark });
      y -= 28;
      if (title.trim()) {
        page.drawText(title.trim().slice(0, 80), { x: margin, y, size: 12, font: bold, color: violet });
        y -= 24;
      }
      const contact = [email, phone, location].map((value) => value.trim()).filter(Boolean).join('  ·  ').slice(0, 120);
      if (contact) {
        page.drawText(contact, { x: margin, y, size: 9.5, font: regular, color: muted, maxWidth: 490 });
        y -= 22;
      }
      page.drawLine({ start: { x: margin, y }, end: { x: 543, y }, thickness: 1, color: divider });
      y -= 22;

      const drawSection = (heading: string, body: string, maxLines: number) => {
        if (!body.trim() || y < 90) return;
        page.drawText(heading.toUpperCase(), { x: margin, y, size: 9, font: bold, color: violet });
        y -= 18;
        const lines = body.includes('\n')
          ? body.split('\n').flatMap((line) => wrapText(line, 86))
          : wrapText(body, 86);
        for (const line of lines.slice(0, maxLines)) {
          if (y < 70) break;
          page.drawText(line.slice(0, 110), { x: margin, y, size: 10, font: regular, color: dark, maxWidth: 490 });
          y -= 14;
        }
        y -= 15;
      };

      drawSection('Profile', summary, 8);
      drawSection('Experience', experience, 16);
      drawSection('Education', education, 9);
      drawSection('Skills', skills, 7);

      page.drawText('Created with Tayar CV Builder', { x: margin, y: 36, size: 8, font: regular, color: muted });
      pdf.setProducer('Tayar CV Builder Mobile');
      const bytes = await pdf.save({ useObjectStreams: true, addDefaultPage: false });
      const safe = name.trim().replace(/[^a-z0-9_-]/gi, '-').replace(/-+/g, '-').slice(0, 50) || 'cv';
      const output = new File(Paths.cache, `${Date.now()}-${safe}-CV.pdf`);
      output.create();
      output.write(bytes);
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(output.uri, { mimeType: 'application/pdf', dialogTitle: 'Save or share CV', UTI: 'com.adobe.pdf' });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create this CV.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <View style={styles.heroIcon}><MaterialCommunityIcons name="account-box-outline" size={29} color="#DDD6FE" /></View>
        <View style={{ flex: 1 }}><Text style={styles.heroTitle}>Build a clean CV on your phone</Text><Text style={styles.heroText}>Fill in your details and export a polished PDF locally.</Text></View>
      </View>

      <Text style={styles.label}>Full name *</Text><TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Your full name" placeholderTextColor={colors.muted} />
      <Text style={styles.label}>Professional title</Text><TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="e.g. Production Technician" placeholderTextColor={colors.muted} />
      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}><Text style={styles.label}>Email</Text><TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={styles.input} placeholderTextColor={colors.muted} /></View>
        <View style={{ flex: 1 }}><Text style={styles.label}>Phone</Text><TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} placeholderTextColor={colors.muted} /></View>
      </View>
      <Text style={styles.label}>Location</Text><TextInput value={location} onChangeText={setLocation} style={styles.input} placeholder="City, country" placeholderTextColor={colors.muted} />
      <Text style={styles.label}>Profile summary</Text><TextInput value={summary} onChangeText={setSummary} multiline textAlignVertical="top" style={styles.textareaSmall} placeholder="A short professional summary..." placeholderTextColor={colors.muted} />
      <Text style={styles.label}>Experience</Text><TextInput value={experience} onChangeText={setExperience} multiline textAlignVertical="top" style={styles.textarea} placeholder={'Job title — Company — Dates\nKey responsibilities and achievements'} placeholderTextColor={colors.muted} />
      <Text style={styles.label}>Education</Text><TextInput value={education} onChangeText={setEducation} multiline textAlignVertical="top" style={styles.textareaSmall} placeholder={'Program / degree — School — Dates'} placeholderTextColor={colors.muted} />
      <Text style={styles.label}>Skills</Text><TextInput value={skills} onChangeText={setSkills} multiline textAlignVertical="top" style={styles.textareaSmall} placeholder="Quality, manufacturing, Excel, languages..." placeholderTextColor={colors.muted} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={!canGenerate} onPress={() => void generate()} style={({ pressed }) => [styles.generateButton, pressed && canGenerate && { opacity: 0.86 }, !canGenerate && styles.disabled]}>
        {busy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name="file-pdf-box" size={21} color={colors.white} />}
        <Text style={styles.generateText}>{busy ? 'Creating CV…' : 'Create & Save CV'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingTop: 10 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: radius.lg, borderWidth: 1, borderColor: '#3C3158', backgroundColor: '#151120', padding: 15 },
  heroIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.violetSoft },
  heroTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  heroText: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  label: { color: colors.text, fontSize: 12.5, fontWeight: '800', marginTop: 14, marginBottom: 7 },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, paddingHorizontal: 13, fontSize: 14 },
  twoCol: { flexDirection: 'row', gap: 10 },
  textareaSmall: { minHeight: 92, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, padding: 13, fontSize: 13.5, lineHeight: 20 },
  textarea: { minHeight: 145, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, padding: 13, fontSize: 13.5, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  generateButton: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, marginTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  generateText: { color: colors.white, fontSize: 14.5, fontWeight: '900' },
  disabled: { opacity: 0.42 },
});
