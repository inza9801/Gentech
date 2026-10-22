import styles from '../styles/CartScreenStyles';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProductImage } from '../components/ProductImage';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { colors } from '../theme/colors';
import { formatPrice } from '../utils/product';
import { validateCoupon } from '../services/commerceService';

export function CartScreen({ navigation, route }) {
  const { token } = useAuth();
  const { items, changeQuantity, removeItem } = useCart();
  const [couponCode, setCouponCode] = useState(route.params?.couponCode || '');
  const [coupon, setCoupon] = useState(null);
  const [couponError, setCouponError] = useState(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const subtotal = useMemo(() => items.reduce(
    (sum, item) =>
      sum + Number(item.product.finalPrice ?? item.product.price) * item.quantity,
    0,
  ), [items]);
  const total = Math.max(0, subtotal - (coupon?.couponDiscount || 0));

  useEffect(() => {
    if (route.params?.couponCode) {
      setCouponCode(route.params.couponCode);
    }
  }, [route.params?.couponCode]);

  const applyCoupon = async () => {
    if (!token) {
      navigation.navigate('Login', {
        loginFirst: true,
        returnTo: 'Cart',
        returnParams: { couponCode: couponCode.trim() },
      });
      return;
    }
    setCheckingCoupon(true);
    setCouponError(null);
    try {
      const result = await validateCoupon(couponCode.trim(), subtotal, token);
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
          {checkingCoupon ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.couponButtonText}>{coupon ? 'Applied' : token ? 'Apply' : 'Login'}</Text>}
        </Pressable>
      </View>
      {couponError ? <Text style={styles.couponError}>{couponError}</Text> : null}
      <Pressable
        onPress={() => {
          const returnParams = {
            couponCode: coupon?.code,
            couponDiscount: coupon?.couponDiscount || 0,
          };
          if (!token) {
            navigation.navigate('Login', {
              loginFirst: true,
              returnTo: 'Checkout',
              returnParams,
            });
            return;
          }
          navigation.navigate('Checkout', returnParams);
        }}
        style={styles.checkoutButton}
      >
        <Text style={styles.checkoutText}>
          {token ? 'Proceed to checkout' : 'Login to checkout'} · {formatPrice(total)}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
