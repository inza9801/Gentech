import styles from '../styles/CheckoutScreenStyles';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { FormField } from '../components/FormField';
import { SelectField } from '../components/SelectField';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { getAreas, getDeliveryQuote, getDistricts, placeOrder } from '../services/commerceService';
import { colors } from '../theme/colors';
import { formatPrice } from '../utils/product';

export function CheckoutScreen({ navigation, route }) {
  const { token, customer, loading: authLoading } = useAuth();
  const { items, clearCart } = useCart();
  const [districts, setDistricts] = useState([]);
  const [areas, setAreas] = useState([]);
  const [deliveryQuoteState, setDeliveryQuoteState] = useState(null);
  const [form, setForm] = useState({
    name: customer?.name || '',
    phone: customer?.phone || '',
    district: '',
    area: '',
    notes: '',
    paymentType: '',
    paymentPhone: customer?.phone || '',
  });
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.product.finalPrice ?? item.product.price) * item.quantity, 0),
    [items],
  );
  const orderTotalAfterDiscounts = Math.max(
    0,
    subtotal - Number(route.params?.couponDiscount || 0),
  );
  const quoteKey = JSON.stringify([
    form.district,
    form.area,
    orderTotalAfterDiscounts,
  ]);
  const quoteStateIsCurrent = deliveryQuoteState?.key === quoteKey;
  const deliveryQuote = quoteStateIsCurrent ? deliveryQuoteState.quote : null;
  const quoteError = quoteStateIsCurrent ? deliveryQuoteState.error : null;
  const loadingQuote = Boolean(
    form.district && form.area && !quoteStateIsCurrent,
  );
  const total = orderTotalAfterDiscounts + (deliveryQuote?.deliveryFee || 0);
  const update = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!authLoading && !token) {
      navigation.replace('Login', {
        loginFirst: true,
        returnTo: 'Checkout',
        returnParams: route.params,
      });
    }
  }, [authLoading, navigation, route.params, token]);

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
    if (!form.district || !form.area) return undefined;
    let active = true;
    getDeliveryQuote(form.district, form.area, orderTotalAfterDiscounts)
      .then((quote) => {
        if (active) {
          setDeliveryQuoteState({ key: quoteKey, quote, error: null });
        }
      })
      .catch((reason) => {
        if (active) {
          setDeliveryQuoteState({
            key: quoteKey,
            quote: null,
            error: reason.message,
          });
        }
      });
    return () => { active = false; };
  }, [form.district, form.area, orderTotalAfterDiscounts, quoteKey]);

  useEffect(() => {
    if (customer) {
      setForm((current) => ({
        ...current,
        name: current.name || customer.name || '',
        phone: current.phone || customer.phone || '',
        paymentPhone: current.paymentPhone || customer.phone || '',
      }));
    }
  }, [customer]);

  const placeCurrentOrder = async () => {
    setBusy(true);
    setError(null);
    try {
      const latestQuote = await getDeliveryQuote(
        form.district,
        form.area,
        orderTotalAfterDiscounts,
      );
      setDeliveryQuoteState({
        key: quoteKey,
        quote: latestQuote,
        error: null,
      });
      if (
        latestQuote.zone !== deliveryQuote?.zone
        || latestQuote.deliveryFee !== deliveryQuote?.deliveryFee
      ) {
        setError('The delivery fee was updated. Review the new total and place your order again.');
        return;
      }

      const order = await placeOrder({
        ...form,
        paymentPhone: form.paymentType === 'mobile' ? form.paymentPhone.trim() : null,
        couponCode: route.params?.couponCode || null,
        items: items.map(({ product, quantity }) => ({
          categorySlug: product.category.slug,
          productId: product.id,
          quantity,
        })),
      }, token);
      await clearCart();
      const paymentMessage = order.mobilePayment
        ? `\n${order.mobilePayment.message}\nTransaction: ${order.mobilePayment.transactionId}`
        : '';
      Alert.alert(
        'Order placed',
        `Order ${order.orderNumber}\nTotal: ${formatPrice(order.total)}${paymentMessage}`,
        [{ text: 'Continue shopping', onPress: () => navigation.navigate('MainTabs', { screen: 'Home' }) }],
      );
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!token) {
      navigation.replace('Login', {
        loginFirst: true,
        returnTo: 'Checkout',
        returnParams: route.params,
      });
      return;
    }
    if (!items.length) {
      setError('Your cart is empty.');
      return;
    }
    if (!form.name.trim() || !form.phone.trim() || !form.district || !form.area || !form.paymentType || !deliveryQuote) {
      setError('Complete all required checkout fields before placing your order.');
      return;
    }
    if (form.paymentType === 'cod' && orderTotalAfterDiscounts > 50000) {
      setError('Cash on delivery is available up to BDT 50,000. Higher-value orders require a 20% advance or full online payment under the policy.');
      return;
    }
    if (form.paymentType === 'mobile' && !form.paymentPhone.trim()) {
      setError('Enter the bKash demo number to simulate payment.');
      return;
    }
    if (form.paymentType === 'mobile') {
      Alert.alert(
        'bKash demo simulation',
        `Simulate a successful payment of ${formatPrice(total)} from ${form.paymentPhone.trim()}? This demo does not contact bKash or move real money.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Simulate payment', onPress: () => { void placeCurrentOrder(); } },
        ],
      );
      return;
    }
    void placeCurrentOrder();
  };

  if (!items.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>Your cart is empty</Text>
        <Pressable onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}><Text style={styles.link}>Browse products</Text></Pressable>
      </View>
    );
  }
  if (authLoading || !token) {
    return (
      <View style={styles.empty}>
        <ActivityIndicator color={colors.blue} />
        <Text style={styles.noteText}>Login is required to continue checkout.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.note}><Text style={styles.noteText}>Ordering as {customer?.name || 'customer'}. Fields marked required must be completed.</Text></View>
      <FormField label="Name *" value={form.name} onChangeText={update('name')} autoCapitalize="words" />
      <FormField label="Phone *" value={form.phone} onChangeText={update('phone')} keyboardType="phone-pad" />
      {loadingLocations ? <ActivityIndicator color={colors.blue} /> : (
        <>
          <SelectField label="District *" value={form.district} options={districts} onSelect={(district) => setForm((current) => ({ ...current, district, area: '' }))} />
          <SelectField label="Area *" value={form.area} options={areas} disabled={!form.district} onSelect={update('area')} />
        </>
      )}
      <Text style={styles.groupLabel}>Payment type *</Text>
      <View style={styles.paymentRow}>
        {[['cod', 'Cash on delivery'], ['mobile', 'Mobile banking (bKash demo)']].map(([value, label]) => (
          <Pressable key={value} onPress={() => update('paymentType')(value)} style={[styles.paymentOption, form.paymentType === value && styles.paymentSelected]}>
            <View style={[styles.radio, form.paymentType === value && styles.radioSelected]} />
            <Text style={styles.paymentText}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {form.paymentType === 'mobile' ? (
        <>
          <FormField
            label="bKash demo number *"
            value={form.paymentPhone}
            onChangeText={update('paymentPhone')}
            keyboardType="phone-pad"
            placeholder="Enter a demo number"
          />
          <View style={styles.note}><Text style={styles.noteText}>Demo only: no bKash account is contacted and no money moves. You’ll confirm the simulation before the order is submitted.</Text></View>
        </>
      ) : null}
      <FormField label="Delivery notes (optional)" value={form.notes} onChangeText={update('notes')} multiline placeholder="Landmark or delivery instructions" />
      <View style={styles.totalCard}>
        <View style={styles.totalRow}><Text style={styles.groupLabel}>Subtotal</Text><Text style={styles.total}>{formatPrice(subtotal)}</Text></View>
        {route.params?.couponCode ? <View style={styles.totalRow}><Text style={styles.coupon}>Coupon ({route.params.couponCode})</Text><Text style={styles.coupon}>− {formatPrice(route.params.couponDiscount || 0)}</Text></View> : null}
        <View style={styles.totalRow}>
          <Text style={styles.groupLabel}>
            Delivery{deliveryQuote?.zoneLabel ? ` (${deliveryQuote.zoneLabel})` : ''}
          </Text>
          {loadingQuote ? (
            <ActivityIndicator color={colors.blue} />
          ) : (
            <Text style={styles.total}>
              {deliveryQuote ? formatPrice(deliveryQuote.deliveryFee) : 'Select an area'}
            </Text>
          )}
        </View>
        {deliveryQuote ? (
          <Text style={styles.deliveryHint}>
            Delivery fee is fixed for the selected zone.
          </Text>
        ) : null}
        <View style={styles.totalRow}><Text style={styles.groupLabel}>Total</Text><Text style={styles.total}>{formatPrice(total)}</Text></View>
      </View>
      {error || quoteError ? <Text style={styles.error}>{error || quoteError}</Text> : null}
      <Pressable disabled={busy || loadingLocations || loadingQuote || !deliveryQuote || !form.name.trim() || !form.phone.trim() || !form.district || !form.area || !form.paymentType || (form.paymentType === 'mobile' && !form.paymentPhone.trim())} onPress={submit} style={[styles.primary, (busy || loadingLocations || loadingQuote || !deliveryQuote || !form.name.trim() || !form.phone.trim() || !form.district || !form.area || !form.paymentType || (form.paymentType === 'mobile' && !form.paymentPhone.trim())) && styles.disabled]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Place order</Text>}
      </Pressable>
    </ScrollView>
  );
}
