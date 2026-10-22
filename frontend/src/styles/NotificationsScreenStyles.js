import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, gap: 12, paddingBottom: 30 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  eyebrow: { color: colors.blue, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 4 },
  headingIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blueLight },
  empty: { marginTop: 32, padding: 24, alignItems: 'center', borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.blueLight, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 16 },
  copy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  button: { minHeight: 44, borderRadius: 13, backgroundColor: colors.blue, justifyContent: 'center', paddingHorizontal: 16, marginTop: 18 },
  buttonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 14, backgroundColor: colors.surface, borderRadius: 17, borderWidth: 1, borderColor: colors.border },
  icon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.blueLight, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 12, fontWeight: '800', lineHeight: 17 },
  time: { color: colors.muted, fontSize: 10, marginTop: 7 },
  unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue, marginTop: 4 },
  note: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: 8 },
});

export default styles;
