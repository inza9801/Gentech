import styles from '../styles/OffersScreenStyles';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SelectField } from '../components/SelectField';
import { ProductCard } from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { getCategories } from '../services/categoryService';
import { getOfferedProducts } from '../services/productService';
import { getAvailableCoupons } from '../services/commerceService';
import { colors } from '../theme/colors';
import { formatPrice } from '../utils/product';

export function OffersScreen({ navigation }) {
  const { addItem } = useCart();
  const { width } = useWindowDimensions();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [couponLoading, setCouponLoading] = useState(true);
  const [couponError, setCouponError] = useState(null);
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortDiscount, setSortDiscount] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOfferData = useCallback(
    () => Promise.all([getCategories(), getOfferedProducts()]),
    [],
  );

  useEffect(() => {
    let active = true;
    fetchOfferData()
      .then(([categoryResult, offerResult]) => {
        if (!active) return;
        setCategories(categoryResult);
        setProducts(offerResult);
      })
      .catch((reason) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchOfferData]);

  const fetchCoupons = useCallback(() => getAvailableCoupons(), []);

  useEffect(() => {
    let active = true;
    fetchCoupons()
      .then((result) => {
        if (active) setCoupons(result);
      })
      .catch((reason) => {
        if (active) setCouponError(reason.message);
      })
      .finally(() => {
        if (active) setCouponLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchCoupons]);

  const loadOffers = () => {
    setLoading(true);
    setError(null);
    fetchOfferData()
      .then(([categoryResult, offerResult]) => {
        setCategories(categoryResult);
        setProducts(offerResult);
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  };
  const loadCoupons = () => {
    setCouponLoading(true);
    setCouponError(null);
    fetchCoupons()
      .then(setCoupons)
      .catch((reason) => setCouponError(reason.message))
      .finally(() => setCouponLoading(false));
  };

  const filtered = useMemo(() => products
    .filter((product) => !category || product.category?.slug === category)
    .filter((product) => minPrice === '' || Number(product.finalPrice ?? product.price) >= Number(minPrice))
    .filter((product) => maxPrice === '' || Number(product.finalPrice ?? product.price) <= Number(maxPrice))
    .sort((a, b) => sortDiscount
      ? (b.discount || 0) - (a.discount || 0)
      : Number(b.finalPrice ?? b.price) - Number(a.finalPrice ?? a.price)),
  [products, category, minPrice, maxPrice, sortDiscount]);

  const cardWidth = (width - 46) / 2;
  const couponsHeader = (
    <View style={styles.couponsSection}>
      <View style={styles.couponSectionHeading}>
        <View>
          <Text style={styles.couponSectionTitle}>Available coupons</Text>
          <Text style={styles.couponSectionHint}>Choose a code to use in your cart.</Text>
        </View>
        <Ionicons name="ticket-outline" size={21} color={colors.blue} />
      </View>
      {couponLoading ? (
        <ActivityIndicator color={colors.blue} size="small" />
      ) : couponError ? (
        <Pressable onPress={loadCoupons} style={styles.couponRetry}>
          <Text style={styles.couponError}>{couponError} · Tap to retry</Text>
        </Pressable>
      ) : coupons.length ? (
        <View style={styles.couponsList}>
          {coupons.map((coupon) => (
            <View key={coupon.code} style={styles.couponCard}>
              <View style={styles.couponCopy}>
                <Text style={styles.couponCode}>{coupon.code}</Text>
                <Text style={styles.couponValue}>
                  {coupon.discountType === 'percentage'
                    ? `${coupon.discountValue}% off`
                    : `${formatPrice(coupon.discountValue)} off`}
                  {coupon.maxDiscount
                    ? ` · up to ${formatPrice(coupon.maxDiscount)}`
                    : ''}
                </Text>
                {coupon.minOrderAmount > 0 ? (
                  <Text style={styles.couponMinimum}>
                    Min. order {formatPrice(coupon.minOrderAmount)}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() =>
                  navigation.getParent()?.navigate('Cart', {
                    couponCode: coupon.code,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Use coupon ${coupon.code} in cart`}
                style={styles.couponUseButton}
              >
                <Text style={styles.couponUseText}>Use</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.noCoupons}>No active coupons right now.</Text>
      )}
    </View>
  );
  const listHeader = (
    <View>
      {couponsHeader}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.blue} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={loadOffers}>
            <Text style={styles.retry}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.intro}>
        <View style={styles.introTitle}><Ionicons name="pricetag" size={22} color={colors.blue} /><Text style={styles.title}>Offers for you</Text></View>
        <Text style={styles.subtitle}>Browse discounted products and find your next upgrade.</Text>
      </View>
      <View style={styles.filters}>
        <SelectField
          label="Category"
          value={categories.find((item) => item.slug === category)?.name || ''}
          options={['All categories', ...categories.map((item) => item.name)]}
          placeholder="All categories"
          onSelect={(name) => setCategory(name === 'All categories' ? '' : categories.find((item) => item.name === name)?.slug || '')}
        />
        <View style={styles.priceRow}>
          <TextInput value={minPrice} onChangeText={setMinPrice} keyboardType="numeric" placeholder="Min ৳" placeholderTextColor={colors.muted} style={styles.priceInput} />
          <TextInput value={maxPrice} onChangeText={setMaxPrice} keyboardType="numeric" placeholder="Max ৳" placeholderTextColor={colors.muted} style={styles.priceInput} />
          <Pressable onPress={() => setSortDiscount((value) => !value)} style={styles.sortButton}>
            <Ionicons name="swap-vertical" size={16} color="#fff" />
            <Text style={styles.sortButtonText}>{sortDiscount ? 'Discount' : 'Price'}</Text>
          </Pressable>
        </View>
        <Text style={styles.count}>{filtered.length} offers</Text>
      </View>
      <FlatList
        data={loading || error ? [] : filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          !loading && !error ? (
            <View style={styles.noOffers}>
              <Text style={styles.title}>No offers match these filters</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => <ProductCard product={item} width={cardWidth} onPress={() => navigation.navigate('ProductDetails', { productId: item.id })} onAdd={() => addItem(item)} />}
      />
    </View>
  );
}
