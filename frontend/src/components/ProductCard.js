import styles from '../styles/ProductCardStyles';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProductImage } from './ProductImage';
import { formatPrice } from '../utils/product';

export function ProductCard({
  product,
  onPress,
  onAdd,
  addedToCart = false,
  showAddLabel = false,
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
        {(product.ratingCount ?? product.reviewCount) > 0 ? (
          <>
            <Ionicons name="star" size={13} color="#F1AA32" />
            <Text style={styles.rating}>
              {Number(product.rating || 0).toFixed(1)}
            </Text>
          </>
        ) : (
          <Text style={styles.reviews}>Not rated</Text>
        )}
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
          accessibilityLabel={
            addedToCart ? `${product.name} added to cart` : `Add ${product.name} to cart`
          }
          hitSlop={8}
          disabled={addedToCart}
          onPress={(event) => {
            event.stopPropagation();
            onAdd?.();
          }}
          style={({ pressed }) => [
            styles.addButton,
            showAddLabel && styles.addButtonWithLabel,
            addedToCart && styles.addButtonAdded,
            pressed && styles.addPressed,
          ]}
        >
          <Ionicons
            name={addedToCart ? 'checkmark' : 'add'}
            size={21}
            color="#FFFFFF"
          />
          {showAddLabel ? (
            <Text style={styles.addButtonText}>
              {addedToCart ? 'Added' : 'Add to bag'}
            </Text>
          ) : null}
        </Pressable>
      </View>
    </Pressable>
  );
}
