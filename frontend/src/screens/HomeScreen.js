import styles from '../styles/HomeScreenStyles';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
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
                Explore today’s best deals across the store.
              </Text>
              <Pressable
                onPress={() => navigation.navigate('Offers')}
                style={styles.promoButton}
              >
                <Text style={styles.promoButtonText}>Explore offers</Text>
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
