import { Pressable, StyleSheet, Text, View } from 'react-native';
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.ink, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  kicker: { color: colors.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginTop: 27 },
  title: { color: '#FFFFFF', fontSize: 27, fontWeight: '900', marginTop: 6 },
  subtitle: { color: '#AAB9CC', fontSize: 12, lineHeight: 18, marginTop: 6, maxWidth: 295 },
  content: {
    margin: 18,
    marginTop: 22,
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: { width: 76, height: 76, borderRadius: 26, backgroundColor: colors.blueLight, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 16 },
  cardText: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 7 },
  button: { width: '100%', height: 48, marginTop: 20, borderRadius: 15, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  buttonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  availability: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 15 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  availabilityText: { color: colors.muted, fontSize: 10 },
});
