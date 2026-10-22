import styles from '../styles/CategoryBrandsScreenStyles';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ErrorState } from '../components/LoadState';
import { getCategoryBrands } from '../services/categoryService';
import { colors } from '../theme/colors';
import { categoryColor, getCategoryIcon } from '../utils/product';

export function CategoryBrandsScreen({ route, navigation }) {
  const { slug, categoryName } = route.params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getCategoryBrands(slug)
      .then((result) => {
        if (active) setData(result);
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
  }, [slug]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.intro}>
        <View
          style={[
            styles.categoryIcon,
            { backgroundColor: categoryColor(slug) },
          ]}
        >
          <MaterialCommunityIcons
            name={getCategoryIcon(slug)}
            size={32}
            color={colors.blue}
          />
        </View>
        <View style={styles.introCopy}>
          <Text style={styles.eyebrow}>BROWSE CATEGORY</Text>
          <Text style={styles.title}>{categoryName || data?.category || 'Brands'}</Text>
          <Text style={styles.subtitle}>Browse every product or narrow down by brand.</Text>
        </View>
      </View>
      {!loading && !error ? (
        <Pressable
          onPress={() => navigation.navigate('BrandProducts', {
            slug,
            brand: null,
            categoryName: categoryName || data?.category,
          })}
          style={styles.allProductsButton}
        >
          <Text style={styles.allProductsText}>Browse all {categoryName || data?.category || 'category'} products</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
        </Pressable>
      ) : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.blue} size="large" />
          <Text style={styles.subtitle}>Loading brands...</Text>
        </View>
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setLoading(true);
            setError(null);
            getCategoryBrands(slug)
              .then(setData)
              .catch((reason) => setError(reason.message))
              .finally(() => setLoading(false));
          }}
        />
      ) : data?.brands?.length ? (
        <View style={styles.grid}>
          {data.brands.map((brand) => (
            <Pressable
              key={brand}
              onPress={() =>
                navigation.navigate('BrandProducts', {
                  slug,
                  brand,
                  categoryName: categoryName || data.category,
                })
              }
              style={({ pressed }) => [
                styles.brandCard,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.brandLogo}>
                <Text style={styles.brandInitial}>
                  {brand.trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text numberOfLines={1} style={styles.brandName}>
                {brand}
              </Text>
              <MaterialCommunityIcons
                name="arrow-top-right"
                size={16}
                color={colors.muted}
              />
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="tag-off-outline" size={34} color={colors.muted} />
          <Text style={styles.emptyTitle}>No brands yet</Text>
          <Text style={styles.subtitle}>
            There are no brands listed in this category right now.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
