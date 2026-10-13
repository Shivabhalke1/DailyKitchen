'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  api,
  CategoryRead,
  ProductRead,
  ProductVariantRead,
  CategoryCreate,
  ProductCreate,
  VariantCreate,
} from '@/lib/api-client';

export default function AdminCatalogPage() {
  const [categories, setCategories] = useState<CategoryRead[]>([]);
  const [products, setProducts] = useState<ProductRead[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals state
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [showVariantModal, setShowVariantModal] = useState<boolean>(false);
  const [targetProduct, setTargetProduct] = useState<ProductRead | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Deletion state
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryRead | null>(null);
  const [productToDelete, setProductToDelete] = useState<ProductRead | null>(null);
  const [variantToDelete, setVariantToDelete] = useState<{
    variant: ProductVariantRead;
    productName: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // New Category Form
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catImage, setCatImage] = useState('');
  const [catOrder, setCatOrder] = useState('1');

  // New Product Form
  const [prodCatId, setProdCatId] = useState('');
  const [prodName, setProdName] = useState('');
  const [prodSlug, setProdSlug] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodImage, setProdImage] = useState('');
  const [prodFresh, setProdFresh] = useState(true);
  const [prodWeight, setProdWeight] = useState('500g');
  const [prodGrams, setProdGrams] = useState('500');
  const [prodPrice, setProdPrice] = useState('40.00');
  const [prodMrp, setProdMrp] = useState('50.00');
  const [prodStock, setProdStock] = useState('50');

  // New Variant Form
  const [varWeight, setVarWeight] = useState('500g');
  const [varGrams, setVarGrams] = useState('500');
  const [varPrice, setVarPrice] = useState('40.00');
  const [varMrp, setVarMrp] = useState('45.00');
  const [varStock, setVarStock] = useState('50');

  const fetchCatalog = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [cats, prods] = await Promise.all([
        api.catalog.getCategories(),
        api.catalog.getProducts({ page: 1, page_size: 100 }),
      ]);
      setCategories(cats || []);
      setProducts(prods.items || []);
      if (cats.length > 0 && !prodCatId) {
        setProdCatId(cats[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load catalog.');
    } finally {
      setIsLoading(false);
    }
  }, [prodCatId]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const payload: CategoryCreate = {
        name: catName.trim(),
        slug: catSlug.trim().toLowerCase().replace(/\s+/g, '-'),
        image_url: catImage.trim() || 'https://images.dailykitchen.com/categories/fresh.jpg',
        display_order: parseInt(catOrder) || 1,
      };
      await api.admin.catalog.createCategory(payload);
      setShowCategoryModal(false);
      setCatName('');
      setCatSlug('');
      setCatImage('');
      setActionSuccess(`Category '${payload.name}' created successfully.`);
      await fetchCatalog();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create category.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const payload: ProductCreate = {
        category_id: prodCatId,
        name: prodName.trim(),
        slug: prodSlug.trim().toLowerCase().replace(/\s+/g, '-'),
        description: prodDesc.trim(),
        image_url: prodImage.trim() || 'https://images.dailykitchen.com/products/fresh.jpg',
        is_fresh_today: prodFresh,
        is_popular: false,
      };
      const createdProd = await api.admin.catalog.createProduct(payload);

      // Automatically initialize weight variant & inventory stock so produce syncs immediately
      if (prodWeight.trim() && prodPrice.trim() && createdProd?.id) {
        try {
          const varPayload: VariantCreate = {
            weight_label: prodWeight.trim(),
            weight_grams: parseInt(prodGrams) || 500,
            price: prodPrice.trim(),
            mrp: prodMrp.trim() || prodPrice.trim(),
            display_order: 0,
          };
          const createdVar = await api.admin.catalog.createVariant(createdProd.id, varPayload);
          const stockNum = parseInt(prodStock) || 0;
          if (stockNum > 0 && createdVar?.id) {
            await api.admin.catalog.adjustInventory(createdVar.id, {
              delta: stockNum,
              reason: 'Initial harvest stock intake',
            });
          }
        } catch {
          // Variant creation can be supplemented later
        }
      }

      setShowProductModal(false);
      setProdName('');
      setProdSlug('');
      setProdDesc('');
      setProdImage('');
      setActionSuccess(`Produce '${payload.name}' created successfully.`);
      await fetchCatalog();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create product.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProduct) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const payload: VariantCreate = {
        weight_label: varWeight.trim(),
        weight_grams: parseInt(varGrams) || 500,
        price: varPrice.trim(),
        mrp: varMrp.trim(),
        display_order: 0,
      };
      const createdVar = await api.admin.catalog.createVariant(targetProduct.id, payload);
      const stockNum = parseInt(varStock) || 0;
      if (stockNum > 0) {
        await api.admin.catalog.adjustInventory(createdVar.id, {
          delta: stockNum,
          reason: 'Initial stock intake upon variant creation',
        });
      }
      setShowVariantModal(false);
      setTargetProduct(null);
      setActionSuccess(`Variant '${payload.weight_label}' added to ${targetProduct.name}.`);
      await fetchCatalog();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create variant.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await api.admin.catalog.deleteCategory(categoryToDelete.id);
      if (selectedCategory === categoryToDelete.id) {
        setSelectedCategory('all');
      }
      setCategoryToDelete(null);
      setActionSuccess(res.message || `Category '${categoryToDelete.name}' deleted.`);
      await fetchCatalog();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete category.');
    } finally {
      setDeleting(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await api.admin.catalog.deleteProduct(productToDelete.id);
      setProductToDelete(null);
      setActionSuccess(res.message || `Produce item '${productToDelete.name}' deleted.`);
      await fetchCatalog();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete produce item.');
    } finally {
      setDeleting(false);
    }
  };

  // Delete Variant
  const handleDeleteVariant = async () => {
    if (!variantToDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await api.admin.catalog.deleteVariant(variantToDelete.variant.id);
      setVariantToDelete(null);
      setActionSuccess(
        res.message ||
          `Variant '${variantToDelete.variant.weight_label}' deleted from ${variantToDelete.productName}.`
      );
      await fetchCatalog();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete variant.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (selectedCategory === 'all') return true;
    return p.category_id === selectedCategory;
  });

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Produce Catalog &amp; Variant Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Produce taxonomy, multi-variant weights, pricing, and morning freshness flags
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setFormError(null);
              setShowCategoryModal(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold min-h-[44px] transition-colors"
          >
            + Add Category
          </button>
          <button
            onClick={() => {
              setFormError(null);
              setShowProductModal(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold min-h-[44px] transition-colors"
          >
            + Add Produce
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div
          role="status"
          className="p-4 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-sm flex items-center justify-between"
        >
          <span>{actionSuccess}</span>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-sm flex items-center justify-between"
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-200 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Category Filter Pills & Category Deletion */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[40px] transition-colors ${
            selectedCategory === 'all'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
          }`}
        >
          All Categories ({products.length})
        </button>

        {categories.map((c) => {
          const count = products.filter((p) => p.category_id === c.id).length;
          const isSelected = selectedCategory === c.id;
          return (
            <div
              key={c.id}
              className={`inline-flex items-center rounded-lg border text-xs font-semibold whitespace-nowrap min-h-[40px] transition-all ${
                isSelected
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                className="pl-3.5 pr-2 py-2 flex items-center gap-1.5 focus:outline-none"
              >
                <span>{c.name}</span>
                <span className={isSelected ? 'text-emerald-100 font-mono' : 'text-slate-500 font-mono'}>
                  ({count})
                </span>
              </button>
              <button
                type="button"
                title={`Delete category '${c.name}'`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCategoryToDelete(c);
                }}
                className={`pr-2.5 pl-1 py-2 transition-colors ${
                  isSelected
                    ? 'text-emerald-200 hover:text-white'
                    : 'text-slate-500 hover:text-rose-400'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* Produce Cards Grid (Square Shape) */}
      <div>
        {isLoading ? (
          <div className="py-20 text-center text-slate-500">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <span className="text-sm">Loading produce catalog...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-3">
            <p className="font-bold text-slate-200 text-base">Catalog is Fresh &amp; Empty</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No categories or produce items have been created yet. Click &quot;+ Add Category&quot; above to create your first authentic category.
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 rounded-xl bg-slate-900 border border-slate-800 text-center text-slate-500 text-sm">
            No produce found in this category.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {filteredProducts.map((p) => {
              const cat = categories.find((c) => c.id === p.category_id);
              const variants = p.variants || [];

              return (
                <div
                  key={p.id}
                  className="aspect-square p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all duration-200 shadow-md group relative flex flex-col justify-between overflow-hidden"
                >
                  {/* Top Bar: Category pill, Freshness badge & Delete Produce Button */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-950 border border-slate-800 text-slate-400">
                        {cat?.name || 'Produce'}
                      </span>
                      {p.is_fresh_today && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-950 border border-emerald-800 text-emerald-400">
                          Fresh Today
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      title={`Delete produce '${p.name}'`}
                      onClick={() => setProductToDelete(p)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Produce Visual & Title Info */}
                  <div className="flex items-center gap-3 my-1">
                    <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 shrink-0 flex items-center justify-center text-2xl shadow-inner">
                      🥦
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-bold text-white text-base truncate" title={p.name}>
                        {p.name}
                      </h2>
                      <p className="text-xs text-slate-400 line-clamp-1" title={p.description}>
                        {p.description || 'Fresh morning harvest'}
                      </p>
                    </div>
                  </div>

                  {/* Scrollable Compact Variants Container (Fits nicely inside square) */}
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 flex-1 min-h-[90px] max-h-[140px] overflow-y-auto space-y-2 divide-y divide-slate-800/50 custom-scrollbar">
                    {variants.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-[11px] text-slate-500 text-center py-4">
                        No active weight variants configured.
                      </div>
                    ) : (
                      variants.map((v: ProductVariantRead) => (
                        <div
                          key={v.id}
                          className="pt-1.5 first:pt-0 flex items-center justify-between text-xs"
                        >
                          <div className="min-w-0 flex items-center gap-1">
                            <span className="font-semibold text-slate-200">
                              {v.weight_label}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              ({v.weight_grams}g)
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5 font-mono">
                            <span className="text-emerald-400 text-[11px] font-bold whitespace-nowrap">
                              {v.inventory?.stock_quantity ?? 0} in stock
                            </span>
                            <div className="text-right whitespace-nowrap">
                              <span className="font-bold text-white">₹{v.price}</span>
                              {v.mrp && Number(v.mrp) > Number(v.price) && (
                                <span className="text-slate-500 line-through text-[10px] ml-1">
                                  ₹{v.mrp}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              title={`Delete ${v.weight_label} variant`}
                              onClick={() =>
                                setVariantToDelete({ variant: v, productName: p.name })
                              }
                              className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors"
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Card Footer: Add Variant */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetProduct(p);
                        setFormError(null);
                        setShowVariantModal(true);
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-400 text-xs font-semibold min-h-[36px] transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>+ Add Variant</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Category Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white">
              Delete Category: {categoryToDelete.name}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to delete this category? Any produce items within this category that have not been ordered will also be deleted.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                disabled={deleting}
                onClick={handleDeleteCategory}
                className="flex-1 py-2.5 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs min-h-[44px] transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Category'}
              </button>
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Produce Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white">
              Delete Produce: {productToDelete.name}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to delete this produce item and all its weight variants from the catalog?
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                disabled={deleting}
                onClick={handleDeleteProduct}
                className="flex-1 py-2.5 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs min-h-[44px] transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Produce'}
              </button>
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Variant Confirmation Modal */}
      {variantToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white">
              Delete Variant: {variantToDelete.variant.weight_label}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to delete the {variantToDelete.variant.weight_label} variant from{' '}
              {variantToDelete.productName}?
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                disabled={deleting}
                onClick={handleDeleteVariant}
                className="flex-1 py-2.5 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs min-h-[44px] transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Variant'}
              </button>
              <button
                type="button"
                onClick={() => setVariantToDelete(null)}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white">Add Produce Category</h2>
            {formError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-rose-950 border border-rose-800 text-rose-300 text-xs"
              >
                {formError}
              </div>
            )}
            <form onSubmit={handleCreateCategory} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold uppercase text-slate-300 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => {
                    setCatName(e.target.value);
                    if (!catSlug) setCatSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                  }}
                  placeholder="e.g. Hydroponic Greens"
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 min-h-[40px]"
                />
              </div>
              <div>
                <label className="block font-semibold uppercase text-slate-300 mb-1">Slug</label>
                <input
                  type="text"
                  required
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value)}
                  placeholder="hydroponic-greens"
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 min-h-[40px]"
                />
              </div>
              <div>
                <label className="block font-semibold uppercase text-slate-300 mb-1">
                  Image URL
                </label>
                <input
                  type="url"
                  value={catImage}
                  onChange={(e) => setCatImage(e.target.value)}
                  placeholder="https://images.dailykitchen.com/categories/greens.jpg"
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 min-h-[40px]"
                />
              </div>
              <div>
                <label className="block font-semibold uppercase text-slate-300 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={catOrder}
                  onChange={(e) => setCatOrder(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 min-h-[40px]"
                />
              </div>
              <div className="flex gap-3 pt-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold min-h-[44px] transition-colors"
                >
                  {submitting ? 'Saving...' : 'Save Category'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 text-slate-300 font-semibold min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-white">Add Fresh Produce Item</h2>
            {formError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-rose-950 border border-rose-800 text-rose-300 text-xs"
              >
                {formError}
              </div>
            )}
            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold uppercase text-slate-300 mb-1">Category</label>
                <select
                  required
                  value={prodCatId}
                  onChange={(e) => setProdCatId(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 min-h-[40px]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold uppercase text-slate-300 mb-1">
                  Produce Name
                </label>
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={(e) => {
                    setProdName(e.target.value);
                    if (!prodSlug) setProdSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                  }}
                  placeholder="e.g. Crisp Farm Spinach"
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 min-h-[40px]"
                />
              </div>
              <div>
                <label className="block font-semibold uppercase text-slate-300 mb-1">Slug</label>
                <input
                  type="text"
                  required
                  value={prodSlug}
                  onChange={(e) => setProdSlug(e.target.value)}
                  placeholder="crisp-farm-spinach"
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 min-h-[40px]"
                />
              </div>
              <div>
                <label className="block font-semibold uppercase text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  required
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  placeholder="Pesticide-free leafy greens directly harvested this morning..."
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100"
                />
              </div>
              <div className="pt-2 border-t border-slate-800 space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Initial Pack Size &amp; Pricing
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1">
                      Weight Label
                    </label>
                    <input
                      type="text"
                      value={prodWeight}
                      onChange={(e) => setProdWeight(e.target.value)}
                      placeholder="e.g. 500g, 1 kg"
                      className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 min-h-[36px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1">
                      Initial Stock (Packs)
                    </label>
                    <input
                      type="number"
                      value={prodStock}
                      onChange={(e) => setProdStock(e.target.value)}
                      className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 min-h-[36px]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1">
                      Selling Price (₹)
                    </label>
                    <input
                      type="text"
                      value={prodPrice}
                      onChange={(e) => setProdPrice(e.target.value)}
                      placeholder="40.00"
                      className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 min-h-[36px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1">
                      MRP (₹)
                    </label>
                    <input
                      type="text"
                      value={prodMrp}
                      onChange={(e) => setProdMrp(e.target.value)}
                      placeholder="50.00"
                      className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 min-h-[36px]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="freshCheck"
                  type="checkbox"
                  checked={prodFresh}
                  onChange={(e) => setProdFresh(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="freshCheck" className="text-slate-300 font-medium">
                  Flag as &ldquo;Fresh Harvest Today&rdquo;
                </label>
              </div>
              <div className="flex gap-3 pt-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold min-h-[44px] transition-colors"
                >
                  {submitting ? 'Saving...' : 'Save Produce'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 text-slate-300 font-semibold min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Variant Modal */}
      {showVariantModal && targetProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white">
              Add Variant to {targetProduct.name}
            </h2>
            {formError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-rose-950 border border-rose-800 text-rose-300 text-xs"
              >
                {formError}
              </div>
            )}
            <form onSubmit={handleCreateVariant} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-slate-300 mb-1">
                    Weight Label
                  </label>
                  <input
                    type="text"
                    required
                    value={varWeight}
                    onChange={(e) => setVarWeight(e.target.value)}
                    placeholder="e.g. 500g or 1 bunch"
                    className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 min-h-[40px]"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-slate-300 mb-1">
                    Weight (Grams)
                  </label>
                  <input
                    type="number"
                    required
                    value={varGrams}
                    onChange={(e) => setVarGrams(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 min-h-[40px]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-slate-300 mb-1">
                    Selling Price (₹)
                  </label>
                  <input
                    type="text"
                    required
                    value={varPrice}
                    onChange={(e) => setVarPrice(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 min-h-[40px]"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-slate-300 mb-1">MRP (₹)</label>
                  <input
                    type="text"
                    required
                    value={varMrp}
                    onChange={(e) => setVarMrp(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 min-h-[40px]"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold uppercase text-slate-300 mb-1">
                  Initial Stock Quantity
                </label>
                <input
                  type="number"
                  required
                  value={varStock}
                  onChange={(e) => setVarStock(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 min-h-[40px]"
                />
              </div>
              <div className="flex gap-3 pt-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold min-h-[44px] transition-colors"
                >
                  {submitting ? 'Creating...' : 'Create Variant'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowVariantModal(false)}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 text-slate-300 font-semibold min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
