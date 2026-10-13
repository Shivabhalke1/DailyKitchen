import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { api, CategoryRead, ProductRead } from '../../src/lib/api-client';
import { ProductCard } from '../../src/components/catalog/ProductCard';
import { FloatingCartBar } from '../../src/components/cart/FloatingCartBar';
import { theme } from '../../src/theme';

export default function MobileCategoriesScreen() {
  const [categories, setCategories] = useState<CategoryRead[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadCategoriesAndProducts = async () => {
    try {
      const cats = await api.catalog.getCategories();
      setCategories(cats || []);
      const initialCatId = cats && cats.length > 0 ? cats[0].id : null;
      setActiveCategoryId(initialCatId);

      const prodsRes = await api.catalog.getProducts({
        category_id: initialCatId || undefined,
        page_size: 50,
      });
      setProducts(prodsRes?.items || []);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadCategoriesAndProducts();
  }, []);

  const handleSelectCategory = async (catId: string) => {
    setActiveCategoryId(catId);
    setIsLoading(true);
    try {
      const prodsRes = await api.catalog.getProducts({
        category_id: catId,
        page_size: 50,
      });
      setProducts(prodsRes?.items || []);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadCategoriesAndProducts();
  };

  return (
    <View style={styles.screen}>
      {/* Horizontal Category Selector */}
      <View style={styles.topSelectorContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topSelectorScroll}
        >
          {categories.map((cat) => {
            const isSelected = activeCategoryId === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catTab, isSelected && styles.catTabActive]}
                onPress={() => handleSelectCategory(cat.id)}
              >
                <Text style={[styles.catTabText, isSelected && styles.catTabTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Produce Listing */}
      <ScrollView
        contentContainerStyle={styles.scrollList}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {isLoading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={theme.colors.primary[700]} />
          </View>
        ) : products.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No produce in this category right now.</Text>
            <Text style={styles.emptySub}>Check back during morning harvest time.</Text>
          </View>
        ) : (
          products.map((prod) => <ProductCard key={prod.id} product={prod} />)
        )}
      </ScrollView>

      <FloatingCartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.neutral.background,
  },
  topSelectorContainer: {
    backgroundColor: theme.colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[200],
  },
  topSelectorScroll: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    gap: theme.spacing[2],
  },
  catTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.neutral[100],
  },
  catTabActive: {
    backgroundColor: theme.colors.primary[700],
  },
  catTabText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.neutral[700],
  },
  catTabTextActive: {
    color: theme.colors.neutral.white,
  },
  scrollList: {
    padding: theme.spacing[4],
    paddingBottom: 90,
  },
  loaderWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyWrap: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.neutral[800],
  },
  emptySub: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[500],
  },
});
