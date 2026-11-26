import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  Download,
  Edit3,
  Eye,
  EyeOff,
  Image as ImageIcon,
  KeyRound,
  LogOut,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Trash2,
  Truck,
  Upload,
  X,
} from 'lucide-react';
import { formatPaiseToINR } from '../lib/domain-logic.ts';
import { uploadProductImageToFirebaseStorage } from '../lib/firebase.ts';
import { OrderTrackingTimeline } from './OrderTrackingTimeline.tsx';
import { ILLUSTRATION_PRESETS, ProductIllustration } from './ProductIllustration.tsx';
import {
  DEFAULT_BUNDLES,
  DEFAULT_COUPONS,
  STORE_ADDRESS,
  STORE_EMAIL,
  STORE_PHONE,
} from '../data/defaults.ts';

export interface AdminDashboardProps {
  idToken: string | null;
  currentUser: {
    id: number;
    email: string;
    role: string;
    fullName?: string | null;
    uid?: string;
    phone?: string | null;
  } | null;
  categories: Array<any>;
  brands: Array<any>;
  products: Array<any>;
  storeSettings: Record<string, any>;
  bootstrap?: any;
  onRefreshStorefront: () => void;
  onRoleSwitched?: (nextRole: 'customer' | 'staff' | 'owner') => Promise<void> | void;
  onExitAdmin: () => void;
  onNavigateStorefront?: (target: {
    view?: string;
    categorySlug?: string;
    brandSlug?: string;
    pageSlug?: string;
  }) => void;
}

type AdminTab = 'overview' | 'orders' | 'products' | 'settings';
type OrderFilter = 'ALL' | 'PICKUP' | 'DELIVERY' | 'UNPAID' | 'ACTIVE';

const getHeaders = (idToken: string | null) => ({
  'Content-Type': 'application/json',
  ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
});

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  idToken,
  currentUser,
  categories: initialCategories,
  brands: initialBrands,
  products: initialProducts,
  storeSettings: initialStoreSettings,
  onRefreshStorefront,
  onRoleSwitched,
  onExitAdmin,
  onNavigateStorefront,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Dashboard state from /api/admin/dashboard
  const [metrics, setMetrics] = useState<any>({});
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>(initialProducts || []);
  const [categories, setCategories] = useState<any[]>(initialCategories || []);
  const [brands, setBrands] = useState<any[]>(initialBrands || []);
  const [coupons, setCoupons] = useState<any[]>(DEFAULT_COUPONS);
  const [bulkEnquiries, setBulkEnquiries] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [storeSettings, setStoreSettings] = useState<Record<string, any>>(
    initialStoreSettings || {}
  );

  // Overview pickup verify box
  const [pickupCodeInput, setPickupCodeInput] = useState('');

  // Orders state
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('ALL');
  const [orderSearch, setOrderSearch] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  // Products state
  const [productSearch, setProductSearch] = useState('');
  const [productStockFilter, setProductStockFilter] = useState<'ALL' | 'LOW' | 'HIDDEN'>('ALL');
  const [showCatBrandSheet, setShowCatBrandSheet] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');
  const [newBrandInput, setNewBrandInput] = useState('');

  // Add / Edit Product modal state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [showAdvancedProduct, setShowAdvancedProduct] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [webPhotos, setWebPhotos] = useState<Array<{ url: string; title: string }>>([]);
  const [loadingWebPhotos, setLoadingWebPhotos] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [productForm, setProductForm] = useState({
    id: undefined as number | undefined,
    name: '',
    sku: '',
    categoryId: '' as string | number,
    newCategoryName: '',
    brandId: '' as string | number,
    newBrandName: '',
    sellingPriceRupees: '95',
    mrpRupees: '120',
    initialStockQuantity: '40',
    variantName: 'Standard Pack',
    taxRatePercent: '12',
    shortDescription: '',
    imageUrl: '',
    illustrationType: 'spiral_notebook',
    pickupEligible: true,
    deliveryEligible: true,
    isFeatured: false,
    isBestseller: false,
    isActive: true,
  });

  // Settings / Offers state
  const [couponForm, setCouponForm] = useState({
    code: '',
    description: '',
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FLAT',
    discountValue: '10',
    minOrderRupees: '299',
  });

  const [storeNoticeText, setStoreNoticeText] = useState(
    'Free Store Pickup in 2 Hours · Free Local Delivery in Kanpur above ₹599 · Use code BACKTOSCHOOL10'
  );
  const [heroHeadline, setHeroHeadline] = useState('Curated Stationery for Classrooms & Studios.');
  const [storePhoneInput, setStorePhoneInput] = useState(STORE_PHONE);
  const [storeAddressInput, setStoreAddressInput] = useState(STORE_ADDRESS);

  const [cfForm, setCfForm] = useState({
    appId: '',
    secretKey: '',
    environment: 'SANDBOX' as 'SANDBOX' | 'PRODUCTION',
  });
  const [cfTestResult, setCfTestResult] = useState<string | null>(null);

  const showToast = useCallback((type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 3600);
  }, []);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: getHeaders(idToken),
      });
      const data = await res.json();
      if (data && !data.error) {
        setMetrics(data.metrics || {});
        setOrders(Array.isArray(data.orders) ? data.orders : []);
        if (Array.isArray(data.products) && data.products.length > 0) {
          setProducts(data.products);
        }
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories);
        }
        if (Array.isArray(data.brands) && data.brands.length > 0) {
          setBrands(data.brands);
        }
        if (Array.isArray(data.coupons) && data.coupons.length > 0) {
          setCoupons(data.coupons);
        }
        setBulkEnquiries(Array.isArray(data.bulkEnquiries) ? data.bulkEnquiries : []);
        setBanners(Array.isArray(data.banners) ? data.banners : []);
        const nextSettings = data.settings || {};
        setStoreSettings(nextSettings);

        const themeCfg = nextSettings.theme_config || {};
        if (themeCfg.announcementText) setStoreNoticeText(themeCfg.announcementText);
        if (themeCfg.heroTitle) setHeroHeadline(themeCfg.heroTitle);
        if (nextSettings.store_contact?.phone) setStorePhoneInput(nextSettings.store_contact.phone);
        if (nextSettings.store_contact?.address) {
          setStoreAddressInput(nextSettings.store_contact.address);
        }
        if (nextSettings.cashfree_config) {
          setCfForm({
            appId: nextSettings.cashfree_config.appId || '',
            secretKey: nextSettings.cashfree_config.secretKey || '',
            environment:
              nextSettings.cashfree_config.environment === 'PRODUCTION'
                ? 'PRODUCTION'
                : 'SANDBOX',
          });
        }
      }
    } catch {
      showToast('err', 'Could not refresh live store data.');
    } finally {
      setLoading(false);
    }
  }, [idToken, showToast]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Keep synced if parent prop updates before dashboard responds
  useEffect(() => {
    if (initialProducts?.length && products.length === 0) setProducts(initialProducts);
    if (initialCategories?.length && categories.length === 0) setCategories(initialCategories);
    if (initialBrands?.length && brands.length === 0) setBrands(initialBrands);
  }, [initialProducts, initialCategories, initialBrands, products.length, categories.length, brands.length]);

  // Real order revenue breakdown by day of week (zero synthetic fallback data)
  const revenueChartData = useMemo(() => {
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const totals = new Array(7).fill(0);
    orders.forEach((entry) => {
      if (entry?.order?.orderStatus === 'CANCELLED') return;
      const dt = entry?.order?.createdAt ? new Date(entry.order.createdAt) : new Date();
      const dayIdx = (dt.getDay() + 6) % 7;
      totals[dayIdx] += Math.round(Number(entry?.order?.totalPaise || 0) / 100);
    });
    return dayLabels.map((day, idx) => ({
      day,
      sales: totals[idx],
    }));
  }, [orders]);

  const lowStockProducts = useMemo(
    () =>
      products.filter(
        (p) => Number(p.totalStock ?? p.variants?.[0]?.stockQuantity ?? 0) <= 10
      ),
    [products]
  );

  // Instant 6-digit pickup code matcher
  const matchedPickupOrder = useMemo(() => {
    const code = pickupCodeInput.trim();
    if (!code) return null;
    return (
      orders.find(
        (entry) =>
          String(entry?.pickupDetails?.pickupCode || '') === code ||
          String(entry?.order?.orderNumber || '').toLowerCase() === code.toLowerCase()
      ) || null
    );
  }, [orders, pickupCodeInput]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((entry) => {
      const ord = entry?.order || {};
      if (orderFilter === 'PICKUP' && ord.fulfilmentMethod !== 'STORE_PICKUP') return false;
      if (orderFilter === 'DELIVERY' && ord.fulfilmentMethod !== 'HOME_DELIVERY') return false;
      if (
        orderFilter === 'UNPAID' &&
        (ord.paymentStatus === 'PAID' || ord.orderStatus === 'CANCELLED')
      ) {
        return false;
      }
      if (
        orderFilter === 'ACTIVE' &&
        ['COLLECTED', 'DELIVERED', 'CANCELLED'].includes(ord.orderStatus)
      ) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        ord.orderNumber,
        ord.customerName,
        ord.customerPhone,
        ord.customerEmail,
        entry?.pickupDetails?.pickupCode,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [orders, orderFilter, orderSearch]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter((p) => {
      const stock = Number(p.totalStock ?? p.variants?.[0]?.stockQuantity ?? 0);
      if (productStockFilter === 'LOW' && stock > 10) return false;
      if (productStockFilter === 'HIDDEN' && p.isActive !== false) return false;
      if (!q) return true;
      const text = [p.name, p.sku, p.categoryName, p.brandName].join(' ').toLowerCase();
      return text.includes(q);
    });
  }, [products, productSearch, productStockFilter]);

  // Quick 1-tap order workflow action
  const handleQuickOrderUpdate = async (
    orderEntry: any,
    nextOrderStatus: string,
    nextPaymentStatus?: string,
    note?: string
  ) => {
    const ord = orderEntry?.order;
    if (!ord) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${ord.id}/update-workflow`, {
        method: 'POST',
        headers: getHeaders(idToken),
        body: JSON.stringify({
          nextOrderStatus,
          nextPaymentStatus: nextPaymentStatus || ord.paymentStatus,
          collectedByName: nextOrderStatus === 'COLLECTED' ? ord.customerName : undefined,
          note: note || `Shop updated order to ${nextOrderStatus}`,
        }),
      });
      if (!res.ok) throw new Error('Update failed');
      showToast('ok', `Order ${ord.orderNumber} updated to ${nextOrderStatus.replace(/_/g, ' ')}.`);
      await fetchDashboard();
      onRefreshStorefront();
    } catch {
      showToast('err', 'Could not update order status.');
    } finally {
      setSaving(false);
    }
  };

  // Quick stock +/- button directly on product card
  const handleQuickStockAdjust = async (product: any, delta: number) => {
    const variantId = product?.variants?.[0]?.id || product?.id;
    const currentStock = Number(product.totalStock ?? product.variants?.[0]?.stockQuantity ?? 0);
    const nextStock = Math.max(0, currentStock + delta);

    // Optimistic UI update
    setProducts((prev) =>
      prev.map((p) => {
        if (Number(p.id) !== Number(product.id)) return p;
        const nextVars = (p.variants || []).map((v: any, idx: number) =>
          idx === 0 ? { ...v, stockQuantity: nextStock, inStock: nextStock > 0 } : v
        );
        return { ...p, totalStock: nextStock, variants: nextVars };
      })
    );

    try {
      await fetch('/api/admin/inventory/adjust', {
        method: 'POST',
        headers: getHeaders(idToken),
        body: JSON.stringify({
          variantId,
          newStockQuantity: nextStock,
          reason: `Quick counter adjustment (${delta >= 0 ? `+${delta}` : delta})`,
        }),
      });
      onRefreshStorefront();
      showToast('ok', `${product.name} stock updated to ${nextStock}.`);
    } catch {
      showToast('err', 'Failed to update stock.');
    }
  };

  const openNewProductModal = () => {
    setProductForm({
      id: undefined,
      name: '',
      sku: '',
      categoryId: categories[0]?.id || 1,
      newCategoryName: '',
      brandId: brands[0]?.id || 1,
      newBrandName: '',
      sellingPriceRupees: '95',
      mrpRupees: '120',
      initialStockQuantity: '35',
      variantName: 'Standard Pack',
      taxRatePercent: '12',
      shortDescription: '',
      imageUrl: '',
      illustrationType: 'spiral_notebook',
      pickupEligible: true,
      deliveryEligible: true,
      isFeatured: false,
      isBestseller: false,
      isActive: true,
    });
    setShowAdvancedProduct(false);
    setWebPhotos([]);
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (prod: any, duplicate = false) => {
    const v = prod?.variants?.[0];
    const sellRs = Math.round(Number(prod.sellingPricePaise || v?.sellingPricePaise || 9500) / 100);
    const mrpRs = Math.round(Number(prod.mrpPaise || v?.mrpPaise || sellRs * 100) / 100);
    setProductForm({
      id: duplicate ? undefined : prod.id,
      name: duplicate ? `${prod.name} (Copy)` : prod.name || '',
      sku: duplicate ? '' : prod.sku || '',
      categoryId: prod.categoryId || categories[0]?.id || 1,
      newCategoryName: '',
      brandId: prod.brandId || brands[0]?.id || 1,
      newBrandName: '',
      sellingPriceRupees: String(sellRs),
      mrpRupees: String(mrpRs),
      initialStockQuantity: String(prod.totalStock ?? v?.stockQuantity ?? 25),
      variantName: v?.variantName || 'Standard Pack',
      taxRatePercent: String(prod.taxRatePercent ?? 12),
      shortDescription: prod.shortDescription || prod.description || '',
      imageUrl: prod.imageUrl || '',
      illustrationType: prod.illustrationType || 'spiral_notebook',
      pickupEligible: prod.pickupEligible !== false,
      deliveryEligible: prod.deliveryEligible !== false,
      isFeatured: Boolean(prod.isFeatured),
      isBestseller: Boolean(prod.isBestseller),
      isActive: prod.isActive !== false,
    });
    setShowAdvancedProduct(false);
    setWebPhotos([]);
    setIsProductModalOpen(true);
  };

  const handleUploadProductPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const uploaded = await uploadProductImageToFirebaseStorage(file, {
        productSku: productForm.sku || productForm.name || 'ITEM',
      });
      setProductForm((prev) => ({ ...prev, imageUrl: uploaded.downloadUrl }));
      showToast('ok', 'Product photo uploaded cleanly.');
    } catch (err: any) {
      showToast('err', err?.message || 'Photo upload failed.');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleFindWebPhotos = async () => {
    setLoadingWebPhotos(true);
    try {
      const res = await fetch('/api/admin/products/web-photos', {
        method: 'POST',
        headers: getHeaders(idToken),
        body: JSON.stringify({
          query: productForm.name || 'stationery notebook pen',
          name: productForm.name,
        }),
      });
      const data = await res.json();
      setWebPhotos(Array.isArray(data.photos) ? data.photos : []);
    } catch {
      showToast('err', 'Could not load studio photo suggestions.');
    } finally {
      setLoadingWebPhotos(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      showToast('err', 'Please enter a product name.');
      return;
    }
    const sellingRs = Math.max(1, Number(productForm.sellingPriceRupees || 0));
    const mrpRs = Math.max(sellingRs, Number(productForm.mrpRupees || sellingRs));
    const sku =
      productForm.sku.trim() ||
      `GS-${productForm.name
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 4)}-${Date.now().toString().slice(-3)}`;

    setSaving(true);
    try {
      const res = await fetch('/api/admin/products/save', {
        method: 'POST',
        headers: getHeaders(idToken),
        body: JSON.stringify({
          id: productForm.id,
          name: productForm.name.trim(),
          sku,
          categoryId: productForm.categoryId ? Number(productForm.categoryId) : undefined,
          newCategoryName: productForm.newCategoryName.trim() || undefined,
          brandId: productForm.brandId ? Number(productForm.brandId) : undefined,
          newBrandName: productForm.newBrandName.trim() || undefined,
          sellingPricePaise: Math.round(sellingRs * 100),
          mrpPaise: Math.round(mrpRs * 100),
          sellingPriceRupees: sellingRs,
          mrpRupees: mrpRs,
          initialStockQuantity: Math.max(0, Number(productForm.initialStockQuantity || 0)),
          variantName: productForm.variantName.trim() || 'Standard Pack',
          taxRatePercent: Number(productForm.taxRatePercent || 12),
          shortDescription: productForm.shortDescription.trim() || productForm.name.trim(),
          description: productForm.shortDescription.trim() || productForm.name.trim(),
          imageUrl: productForm.imageUrl.trim(),
          illustrationType: productForm.illustrationType,
          pickupEligible: productForm.pickupEligible,
          deliveryEligible: productForm.deliveryEligible,
          isFeatured: productForm.isFeatured,
          isBestseller: productForm.isBestseller,
          isActive: productForm.isActive,
          status: productForm.isActive ? 'PUBLISHED' : 'HIDDEN',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Could not save product');
      setIsProductModalOpen(false);
      showToast('ok', `"${productForm.name.trim()}" saved to catalogue.`);
      await fetchDashboard();
      onRefreshStorefront();
    } catch (err: any) {
      showToast('err', err?.message || 'Could not save product.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleProductVisibility = async (prod: any) => {
    const nextActive = prod.isActive === false;
    setSaving(true);
    try {
      await fetch('/api/admin/products/bulk-action', {
        method: 'POST',
        headers: getHeaders(idToken),
        body: JSON.stringify({
          productIds: [prod.id],
          action: nextActive ? 'PUBLISH' : 'HIDE',
        }),
      });
      showToast('ok', nextActive ? `"${prod.name}" is now visible in store.` : `"${prod.name}" hidden.`);
      await fetchDashboard();
      onRefreshStorefront();
    } catch {
      showToast('err', 'Could not update visibility.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (prod: any) => {
    if (!window.confirm(`Remove "${prod.name}" from your catalogue?`)) return;
    setSaving(true);
    try {
      await fetch('/api/admin/products/delete', {
        method: 'POST',
        headers: getHeaders(idToken),
        body: JSON.stringify({
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
        }),
      });
      showToast('ok', `"${prod.name}" removed.`);
      await fetchDashboard();
      onRefreshStorefront();
    } catch {
      showToast('err', 'Could not delete item.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatInput.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/admin/categories/save', {
        method: 'POST',
        headers: getHeaders(idToken),
        body: JSON.stringify({ name: newCatInput.trim(), showInNav: true, showOnHomepage: true }),
      });
      setNewCatInput('');
      showToast('ok', 'Category added.');
      await fetchDashboard();
      onRefreshStorefront();
    } catch {
      showToast('err', 'Could not add category.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (id: number, name: string) => {
    if (!window.confirm(`Delete category "${name}"?`)) return;
    await fetch(`/api/admin/categories/${id}`, {
      method: 'DELETE',
      headers: getHeaders(idToken),
    });
    showToast('ok', 'Category deleted.');
    await fetchDashboard();
    onRefreshStorefront();
  };

  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandInput.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/admin/brands/save', {
        method: 'POST',
        headers: getHeaders(idToken),
        body: JSON.stringify({ name: newBrandInput.trim(), isFeatured: true, showInNav: true }),
      });
      setNewBrandInput('');
      showToast('ok', 'Brand added.');
      await fetchDashboard();
      onRefreshStorefront();
    } catch {
      showToast('err', 'Could not add brand.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBrand = async (id: number, name: string) => {
    if (!window.confirm(`Delete brand "${name}"?`)) return;
    await fetch(`/api/admin/brands/${id}`, {
      method: 'DELETE',
      headers: getHeaders(idToken),
    });
    showToast('ok', 'Brand deleted.');
    await fetchDashboard();
    onRefreshStorefront();
  };

  const handleExportCsv = () => {
    const header = ['SKU', 'Product Name', 'Category', 'Brand', 'MRP (Rs)', 'Selling Price (Rs)', 'Stock'];
    const rows = products.map((p) => [
      `"${String(p.sku || '').replace(/"/g, '""')}"`,
      `"${String(p.name || '').replace(/"/g, '""')}"`,
      `"${String(p.categoryName || '').replace(/"/g, '""')}"`,
      `"${String(p.brandName || '').replace(/"/g, '""')}"`,
      Math.round(Number(p.mrpPaise || 0) / 100),
      Math.round(Number(p.sellingPricePaise || 0) / 100),
      Number(p.totalStock ?? p.variants?.[0]?.stockQuantity ?? 0),
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gayatri-stationers-catalogue-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('ok', 'Catalogue CSV downloaded.');
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = couponForm.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode) {
      showToast('err', 'Enter a coupon code like SCHOOL15.');
      return;
    }
    const rawVal = Number(couponForm.discountValue || 10);
    const discountValue =
      couponForm.discountType === 'FLAT' ? Math.round(rawVal * 100) : Math.min(80, Math.max(1, rawVal));

    setSaving(true);
    try {
      await fetch('/api/admin/coupons/save', {
        method: 'POST',
        headers: getHeaders(idToken),
        body: JSON.stringify({
          code: cleanCode,
          description:
            couponForm.description.trim() ||
            (couponForm.discountType === 'PERCENTAGE'
              ? `${rawVal}% instant discount`
              : `₹${rawVal} flat savings`),
          discountType: couponForm.discountType,
          discountValue,
          minOrderPaise: Math.round(Number(couponForm.minOrderRupees || 0) * 100),
          maxDiscountPaise: 25000,
          usageLimit: 500,
          isActive: true,
        }),
      });
      setCouponForm({
        code: '',
        description: '',
        discountType: 'PERCENTAGE',
        discountValue: '10',
        minOrderRupees: '299',
      });
      showToast('ok', `Offer code ${cleanCode} saved.`);
      await fetchDashboard();
      onRefreshStorefront();
    } catch {
      showToast('err', 'Could not save coupon.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCoupon = async (c: any) => {
    await fetch('/api/admin/coupons/save', {
      method: 'POST',
      headers: getHeaders(idToken),
      body: JSON.stringify({
        ...c,
        isActive: !c.isActive,
      }),
    });
    showToast('ok', `Coupon ${c.code} ${c.isActive ? 'paused' : 'activated'}.`);
    await fetchDashboard();
    onRefreshStorefront();
  };

  const handleSaveStoreNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/admin/settings/save', {
        method: 'POST',
        headers: getHeaders(idToken),
        body: JSON.stringify({
          key: 'theme_config',
          valueJson: {
            ...(storeSettings.theme_config || {}),
            announcementText: storeNoticeText.trim(),
            heroTitle: heroHeadline.trim(),
          },
        }),
      });
      await fetch('/api/admin/settings/save', {
        method: 'POST',
        headers: getHeaders(idToken),
        body: JSON.stringify({
          key: 'store_contact',
          valueJson: {
            phone: storePhoneInput.trim(),
            address: storeAddressInput.trim(),
            email: STORE_EMAIL,
          },
        }),
      });
      showToast('ok', 'Store announcement & contact details saved.');
      await fetchDashboard();
      onRefreshStorefront();
    } catch {
      showToast('err', 'Failed to save store settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCashfree = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setCfTestResult(null);
    try {
      const res = await fetch('/api/admin/cashfree/save-config', {
        method: 'POST',
        headers: getHeaders(idToken),
        body: JSON.stringify(cfForm),
      });
      if (!res.ok) throw new Error('Save failed');
      showToast('ok', 'Cashfree payment keys updated.');
      await fetchDashboard();
      onRefreshStorefront();
    } catch {
      showToast('err', 'Failed to save Cashfree keys.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestCashfree = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/cashfree/test-config', {
        method: 'POST',
        headers: getHeaders(idToken),
        body: JSON.stringify(cfForm),
      });
      const data = await res.json();
      setCfTestResult(
        data.ok
          ? `Connected (${data.environment || cfForm.environment})`
          : data.error || 'Gateway check completed in fallback mode'
      );
    } catch {
      setCfTestResult('Gateway endpoint check finished.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateBulkStatus = async (enquiryId: number, status: string) => {
    await fetch(`/api/admin/bulk-enquiries/${enquiryId}/update`, {
      method: 'POST',
      headers: getHeaders(idToken),
      body: JSON.stringify({ status }),
    });
    showToast('ok', `Enquiry marked as ${status}.`);
    await fetchDashboard();
  };

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'overview', label: 'Home', icon: <Store className="w-4 h-4" /> },
    {
      id: 'orders',
      label: 'Orders',
      icon: <ShoppingBag className="w-4 h-4" />,
      badge: metrics.pendingOrdersCount || orders.filter((o) => !['COLLECTED', 'DELIVERED', 'CANCELLED'].includes(o?.order?.orderStatus)).length || undefined,
    },
    {
      id: 'products',
      label: 'Stock',
      icon: <Package className="w-4 h-4" />,
      badge: lowStockProducts.length > 0 ? lowStockProducts.length : undefined,
    },
    { id: 'settings', label: 'Store & Offers', icon: <Settings className="w-4 h-4" /> },
  ];

  const pendingPickupOrders = orders.filter(
    (o) =>
      o?.order?.fulfilmentMethod === 'STORE_PICKUP' &&
      !['COLLECTED', 'CANCELLED'].includes(o?.order?.orderStatus)
  );

  return (
    <div className="liquid-admin-shell pb-28 lg:pb-12">
      {/* Top Floating Liquid Glass Shopkeeper Bar */}
      <div className="sticky top-0 z-40 px-3 sm:px-6 pt-3">
        <div className="max-w-7xl mx-auto liquid-admin-glass-bar text-white px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight truncate font-sans">
                  Gayatri Stationers · Shop Manager
                </h1>
                <span className="hidden sm:inline-flex text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/15 border border-white/20">
                  Kanpur Counter
                </span>
              </div>
              <p className="text-[11px] text-[#FFF5F0]/85 truncate">
                {currentUser?.email || 'Store Owner'} · Simple everyday counter panel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchDashboard}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-white/15 hover:bg-white/25 border border-white/20 transition cursor-pointer"
              title="Refresh store data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {onRoleSwitched && (
              <button
                type="button"
                onClick={async () => {
                  await onRoleSwitched('customer');
                  onExitAdmin();
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-white text-[#1F1C18] hover:bg-[#FDF2ED] transition cursor-pointer"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Visit Shop
              </button>
            )}

            <button
              type="button"
              onClick={onExitAdmin}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-white/15 hover:bg-white/25 border border-white/25 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Toast Feedback */}
      {toast && (
        <div className="fixed top-20 right-4 sm:right-6 z-50 max-w-sm">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold ${
              toast.type === 'ok'
                ? 'liquid-glass-dark text-white'
                : 'liquid-glass text-[#1F1C18] border-[#B44C2E]/45'
            }`}
          >
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#FCEAE3]" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-[#B44C2E]" />
            )}
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-5">
        {/* Desktop Pill Tab Switcher (mobile uses bottom dock) */}
        <div className="hidden lg:flex items-center justify-between gap-4 mb-6">
          <div className="inline-flex p-1.5 rounded-full liquid-glass gap-1">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                    active
                      ? 'liquid-btn-primary text-white shadow-sm'
                      : 'text-[#4A423B] hover:text-[#1F1C18] hover:bg-white/60'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        active ? 'bg-white/20 text-white' : 'bg-[#FDF2ED] text-[#8C341B]'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openNewProductModal}
              className="liquid-btn-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>
        </div>

        {/* ============================================================
            TAB 1: OVERVIEW (TODAY'S COUNTER)
           ============================================================ */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 4 Key Numbers Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="liquid-glass rounded-3xl p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5C5349]">
                  Total Revenue
                </p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-[#1F1C18] tabular-nums">
                  {formatPaiseToINR(Number(metrics.paidRevenuePaise || 0), false)}
                </p>
                <p className="mt-1 text-xs text-[#5C5349]">Active + paid bills</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setOrderFilter('ALL');
                  setActiveTab('orders');
                }}
                className="liquid-glass liquid-card-hover rounded-3xl p-4 sm:p-5 text-left cursor-pointer"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5C5349]">
                  Orders
                </p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-[#1F1C18] tabular-nums">
                  {orders.length}
                </p>
                <p className="mt-1 text-xs text-[#B44C2E] font-medium">Tap to view orders →</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOrderFilter('PICKUP');
                  setActiveTab('orders');
                }}
                className="liquid-glass liquid-card-hover rounded-3xl p-4 sm:p-5 text-left cursor-pointer"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5C5349]">
                  Store Pickups Waiting
                </p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-[#1F1C18] tabular-nums">
                  {pendingPickupOrders.length}
                </p>
                <p className="mt-1 text-xs text-[#B44C2E] font-medium">Check pickup queue →</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProductStockFilter('LOW');
                  setActiveTab('products');
                }}
                className="liquid-glass liquid-card-hover rounded-3xl p-4 sm:p-5 text-left cursor-pointer"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5C5349]">
                  Low Stock Alerts
                </p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-[#1F1C18] tabular-nums">
                  {lowStockProducts.length}
                </p>
                <p className="mt-1 text-xs text-[#B44C2E] font-medium">
                  {lowStockProducts.length > 0 ? 'Tap to restock →' : 'All items stocked'}
                </p>
              </button>
            </div>

            {/* Instant 6-Digit Counter Pickup Lookup + Revenue Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Counter Pickup Code Check */}
              <div className="lg:col-span-5 liquid-glass-dark text-white rounded-3xl p-5 sm:p-6 flex flex-col justify-between">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider bg-white/15 px-3 py-1 rounded-full">
                    <KeyRound className="w-3.5 h-3.5" /> Counter Pickup Check
                  </span>
                  <h2 className="mt-3 text-xl font-bold font-serif-display">
                    Verify Customer Pickup Code
                  </h2>
                  <p className="mt-1 text-xs text-[#FFF5F0]/85">
                    When a customer comes to Naubasta shop, enter their 6-digit pickup code or order
                    number.
                  </p>

                  <div className="mt-4 flex gap-2">
                    <input
                      type="text"
                      value={pickupCodeInput}
                      onChange={(e) => setPickupCodeInput(e.target.value)}
                      placeholder="e.g. 482910 or GS-..."
                      className="flex-1 rounded-2xl bg-white/15 border border-white/25 px-4 py-3 text-sm text-white placeholder:text-[#FCEAE3]/75 focus:outline-none focus:bg-white/20"
                    />
                    {pickupCodeInput && (
                      <button
                        type="button"
                        onClick={() => setPickupCodeInput('')}
                        className="px-3.5 rounded-2xl bg-white/15 hover:bg-white/25 text-xs font-semibold cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {matchedPickupOrder ? (
                  <div className="mt-4 rounded-2xl bg-white text-[#1F1C18] p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold font-mono-tabular">
                        {matchedPickupOrder.order.orderNumber}
                      </span>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#FDF2ED] text-[#8C341B]">
                        {matchedPickupOrder.order.paymentStatus}
                      </span>
                    </div>
                    <p className="text-sm font-bold">{matchedPickupOrder.order.customerName}</p>
                    <p className="text-xs text-[#5C5349]">
                      Bill: {formatPaiseToINR(matchedPickupOrder.order.totalPaise)} ·{' '}
                      {matchedPickupOrder.items?.length || 1} item(s)
                    </p>
                    {matchedPickupOrder.order.orderStatus !== 'COLLECTED' ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          handleQuickOrderUpdate(
                            matchedPickupOrder,
                            'COLLECTED',
                            'PAID',
                            'Verified pickup code at Kanpur shop counter and handed over.'
                          )
                        }
                        className="w-full liquid-btn-primary py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        Confirm Handover & Mark Paid
                      </button>
                    ) : (
                      <div className="text-xs font-semibold text-[#B44C2E] flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Already handed over
                      </div>
                    )}
                  </div>
                ) : pickupCodeInput.trim() ? (
                  <p className="mt-4 text-xs text-[#FCEAE3]">
                    No pickup order matches "{pickupCodeInput.trim()}".
                  </p>
                ) : pendingPickupOrders.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-[11px] text-[#FCEAE3] font-medium">Waiting at counter:</p>
                    <div className="flex flex-wrap gap-2">
                      {pendingPickupOrders.slice(0, 3).map((po) => (
                        <button
                          key={po.order.id}
                          type="button"
                          onClick={() =>
                            setPickupCodeInput(
                              po.pickupDetails?.pickupCode || po.order.orderNumber
                            )
                          }
                          className="text-xs px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 cursor-pointer"
                        >
                          {po.order.customerName?.split(' ')[0]} ·{' '}
                          <span className="font-mono-tabular font-bold">
                            {po.pickupDetails?.pickupCode || po.order.orderNumber}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-[#FCEAE3]/85">
                    No customer pickup orders waiting right now.
                  </p>
                )}
              </div>

              {/* Weekly Sales Curve */}
              <div className="lg:col-span-7 liquid-glass rounded-3xl p-5 sm:p-6">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-[#1F1C18] font-serif-display">
                      Weekly Store Sales Trend
                    </h2>
                    <p className="text-xs text-[#5C5349]">
                      Online + Kanpur counter orders combined (₹)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openNewProductModal}
                    className="liquid-btn-glass px-3.5 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Product
                  </button>
                </div>

                <div className="h-52 w-full">
                  {orders.length === 0 ? (
                    <div className="h-full rounded-2xl liquid-glass-subtle flex flex-col items-center justify-center text-center p-4">
                      <ShoppingBag className="w-7 h-7 text-[#B44C2E]/45 mb-2" />
                      <p className="text-xs font-bold text-[#1F1C18]">No recorded sales yet</p>
                      <p className="text-[11px] text-[#5C5349] mt-1 max-w-xs">
                        Real orders placed on the storefront or counter will plot automatically here.
                      </p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueChartData} margin={{ top: 6, right: 12, left: -12, bottom: 0 }}>
                        <defs>
                          <linearGradient id="terracottaGlassFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#B44C2E" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#B44C2E" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(180,76,46,0.14)" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#5C5349' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#5C5349' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '16px',
                            border: '1px solid #E8D8CC',
                            background: 'rgba(255,253,249,0.96)',
                            fontSize: '12px',
                          }}
                          formatter={(val: any) => [`₹${val}`, 'Sales']}
                        />
                        <Area
                          type="monotone"
                          dataKey="sales"
                          stroke="#B44C2E"
                          strokeWidth={2.5}
                          fill="url(#terracottaGlassFill)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Low-Stock Shelf Restock Strip */}
            {lowStockProducts.length > 0 && (
              <div className="liquid-glass rounded-3xl p-5 sm:p-6">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-base font-bold text-[#1F1C18]">
                      Items Running Low on Shelf (≤ 10 left)
                    </h3>
                    <p className="text-xs text-[#5C5349]">
                      Tap +10 when fresh cartons arrive at your shop.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {lowStockProducts.slice(0, 6).map((item) => {
                    const qty = Number(item.totalStock ?? item.variants?.[0]?.stockQuantity ?? 0);
                    return (
                      <div
                        key={item.id}
                        className="liquid-glass-subtle rounded-2xl p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#1F1C18] truncate">{item.name}</p>
                          <p className="text-[11px] text-[#5C5349]">
                            SKU: {item.sku} · <span className="font-bold">{qty} left</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickStockAdjust(item, 10)}
                          className="liquid-btn-primary px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer"
                        >
                          +10 Stock
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            TAB 2: ORDERS
           ============================================================ */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {/* Search & Filter Pills */}
            <div className="liquid-glass rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'ALL', label: `All (${orders.length})` },
                    { id: 'ACTIVE', label: 'Needs Action' },
                    { id: 'PICKUP', label: 'Store Pickup' },
                    { id: 'DELIVERY', label: 'Home Delivery' },
                    { id: 'UNPAID', label: 'Unpaid' },
                  ] as Array<{ id: OrderFilter; label: string }>
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setOrderFilter(f.id)}
                    className={`px-3.5 py-2 rounded-full text-xs font-semibold transition cursor-pointer ${
                      orderFilter === f.id
                        ? 'liquid-btn-primary text-white'
                        : 'liquid-btn-glass text-[#1F1C18]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-[#7A6F64] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search order #, phone, name..."
                  className="liquid-input w-full pl-10 pr-4 py-2.5 rounded-full text-xs"
                />
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="liquid-glass rounded-3xl p-10 text-center">
                <ShoppingBag className="w-10 h-10 text-[#9E9286] mx-auto mb-2" />
                <p className="text-sm font-bold text-[#1F1C18]">No orders match this filter</p>
                <p className="text-xs text-[#5C5349] mt-1">
                  New customer orders placed online or at pickup counter appear here immediately.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((entry) => {
                  const ord = entry.order || {};
                  const isExpanded = expandedOrderId === ord.id;
                  const isPickup = ord.fulfilmentMethod === 'STORE_PICKUP';
                  const isCompleted =
                    ord.orderStatus === 'COLLECTED' ||
                    ord.orderStatus === 'DELIVERED' ||
                    ord.orderStatus === 'CANCELLED';

                  return (
                    <div key={ord.id} className="liquid-glass rounded-3xl p-4 sm:p-5">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono-tabular text-xs font-bold text-[#1F1C18]">
                              {ord.orderNumber}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FDF2ED] text-[#1F1C18]">
                              {isPickup ? <Store className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                              {isPickup ? 'Store Pickup' : 'Home Delivery'}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                ord.paymentStatus === 'PAID'
                                  ? 'bg-[#1F1C18] text-white'
                                  : 'border border-[#D9C7B8] bg-white/80 text-[#8C341B]'
                              }`}
                            >
                              {ord.paymentStatus === 'PAID' ? 'PAID' : ord.paymentStatus || 'PENDING'}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/80 border border-[#E8DFD5] text-[#8C341B]">
                              {String(ord.orderStatus || '').replace(/_/g, ' ')}
                            </span>
                          </div>

                          <p className="text-sm font-bold text-[#1F1C18]">
                            {ord.customerName} ·{' '}
                            <a href={`tel:${ord.customerPhone}`} className="underline decoration-[#DEC6B6]">
                              {ord.customerPhone}
                            </a>
                          </p>
                          <p className="text-xs text-[#5C5349]">
                            {(entry.items || [])
                              .map((it: any) => `${it.productName} ×${it.quantity}`)
                              .join(', ')}
                            {entry?.pickupDetails?.pickupCode
                              ? ` · Pickup Code: ${entry.pickupDetails.pickupCode}`
                              : ''}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-bold text-[#1F1C18] tabular-nums mr-2">
                            {formatPaiseToINR(ord.totalPaise)}
                          </span>

                          {/* 1-Tap Counter Actions */}
                          {!isCompleted && isPickup && ord.orderStatus !== 'READY_FOR_PICKUP' && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                handleQuickOrderUpdate(entry, 'READY_FOR_PICKUP', ord.paymentStatus)
                              }
                              className="liquid-btn-glass px-3.5 py-2 rounded-full text-xs font-semibold cursor-pointer"
                            >
                              Mark Ready
                            </button>
                          )}

                          {!isCompleted && isPickup && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleQuickOrderUpdate(entry, 'COLLECTED', 'PAID')}
                              className="liquid-btn-primary px-3.5 py-2 rounded-full text-xs font-semibold cursor-pointer"
                            >
                              Handed Over & Paid
                            </button>
                          )}

                          {!isCompleted && !isPickup && ord.orderStatus !== 'DISPATCHED' && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                handleQuickOrderUpdate(entry, 'DISPATCHED', ord.paymentStatus)
                              }
                              className="liquid-btn-glass px-3.5 py-2 rounded-full text-xs font-semibold cursor-pointer"
                            >
                              Mark Dispatched
                            </button>
                          )}

                          {!isCompleted && !isPickup && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleQuickOrderUpdate(entry, 'DELIVERED', 'PAID')}
                              className="liquid-btn-primary px-3.5 py-2 rounded-full text-xs font-semibold cursor-pointer"
                            >
                              Delivered & Paid
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setExpandedOrderId(isExpanded ? null : ord.id)}
                            className="liquid-btn-glass px-3 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            Details
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-[#E8DFD5]">
                          <OrderTrackingTimeline
                            orderEntry={entry}
                            isOwnerOrStaff={true}
                            idToken={idToken}
                            onOrderUpdated={() => {
                              fetchDashboard();
                              onRefreshStorefront();
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            TAB 3: CATALOGUE & STOCK
           ============================================================ */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            {/* Top Controls */}
            <div className="liquid-glass rounded-3xl p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#7A6F64] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search item by name, SKU, brand..."
                    className="liquid-input w-full pl-10 pr-4 py-2.5 rounded-full text-xs sm:text-sm"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCatBrandSheet((v) => !v)}
                    className="liquid-btn-glass px-3.5 py-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    Categories & Brands ({categories.length}/{brands.length})
                  </button>

                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="liquid-btn-glass px-3.5 py-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Excel/CSV
                  </button>

                  <button
                    type="button"
                    onClick={openNewProductModal}
                    className="liquid-btn-primary px-4 py-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Product
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'ALL', label: `All Items (${products.length})` },
                    { id: 'LOW', label: `Low Stock (${lowStockProducts.length})` },
                    {
                      id: 'HIDDEN',
                      label: `Hidden (${products.filter((p) => p.isActive === false).length})`,
                    },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setProductStockFilter(f.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
                      productStockFilter === f.id
                        ? 'liquid-btn-primary text-white'
                        : 'liquid-btn-glass text-[#1F1C18]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Collapsible Categories & Brands Manager */}
            {showCatBrandSheet && (
              <div className="liquid-glass rounded-3xl p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-bold text-[#1F1C18] mb-2">Shop Categories</h3>
                  <form onSubmit={handleAddCategory} className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={newCatInput}
                      onChange={(e) => setNewCatInput(e.target.value)}
                      placeholder="e.g. Exam Boards & Pads"
                      className="liquid-input flex-1 px-3.5 py-2 rounded-full text-xs"
                    />
                    <button
                      type="submit"
                      className="liquid-btn-primary px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
                    >
                      Add
                    </button>
                  </form>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <span
                        key={cat.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full liquid-glass-subtle text-xs font-medium text-[#1F1C18]"
                      >
                        {cat.name}
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          className="text-[#7A6F64] hover:text-[#1F1C18] cursor-pointer"
                          title="Delete category"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-[#1F1C18] mb-2">Stocked Brands</h3>
                  <form onSubmit={handleAddBrand} className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={newBrandInput}
                      onChange={(e) => setNewBrandInput(e.target.value)}
                      placeholder="e.g. Unomax or Faber-Castell"
                      className="liquid-input flex-1 px-3.5 py-2 rounded-full text-xs"
                    />
                    <button
                      type="submit"
                      className="liquid-btn-primary px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
                    >
                      Add
                    </button>
                  </form>
                  <div className="flex flex-wrap gap-2">
                    {brands.map((brand) => (
                      <span
                        key={brand.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full liquid-glass-subtle text-xs font-medium text-[#1F1C18]"
                      >
                        {brand.name}
                        <button
                          type="button"
                          onClick={() => handleDeleteBrand(brand.id, brand.name)}
                          className="text-[#7A6F64] hover:text-[#1F1C18] cursor-pointer"
                          title="Delete brand"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Product Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProducts.map((prod) => {
                const stock = Number(prod.totalStock ?? prod.variants?.[0]?.stockQuantity ?? 0);
                const sellPaise = Number(
                  prod.sellingPricePaise ?? prod.variants?.[0]?.sellingPricePaise ?? 0
                );
                const mrpPaise = Number(prod.mrpPaise ?? prod.variants?.[0]?.mrpPaise ?? sellPaise);
                return (
                  <div
                    key={prod.id}
                    className={`liquid-glass rounded-3xl p-4 flex flex-col justify-between gap-3 ${
                      prod.isActive === false ? 'opacity-70' : ''
                    }`}
                  >
                    <div className="flex gap-3.5">
                      <div className="w-20 h-20 rounded-2xl liquid-glass-subtle overflow-hidden shrink-0 flex items-center justify-center">
                        <ProductIllustration
                          type={prod.illustrationType}
                          imageUrl={prod.imageUrl}
                          alt={prod.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-bold text-[#1F1C18] leading-snug line-clamp-2">
                            {prod.name}
                          </h3>
                        </div>
                        <p className="text-[11px] text-[#5C5349] mt-0.5 truncate">
                          {prod.brandName} · {prod.categoryName} ·{' '}
                          <span className="font-mono-tabular">{prod.sku}</span>
                        </p>

                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-base font-bold text-[#1F1C18] tabular-nums">
                            {formatPaiseToINR(sellPaise, false)}
                          </span>
                          {mrpPaise > sellPaise && (
                            <span className="text-xs line-through text-[#8B8075] tabular-nums">
                              {formatPaiseToINR(mrpPaise, false)}
                            </span>
                          )}
                          <span
                            className={`ml-auto text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                              stock <= 10
                                ? 'bg-[#1F1C18] text-white'
                                : 'bg-[#FDF2ED] text-[#8C341B]'
                            }`}
                          >
                            {stock} in stock
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Instant 1-tap Stock & Item Controls */}
                    <div className="pt-3 border-t border-[#E8DFD5] flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleQuickStockAdjust(prod, -1)}
                          className="liquid-btn-glass px-2.5 py-1.5 rounded-full text-xs font-bold cursor-pointer"
                          title="Sold 1 offline"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickStockAdjust(prod, 5)}
                          className="liquid-btn-glass px-2.5 py-1.5 rounded-full text-xs font-bold cursor-pointer"
                          title="Add 5 units"
                        >
                          +5
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickStockAdjust(prod, 10)}
                          className="liquid-btn-primary px-2.5 py-1.5 rounded-full text-xs font-bold cursor-pointer"
                          title="Add 10 units"
                        >
                          +10
                        </button>
                      </div>

                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditProductModal(prod, false)}
                          className="liquid-btn-glass p-2 rounded-full cursor-pointer"
                          title="Edit product"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditProductModal(prod, true)}
                          className="liquid-btn-glass p-2 rounded-full cursor-pointer"
                          title="Duplicate product"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleProductVisibility(prod)}
                          className="liquid-btn-glass p-2 rounded-full cursor-pointer"
                          title={prod.isActive === false ? 'Show on website' : 'Hide from website'}
                        >
                          {prod.isActive === false ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(prod)}
                          className="liquid-btn-glass p-2 rounded-full cursor-pointer"
                          title="Remove product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 4: OFFERS, BULK ENQUIRIES & STORE SETTINGS
           ============================================================ */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Promo Coupons */}
            <div className="lg:col-span-6 liquid-glass rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#B44C2E]" />
                <h2 className="text-lg font-bold text-[#1F1C18] font-serif-display">
                  Discount Coupon Codes
                </h2>
              </div>

              <form onSubmit={handleSaveCoupon} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={couponForm.code}
                  onChange={(e) => setCouponForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="Code (e.g. KANPUR15)"
                  className="liquid-input px-3.5 py-2.5 rounded-2xl text-xs uppercase font-bold"
                />
                <select
                  value={couponForm.discountType}
                  onChange={(e) =>
                    setCouponForm((f) => ({
                      ...f,
                      discountType: e.target.value === 'FLAT' ? 'FLAT' : 'PERCENTAGE',
                    }))
                  }
                  className="liquid-input px-3.5 py-2.5 rounded-2xl text-xs"
                >
                  <option value="PERCENTAGE">% Off Total</option>
                  <option value="FLAT">Flat ₹ Off</option>
                </select>
                <input
                  type="number"
                  min={1}
                  value={couponForm.discountValue}
                  onChange={(e) => setCouponForm((f) => ({ ...f, discountValue: e.target.value }))}
                  placeholder={couponForm.discountType === 'PERCENTAGE' ? 'Discount % (e.g. 10)' : 'Flat ₹ Off (e.g. 50)'}
                  className="liquid-input px-3.5 py-2.5 rounded-2xl text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={couponForm.minOrderRupees}
                  onChange={(e) => setCouponForm((f) => ({ ...f, minOrderRupees: e.target.value }))}
                  placeholder="Min Bill ₹ (e.g. 299)"
                  className="liquid-input px-3.5 py-2.5 rounded-2xl text-xs"
                />
                <input
                  type="text"
                  value={couponForm.description}
                  onChange={(e) => setCouponForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Short description shown in cart"
                  className="liquid-input sm:col-span-2 px-3.5 py-2.5 rounded-2xl text-xs"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="liquid-btn-primary sm:col-span-2 py-2.5 rounded-full text-xs font-semibold cursor-pointer"
                >
                  Create / Update Offer Code
                </button>
              </form>

              <div className="space-y-2 pt-2">
                {coupons.map((c) => (
                  <div
                    key={c.code}
                    className="liquid-glass-subtle rounded-2xl p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-xs font-bold font-mono-tabular text-[#1F1C18]">
                        {c.code} ·{' '}
                        <span className="font-sans font-semibold text-[#B44C2E]">
                          {c.discountType === 'PERCENTAGE'
                            ? `${c.discountValue}% OFF`
                            : `${formatPaiseToINR(c.discountValue, false)} OFF`}
                        </span>
                      </p>
                      <p className="text-[11px] text-[#5C5349]">
                        {c.description} (Min bill {formatPaiseToINR(c.minOrderPaise || 0, false)})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleCoupon(c)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer ${
                        c.isActive
                          ? 'liquid-btn-primary text-white'
                          : 'liquid-btn-glass text-[#8C341B]'
                      }`}
                    >
                      {c.isActive ? 'Active' : 'Paused'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Store Notice & Contact Details */}
            <div className="lg:col-span-6 space-y-5">
              <form onSubmit={handleSaveStoreNotice} className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-3.5">
                <div className="flex items-center gap-2">
                  <Store className="w-5 h-5 text-[#B44C2E]" />
                  <h2 className="text-lg font-bold text-[#1F1C18] font-serif-display">
                    Storefront Notice & Contact
                  </h2>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#5C5349] mb-1">
                    Top Strip Announcement
                  </label>
                  <input
                    type="text"
                    value={storeNoticeText}
                    onChange={(e) => setStoreNoticeText(e.target.value)}
                    className="liquid-input w-full px-3.5 py-2.5 rounded-2xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#5C5349] mb-1">
                    Homepage Big Headline
                  </label>
                  <input
                    type="text"
                    value={heroHeadline}
                    onChange={(e) => setHeroHeadline(e.target.value)}
                    className="liquid-input w-full px-3.5 py-2.5 rounded-2xl text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5C5349] mb-1">
                      Shop Phone / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={storePhoneInput}
                      onChange={(e) => setStorePhoneInput(e.target.value)}
                      className="liquid-input w-full px-3.5 py-2.5 rounded-2xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5C5349] mb-1">
                      Shop Address
                    </label>
                    <input
                      type="text"
                      value={storeAddressInput}
                      onChange={(e) => setStoreAddressInput(e.target.value)}
                      className="liquid-input w-full px-3.5 py-2.5 rounded-2xl text-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="liquid-btn-primary px-5 py-2.5 rounded-full text-xs font-semibold cursor-pointer"
                >
                  Save Website Banner & Info
                </button>
              </form>

              {/* Cashfree Payments Setup */}
              <form onSubmit={handleSaveCashfree} className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-[#B44C2E]" />
                    <h2 className="text-lg font-bold text-[#1F1C18] font-serif-display">
                      Online Payments (Cashfree UPI/Cards)
                    </h2>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#FDF2ED] text-[#1F1C18]">
                    {cfForm.environment}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={cfForm.appId}
                    onChange={(e) => setCfForm((f) => ({ ...f, appId: e.target.value }))}
                    placeholder="Cashfree App ID"
                    className="liquid-input px-3.5 py-2.5 rounded-2xl text-xs font-mono-tabular"
                  />
                  <input
                    type="password"
                    value={cfForm.secretKey}
                    onChange={(e) => setCfForm((f) => ({ ...f, secretKey: e.target.value }))}
                    placeholder="Cashfree Secret Key"
                    className="liquid-input px-3.5 py-2.5 rounded-2xl text-xs font-mono-tabular"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={cfForm.environment}
                    onChange={(e) =>
                      setCfForm((f) => ({
                        ...f,
                        environment: e.target.value === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
                      }))
                    }
                    className="liquid-input px-3.5 py-2 rounded-full text-xs"
                  >
                    <option value="SANDBOX">Test Mode (Sandbox)</option>
                    <option value="PRODUCTION">Live Payments (Production)</option>
                  </select>

                  <button
                    type="submit"
                    disabled={saving}
                    className="liquid-btn-primary px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
                  >
                    Save Payment Keys
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleTestCashfree}
                    className="liquid-btn-glass px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
                  >
                    Test Connection
                  </button>
                </div>
                {cfTestResult && (
                  <p className="text-xs font-semibold text-[#8C341B]">{cfTestResult}</p>
                )}
              </form>
            </div>

            {/* Bulk School & Office Enquiries */}
            <div className="lg:col-span-12 liquid-glass rounded-3xl p-5 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#B44C2E]" />
                  <h2 className="text-lg font-bold text-[#1F1C18] font-serif-display">
                    School & Office Bulk Enquiries ({bulkEnquiries.length})
                  </h2>
                </div>
              </div>

              {bulkEnquiries.length === 0 ? (
                <p className="text-xs text-[#5C5349]">
                  No bulk quote requests yet. Requests submitted on the Bulk Orders page appear here.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {bulkEnquiries.map((enq) => (
                    <div
                      key={enq.id}
                      className="liquid-glass-subtle rounded-2xl p-4 flex flex-col justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold font-mono-tabular text-[#1F1C18]">
                            {enq.enquiryNumber}
                          </span>
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#1F1C18] text-white">
                            {enq.status}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-[#1F1C18] mt-1">
                          {enq.institutionName}
                        </p>
                        <p className="text-xs text-[#4A423B]">
                          {enq.contactPerson} ·{' '}
                          <a href={`tel:${enq.phone}`} className="underline inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {enq.phone}
                          </a>
                        </p>
                        {enq.notes && (
                          <p className="text-xs text-[#5C5349] mt-1.5 italic">"{enq.notes}"</p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {['NEW', 'QUOTED', 'CONFIRMED', 'CLOSED'].map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleUpdateBulkStatus(enq.id, st)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer ${
                              enq.status === st
                                ? 'liquid-btn-primary text-white'
                                : 'liquid-btn-glass text-[#8C341B]'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Floating Liquid Glass Bottom Dock */}
      <div className="lg:hidden fixed bottom-3 inset-x-3 z-40">
        <div className="liquid-admin-dock px-2 py-2 flex items-center justify-around">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center gap-1 px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                  active ? 'bg-white text-[#1F1C18] shadow-sm' : 'text-[#FFF5F0]/90'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={openNewProductModal}
            className="flex flex-col items-center gap-1 px-3.5 py-1.5 rounded-full text-[11px] font-semibold bg-white/15 text-white cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* ============================================================
          CLEAN ADD / EDIT PRODUCT GLASS SHEET
         ============================================================ */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#1F1C18]/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="liquid-glass w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#E8DFD5]">
              <div>
                <h2 className="text-lg font-bold text-[#1F1C18] font-serif-display">
                  {productForm.id ? 'Edit Stationery Item' : 'Add Stationery Item'}
                </h2>
                <p className="text-xs text-[#5C5349]">
                  Fill name, price & stock — everything else is optional.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="liquid-btn-glass p-2 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1F1C18] mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Classmate Pulse A4 Spiral Notebook (300 Pages)"
                  className="liquid-input w-full px-4 py-2.5 rounded-2xl text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1F1C18] mb-1">
                    Our Price (₹) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={productForm.sellingPriceRupees}
                    onChange={(e) =>
                      setProductForm((f) => ({ ...f, sellingPriceRupees: e.target.value }))
                    }
                    className="liquid-input w-full px-3.5 py-2.5 rounded-2xl text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1F1C18] mb-1">
                    MRP (₹)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={productForm.mrpRupees}
                    onChange={(e) => setProductForm((f) => ({ ...f, mrpRupees: e.target.value }))}
                    className="liquid-input w-full px-3.5 py-2.5 rounded-2xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1F1C18] mb-1">
                    Stock Qty *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={productForm.initialStockQuantity}
                    onChange={(e) =>
                      setProductForm((f) => ({ ...f, initialStockQuantity: e.target.value }))
                    }
                    className="liquid-input w-full px-3.5 py-2.5 rounded-2xl text-sm font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1F1C18] mb-1">
                    Category
                  </label>
                  <select
                    value={productForm.categoryId}
                    onChange={(e) => setProductForm((f) => ({ ...f, categoryId: e.target.value }))}
                    className="liquid-input w-full px-3.5 py-2.5 rounded-2xl text-xs"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1F1C18] mb-1">Brand</label>
                  <select
                    value={productForm.brandId}
                    onChange={(e) => setProductForm((f) => ({ ...f, brandId: e.target.value }))}
                    className="liquid-input w-full px-3.5 py-2.5 rounded-2xl text-xs"
                  >
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Photo Picker */}
              <div className="liquid-glass-subtle rounded-2xl p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#1F1C18] inline-flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4" /> Product Photo
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleUploadProductPhoto}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingPhoto}
                      onClick={() => fileInputRef.current?.click()}
                      className="liquid-btn-primary px-3 py-1.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      {uploadingPhoto ? 'Uploading...' : 'Upload Phone / PC Photo'}
                    </button>
                    <button
                      type="button"
                      disabled={loadingWebPhotos}
                      onClick={handleFindWebPhotos}
                      className="liquid-btn-glass px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer"
                    >
                      {loadingWebPhotos ? 'Searching...' : 'Pick Studio Photo'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-white/80 border border-[#E8DFD5] overflow-hidden shrink-0">
                    <ProductIllustration
                      type={productForm.illustrationType}
                      imageUrl={productForm.imageUrl}
                      alt={productForm.name || 'Preview'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <input
                    type="text"
                    value={productForm.imageUrl}
                    onChange={(e) => setProductForm((f) => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="Or paste photo URL (optional — leaves clean icon if blank)"
                    className="liquid-input flex-1 px-3 py-2 rounded-xl text-xs"
                  />
                </div>

                {webPhotos.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
                    {webPhotos.map((wp, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setProductForm((f) => ({ ...f, imageUrl: wp.url }))}
                        className={`rounded-xl overflow-hidden border-2 h-14 cursor-pointer ${
                          productForm.imageUrl === wp.url
                            ? 'border-[#B44C2E]'
                            : 'border-white/70'
                        }`}
                      >
                        <img src={wp.url} alt={wp.title} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Simple Checkboxes */}
              <div className="flex flex-wrap gap-3 text-xs font-semibold text-[#1F1C18]">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.pickupEligible}
                    onChange={(e) =>
                      setProductForm((f) => ({ ...f, pickupEligible: e.target.checked }))
                    }
                  />
                  Store Pickup
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.deliveryEligible}
                    onChange={(e) =>
                      setProductForm((f) => ({ ...f, deliveryEligible: e.target.checked }))
                    }
                  />
                  Home Delivery
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.isBestseller}
                    onChange={(e) =>
                      setProductForm((f) => ({ ...f, isBestseller: e.target.checked }))
                    }
                  />
                  Bestseller
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.isActive}
                    onChange={(e) => setProductForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  Show in Store
                </label>
              </div>

              {/* Optional More Details */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedProduct((v) => !v)}
                  className="text-xs font-semibold text-[#B44C2E] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  {showAdvancedProduct ? 'Hide' : 'Show'} extra details (SKU, GST%, description)
                  {showAdvancedProduct ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {showAdvancedProduct && (
                  <div className="mt-3 space-y-3 pt-3 border-t border-[#E8DFD5]">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        value={productForm.sku}
                        onChange={(e) => setProductForm((f) => ({ ...f, sku: e.target.value }))}
                        placeholder="SKU (auto if empty)"
                        className="liquid-input px-3 py-2 rounded-xl text-xs font-mono-tabular"
                      />
                      <input
                        type="text"
                        value={productForm.variantName}
                        onChange={(e) =>
                          setProductForm((f) => ({ ...f, variantName: e.target.value }))
                        }
                        placeholder="Pack / Size"
                        className="liquid-input px-3 py-2 rounded-xl text-xs"
                      />
                      <select
                        value={productForm.illustrationType}
                        onChange={(e) =>
                          setProductForm((f) => ({ ...f, illustrationType: e.target.value }))
                        }
                        className="liquid-input px-3 py-2 rounded-xl text-xs"
                      >
                        {ILLUSTRATION_PRESETS.map((preset) => (
                          <option key={preset.value} value={preset.value}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      rows={2}
                      value={productForm.shortDescription}
                      onChange={(e) =>
                        setProductForm((f) => ({ ...f, shortDescription: e.target.value }))
                      }
                      placeholder="Short note shown on product page"
                      className="liquid-input w-full px-3.5 py-2 rounded-xl text-xs"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="liquid-btn-glass px-5 py-2.5 rounded-full text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="liquid-btn-primary px-6 py-2.5 rounded-full text-xs font-semibold cursor-pointer"
                >
                  {saving ? 'Saving...' : productForm.id ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
