import { PDFDocument, StandardFonts, rgb } from '@pdfme/pdf-lib';
import * as Haptics from 'expo-haptics';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '@/lib/theme';

type InvoiceItem = { id: string; description: string; quantity: string; unitPrice: string };

function numberValue(value: string) {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function safeText(value: string, fallback: string) {
  return value.trim() || fallback;
}

export default function InvoiceGeneratorScreen() {
  const insets = useSafeAreaInsets();
  const [seller, setSeller] = useState('');
  const [customer, setCustomer] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${new Date().getFullYear()}-001`);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState('SEK');
  const [tax, setTax] = useState('25');
  const [notes, setNotes] = useState('Thank you for your business.');
  const [items, setItems] = useState<InvoiceItem[]>([{ id: '1', description: 'Service', quantity: '1', unitPrice: '1000' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + numberValue(item.quantity) * numberValue(item.unitPrice), 0), [items]);
  const taxRate = Math.min(100, numberValue(tax));
  const taxAmount = subtotal * taxRate / 100;
  const total = subtotal + taxAmount;

  function updateItem(id: string, key: keyof Omit<InvoiceItem, 'id'>, value: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, [key]: value } : item));
  }

  function addItem() {
    if (items.length >= 8) return;
    setItems((current) => [...current, { id: `${Date.now()}`, description: '', quantity: '1', unitPrice: '0' }]);
    void Haptics.selectionAsync();
  }

  function removeItem(id: string) {
    if (items.length <= 1) return;
    setItems((current) => current.filter((item) => item.id !== id));
    void Haptics.selectionAsync();
  }

  async function generate() {
    setBusy(true);
    setError('');
    try {
      if (!items.some((item) => item.description.trim() && numberValue(item.quantity) > 0)) throw new Error('Add at least one valid invoice item.');
      const pdf = await PDFDocument.create();
      const page = pdf.addPage([595.28, 841.89]);
      const regular = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const dark = rgb(0.09, 0.08, 0.14);
      const muted = rgb(0.38, 0.37, 0.45);
      const violet = rgb(0.49, 0.31, 0.93);
      const line = rgb(0.87, 0.86, 0.91);
      const margin = 48;

      page.drawText('TAYAR', { x: margin, y: 780, size: 12, font: bold, color: violet });
      page.drawText('INVOICE', { x: 405, y: 772, size: 24, font: bold, color: dark });
      page.drawText(safeText(invoiceNumber, 'Invoice'), { x: 405, y: 751, size: 10, font: regular, color: muted });
      page.drawText(date, { x: 405, y: 735, size: 10, font: regular, color: muted });

      page.drawText('FROM', { x: margin, y: 716, size: 8, font: bold, color: muted });
      page.drawText(safeText(seller, 'Seller / company'), { x: margin, y: 696, size: 12, font: bold, color: dark, maxWidth: 210 });
      page.drawText('BILL TO', { x: 310, y: 716, size: 8, font: bold, color: muted });
      page.drawText(safeText(customer, 'Customer'), { x: 310, y: 696, size: 12, font: bold, color: dark, maxWidth: 230 });

      const tableTop = 642;
      page.drawRectangle({ x: margin, y: tableTop, width: 499, height: 28, color: rgb(0.96, 0.95, 0.98) });
      page.drawText('DESCRIPTION', { x: margin + 8, y: tableTop + 10, size: 8, font: bold, color: muted });
      page.drawText('QTY', { x: 350, y: tableTop + 10, size: 8, font: bold, color: muted });
      page.drawText('PRICE', { x: 402, y: tableTop + 10, size: 8, font: bold, color: muted });
      page.drawText('AMOUNT', { x: 476, y: tableTop + 10, size: 8, font: bold, color: muted });

      let y = tableTop - 24;
      for (const item of items) {
        const qty = numberValue(item.quantity);
        const price = numberValue(item.unitPrice);
        if (!item.description.trim() && qty === 0 && price === 0) continue;
        const amount = qty * price;
        page.drawText(safeText(item.description, 'Item').slice(0, 46), { x: margin + 8, y, size: 10, font: regular, color: dark, maxWidth: 280 });
        page.drawText(String(qty), { x: 350, y, size: 10, font: regular, color: dark });
        page.drawText(price.toFixed(2), { x: 402, y, size: 10, font: regular, color: dark });
        page.drawText(amount.toFixed(2), { x: 476, y, size: 10, font: regular, color: dark });
        page.drawLine({ start: { x: margin, y: y - 10 }, end: { x: 547, y: y - 10 }, thickness: 0.5, color: line });
        y -= 34;
      }

      const totalsY = Math.min(y - 12, 360);
      page.drawText('Subtotal', { x: 390, y: totalsY, size: 10, font: regular, color: muted });
      page.drawText(`${subtotal.toFixed(2)} ${currency}`, { x: 468, y: totalsY, size: 10, font: bold, color: dark });
      page.drawText(`Tax (${taxRate.toFixed(2)}%)`, { x: 390, y: totalsY - 22, size: 10, font: regular, color: muted });
      page.drawText(`${taxAmount.toFixed(2)} ${currency}`, { x: 468, y: totalsY - 22, size: 10, font: bold, color: dark });
      page.drawRectangle({ x: 382, y: totalsY - 63, width: 165, height: 30, color: violet });
      page.drawText('TOTAL', { x: 394, y: totalsY - 52, size: 10, font: bold, color: rgb(1, 1, 1) });
      page.drawText(`${total.toFixed(2)} ${currency}`, { x: 458, y: totalsY - 52, size: 10, font: bold, color: rgb(1, 1, 1) });

      page.drawText('NOTES', { x: margin, y: 126, size: 8, font: bold, color: muted });
      page.drawText(safeText(notes, 'Thank you for your business.').slice(0, 180), { x: margin, y: 106, size: 9.5, font: regular, color: muted, maxWidth: 420, lineHeight: 13 });
      page.drawText('Created with Tayar Tools', { x: margin, y: 42, size: 8, font: regular, color: muted });

      pdf.setProducer('Tayar Invoice Generator Mobile');
      const bytes = await pdf.save({ useObjectStreams: true, addDefaultPage: false });
      const output = new File(Paths.cache, `${Date.now()}-${safeText(invoiceNumber, 'invoice').replace(/[^a-z0-9_-]/gi, '-')}.pdf`);
      output.create();
      output.write(bytes);
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(output.uri, { mimeType: 'application/pdf', dialogTitle: 'Save or share invoice', UTI: 'com.adobe.pdf' });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create this invoice.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.summaryCard}>
        <View><Text style={styles.eyebrow}>INVOICE TOTAL</Text><Text style={styles.total}>{total.toFixed(2)} {currency}</Text></View>
        <MaterialCommunityIcons name="receipt-text-outline" size={31} color="#C4B5FD" />
      </View>

      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}><Text style={styles.label}>Invoice no.</Text><TextInput value={invoiceNumber} onChangeText={setInvoiceNumber} style={styles.input} placeholderTextColor={colors.muted} /></View>
        <View style={{ flex: 1 }}><Text style={styles.label}>Date</Text><TextInput value={date} onChangeText={setDate} style={styles.input} placeholderTextColor={colors.muted} /></View>
      </View>
      <Text style={styles.label}>From</Text><TextInput value={seller} onChangeText={setSeller} style={styles.input} placeholder="Company or your name" placeholderTextColor={colors.muted} />
      <Text style={styles.label}>Customer</Text><TextInput value={customer} onChangeText={setCustomer} style={styles.input} placeholder="Customer name" placeholderTextColor={colors.muted} />

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Items</Text><Pressable onPress={addItem} disabled={items.length >= 8} style={styles.addButton}><MaterialCommunityIcons name="plus" size={17} color="#DDD6FE" /><Text style={styles.addText}>Add</Text></Pressable></View>
      {items.map((item, index) => (
        <View key={item.id} style={styles.itemCard}>
          <View style={styles.itemTop}><Text style={styles.itemNumber}>ITEM {index + 1}</Text>{items.length > 1 ? <Pressable onPress={() => removeItem(item.id)}><MaterialCommunityIcons name="trash-can-outline" size={19} color={colors.danger} /></Pressable> : null}</View>
          <TextInput value={item.description} onChangeText={(value) => updateItem(item.id, 'description', value)} placeholder="Description" placeholderTextColor={colors.muted} style={styles.input} />
          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}><Text style={styles.miniLabel}>Quantity</Text><TextInput value={item.quantity} onChangeText={(value) => updateItem(item.id, 'quantity', value)} keyboardType="decimal-pad" style={styles.input} /></View>
            <View style={{ flex: 1 }}><Text style={styles.miniLabel}>Unit price</Text><TextInput value={item.unitPrice} onChangeText={(value) => updateItem(item.id, 'unitPrice', value)} keyboardType="decimal-pad" style={styles.input} /></View>
          </View>
        </View>
      ))}

      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}><Text style={styles.label}>Tax %</Text><TextInput value={tax} onChangeText={setTax} keyboardType="decimal-pad" style={styles.input} /></View>
        <View style={{ flex: 1 }}><Text style={styles.label}>Currency</Text><TextInput value={currency} onChangeText={setCurrency} autoCapitalize="characters" style={styles.input} /></View>
      </View>
      <Text style={styles.label}>Notes</Text><TextInput value={notes} onChangeText={setNotes} multiline textAlignVertical="top" style={styles.notes} placeholderTextColor={colors.muted} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={busy} onPress={() => void generate()} style={({ pressed }) => [styles.generateButton, pressed && !busy && { opacity: 0.86 }, busy && styles.disabled]}>
        {busy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcons name="file-pdf-box" size={21} color={colors.white} />}
        <Text style={styles.generateText}>{busy ? 'Creating PDF…' : 'Create & Save Invoice'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingTop: 10 },
  summaryCard: { minHeight: 90, borderRadius: radius.lg, borderWidth: 1, borderColor: '#3C3158', backgroundColor: '#151120', padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: '#C4B5FD', fontSize: 9.5, fontWeight: '900', letterSpacing: 1.3 },
  total: { color: colors.text, fontSize: 23, fontWeight: '900', marginTop: 4 },
  twoCol: { flexDirection: 'row', gap: 10 },
  label: { color: colors.text, fontSize: 12.5, fontWeight: '800', marginTop: 14, marginBottom: 7 },
  miniLabel: { color: colors.muted, fontSize: 10.5, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, paddingHorizontal: 13, fontSize: 14 },
  sectionHeader: { marginTop: 18, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  addButton: { minHeight: 38, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.violetSoft, borderWidth: 1, borderColor: '#4C3B70', flexDirection: 'row', alignItems: 'center', gap: 5 },
  addText: { color: '#DDD6FE', fontSize: 11.5, fontWeight: '900' },
  itemCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelSoft, padding: 12, marginBottom: 10 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemNumber: { color: colors.muted, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.1 },
  notes: { minHeight: 90, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, padding: 13, fontSize: 13.5, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  generateButton: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.violet, marginTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  generateText: { color: colors.white, fontSize: 14.5, fontWeight: '900' },
  disabled: { opacity: 0.5 },
});
