import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';

export function FormField({ label, ...inputProps }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        style={[styles.input, inputProps.multiline && styles.multiline, inputProps.style]}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

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
