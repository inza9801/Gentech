import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ErrorState } from '../components/LoadState';
import { ProductCard } from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { filterCategoryProducts, getCategoryFilterOptions } from '../services/productService';
import { colors } from '../theme/colors';

const SORTS = [
  { key: 'newest', label: 'New arrivals' },
  { key: 'best', label: 'Best sellers' },
];

export function BrandProductsScreen({ route, navigation }) {
  const { slug, brand, categoryName } = route.params;
  const { addItem } = useCart();
  const { width } = useWindowDimensions();
  const [products, setProducts] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ filters: {}, minPrice: 0, maxPrice: 0 });
  const [selected, setSelected] = useState({});
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStock, setInStock] = useState(false);
  const [sort, setSort] = useState('newest');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cardWidth = (width - 18 * 2 - 10) / 2;

  const loadFilterOptions = useCallback(async () => {
    try {
      const options = await getCategoryFilterOptions(slug);
      setFilterOptions(options);
      setMinPrice(String(options.minPrice || ''));
      setMaxPrice(String(options.maxPrice || ''));
    } catch (reason) {
      setError(reason.message);
    }
  }, [slug]);

  const loadProducts = useCallback(async (filterState = selected, overrides = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await filterCategoryProducts(slug, {
        brand,
        min_price: (overrides.minPrice ?? minPrice) === '' ? undefined : Number(overrides.minPrice ?? minPrice),
        max_price: (overrides.maxPrice ?? maxPrice) === '' ? undefined : Number(overrides.maxPrice ?? maxPrice),
        in_stock: (overrides.inStock ?? inStock) ? true : undefined,
        filters: filterState,
        sort: sort === 'best' ? 'best' : 'newest',
      });
      setProducts(result);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }, [slug, brand, minPrice, maxPrice, inStock, selected, sort]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    loadProducts(selected);
  }, [slug, brand, sort]);

  const chooseFilter = (key, value) => {
    setSelected((current) => ({
      ...current,
      [key]: current[key] === value ? undefined : value,
    }));
  };

  const clearFilters = () => {
    setSelected({});
    setMinPrice('');
    setMaxPrice('');
    setInStock(false);
    loadProducts({}, { minPrice: '', maxPrice: '', inStock: false });
  };

  const visibleProducts = products;

  return (
    <View style={styles.root}>
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text style={styles.category}>{categoryName || 'Products'}</Text>
          <Text style={styles.title}>{brand}</Text>
        </View>
        <Pressable onPress={() => setDrawerOpen(true)} style={styles.filterButton}>
          <Ionicons name="options-outline" size={17} color="#FFFFFF" />
          <Text style={styles.filterButtonText}>Filter</Text>
        </Pressable>
      </View>
      <View style={styles.sortRow}>
        {SORTS.map((option) => (
          <Pressable key={option.key} onPress={() => setSort(option.key)} style={[styles.sortPill, sort === option.key && styles.sortSelected]}>
            <Text style={[styles.sortText, sort === option.key && styles.sortTextSelected]}>{option.label}</Text>
          </Pressable>
        ))}
        {!loading && !error ? <Text style={styles.count}>{visibleProducts.length} items</Text> : null}
      </View>
      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color={colors.blue} /><Text style={styles.hint}>Finding {brand} products...</Text></View>
      ) : error ? (
        <View style={styles.error}><ErrorState message={error} onRetry={loadProducts} /></View>
      ) : visibleProducts.length ? (
        <FlatList
          data={visibleProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              width={cardWidth}
              onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
              onAdd={() => addItem(item)}
            />
          )}
        />
      ) : (
        <View style={styles.loading}><Text style={styles.title}>No products found</Text><Text style={styles.hint}>Adjust your filters or try another brand.</Text></View>
      )}
      <Modal visible={drawerOpen} transparent animationType="slide" onRequestClose={() => setDrawerOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.scrim} onPress={() => setDrawerOpen(false)} />
          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <View><Text style={styles.drawerTitle}>Filter products</Text><Text style={styles.drawerSubtitle}>{categoryName} · {brand}</Text></View>
              <Pressable onPress={() => setDrawerOpen(false)}><Ionicons name="close" size={23} color={colors.text} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.filterLabel}>Price range (৳)</Text>
              <View style={styles.priceInputs}>
                <TextInput value={minPrice} onChangeText={setMinPrice} keyboardType="numeric" placeholder="Min" style={styles.priceInput} />
                <Text style={styles.priceDash}>–</Text>
                <TextInput value={maxPrice} onChangeText={setMaxPrice} keyboardType="numeric" placeholder="Max" style={styles.priceInput} />
              </View>
              <Pressable onPress={() => setInStock((value) => !value)} style={styles.stockOption}>
                <Ionicons name={inStock ? 'checkbox' : 'square-outline'} size={19} color={inStock ? colors.blue : colors.muted} />
                <Text style={styles.filterValue}>In stock only</Text>
              </Pressable>
              {Object.entries(filterOptions.filters || {}).map(([key, values]) => values?.length ? (
                <View key={key} style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>{formatLabel(key)}</Text>
                  <View style={styles.chips}>
                    {values.map((value) => {
                      const active = selected[key] === value;
                      return (
                        <Pressable key={String(value)} onPress={() => chooseFilter(key, value)} style={[styles.chip, active && styles.chipActive]}>
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{String(value)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null)}
            </ScrollView>
            <View style={styles.drawerActions}>
              <Pressable onPress={clearFilters} style={styles.clearButton}><Text style={styles.clearText}>Clear</Text></Pressable>
              <Pressable onPress={() => { setDrawerOpen(false); loadProducts(); }} style={styles.applyButton}><Text style={styles.applyText}>Show products</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatLabel(value) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 },
  titleCopy: { flex: 1 },
  category: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  title: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 3 },
  filterButton: { height: 40, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterButtonText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  sortRow: { paddingHorizontal: 18, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sortPill: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#E8EDF4' },
  sortSelected: { backgroundColor: colors.blueLight },
  sortText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  sortTextSelected: { color: colors.blue },
  count: { color: colors.blue, fontSize: 10, fontWeight: '800', marginLeft: 'auto' },
  grid: { paddingHorizontal: 14, paddingBottom: 30 },
  row: { gap: 10, marginBottom: 10 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  hint: { color: colors.muted, fontSize: 12 },
  error: { padding: 18 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0008' },
  drawer: { height: '88%', backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 24 },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16 },
  drawerTitle: { color: colors.text, fontSize: 19, fontWeight: '900' },
  drawerSubtitle: { color: colors.muted, fontSize: 11, marginTop: 3 },
  filterGroup: { marginTop: 17 },
  filterLabel: { color: colors.text, fontSize: 12, fontWeight: '900', marginBottom: 9 },
  priceInputs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceInput: { flex: 1, height: 43, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 11, color: colors.text },
  priceDash: { color: colors.muted },
  stockOption: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  filterValue: { color: colors.text, fontSize: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingVertical: 7, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface },
  chipActive: { borderColor: colors.blue, backgroundColor: colors.blueLight },
  chipText: { color: colors.text, fontSize: 10, fontWeight: '700' },
  chipTextActive: { color: colors.blue },
  drawerActions: { flexDirection: 'row', gap: 10, paddingTop: 12 },
  clearButton: { flex: 0.8, minHeight: 48, borderRadius: 13, backgroundColor: '#E8EDF4', alignItems: 'center', justifyContent: 'center' },
  clearText: { color: colors.text, fontWeight: '800' },
  applyButton: { flex: 1.2, minHeight: 48, borderRadius: 13, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: '#fff', fontWeight: '900' },
});
