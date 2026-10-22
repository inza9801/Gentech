import styles from '../styles/ProductImageStyles';
import { useState } from 'react';
import { Image, View } from 'react-native';
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


