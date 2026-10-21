import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export function LoadingState({ label = 'Loading products...' }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.blue} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <View style={styles.errorCard}>
      <View style={styles.errorIcon}>
        <Ionicons name="cloud-offline-outline" size={21} color={colors.red} />
      </View>
      <Text style={styles.errorTitle}>Couldn’t load this section</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Text onPress={onRetry} style={styles.retry}>
          Try again
        </Text>
      ) : null}
    </View>
  );
}

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
