import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BrandMark } from '../components/BrandMark';
import { ErrorState, LoadingState } from '../components/LoadState';
import { ProductCard } from '../components/ProductCard';
import { ProductImage } from '../components/ProductImage';
import { SectionHeading } from '../components/SectionHeading';
import { useCart } from '../context/CartContext';
import { getCategories } from '../services/categoryService';
import { getBestSellers, getLatestProducts, searchProducts } from '../services/productService';
import { colors } from '../theme/colors';
import { categoryColor, getCategoryIcon } from '../utils/product';

function ProductSection({
  title,
  subtitle,
  products,
  loading,
  error,
  onRetry,
  onProductPress,
  onAdd,
}) {
  return (
    <View style={styles.section}>
      <SectionHeading title={title} subtitle={subtitle} action="See all" />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : products.length ? (
        <FlatList
          horizontal
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={() => onProductPress(item)}
              onAdd={() => onAdd(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.productList}
        />
      ) : (
        <Text style={styles.emptyHint}>No products to show right now.</Text>
      )}
    </View>
  );
}

function CategoryTile({ category, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.categoryTile}>
      <View
        style={[
          styles.categoryIcon,
          { backgroundColor: categoryColor(category.slug) },
        ]}
      >
        <MaterialCommunityIcons
          name={getCategoryIcon(category.slug)}
          size={24}
          color={colors.blue}
        />
      </View>
      <Text numberOfLines={2} style={styles.categoryName}>
        {category.name}
      </Text>
    </Pressable>
  );
}

export function HomeScreen({ navigation }) {
  const { addItem, itemCount } = useCart();
  const [categories, setCategories] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [latest, setLatest] = useState([]);
  const [categoryState, setCategoryState] = useState({ loading: true, error: null });
  const [bestState, setBestState] = useState({ loading: true, error: null });
  const [latestState, setLatestState] = useState({ loading: true, error: null });
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const timer = useRef(null);
  const abortController = useRef(null);

  const loadHome = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }
    setCategoryState({ loading: true, error: null });
    setBestState({ loading: true, error: null });
    setLatestState({ loading: true, error: null });

    const results = await Promise.allSettled([
      getCategories(),
      getBestSellers(),
      getLatestProducts(),
    ]);
    const setters = [
      [setCategories, setCategoryState],
      [setBestSellers, setBestState],
      [setLatest, setLatestState],
    ];
    results.forEach((result, index) => {
      const [setData, setState] = setters[index];
      if (result.status === 'fulfilled') {
        setData(result.value);
        setState({ loading: false, error: null });
      } else {
        setState({ loading: false, error: result.reason.message });
      }
    });
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadHome();
    return () => {
      clearTimeout(timer.current);
      abortController.current?.abort();
    };
  }, [loadHome]);

  useEffect(() => {
    clearTimeout(timer.current);
    abortController.current?.abort();
    setSearchError(null);

    if (query.trim().length < 2) {
      setSuggestions([]);
      setSearchLoading(false);
      return undefined;
    }

    setSuggestions([]);
    const controller = new AbortController();
    abortController.current = controller;
    setSearchLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const result = await searchProducts(query.trim(), {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setSuggestions(result);
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          setSearchError(error.message);
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearchLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer.current);
      controller.abort();
    };
  }, [query]);

  const openProduct = (product) => {
    Keyboard.dismiss();
    setSearchFocused(false);
    setQuery('');
    navigation.navigate('ProductDetails', { productId: product.id });
  };

  const openCategory = (category) => {
    setDrawerOpen(false);
    Keyboard.dismiss();
    navigation.navigate('CategoryBrands', {
      slug: category.slug,
      categoryName: category.name,
    });
  };

  const openBrand = (category, brand) => {
    setDrawerOpen(false);
    Keyboard.dismiss();
    navigation.navigate('BrandProducts', {
      slug: category.slug,
      brand,
      categoryName: category.name,
    });
  };

  const openCart = () => navigation.getParent()?.navigate('Cart');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <Pressable
            style={styles.headerIcon}
            onPress={() => setDrawerOpen(true)}
            accessibilityLabel="Open categories menu"
          >
            <Ionicons name="ellipsis-vertical" size={21} color="#FFFFFF" />
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Home')} accessibilityLabel="GenTech home">
            <BrandMark />
          </Pressable>
        </View>
        <View style={styles.topActions}>
          <Pressable
            style={styles.headerIcon}
            onPress={openCart}
            accessibilityLabel="Open shopping bag"
          >
            <Ionicons name="bag-handle-outline" size={21} color="#FFFFFF" />
            {itemCount > 0 ? (
              <View style={styles.bagBadge}>
                <Text style={styles.bagBadgeText}>
                  {itemCount > 9 ? '9+' : itemCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadHome(true)}
            tintColor={colors.blue}
          />
        }
      >
        <View style={styles.heroTop}>
          <Text style={styles.welcome}>YOUR TECH, YOUR WAY</Text>
          <Text style={styles.headline}>Find your next{'\n'}favorite upgrade.</Text>
          <Text style={styles.subheadline}>
            Shop trusted gear picked for your setup.
          </Text>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={20} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 160)}
              placeholder="Search laptops, parts, brands..."
              placeholderTextColor="#91A0B4"
              style={styles.searchInput}
              returnKeyType="search"
              accessibilityLabel="Search products"
            />
            {searchLoading ? (
              <ActivityIndicator size="small" color={colors.blue} />
            ) : query ? (
              <Pressable
                onPress={() => setQuery('')}
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={19} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
          {searchFocused && query.trim().length >= 2 ? (
            <View style={styles.suggestions}>
              {searchLoading && !suggestions.length ? (
                <View style={styles.suggestionStatus}>
                  <ActivityIndicator size="small" color={colors.blue} />
                  <Text style={styles.suggestionHint}>Searching products</Text>
                </View>
              ) : searchError ? (
                <Text style={styles.suggestionError}>{searchError}</Text>
              ) : suggestions.length ? (
                suggestions.slice(0, 6).map((product) => (
                  <Pressable
                    key={product.id}
                    onPress={() => openProduct(product)}
                    style={styles.suggestionRow}
                  >
                    <ProductImage product={product} size="row" />
                    <View style={styles.suggestionCopy}>
                      <Text numberOfLines={1} style={styles.suggestionBrand}>
                        {product.brand || product.category?.name}
                      </Text>
                      <Text numberOfLines={2} style={styles.suggestionName}>
                        {product.name}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={17} color={colors.muted} />
                  </Pressable>
                ))
              ) : !searchLoading ? (
                <Text style={styles.suggestionHint}>No matching products yet.</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.content}>
          <View style={styles.promo}>
            <View style={styles.promoCopy}>
              <View style={styles.promoPill}>
                <Text style={styles.promoPillText}>GEAR UP</Text>
              </View>
              <Text style={styles.promoTitle}>Big performance.{'\n'}Better value.</Text>
              <Text style={styles.promoCaption}>
                Your next build starts here.
              </Text>
              <Pressable
                onPress={() => {
                  if (categories.length) openCategory(categories[0]);
                }}
                style={styles.promoButton}
              >
                <Text style={styles.promoButtonText}>Explore gear</Text>
                <Ionicons name="arrow-forward" size={15} color={colors.ink} />
              </Pressable>
            </View>
            <View style={styles.promoArt}>
              <View style={styles.artGlow} />
              <MaterialCommunityIcons
                name="expansion-card-variant"
                size={98}
                color={colors.cyan}
              />
              <View style={styles.artChip}>
                <MaterialCommunityIcons
                  name="memory"
                  size={20}
                  color="#FFFFFF"
                />
              </View>
            </View>
          </View>

          <View style={styles.categorySection}>
            <SectionHeading
              title="Shop by category"
              subtitle="Find the right part for your setup"
              action="All"
              onAction={() => setDrawerOpen(true)}
            />
            {categoryState.loading ? (
              <LoadingState label="Loading categories..." />
            ) : categoryState.error ? (
              <ErrorState
                message={categoryState.error}
                onRetry={loadHome}
              />
            ) : (
              <View style={styles.categoryList}>
                {categories.map((category) => (
                  <CategoryTile
                    key={category.id || category.slug}
                    category={category}
                    onPress={() => openCategory(category)}
                  />
                ))}
              </View>
            )}
          </View>

          <ProductSection
            title="Best sellers"
            subtitle="Popular picks, loved by everyone"
            products={bestSellers}
            loading={bestState.loading}
            error={bestState.error}
            onRetry={loadHome}
            onProductPress={openProduct}
            onAdd={addItem}
          />

          <View style={styles.latestSection}>
            <ProductSection
              title="Just arrived"
              subtitle="Fresh finds for your setup"
              products={latest}
              loading={latestState.loading}
              error={latestState.error}
              onRetry={loadHome}
              onProductPress={openProduct}
              onAdd={addItem}
            />
          </View>

          <View style={styles.trustRow}>
            <View style={styles.trustItem}>
              <Ionicons name="shield-checkmark-outline" size={17} color={colors.blue} />
              <Text style={styles.trustText}>Trusted tech</Text>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="cube-outline" size={17} color={colors.blue} />
              <Text style={styles.trustText}>Careful delivery</Text>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="headset-outline" size={17} color={colors.blue} />
              <Text style={styles.trustText}>Real support</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={drawerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDrawerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalScrim}
            onPress={() => setDrawerOpen(false)}
          />
          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <BrandMark />
              <Pressable
                onPress={() => setDrawerOpen(false)}
                style={styles.closeButton}
                accessibilityLabel="Close menu"
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </Pressable>
            </View>
            <Text style={styles.drawerEyebrow}>EXPLORE</Text>
            <Text style={styles.drawerTitle}>Shop categories</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {categories.map((category) => {
                const expanded = expandedCategory === category.slug;
                return (
                  <View key={category.id || category.slug}>
                    <View style={styles.drawerItem}>
                      <Pressable onPress={() => openCategory(category)} style={styles.drawerCategory}>
                        <View style={[styles.drawerIcon, { backgroundColor: categoryColor(category.slug) }]}>
                          <MaterialCommunityIcons name={getCategoryIcon(category.slug)} size={20} color={colors.blue} />
                        </View>
                        <Text numberOfLines={1} style={styles.drawerItemText}>{category.name}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setExpandedCategory(expanded ? null : category.slug)}
                        accessibilityLabel={`${expanded ? 'Hide' : 'Show'} ${category.name} brands`}
                        hitSlop={8}
                      >
                        <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={17} color={colors.muted} />
                      </Pressable>
                    </View>
                    {expanded ? (
                      <View style={styles.drawerBrands}>
                        {category.brands?.length ? category.brands.map((brand) => (
                          <Pressable key={brand} onPress={() => openBrand(category, brand)} style={styles.drawerBrand}>
                            <Text numberOfLines={1} style={styles.drawerBrandText}>{brand}</Text>
                            <Ionicons name="arrow-forward" size={13} color={colors.cyan} />
                          </Pressable>
                        )) : <Text style={styles.drawerNoBrands}>No brands listed</Text>}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
            <Text style={styles.drawerFooter}>Built for your next great setup.</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  topBar: {
    height: 62,
    backgroundColor: colors.ink,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topActions: { flexDirection: 'row', gap: 9 },
  headerIcon: {
    width: 39,
    height: 39,
    borderRadius: 14,
    backgroundColor: colors.inkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bagBadge: {
    position: 'absolute',
    right: -3,
    top: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
  },
  bagBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  heroTop: {
    backgroundColor: colors.ink,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 21,
    zIndex: 10,
  },
  welcome: {
    color: colors.cyan,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.9,
    marginBottom: 9,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  subheadline: { color: '#A8B5C8', fontSize: 13, marginTop: 8, marginBottom: 18 },
  searchWrap: {
    height: 51,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 12,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 13, paddingVertical: 0 },
  suggestions: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: 17,
    padding: 9,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 25,
    elevation: 14,
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  suggestionRow: {
    minHeight: 73,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F3F7',
  },
  suggestionCopy: { flex: 1, gap: 3 },
  suggestionBrand: {
    color: colors.blue,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  suggestionName: { color: colors.text, fontSize: 12, fontWeight: '700' },
  suggestionStatus: {
    height: 62,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionHint: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
    padding: 17,
  },
  suggestionError: { color: colors.red, fontSize: 12, padding: 14 },
  content: { paddingTop: 18, paddingBottom: 24 },
  promo: {
    marginHorizontal: 18,
    marginBottom: 25,
    minHeight: 177,
    borderRadius: 23,
    backgroundColor: '#0B2441',
    overflow: 'hidden',
    flexDirection: 'row',
    padding: 18,
  },
  promoCopy: { flex: 1.15, zIndex: 2, justifyContent: 'center' },
  promoPill: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#173A5C',
    marginBottom: 10,
  },
  promoPillText: {
    color: colors.cyan,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  promoTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 23,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  promoCaption: { color: '#B3C5DC', fontSize: 10, marginTop: 6 },
  promoButton: {
    marginTop: 13,
    alignSelf: 'flex-start',
    backgroundColor: colors.cyan,
    borderRadius: 11,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  promoButtonText: { color: colors.ink, fontWeight: '900', fontSize: 10 },
  promoArt: { flex: 0.85, alignItems: 'center', justifyContent: 'center' },
  artGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#12385C',
    right: -14,
    top: 6,
  },
  artChip: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 17,
    right: 11,
    borderWidth: 3,
    borderColor: '#0B2441',
  },
  categorySection: { marginBottom: 25 },
  section: { marginBottom: 26 },
  categoryList: { paddingHorizontal: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 13 },
  categoryTile: { width: 72, alignItems: 'center', gap: 7 },
  categoryIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7EDF5',
  },
  categoryName: {
    color: colors.text,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    textAlign: 'center',
    minHeight: 26,
  },
  productList: { paddingHorizontal: 18, paddingVertical: 2 },
  emptyHint: { color: colors.muted, fontSize: 12, paddingHorizontal: 18 },
  latestSection: {
    paddingTop: 20,
    paddingBottom: 1,
    backgroundColor: '#EAF2FC',
  },
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 18,
    marginTop: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trustText: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  modalRoot: { flex: 1, flexDirection: 'row' },
  modalScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: '#020817AA' },
  drawer: {
    width: '84%',
    maxWidth: 360,
    flex: 1,
    backgroundColor: colors.ink,
    paddingTop: 58,
    paddingHorizontal: 18,
    paddingBottom: 20,
    borderTopRightRadius: 25,
    borderBottomRightRadius: 25,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 27,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inkSoft,
  },
  drawerEyebrow: {
    color: colors.cyan,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  drawerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 5,
    marginBottom: 15,
  },
  drawerItem: {
    minHeight: 57,
    borderBottomWidth: 1,
    borderBottomColor: '#1B2B41',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  drawerCategory: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  drawerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerItemText: { flex: 1, color: '#EAF0F8', fontSize: 13, fontWeight: '700' },
  drawerBrands: { marginLeft: 45, marginBottom: 8, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: '#263A53' },
  drawerBrand: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 9 },
  drawerBrandText: { color: '#CAD6E6', fontSize: 11, flex: 1 },
  drawerNoBrands: { color: '#91A0B4', fontSize: 10, padding: 9 },
  drawerFooter: {
    color: '#74869D',
    fontSize: 11,
    textAlign: 'center',
    paddingTop: 16,
  },
});
