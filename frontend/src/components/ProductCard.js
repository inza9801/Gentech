import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProductImage } from './ProductImage';
import { colors } from '../theme/colors';
import { formatPrice } from '../utils/product';

export function ProductCard({
  product,
  onPress,
  onAdd,
  width = 174,
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { width },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.imageWrap}>
        <ProductImage product={product} />
        {product.discount > 0 ? (
          <View style={styles.discount}>
            <Text style={styles.discountText}>{product.discount}% OFF</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.brand}>
        {product.brand || product.category?.name || 'GenTech'}
      </Text>
      <Text numberOfLines={2} style={styles.name}>
        {product.name}
      </Text>
      <View style={styles.ratingRow}>
        <Ionicons name="star" size={13} color="#F1AA32" />
        <Text style={styles.rating}>
          {Number(product.rating || 0).toFixed(1)}
        </Text>
        <Text style={styles.reviews}>({product.reviewCount || 0})</Text>
      </View>
      <View style={styles.bottomRow}>
        <View style={styles.priceColumn}>
          <Text style={styles.price}>{formatPrice(product.finalPrice ?? product.price)}</Text>
          {product.discount > 0 ? (
            <Text style={styles.oldPrice}>{formatPrice(product.price)}</Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${product.name} to cart`}
          hitSlop={8}
          onPress={(event) => {
            event.stopPropagation();
            onAdd?.();
          }}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addPressed,
          ]}
        >
          <Ionicons name="add" size={21} color="#FFFFFF" />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  imageWrap: { position: 'relative', marginBottom: 11 },
  discount: {
    position: 'absolute',
    left: 8,
    top: 8,
    backgroundColor: '#EAF4FF',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  discountText: { color: colors.blue, fontSize: 10, fontWeight: '800' },
  brand: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  name: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    minHeight: 36,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  rating: { color: colors.text, fontSize: 11, fontWeight: '700' },
  reviews: { color: colors.muted, fontSize: 10 },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  priceColumn: { gap: 3 },
  price: { color: colors.text, fontSize: 14, fontWeight: '900' },
  oldPrice: {
    color: colors.muted,
    fontSize: 10,
    textDecorationLine: 'line-through',
  },
  addButton: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
  },
  addPressed: { backgroundColor: '#075BC7' },
});
