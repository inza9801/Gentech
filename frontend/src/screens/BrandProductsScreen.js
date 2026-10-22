import styles from '../styles/BrandProductsScreenStyles';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
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
  const selectedFilterCount = Object.values(selected).reduce((count, value) => {
    if (Array.isArray(value)) return count + value.length;
    if (value && typeof value === 'object') {
      return count + Number(Boolean(value.min)) + Number(Boolean(value.max));
    }
    return count + Number(Boolean(value));
  }, 0);

  const loadFilterOptions = useCallback(async () => {
    try {
      const options = await getCategoryFilterOptions(slug);
      setFilterOptions(options);
    } catch (reason) {
      setError(reason.message);
    }
  }, [slug]);

  const loadProducts = useCallback(async (filterState = selected, overrides = {}) => {
    setLoading(true);
    setError(null);
    try {
      const normalizedFilters = normalizeFilters(filterState);
      const result = await filterCategoryProducts(slug, {
        brand: brand || undefined,
        min_price: (overrides.minPrice ?? minPrice) === '' ? undefined : Number(overrides.minPrice ?? minPrice),
        max_price: (overrides.maxPrice ?? maxPrice) === '' ? undefined : Number(overrides.maxPrice ?? maxPrice),
        in_stock: (overrides.inStock ?? inStock) ? true : undefined,
        filters: normalizedFilters,
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
      [key]: (Array.isArray(current[key]) ? current[key] : current[key] ? [current[key]] : [])
        .includes(value)
        ? (Array.isArray(current[key]) ? current[key] : [current[key]]).filter((item) => item !== value)
        : [...(Array.isArray(current[key]) ? current[key] : current[key] ? [current[key]] : []), value],
    }));
  };

  const updateNumericFilter = (key, bound, value) => {
    setSelected((current) => ({
      ...current,
      [key]: { ...(current[key] || {}), [bound]: value },
    }));
  };

  const clearFilters = () => {
    setSelected({});
    setMinPrice('');
    setMaxPrice('');
    setInStock(false);
    loadProducts({}, { minPrice: '', maxPrice: '', inStock: false });
  };

  const applyFilters = () => {
    const currentMin = minPrice.trim() ? Number(minPrice) : undefined;
    const currentMax = maxPrice.trim() ? Number(maxPrice) : undefined;
    if (
      (currentMin !== undefined && !Number.isFinite(currentMin))
      || (currentMax !== undefined && !Number.isFinite(currentMax))
      || (currentMin !== undefined && currentMax !== undefined && currentMin > currentMax)
    ) {
      setError('Enter a valid price range.');
      return;
    }
    try {
      normalizeFilters(selected);
    } catch (reason) {
      setError(reason.message);
      return;
    }
    setDrawerOpen(false);
    loadProducts();
  };

  const filterDefinitions = filterOptions.filterDefinitions
    || Object.entries(filterOptions.filters || {}).map(([key, options]) => ({
      key,
      label: formatLabel(key),
      type: 'text',
      options,
    }));
  const visibleProducts = products;

  return (
    <View style={styles.root}>
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text style={styles.category}>{categoryName || 'Products'}</Text>
          <Text style={styles.title}>{brand || 'All products'}</Text>
        </View>
        <Pressable onPress={() => setDrawerOpen(true)} style={styles.filterButton}>
          <Ionicons name="options-outline" size={17} color="#FFFFFF" />
          <Text style={styles.filterButtonText}>
            Filter{selectedFilterCount ? ` (${selectedFilterCount})` : ''}
          </Text>
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
        <View style={styles.loading}><ActivityIndicator size="large" color={colors.blue} /><Text style={styles.hint}>Finding {brand ? `${brand} ` : ''}products...</Text></View>
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
              <View><Text style={styles.drawerTitle}>Filter products</Text><Text style={styles.drawerSubtitle}>{categoryName} · {brand || 'All brands'}</Text></View>
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
              {filterDefinitions.map((definition) => (
                <View key={definition.key} style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>{definition.label}</Text>
                  {definition.type === 'number' ? (
                    <View style={styles.priceInputs}>
                      <TextInput
                        value={selected[definition.key]?.min || ''}
                        onChangeText={(value) => updateNumericFilter(definition.key, 'min', value)}
                        keyboardType="numeric"
                        placeholder={definition.min == null ? 'Min' : `Min ${definition.min}`}
                        style={styles.priceInput}
                      />
                      <Text style={styles.priceDash}>–</Text>
                      <TextInput
                        value={selected[definition.key]?.max || ''}
                        onChangeText={(value) => updateNumericFilter(definition.key, 'max', value)}
                        keyboardType="numeric"
                        placeholder={definition.max == null ? 'Max' : `Max ${definition.max}`}
                        style={styles.priceInput}
                      />
                    </View>
                  ) : definition.options?.length ? (
                    <View style={styles.chips}>
                      {definition.options.map((value) => {
                        const selectedValues = Array.isArray(selected[definition.key])
                          ? selected[definition.key]
                          : selected[definition.key] ? [selected[definition.key]] : [];
                        const active = selectedValues.includes(value);
                        return (
                          <Pressable
                            key={String(value)}
                            onPress={() => chooseFilter(definition.key, value)}
                            style={[styles.chip, active && styles.chipActive]}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>
                              {String(value)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>
            <View style={styles.drawerActions}>
              <Pressable onPress={clearFilters} style={styles.clearButton}><Text style={styles.clearText}>Clear</Text></Pressable>
              <Pressable onPress={applyFilters} style={styles.applyButton}><Text style={styles.applyText}>Show products</Text></Pressable>
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

function normalizeFilters(filters) {
  return Object.fromEntries(
    Object.entries(filters).flatMap(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const range = {};
        for (const bound of ['min', 'max']) {
          if (value[bound] !== undefined && String(value[bound]).trim()) {
            const parsed = Number(value[bound]);
            if (!Number.isFinite(parsed)) {
              throw new Error(`Enter a valid ${bound} value for ${formatLabel(key)}.`);
            }
            range[bound] = parsed;
          }
        }
        if (range.min !== undefined && range.max !== undefined && range.min > range.max) {
          throw new Error(`The minimum ${formatLabel(key)} cannot exceed its maximum.`);
        }
        return Object.keys(range).length ? [[key, range]] : [];
      }
      const values = Array.isArray(value) ? value : value ? [value] : [];
      return values.length ? [[key, values]] : [];
    }),
  );
}
