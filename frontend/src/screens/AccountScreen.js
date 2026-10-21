import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark } from '../components/BrandMark';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const options = [
  { icon: 'receipt-outline', title: 'My orders', subtitle: 'Track your purchases', route: 'Orders' },
  { icon: 'location-outline', title: 'Delivery locations', subtitle: 'Choose from available delivery areas', route: null },
];

export function AccountScreen({ navigation }) {
  const { token, customer, loading, signOut } = useAuth();
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.blue} /></View>;

  const openProtected = (screen) => {
    if (!token) {
      navigation.getParent()?.navigate('Login', { loginFirst: true, returnTo: screen });
      return;
    }
    if (screen) navigation.getParent()?.navigate(screen);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.top}>
        <BrandMark />
        <Text style={styles.kicker}>YOUR SPACE</Text>
        <Text style={styles.title}>{token ? `Hello, ${customer?.name || 'there'}` : 'Account'}</Text>
        <Text style={styles.subtitle}>
          {token ? customer?.email : 'Login to view your account and orders. Guest checkout is also available.'}
        </Text>
        {token ? (
          <Pressable style={styles.loginButton} onPress={signOut}>
            <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
            <Text style={styles.loginText}>Sign out</Text>
          </Pressable>
        ) : (
          <View style={styles.authActions}>
            <Pressable style={styles.loginButton} onPress={() => navigation.getParent()?.navigate('Login')}>
              <Ionicons name="person-outline" size={18} color="#FFFFFF" />
              <Text style={styles.loginText}>Login</Text>
            </Pressable>
            <Pressable style={styles.registerButton} onPress={() => navigation.getParent()?.navigate('Register')}>
              <Text style={styles.registerText}>Create account</Text>
            </Pressable>
          </View>
        )}
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Quick links</Text>
        {options.map((option) => (
          <Pressable key={option.title} onPress={() => openProtected(option.route)} style={styles.row}>
            <View style={styles.rowIcon}><Ionicons name={option.icon} size={20} color={colors.blue} /></View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{option.title}</Text>
              <Text style={styles.rowSubtitle}>{option.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.muted} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  top: { backgroundColor: colors.ink, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  kicker: { color: colors.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 1.6, marginTop: 27 },
  title: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', marginTop: 5 },
  subtitle: { color: '#AAB9CC', fontSize: 12, lineHeight: 18, marginTop: 5, maxWidth: 310 },
  loginButton: { marginTop: 16, minHeight: 45, borderRadius: 14, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 },
  loginText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  authActions: { flexDirection: 'row', gap: 9 },
  registerButton: { marginTop: 16, minHeight: 45, borderRadius: 14, borderWidth: 1, borderColor: '#49617D', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
  registerText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  content: { padding: 18, gap: 10 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: 3 },
  row: { minHeight: 67, paddingHorizontal: 12, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.blueLight, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  rowSubtitle: { color: colors.muted, fontSize: 10 },
});
