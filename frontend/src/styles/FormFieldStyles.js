import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { color: colors.text, fontSize: 11, fontWeight: '800' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: colors.surface,
    paddingHorizontal: 13,
    color: colors.text,
    fontSize: 13,
  },
  multiline: { minHeight: 82, paddingTop: 12, textAlignVertical: 'top' },
});

export default styles;
