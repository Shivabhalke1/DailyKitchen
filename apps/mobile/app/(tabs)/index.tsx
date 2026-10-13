import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useLocation } from '../../src/context/LocationContext';
import { api, CategoryRead, ProductRead } from '../../src/lib/api-client';
import { ProductCard } from '../../src/components/catalog/ProductCard';
import { FloatingCartBar } from '../../src/components/cart/FloatingCartBar';
import { theme } from '../../src/theme';
import { calculatePricing, formatINR } from '@dailykitchen/shared-utils';
import { MapPin, Search, User, ShieldCheck, ChevronDown, Sparkles } from 'lucide-react-native';

export default function MobileHomeScreen() {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const { pincode, isServiceable, zone, openLocationModal } = useLocation();

  const [categories, setCategories] = useState<CategoryRead[]>([]);
  const [products, setProducts] = useState<ProductRead[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Authoritative Pricing Policy Examples
  const pricingUnder90 = calculatePricing(80);
  const pricingAbove99 = calculatePricing(120);

  const loadCatalogData = async () => {
    setErrorMessage(null);
    try {
      const [cats, prodsData] = await Promise.all([
        api.catalog.getCategories(),
        api.catalog.getProducts({ page_size: 50 }),
      ]);
      setCategories(cats || []);
      setProducts(prodsData?.items || []);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not load fresh produce catalog.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadCatalogData();
  }, []);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadCatalogData();
  };

  // Filter products by selected category and search term
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      // Category filter
      if (selectedCategorySlug) {
        const cat = categories.find((c) => c.slug === selectedCategorySlug);
        if (cat && prod.category_id !== cat.id) return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          prod.name.toLowerCase().includes(q) ||
          (prod.description && prod.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [products, categories, selectedCategorySlug, searchQuery]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {/* Top Header Row: Location Pill & Account Action */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.locationPill}
            onPress={openLocationModal}
            activeOpacity={0.8}
          >
            <MapPin size={16} color={theme.colors.primary[700]} />
            <View>
              <View style={styles.locationTitleRow}>
                <Text style={styles.locationTitle}>
                  {zone?.name || `Zone ${pincode}`}
                </Text>
                <ChevronDown size={12} color={theme.colors.neutral[600]} />
              </View>
              <Text style={styles.locationSub}>
                {isServiceable ? `Serviceable (${pincode})` : 'Unserviceable Area'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.accountBtn}
            onPress={openAuthModal}
            activeOpacity={0.8}
          >
            {isAuthenticated ? (
              <View style={styles.loggedInAvatar}>
                <Text style={styles.avatarInitial}>
                  {user?.phone ? user.phone.slice(-2) : 'DK'}
                </Text>
              </View>
            ) : (
              <View style={styles.loginPill}>
                <User size={14} color={theme.colors.primary[800]} />
                <Text style={styles.loginText}>Login</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Live Search Bar */}
        <View style={styles.searchBarContainer}>
          <Search size={18} color={theme.colors.neutral[400]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search spinach, potatoes, bananas..."
            placeholderTextColor={theme.colors.neutral[400]}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Category Horizontal Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChipsContainer}
        >
          <TouchableOpacity
            style={[
              styles.categoryChip,
              selectedCategorySlug === null && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategorySlug(null)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategorySlug === null && styles.categoryChipTextActive,
              ]}
            >
              All Harvest ({products.length})
            </Text>
          </TouchableOpacity>

          {categories.map((cat) => {
            const isActive = selectedCategorySlug === cat.slug;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                onPress={() => setSelectedCategorySlug(cat.slug)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isActive && styles.categoryChipTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Transparent Delivery Policy Showcase Banner */}
        <View style={styles.pricingPolicyBanner}>
          <View style={styles.policyHeaderRow}>
            <View style={styles.policyTitleWrap}>
              <Sparkles size={16} color="#065F46" />
              <Text style={styles.policyTitle}>Transparent Pricing Policy</Text>
            </View>
            <View style={styles.policyTag}>
              <Text style={styles.policyTagText}>No Hidden Fees</Text>
            </View>
          </View>

          <Text style={styles.policyDesc}>
            Fixed ₹10 eco-packaging fee. Free delivery on orders of ₹99 and above!
          </Text>

          <View style={styles.policyComparisonRow}>
            <View style={styles.policyCard}>
              <Text style={styles.policyCardSub}>Subtotal &lt; ₹99</Text>
              <Text style={styles.policyCardFee}>+₹40 Delivery Fee</Text>
              <Text style={styles.policyCardFoot}>
                e.g. {formatINR(pricingUnder90.subtotal)} + ₹10 + ₹40 ={' '}
                <Text style={styles.boldDark}>{formatINR(pricingUnder90.total)}</Text>
              </Text>
            </View>

            <View style={[styles.policyCard, styles.policyCardFree]}>
              <Text style={styles.policyCardSubFree}>Subtotal ≥ ₹99</Text>
              <Text style={styles.policyCardFeeFree}>FREE Delivery (₹0)</Text>
              <Text style={styles.policyCardFootFree}>
                e.g. {formatINR(pricingAbove99.subtotal)} + ₹10 + ₹0 ={' '}
                <Text style={styles.boldGreen}>{formatINR(pricingAbove99.total)}</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Product Catalog Grid */}
        <View style={styles.catalogSection}>
          <View style={styles.catalogHeaderRow}>
            <Text style={styles.catalogHeading}>
              {selectedCategorySlug
                ? categories.find((c) => c.slug === selectedCategorySlug)?.name || 'Produce'
                : 'Fresh Farm Produce'}
            </Text>
            <Text style={styles.productCountBadge}>
              {filteredProducts.length} items
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary[700]} />
              <Text style={styles.loaderText}>Loading farm-fresh harvest...</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadCatalogData}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredProducts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyHeading}>No produce found</Text>
              <Text style={styles.emptySub}>
                Try selecting a different category or clearing your search.
              </Text>
            </View>
          ) : (
            filteredProducts.map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))
          )}
        </View>
      </ScrollView>

      {/* Persistent Floating Cart Bar */}
      <FloatingCartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.neutral.background,
  },
  scrollContent: {
    padding: theme.spacing[4],
    paddingBottom: 90,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing[3],
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
    backgroundColor: theme.colors.neutral.white,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
    maxWidth: '75%',
  },
  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationTitle: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.neutral[900],
  },
  locationSub: {
    fontSize: 10,
    color: theme.colors.neutral[500],
    fontWeight: '500',
  },
  accountBtn: {
    padding: 2,
  },
  loginPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary[50],
    borderWidth: 1,
    borderColor: theme.colors.primary[600],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
  },
  loginText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.primary[800],
  },
  loggedInAvatar: {
    width: 34,
    height: 34,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: theme.colors.neutral.white,
    fontSize: 12,
    fontWeight: '800',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.neutral.white,
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing[3.5],
    paddingVertical: Platform.OS === 'ios' ? theme.spacing[2.5] : theme.spacing[1.5],
    gap: theme.spacing[2],
    marginBottom: theme.spacing[3],
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral[900],
    fontWeight: '500',
  },
  categoryChipsContainer: {
    flexDirection: 'row',
    gap: theme.spacing[2],
    paddingBottom: theme.spacing[3],
  },
  categoryChip: {
    paddingHorizontal: theme.spacing[3.5],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.neutral.white,
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
  },
  categoryChipActive: {
    backgroundColor: theme.colors.primary[700],
    borderColor: theme.colors.primary[700],
  },
  categoryChipText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.neutral[700],
  },
  categoryChipTextActive: {
    color: theme.colors.neutral.white,
  },
  pricingPolicyBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing[3.5],
    marginBottom: theme.spacing[4],
    gap: theme.spacing[2],
  },
  policyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  policyTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  policyTitle: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '800',
    color: '#065F46',
  },
  policyTag: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  policyTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#047857',
  },
  policyDesc: {
    fontSize: 11,
    color: '#065F46',
    lineHeight: 16,
  },
  policyComparisonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  policyCard: {
    flex: 1,
    backgroundColor: theme.colors.neutral.white,
    padding: 8,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 2,
  },
  policyCardFree: {
    borderColor: '#6EE7B7',
    backgroundColor: '#F0FDF4',
  },
  policyCardSub: {
    fontSize: 10,
    color: theme.colors.neutral[500],
    fontWeight: '600',
  },
  policyCardFee: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.neutral[800],
  },
  policyCardFoot: {
    fontSize: 9,
    color: theme.colors.neutral[500],
    marginTop: 2,
  },
  policyCardSubFree: {
    fontSize: 10,
    color: '#047857',
    fontWeight: '600',
  },
  policyCardFeeFree: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  policyCardFootFree: {
    fontSize: 9,
    color: '#047857',
    marginTop: 2,
  },
  boldDark: {
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  boldGreen: {
    fontWeight: '800',
    color: '#065F46',
  },
  catalogSection: {
    gap: theme.spacing[3],
  },
  catalogHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catalogHeading: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  productCountBadge: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[500],
    fontWeight: '600',
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  loaderText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[500],
  },
  errorBox: {
    backgroundColor: theme.colors.error.light,
    padding: theme.spacing[4],
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  errorText: {
    color: theme.colors.error.main,
    fontSize: theme.typography.fontSize.xs,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: theme.colors.error.main,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md,
  },
  retryText: {
    color: theme.colors.neutral.white,
    fontWeight: '700',
    fontSize: theme.typography.fontSize.xs,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyHeading: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.neutral[800],
  },
  emptySub: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[500],
    marginTop: 4,
  },
});
