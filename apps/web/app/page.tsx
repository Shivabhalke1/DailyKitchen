'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api, CategoryRead, ProductRead } from '@/lib/api-client';
import { CategoryTabs } from '@/components/catalog/CategoryTabs';
import { ProductCard } from '@/components/catalog/ProductCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Leaf,
  Truck,
  ShieldCheck,
  Search,
  Sparkles,
  Flame,
  ArrowRight,
  Loader2,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { calculatePricing, formatINR } from '@dailykitchen/shared-utils';

export default function HomePage() {
  const [categories, setCategories] = useState<CategoryRead[]>([]);
  const [products, setProducts] = useState<ProductRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Example pricing calculations for transparent policy showcase
  const exampleSub90 = calculatePricing(90);
  const example150 = calculatePricing(150);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [cats, prodsData] = await Promise.all([
        api.catalog.getCategories(),
        api.catalog.getProducts({ page_size: 50 }),
      ]);
      setCategories(cats || []);
      setProducts(prodsData?.items || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load fresh catalog. Please verify that the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered products based on search and selected category
  const filteredProducts = useMemo(() => {
    let list = products;

    if (selectedCategorySlug) {
      const selectedCat = categories.find((c) => c.slug === selectedCategorySlug);
      if (selectedCat) {
        list = list.filter((p) => p.category_id === selectedCat.id);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }

    return list;
  }, [products, categories, selectedCategorySlug, searchQuery]);

  const freshTodayProducts = useMemo(() => {
    return products.filter((p) => p.is_fresh_today);
  }, [products]);

  const popularProducts = useMemo(() => {
    return products.filter((p) => p.is_popular);
  }, [products]);

  return (
    <div className="space-y-10 sm:space-y-14">
      {/* Hero Showcase Section - Impression Seeker UI */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-950 text-white border border-emerald-800/40 shadow-2xl shadow-emerald-950/40">
        {/* Glow ambient background elements */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center p-6 sm:p-10 lg:p-12">
          {/* Left Column: Compelling Headlines, Quick Search & Transparency Metrics */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 bg-emerald-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold text-emerald-200 border border-emerald-500/40 shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Harvested This Morning &bull; Zero Storage Loss</span>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1]">
                Fresh Food. <br />
                <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-lime-300 bg-clip-text text-transparent">
                  Happy Homes.
                </span>
              </h1>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl font-normal pt-1">
                Directly harvested daily vegetables, crisp greens, and orchard fruits delivered in under 30 minutes. 100% transparent weighing, zero hidden charges, and honest local farm pricing.
              </p>
            </div>

            {/* Interactive Search Bar */}
            <div className="space-y-3 pt-1 max-w-xl">
              <div className="relative flex items-center shadow-lg rounded-2xl group">
                <Search className="w-5 h-5 text-emerald-400 absolute left-4 pointer-events-none group-focus-within:text-emerald-300 transition-colors" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search fresh tomatoes, palak, carrots, onions..."
                  aria-label="Search produce"
                  className="w-full pl-12 pr-16 py-3.5 text-sm sm:text-base rounded-2xl bg-slate-900/90 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 border border-slate-700/80 shadow-inner font-medium backdrop-blur-md transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Quick Search Chips */}
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="text-slate-400 font-semibold mr-1">Trending:</span>
                {[
                  { label: '🍅 Tomatoes', query: 'tomato' },
                  { label: '🥔 Potatoes', query: 'potato' },
                  { label: '🥬 Fresh Spinach', query: 'spinach' },
                  { label: '🥕 Carrots', query: 'carrot' },
                  { label: '🥦 Broccoli', query: 'broccoli' },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => setSearchQuery(chip.query)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/60 text-emerald-200 text-[11px] font-medium transition-all hover:scale-105"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-3 pt-2 max-w-lg border-t border-emerald-900/60 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-900/50 border border-emerald-700/50 flex items-center justify-center text-emerald-300 shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white text-[12px]">30 Min</div>
                  <div className="text-[10px] text-slate-400">Express Slots</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-900/50 border border-emerald-700/50 flex items-center justify-center text-emerald-300 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white text-[12px]">100% Exact</div>
                  <div className="text-[10px] text-slate-400">Net Gram Weight</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-900/50 border border-emerald-700/50 flex items-center justify-center text-emerald-300 shrink-0">
                  <Leaf className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white text-[12px]">Morning Pick</div>
                  <div className="text-[10px] text-slate-400">4:30 AM Harvest</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Impression Seeker Hero Photo & Floating Badges */}
          <div className="lg:col-span-5 relative flex items-center justify-center pt-4 lg:pt-0">
            <div className="relative w-full max-w-md lg:max-w-none group">
              {/* Decorative behind glow */}
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-lime-500 rounded-3xl blur-xl opacity-30 group-hover:opacity-50 transition duration-700" />

              {/* Main Photo Card */}
              <div className="relative rounded-3xl overflow-hidden border-2 border-emerald-500/30 shadow-2xl shadow-emerald-950/80 bg-slate-900 aspect-[4/3]">
                <img
                  src="/images/hero-harvest.jpg"
                  alt="DailyKitchen Morning Farm Harvest"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                />

                {/* Subtle gradient overlay at bottom of photo */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20 pointer-events-none" />

                {/* Top Badge on image */}
                <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5 bg-slate-950/75 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15 text-[11px] font-bold text-white shadow-lg">
                  <span className="text-amber-400">★ 4.9</span>
                  <span className="text-slate-300">&bull; 10,000+ Happy Kitchens</span>
                </div>

                {/* Bottom Overlay on image */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-slate-950/75 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 font-bold text-sm">
                      🌱
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">100% Pesticide Free</div>
                      <div className="text-[10px] text-slate-300">Cleaned &amp; ozone sanitised</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                    Fresh
                  </span>
                </div>
              </div>

              {/* Floating Badge 1 - Top Right */}
              <div className="hidden sm:flex absolute -top-4 -right-4 bg-slate-900/90 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-3 shadow-xl items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Morning Crisp</div>
                  <div className="text-[10px] text-emerald-400 font-semibold">Dew drops intact</div>
                </div>
              </div>

              {/* Floating Badge 2 - Bottom Left */}
              <div className="hidden sm:flex absolute -bottom-4 -left-4 bg-slate-900/90 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-3 shadow-xl items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400">
                  <Truck className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Free Delivery</div>
                  <div className="text-[10px] text-slate-400">Orders above ₹99</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Category Tabs Filter */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-textPrimary tracking-tight">
              Explore Fresh Categories
            </h2>
            <p className="text-xs sm:text-sm text-textMuted">
              Select a category to filter today&apos;s available harvest
            </p>
          </div>

          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold text-brand-700 hover:underline"
            >
              Clear Search ({filteredProducts.length} results)
            </button>
          )}
        </div>

        {categories.length > 0 && (
          <CategoryTabs
            categories={categories}
            selectedSlug={selectedCategorySlug}
            onSelectCategory={(slug) => setSelectedCategorySlug(slug)}
          />
        )}
      </section>

      {/* Main Produce Grid */}
      <section className="space-y-6">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 text-brand-700 animate-spin" />
            <p className="text-sm font-semibold text-textMuted">Loading fresh harvest catalog...</p>
          </div>
        ) : error ? (
          <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center space-y-4 max-w-lg mx-auto">
            <p className="text-sm text-red-700 font-semibold">{error}</p>
            <Button variant="primary" onClick={loadData} className="inline-flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              <span>Retry Connection</span>
            </Button>
          </div>
        ) : products.length === 0 ? (
          <div className="py-20 text-center space-y-3 bg-white rounded-2xl border border-borderSubtle p-8 shadow-sm">
            <ShoppingBag className="w-14 h-14 text-slate-300 mx-auto" />
            <p className="text-lg font-bold text-textPrimary">Harvest Catalog is Currently Fresh &amp; Empty</p>
            <p className="text-xs text-textMuted max-w-md mx-auto">
              No products have been listed yet. Administrators can add fresh categories, produce items, and inventory from the backoffice panel.
            </p>
            <div className="pt-2">
              <Link href="/admin/catalog">
                <Button variant="outline" size="sm" className="inline-flex items-center gap-1.5">
                  <span>Go to Admin Catalog</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-white rounded-2xl border border-borderSubtle p-8">
            <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-base font-bold text-textPrimary">No produce matches your search</p>
            <p className="text-xs text-textMuted max-w-sm mx-auto">
              Try adjusting your search terms or selecting a different category.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategorySlug(null);
              }}
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Transparent Pricing Policy Banner */}
      <section className="bg-slate-50 rounded-2xl border border-borderSubtle p-6 sm:p-8 space-y-6">
        <div className="space-y-1">
          <Badge variant="success">Authoritative Pricing Model</Badge>
          <h2 className="text-xl sm:text-2xl font-bold text-textPrimary tracking-tight">
            Transparent Pricing Policy
          </h2>
          <p className="text-xs sm:text-sm text-textMuted">
            Zero surge pricing. Every order follows our verified rules enforced by backend contracts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <Card padding="md" className="space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-textPrimary">Order Below ₹99</span>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                Standard Delivery
              </span>
            </div>
            <div className="text-xs space-y-1.5 text-textMuted border-t border-borderSubtle pt-2">
              <div className="flex justify-between">
                <span>Produce Subtotal:</span>
                <span className="font-semibold text-textPrimary">{formatINR(exampleSub90.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Packaging Fee:</span>
                <span className="font-semibold text-textPrimary">{formatINR(exampleSub90.packagingFee)}</span>
              </div>
              <div className="flex justify-between">
                <span>Standard Delivery Fee:</span>
                <span className="font-semibold text-textPrimary">{formatINR(exampleSub90.deliveryFee)}</span>
              </div>
              <div className="flex justify-between font-bold text-brand-900 border-t border-borderSubtle pt-1 text-sm">
                <span>Total Amount:</span>
                <span className="font-black">{formatINR(exampleSub90.total)}</span>
              </div>
            </div>
          </Card>

          <Card padding="md" className="space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-textPrimary">Order ₹99 &amp; Above</span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                FREE Delivery
              </span>
            </div>
            <div className="text-xs space-y-1.5 text-textMuted border-t border-borderSubtle pt-2">
              <div className="flex justify-between">
                <span>Produce Subtotal:</span>
                <span className="font-semibold text-textPrimary">{formatINR(example150.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Packaging Fee:</span>
                <span className="font-semibold text-textPrimary">{formatINR(example150.packagingFee)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Delivery Fee:</span>
                <span>FREE (Saved ₹40.00)</span>
              </div>
              <div className="flex justify-between font-bold text-brand-900 border-t border-borderSubtle pt-1 text-sm">
                <span>Total Amount:</span>
                <span className="font-black">{formatINR(example150.total)}</span>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
