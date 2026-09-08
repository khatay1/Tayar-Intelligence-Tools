import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  clearReportableAiOutput,
  getReportableAiOutput,
  subscribeAiOutput,
  type ReportableAiOutput,
} from '@/lib/ai-output-report';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

const MAX_REPORT_EXCERPT = 2_000;

export default function AiContentReportFab() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const pathnameRef = useRef(pathname);
  const [snapshot, setSnapshot] = useState<ReportableAiOutput | null>(() => getReportableAiOutput());
  const [originPath, setOriginPath] = useState(() => getReportableAiOutput() ? pathname : '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => subscribeAiOutput((next) => {
    setSnapshot(next);
    setOriginPath(next ? pathnameRef.current : '');
  }), []);

  const visible = Boolean(snapshot && originPath === pathname && pathname.startsWith('/tools/'));

  async function submitReport(target: ReportableAiOutput) {
    if (busy) return;
    setBusy(true);
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !data.user) throw authError || new Error('Sign in to report AI output.');

      const excerpt = target.output.slice(0, MAX_REPORT_EXCERPT);
      const body = [
        'Submitted from Tayar Tools mobile.',
        `Tool: ${target.tool}`,
        `Generated at: ${new Date(target.createdAt).toISOString()}`,
        '',
        'AI output excerpt:',
        excerpt,
      ].join('\n');

      const { error } = await supabase.from('support_tickets').insert({
        user_id: data.user.id,
        subject: `AI output report — ${target.tool}`,
        body,
        type: 'ai-content-report',
        status: 'open',
        priority: 'medium',
      });
      if (error) throw error;

      clearReportableAiOutput(target.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Report sent', 'Thanks. The reported AI output was sent to Tayar support for review.');
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Could not send report', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function confirmReport() {
    if (!snapshot || busy) return;
    const target = snapshot;
    Alert.alert(
      'Report this AI output?',
      'Only a limited excerpt of the generated AI output will be sent to Tayar support. Your prompt and source document are not included.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report', style: 'destructive', onPress: () => void submitReport(target) },
      ],
    );
  }

  if (!visible) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Report AI output"
      disabled={busy}
      onPress={confirmReport}
      style={({ pressed }) => [
        styles.button,
        { bottom: insets.bottom + 18 },
        pressed && !busy && styles.pressed,
        busy && styles.busy,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <MaterialCommunityIcons name="flag-outline" size={17} color={colors.text} />
      )}
      <Text style={styles.label}>{busy ? 'Sending…' : 'Report AI'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 18,
    minHeight: 42,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    zIndex: 100,
    elevation: 8,
  },
  pressed: { opacity: 0.82 },
  busy: { opacity: 0.68 },
  label: { color: colors.text, fontSize: 12, fontWeight: '800' },
});
