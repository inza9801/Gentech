import styles from '../styles/PolicyLibraryScreenStyles';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { POLICY_MANUALS, getPolicyManualUrl } from '../services/policyService';
import { colors } from '../theme/colors';

export function PolicyLibraryScreen() {
  const [openingId, setOpeningId] = useState(null);

  const openManual = async (policyId) => {
    const url = getPolicyManualUrl(policyId);
    if (!url) return;
    setOpeningId(policyId);
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Unable to open manual', error.message);
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.intro}>
        <View style={styles.introIcon}>
          <Ionicons name="document-text-outline" size={24} color={colors.blue} />
        </View>
        <Text style={styles.title}>Policies and manuals</Text>
        <Text style={styles.subtitle}>
          Read Gentech’s published policy PDFs. Chat citations open the relevant
          manual page directly.
        </Text>
      </View>
      {POLICY_MANUALS.map((policy) => (
        <Pressable
          key={policy.id}
          accessibilityRole="button"
          accessibilityLabel={`Read ${policy.title}`}
          onPress={() => { void openManual(policy.id); }}
          style={styles.manual}
        >
          <View style={styles.pdfIcon}>
            <Ionicons name="document-text" size={21} color={colors.blue} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.manualTitle}>{policy.title}</Text>
            <Text style={styles.description}>{policy.description}</Text>
            <Text style={styles.readLabel}>Read PDF manual</Text>
          </View>
          <Ionicons
            name={openingId === policy.id ? 'hourglass-outline' : 'open-outline'}
            size={19}
            color={colors.blue}
          />
        </Pressable>
      ))}
    </ScrollView>
  );
}
