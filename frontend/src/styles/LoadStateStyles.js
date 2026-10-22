import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const styles = StyleSheet.create({
  wrap: {
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  text: { color: colors.muted, fontSize: 12 },
  errorCard: {
    padding: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    alignItems: 'flex-start',
  },
  errorIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#FFF0EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 10 },
  message: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  retry: { color: colors.blue, fontSize: 12, fontWeight: '800', marginTop: 10 },
});

export default styles;
