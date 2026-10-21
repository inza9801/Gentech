import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SelectField } from '../components/SelectField';
import { ProductCard } from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { getCategories } from '../services/categoryService';
import { getOfferedProducts } from '../services/productService';
import { colors } from '../theme/colors';

export function OffersScreen({ navigation }) {
  const { addItem } = useCart();
  const { width } = useWindowDimensions();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortDiscount, setSortDiscount] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoryResult, offerResult] = await Promise.all([
        getCategories(),
        getOfferedProducts(),
      ]);
      setCategories(categoryResult);
      setProducts(offerResult);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  const filtered = useMemo(() => products
    .filter((product) => !category || product.category?.slug === category)
    .filter((product) => minPrice === '' || Number(product.finalPrice ?? product.price) >= Number(minPrice))
    .filter((product) => maxPrice === '' || Number(product.finalPrice ?? product.price) <= Number(maxPrice))
    .sort((a, b) => sortDiscount
      ? (b.discount || 0) - (a.discount || 0)
      : Number(b.finalPrice ?? b.price) - Number(a.finalPrice ?? a.price)),
  [products, category, minPrice, maxPrice, sortDiscount]);

  const cardWidth = (width - 46) / 2;
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
      {loading ? <View style={styles.center}><ActivityIndicator size="large" color={colors.blue} /></View> : error ? (
        <View style={styles.center}><Text style={styles.error}>{error}</Text><Pressable onPress={loadOffers}><Text style={styles.retry}>Try again</Text></Pressable></View>
      ) : filtered.length ? (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <ProductCard product={item} width={cardWidth} onPress={() => navigation.navigate('ProductDetails', { productId: item.id })} onAdd={() => addItem(item)} />}
        />
      ) : <View style={styles.center}><Text style={styles.title}>No offers match these filters</Text></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  intro: { backgroundColor: colors.ink, padding: 18, paddingBottom: 20 },
  introTitle: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  title: { color: colors.text, fontSize: 17, fontWeight: '900' },
  subtitle: { color: '#AAB9CC', fontSize: 11, lineHeight: 16, marginTop: 6 },
  filters: { padding: 14, gap: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  priceRow: { flexDirection: 'row', gap: 8 },
  priceInput: { flex: 1, height: 42, borderRadius: 11, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, color: colors.text },
  sortButton: { borderRadius: 11, backgroundColor: colors.blue, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortButtonText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  count: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  grid: { paddingHorizontal: 14, paddingVertical: 12, paddingBottom: 30 },
  gridRow: { gap: 10, marginBottom: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 25, gap: 10 },
  error: { color: colors.red, fontSize: 12, textAlign: 'center' },
  retry: { color: colors.blue, fontWeight: '900' },
});
