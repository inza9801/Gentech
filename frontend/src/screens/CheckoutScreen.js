import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FormField } from '../components/FormField';
import { SelectField } from '../components/SelectField';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { getAreas, getDistricts, placeOrder } from '../services/commerceService';
import { colors } from '../theme/colors';
import { formatPrice } from '../utils/product';

export function CheckoutScreen({ navigation, route }) {
  const { token, customer } = useAuth();
  const { items, clearCart } = useCart();
  const [districts, setDistricts] = useState([]);
  const [areas, setAreas] = useState([]);
  const [form, setForm] = useState({
    name: customer?.name || '',
    phone: customer?.phone || '',
    district: '',
    area: '',
    notes: '',
    paymentType: 'cod',
  });
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.product.finalPrice ?? item.product.price) * item.quantity, 0),
    [items],
  );
  const total = Math.max(0, subtotal - Number(route.params?.couponDiscount || 0));
  const update = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    let active = true;
    getDistricts()
      .then((result) => { if (active) setDistricts(result); })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoadingLocations(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!form.district) {
      setAreas([]);
      return undefined;
    }
    let active = true;
    getAreas(form.district)
      .then((result) => { if (active) setAreas(result); })
      .catch((reason) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [form.district]);

  useEffect(() => {
    if (customer) {
      setForm((current) => ({
        ...current,
        name: current.name || customer.name || '',
        phone: current.phone || customer.phone || '',
      }));
    }
  }, [customer]);

  const submit = async () => {
    if (!items.length) {
      setError('Your cart is empty.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const order = await placeOrder({
        ...form,
        couponCode: route.params?.couponCode || null,
        items: items.map(({ product, quantity }) => ({
          categorySlug: product.category.slug,
          productId: product.id,
          quantity,
        })),
      }, token);
      await clearCart();
      Alert.alert(
        'Order placed',
        `Order ${order.orderNumber}\nTotal: ${formatPrice(order.total)}${order.mobilePayment ? `\n${order.mobilePayment.message}` : ''}`,
        [{ text: 'Continue shopping', onPress: () => navigation.navigate('MainTabs', { screen: 'Home' }) }],
      );
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };

  if (!items.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>Your cart is empty</Text>
        <Pressable onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}><Text style={styles.link}>Browse products</Text></Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.note}><Text style={styles.noteText}>{token ? `Ordering as ${customer?.name || 'customer'}` : 'Guest checkout is available; no account is required.'}</Text></View>
      <FormField label="Name" value={form.name} onChangeText={update('name')} autoCapitalize="words" />
      <FormField label="Phone" value={form.phone} onChangeText={update('phone')} keyboardType="phone-pad" />
      {loadingLocations ? <ActivityIndicator color={colors.blue} /> : (
        <>
          <SelectField label="District" value={form.district} options={districts} onSelect={(district) => setForm((current) => ({ ...current, district, area: '' }))} />
          <SelectField label="Area" value={form.area} options={areas} disabled={!form.district} onSelect={update('area')} />
        </>
      )}
      <Text style={styles.groupLabel}>Payment type</Text>
      <View style={styles.paymentRow}>
        {[['cod', 'Cash on delivery'], ['mobile', 'Mobile banking (bKash demo)']].map(([value, label]) => (
          <Pressable key={value} onPress={() => update('paymentType')(value)} style={[styles.paymentOption, form.paymentType === value && styles.paymentSelected]}>
            <View style={[styles.radio, form.paymentType === value && styles.radioSelected]} />
            <Text style={styles.paymentText}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {form.paymentType === 'mobile' ? (
        <View style={styles.note}><Text style={styles.noteText}>This is a payment simulation only. No bKash transfer will occur.</Text></View>
      ) : null}
      <FormField label="Delivery notes (optional)" value={form.notes} onChangeText={update('notes')} multiline placeholder="Landmark or delivery instructions" />
      <View style={styles.totalCard}>
        <View style={styles.totalRow}><Text style={styles.groupLabel}>Subtotal</Text><Text style={styles.total}>{formatPrice(subtotal)}</Text></View>
        {route.params?.couponCode ? <View style={styles.totalRow}><Text style={styles.coupon}>Coupon ({route.params.couponCode})</Text><Text style={styles.coupon}>− {formatPrice(route.params.couponDiscount || 0)}</Text></View> : null}
        <View style={styles.totalRow}><Text style={styles.groupLabel}>Total</Text><Text style={styles.total}>{formatPrice(total)}</Text></View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={busy || loadingLocations || !form.name || !form.phone || !form.district || !form.area} onPress={submit} style={[styles.primary, (busy || loadingLocations || !form.name || !form.phone || !form.district || !form.area) && styles.disabled]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Place order</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 35, gap: 15, backgroundColor: colors.background },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  link: { color: colors.blue, fontSize: 13, fontWeight: '800' },
  note: { backgroundColor: colors.blueLight, borderRadius: 13, padding: 12 },
  noteText: { color: '#315A84', fontSize: 11, lineHeight: 16 },
  groupLabel: { color: colors.text, fontSize: 12, fontWeight: '900' },
  paymentRow: { gap: 9 },
  paymentOption: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 13 },
  paymentSelected: { borderColor: colors.blue },
  radio: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: colors.muted },
  radioSelected: { borderWidth: 5, borderColor: colors.blue },
  paymentText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, padding: 15, borderRadius: 14 },
  totalCard: { backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 12 },
  total: { color: colors.text, fontSize: 18, fontWeight: '900' },
  coupon: { color: colors.green, fontWeight: '800', fontSize: 12 },
  error: { color: colors.red, fontSize: 12 },
  primary: { minHeight: 50, borderRadius: 14, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
