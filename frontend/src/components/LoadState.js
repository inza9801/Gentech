import styles from '../styles/LoadStateStyles';
import { ActivityIndicator, Text, View } from 'react-native';
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


