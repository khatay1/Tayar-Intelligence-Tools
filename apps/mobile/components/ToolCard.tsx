import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MobileTool } from '@/data/tools';
import type { ToolAccessState } from '@/lib/tool-access';
import { colors, radius } from '@/lib/theme';

function planLabel(tool: MobileTool, access?: ToolAccessState) {
  const value = String(access?.required_plan || '').toLowerCase();
  if (value === 'business') return 'Business';
  if (value === 'pro') return 'Pro';
  if (value === 'free') return 'Free';
  return tool.plan;
}

export function ToolCard({ tool, access, onPress }: { tool: MobileTool; access?: ToolAccessState; onPress: () => void }) {
  const plan = planLabel(tool, access);
  const disabled = access?.reason === 'disabled' || access?.enabled === false;
  const limitReached = access?.reason === 'limit_reached';
  const badgeLabel = disabled ? 'Off' : limitReached ? 'Limit' : plan;
  const freeStyle = badgeLabel === 'Free';

  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.card, pressed && !disabled && styles.pressed, disabled && styles.disabled]}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name={tool.icon as never} size={24} color={disabled ? colors.muted : colors.violetBright} />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.title}>{tool.name}</Text>
          <View style={[styles.badge, freeStyle ? styles.freeBadge : styles.paidBadge]}>
            <Text style={[styles.badgeText, freeStyle ? styles.freeText : styles.paidText]}>{badgeLabel}</Text>
          </View>
        </View>
        <Text numberOfLines={2} style={styles.description}>{tool.description}</Text>
      </View>
      <MaterialCommunityIcons name={disabled ? 'lock-outline' : 'chevron-right'} size={22} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  pressed: { opacity: 0.82, transform: [{ scale: 0.992 }] },
  disabled: { opacity: 0.55 },
  iconWrap: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.violetSoft },
  copy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flexShrink: 1, color: colors.text, fontSize: 16, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 5 },
  badge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  freeBadge: { backgroundColor: '#13352B' },
  paidBadge: { backgroundColor: '#36275A' },
  badgeText: { fontSize: 9.5, fontWeight: '800' },
  freeText: { color: colors.emerald },
  paidText: { color: '#C4B5FD' },
});
