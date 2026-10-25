import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, gap: 12 },
  intro: {
    alignItems: 'center',
    padding: 20,
    marginBottom: 4,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  introIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blueLight,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 12 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  manual: {
    minHeight: 92,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pdfIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blueLight,
  },
  copy: { flex: 1, gap: 4 },
  manualTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  description: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  readLabel: { color: colors.blue, fontSize: 10, fontWeight: '800', marginTop: 2 },
});

export default styles;
