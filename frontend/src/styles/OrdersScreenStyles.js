import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.background },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 15, gap: 7 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 14, fontWeight: '900' },
  status: { color: colors.green, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  hint: { color: colors.muted, fontSize: 11 },
  total: { color: colors.blue, fontSize: 15, fontWeight: '900' },
  error: { color: colors.red, fontSize: 12 },
});

export default styles;
