import styles from '../styles/LoginScreenStyles';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { FormField } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export function LoginScreen({ navigation, route }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      if (route.params?.returnTo) navigation.replace(route.params.returnTo, route.params.returnParams);
      else navigation.navigate('MainTabs', { screen: 'Account' });
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>WELCOME BACK</Text>
      <Text style={styles.title}>Login to GenTech</Text>
      <Text style={styles.subtitle}>{route.params?.loginFirst ? 'Login to continue with checkout, coupons, and reviews.' : 'Sign in to view your account and orders.'}</Text>
      <FormField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
      <FormField label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={busy || !email || !password} onPress={submit} style={[styles.primary, (busy || !email || !password) && styles.muted]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Login</Text>}
      </Pressable>
      <View style={styles.linkRow}>
        <Text style={styles.subtitle}>New to GenTech?</Text>
        <Pressable onPress={() => navigation.navigate('Register', route.params)}>
          <Text style={styles.link}>Create account</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
