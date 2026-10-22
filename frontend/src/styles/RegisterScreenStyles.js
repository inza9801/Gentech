import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 22, gap: 14, backgroundColor: colors.background },
  eyebrow: { color: colors.blue, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginTop: 10 },
  title: { color: colors.text, fontSize: 25, fontWeight: '900', marginBottom: 5 },
  primary: { minHeight: 49, borderRadius: 14, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  muted: { opacity: 0.6 },
  error: { color: colors.red, fontSize: 12 },
});

export default styles;
