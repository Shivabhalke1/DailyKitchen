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
  Scale,
  Zap,
  CheckCircle2,
  Star,
  Clock,
} from 'lucide-react';
import { calculatePricing, formatINR } from '@dailykitchen/shared-utils';

const ROTATING_PHRASES = [
  { text: 'Crisp Daily Greens', highlight: 'from-emerald-300 via-teal-200 to-emerald-400', emoji: '🥬' },
  { text: 'Sun-Ripened Tomatoes', highlight: 'from-rose-400 via-amber-300 to-orange-300', emoji: '🍅' },
  { text: 'Farm-Fresh Veggies', highlight: 'from-lime-300 via-emerald-300 to-teal-200', emoji: '🥦' },
  { text: 'Sweet Orchard Fruits', highlight: 'from-amber-300 via-orange-300 to-rose-300', emoji: '🍎' },
  { text: 'A2 Fresh Farm Milk', highlight: 'from-sky-300 via-teal-200 to-emerald-300', emoji: '🥛' },
];

export default function HomePage() {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % ROTATING_PHRASES.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  const currentPhrase = ROTATING_PHRASES[phraseIndex];

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
      {/* Hero Showcase Section - Dynamic Living Harvest UI */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-950 via-[#031d14] to-slate-950 text-white border border-emerald-500/20 shadow-2xl shadow-emerald-950/60 ring-1 ring-white/10">
        {/* Multilayered ambient animated lighting */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-[100px] pointer-events-none animate-ambient-pulse" />
        <div className="absolute top-1/2 -right-32 w-[30rem] h-[30rem] bg-teal-500/15 rounded-full blur-[120px] pointer-events-none animate-ambient-pulse" style={{ animationDelay: '3s' }} />
        <div className="absolute -bottom-24 left-1/3 w-80 h-80 bg-amber-400/10 rounded-full blur-[90px] pointer-events-none animate-ambient-pulse" style={{ animationDelay: '1.5s' }} />

        {/* Ambient fine dot grid overlay */}
        <div 
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center p-6 sm:p-10 lg:p-12">
          {/* Left Column: Kinetic Headlines, Search, & Live Hub Ticker */}
          <div className="lg:col-span-7 space-y-6">
            {/* Kinetic Dynamic Headline */}
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-5xl lg:text-[54px] font-black tracking-tight leading-[1.12] text-white">
                Farm to Kitchen. <br />
                <span className="inline-flex items-center gap-2.5 mt-1 flex-wrap">
                  <span className={`bg-gradient-to-r ${currentPhrase.highlight} bg-clip-text text-transparent transition-all duration-500`}>
                    {currentPhrase.text}
                  </span>
                  <span className="text-3xl sm:text-4xl inline-block transition-transform duration-300 hover:scale-125">
                    {currentPhrase.emoji}
                  </span>
                </span>
              </h1>
              <p className="text-sm sm:text-base text-slate-300/90 leading-relaxed max-w-xl font-normal">
                Directly harvested at dawn from local Karnataka partner farms. Delivered within 30 minutes with certified 100% digital tare-weight transparency and zero storage loss.
              </p>
            </div>

            {/* Interactive Search Bar & Quick Filtering Chips */}
            <div className="space-y-3 pt-1 max-w-xl">
              <div className="relative flex items-center shadow-2xl rounded-2xl group transition-all duration-300 focus-within:scale-[1.01]">
                <Search className="w-5 h-5 text-emerald-400 absolute left-4 pointer-events-none group-focus-within:text-emerald-300 transition-colors" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search fresh tomatoes, palak, carrots, onions..."
                  aria-label="Search produce"
                  className="w-full pl-12 pr-20 py-4 text-sm sm:text-base rounded-2xl bg-white/[0.07] hover:bg-white/[0.1] text-white placeholder:text-slate-400 focus:outline-none focus:bg-slate-900/90 focus:ring-2 focus:ring-emerald-400/80 border border-white/15 focus:border-emerald-400 shadow-inner font-medium backdrop-blur-xl transition-all"
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                ) : (
                  <div className="absolute right-3.5 hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-[10px] text-slate-400 font-mono">
                    <span>Quick Find</span>
                  </div>
                )}
              </div>

              {/* Quick Search Chips */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-slate-400 font-semibold text-xs mr-0.5">Popular:</span>
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
                    className="px-3 py-1 rounded-full bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-400/40 text-slate-300 hover:text-emerald-200 text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Transparency Pillars */}
            <div className="grid grid-cols-3 gap-3 pt-2 max-w-xl border-t border-white/10">
              <div className="p-3 rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/10 hover:border-emerald-500/40 transition-all duration-300 group">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-center text-emerald-300 mb-2 group-hover:scale-110 transition-transform">
                  <Truck className="w-4 h-4" />
                </div>
                <div className="font-bold text-white text-xs sm:text-sm">25-30 Min</div>
                <div className="text-[11px] text-slate-400">Hyperlocal Hubs</div>
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/10 hover:border-emerald-500/40 transition-all duration-300 group">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-300 mb-2 group-hover:scale-110 transition-transform">
                  <Scale className="w-4 h-4" />
                </div>
                <div className="font-bold text-white text-xs sm:text-sm">0g Tare Fraud</div>
                <div className="text-[11px] text-slate-400">100% Net Weight</div>
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/10 hover:border-emerald-500/40 transition-all duration-300 group">
                <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-400/30 flex items-center justify-center text-teal-300 mb-2 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="font-bold text-white text-xs sm:text-sm">Ozone Washed</div>
                <div className="text-[11px] text-slate-400">0% Harmful Residue</div>
              </div>
            </div>
          </div>

          {/* Right Column: Clean, Cinematic Harvest Visual Showcase */}
          <div className="lg:col-span-5 relative flex items-center justify-center pt-6 lg:pt-0">
            <div className="relative w-full max-w-md lg:max-w-none">
              
              {/* Layered Ambient Light Glow */}
              <div className="absolute -inset-4 bg-gradient-to-tr from-emerald-500/25 via-teal-400/20 to-lime-500/25 rounded-3xl blur-3xl opacity-60 animate-ambient-pulse pointer-events-none" />

              {/* Main Visual Harvest Showcase Card */}
              <div className="relative rounded-3xl overflow-hidden border border-white/20 bg-slate-900/90 shadow-2xl shadow-emerald-950/80 group">
                <div className="aspect-[4/3] w-full overflow-hidden relative">
                  <img
                    src="/images/hero-harvest.jpg"
                    alt="DailyKitchen Dawn Farm Harvest"
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-1000 ease-out"
                  />
                  {/* Subtle vignette overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent pointer-events-none" />
                </div>

                {/* Clean, Integrated Bottom Status Bar */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between bg-slate-950/85 backdrop-blur-xl px-4 py-3 rounded-2xl border border-white/15 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-bold text-base">
                      🌱
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Pesticide-Free Certified</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div className="text-[10px] text-slate-300">Cleaned &amp; ozone sanitised &bull; 4:30 AM Pick</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>4.96</span>
                  </div>
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
