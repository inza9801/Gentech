import styles from '../styles/ChatScreenStyles';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark } from '../components/BrandMark';
import { colors } from '../theme/colors';

export function ChatScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <BrandMark />
        <Text style={styles.kicker}>GEN TECH SUPPORT</Text>
        <Text style={styles.title}>Let’s talk tech.</Text>
        <Text style={styles.subtitle}>
          Need help choosing parts or finding the right setup? We’re here.
        </Text>
      </View>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="chatbubbles-outline" size={38} color={colors.blue} />
        </View>
        <Text style={styles.cardTitle}>Start a conversation</Text>
        <Text style={styles.cardText}>
          Chat support will be connected here. For now, browse products and find
          answers in the product details.
        </Text>
        <Pressable style={styles.button}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFFFFF" />
          <Text style={styles.buttonText}>Chat support</Text>
        </Pressable>
        <View style={styles.availability}>
          <View style={styles.dot} />
          <Text style={styles.availabilityText}>Support team is ready to help</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}


