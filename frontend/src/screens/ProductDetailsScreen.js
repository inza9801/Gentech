import styles from '../styles/ProductDetailsScreenStyles';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormField } from '../components/FormField';
import { ProductImage } from '../components/ProductImage';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import {
  getProductDetails,
  getProductReviews,
  saveProductReview,
} from '../services/productService';
import { colors } from '../theme/colors';
import { formatPrice } from '../utils/product';
import { ErrorState } from '../components/LoadState';

export function ProductDetailsScreen({ route, navigation }) {
  const { productId } = route.params;
  const { token } = useAuth();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [added, setAdded] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [myReview, setMyReview] = useState(null);
  const [rating, setRating] = useState(null);
  const [reviewText, setReviewText] = useState('');
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setReviewLoading(true);
    setError(null);
    setReviewError(null);
    getProductDetails(productId)
      .then((result) => {
        if (!active) return;
        setProduct(result);
        return getProductReviews(result.id, result.category.slug, token)
          .then((reviewResult) => {
            if (!active) return;
            setReviews(reviewResult.reviews);
            setMyReview(reviewResult.myReview);
            setRating(reviewResult.myReview?.rating ?? null);
            setReviewText(reviewResult.myReview?.text || '');
            const hasLiveReviews = reviewResult.reviews.length > 0;
            setProduct((current) => current && ({
              ...current,
              rating: hasLiveReviews ? reviewResult.averageRating : current.rating,
              ratingCount: hasLiveReviews
                ? reviewResult.ratingCount
                : current.ratingCount ?? current.reviewCount ?? 0,
              reviewCount: hasLiveReviews ? reviewResult.reviewCount : current.reviewCount,
            }));
          })
          .catch((reason) => {
            if (active) setReviewError(reason.message);
          })
          .finally(() => {
            if (active) setReviewLoading(false);
          });
      })
      .catch((reason) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setReviewLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [productId, token]);

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

  const submitReview = async () => {
    if (!token) {
      navigation.navigate('Login', {
        loginFirst: true,
        returnTo: 'ProductDetails',
        returnParams: { productId },
      });
      return;
    }
    if (!rating && !reviewText.trim()) {
      setReviewError('Add a star rating, written review, or both.');
      return;
    }
    setReviewBusy(true);
    setReviewError(null);
    try {
      await saveProductReview(
        product.id,
        product.category.slug,
        {
          rating: rating ? Number(rating) : null,
          text: reviewText.trim() || null,
        },
        token,
      );
      const result = await getProductReviews(product.id, product.category.slug, token);
      setReviews(result.reviews);
      setMyReview(result.myReview);
      setRating(result.myReview?.rating ?? null);
      setReviewText(result.myReview?.text || '');
      setProduct((current) => current && ({
        ...current,
        rating: result.averageRating,
        ratingCount: result.ratingCount,
        reviewCount: result.reviewCount,
      }));
    } catch (reason) {
      setReviewError(reason.message);
    } finally {
      setReviewBusy(false);
    }
  };

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
        {product.ratingCount ? (
          <>
            <Ionicons name="star" size={15} color="#F1AA32" />
            <Text style={styles.rating}>
              {Number(product.rating || 0).toFixed(1)}
            </Text>
          </>
        ) : (
          <Text style={styles.reviews}>Not rated yet</Text>
        )}
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

      <View style={styles.reviewBlock}>
        <View style={styles.reviewHeading}>
          <View>
            <Text style={styles.blockTitle}>Customer reviews</Text>
            <Text style={styles.reviewSummary}>
              {product.ratingCount
                ? `${Number(product.rating || 0).toFixed(1)} average · ${product.reviewCount} reviews`
                : product.reviewCount
                  ? `${product.reviewCount} written reviews`
                : 'Be the first to share your thoughts'}
            </Text>
          </View>
        </View>
        {token ? (
          <View style={styles.reviewForm}>
            <Text style={styles.reviewPrompt}>
              {myReview ? 'Update your review' : 'Share your experience'}
            </Text>
            <View style={styles.reviewStars}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setRating((current) => current === value ? null : value)}
                  accessibilityRole="button"
                  accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
                >
                  <Ionicons
                    name={rating >= value ? 'star' : 'star-outline'}
                    size={27}
                    color="#F1AA32"
                  />
                </Pressable>
              ))}
            </View>
            <FormField
              label="Written review (optional)"
              value={reviewText}
              onChangeText={setReviewText}
              multiline
              maxLength={2000}
              placeholder="What did you think of this product?"
            />
            <Text style={styles.reviewHint}>A rating, written review, or both are required.</Text>
            {reviewError ? <Text style={styles.reviewError}>{reviewError}</Text> : null}
            <Pressable
              disabled={reviewBusy || (!rating && !reviewText.trim())}
              onPress={submitReview}
              style={[
                styles.reviewSubmit,
                (reviewBusy || (!rating && !reviewText.trim())) && styles.reviewSubmitDisabled,
              ]}
            >
              {reviewBusy
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.reviewSubmitText}>{myReview ? 'Update review' : 'Submit review'}</Text>}
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => navigation.navigate('Login', {
              loginFirst: true,
              returnTo: 'ProductDetails',
              returnParams: { productId },
            })}
            style={styles.reviewLogin}
          >
            <Text style={styles.reviewLoginText}>Login to add a review or rating</Text>
          </Pressable>
        )}
        {reviewLoading ? (
          <ActivityIndicator color={colors.blue} />
        ) : reviews.length ? (
          <View style={styles.reviewList}>
            {reviews.map((review) => (
              <View key={review.id} style={styles.reviewItem}>
                <View style={styles.reviewItemHeading}>
                  <Text style={styles.reviewAuthor}>{review.customerName}</Text>
                  {review.rating ? (
                    <View style={styles.reviewItemStars}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Ionicons
                          key={value}
                          name={value <= review.rating ? 'star' : 'star-outline'}
                          size={13}
                          color="#F1AA32"
                        />
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.reviewTextOnly}>Written review</Text>
                  )}
                </View>
                {review.text ? <Text style={styles.reviewBody}>{review.text}</Text> : null}
              </View>
            ))}
          </View>
        ) : reviewError ? (
          <Text style={styles.reviewError}>{reviewError}</Text>
        ) : null}
      </View>

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
