import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProductImage } from '../components/ProductImage';
import { useCart } from '../context/CartContext';
import { getProductDetails } from '../services/productService';
import { colors } from '../theme/colors';
import { formatPrice } from '../utils/product';
import { ErrorState } from '../components/LoadState';

export function ProductDetailsScreen({ route, navigation }) {
  const { productId } = route.params;
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [added, setAdded] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getProductDetails(productId)
      .then((result) => {
        if (active) setProduct(result);
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
  }, [productId]);

  useEffect(() => {
    setSelectedImage(0);
  }, [productId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.blue} />
        <Text style={styles.loadingText}>Loading product details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.content}>
        <ErrorState
          message={error}
          onRetry={() => {
            setLoading(true);
            setError(null);
            getProductDetails(productId)
              .then(setProduct)
              .catch((reason) => setError(reason.message))
              .finally(() => setLoading(false));
          }}
        />
      </View>
    );
  }

  if (!product) return null;

  const specs = product.specs && typeof product.specs === 'object'
    ? Object.entries(product.specs)
    : [];
  const images = product.images?.length ? product.images : [product.image].filter(Boolean);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <ProductImage
        product={product}
        size="large"
        imagePath={images[selectedImage]}
      />
      {images.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gallery}
        >
          {images.map((image, index) => (
            <Pressable
              key={`${image}-${index}`}
              onPress={() => setSelectedImage(index)}
              style={[
                styles.thumbnail,
                selectedImage === index && styles.thumbnailSelected,
              ]}
            >
              <ProductImage product={product} size="row" imagePath={image} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.productHeading}>
        <View style={styles.brandPill}>
          <Text style={styles.brandText}>
            {product.brand || product.category?.name || 'GenTech'}
          </Text>
        </View>
        {product.discount > 0 ? (
          <View style={styles.salePill}>
            <Text style={styles.saleText}>{product.discount}% OFF</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.name}>{product.name}</Text>
      <View style={styles.ratingRow}>
        <Ionicons name="star" size={15} color="#F1AA32" />
        <Text style={styles.rating}>
          {Number(product.rating || 0).toFixed(1)}
        </Text>
        <Text style={styles.reviews}>
          ({product.reviewCount || 0} reviews)
        </Text>
        <View style={styles.stock}>
          <View
            style={[
              styles.stockDot,
              { backgroundColor: product.inStock ? colors.green : colors.red },
            ]}
          />
          <Text style={styles.stockText}>
            {product.inStock ? 'In stock' : 'Out of stock'}
          </Text>
        </View>
      </View>

      <View style={styles.priceBox}>
        <View>
          <Text style={styles.priceLabel}>OUR PRICE</Text>
          <Text style={styles.price}>
            {formatPrice(product.finalPrice ?? product.price)}
          </Text>
        </View>
        {product.discount > 0 ? (
          <View style={styles.savings}>
            <Text style={styles.oldPrice}>{formatPrice(product.price)}</Text>
            <Text style={styles.saveText}>
                You save {formatPrice(product.price - (product.finalPrice ?? product.price))}
            </Text>
          </View>
        ) : null}
      </View>

      {product.features?.length ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Highlights</Text>
          {product.features.map((feature, index) => (
            <View key={`${feature}-${index}`} style={styles.feature}>
              <Ionicons name="checkmark-circle" size={17} color={colors.green} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {specs.length ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Specifications</Text>
          {specs.map(([key, value]) => (
            <View key={key} style={styles.specRow}>
              <Text style={styles.specLabel}>{formatLabel(key)}</Text>
              <Text style={styles.specValue}>
                {typeof value === 'string' || typeof value === 'number'
                  ? String(value)
                  : JSON.stringify(value)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {product.warranty ? (
        <View style={styles.warranty}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.blue} />
          <Text style={styles.warrantyText}>{product.warranty} warranty</Text>
        </View>
      ) : null}

      <Pressable
        disabled={!product.inStock}
        onPress={() => {
          addItem(product);
          setAdded(true);
          setTimeout(() => setAdded(false), 1400);
        }}
        style={({ pressed }) => [
          styles.addButton,
          (!product.inStock || pressed) && styles.addButtonMuted,
        ]}
      >
        <Ionicons
          name={added ? 'checkmark' : 'bag-add-outline'}
          size={19}
          color="#FFFFFF"
        />
        <Text style={styles.addButtonText}>
          {added ? 'Added to your bag' : product.inStock ? 'Add to bag' : 'Out of stock'}
        </Text>
      </Pressable>
      <Pressable
        disabled={!product.inStock}
        onPress={() => {
          addItem(product);
          navigation.navigate('Checkout');
        }}
        style={[styles.buyButton, !product.inStock && styles.addButtonMuted]}
      >
        <Text style={styles.buyButtonText}>
          {product.inStock ? 'Buy now' : 'Currently unavailable'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function formatLabel(value) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (character) => character.toUpperCase());
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 36, gap: 15 },
  gallery: { gap: 9, paddingVertical: 2 },
  thumbnail: { borderRadius: 15, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  thumbnailSelected: { borderColor: colors.blue },
  buyButton: { minHeight: 48, borderRadius: 15, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  buyButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: 12,
  },
  loadingText: { color: colors.muted, fontSize: 13 },
  productHeading: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 3,
  },
  brandPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: colors.blueLight,
  },
  brandText: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  salePill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: '#FFF0E7',
  },
  saleText: { color: '#CC5E1E', fontSize: 10, fontWeight: '900' },
  name: { color: colors.text, fontSize: 22, lineHeight: 29, fontWeight: '900' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rating: { color: colors.text, fontSize: 13, fontWeight: '800' },
  reviews: { color: colors.muted, fontSize: 11 },
  stock: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto' },
  stockDot: { width: 7, height: 7, borderRadius: 4 },
  stockText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  priceBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priceLabel: {
    color: colors.muted,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '900',
  },
  price: { color: colors.text, fontSize: 23, fontWeight: '900', marginTop: 5 },
  savings: { alignItems: 'flex-end', gap: 5 },
  oldPrice: { color: colors.muted, fontSize: 12, textDecorationLine: 'line-through' },
  saveText: { color: colors.green, fontSize: 10, fontWeight: '800' },
  block: {
    padding: 15,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 11,
  },
  blockTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  feature: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  featureText: { color: '#4F5E73', fontSize: 12, flex: 1 },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  specLabel: { flex: 1, color: colors.muted, fontSize: 11 },
  specValue: { flex: 1, color: colors.text, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  warranty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.blueLight,
    borderRadius: 14,
    padding: 13,
  },
  warrantyText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  addButton: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: colors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 3,
  },
  addButtonMuted: { backgroundColor: '#92A2B7' },
  addButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
