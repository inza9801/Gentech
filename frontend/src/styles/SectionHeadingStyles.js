import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  copy: { flex: 1, minWidth: 0, gap: 3, marginRight: 10 },
  title: { color: colors.text, fontSize: 19, fontWeight: '900', flexShrink: 1 },
  subtitle: { color: colors.muted, fontSize: 11 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  actionText: { color: colors.blue, fontWeight: '800', fontSize: 12 },
});

export default styles;
