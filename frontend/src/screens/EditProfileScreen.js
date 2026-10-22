import styles from '../styles/EditProfileScreenStyles';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text } from 'react-native';
import { FormField } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { updateMyProfile } from '../services/commerceService';
import { colors } from '../theme/colors';

export function EditProfileScreen({ navigation }) {
  const { token, customer, setCustomer } = useAuth();
  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateMyProfile({ name: name.trim(), phone: phone.trim() }, token);
      setCustomer(updated);
      setSaved(true);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>ACCOUNT DETAILS</Text>
      <Text style={styles.title}>Edit your profile</Text>
      <Text style={styles.subtitle}>Keep your contact information up to date for order support.</Text>
      <FormField label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
      <FormField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <FormField label="Email" value={customer?.email || ''} editable={false} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saved ? <Text style={styles.success}>Profile changes saved.</Text> : null}
      <Pressable disabled={busy || !name.trim() || !phone.trim()} onPress={submit} style={[styles.button, (busy || !name.trim() || !phone.trim()) && styles.disabled]}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Save changes</Text>}
      </Pressable>
      <Pressable onPress={() => navigation.goBack()} style={styles.cancel}>
        <Text style={styles.cancelText}>Back to account</Text>
      </Pressable>
    </ScrollView>
  );
}


