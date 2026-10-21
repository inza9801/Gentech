import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { imageUrl } from '../services/api';
import { colors } from '../theme/colors';
import { categoryColor, getCategoryIcon, productImage } from '../utils/product';

export function ProductImage({
  product,
  size = 'card',
  style,
  imagePath,
}) {
  const [failedUri, setFailedUri] = useState(null);
  const path = imagePath || productImage(product);
  const uri = path ? imageUrl(path) : null;
  const showImage = uri && uri !== failedUri;

  return (
    <View style={[styles.base, styles[size], { backgroundColor: categoryColor(product?.category?.slug) }, style]}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="contain"
          onError={() => setFailedUri(uri)}
        />
      ) : (
        <View style={styles.fallback}>
          <MaterialCommunityIcons
            name={getCategoryIcon(product?.category?.slug)}
            size={size === 'large' ? 94 : 48}
            color={colors.blue}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { width: '100%', height: 124, borderRadius: 15 },
  row: { width: 70, height: 70, borderRadius: 14 },
  large: { width: '100%', height: 300, borderRadius: 24 },
  image: { width: '100%', height: '100%' },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
