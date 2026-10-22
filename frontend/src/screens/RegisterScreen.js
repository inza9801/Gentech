import styles from '../styles/RegisterScreenStyles';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text } from 'react-native';
import { FormField } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { registerCustomer } from '../services/commerceService';
import { colors } from '../theme/colors';

export function RegisterScreen({ navigation, route }) {
  const { signIn } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const update = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await registerCustomer({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      await signIn(form.email.trim(), form.password);
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
      <Text style={styles.eyebrow}>JOIN GEN TECH</Text>
      <Text style={styles.title}>Create account</Text>
      <FormField label="Full name" value={form.name} onChangeText={update('name')} autoCapitalize="words" />
      <FormField label="Phone" value={form.phone} onChangeText={update('phone')} keyboardType="phone-pad" />
      <FormField label="Email" value={form.email} onChangeText={update('email')} keyboardType="email-address" autoCapitalize="none" />
      <FormField label="Password (at least 8 characters)" value={form.password} onChangeText={update('password')} secureTextEntry />
      <FormField label="Re-enter password" value={form.confirmPassword} onChangeText={update('confirmPassword')} secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={busy} onPress={submit} style={[styles.primary, busy && styles.muted]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Register</Text>}
      </Pressable>
    </ScrollView>
  );
}


