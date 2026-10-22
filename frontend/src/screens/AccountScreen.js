import styles from '../styles/AccountScreenStyles';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark } from '../components/BrandMark';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const options = [
  { icon: 'receipt-outline', title: 'My orders', subtitle: 'Track your purchases', route: 'Orders' },
  { icon: 'person-circle-outline', title: 'Edit profile', subtitle: 'Update your contact details', route: 'EditProfile' },
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
          <View style={styles.authActions}>
            {customer?.role === 'admin' ? (
              <Pressable style={styles.loginButton} onPress={() => navigation.getParent()?.navigate('AdminConsole')}>
                <Ionicons name="settings-outline" size={18} color="#FFFFFF" />
                <Text style={styles.loginText}>Admin console</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.loginButton} onPress={signOut}>
            <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
            <Text style={styles.loginText}>Sign out</Text>
            </Pressable>
          </View>
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


