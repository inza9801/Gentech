import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export function SectionHeading({ title, subtitle, action, onAction }) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} style={styles.action}>
          <Text style={styles.actionText}>{action}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.blue} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  copy: { gap: 3 },
  title: { color: colors.text, fontSize: 19, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 11 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  actionText: { color: colors.blue, fontWeight: '800', fontSize: 12 },
});
