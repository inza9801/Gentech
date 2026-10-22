import styles from '../styles/FormFieldStyles';
import { Text, TextInput, View } from 'react-native';
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


