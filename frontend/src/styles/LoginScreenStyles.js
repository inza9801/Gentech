import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 22, gap: 16, backgroundColor: colors.background, justifyContent: 'center' },
  eyebrow: { color: colors.blue, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: colors.text, fontSize: 25, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  primary: { minHeight: 49, borderRadius: 14, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  muted: { opacity: 0.6 },
  error: { color: colors.red, fontSize: 12 },
  linkRow: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  link: { color: colors.blue, fontSize: 12, fontWeight: '900' },
});

export default styles;
