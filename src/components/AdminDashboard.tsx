import React, { useState, useEffect, useCallback } from 'react';
import {
  formatPaiseToINR,
} from '../lib/domain-logic.ts';
import {
  ProductIllustration,
  ILLUSTRATION_PRESETS,
} from './ProductIllustration.tsx';
import { OrderTrackingTimeline } from './OrderTrackingTimeline.tsx';
import { FirebaseImageUpload } from './FirebaseImageUpload.tsx';
import {
  Package,
  ClipboardList,
  Upload,
  Download,
  Plus,
  Store,
  Tag,
  MapPin,
  Building2,
  Settings,
  RefreshCw,
  Sparkles,
  Image as ImageIcon,
  Edit3,
  Trash2,
  FolderTree,
  Compass,
  LayoutTemplate,
  Palette,
  Copy,
  Bell,
  CheckCircle2,
  Search,
  AlertTriangle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CmsStudioManager, CmsSubTab } from './CmsStudioManager.tsx';

interface AdminDashboardProps {
  idToken: string | null;
  currentUser: {
    id: number;
    email: string;
    role: string;
    fullName?: string | null;
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

const CSV_TEMPLATE = `sku,name,category_slug,brand_name,variant_sku,variant_name,attribute_type,attribute_value,mrp_rupees,selling_price_rupees,tax_rate_percent,stock_quantity,short_description,pickup_eligible,delivery_eligible,is_sample_data
GS-NB-101,"Classmate Single Line Notebook 172 Pages",notebooks-and-diaries,Classmate,GS-NB-101-SGL,"Single Notebook (172p)",Pack Size,1 Unit,75,65,12,80,"Standard 24x18cm single line student exercise notebook",true,true,false
GS-PN-102,"Camlin Kokuyo Permanent Marker Black",office-stationery,"Kokuyo Camlin",GS-PN-102-BLK,"Single Marker Black",Ink Colour,Black,35,30,18,50,"Refillable chisel-tip permanent marker for cartons and boards",true,true,false`;

async function compressImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file format.'));
      img.onload = () => {
        const maxWidth = 800;
        const maxHeight = 600;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  idToken,
  currentUser,
  categories,
  brands,
  products,
  storeSettings,
  bootstrap,
  onRefreshStorefront,
  onRoleSwitched,
  onExitAdmin,
  onNavigateStorefront,
}) => {
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'cms'
    | 'media'
    | 'orders'
    | 'products'
    | 'csv'
    | 'promotions'
    | 'pincodes'
    | 'bulk'
    | 'settings'
  >('overview');
  const [cmsSubTab, setCmsSubTab] = useState<CmsSubTab>('categories');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Admin Notifications & Quick Usability State (100% Real PostgreSQL Data)
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'ALL' | 'UNREAD' | 'ORDER' | 'LOW_STOCK' | 'BULK_ENQUIRY'>('ALL');
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState<boolean>(true);
  const [browserNotifPermission, setBrowserNotifPermission] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });
  const [adminQuickSearch, setAdminQuickSearch] = useState('');
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [pickupCodeInput, setPickupCodeInput] = useState('');

  // Order filters
  const [orderSearch, setOrderSearch] = useState('');
  const [fulfilmentFilter, setFulfilmentFilter] = useState<'ALL' | 'STORE_PICKUP' | 'HOME_DELIVERY'>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'REFUNDED'>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // Product creation / editing & Firebase Storage media association
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | undefined>(undefined);
  const [selectedMediaProductId, setSelectedMediaProductId] = useState<number | null>(
    products[0]?.id || null
  );
  const [aiGeneratingImage, setAiGeneratingImage] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [addingInlineCategory, setAddingInlineCategory] = useState(false);
  const [addingInlineBrand, setAddingInlineBrand] = useState(false);
  const [savingInlineBrand, setSavingInlineBrand] = useState(false);
  const [savingInlineCategory, setSavingInlineCategory] = useState(false);
  const [selectedBulkProductIds, setSelectedBulkProductIds] = useState<number[]>([]);

  const [localBrandsList, setLocalBrandsList] = useState<any[]>(() => {
    const defaults = [
      { id: 1, name: 'ITC Classmate', slug: 'itc-classmate', isFeatured: true, isActive: true, status: 'PUBLISHED' },
      { id: 2, name: 'Unomax', slug: 'unomax', isFeatured: true, isActive: true, status: 'PUBLISHED' },
      { id: 3, name: 'Flair', slug: 'flair', isFeatured: true, isActive: true, status: 'PUBLISHED' },
      { id: 4, name: 'DOMS', slug: 'doms', isFeatured: true, isActive: true, status: 'PUBLISHED' },
      { id: 5, name: 'Camlin Kokuyo', slug: 'camlin-kokuyo', isFeatured: true, isActive: true, status: 'PUBLISHED' },
      { id: 6, name: 'Faber-Castell', slug: 'faber-castell', isFeatured: true, isActive: true, status: 'PUBLISHED' },
    ];
    try {
      const storedRaw = localStorage.getItem('gs_fallback_brands_v1');
      const stored = storedRaw ? JSON.parse(storedRaw) : [];
      const base = Array.isArray(brands) && brands.length > 0 ? brands : defaults;
      const merged = new Map<string, any>();
      for (const b of [...base, ...(Array.isArray(stored) ? stored : [])]) {
        if (!b || !b.name) continue;
        merged.set(String(b.slug || b.name).toLowerCase(), b);
      }
      return Array.from(merged.values());
    } catch {
      return Array.isArray(brands) && brands.length > 0 ? brands : defaults;
    }
  });

  const [localCategoriesList, setLocalCategoriesList] = useState<any[]>(() => {
    try {
      const storedRaw = localStorage.getItem('gs_fallback_categories_v1');
      const stored = storedRaw ? JSON.parse(storedRaw) : [];
      const merged = new Map<string, any>();
      for (const c of [...(Array.isArray(categories) ? categories : []), ...(Array.isArray(stored) ? stored : [])]) {
        if (!c || !c.name) continue;
        merged.set(String(c.slug || c.name).toLowerCase(), c);
      }
      return Array.from(merged.values());
    } catch {
      return Array.isArray(categories) ? categories : [];
    }
  });

  useEffect(() => {
    try {
      const storedRaw = localStorage.getItem('gs_fallback_brands_v1');
      const stored = storedRaw ? JSON.parse(storedRaw) : [];
      const dashBrands = Array.isArray(dashboardData?.brands) ? dashboardData.brands : [];
      const propBrands = Array.isArray(brands) ? brands : [];
      const merged = new Map<string, any>();
      for (const b of [...localBrandsList, ...propBrands, ...dashBrands, ...(Array.isArray(stored) ? stored : [])]) {
        if (!b || !b.name) continue;
        merged.set(String(b.slug || b.name).toLowerCase(), b);
      }
      const next = Array.from(merged.values());
      if (next.length > 0) setLocalBrandsList(next);
    } catch {
      // Ignore
    }
  }, [brands, dashboardData?.brands]);

  useEffect(() => {
    try {
      const storedRaw = localStorage.getItem('gs_fallback_categories_v1');
      const stored = storedRaw ? JSON.parse(storedRaw) : [];
      const dashCats = Array.isArray(dashboardData?.categories) ? dashboardData.categories : [];
      const propCats = Array.isArray(categories) ? categories : [];
      const merged = new Map<string, any>();
      for (const c of [...localCategoriesList, ...propCats, ...dashCats, ...(Array.isArray(stored) ? stored : [])]) {
        if (!c || !c.name) continue;
        merged.set(String(c.slug || c.name).toLowerCase(), c);
      }
      const next = Array.from(merged.values());
      if (next.length > 0) setLocalCategoriesList(next);
    } catch {
      // Ignore
    }
  }, [categories, dashboardData?.categories]);

  const [productForm, setProductForm] = useState({
    sku: '',
    name: '',
    categoryId: categories[0]?.id || 1,
    newCategoryName: '',
    brandId: brands[0]?.id || 1,
    newBrandName: '',
    shortDescription: '',
    description: '',
    badgeText: '',
    mrpRupees: '120',
    sellingPriceRupees: '105',
    taxRatePercent: 12,
    illustrationType: 'spiral_notebook',
    imageUrl: '',
    galleryUrls: [] as string[],
    initialStockQuantity: 40,
    variantName: 'Standard Pack',
    pickupEligible: true,
    deliveryEligible: true,
    isFeatured: false,
    isBestseller: false,
    isNewArrival: true,
    isActive: true,
    status: 'PUBLISHED',
    isSampleData: false,
  });

  // Inventory adjustment state
  const [stockInputs, setStockInputs] = useState<Record<number, string>>({});

  // CSV Import state
  const [csvText, setCsvText] = useState(CSV_TEMPLATE);
  const [csvResult, setCsvResult] = useState<{ importedCount: number; warnings: string[] } | null>(null);

  // Coupon form
  const [couponForm, setCouponForm] = useState({
    code: '',
    description: '',
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FLAT_PAISE',
    discountValueInput: '10',
    minOrderRupees: '399',
    maxDiscountRupees: '150',
    usageLimit: 200,
    isActive: true,
  });

  // Pincode form
  const [pincodeForm, setPincodeForm] = useState({
    pincode: '',
    city: '',
    state: 'Uttar Pradesh',
    deliveryFeeRupees: '45',
    freeThresholdRupees: '499',
    codAvailable: true,
    estimatedDays: '1–2 Business Days',
    isActive: true,
  });

  // Store Settings form
  const [profileSetting, setProfileSetting] = useState({
    storeName: storeSettings?.store_profile?.storeName || 'Gayatri Stationers',
    pickupCounterLabel:
      storeSettings?.store_profile?.pickupCounterLabel ||
      'Gayatri Stationers — Retail Pickup Counter',
    businessHoursNote:
      storeSettings?.store_profile?.businessHoursNote || 'Mon–Sat: 10:00 AM – 8:00 PM',
    supportContactNote:
      storeSettings?.store_profile?.supportContactNote || 'Configure verified store phone in Admin',
    verificationStatus:
      storeSettings?.store_profile?.verificationStatus || 'UNVERIFIED_ADMIN_CONFIG_REQUIRED',
  });

  // Cashfree Payment Gateway state
  const [cashfreeAppId, setCashfreeAppId] = useState<string>(
    storeSettings?.cashfree_config?.appId || 'TEST109386008d393f8344acfd7f332b00683901'
  );
  const [cashfreeSecretKey, setCashfreeSecretKey] = useState<string>(
    storeSettings?.cashfree_config?.secretKey || 'cfsk_ma_test_95c8c9ca404d7f56cc76f146247fe886_e2ef4f0c'
  );
  const [cashfreeEnv, setCashfreeEnv] = useState<'SANDBOX' | 'PRODUCTION'>(
    (storeSettings?.cashfree_config?.environment as 'SANDBOX' | 'PRODUCTION') || 'SANDBOX'
  );
  const [cashfreeTestResult, setCashfreeTestResult] = useState<any>(null);
  const [cashfreeTesting, setCashfreeTesting] = useState(false);
  const [cashfreeSaving, setCashfreeSaving] = useState(false);
  const [cashfreeSaveStatus, setCashfreeSaveStatus] = useState<string | null>(null);

  const buildAdminHeaders = useCallback(
    (includeJson = true): Record<string, string> => {
      const headers: Record<string, string> = {};
      if (includeJson) headers['Content-Type'] = 'application/json';
      if (idToken) headers.Authorization = `Bearer ${idToken}`;
      return headers;
    },
    [idToken]
  );

  const playNotificationChime = useCallback(() => {
    if (!soundAlertsEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.11); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // ignore audio context restrictions
    }
  }, [soundAlertsEnabled]);

  const fetchAdminData = useCallback(async () => {
    if (!dashboardData) setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: buildAdminHeaders(false),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && dashboardData) {
          // Keep current interface and dashboardData intact when previewing Customer role
          return;
        }
        throw new Error(data.error || `Access denied (HTTP ${res.status})`);
      }
      const safeOrders = Array.isArray(data?.orders) ? data.orders : [];
      const normalizedData = {
        ...data,
        metrics: {
          todaysOrdersCount: Number(data?.metrics?.todaysOrdersCount ?? safeOrders.length),
          totalOrdersCount: Number(data?.metrics?.totalOrdersCount ?? data?.metrics?.totalOrders ?? safeOrders.length),
          readyForPickupCount: Number(data?.metrics?.readyForPickupCount ?? 0),
          pendingOrdersCount: Number(data?.metrics?.pendingOrdersCount ?? 0),
          pendingOfflinePaymentsCount: Number(data?.metrics?.pendingOfflinePaymentsCount ?? 0),
          paidRevenuePaise: Number(data?.metrics?.paidRevenuePaise ?? data?.metrics?.totalRevenuePaise ?? 0),
          activeOrdersValuePaise: Number(data?.metrics?.activeOrdersValuePaise ?? 0),
          unreadNotificationsCount: Number(data?.metrics?.unreadNotificationsCount ?? 0),
          ...(data?.metrics || {}),
        },
        orders: safeOrders,
        lowStockVariants: Array.isArray(data?.lowStockVariants) ? data.lowStockVariants : [],
        inventoryMovements: Array.isArray(data?.inventoryMovements) ? data.inventoryMovements : [],
        coupons: Array.isArray(data?.coupons) ? data.coupons : [],
        serviceablePincodes: Array.isArray(data?.serviceablePincodes)
          ? data.serviceablePincodes
          : Array.isArray(data?.pincodes)
          ? data.pincodes
          : [],
        bulkEnquiries: Array.isArray(data?.bulkEnquiries)
          ? data.bulkEnquiries
          : Array.isArray(data?.enquiries)
          ? data.enquiries
          : [],
        users: Array.isArray(data?.users) ? data.users : [],
        notifications: Array.isArray(data?.notifications) ? data.notifications : [],
        pages: Array.isArray(data?.pages) ? data.pages : [],
      };
      setDashboardData(normalizedData);
      if (selectedOrder) {
        const refreshed = safeOrders.find((o: any) => o?.order?.id === selectedOrder?.order?.id);
        if (refreshed) setSelectedOrder(refreshed);
      } else if (safeOrders.length > 0) {
        setSelectedOrder(safeOrders[0]);
      }
    } catch (err: any) {
      if (!dashboardData) {
        setErrorMsg(err.message || 'Failed to load admin console.');
      }
    } finally {
      setLoading(false);
    }
  }, [buildAdminHeaders, selectedOrder, dashboardData]);

  useEffect(() => {
    fetchAdminData();
  }, [idToken]);

  // Poll live PostgreSQL notifications & orders every 20 seconds while Admin Console is open
  useEffect(() => {
    if (!idToken || (currentUser?.role !== 'owner' && currentUser?.role !== 'staff')) return;
    const timer = setInterval(() => {
      fetchAdminData();
    }, 20000);
    return () => clearInterval(timer);
  }, [idToken, currentUser?.role, fetchAdminData]);

  const handleMarkNotificationRead = async (notificationId: number) => {
    try {
      const res = await fetch(`/api/admin/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: buildAdminHeaders(true),
      });
      if (res.ok) {
        setDashboardData((prev: any) => {
          if (!prev) return prev;
          const updatedList = (prev.notifications || []).map((n: any) =>
            n.id === notificationId ? { ...n, isRead: true, status: 'READ' } : n
          );
          const unreadCount = updatedList.filter((n: any) => !n.isRead).length;
          return {
            ...prev,
            notifications: updatedList,
            metrics: { ...prev.metrics, unreadNotificationsCount: unreadCount },
          };
        });
      }
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      const res = await fetch('/api/admin/notifications/mark-all-read', {
        method: 'POST',
        headers: buildAdminHeaders(true),
      });
      if (res.ok) {
        setDashboardData((prev: any) => {
          if (!prev) return prev;
          const updatedList = (prev.notifications || []).map((n: any) => ({
            ...n,
            isRead: true,
            status: 'READ',
          }));
          return {
            ...prev,
            notifications: updatedList,
            metrics: { ...prev.metrics, unreadNotificationsCount: 0 },
          };
        });
        setStatusBanner('All database notifications marked as read.');
      }
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  const handleEnableBrowserNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setStatusBanner('Browser desktop notifications are not supported in this browser.');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setBrowserNotifPermission(perm);
      if (perm === 'granted') {
        playNotificationChime();
        new Notification('Gayatri Stationers — Admin Alerts Active', {
          body: `Live PostgreSQL alerts enabled: ${
            dashboardData?.metrics?.pendingOrdersCount || 0
          } active orders, ${dashboardData?.lowStockVariants?.length || 0} low-stock items.`,
        });
        setStatusBanner('Desktop browser notifications enabled for live orders and stock alerts.');
      }
    } catch {
      // ignore iframe permission restrictions
    }
  };

  const handleQuickRestock = async (variantId: number, currentStock: number, addQty: number) => {
    const nextQty = Math.max(0, currentStock + addQty);
    try {
      const res = await fetch('/api/admin/inventory/adjust', {
        method: 'POST',
        headers: buildAdminHeaders(true),
        body: JSON.stringify({
          variantId,
          newStockQuantity: nextQty,
          reason: `QUICK_RESTOCK_PLUS_${addQty}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Quick restock failed');
      playNotificationChime();
      setStatusBanner(`Restocked variant #${variantId} to ${nextQty} units (+${addQty}).`);
      await fetchAdminData();
      onRefreshStorefront();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleQuickOrderWorkflowUpdate = async (
    orderId: number,
    nextOrderStatus?: string,
    nextPaymentStatus?: string,
    note?: string
  ) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/update-workflow`, {
        method: 'POST',
        headers: buildAdminHeaders(true),
        body: JSON.stringify({
          nextOrderStatus,
          nextPaymentStatus,
          note: note || 'Quick action from Admin Console',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update order');
      playNotificationChime();
      setStatusBanner(
        `Order ${data.order?.order?.orderNumber || `#${orderId}`} updated successfully.`
      );
      await fetchAdminData();
      onRefreshStorefront();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleStockAdjustment = async (variantId: number) => {
    const rawVal = stockInputs[variantId];
    if (rawVal === undefined || rawVal === '') return;
    try {
      const res = await fetch('/api/admin/inventory/adjust', {
        method: 'POST',
        headers: buildAdminHeaders(true),
        body: JSON.stringify({
          variantId,
          newStockQuantity: Number(rawVal),
          reason: 'ADMIN_COUNTER_STOCK_UPDATE',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Stock adjustment failed');
      setStatusBanner(`Inventory updated to ${rawVal} units.`);
      await fetchAdminData();
      onRefreshStorefront();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Start editing an existing product (or its photo)
  const handleStartEditProduct = (p: any) => {
    const primaryVar = p.variants?.[0];
    setEditingProductId(p.id);
    setSelectedMediaProductId(p.id);
    setAddingInlineCategory(false);
    setAddingInlineBrand(false);
    setProductForm({
      sku: p.sku || '',
      name: p.name || '',
      categoryId: p.categoryId || categories[0]?.id || 1,
      newCategoryName: '',
      brandId: p.brandId || brands[0]?.id || 1,
      newBrandName: '',
      shortDescription: p.shortDescription || '',
      description: p.description || p.shortDescription || '',
      badgeText: p.badgeText || '',
      mrpRupees: String(((primaryVar?.mrpPaise ?? p.mrpPaise ?? 10000) / 100).toFixed(0)),
      sellingPriceRupees: String(
        ((primaryVar?.sellingPricePaise ?? p.sellingPricePaise ?? 9000) / 100).toFixed(0)
      ),
      taxRatePercent: p.taxRatePercent ?? 12,
      illustrationType: p.illustrationType || 'spiral_notebook',
      imageUrl: p.imageUrl || '',
      galleryUrls: Array.isArray(p.galleryUrls) ? p.galleryUrls : [],
      initialStockQuantity: primaryVar?.stockQuantity ?? p.totalStock ?? 25,
      variantName: primaryVar?.variantName || 'Standard Pack',
      pickupEligible: p.pickupEligible ?? true,
      deliveryEligible: p.deliveryEligible ?? true,
      isFeatured: Boolean(p.isFeatured),
      isBestseller: Boolean(p.isBestseller),
      isNewArrival: Boolean(p.isNewArrival),
      isActive: p.isActive ?? true,
      status: p.status || (p.isActive === false ? 'HIDDEN' : 'PUBLISHED'),
      isSampleData: false,
    });
    setShowProductForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDuplicateProduct = (p: any) => {
    const primaryVar = p.variants?.[0];
    setEditingProductId(undefined);
    setAddingInlineCategory(false);
    setAddingInlineBrand(false);
    setProductForm({
      sku: `${p.sku}-COPY-${Math.floor(10 + Math.random() * 89)}`,
      name: `${p.name} (Copy)`,
      categoryId: p.categoryId || categories[0]?.id || 1,
      newCategoryName: '',
      brandId: p.brandId || brands[0]?.id || 1,
      newBrandName: '',
      shortDescription: p.shortDescription || '',
      description: p.description || p.shortDescription || '',
      badgeText: p.badgeText || '',
      mrpRupees: String(((primaryVar?.mrpPaise ?? p.mrpPaise ?? 10000) / 100).toFixed(0)),
      sellingPriceRupees: String(
        ((primaryVar?.sellingPricePaise ?? p.sellingPricePaise ?? 9000) / 100).toFixed(0)
      ),
      taxRatePercent: p.taxRatePercent ?? 12,
      illustrationType: p.illustrationType || 'spiral_notebook',
      imageUrl: p.imageUrl || '',
      galleryUrls: Array.isArray(p.galleryUrls) ? p.galleryUrls : [],
      initialStockQuantity: primaryVar?.stockQuantity ?? p.totalStock ?? 25,
      variantName: primaryVar?.variantName || 'Standard Pack',
      pickupEligible: p.pickupEligible ?? true,
      deliveryEligible: p.deliveryEligible ?? true,
      isFeatured: Boolean(p.isFeatured),
      isBestseller: Boolean(p.isBestseller),
      isNewArrival: true,
      isActive: true,
      status: 'PUBLISHED',
      isSampleData: false,
    });
    setShowProductForm(true);
    setStatusBanner(`Duplicated "${p.name}". Review the new SKU and click Save Product.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetProductForm = () => {
    setEditingProductId(undefined);
    setAddingInlineCategory(false);
    setAddingInlineBrand(false);
    setProductForm({
      sku: '',
      name: '',
      categoryId: categories[0]?.id || 1,
      newCategoryName: '',
      brandId: brands[0]?.id || 1,
      newBrandName: '',
      shortDescription: '',
      description: '',
      badgeText: '',
      mrpRupees: '120',
      sellingPriceRupees: '105',
      taxRatePercent: 12,
      illustrationType: 'spiral_notebook',
      imageUrl: '',
      galleryUrls: [],
      initialStockQuantity: 40,
      variantName: 'Standard Pack',
      pickupEligible: true,
      deliveryEligible: true,
      isFeatured: false,
      isBestseller: false,
      isNewArrival: true,
      isActive: true,
      status: 'PUBLISHED',
      isSampleData: false,
    });
  };

  const handleBulkProductAction = async (
    action: 'PUBLISH' | 'HIDE' | 'ARCHIVE' | 'MARK_FEATURED' | 'MARK_BESTSELLER'
  ) => {
    if (selectedBulkProductIds.length === 0) {
      setErrorMsg('Select at least one product using the checkboxes first.');
      return;
    }
    try {
      const res = await fetch('/api/admin/products/bulk-action', {
        method: 'POST',
        headers: buildAdminHeaders(true),
        body: JSON.stringify({
          productIds: selectedBulkProductIds,
          action,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk action failed');
      setStatusBanner(`Updated ${data.updatedCount} products (${action}).`);
      setSelectedBulkProductIds([]);
      await fetchAdminData();
      onRefreshStorefront();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Upload image from user's computer/phone to Supabase Storage / PostgreSQL Asset Store
  const handleFileUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setErrorMsg(null);
    try {
      const base64DataUrl = await compressImageFileToDataUrl(file);
      let finalUrl = base64DataUrl;
      let providerLabel = 'Supabase Storage (product-images bucket)';
      try {
        const upRes = await fetch('/api/admin/upload-image', {
          method: 'POST',
          headers: buildAdminHeaders(true),
          body: JSON.stringify({
            base64Data: base64DataUrl,
            mimeType: file.type || 'image/jpeg',
            folder: 'products',
            skuOrSlug: productForm.sku || 'NEW-PRODUCT',
          }),
        });
        if (upRes.ok) {
          const upData = await upRes.json();
          if (upData.imageUrl) finalUrl = upData.imageUrl;
          if (upData.storageProvider !== 'SUPABASE_STORAGE') {
            providerLabel = 'PostgreSQL Asset Store';
          }
        }
      } catch {
        // Keep validated client asset URL
      }

      setProductForm((prev) => ({
        ...prev,
        imageUrl: finalUrl,
        galleryUrls: Array.from(new Set([finalUrl, ...(prev.galleryUrls || [])])),
      }));
      setStatusBanner(
        `Uploaded "${file.name}" to ${providerLabel}. Click "Save Product" below to publish.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not upload product image.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Generate product image via AI on the server
  const handleGenerateAiProductImage = async () => {
    if (!productForm.name.trim()) {
      setErrorMsg('Please enter a Product Name first so AI knows what stationery item to generate.');
      return;
    }
    setAiGeneratingImage(true);
    setErrorMsg(null);
    try {
      const selectedCat = categories.find((c) => c.id === Number(productForm.categoryId));
      const selectedBrand = brands.find((b) => b.id === Number(productForm.brandId));
      const res = await fetch('/api/admin/products/generate-image', {
        method: 'POST',
        headers: buildAdminHeaders(true),
        body: JSON.stringify({
          name: productForm.name,
          sku: productForm.sku || 'GS-NEW',
          categoryName: selectedCat?.name,
          brandName: selectedBrand?.name,
          shortDescription: productForm.shortDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate image');
      setProductForm((prev) => ({
        ...prev,
        imageUrl: data.imageUrl,
        galleryUrls: Array.from(new Set([data.imageUrl, ...(prev.galleryUrls || [])])),
      }));
      setStatusBanner(data.message || 'Generated product image.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate AI product image.');
    } finally {
      setAiGeneratingImage(false);
    }
  };

  const handleQuickSaveInlineBrand = async () => {
    const cleanName = productForm.newBrandName.trim();
    if (!cleanName) {
      setErrorMsg('Please enter a Company / Brand name first.');
      return null;
    }
    setSavingInlineBrand(true);
    setErrorMsg(null);
    try {
      const cleanSlug =
        cleanName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || `brand-${Date.now().toString().slice(-4)}`;
      const res = await fetch('/api/admin/brands/save', {
        method: 'POST',
        headers: buildAdminHeaders(true),
        body: JSON.stringify({
          name: cleanName,
          slug: cleanSlug,
          description: `Authorized ${cleanName} stationery range`,
          isFeatured: true,
          showInNav: true,
          sortOrder: localBrandsList.length + 1,
          status: 'PUBLISHED',
        }),
      });
      const data = await res.json();
      const savedBrand = data?.brand || {
        id: Date.now(),
        name: cleanName,
        slug: cleanSlug,
        description: `Authorized ${cleanName} stationery range`,
        isFeatured: true,
        showInNav: true,
        status: 'PUBLISHED',
        isActive: true,
      };

      setLocalBrandsList((prev) => {
        const exists = prev.some(
          (b) =>
            Number(b.id) === Number(savedBrand.id) ||
            String(b.name || '').toLowerCase() === cleanName.toLowerCase()
        );
        const updated = exists
          ? prev.map((b) =>
              String(b.name || '').toLowerCase() === cleanName.toLowerCase() ? savedBrand : b
            )
          : [...prev, savedBrand];
        try {
          localStorage.setItem('gs_fallback_brands_v1', JSON.stringify(updated));
        } catch {
          // Ignore
        }
        return updated;
      });

      setProductForm((prev) => ({
        ...prev,
        brandId: Number(savedBrand.id),
        newBrandName: '',
      }));
      setAddingInlineBrand(false);
      setStatusBanner(`Company / Brand "${savedBrand.name}" created and selected!`);
      onRefreshStorefront();
      return savedBrand;
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not save new Company / Brand.');
      return null;
    } finally {
      setSavingInlineBrand(false);
    }
  };

  const handleQuickSaveInlineCategory = async () => {
    const cleanName = productForm.newCategoryName.trim();
    if (!cleanName) {
      setErrorMsg('Please enter a Category name first.');
      return null;
    }
    setSavingInlineCategory(true);
    setErrorMsg(null);
    try {
      const cleanSlug =
        cleanName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || `cat-${Date.now().toString().slice(-4)}`;
      const res = await fetch('/api/admin/categories/save', {
        method: 'POST',
        headers: buildAdminHeaders(true),
        body: JSON.stringify({
          name: cleanName,
          slug: cleanSlug,
          description: `${cleanName} stationery supplies`,
          showInNav: true,
          showOnHomepage: true,
          showInFooter: true,
          sortOrder: localCategoriesList.length + 1,
          status: 'PUBLISHED',
        }),
      });
      const data = await res.json();
      const savedCategory = data?.category || {
        id: Date.now(),
        name: cleanName,
        slug: cleanSlug,
        description: `${cleanName} stationery supplies`,
        showInNav: true,
        showOnHomepage: true,
        showInFooter: true,
        status: 'PUBLISHED',
        isActive: true,
      };

      setLocalCategoriesList((prev) => {
        const exists = prev.some(
          (c) =>
            Number(c.id) === Number(savedCategory.id) ||
            String(c.name || '').toLowerCase() === cleanName.toLowerCase()
        );
        const updated = exists
          ? prev.map((c) =>
              String(c.name || '').toLowerCase() === cleanName.toLowerCase() ? savedCategory : c
            )
          : [...prev, savedCategory];
        try {
          localStorage.setItem('gs_fallback_categories_v1', JSON.stringify(updated));
        } catch {
          // Ignore
        }
        return updated;
      });

      setProductForm((prev) => ({
        ...prev,
        categoryId: Number(savedCategory.id),
        newCategoryName: '',
      }));
      setAddingInlineCategory(false);
      setStatusBanner(`Category "${savedCategory.name}" created and selected!`);
      onRefreshStorefront();
      return savedCategory;
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not save new Category.');
      return null;
    } finally {
      setSavingInlineCategory(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      let resolvedBrandId = productForm.brandId;
      let resolvedCategoryId = productForm.categoryId;

      if (addingInlineBrand && productForm.newBrandName.trim()) {
        const createdBrand = await handleQuickSaveInlineBrand();
        if (createdBrand?.id) {
          resolvedBrandId = Number(createdBrand.id);
        }
      }
      if (addingInlineCategory && productForm.newCategoryName.trim()) {
        const createdCat = await handleQuickSaveInlineCategory();
        if (createdCat?.id) {
          resolvedCategoryId = Number(createdCat.id);
        }
      }

      const mrpPaise = Math.round(Number(productForm.mrpRupees) * 100);
      const sellingPricePaise = Math.round(Number(productForm.sellingPriceRupees) * 100);
      const res = await fetch('/api/admin/products/save', {
        method: 'POST',
        headers: buildAdminHeaders(true),
        body: JSON.stringify({
          id: editingProductId,
          ...productForm,
          brandId: resolvedBrandId,
          categoryId: resolvedCategoryId,
          mrpPaise,
          sellingPricePaise,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save product');
      setStatusBanner(`Saved product "${data.product.name}" (${data.product.sku}).`);
      handleResetProductForm();
      setShowProductForm(false);
      await fetchAdminData();
      onRefreshStorefront();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleImportCsv = async () => {
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/products/import-csv', {
        method: 'POST',
        headers: buildAdminHeaders(true),
        body: JSON.stringify({ csvText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'CSV import failed');
      setCsvResult(data);
      setStatusBanner(`Imported ${data.importedCount} product variant rows from CSV.`);
      await fetchAdminData();
      onRefreshStorefront();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await fetch('/api/admin/products/export-csv', {
        headers: buildAdminHeaders(false),
      });
      if (!res.ok) throw new Error('Failed to export CSV');
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gayatri-stationers-catalogue.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const discountValue =
        couponForm.discountType === 'PERCENTAGE'
          ? Number(couponForm.discountValueInput)
          : Math.round(Number(couponForm.discountValueInput) * 100);
      const res = await fetch('/api/admin/coupons/save', {
        method: 'POST',
        headers: buildAdminHeaders(true),
        body: JSON.stringify({
          code: couponForm.code,
          description: couponForm.description,
          discountType: couponForm.discountType,
          discountValue,
          minOrderPaise: Math.round(Number(couponForm.minOrderRupees) * 100),
          maxDiscountPaise: Math.round(Number(couponForm.maxDiscountRupees) * 100),
          usageLimit: Number(couponForm.usageLimit),
          isActive: couponForm.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save coupon');
      setStatusBanner(`Saved coupon ${data.coupon.code}.`);
      setCouponForm({ ...couponForm, code: '', description: '' });
      await fetchAdminData();
      onRefreshStorefront();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleSavePincode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/pincodes/save', {
        method: 'POST',
        headers: buildAdminHeaders(true),
        body: JSON.stringify({
          pincode: pincodeForm.pincode,
          city: pincodeForm.city,
          state: pincodeForm.state,
          deliveryFeePaise: Math.round(Number(pincodeForm.deliveryFeeRupees) * 100),
          freeDeliveryThresholdPaise: Math.round(Number(pincodeForm.freeThresholdRupees) * 100),
          codAvailable: pincodeForm.codAvailable,
          estimatedDays: pincodeForm.estimatedDays,
          isActive: pincodeForm.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save PIN code rule');
      setStatusBanner(`Saved delivery rule for PIN code ${data.pincodeRule.pincode}.`);
      setPincodeForm({ ...pincodeForm, pincode: '', city: '' });
      await fetchAdminData();
      onRefreshStorefront();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/settings/save', {
        method: 'POST',
        headers: buildAdminHeaders(true),
        body: JSON.stringify({
          key: 'store_profile',
          valueJson: profileSetting,
        }),
      });
      if (!res.ok) throw new Error('Failed to save store settings');
      setStatusBanner('Store pickup and profile settings updated.');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleTestCashfreeConfig = async () => {
    setCashfreeTesting(true);
    setCashfreeTestResult(null);
    try {
      const res = await fetch('/api/admin/cashfree/test-config', {
        method: 'POST',
        headers: buildAdminHeaders(true),
        body: JSON.stringify({
          appId: cashfreeAppId,
          secretKey: cashfreeSecretKey,
          environment: cashfreeEnv,
        }),
      });
      const data = await res.json();
      setCashfreeTestResult(data);
    } catch (err: any) {
      setCashfreeTestResult({ success: false, message: err.message || 'Network error' });
    } finally {
      setCashfreeTesting(false);
    }
  };

  const handleSaveCashfreeConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setCashfreeSaving(true);
    setCashfreeSaveStatus(null);
    try {
      const res = await fetch('/api/admin/cashfree/save-config', {
        method: 'POST',
        headers: buildAdminHeaders(true),
        body: JSON.stringify({
          appId: cashfreeAppId,
          secretKey: cashfreeSecretKey,
          environment: cashfreeEnv,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save Cashfree credentials.');
      setCashfreeSaveStatus('Saved Cashfree Payment Gateway settings successfully!');
      await fetchAdminData();
      onRefreshStorefront();
    } catch (err: any) {
      setCashfreeSaveStatus(`Error: ${err.message}`);
    } finally {
      setCashfreeSaving(false);
    }
  };

  const handleUpdateBulkEnquiry = async (
    id: number,
    status: string,
    quotedAmountRupees: string,
    adminNotes: string
  ) => {
    try {
      const res = await fetch(`/api/admin/bulk-enquiries/${id}/update`, {
        method: 'POST',
        headers: buildAdminHeaders(true),
        body: JSON.stringify({
          status,
          quotedAmountPaise: quotedAmountRupees ? Math.round(Number(quotedAmountRupees) * 100) : null,
          adminNotes,
        }),
      });
      if (!res.ok) throw new Error('Failed to update bulk enquiry');
      setStatusBanner('Bulk order enquiry updated.');
      await fetchAdminData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const filteredOrders = (dashboardData?.orders || []).filter((entry: any) => {
    const o = entry.order;
    if (fulfilmentFilter !== 'ALL' && o.fulfilmentMethod !== fulfilmentFilter) return false;
    if (paymentFilter !== 'ALL' && o.paymentStatus !== paymentFilter) return false;
    if (orderSearch.trim()) {
      const q = orderSearch.trim().toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        (entry.pickupDetails?.pickupCode || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Compute combined real notifications & actionable alerts from PostgreSQL
  const dbNotifications: Array<any> = dashboardData?.notifications || [];
  const unreadDbNotificationsCount = dbNotifications.filter((n) => !n.isRead).length;
  const actionableAlertsCount =
    unreadDbNotificationsCount +
    (dashboardData?.lowStockVariants?.length || 0) +
    (dashboardData?.metrics?.newBulkEnquiriesCount || 0);

  const filteredNotifications = dbNotifications.filter((n: any) => {
    if (notifFilter === 'UNREAD') return !n.isRead;
    if (notifFilter === 'ORDER') return n.type === 'ORDER';
    if (notifFilter === 'LOW_STOCK') return n.type === 'LOW_STOCK';
    if (notifFilter === 'BULK_ENQUIRY') return n.type === 'BULK_ENQUIRY';
    return true;
  });

  // Global Admin Quick Search results across real orders, products, categories, brands
  const quickSearchResults = (() => {
    const q = adminQuickSearch.trim().toLowerCase();
    if (!q) return { orders: [], products: [], categories: [], brands: [] };
    const matchingOrders = (dashboardData?.orders || [])
      .filter(
        (entry: any) =>
          entry.order.orderNumber.toLowerCase().includes(q) ||
          entry.order.customerName.toLowerCase().includes(q) ||
          entry.order.customerPhone.toLowerCase().includes(q) ||
          (entry.pickupDetails?.pickupCode || '').toLowerCase().includes(q)
      )
      .slice(0, 4);
    const matchingProducts = (products || [])
      .filter(
        (p: any) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.brandName || '').toLowerCase().includes(q)
      )
      .slice(0, 4);
    const matchingCategories = (categories || [])
      .filter((c: any) => c.name.toLowerCase().includes(q))
      .slice(0, 3);
    const matchingBrands = (brands || [])
      .filter((b: any) => b.name.toLowerCase().includes(q))
      .slice(0, 3);
    return {
      orders: matchingOrders,
      products: matchingProducts,
      categories: matchingCategories,
      brands: matchingBrands,
    };
  })();

  const handleVerifyPickupCodeQuick = (e: React.FormEvent) => {
    e.preventDefault();
    const code = pickupCodeInput.trim().toUpperCase();
    if (!code) return;
    const found = (dashboardData?.orders || []).find(
      (entry: any) =>
        (entry.pickupDetails?.pickupCode || '').toUpperCase() === code ||
        entry.order.orderNumber.toUpperCase() === code
    );
    if (found) {
      setSelectedOrder(found);
      setActiveTab('orders');
      setStatusBanner(
        `Matched Pickup Order ${found.order.orderNumber} (${found.order.customerName}). Ready for counter verification.`
      );
      setPickupCodeInput('');
    } else {
      setErrorMsg(`No order found matching Pickup Code or Order # "${code}".`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      {/* Responsive Admin Top Header with Global Search, Role Switcher & Live Notification Bell */}
      <header className="bg-slate-900 text-white border-b border-slate-800 px-4 sm:px-6 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sticky top-0 z-40">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-serif-display text-base sm:text-lg font-bold tracking-tight">
            Gayatri Stationers · Admin Console
          </span>
          {currentUser && (
            <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-200 font-mono-tabular">
              {currentUser.email} · {currentUser.role.toUpperCase()}
            </span>
          )}
        </div>

        {/* Global Admin Quick-Search Input */}
        <div className="relative flex-1 max-w-md">
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded focus-within:border-amber-400">
            <Search className="w-3.5 h-3.5 text-slate-400 ml-3 shrink-0" />
            <input
              type="search"
              value={adminQuickSearch}
              onFocus={() => setQuickSearchOpen(true)}
              onBlur={() => setTimeout(() => setQuickSearchOpen(false), 200)}
              onChange={(e) => {
                setAdminQuickSearch(e.target.value);
                setQuickSearchOpen(true);
              }}
              placeholder="Quick jump: Order #, Pickup Code, Product, SKU, Brand..."
              className="w-full px-2.5 py-1.5 text-xs bg-transparent text-white placeholder-slate-400 focus:outline-none"
            />
            {adminQuickSearch && (
              <button
                type="button"
                onClick={() => setAdminQuickSearch('')}
                className="px-2 text-[11px] text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {quickSearchOpen && adminQuickSearch.trim().length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white text-slate-900 border border-slate-300 rounded shadow-xl z-50 max-h-80 overflow-y-auto divide-y divide-slate-100 text-xs">
              {quickSearchResults.orders.length === 0 &&
              quickSearchResults.products.length === 0 &&
              quickSearchResults.categories.length === 0 &&
              quickSearchResults.brands.length === 0 ? (
                <div className="p-3 text-slate-500">
                  No matching orders, products, categories, or brands found.
                </div>
              ) : (
                <>
                  {quickSearchResults.orders.map((entry: any) => (
                    <button
                      key={`qs-ord-${entry.order.id}`}
                      type="button"
                      onMouseDown={() => {
                        setSelectedOrder(entry);
                        setActiveTab('orders');
                        setAdminQuickSearch('');
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono-tabular font-bold text-slate-900">
                          Order {entry.order.orderNumber}
                        </span>
                        <span className="text-slate-500 ml-2">
                          {entry.order.customerName} · {entry.order.orderStatus.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="font-mono-tabular font-semibold text-amber-800">
                        {entry.pickupDetails?.pickupCode
                          ? `Code: ${entry.pickupDetails.pickupCode}`
                          : formatPaiseToINR(entry.order.totalPaise)}
                      </span>
                    </button>
                  ))}
                  {quickSearchResults.products.map((p: any) => (
                    <button
                      key={`qs-prod-${p.id}`}
                      type="button"
                      onMouseDown={() => {
                        setActiveTab('products');
                        handleStartEditProduct(p);
                        setAdminQuickSearch('');
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">{p.name}</span>
                        <span className="text-slate-500 ml-2 font-mono-tabular">SKU: {p.sku}</span>
                      </div>
                      <span className="font-mono-tabular text-slate-700">
                        {p.totalStock ?? p.variants?.[0]?.stockQuantity ?? 0} in stock
                      </span>
                    </button>
                  ))}
                  {quickSearchResults.categories.map((c: any) => (
                    <button
                      key={`qs-cat-${c.id}`}
                      type="button"
                      onMouseDown={() => {
                        setActiveTab('cms');
                        setCmsSubTab('categories');
                        setAdminQuickSearch('');
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span className="font-medium text-slate-900">Category: {c.name}</span>
                      <span className="text-[11px] text-slate-500">Edit in CMS →</span>
                    </button>
                  ))}
                  {quickSearchResults.brands.map((b: any) => (
                    <button
                      key={`qs-brd-${b.id}`}
                      type="button"
                      onMouseDown={() => {
                        setActiveTab('cms');
                        setCmsSubTab('brands');
                        setAdminQuickSearch('');
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span className="font-medium text-slate-900">Brand: {b.name}</span>
                      <span className="text-[11px] text-slate-500">Edit in CMS →</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-2.5">
          {/* Seamless In-Place Role Switcher (keeps exact same interface open) */}
          {onRoleSwitched && (
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded p-0.5 text-xs">
              <span className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Role:
              </span>
              {(['customer', 'staff', 'owner'] as const).map((r) => {
                const active = (currentUser?.role || 'owner') === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onRoleSwitched(r)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold capitalize transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#B42318] text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          )}

          {/* Sound Chime Toggle */}
          <button
            type="button"
            onClick={() => setSoundAlertsEnabled((prev) => !prev)}
            title={soundAlertsEnabled ? 'Sound alerts enabled' : 'Sound alerts muted'}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 cursor-pointer"
          >
            {soundAlertsEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {/* Live Admin Notifications Center Button */}
          <button
            type="button"
            onClick={() => setNotificationsOpen((prev) => !prev)}
            className="relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-700 transition-colors cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>Notifications</span>
            {actionableAlertsCount > 0 && (
              <span className="px-1.5 py-0.2 bg-[#B42318] text-white text-[10px] font-mono-tabular font-bold rounded">
                {actionableAlertsCount}
              </span>
            )}
          </button>

          <button
            onClick={onExitAdmin}
            className="px-3.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Storefront View
          </button>
        </div>
      </header>

      {/* Notice if user switched to Customer role while staying on the same Admin interface */}
      {currentUser?.role === 'customer' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2.5 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong>Customer Role Active on Same Interface:</strong> You switched to Customer role while keeping this workspace open. Switch back to <strong>Staff</strong> or <strong>Owner</strong> above to save administrative changes.
          </span>
          {onRoleSwitched && (
            <button
              type="button"
              onClick={() => onRoleSwitched('owner')}
              className="px-3 py-1 bg-slate-900 text-white font-semibold rounded cursor-pointer"
            >
              Switch to Owner Role
            </button>
          )}
        </div>
      )}

      {/* LIVE DATABASE NOTIFICATIONS SLIDE-OVER DRAWER (ZERO MOCK DATA) */}
      {notificationsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="w-full max-w-md bg-white h-full flex flex-col justify-between shadow-2xl border-l border-slate-200">
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                  LIVE POSTGRESQL EVENT FEED
                </span>
                <h2 className="text-base font-bold">
                  Admin Notifications & Store Alerts ({actionableAlertsCount})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setNotificationsOpen(false)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Notification Controls & Filter Bar */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      { id: 'ALL', label: `All (${dbNotifications.length})` },
                      { id: 'UNREAD', label: `Unread (${unreadDbNotificationsCount})` },
                      { id: 'ORDER', label: 'Orders' },
                      { id: 'LOW_STOCK', label: 'Low Stock' },
                      { id: 'BULK_ENQUIRY', label: 'Bulk' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setNotifFilter(tab.id)}
                      className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                        notifFilter === tab.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {unreadDbNotificationsCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllNotificationsRead}
                    className="text-[11px] font-semibold text-red-700 hover:underline cursor-pointer"
                  >
                    Mark All Read
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200 text-[11px]">
                <span className="text-slate-600">
                  Desktop Browser Push:{' '}
                  <strong className="uppercase">{browserNotifPermission}</strong>
                </span>
                {browserNotifPermission !== 'granted' && (
                  <button
                    type="button"
                    onClick={handleEnableBrowserNotifications}
                    className="px-2.5 py-1 bg-slate-900 text-white font-semibold rounded cursor-pointer"
                  >
                    Enable Browser Alerts
                  </button>
                )}
              </div>
            </div>

            {/* Real Database Notifications List + Live Low-Stock & Bulk Action Items */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-200 p-4 space-y-3">
              {/* Live Low Stock Actionable Alerts from PostgreSQL product_variants */}
              {(notifFilter === 'ALL' || notifFilter === 'LOW_STOCK') &&
                (dashboardData?.lowStockVariants || []).map((v: any) => (
                  <div
                    key={`live-stock-${v.id}`}
                    className="p-3 bg-amber-50/80 border border-amber-200 rounded space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold text-amber-950">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>Low Stock: {v.productName}</span>
                      </div>
                      <span className="font-mono-tabular font-bold text-red-700 shrink-0">
                        {v.stockQuantity} left
                      </span>
                    </div>
                    <p className="text-slate-600 font-mono-tabular text-[11px]">
                      SKU: {v.sku} · Variant: {v.variantName} (Threshold: {v.lowStockThreshold})
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleQuickRestock(v.id, v.stockQuantity, 10)}
                        className="px-2.5 py-1 bg-slate-900 text-white text-[11px] font-semibold rounded hover:bg-slate-800 cursor-pointer"
                      >
                        +10 Stock Now
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickRestock(v.id, v.stockQuantity, 25)}
                        className="px-2.5 py-1 bg-white border border-slate-300 text-slate-800 text-[11px] font-semibold rounded hover:bg-slate-100 cursor-pointer"
                      >
                        +25 Stock
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('products');
                          setNotificationsOpen(false);
                        }}
                        className="text-[11px] text-slate-700 underline ml-auto cursor-pointer"
                      >
                        Inventory →
                      </button>
                    </div>
                  </div>
                ))}

              {/* Real Notification Records from PostgreSQL notifications table */}
              {filteredNotifications.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No notifications matching this filter in PostgreSQL.
                </div>
              ) : (
                filteredNotifications.map((n: any) => (
                  <div
                    key={n.id}
                    className={`p-3 rounded border text-xs space-y-1.5 transition-colors ${
                      n.isRead
                        ? 'bg-white border-slate-200 text-slate-600'
                        : 'bg-red-50/40 border-red-200 text-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-slate-900">{n.subject}</p>
                      {!n.isRead && (
                        <span className="px-1.5 py-0.5 bg-[#B42318] text-white text-[9px] font-mono uppercase rounded shrink-0">
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 leading-relaxed">{n.message}</p>
                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                      <span className="font-mono-tabular">
                        {new Date(n.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <div className="flex items-center gap-2">
                        {n.orderId && (
                          <button
                            type="button"
                            onClick={() => {
                              const foundOrder = (dashboardData?.orders || []).find(
                                (o: any) => o.order.id === n.orderId
                              );
                              if (foundOrder) setSelectedOrder(foundOrder);
                              setActiveTab('orders');
                              setNotificationsOpen(false);
                              if (!n.isRead) handleMarkNotificationRead(n.id);
                            }}
                            className="font-semibold text-slate-900 underline cursor-pointer"
                          >
                            Open Order →
                          </button>
                        )}
                        {n.type === 'BULK_ENQUIRY' && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('bulk');
                              setNotificationsOpen(false);
                              if (!n.isRead) handleMarkNotificationRead(n.id);
                            }}
                            className="font-semibold text-slate-900 underline cursor-pointer"
                          >
                            View Enquiry →
                          </button>
                        )}
                        {!n.isRead && (
                          <button
                            type="button"
                            onClick={() => handleMarkNotificationRead(n.id)}
                            className="text-emerald-700 font-semibold hover:underline cursor-pointer"
                          >
                            Mark Read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500">Synced with PostgreSQL notifications table</span>
              <button
                type="button"
                onClick={fetchAdminData}
                className="font-semibold text-slate-900 underline cursor-pointer"
              >
                Refresh Feed
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Responsive Sidebar / Mobile Tab Navigation (8 Core Sections + Operational Utilities) */}
        <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-3 sm:p-4 shrink-0">
          <nav className="flex lg:flex-col gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {[
              {
                key: 'home',
                label: 'Home',
                icon: ClipboardList,
                badge: 0,
                isActive: activeTab === 'overview',
                onClick: () => setActiveTab('overview'),
              },
              {
                key: 'orders',
                label: 'Orders',
                icon: Store,
                badge: dashboardData?.metrics?.pendingOrdersCount || 0,
                isActive: activeTab === 'orders',
                onClick: () => setActiveTab('orders'),
              },
              {
                key: 'products',
                label: 'Products',
                icon: Package,
                badge: dashboardData?.lowStockVariants?.length || 0,
                isActive: activeTab === 'products',
                onClick: () => setActiveTab('products'),
              },
              {
                key: 'categories',
                label: 'Categories',
                icon: FolderTree,
                badge: 0,
                isActive: activeTab === 'cms' && cmsSubTab === 'categories',
                onClick: () => {
                  setActiveTab('cms');
                  setCmsSubTab('categories');
                },
              },
              {
                key: 'brands',
                label: 'Brands',
                icon: Tag,
                badge: 0,
                isActive: activeTab === 'cms' && cmsSubTab === 'brands',
                onClick: () => {
                  setActiveTab('cms');
                  setCmsSubTab('brands');
                },
              },
              {
                key: 'storefront',
                label: 'Storefront',
                icon: LayoutTemplate,
                badge: 0,
                isActive:
                  activeTab === 'cms' &&
                  ['navigation', 'homepage', 'banners', 'bundles', 'appearance'].includes(
                    cmsSubTab
                  ),
                onClick: () => {
                  setActiveTab('cms');
                  setCmsSubTab('homepage');
                },
              },
              {
                key: 'pages',
                label: 'Pages',
                icon: Compass,
                badge: 0,
                isActive: activeTab === 'cms' && cmsSubTab === 'pages',
                onClick: () => {
                  setActiveTab('cms');
                  setCmsSubTab('pages');
                },
              },
              {
                key: 'settings',
                label: 'Settings',
                icon: Settings,
                badge: 0,
                isActive: activeTab === 'settings',
                onClick: () => setActiveTab('settings'),
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={item.onClick}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    item.isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {item.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-mono-tabular font-bold ${
                        item.isActive
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Storefront Sub-Sections & Operational Tools */}
          <div className="hidden lg:block mt-5 pt-4 border-t border-slate-200 space-y-1.5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2 font-bold">
              STOREFRONT & OPERATIONS
            </div>
            {[
              {
                label: 'Navigation Builder',
                active: activeTab === 'cms' && cmsSubTab === 'navigation',
                onClick: () => {
                  setActiveTab('cms');
                  setCmsSubTab('navigation');
                },
              },
              {
                label: 'Homepage & Content',
                active: activeTab === 'cms' && cmsSubTab === 'homepage',
                onClick: () => {
                  setActiveTab('cms');
                  setCmsSubTab('homepage');
                },
              },
              {
                label: 'Hero & Promo Banners',
                active: activeTab === 'cms' && cmsSubTab === 'banners',
                onClick: () => {
                  setActiveTab('cms');
                  setCmsSubTab('banners');
                },
              },
              {
                label: 'Theme & Branding Editor',
                active: activeTab === 'cms' && cmsSubTab === 'appearance',
                onClick: () => {
                  setActiveTab('cms');
                  setCmsSubTab('appearance');
                },
              },
              {
                label: 'Delivery PIN Codes',
                active: activeTab === 'pincodes',
                onClick: () => setActiveTab('pincodes'),
              },
              {
                label: 'Coupons & Discounts',
                active: activeTab === 'promotions',
                onClick: () => setActiveTab('promotions'),
              },
              {
                label: 'Bulk Order Enquiries',
                active: activeTab === 'bulk',
                onClick: () => setActiveTab('bulk'),
              },
              {
                label: 'CSV Catalogue Import/Export',
                active: activeTab === 'csv',
                onClick: () => setActiveTab('csv'),
              },
            ].map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={q.onClick}
                className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                  q.active
                    ? 'bg-red-50 text-red-900 font-bold border border-red-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                • {q.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full overflow-x-hidden">
          {statusBanner && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs sm:text-sm text-emerald-900 flex items-center justify-between gap-2">
              <span>{statusBanner}</span>
              <button
                onClick={() => setStatusBanner(null)}
                className="text-xs underline whitespace-nowrap shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-xs sm:text-sm text-red-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Server Authorization / Validation Alert</p>
                <p className="mt-0.5">{errorMsg}</p>
              </div>
              <button
                onClick={() => setErrorMsg(null)}
                className="px-3 py-1.5 bg-red-800 text-white text-xs font-medium rounded hover:bg-red-700 whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {loading ? (
            <div className="p-8 bg-white border border-slate-200 rounded text-sm text-slate-600">
              Loading real-time operational data from PostgreSQL...
            </div>
          ) : !dashboardData ? (
            <div className="p-8 bg-white border border-slate-200 rounded text-sm text-slate-600">
              Admin data unavailable. Ensure your account has Staff or Owner role permissions.
            </div>
          ) : (
            <>
              {/* 1. OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                        Store Operations & Live Notification Desk
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                        100% live figures computed from PostgreSQL orders, inventory movements, and notifications.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleResetProductForm();
                          setShowProductForm(true);
                          setActiveTab('products');
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#B42318] text-white rounded hover:bg-[#991B1B] cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Quick Add Product</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotificationsOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-800 cursor-pointer"
                      >
                        <Bell className="w-3.5 h-3.5 text-amber-400" />
                        <span>Alerts ({actionableAlertsCount})</span>
                      </button>
                      <button
                        onClick={fetchAdminData}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Refresh</span>
                      </button>
                    </div>
                  </div>

                  {/* Operational KPI Strip (Clickable for fast navigation) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setFulfilmentFilter('ALL');
                        setPaymentFilter('ALL');
                        setActiveTab('orders');
                      }}
                      className="p-4 bg-white border border-slate-200 rounded text-left hover:border-slate-400 transition-colors cursor-pointer"
                    >
                      <p className="text-xs text-slate-500">Today&apos;s Orders</p>
                      <p className="text-2xl font-bold font-mono-tabular mt-1">
                        {dashboardData.metrics.todaysOrdersCount}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Total All-Time: {dashboardData.metrics.totalOrdersCount} · Click to view →
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFulfilmentFilter('STORE_PICKUP');
                        setActiveTab('orders');
                      }}
                      className="p-4 bg-white border border-slate-200 rounded text-left hover:border-amber-500 transition-colors cursor-pointer"
                    >
                      <p className="text-xs text-slate-500">Ready for Store Pickup</p>
                      <p className="text-2xl font-bold font-mono-tabular text-amber-700 mt-1">
                        {dashboardData.metrics.readyForPickupCount}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Pending Fulfilment: {dashboardData.metrics.pendingOrdersCount} →
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentFilter('PENDING');
                        setActiveTab('orders');
                      }}
                      className="p-4 bg-white border border-slate-200 rounded text-left hover:border-red-400 transition-colors cursor-pointer"
                    >
                      <p className="text-xs text-slate-500">Pending Counter / COD Payments</p>
                      <p className="text-2xl font-bold font-mono-tabular text-red-700 mt-1">
                        {dashboardData.metrics.pendingOfflinePaymentsCount}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Click to collect payment at counter →
                      </p>
                    </button>
                    <div className="p-4 bg-white border border-slate-200 rounded">
                      <p className="text-xs text-slate-500">Verified Paid Revenue</p>
                      <p className="text-2xl font-bold font-mono-tabular text-emerald-700 mt-1">
                        {formatPaiseToINR(dashboardData.metrics.paidRevenuePaise)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Active Order Volume:{' '}
                        {formatPaiseToINR(dashboardData.metrics.activeOrdersValuePaise)}
                      </p>
                    </div>
                  </div>

                  {/* Easy Counter Pickup Code Verification & Quick CMS Launch Strip */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <form
                      onSubmit={handleVerifyPickupCodeQuick}
                      className="lg:col-span-5 bg-white border border-slate-300 rounded p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-amber-800 font-bold">
                          FAST STORE PICKUP COUNTER DESK
                        </span>
                        <h2 className="text-sm font-bold text-slate-900 mt-0.5">
                          Verify Customer 6-Digit Pickup Code or Order #
                        </h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={pickupCodeInput}
                          onChange={(e) => setPickupCodeInput(e.target.value)}
                          placeholder="Enter Pickup Code (e.g. GS-...) or Order #..."
                          className="flex-1 px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded uppercase"
                        />
                        <button
                          type="submit"
                          className="px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                        >
                          Verify &amp; Open
                        </button>
                      </div>
                    </form>

                    <div className="lg:col-span-7 bg-white border-2 border-slate-900 rounded p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-red-700 font-bold">
                          DYNAMIC STOREFRONT CMS
                        </span>
                        <h2 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                          Add Categories, Stationery Companies, Navigation &amp; Banners
                        </h2>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Manage &quot;DIY &amp; Crafts&quot;, brands, and homepage layout with instant PostgreSQL persistence.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('cms');
                            setCmsSubTab('categories');
                          }}
                          className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded hover:bg-slate-800 cursor-pointer"
                        >
                          + Categories ({categories.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('cms');
                            setCmsSubTab('brands');
                          }}
                          className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded hover:bg-slate-800 cursor-pointer"
                        >
                          + Brands ({brands.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('cms');
                            setCmsSubTab('navigation');
                          }}
                          className="px-3 py-2 bg-white border border-slate-900 text-slate-900 text-xs font-bold rounded hover:bg-slate-100 cursor-pointer"
                        >
                          Menus &amp; Pages
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* LIVE ADMIN NOTIFICATIONS FEED ON OVERVIEW */}
                  <div className="bg-white border border-slate-200 rounded p-4 sm:p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-[#B42318]" />
                        <h2 className="text-sm sm:text-base font-bold text-slate-900">
                          Live Admin Notifications ({unreadDbNotificationsCount} Unread)
                        </h2>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {unreadDbNotificationsCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllNotificationsRead}
                            className="font-semibold text-emerald-700 hover:underline cursor-pointer"
                          >
                            Mark All as Read
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setNotificationsOpen(true)}
                          className="font-semibold text-slate-900 underline cursor-pointer"
                        >
                          Open Notification Drawer →
                        </button>
                      </div>
                    </div>

                    {dbNotifications.length === 0 ? (
                      <p className="text-xs text-slate-500 py-2">
                        No notifications logged yet. New customer orders, status updates, low-stock events, and bulk enquiries appear here automatically from PostgreSQL.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {dbNotifications.slice(0, 6).map((n: any) => (
                          <div
                            key={n.id}
                            className={`p-3 rounded border text-xs flex flex-col justify-between gap-2 ${
                              n.isRead
                                ? 'bg-slate-50/70 border-slate-200 text-slate-600'
                                : 'bg-amber-50/50 border-amber-300 text-slate-900'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-bold text-slate-900 line-clamp-1">
                                  {n.subject}
                                </span>
                                {!n.isRead && (
                                  <span className="px-1.5 py-0.2 bg-[#B42318] text-white text-[9px] font-mono uppercase rounded shrink-0">
                                    UNREAD
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-600 line-clamp-2">{n.message}</p>
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 text-[11px]">
                              <span className="font-mono-tabular text-slate-400">
                                {new Date(n.createdAt).toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              <div className="flex items-center gap-2">
                                {n.orderId && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const ord = (dashboardData.orders || []).find(
                                        (o: any) => o.order.id === n.orderId
                                      );
                                      if (ord) setSelectedOrder(ord);
                                      setActiveTab('orders');
                                      if (!n.isRead) handleMarkNotificationRead(n.id);
                                    }}
                                    className="font-semibold text-slate-900 underline cursor-pointer"
                                  >
                                    Inspect Order
                                  </button>
                                )}
                                {!n.isRead && (
                                  <button
                                    type="button"
                                    onClick={() => handleMarkNotificationRead(n.id)}
                                    className="text-emerald-700 font-semibold hover:underline cursor-pointer"
                                  >
                                    Done
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Direct Firebase Storage Product Image Uploader on Admin Home */}
                  <FirebaseImageUpload
                    products={products}
                    selectedProductId={selectedMediaProductId}
                    onSelectProductId={(pid) => setSelectedMediaProductId(pid)}
                    idToken={idToken}
                    onProductImagesUpdated={async (updatedProduct, msg) => {
                      setStatusBanner(msg);
                      if (
                        editingProductId &&
                        updatedProduct &&
                        editingProductId === updatedProduct.id
                      ) {
                        setProductForm((prev) => ({
                          ...prev,
                          imageUrl: updatedProduct.imageUrl || '',
                          galleryUrls: Array.isArray(updatedProduct.galleryUrls)
                            ? updatedProduct.galleryUrls
                            : [],
                        }));
                      }
                      await fetchAdminData();
                      onRefreshStorefront();
                    }}
                  />

                  {/* Low Stock (with 1-Click Fast Restock) & Recent Orders (with 1-Click Actions) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white border border-slate-200 rounded p-4 sm:p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                          Low-Stock Alert &amp; 1-Click Restock ({dashboardData.lowStockVariants.length})
                        </h2>
                        <button
                          onClick={() => setActiveTab('products')}
                          className="text-xs font-medium text-slate-700 underline cursor-pointer"
                        >
                          Full Inventory
                        </button>
                      </div>
                      {dashboardData.lowStockVariants.length === 0 ? (
                        <p className="text-xs sm:text-sm text-slate-500">
                          All product variants are currently stocked above their minimum threshold.
                        </p>
                      ) : (
                        <div className="divide-y divide-slate-200">
                          {dashboardData.lowStockVariants.map((v: any) => (
                            <div
                              key={v.id}
                              className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm"
                            >
                              <div>
                                <p className="font-medium text-slate-900">{v.productName}</p>
                                <p className="text-xs text-slate-500 font-mono-tabular">
                                  {v.sku} · {v.variantName}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono-tabular font-semibold text-red-700">
                                  {v.stockQuantity} left
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleQuickRestock(v.id, v.stockQuantity, 10)}
                                  className="px-2 py-1 bg-slate-900 text-white text-[11px] font-semibold rounded hover:bg-slate-800 cursor-pointer"
                                >
                                  +10
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickRestock(v.id, v.stockQuantity, 25)}
                                  className="px-2 py-1 bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-semibold rounded hover:bg-slate-200 cursor-pointer"
                                >
                                  +25
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-white border border-slate-200 rounded p-4 sm:p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                          Recent Store Orders &amp; 1-Click Actions
                        </h2>
                        <button
                          onClick={() => setActiveTab('orders')}
                          className="text-xs font-medium text-slate-700 underline cursor-pointer"
                        >
                          Open Order Desk
                        </button>
                      </div>
                      {dashboardData.orders.length === 0 ? (
                        <p className="text-xs sm:text-sm text-slate-500">
                          No orders placed yet. Place a Store Pickup or Home Delivery order from the storefront to inspect the workflow.
                        </p>
                      ) : (
                        <div className="divide-y divide-slate-200">
                          {dashboardData.orders.slice(0, 6).map((entry: any) => {
                            const o = entry.order;
                            return (
                              <div
                                key={o.id}
                                className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm"
                              >
                                <div>
                                  <button
                                    onClick={() => {
                                      setSelectedOrder(entry);
                                      setActiveTab('orders');
                                    }}
                                    className="font-mono-tabular font-semibold text-slate-900 hover:underline cursor-pointer"
                                  >
                                    {o.orderNumber}
                                  </button>
                                  <p className="text-xs text-slate-500">
                                    {o.customerName} · {o.fulfilmentMethod.replace('_', ' ')} ·{' '}
                                    <strong>{o.orderStatus.replace(/_/g, ' ')}</strong>
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {o.orderStatus === 'ORDER_PLACED' && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleQuickOrderWorkflowUpdate(
                                          o.id,
                                          'CONFIRMED',
                                          undefined,
                                          'Confirmed via 1-click Overview action'
                                        )
                                      }
                                      className="px-2 py-1 bg-slate-900 text-white text-[11px] font-semibold rounded hover:bg-slate-800 cursor-pointer"
                                    >
                                      Confirm
                                    </button>
                                  )}
                                  {o.fulfilmentMethod === 'STORE_PICKUP' &&
                                    (o.orderStatus === 'CONFIRMED' ||
                                      o.orderStatus === 'PREPARING') && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleQuickOrderWorkflowUpdate(
                                            o.id,
                                            'READY_FOR_PICKUP',
                                            undefined,
                                            'Marked Ready for Pickup via 1-click Overview action'
                                          )
                                        }
                                        className="px-2 py-1 bg-amber-600 text-white text-[11px] font-semibold rounded hover:bg-amber-700 cursor-pointer"
                                      >
                                        Ready Pickup
                                      </button>
                                    )}
                                  {o.paymentStatus === 'PENDING' &&
                                    o.orderStatus !== 'CANCELLED' && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleQuickOrderWorkflowUpdate(
                                            o.id,
                                            undefined,
                                            'PAID',
                                            'Payment collected via 1-click Overview action'
                                          )
                                        }
                                        className="px-2 py-1 bg-emerald-700 text-white text-[11px] font-semibold rounded hover:bg-emerald-800 cursor-pointer"
                                      >
                                        Mark Paid
                                      </button>
                                    )}
                                  <div className="text-right font-mono-tabular">
                                    <p className="font-semibold">{formatPaiseToINR(o.totalPaise)}</p>
                                    <p className="text-[11px] text-slate-500">{o.paymentStatus}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 1B. DEDICATED FIREBASE STORAGE IMAGE UPLOAD TAB */}
              {activeTab === 'media' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                      Firebase Storage Product Image Upload & Association
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                      Upload new product images to Firebase Storage and associate them as primary or gallery photos with any product in the Gayatri Stationers catalogue.
                    </p>
                  </div>

                  <FirebaseImageUpload
                    products={products}
                    selectedProductId={selectedMediaProductId}
                    onSelectProductId={(pid) => setSelectedMediaProductId(pid)}
                    idToken={idToken}
                    onProductImagesUpdated={async (updatedProduct, msg) => {
                      setStatusBanner(msg);
                      if (
                        editingProductId &&
                        updatedProduct &&
                        editingProductId === updatedProduct.id
                      ) {
                        setProductForm((prev) => ({
                          ...prev,
                          imageUrl: updatedProduct.imageUrl || '',
                          galleryUrls: Array.isArray(updatedProduct.galleryUrls)
                            ? updatedProduct.galleryUrls
                            : [],
                        }));
                      }
                      await fetchAdminData();
                      onRefreshStorefront();
                    }}
                  />
                </div>
              )}

              {/* 2. ORDERS & LIVE TRACKER DESK TAB */}
              {activeTab === 'orders' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                      Owner Order Tracking & Store Pickup Desk
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                      Select any order below to inspect its live visual tracking timeline, verify Store Pickup codes, record counter/COD payments, and attach courier AWB tracking.
                    </p>
                  </div>

                  {/* Responsive Filter Bar */}
                  <div className="bg-white border border-slate-200 rounded p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <input
                      type="text"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="Search Order #, Customer Name, Phone, or Pickup Code..."
                      className="sm:col-span-6 px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded"
                    />
                    <select
                      value={fulfilmentFilter}
                      onChange={(e) => setFulfilmentFilter(e.target.value as any)}
                      className="sm:col-span-3 px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded bg-white"
                    >
                      <option value="ALL">All Fulfilment Types</option>
                      <option value="STORE_PICKUP">Store Pickup Only</option>
                      <option value="HOME_DELIVERY">Home Delivery Only</option>
                    </select>
                    <select
                      value={paymentFilter}
                      onChange={(e) => setPaymentFilter(e.target.value as any)}
                      className="sm:col-span-3 px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded bg-white"
                    >
                      <option value="ALL">All Payment Statuses</option>
                      <option value="PENDING">Pending Payment</option>
                      <option value="PAID">Paid</option>
                      <option value="REFUNDED">Refunded</option>
                    </select>
                  </div>

                  {/* Orders Selector Table */}
                  <div className="bg-white border border-slate-200 rounded overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[540px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                          <th className="py-3 px-4">Order # & Pickup Code</th>
                          <th className="py-3 px-4">Customer & Fulfilment</th>
                          <th className="py-3 px-4">Current Stage</th>
                          <th className="py-3 px-4 text-right">Total & Payment</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredOrders.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-500">
                              No matching orders found.
                            </td>
                          </tr>
                        ) : (
                          filteredOrders.map((entry: any) => {
                            const o = entry.order;
                            const isSelected = selectedOrder?.order.id === o.id;
                            return (
                              <tr
                                key={o.id}
                                onClick={() => setSelectedOrder(entry)}
                                className={`cursor-pointer transition-colors ${
                                  isSelected ? 'bg-amber-50/70' : 'hover:bg-slate-50'
                                }`}
                              >
                                <td className="py-3 px-4 font-mono-tabular font-semibold">
                                  <div>{o.orderNumber}</div>
                                  {entry.pickupDetails && (
                                    <div className="text-xs text-amber-800 mt-0.5">
                                      Pickup Code: {entry.pickupDetails.pickupCode}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-medium text-slate-900">{o.customerName}</div>
                                  <div className="text-xs text-slate-500">
                                    {o.customerPhone} · {o.fulfilmentMethod.replace('_', ' ')}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="text-xs font-mono-tabular font-bold text-slate-900">
                                    {o.orderStatus.replace(/_/g, ' ')}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right font-mono-tabular">
                                  <div className="font-semibold">{formatPaiseToINR(o.totalPaise)}</div>
                                  <div
                                    className={`text-xs ${
                                      o.paymentStatus === 'PAID'
                                        ? 'text-emerald-700 font-semibold'
                                        : 'text-amber-700'
                                    }`}
                                  >
                                    {o.paymentStatus} ({o.paymentMethod.replace(/_/g, ' ')})
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedOrder(entry);
                                    }}
                                    className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap ${
                                      isSelected
                                        ? 'bg-slate-900 text-white'
                                        : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                                    }`}
                                  >
                                    {isSelected ? 'Tracking Open' : 'Track & Manage'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Full Visual Order Tracking & Owner Control Panel */}
                  {selectedOrder && (
                    <div className="space-y-2">
                      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                        Live Order Tracking View — {selectedOrder.order.orderNumber}
                      </h2>
                      <OrderTrackingTimeline
                        orderEntry={selectedOrder}
                        isOwnerOrStaff={true}
                        idToken={idToken}
                        onOrderUpdated={async (updatedEntry) => {
                          if (updatedEntry) setSelectedOrder(updatedEntry);
                          await fetchAdminData();
                          onRefreshStorefront();
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* 3. PRODUCTS, PHOTOS & INVENTORY TAB */}
              {activeTab === 'products' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                        Products, Camera Studio & Inventory (Supabase Storage)
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                        Take a product photo with your phone camera, crop and reorder gallery images in Supabase Storage, save drafts or publish products, duplicate items, or import/export CSV.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setActiveTab('csv')}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>CSV Import / Export</span>
                      </button>
                      <button
                        onClick={() => {
                          if (showProductForm) {
                            setShowProductForm(false);
                            handleResetProductForm();
                          } else {
                            handleResetProductForm();
                            setShowProductForm(true);
                          }
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{showProductForm ? 'Close Product Form' : 'Add New Product'}</span>
                      </button>
                    </div>
                  </div>

                  {/* DEDICATED FIREBASE STORAGE IMAGE UPLOAD & PRODUCT ASSOCIATION COMPONENT */}
                  <FirebaseImageUpload
                    products={products}
                    selectedProductId={selectedMediaProductId}
                    onSelectProductId={(pid) => setSelectedMediaProductId(pid)}
                    idToken={idToken}
                    onProductImagesUpdated={async (updatedProduct, msg) => {
                      setStatusBanner(msg);
                      if (editingProductId && updatedProduct && editingProductId === updatedProduct.id) {
                        setProductForm((prev) => ({
                          ...prev,
                          imageUrl: updatedProduct.imageUrl || '',
                          galleryUrls: Array.isArray(updatedProduct.galleryUrls)
                            ? updatedProduct.galleryUrls
                            : [],
                        }));
                      }
                      await fetchAdminData();
                      onRefreshStorefront();
                    }}
                  />

                  {showProductForm && (
                    <form
                      onSubmit={handleCreateProduct}
                      className="bg-white border border-slate-200 rounded p-4 sm:p-6 space-y-6"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <h2 className="text-base font-bold text-slate-900">
                          {editingProductId
                            ? `Edit Product & Photo — ${productForm.name} (${productForm.sku})`
                            : 'Create New Stationery Product'}
                        </h2>
                        {editingProductId && (
                          <button
                            type="button"
                            onClick={handleResetProductForm}
                            className="text-xs text-slate-600 underline"
                          >
                            Switch to New Product
                          </button>
                        )}
                      </div>

                      {/* PRODUCT PHOTO UPLOAD + AI GENERATOR STUDIO */}
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                        <div className="lg:col-span-4">
                          <p className="text-xs font-semibold text-slate-700 mb-2">
                            Live Storefront Card Preview (4:3)
                          </p>
                          <div className="aspect-4/3 w-full max-w-[280px] rounded-2xl border border-slate-300 overflow-hidden bg-slate-50">
                            <ProductIllustration
                              type={productForm.illustrationType}
                              imageUrl={productForm.imageUrl}
                              alt={productForm.name || 'Product Preview'}
                              className="w-full h-full"
                            />
                          </div>
                        </div>

                        <div className="lg:col-span-8 space-y-4 text-xs">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">
                              Product Image Options: Upload Photo OR Generate with AI
                            </h3>
                            <p className="text-slate-600 mt-0.5">
                              You can upload a real photo from your phone/computer, generate a studio image using AI, paste an image link, or pick a clean studio vector illustration.
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            {/* Option 1: Upload from Device */}
                            <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 text-white font-semibold rounded hover:bg-slate-800 cursor-pointer">
                              <ImageIcon className="w-4 h-4" />
                              <span>
                                {uploadingImage ? 'Processing Photo...' : '1. Upload Photo from Device'}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileUploadChange}
                                className="hidden"
                              />
                            </label>

                            {/* Option 2: Generate with AI */}
                            <button
                              type="button"
                              disabled={aiGeneratingImage}
                              onClick={handleGenerateAiProductImage}
                              className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#B42318] text-white font-semibold rounded hover:bg-[#991B1B] disabled:opacity-50 cursor-pointer"
                            >
                              <Sparkles className="w-4 h-4" />
                              <span>
                                {aiGeneratingImage
                                  ? 'Generating Studio Image...'
                                  : '2. Generate Image with AI'}
                              </span>
                            </button>

                            {productForm.imageUrl && (
                              <button
                                type="button"
                                onClick={() => setProductForm({ ...productForm, imageUrl: '' })}
                                className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-100 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove Custom Photo</span>
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div>
                              <label className="block font-medium text-slate-700 mb-1">
                                Or Paste Direct Image URL
                              </label>
                              <input
                                type="text"
                                value={
                                  productForm.imageUrl.startsWith('data:')
                                    ? ''
                                    : productForm.imageUrl
                                }
                                onChange={(e) =>
                                  setProductForm({ ...productForm, imageUrl: e.target.value })
                                }
                                placeholder="https://example.com/product-photo.jpg"
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded"
                              />
                            </div>

                            <div>
                              <label className="block font-medium text-slate-700 mb-1">
                                Studio Vector Illustration (Fallback / Default)
                              </label>
                              <select
                                value={productForm.illustrationType}
                                onChange={(e) =>
                                  setProductForm({
                                    ...productForm,
                                    illustrationType: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded"
                              >
                                {ILLUSTRATION_PRESETS.map((preset) => (
                                  <option key={preset.value} value={preset.value}>
                                    {preset.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            SKU *
                          </label>
                          <input
                            type="text"
                            required
                            value={productForm.sku}
                            onChange={(e) =>
                              setProductForm({ ...productForm, sku: e.target.value })
                            }
                            placeholder="e.g. GS-011-20"
                            className="w-full px-3 py-2 border border-slate-300 rounded font-mono-tabular"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Product Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={productForm.name}
                            onChange={(e) =>
                              setProductForm({ ...productForm, name: e.target.value })
                            }
                            placeholder="e.g. Hearts Stickers Pack / Classmate Notebook"
                            className="w-full px-3 py-2 border border-slate-300 rounded"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-medium text-slate-700">
                              Category
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setAddingInlineCategory(!addingInlineCategory);
                                setProductForm({ ...productForm, newCategoryName: '' });
                              }}
                              className="text-[11px] font-bold text-red-700 underline cursor-pointer"
                            >
                              {addingInlineCategory ? 'Select Existing' : '+ New Category'}
                            </button>
                          </div>
                          {addingInlineCategory ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                placeholder="Type new category (e.g. DIY & Crafts)"
                                value={productForm.newCategoryName}
                                onChange={(e) =>
                                  setProductForm({
                                    ...productForm,
                                    newCategoryName: e.target.value,
                                  })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleQuickSaveInlineCategory();
                                  }
                                }}
                                className="w-full px-3 py-2 border-2 border-red-600 rounded bg-amber-50/40 text-sm"
                              />
                              <button
                                type="button"
                                disabled={savingInlineCategory}
                                onClick={handleQuickSaveInlineCategory}
                                className="px-3 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded shrink-0 cursor-pointer"
                              >
                                {savingInlineCategory ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          ) : (
                            <select
                              value={productForm.categoryId}
                              onChange={(e) =>
                                setProductForm({
                                  ...productForm,
                                  categoryId: Number(e.target.value),
                                })
                              }
                              className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                            >
                              {localCategoriesList.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-medium text-slate-700">
                              Company / Brand
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setAddingInlineBrand(!addingInlineBrand);
                                setProductForm({ ...productForm, newBrandName: '' });
                              }}
                              className="text-[11px] font-bold text-red-700 underline cursor-pointer"
                            >
                              {addingInlineBrand ? 'Select Existing' : '+ New Company / Brand'}
                            </button>
                          </div>
                          {addingInlineBrand ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                placeholder="Type new company / brand (e.g. Camlin)..."
                                value={productForm.newBrandName}
                                onChange={(e) =>
                                  setProductForm({
                                    ...productForm,
                                    newBrandName: e.target.value,
                                  })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleQuickSaveInlineBrand();
                                  }
                                }}
                                className="w-full px-3 py-2 border-2 border-red-600 rounded bg-amber-50/40 text-sm"
                              />
                              <button
                                type="button"
                                disabled={savingInlineBrand}
                                onClick={handleQuickSaveInlineBrand}
                                className="px-3 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded shrink-0 cursor-pointer"
                              >
                                {savingInlineBrand ? 'Saving...' : 'Save Company'}
                              </button>
                            </div>
                          ) : (
                            <select
                              value={productForm.brandId}
                              onChange={(e) =>
                                setProductForm({
                                  ...productForm,
                                  brandId: Number(e.target.value),
                                })
                              }
                              className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                            >
                              {localBrandsList.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Stock Quantity *
                          </label>
                          <input
                            type="number"
                            min={0}
                            required
                            value={productForm.initialStockQuantity}
                            onChange={(e) =>
                              setProductForm({
                                ...productForm,
                                initialStockQuantity: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded font-mono-tabular"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            MRP (₹ Rupees) *
                          </label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={productForm.mrpRupees}
                            onChange={(e) =>
                              setProductForm({ ...productForm, mrpRupees: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded font-mono-tabular"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Selling Price (₹ Rupees) *
                          </label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={productForm.sellingPriceRupees}
                            onChange={(e) =>
                              setProductForm({
                                ...productForm,
                                sellingPriceRupees: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded font-mono-tabular"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Variant Label
                          </label>
                          <input
                            type="text"
                            value={productForm.variantName}
                            onChange={(e) =>
                              setProductForm({ ...productForm, variantName: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded"
                          />
                        </div>
                        <div className="sm:col-span-2 md:col-span-3">
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Short Description *
                          </label>
                          <input
                            type="text"
                            required
                            value={productForm.shortDescription}
                            onChange={(e) =>
                              setProductForm({
                                ...productForm,
                                shortDescription: e.target.value,
                                description: e.target.value,
                              })
                            }
                            placeholder="Concise retail summary shown on product cards and PDP"
                            className="w-full px-3 py-2 border border-slate-300 rounded"
                          />
                        </div>
                        <div className="sm:col-span-2 md:col-span-3 grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-200 text-xs">
                          <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                            <input
                              type="checkbox"
                              checked={productForm.isFeatured}
                              onChange={(e) =>
                                setProductForm({ ...productForm, isFeatured: e.target.checked })
                              }
                            />
                            <span>Featured Product</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                            <input
                              type="checkbox"
                              checked={productForm.isBestseller}
                              onChange={(e) =>
                                setProductForm({ ...productForm, isBestseller: e.target.checked })
                              }
                            />
                            <span>Bestseller Badge</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                            <input
                              type="checkbox"
                              checked={productForm.isNewArrival}
                              onChange={(e) =>
                                setProductForm({ ...productForm, isNewArrival: e.target.checked })
                              }
                            />
                            <span>New Arrival</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                            <input
                              type="checkbox"
                              checked={productForm.pickupEligible}
                              onChange={(e) =>
                                setProductForm({ ...productForm, pickupEligible: e.target.checked })
                              }
                            />
                            <span>Store Pickup Eligible</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                            <input
                              type="checkbox"
                              checked={productForm.deliveryEligible}
                              onChange={(e) =>
                                setProductForm({
                                  ...productForm,
                                  deliveryEligible: e.target.checked,
                                })
                              }
                            />
                            <span>Home Delivery Eligible</span>
                          </label>
                        </div>
                      </div>
                      <div className="flex justify-end gap-3">
                        <button
                          type="submit"
                          className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded hover:bg-slate-800 cursor-pointer"
                        >
                          {editingProductId
                            ? 'Save Updated Product & Photo'
                            : 'Save Product & Initialize Stock'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Bulk Product Operations Bar */}
                  <div className="bg-white border border-slate-200 rounded p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">
                        Bulk Catalogue Actions ({selectedBulkProductIds.length} selected):
                      </span>
                      <button
                        type="button"
                        onClick={() => handleBulkProductAction('PUBLISH')}
                        className="px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded font-medium cursor-pointer"
                      >
                        Publish
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBulkProductAction('HIDE')}
                        className="px-2.5 py-1 bg-amber-50 border border-amber-300 text-amber-900 rounded font-medium cursor-pointer"
                      >
                        Hide
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBulkProductAction('MARK_FEATURED')}
                        className="px-2.5 py-1 bg-slate-100 border border-slate-300 text-slate-800 rounded font-medium cursor-pointer"
                      >
                        Mark Featured
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBulkProductAction('MARK_BESTSELLER')}
                        className="px-2.5 py-1 bg-slate-100 border border-slate-300 text-slate-800 rounded font-medium cursor-pointer"
                      >
                        Mark Bestseller
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('cms');
                          setCmsSubTab('categories');
                        }}
                        className="text-red-700 font-bold underline cursor-pointer"
                      >
                        Manage Categories ({categories.length})
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('cms');
                          setCmsSubTab('brands');
                        }}
                        className="text-red-700 font-bold underline cursor-pointer"
                      >
                        Manage Companies ({brands.length})
                      </button>
                    </div>
                  </div>

                  {/* Products & Variants Inventory Table */}
                  <div className="bg-white border border-slate-200 rounded overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[640px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                          <th className="py-3 px-3 w-8">
                            <input
                              type="checkbox"
                              checked={
                                products.length > 0 &&
                                selectedBulkProductIds.length === products.length
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedBulkProductIds(products.map((p) => p.id));
                                } else {
                                  setSelectedBulkProductIds([]);
                                }
                              }}
                            />
                          </th>
                          <th className="py-3 px-4">Photo</th>
                          <th className="py-3 px-4">SKU & Product</th>
                          <th className="py-3 px-4">Category & Variant</th>
                          <th className="py-3 px-4 text-right">MRP / Price</th>
                          <th className="py-3 px-4 text-right">Stock Adjustment</th>
                          <th className="py-3 px-4 text-right">Edit / Photo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {(products || []).map((p) =>
                          (p.variants || []).map((v: any) => (
                            <tr key={v.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3">
                                <input
                                  type="checkbox"
                                  checked={selectedBulkProductIds.includes(p.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedBulkProductIds((prev) =>
                                        Array.from(new Set([...prev, p.id]))
                                      );
                                    } else {
                                      setSelectedBulkProductIds((prev) =>
                                        prev.filter((id) => id !== p.id)
                                      );
                                    }
                                  }}
                                />
                              </td>
                              <td className="py-2.5 px-4 w-20">
                                <div className="w-16 h-12 rounded border border-slate-200 overflow-hidden">
                                  <ProductIllustration
                                    type={p.illustrationType}
                                    imageUrl={p.imageUrl}
                                    alt={p.name}
                                    className="w-full h-full"
                                  />
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-900">{p.name}</div>
                                <div className="text-xs text-slate-500 font-mono-tabular">
                                  {v.sku}{' '}
                                  {p.isSampleData
                                    ? '· Sample Catalogue Item'
                                    : '· Verified Store Item'}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-600">
                                <div>{p.categoryName} · {p.brandName}</div>
                                <div className="text-slate-400">{v.variantName}</div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono-tabular text-xs">
                                <span className="line-through text-slate-400 mr-1.5">
                                  {formatPaiseToINR(v.mrpPaise)}
                                </span>
                                <span className="font-semibold text-slate-900">
                                  {formatPaiseToINR(v.sellingPricePaise)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={0}
                                    value={
                                      stockInputs[v.id] !== undefined
                                        ? stockInputs[v.id]
                                        : String(v.stockQuantity)
                                    }
                                    onChange={(e) =>
                                      setStockInputs({ ...stockInputs, [v.id]: e.target.value })
                                    }
                                    className="w-16 sm:w-20 px-2 py-1 text-right font-mono-tabular text-xs border border-slate-300 rounded"
                                  />
                                  <button
                                    onClick={() => handleStockAdjustment(v.id)}
                                    className="px-2.5 py-1 bg-slate-900 text-white text-xs rounded hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                                  >
                                    Update
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedMediaProductId(p.id);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-950 text-xs font-medium rounded whitespace-nowrap cursor-pointer"
                                  >
                                    <ImageIcon className="w-3.5 h-3.5" />
                                    <span>Upload Photo</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditProduct(p)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded whitespace-nowrap cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDuplicateProduct(p)}
                                    title="Duplicate Product"
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded whitespace-nowrap cursor-pointer"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Inventory Movement History */}
                  <div className="bg-white border border-slate-200 rounded p-4 sm:p-5">
                    <h2 className="text-sm sm:text-base font-semibold text-slate-900 mb-3">
                      Recent Inventory Movements Audit Log
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs min-w-[500px]">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="py-2 pr-4">Timestamp</th>
                            <th className="py-2 pr-4">Product</th>
                            <th className="py-2 pr-4">Reason / Reference</th>
                            <th className="py-2 pr-4 text-right">Delta</th>
                            <th className="py-2 text-right">New Stock</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono-tabular">
                          {dashboardData.inventoryMovements.slice(0, 12).map((m: any) => (
                            <tr key={m.id}>
                              <td className="py-2 pr-4 text-slate-500">
                                {new Date(m.createdAt).toLocaleString('en-IN')}
                              </td>
                              <td className="py-2 pr-4 font-sans font-medium text-slate-900">
                                {m.productName}
                              </td>
                              <td className="py-2 pr-4 text-slate-600">
                                {m.reason} ({m.referenceOrderNumber}) · {m.actorEmail}
                              </td>
                              <td
                                className={`py-2 pr-4 text-right font-semibold ${
                                  m.deltaQuantity >= 0 ? 'text-emerald-700' : 'text-red-700'
                                }`}
                              >
                                {m.deltaQuantity >= 0 ? `+${m.deltaQuantity}` : m.deltaQuantity}
                              </td>
                              <td className="py-2 text-right font-semibold">{m.newStock}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. CSV IMPORT / EXPORT TAB */}
              {activeTab === 'csv' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                        Catalogue CSV Import & Export
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-600">
                        Bulk-populate or update Gayatri Stationers products, variants, prices, and stock quantities.
                      </p>
                    </div>
                    <button
                      onClick={handleExportCsv}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800 whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Live Catalogue CSV</span>
                    </button>
                  </div>

                  <div className="bg-white border border-slate-200 rounded p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs sm:text-sm font-semibold text-slate-900">
                        CSV Payload (Header + Product Rows)
                      </label>
                      <button
                        onClick={() => setCsvText(CSV_TEMPLATE)}
                        className="text-xs text-slate-600 underline"
                      >
                        Reset to Sample Template
                      </button>
                    </div>
                    <textarea
                      rows={8}
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                      className="w-full p-3 font-mono-tabular text-xs border border-slate-300 rounded bg-slate-50"
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">
                        Required columns: sku, name, category_slug, mrp_rupees, selling_price_rupees, stock_quantity
                      </p>
                      <button
                        onClick={handleImportCsv}
                        className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800 self-start sm:self-auto"
                      >
                        Validate & Import CSV Rows
                      </button>
                    </div>

                    {csvResult && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                        <p className="font-semibold text-emerald-800">
                          Imported/Updated {csvResult.importedCount} rows successfully.
                        </p>
                        {(csvResult.warnings || []).map((w, i) => (
                          <p key={i} className="text-amber-800">
                            Warning: {w}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 5. PROMOTIONS & COUPONS TAB */}
              {activeTab === 'promotions' && (
                <div className="space-y-6">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                    Coupons & Promotional Rules
                  </h1>
                  <form
                    onSubmit={handleSaveCoupon}
                    className="bg-white border border-slate-200 rounded p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm"
                  >
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Coupon Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={couponForm.code}
                        onChange={(e) =>
                          setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })
                        }
                        placeholder="e.g. EXAM15"
                        className="w-full px-3 py-2 border border-slate-300 rounded font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Discount Type
                      </label>
                      <select
                        value={couponForm.discountType}
                        onChange={(e) =>
                          setCouponForm({
                            ...couponForm,
                            discountType: e.target.value as any,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                      >
                        <option value="PERCENTAGE">Percentage (%)</option>
                        <option value="FLAT_PAISE">Flat Amount (₹)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Discount Value ({couponForm.discountType === 'PERCENTAGE' ? '%' : '₹'}) *
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={couponForm.discountValueInput}
                        onChange={(e) =>
                          setCouponForm({ ...couponForm, discountValueInput: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Min Order Value (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={couponForm.minOrderRupees}
                        onChange={(e) =>
                          setCouponForm({ ...couponForm, minOrderRupees: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Description *
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          required
                          value={couponForm.description}
                          onChange={(e) =>
                            setCouponForm({ ...couponForm, description: e.target.value })
                          }
                          placeholder="e.g. 15% off on exam stationery above ₹399"
                          className="flex-1 px-3 py-2 border border-slate-300 rounded"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800 whitespace-nowrap"
                        >
                          Save Coupon
                        </button>
                      </div>
                    </div>
                  </form>

                  <div className="bg-white border border-slate-200 rounded overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[460px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                          <th className="py-3 px-4">Code</th>
                          <th className="py-3 px-4">Description</th>
                          <th className="py-3 px-4">Min Order</th>
                          <th className="py-3 px-4 text-right">Redemptions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {dashboardData.coupons.map((c: any) => (
                          <tr key={c.id}>
                            <td className="py-3 px-4 font-mono-tabular font-semibold">{c.code}</td>
                            <td className="py-3 px-4">{c.description}</td>
                            <td className="py-3 px-4 font-mono-tabular">
                              {formatPaiseToINR(c.minOrderPaise)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono-tabular">
                              {c.usedCount} / {c.usageLimit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 6. SERVICEABLE PIN CODES TAB */}
              {activeTab === 'pincodes' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                      Serviceable PIN Codes & Delivery Fee Rules
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Configure which PIN codes are eligible for Home Delivery, shipping fees, free-shipping thresholds, and Cash on Delivery.
                    </p>
                  </div>

                  <form
                    onSubmit={handleSavePincode}
                    className="bg-white border border-slate-200 rounded p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm"
                  >
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        6-Digit PIN Code *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={pincodeForm.pincode}
                        onChange={(e) =>
                          setPincodeForm({ ...pincodeForm, pincode: e.target.value })
                        }
                        placeholder="e.g. 282005"
                        className="w-full px-3 py-2 border border-slate-300 rounded font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        City / Zone Label *
                      </label>
                      <input
                        type="text"
                        required
                        value={pincodeForm.city}
                        onChange={(e) => setPincodeForm({ ...pincodeForm, city: e.target.value })}
                        placeholder="e.g. Agra (Dayalbagh)"
                        className="w-full px-3 py-2 border border-slate-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Delivery Fee (₹) *
                      </label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={pincodeForm.deliveryFeeRupees}
                        onChange={(e) =>
                          setPincodeForm({ ...pincodeForm, deliveryFeeRupees: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Free Delivery Above (₹) *
                      </label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={pincodeForm.freeThresholdRupees}
                        onChange={(e) =>
                          setPincodeForm({ ...pincodeForm, freeThresholdRupees: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Estimated Delivery Window
                      </label>
                      <input
                        type="text"
                        value={pincodeForm.estimatedDays}
                        onChange={(e) =>
                          setPincodeForm({ ...pincodeForm, estimatedDays: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded"
                      />
                    </div>
                    <div className="flex items-end justify-between gap-3">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 pb-2.5">
                        <input
                          type="checkbox"
                          checked={pincodeForm.codAvailable}
                          onChange={(e) =>
                            setPincodeForm({ ...pincodeForm, codAvailable: e.target.checked })
                          }
                        />
                        <span>Enable Cash on Delivery (COD)</span>
                      </label>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800 whitespace-nowrap"
                      >
                        Save PIN Code
                      </button>
                    </div>
                  </form>

                  <div className="bg-white border border-slate-200 rounded overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[520px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                          <th className="py-3 px-4">PIN Code</th>
                          <th className="py-3 px-4">City / Zone</th>
                          <th className="py-3 px-4">Delivery Fee</th>
                          <th className="py-3 px-4">Free Above</th>
                          <th className="py-3 px-4">COD</th>
                          <th className="py-3 px-4">ETA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {dashboardData.serviceablePincodes.map((p: any) => (
                          <tr key={p.id}>
                            <td className="py-3 px-4 font-mono-tabular font-semibold">
                              {p.pincode}
                            </td>
                            <td className="py-3 px-4">
                              {p.city}, {p.state}{' '}
                              {p.isSampleRule && (
                                <span className="text-xs text-slate-400">· Sample Rule</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono-tabular">
                              {formatPaiseToINR(p.deliveryFeePaise)}
                            </td>
                            <td className="py-3 px-4 font-mono-tabular">
                              {formatPaiseToINR(p.freeDeliveryThresholdPaise)}
                            </td>
                            <td className="py-3 px-4 text-xs">
                              {p.codAvailable ? 'Eligible' : 'Prepaid Only'}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600">{p.estimatedDays}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 7. BULK ORDER ENQUIRIES TAB */}
              {activeTab === 'bulk' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                      Institutional & School Bulk Order Enquiries
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Review quotation requests from schools, colleges, and corporate offices.
                    </p>
                  </div>

                  {dashboardData.bulkEnquiries.length === 0 ? (
                    <div className="p-8 bg-white border border-slate-200 rounded text-sm text-slate-500">
                      No bulk order enquiries submitted yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {dashboardData.bulkEnquiries.map((enq: any) => (
                        <div
                          key={enq.id}
                          className="bg-white border border-slate-200 rounded p-4 sm:p-5 space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div>
                              <span className="font-mono-tabular font-bold text-sm">
                                {enq.enquiryNumber}
                              </span>{' '}
                              · <span className="font-semibold">{enq.institutionName}</span>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Contact: {enq.contactPerson} · {enq.phone} · {enq.email}
                                {enq.gstin ? ` · GSTIN: ${enq.gstin}` : ''}
                              </p>
                            </div>
                            <span className="font-mono-tabular text-xs font-semibold text-slate-800">
                              Status: {enq.status}
                            </span>
                          </div>
                          <div className="text-xs bg-slate-50 p-3 rounded border border-slate-200 space-y-1">
                            <p className="font-semibold text-slate-700">Requested Items:</p>
                            {(enq.itemsRequestedJson || []).map((it: any, idx: number) => (
                              <p key={idx}>
                                • {it.quantity} units — {it.itemName} ({it.skuOrCategory})
                              </p>
                            ))}
                            {enq.notes && <p className="pt-1 text-slate-600">Notes: {enq.notes}</p>}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {['REVIEWING', 'QUOTED', 'CONFIRMED', 'CLOSED'].map((st) => (
                              <button
                                key={st}
                                onClick={() =>
                                  handleUpdateBulkEnquiry(
                                    enq.id,
                                    st,
                                    enq.quotedAmountPaise
                                      ? String(enq.quotedAmountPaise / 100)
                                      : '',
                                    `Marked ${st} by admin`
                                  )
                                }
                                className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded hover:bg-slate-800"
                              >
                                Mark {st}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 8. STORE & STAFF SETTINGS TAB */}
              {activeTab === 'settings' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                      Store Pickup Configuration & Staff Permissions
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Configure verified physical counter address, operating hours, Cashfree payment gateway, and staff roles.
                    </p>
                  </div>

                  {/* CASHFREE PAYMENT GATEWAY MANAGER */}
                  <form
                    onSubmit={handleSaveCashfreeConfig}
                    className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-2xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-700 font-bold">
                          INDIAN ONLINE PAYMENTS · CASHFREE PG
                        </span>
                        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <span>Cashfree Payment Gateway Integration</span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              cashfreeAppId && cashfreeSecretKey
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {cashfreeAppId && cashfreeSecretKey ? 'Configured' : 'Needs Setup'}
                          </span>
                        </h2>
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        Webhook: <code className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">/api/webhooks/cashfree</code>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Environment Mode
                        </label>
                        <select
                          value={cashfreeEnv}
                          onChange={(e: any) => setCashfreeEnv(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded bg-white font-medium"
                        >
                          <option value="SANDBOX">SANDBOX (Test Mode)</option>
                          <option value="PRODUCTION">PRODUCTION (Live Mode)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Cashfree App ID (Client ID)
                        </label>
                        <input
                          type="text"
                          value={cashfreeAppId}
                          onChange={(e) => setCashfreeAppId(e.target.value)}
                          placeholder="TEST... or PROD..."
                          className="w-full px-3 py-2 border border-slate-300 rounded font-mono text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Cashfree Secret Key
                        </label>
                        <input
                          type="password"
                          value={cashfreeSecretKey}
                          onChange={(e) => setCashfreeSecretKey(e.target.value)}
                          placeholder="cfsk_ma_..."
                          className="w-full px-3 py-2 border border-slate-300 rounded font-mono text-xs"
                        />
                      </div>
                    </div>

                    {cashfreeTestResult && (
                      <div
                        className={`p-3 rounded text-xs border ${
                          cashfreeTestResult.success
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-rose-50 border-rose-200 text-rose-900'
                        }`}
                      >
                        <p className="font-bold">
                          {cashfreeTestResult.success ? '✅ API Connection Successful' : '❌ API Connection Failed'}
                        </p>
                        <p className="mt-0.5">{cashfreeTestResult.message}</p>
                      </div>
                    )}

                    {cashfreeSaveStatus && (
                      <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-900 rounded text-xs font-medium">
                        {cashfreeSaveStatus}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleTestCashfreeConfig}
                        disabled={cashfreeTesting || !cashfreeAppId || !cashfreeSecretKey}
                        className="px-3.5 py-2 bg-slate-100 text-slate-800 text-xs font-semibold rounded hover:bg-slate-200 disabled:opacity-50 cursor-pointer"
                      >
                        {cashfreeTesting ? 'Testing Credentials...' : 'Test API Credentials'}
                      </button>

                      <button
                        type="submit"
                        disabled={cashfreeSaving}
                        className="px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                      >
                        {cashfreeSaving ? 'Saving...' : 'Save Cashfree Gateway Credentials'}
                      </button>
                    </div>

                    {/* How to get Cashfree keys helper */}
                    <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 space-y-2">
                      <p className="font-bold text-slate-900">Where do I find my Cashfree App ID and Secret Key?</p>
                      <ol className="list-decimal list-inside space-y-1 text-slate-700">
                        <li>Log in to your <a href="https://merchant.cashfree.com" target="_blank" rel="noreferrer" className="text-emerald-700 underline font-semibold">Cashfree Merchant Dashboard</a>.</li>
                        <li>Switch the toggle at the top bar to <strong>Test/Sandbox</strong> or <strong>Production</strong>.</li>
                        <li>In the left sidebar, navigate to <strong>Payment Gateway &gt; Developers &gt; API Keys</strong>.</li>
                        <li>Click <strong>Generate API Keys</strong> to copy your <strong>App ID</strong> and <strong>Secret Key</strong>.</li>
                        <li>In Cashfree Webhook settings, set URL to <code>https://{typeof window !== 'undefined' ? window.location.host : 'your-app-domain'}/api/webhooks/cashfree</code> with API Version <code>2023-08-01</code>.</li>
                      </ol>
                    </div>
                  </form>

                  <form
                    onSubmit={handleSaveStoreSettings}
                    className="bg-white border border-slate-200 rounded p-4 sm:p-5 space-y-4 text-sm"
                  >
                    <h2 className="text-base font-semibold text-slate-900">
                      Store Pickup Location & Hours
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Store Pickup Counter Address Label
                        </label>
                        <input
                          type="text"
                          value={profileSetting.pickupCounterLabel}
                          onChange={(e) =>
                            setProfileSetting({
                              ...profileSetting,
                              pickupCounterLabel: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Business Hours Note
                        </label>
                        <input
                          type="text"
                          value={profileSetting.businessHoursNote}
                          onChange={(e) =>
                            setProfileSetting({
                              ...profileSetting,
                              businessHoursNote: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Customer Support Contact Note
                        </label>
                        <input
                          type="text"
                          value={profileSetting.supportContactNote}
                          onChange={(e) =>
                            setProfileSetting({
                              ...profileSetting,
                              supportContactNote: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Verification Status
                        </label>
                        <select
                          value={profileSetting.verificationStatus}
                          onChange={(e) =>
                            setProfileSetting({
                              ...profileSetting,
                              verificationStatus: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                        >
                          <option value="UNVERIFIED_ADMIN_CONFIG_REQUIRED">
                            Unverified Default — Awaiting Owner Verification
                          </option>
                          <option value="VERIFIED_BY_STORE_OWNER">
                            Verified by Store Owner
                          </option>
                        </select>
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800"
                    >
                      Save Store Settings
                    </button>
                  </form>

                  {/* Registered Users & Role Management */}
                  <div className="bg-white border border-slate-200 rounded p-4 sm:p-5 overflow-x-auto">
                    <h2 className="text-base font-semibold text-slate-900 mb-3">
                      Registered Users & Role-Based Access Control
                    </h2>
                    <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[420px]">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs text-slate-600">
                          <th className="py-2 pr-4">Email</th>
                          <th className="py-2 pr-4">Name</th>
                          <th className="py-2 pr-4">Current Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {dashboardData.users.map((u: any) => (
                          <tr key={u.id}>
                            <td className="py-2.5 pr-4 font-mono-tabular text-xs">{u.email}</td>
                            <td className="py-2.5 pr-4 text-xs">{u.fullName}</td>
                            <td className="py-2.5 pr-4 text-xs font-semibold uppercase">
                              {u.role}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Supabase PostgreSQL Migration, RLS & Recoverable Backup Panel */}
                  <div className="bg-white border border-slate-200 rounded p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-700 font-bold">
                          SUPABASE POSTGRESQL + ROW LEVEL SECURITY + STORAGE
                        </span>
                        <h2 className="text-base font-semibold text-slate-900">
                          Database Integrity & Recoverable Backup Snapshot
                        </h2>
                        <p className="text-xs text-slate-600">
                          All products, categories, brands, navigation, banners, pages, orders, and notifications are persisted in PostgreSQL (`src/db/schema.ts` + `supabase/schema_and_rls.sql`).
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              setStatusBanner('Testing live Supabase connection...');
                              const res = await fetch('/api/admin/supabase-test', {
                                headers: buildAdminHeaders(),
                              });
                              const data = await res.json();
                              if (data.status === 'ok') {
                                setStatusBanner(`✓ Supabase Connected & Healthy (${data.url || 'endpoint'}) — ${data.details}`);
                              } else {
                                setErrorMsg(`Supabase notice: ${data.details}`);
                              }
                            } catch (err: any) {
                              setErrorMsg(err.message || 'Supabase test failed.');
                            }
                          }}
                          className="px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded hover:bg-emerald-800 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Test Supabase Connection
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/admin/migration-backup', {
                                headers: buildAdminHeaders(),
                              });
                              if (!res.ok) throw new Error('Failed to generate backup');
                              const blob = await res.blob();
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `gayatri-stationers-supabase-backup-${new Date()
                                .toISOString()
                                .slice(0, 10)}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                              setStatusBanner('Downloaded recoverable PostgreSQL / Supabase JSON backup.');
                            } catch (err: any) {
                              setErrorMsg(err.message || 'Backup download failed.');
                            }
                          }}
                          className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Download Recoverable JSON Backup
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                        <div className="text-slate-500">Categories</div>
                        <div className="text-base font-bold font-mono-tabular text-slate-900">
                          {categories.length}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                        <div className="text-slate-500">Brands</div>
                        <div className="text-base font-bold font-mono-tabular text-slate-900">
                          {brands.length}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                        <div className="text-slate-500">Products</div>
                        <div className="text-base font-bold font-mono-tabular text-slate-900">
                          {products.length}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                        <div className="text-slate-500">Orders</div>
                        <div className="text-base font-bold font-mono-tabular text-slate-900">
                          {(dashboardData.orders || []).length}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                        <div className="text-slate-500">CMS Pages</div>
                        <div className="text-base font-bold font-mono-tabular text-slate-900">
                          {(dashboardData.pages || []).length}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                        <div className="text-slate-500">Notifications</div>
                        <div className="text-base font-bold font-mono-tabular text-slate-900">
                          {(dashboardData.notifications || []).length}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 9. STORE CMS & WEBSITE BUILDER TAB */}
              {activeTab === 'cms' && (
                <CmsStudioManager
                  activeSubTab={cmsSubTab}
                  setActiveSubTab={setCmsSubTab}
                  bootstrap={{
                    ...(bootstrap || {}),
                    categories: localCategoriesList,
                    brands: localBrandsList,
                    products,
                    settings: storeSettings,
                    navigationItems: bootstrap?.navigationItems || dashboardData?.navigationItems || [],
                    homepageSections: bootstrap?.homepageSections || dashboardData?.homepageSections || [],
                    banners: bootstrap?.banners || dashboardData?.banners || [],
                    pages: bootstrap?.pages || dashboardData?.pages || [],
                    bundles: bootstrap?.bundles || dashboardData?.bundles || [],
                    revisions: bootstrap?.revisions || dashboardData?.revisions || [],
                  }}
                  adminData={{
                    ...(dashboardData || {}),
                    brands: localBrandsList,
                    categories: localCategoriesList,
                  }}
                  fetchWithAuth={(url, options = {}) =>
                    fetch(url, {
                      ...options,
                      headers: {
                        ...buildAdminHeaders(Boolean(options.body)),
                        ...(options.headers || {}),
                      },
                    })
                  }
                  onRefresh={async () => {
                    await fetchAdminData();
                    onRefreshStorefront();
                  }}
                  notify={(msg, type) => {
                    if (type === 'error') {
                      setErrorMsg(msg);
                    } else {
                      setStatusBanner(msg);
                      setErrorMsg(null);
                    }
                  }}
                  onPreviewStorefront={(target) => {
                    if (onNavigateStorefront && target) {
                      onNavigateStorefront(target);
                    } else {
                      onExitAdmin();
                    }
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
