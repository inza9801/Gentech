import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProductImage } from '../components/ProductImage';
import { useCart } from '../context/CartContext';
import { colors } from '../theme/colors';
import { formatPrice } from '../utils/product';
import { validateCoupon } from '../services/commerceService';

export function CartScreen({ navigation }) {
  const { items, changeQuantity, removeItem } = useCart();
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState(null);
  const [couponError, setCouponError] = useState(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const subtotal = useMemo(() => items.reduce(
    (sum, item) =>
      sum + Number(item.product.finalPrice ?? item.product.price) * item.quantity,
    0,
  ), [items]);
  const total = Math.max(0, subtotal - (coupon?.couponDiscount || 0));

  const applyCoupon = async () => {
    setCheckingCoupon(true);
    setCouponError(null);
    try {
      const result = await validateCoupon(couponCode.trim(), subtotal);
      setCoupon(result);
      setCouponCode(result.code);
    } catch (error) {
      setCoupon(null);
      setCouponError(error.message);
    } finally {
      setCheckingCoupon(false);
    }
  };

  if (!items.length) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Ionicons name="bag-handle-outline" size={38} color={colors.blue} />
        </View>
        <Text style={styles.emptyTitle}>Your bag is waiting</Text>
        <Text style={styles.emptyHint}>
          Add a few favorites and they’ll show up here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.subtitle}>
        {items.reduce((sum, item) => sum + item.quantity, 0)} items in your bag
      </Text>
      {items.map(({ product, quantity }) => (
        <View key={product.id} style={styles.item}>
          <ProductImage product={product} size="row" />
          <View style={styles.itemCopy}>
            <Text numberOfLines={2} style={styles.name}>{product.name}</Text>
            <Text style={styles.price}>
              {formatPrice(product.finalPrice ?? product.price)}
            </Text>
            <View style={styles.quantityRow}>
              <Pressable
                onPress={() => changeQuantity(product.id, -1)}
                style={styles.quantityButton}
                accessibilityLabel="Decrease quantity"
              >
                <Ionicons name="remove" size={16} color={colors.text} />
              </Pressable>
              <Text style={styles.quantity}>{quantity}</Text>
              <Pressable
                onPress={() => changeQuantity(product.id, 1)}
                style={styles.quantityButton}
                accessibilityLabel="Increase quantity"
              >
                <Ionicons name="add" size={16} color={colors.text} />
              </Pressable>
            </View>
          </View>
          <Pressable
            onPress={() => removeItem(product.id)}
            accessibilityLabel={`Remove ${product.name}`}
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={18} color={colors.muted} />
          </Pressable>
        </View>
      ))}
      <View style={styles.totalCard}>
        <View style={styles.totals}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.total}>{formatPrice(subtotal)}</Text>
          {coupon ? (
            <>
              <Text style={styles.discountLabel}>Coupon ({coupon.code})</Text>
              <Text style={styles.discountAmount}>− {formatPrice(coupon.couponDiscount)}</Text>
            </>
          ) : null}
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.total}>{formatPrice(total)}</Text>
        </View>
      </View>
      <View style={styles.couponRow}>
        <TextInput value={couponCode} onChangeText={(value) => { setCouponCode(value); setCoupon(null); setCouponError(null); }} placeholder="Coupon code" placeholderTextColor={colors.muted} autoCapitalize="characters" style={styles.couponInput} />
        <Pressable disabled={checkingCoupon || !couponCode.trim()} onPress={applyCoupon} style={[styles.couponButton, (!couponCode.trim() || checkingCoupon) && styles.disabled]}>
          {checkingCoupon ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.couponButtonText}>{coupon ? 'Applied' : 'Apply'}</Text>}
        </Pressable>
      </View>
      {couponError ? <Text style={styles.couponError}>{couponError}</Text> : null}
      <Pressable onPress={() => navigation.navigate('Checkout', {
        couponCode: coupon?.code,
        couponDiscount: coupon?.couponDiscount || 0,
      })} style={styles.checkoutButton}>
        <Text style={styles.checkoutText}>Proceed to checkout · {formatPrice(total)}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 35, gap: 12 },
  subtitle: { color: colors.muted, fontSize: 12, marginBottom: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemCopy: { flex: 1, gap: 5 },
  name: { color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  price: { color: colors.blue, fontSize: 13, fontWeight: '900' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 2 },
  quantityButton: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: { color: colors.text, minWidth: 16, textAlign: 'center', fontSize: 12, fontWeight: '800' },
  totalCard: {
    marginTop: 5,
    padding: 16,
    borderRadius: 17,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totals: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', rowGap: 8 },
  totalLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  total: { color: colors.text, fontSize: 17, fontWeight: '900' },
  discountLabel: { color: colors.green, fontSize: 12, fontWeight: '700' },
  discountAmount: { color: colors.green, fontSize: 12, fontWeight: '900' },
  couponRow: { flexDirection: 'row', gap: 8 },
  couponInput: { flex: 1, height: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.surface, paddingHorizontal: 12, color: colors.text },
  couponButton: { minWidth: 80, borderRadius: 13, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  couponButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  couponError: { color: colors.red, fontSize: 11 },
  checkoutButton: { minHeight: 50, borderRadius: 14, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  checkoutText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  empty: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyIcon: {
    width: 86,
    height: 86,
    borderRadius: 30,
    backgroundColor: colors.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  emptyHint: { color: colors.muted, textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 7 },
});
