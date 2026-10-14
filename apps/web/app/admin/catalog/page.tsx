'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  api,
  CategoryRead,
  ProductRead,
  ProductVariantRead,
  CategoryCreate,
  CategoryUpdate,
  ProductCreate,
  ProductUpdate,
  VariantCreate,
} from '@/lib/api-client';
import {
  Upload,
  Image as ImageIcon,
  Edit2,
  Trash2,
  Plus,
  Check,
  X,
  Search,
  Filter,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Tag,
  IndianRupee,
  Layers,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Package,
  Sparkles,
  Loader2,
  ExternalLink,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* Subcomponent: ImageUploadField with Device File Picker & Live Preview       */
/* -------------------------------------------------------------------------- */
interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

function ImageUploadField({ label, value, onChange, disabled }: ImageUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(value);

  useEffect(() => {
    setPreviewUrl(value);
  }, [value]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validate supported image format
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Unsupported format. Please choose a JPEG, PNG, WebP, or GIF image.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed is 5MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Instant local preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Upload to server storage
    setUploading(true);
    try {
      const res = await api.admin.catalog.uploadImage(file);
      if (res?.image_url) {
        onChange(res.image_url);
        setPreviewUrl(res.image_url);
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload image. Please try again.');
      setPreviewUrl(value);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onChange('');
    setPreviewUrl('');
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-slate-300">{label}</label>

      {/* Hidden system file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploading}
      />

      <div className="flex items-start gap-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
        {/* Preview Thumbnail Box */}
        <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-slate-900 border border-slate-700/80 flex items-center justify-center shrink-0">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={() => {}}
            />
          ) : (
            <div className="text-center p-2 text-slate-500">
              <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-60" />
              <span className="text-[10px]">No image</span>
            </div>
          )}

          {uploading && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-1">
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
              <span className="text-[9px] text-emerald-300 font-medium">Uploading...</span>
            </div>
          )}
        </div>

        {/* Upload Controls & Description */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{previewUrl ? 'Replace Image' : 'Choose from Device'}</span>
            </button>

            {previewUrl && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled || uploading}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800 text-xs font-semibold inline-flex items-center gap-1 transition-all disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-400 leading-tight">
            Select files from Desktop, Downloads, or local folders (JPEG, PNG, WebP, max 5MB).
          </p>

          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Or enter image URL (/uploads/... or https://...)"
            className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700/60 text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />

          {uploadError && (
            <p className="text-xs text-rose-400 font-medium flex items-center gap-1 pt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{uploadError}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Admin Catalog & Pricing & Image Management Component                  */
/* -------------------------------------------------------------------------- */
export default function AdminCatalogPage() {
  const [activeTab, setActiveTab] = useState<'items' | 'categories'>('items');
  const [categories, setCategories] = useState<CategoryRead[]>([]);
  const [products, setProducts] = useState<ProductRead[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters & Search
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'fresh'>('all');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  // Inline Quick Price Edit State
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [quickPrice, setQuickPrice] = useState('');
  const [quickMrp, setQuickMrp] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  // Category Modal State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRead | null>(null);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catImage, setCatImage] = useState('');
  const [catDefaultPrice, setCatDefaultPrice] = useState('');
  const [catOrder, setCatOrder] = useState('1');
  const [catActive, setCatActive] = useState(true);

  // Product Modal State
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRead | null>(null);
  const [prodCatId, setProdCatId] = useState('');
  const [prodName, setProdName] = useState('');
  const [prodSlug, setProdSlug] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodImage, setProdImage] = useState('');
  const [prodPrice, setProdPrice] = useState('40.00');
  const [prodMrp, setProdMrp] = useState('50.00');
  const [prodWeight, setProdWeight] = useState('500g');
  const [prodGrams, setProdGrams] = useState('500');
  const [prodStock, setProdStock] = useState('50');
  const [prodFresh, setProdFresh] = useState(true);
  const [prodActive, setProdActive] = useState(true);

  // Variant Modal State
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [targetProduct, setTargetProduct] = useState<ProductRead | null>(null);
  const [varWeight, setVarWeight] = useState('500g');
  const [varGrams, setVarGrams] = useState('500');
  const [varPrice, setVarPrice] = useState('40.00');
  const [varMrp, setVarMrp] = useState('45.00');
  const [varStock, setVarStock] = useState('50');

  // Deletion State
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryRead | null>(null);
  const [productToDelete, setProductToDelete] = useState<ProductRead | null>(null);
  const [variantToDelete, setVariantToDelete] = useState<{
    variant: ProductVariantRead;
    productName: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Expanded variant rows
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());

  const toggleExpand = (productId: string) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  /* -------------------------------------------------------------------------- */
  /* Data Fetching                                                              */
  /* -------------------------------------------------------------------------- */
  const fetchCatalog = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [cats, prods] = await Promise.all([
        api.admin.catalog.getCategories(),
        api.admin.catalog.getProducts(),
      ]);
      setCategories(cats || []);
      setProducts(prods || []);
      if (cats.length > 0 && !prodCatId) {
        setProdCatId(cats[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load catalog data from server.');
    } finally {
      setIsLoading(false);
    }
  }, [prodCatId]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  /* -------------------------------------------------------------------------- */
  /* Category Modal Handlers                                                    */
  /* -------------------------------------------------------------------------- */
  const openAddCategory = () => {
    setEditingCategory(null);
    setCatName('');
    setCatSlug('');
    setCatDesc('');
    setCatImage('');
    setCatDefaultPrice('');
    setCatOrder(String(categories.length + 1));
    setCatActive(true);
    setFormError(null);
    setShowCategoryModal(true);
  };

  const openEditCategory = (cat: CategoryRead) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatSlug(cat.slug);
    setCatDesc(cat.description || '');
    setCatImage(cat.image_url || '');
    setCatDefaultPrice(cat.default_price ? String(cat.default_price) : '');
    setCatOrder(String(cat.display_order ?? 0));
    setCatActive(cat.is_active);
    setFormError(null);
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    const nameTrimmed = catName.trim();
    if (!nameTrimmed) {
      setFormError('Category name is required.');
      setSubmitting(false);
      return;
    }

    const slugFormatted = (catSlug.trim() || nameTrimmed).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const imageFormatted = catImage.trim() || '/images/hero-harvest.jpg';
    const defaultPriceVal = catDefaultPrice.trim() ? catDefaultPrice.trim() : null;

    try {
      if (editingCategory) {
        // Update existing category
        const payload: CategoryUpdate = {
          name: nameTrimmed,
          slug: slugFormatted,
          description: catDesc.trim() || undefined,
          image_url: imageFormatted,
          display_order: parseInt(catOrder) || 0,
          is_active: catActive,
          default_price: defaultPriceVal,
        };
        await api.admin.catalog.updateCategory(editingCategory.id, payload);
        setActionSuccess(`Category '${nameTrimmed}' updated successfully.`);
      } else {
        // Create new category
        const payload: CategoryCreate = {
          name: nameTrimmed,
          slug: slugFormatted,
          description: catDesc.trim() || undefined,
          image_url: imageFormatted,
          display_order: parseInt(catOrder) || 0,
          is_active: catActive,
          default_price: defaultPriceVal,
        };
        await api.admin.catalog.createCategory(payload);
        setActionSuccess(`Category '${nameTrimmed}' created successfully.`);
      }
      setShowCategoryModal(false);
      await fetchCatalog();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save category.');
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Item Modal Handlers                                                        */
  /* -------------------------------------------------------------------------- */
  const openAddProduct = () => {
    setEditingProduct(null);
    setProdCatId(categories[0]?.id || '');
    setProdName('');
    setProdSlug('');
    setProdDesc('');
    setProdImage('');

    // Pre-populate price with category default if available
    const selectedCat = categories.find((c) => c.id === (categories[0]?.id || ''));
    const initialPrice = selectedCat?.default_price ? String(selectedCat.default_price) : '40.00';
    setProdPrice(initialPrice);
    setProdMrp(String(Math.round(Number(initialPrice) * 1.25)));
    setProdWeight('500g');
    setProdGrams('500');
    setProdStock('50');
    setProdFresh(true);
    setProdActive(true);
    setFormError(null);
    setShowProductModal(true);
  };

  const openEditProduct = (prod: ProductRead) => {
    setEditingProduct(prod);
    setProdCatId(prod.category_id);
    setProdName(prod.name);
    setProdSlug(prod.slug);
    setProdDesc(prod.description || '');
    setProdImage(prod.image_url || '');

    const primaryVariant = prod.variants?.[0];
    setProdPrice(primaryVariant ? String(primaryVariant.price) : '40.00');
    setProdMrp(primaryVariant ? String(primaryVariant.mrp) : '50.00');
    setProdFresh(prod.is_fresh_today);
    setProdActive(prod.is_active);
    setFormError(null);
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    const nameTrimmed = prodName.trim();
    if (!nameTrimmed) {
      setFormError('Item name is required.');
      setSubmitting(false);
      return;
    }
    if (!prodCatId) {
      setFormError('Please select a category for this item.');
      setSubmitting(false);
      return;
    }

    const slugFormatted = (prodSlug.trim() || nameTrimmed).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const imageFormatted = prodImage.trim() || '/images/hero-harvest.jpg';

    try {
      if (editingProduct) {
        // Update product details
        const payload: ProductUpdate = {
          category_id: prodCatId,
          name: nameTrimmed,
          slug: slugFormatted,
          description: prodDesc.trim(),
          image_url: imageFormatted,
          is_fresh_today: prodFresh,
          is_active: prodActive,
        };
        await api.admin.catalog.updateProduct(editingProduct.id, payload);

        // Update primary variant selling price if specified
        if (prodPrice.trim()) {
          await api.admin.catalog.updateProductPricing(editingProduct.id, {
            price: prodPrice.trim(),
            mrp: prodMrp.trim() || prodPrice.trim(),
          });
        }
        setActionSuccess(`Item '${nameTrimmed}' updated successfully.`);
      } else {
        // Create product
        const payload: ProductCreate = {
          category_id: prodCatId,
          name: nameTrimmed,
          slug: slugFormatted,
          description: prodDesc.trim(),
          image_url: imageFormatted,
          is_fresh_today: prodFresh,
          is_popular: false,
          is_active: prodActive,
        };
        const createdProd = await api.admin.catalog.createProduct(payload);

        // Initialize variant & stock
        if (createdProd?.id && prodWeight.trim() && prodPrice.trim()) {
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
                reason: 'Initial harvest intake upon item creation',
              });
            }
          } catch {
            // Variant can be supplemented
          }
        }
        setActionSuccess(`Item '${nameTrimmed}' created with price ₹${prodPrice.trim()}.`);
      }
      setShowProductModal(false);
      await fetchCatalog();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save item.');
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Quick Inline Selling Price Update Handler                                  */
  /* -------------------------------------------------------------------------- */
  const startQuickPriceEdit = (prod: ProductRead) => {
    const primary = prod.variants?.[0];
    setEditingPriceId(prod.id);
    setQuickPrice(primary ? String(primary.price) : '40.00');
    setQuickMrp(primary ? String(primary.mrp) : '50.00');
  };

  const saveQuickPrice = async (prodId: string) => {
    if (!quickPrice.trim()) return;
    setSavingPrice(true);
    setError(null);
    try {
      await api.admin.catalog.updateProductPricing(prodId, {
        price: quickPrice.trim(),
        mrp: quickMrp.trim() || quickPrice.trim(),
      });
      setEditingPriceId(null);
      setActionSuccess('Selling price updated across the website, cart, and checkout.');
      await fetchCatalog();
    } catch (err: any) {
      setError(err?.message || 'Failed to update item price.');
    } finally {
      setSavingPrice(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Add Variant Handler                                                        */
  /* -------------------------------------------------------------------------- */
  const openAddVariant = (prod: ProductRead) => {
    setTargetProduct(prod);
    setVarWeight('1 kg');
    setVarGrams('1000');
    setVarPrice('75.00');
    setVarMrp('85.00');
    setVarStock('40');
    setFormError(null);
    setShowVariantModal(true);
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
        mrp: varMrp.trim() || varPrice.trim(),
        display_order: targetProduct.variants.length,
      };
      const createdVar = await api.admin.catalog.createVariant(targetProduct.id, payload);
      const stockNum = parseInt(varStock) || 0;
      if (stockNum > 0) {
        await api.admin.catalog.adjustInventory(createdVar.id, {
          delta: stockNum,
          reason: 'Initial intake for weight pack',
        });
      }
      setShowVariantModal(false);
      setTargetProduct(null);
      setActionSuccess(`Pack size '${payload.weight_label}' added to ${targetProduct.name}.`);
      await fetchCatalog();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to add variant pack.');
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Delete Handlers                                                            */
  /* -------------------------------------------------------------------------- */
  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await api.admin.catalog.deleteCategory(categoryToDelete.id);
      setCategoryToDelete(null);
      setActionSuccess(res.message || `Category '${categoryToDelete.name}' deleted.`);
      await fetchCatalog();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete category.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await api.admin.catalog.deleteProduct(productToDelete.id);
      setProductToDelete(null);
      setActionSuccess(res.message || `Item '${productToDelete.name}' deleted.`);
      await fetchCatalog();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete item.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteVariant = async () => {
    if (!variantToDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await api.admin.catalog.deleteVariant(variantToDelete.variant.id);
      setVariantToDelete(null);
      setActionSuccess(res.message || `Pack '${variantToDelete.variant.weight_label}' deleted.`);
      await fetchCatalog();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete pack variant.');
    } finally {
      setDeleting(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Filtered Lists                                                             */
  /* -------------------------------------------------------------------------- */
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter
      if (categoryFilter !== 'all' && p.category_id !== categoryFilter) return false;

      // Status filter
      if (statusFilter === 'active' && !p.is_active) return false;
      if (statusFilter === 'inactive' && p.is_active) return false;
      if (statusFilter === 'fresh' && !p.is_fresh_today) return false;

      // Search query
      if (itemSearchQuery.trim()) {
        const q = itemSearchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSlug = p.slug.toLowerCase().includes(q);
        const matchesDesc = p.description?.toLowerCase().includes(q);
        return matchesName || matchesSlug || matchesDesc;
      }
      return true;
    });
  }, [products, categoryFilter, statusFilter, itemSearchQuery]);

  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return categories;
    const q = categorySearchQuery.toLowerCase().trim();
    return categories.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
  }, [categories, categorySearchQuery]);

  /* -------------------------------------------------------------------------- */
  /* Render                                                                     */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="space-y-6">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Category &amp; Item Pricing &amp; Image Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Authoritative admin control over category defaults, independent item prices, and image uploads from your device.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={openAddCategory}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold min-h-[44px] transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Add Category</span>
          </button>
          <button
            onClick={openAddProduct}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold min-h-[44px] transition-colors inline-flex items-center gap-1.5 shadow-md shadow-emerald-950/40"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {actionSuccess && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-sm flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-emerald-200 text-xs">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-sm flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200 text-xs">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('items')}
          className={`pb-3 px-4 text-sm font-semibold transition-all relative ${
            activeTab === 'items'
              ? 'text-emerald-400 border-b-2 border-emerald-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Individual Produce Items</span>
          <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300 font-mono">
            {products.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`pb-3 px-4 text-sm font-semibold transition-all relative ${
            activeTab === 'categories'
              ? 'text-emerald-400 border-b-2 border-emerald-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Categories &amp; Default Pricing</span>
          <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300 font-mono">
            {categories.length}
          </span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: INDIVIDUAL ITEMS MANAGEMENT                                   */}
      {/* ==================================================================== */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            {/* Search Input */}
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type="search"
                value={itemSearchQuery}
                onChange={(e) => setItemSearchQuery(e.target.value)}
                placeholder="Search items by name, slug..."
                className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Category Dropdown */}
            <div className="md:col-span-4">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-950 border border-slate-700/80 text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Categories ({products.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({products.filter((p) => p.category_id === c.id).length})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Dropdown */}
            <div className="md:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-950 border border-slate-700/80 text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
                <option value="fresh">Fresh Today Only</option>
              </select>
            </div>
          </div>

          {/* Items Listing Table */}
          {isLoading ? (
            <div className="p-16 text-center text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
              <p className="text-sm">Loading harvest items...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
              <Package className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No items found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No produce items match your active search or filters. Click &quot;Add Item&quot; to list a new product.
              </p>
              <button
                onClick={openAddProduct}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Item Now</span>
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Item &amp; Image</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Independent Selling Price</th>
                      <th className="py-3 px-4">Pack Weights &amp; Stock</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredProducts.map((p) => {
                      const primaryVariant = p.variants?.[0];
                      const isExpanded = expandedProductIds.has(p.id);
                      const isEditingPrice = editingPriceId === p.id;
                      const cat = categories.find((c) => c.id === p.category_id);

                      return (
                        <React.Fragment key={p.id}>
                          <tr className="hover:bg-slate-800/40 transition-colors">
                            {/* Image & Title */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-950 border border-slate-700/60 shrink-0 relative group">
                                  {p.image_url ? (
                                    <img
                                      src={p.image_url}
                                      alt={p.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                                      🌱
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="font-bold text-white text-sm flex items-center gap-1.5">
                                    <span>{p.name}</span>
                                    {p.is_fresh_today && (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-semibold">
                                        Fresh
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono">{p.slug}</div>
                                </div>
                              </div>
                            </td>

                            {/* Category */}
                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60 text-xs font-medium">
                                {cat?.name || 'Unassigned'}
                              </span>
                            </td>

                            {/* Independent Selling Price */}
                            <td className="py-3.5 px-4">
                              {isEditingPrice ? (
                                <div className="flex items-center gap-2">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1 bg-slate-950 border border-emerald-500 rounded-lg px-2 py-1">
                                      <span className="text-slate-400 text-xs">₹</span>
                                      <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        value={quickPrice}
                                        onChange={(e) => setQuickPrice(e.target.value)}
                                        className="w-20 bg-transparent text-white text-xs font-bold focus:outline-none"
                                        placeholder="Price"
                                        autoFocus
                                      />
                                    </div>
                                    <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5">
                                      <span className="text-slate-500 text-[10px]">MRP: ₹</span>
                                      <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        value={quickMrp}
                                        onChange={(e) => setQuickMrp(e.target.value)}
                                        className="w-16 bg-transparent text-slate-300 text-[10px] focus:outline-none"
                                        placeholder="MRP"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => saveQuickPrice(p.id)}
                                      disabled={savingPrice}
                                      className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                                      title="Save Price"
                                    >
                                      {savingPrice ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Check className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                    <button
                                      onClick={() => setEditingPriceId(null)}
                                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400"
                                      title="Cancel"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 group/price">
                                  <div>
                                    <div className="font-extrabold text-emerald-400 text-sm">
                                      ₹{primaryVariant ? Number(primaryVariant.price).toFixed(2) : '—'}
                                    </div>
                                    {primaryVariant && Number(primaryVariant.mrp) > Number(primaryVariant.price) && (
                                      <div className="text-[11px] text-slate-500 line-through">
                                        ₹{Number(primaryVariant.mrp).toFixed(2)}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => startQuickPriceEdit(p)}
                                    className="p-1 rounded-md text-slate-500 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                                    title="Edit Price"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>

                            {/* Weight Packs & Stock */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                <div className="text-xs text-white font-medium">
                                  {primaryVariant ? primaryVariant.weight_label : 'No pack'}
                                </div>
                                {p.variants && p.variants.length > 1 && (
                                  <button
                                    onClick={() => toggleExpand(p.id)}
                                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                                  >
                                    <span>{p.variants.length} total packs</span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-3 h-3" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  p.is_active
                                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    p.is_active ? 'bg-emerald-400' : 'bg-slate-500'
                                  }`}
                                />
                                {p.is_active ? 'Active' : 'Disabled'}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => openEditProduct(p)}
                                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                  title="Edit Item Details & Image"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => openAddVariant(p)}
                                  className="p-2 rounded-lg bg-slate-800 hover:bg-emerald-950/60 text-slate-300 hover:text-emerald-400 transition-colors"
                                  title="Add Weight Pack Size"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setProductToDelete(p)}
                                  className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 transition-colors"
                                  title="Delete Item"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Variant Rows */}
                          {isExpanded && p.variants && (
                            <tr className="bg-slate-950/60">
                              <td colSpan={6} className="py-3 px-6">
                                <div className="space-y-2 border-l-2 border-emerald-500/40 pl-4">
                                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    All Weight Sizes for {p.name}:
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {p.variants.map((v) => (
                                      <div
                                        key={v.id}
                                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                                      >
                                        <div>
                                          <div className="font-bold text-white text-xs">{v.weight_label}</div>
                                          <div className="text-xs text-emerald-400 font-extrabold mt-0.5">
                                            ₹{Number(v.price).toFixed(2)}{' '}
                                            <span className="text-[10px] text-slate-500 font-normal">
                                              (MRP ₹{Number(v.mrp).toFixed(2)})
                                            </span>
                                          </div>
                                        </div>
                                        {p.variants.length > 1 && (
                                          <button
                                            onClick={() =>
                                              setVariantToDelete({
                                                variant: v,
                                                productName: p.name,
                                              })
                                            }
                                            className="text-slate-500 hover:text-rose-400 p-1"
                                            title="Delete Pack"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: CATEGORY MANAGEMENT & DEFAULT PRICING                         */}
      {/* ==================================================================== */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          {/* Category Search & Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type="search"
                value={categorySearchQuery}
                onChange={(e) => setCategorySearchQuery(e.target.value)}
                placeholder="Search categories by name..."
                className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="text-xs text-slate-400">
              Categories configure optional default prices and customer navigation tabs.
            </div>
          </div>

          {/* Categories Table */}
          {filteredCategories.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
              <Layers className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No categories found</h3>
              <p className="text-xs text-slate-400">Create a category to organize fresh produce.</p>
              <button
                onClick={openAddCategory}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Category</span>
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Category &amp; Image</th>
                      <th className="py-3 px-4">Slug</th>
                      <th className="py-3 px-4">Default Category Price</th>
                      <th className="py-3 px-4">Items Count</th>
                      <th className="py-3 px-4">Visibility</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredCategories.map((c) => {
                      const count = products.filter((p) => p.category_id === c.id).length;
                      return (
                        <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                          {/* Image & Title */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-950 border border-slate-700/60 shrink-0">
                                {c.image_url ? (
                                  <img
                                    src={c.image_url}
                                    alt={c.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                                    📁
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-white text-sm">{c.name}</div>
                                {c.description && (
                                  <div className="text-[11px] text-slate-400 max-w-xs truncate">
                                    {c.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Slug */}
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                            {c.slug}
                          </td>

                          {/* Optional Default Price */}
                          <td className="py-3.5 px-4">
                            {c.default_price ? (
                              <span className="font-extrabold text-emerald-400 text-sm">
                                ₹{Number(c.default_price).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-xs italic">No default</span>
                            )}
                          </td>

                          {/* Items Count */}
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold">
                              {count} items
                            </span>
                          </td>

                          {/* Visibility */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                c.is_active
                                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  c.is_active ? 'bg-emerald-400' : 'bg-slate-500'
                                }`}
                              />
                              {c.is_active ? 'Visible' : 'Hidden'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditCategory(c)}
                                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                title="Edit Category & Image"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setCategoryToDelete(c)}
                                className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 transition-colors"
                                title="Delete Category"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT CATEGORY                                           */}
      {/* ==================================================================== */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">
                {editingCategory ? `Edit Category: ${editingCategory.name}` : 'Add New Category'}
              </h2>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="space-y-4">
              {/* Category Name & Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Category Name *</label>
                  <input
                    type="text"
                    required
                    value={catName}
                    onChange={(e) => {
                      setCatName(e.target.value);
                      if (!editingCategory) {
                        setCatSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                      }
                    }}
                    placeholder="e.g. Daily Vegetables"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">URL Slug</label>
                  <input
                    type="text"
                    value={catSlug}
                    onChange={(e) => setCatSlug(e.target.value)}
                    placeholder="daily-vegetables"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Description</label>
                <textarea
                  rows={2}
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="Fresh morning vegetables harvested daily from local farms..."
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Default Category Price */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Default Category Price (Optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500 text-xs">₹</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={catDefaultPrice}
                    onChange={(e) => setCatDefaultPrice(e.target.value)}
                    placeholder="e.g. 40.00 (leave empty if none)"
                    className="w-full pl-7 pr-4 py-2 text-xs sm:text-sm rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Optional baseline price for items created under this category. Individual item prices remain independent.
                </p>
              </div>

              {/* Image Upload Component */}
              <ImageUploadField
                label="Category Banner / Icon Image"
                value={catImage}
                onChange={setCatImage}
              />

              {/* Display Order & Active Toggle */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Display Order</label>
                  <input
                    type="number"
                    value={catOrder}
                    onChange={(e) => setCatOrder(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="catActiveCheck"
                    checked={catActive}
                    onChange={(e) => setCatActive(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                  <label htmlFor="catActiveCheck" className="text-xs font-semibold text-slate-300 cursor-pointer">
                    Visible on Store
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/50 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT ITEM                                               */}
      {/* ==================================================================== */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">
                {editingProduct ? `Edit Item: ${editingProduct.name}` : 'Add New Produce Item'}
              </h2>
              <button
                onClick={() => setShowProductModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4">
              {/* Category Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Category *</label>
                <select
                  required
                  value={prodCatId}
                  onChange={(e) => {
                    const newCatId = e.target.value;
                    setProdCatId(newCatId);
                    if (!editingProduct) {
                      const cat = categories.find((c) => c.id === newCatId);
                      if (cat?.default_price) {
                        setProdPrice(String(cat.default_price));
                        setProdMrp(String(Math.round(Number(cat.default_price) * 1.25)));
                      }
                    }
                  }}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select a category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.default_price ? `(Default: ₹${c.default_price})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Item Name & Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Item Name *</label>
                  <input
                    type="text"
                    required
                    value={prodName}
                    onChange={(e) => {
                      setProdName(e.target.value);
                      if (!editingProduct) {
                        setProdSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                      }
                    }}
                    placeholder="e.g. Farm Fresh Vine Tomatoes"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">URL Slug</label>
                  <input
                    type="text"
                    value={prodSlug}
                    onChange={(e) => setProdSlug(e.target.value)}
                    placeholder="farm-fresh-tomatoes"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Description</label>
                <textarea
                  rows={2}
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  placeholder="Locally grown, hand-picked this morning with morning dew intact..."
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Independent Selling Price & MRP */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5" />
                  <span>Item Selling Price Configuration</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">Selling Price (₹) *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      required
                      value={prodPrice}
                      onChange={(e) => setProdPrice(e.target.value)}
                      placeholder="40.00"
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-900 border border-slate-700 text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">MRP / Strike Price (₹)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={prodMrp}
                      onChange={(e) => setProdMrp(e.target.value)}
                      placeholder="50.00"
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-900 border border-slate-700 text-slate-300 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {!editingProduct && (
                  <div className="grid grid-cols-3 gap-3 pt-1 border-t border-slate-800/80">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-400">Weight Label</label>
                      <input
                        type="text"
                        value={prodWeight}
                        onChange={(e) => setProdWeight(e.target.value)}
                        placeholder="500g"
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-400">Grams</label>
                      <input
                        type="number"
                        value={prodGrams}
                        onChange={(e) => setProdGrams(e.target.value)}
                        placeholder="500"
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-400">Initial Stock</label>
                      <input
                        type="number"
                        value={prodStock}
                        onChange={(e) => setProdStock(e.target.value)}
                        placeholder="50"
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Image Upload Component */}
              <ImageUploadField
                label="Produce Item Photograph"
                value={prodImage}
                onChange={setProdImage}
              />

              {/* Toggles */}
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prodFresh}
                    onChange={(e) => setProdFresh(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                  <span className="text-xs font-semibold text-slate-300">Harvested Today Flag</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prodActive}
                    onChange={(e) => setProdActive(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                  <span className="text-xs font-semibold text-slate-300">Active &amp; In Stock</span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/50 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingProduct ? 'Save Item Changes' : 'Create Produce Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD WEIGHT VARIANT PACK                                       */}
      {/* ==================================================================== */}
      {showVariantModal && targetProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">
                Add Pack Size to {targetProduct.name}
              </h2>
              <button
                onClick={() => setShowVariantModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateVariant} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Weight Label *</label>
                  <input
                    type="text"
                    required
                    value={varWeight}
                    onChange={(e) => setVarWeight(e.target.value)}
                    placeholder="e.g. 1 kg, 250g"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Net Grams *</label>
                  <input
                    type="number"
                    required
                    value={varGrams}
                    onChange={(e) => setVarGrams(e.target.value)}
                    placeholder="1000"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={varPrice}
                    onChange={(e) => setVarPrice(e.target.value)}
                    placeholder="75.00"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">MRP (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={varMrp}
                    onChange={(e) => setVarMrp(e.target.value)}
                    placeholder="85.00"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">Initial Stock Quantity</label>
                <input
                  type="number"
                  value={varStock}
                  onChange={(e) => setVarStock(e.target.value)}
                  placeholder="40"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowVariantModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/50 disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add Pack Size'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* DELETION CONFIRMATION DIALOGS                                        */}
      {/* ==================================================================== */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-rose-900/60 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Delete Category?</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Are you sure you want to delete category <strong className="text-white">&quot;{categoryToDelete.name}&quot;</strong>?
              If this category has existing order history, it will be safely deactivated to protect historical customer receipts.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCategory}
                disabled={deleting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-950/50 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-rose-900/60 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Delete Item?</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">&quot;{productToDelete.name}&quot;</strong>?
              The item will immediately disappear from the customer store catalog.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProduct}
                disabled={deleting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-950/50 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {variantToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-rose-900/60 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Delete Pack Size?</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Remove pack <strong className="text-white">&quot;{variantToDelete.variant.weight_label}&quot;</strong> from{' '}
              <strong className="text-white">{variantToDelete.productName}</strong>?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setVariantToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteVariant}
                disabled={deleting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-950/50 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Pack'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
