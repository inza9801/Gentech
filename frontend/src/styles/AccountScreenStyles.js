import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  top: { backgroundColor: colors.ink, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  kicker: { color: colors.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 1.6, marginTop: 27 },
  title: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', marginTop: 5 },
  subtitle: { color: '#AAB9CC', fontSize: 12, lineHeight: 18, marginTop: 5, maxWidth: 310 },
  loginButton: { marginTop: 16, minHeight: 45, borderRadius: 14, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 },
  loginText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  authActions: { flexDirection: 'row', gap: 9 },
  registerButton: { marginTop: 16, minHeight: 45, borderRadius: 14, borderWidth: 1, borderColor: '#49617D', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
  registerText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  content: { padding: 18, gap: 10 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: 3 },
  row: { minHeight: 67, paddingHorizontal: 12, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.blueLight, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  rowSubtitle: { color: colors.muted, fontSize: 10 },
});

export default styles;
