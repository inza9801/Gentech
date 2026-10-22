import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, gap: 14, backgroundColor: colors.background },
  eyebrow: { color: colors.blue, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: 8 },
  title: { color: colors.text, fontSize: 25, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 5 },
  button: { minHeight: 49, borderRadius: 14, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  cancel: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: colors.blue, fontSize: 12, fontWeight: '800' },
  error: { color: colors.red, fontSize: 12 },
  success: { color: colors.green, fontSize: 12, fontWeight: '800' },
});

export default styles;
