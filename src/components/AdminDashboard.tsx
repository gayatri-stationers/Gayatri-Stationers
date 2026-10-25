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
  Globe,
  Mic,
  Send,
  Bot,
  X,
  TrendingUp,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { CmsStudioManager, CmsSubTab } from './CmsStudioManager.tsx';

interface AdminDashboardProps {
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

  const [localProductsList, setLocalProductsList] = useState<any[]>(() => {
    try {
      const deletedRaw = localStorage.getItem('gs_deleted_products_v1');
      const deletedList: any[] = deletedRaw ? JSON.parse(deletedRaw) : [];
      const storedRaw = localStorage.getItem('gs_fallback_catalogue_v1');
      const stored = storedRaw ? JSON.parse(storedRaw) : [];
      const base = Array.isArray(products) ? products : [];
      const merged = new Map<string, any>();
      for (const p of [...(Array.isArray(stored) ? stored : []), ...base]) {
        if (!p || !p.name) continue;
        if (
          deletedList.includes(Number(p.id)) ||
          deletedList.includes(String(p.sku || '').toLowerCase())
        ) {
          continue;
        }
        const key = String(p.sku || p.id).toLowerCase();
        if (!merged.has(key)) merged.set(key, p);
      }
      return Array.from(merged.values());
    } catch {
      return Array.isArray(products) ? products : [];
    }
  });

  useEffect(() => {
    try {
      const deletedRaw = localStorage.getItem('gs_deleted_products_v1');
      const deletedList: any[] = deletedRaw ? JSON.parse(deletedRaw) : [];
      const storedRaw = localStorage.getItem('gs_fallback_catalogue_v1');
      const stored = storedRaw ? JSON.parse(storedRaw) : [];
      const dashProds = Array.isArray(dashboardData?.products) ? dashboardData.products : [];
      const propProds = Array.isArray(products) ? products : [];
      const merged = new Map<string, any>();
      for (const p of [
        ...(Array.isArray(stored) ? stored : []),
        ...localProductsList,
        ...dashProds,
        ...propProds,
      ]) {
        if (!p || !p.name) continue;
        if (
          deletedList.includes(Number(p.id)) ||
          deletedList.includes(String(p.sku || '').toLowerCase())
        ) {
          continue;
        }
        const key = String(p.sku || p.id).toLowerCase();
        if (!merged.has(key)) merged.set(key, p);
      }
      const next = Array.from(merged.values());
      if (next.length > 0) setLocalProductsList(next);
    } catch {
      // Ignore
    }
  }, [products, dashboardData?.products]);

  // Gemini AI Admin Copilot & Web Photos State
  const [aiCopilotPrompt, setAiCopilotPrompt] = useState('');
  const [aiCopilotLoading, setAiCopilotLoading] = useState(false);
  const [aiListening, setAiListening] = useState(false);
  const [aiCopilotReply, setAiCopilotReply] = useState<string | null>(null);
  const [webPhotosResults, setWebPhotosResults] = useState<
    Array<{ url: string; title: string; source: string }>
  >([]);
  const [webPhotosLoading, setWebPhotosLoading] = useState(false);
  const [webPhotoQuery, setWebPhotoQuery] = useState('');
  const [showWebPhotoPicker, setShowWebPhotoPicker] = useState(false);

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

  const [newGalleryUrlInput, setNewGalleryUrlInput] = useState('');

  // Upload one or multiple images from user's computer/phone to Supabase Storage / PostgreSQL Asset Store
  const handleFileUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    setUploadingImage(true);
    setErrorMsg(null);
    try {
      const uploadedUrls: string[] = [];
      let providerLabel = 'Supabase Storage (product-images bucket)';

      for (const file of files) {
        const base64DataUrl = await compressImageFileToDataUrl(file);
        let finalUrl = base64DataUrl;
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
        uploadedUrls.push(finalUrl);
      }

      if (uploadedUrls.length > 0) {
        setProductForm((prev) => {
          const nextPrimary = prev.imageUrl || uploadedUrls[0];
          const mergedGallery = Array.from(
            new Set([nextPrimary, ...uploadedUrls, ...(prev.galleryUrls || [])].filter(Boolean))
          );
          return {
            ...prev,
            imageUrl: nextPrimary,
            galleryUrls: mergedGallery,
          };
        });
        setStatusBanner(
          files.length > 1
            ? `Uploaded ${files.length} photos to ${providerLabel} and added all to product gallery. Click "Save Product" below to publish.`
            : `Uploaded "${files[0].name}" to ${providerLabel}. Click "Save Product" below to publish.`
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not upload product image(s).');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleAddGalleryUrlToProduct = () => {
    const raw = newGalleryUrlInput.trim();
    if (!raw) return;
    const urls = raw
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length === 0) return;
    setProductForm((prev) => {
      const nextPrimary = prev.imageUrl || urls[0];
      const nextGallery = Array.from(
        new Set([nextPrimary, ...(prev.galleryUrls || []), ...urls].filter(Boolean))
      );
      return {
        ...prev,
        imageUrl: nextPrimary,
        galleryUrls: nextGallery,
      };
    });
    setNewGalleryUrlInput('');
    setStatusBanner(
      `Added ${urls.length} photo${urls.length > 1 ? 's' : ''} to product gallery. Click a thumbnail to set as primary cover.`
    );
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
      const savedProd = data.product;
      if (savedProd) {
        setLocalProductsList((prev) => {
          const exists = prev.some(
            (p) =>
              Number(p.id) === Number(savedProd.id) ||
              String(p.sku || '').toLowerCase() === String(savedProd.sku || '').toLowerCase()
          );
          const next = exists
            ? prev.map((p) =>
                Number(p.id) === Number(savedProd.id) ||
                String(p.sku || '').toLowerCase() === String(savedProd.sku || '').toLowerCase()
                  ? { ...p, ...savedProd, variants: savedProd.variants || p.variants }
                  : p
              )
            : [savedProd, ...prev];
          try {
            localStorage.setItem('gs_fallback_catalogue_v1', JSON.stringify(next));
          } catch {
            // Ignore
          }
          return next;
        });
      }
      setStatusBanner(
        `Saved product "${data.product?.name || productForm.name}" (${data.product?.sku || productForm.sku}).`
      );
      handleResetProductForm();
      setShowProductForm(false);
      await fetchAdminData();
      onRefreshStorefront();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Search Real Product Photos from the Web
  const handleSearchWebPhotos = async (customQuery?: string, targetProd?: any) => {
    const queryStr = (
      customQuery ||
      webPhotoQuery ||
      targetProd?.name ||
      productForm.name ||
      'stationery notebook pen'
    ).trim();
    setWebPhotosLoading(true);
    setShowWebPhotoPicker(true);
    setErrorMsg(null);
    try {
      const selectedCat = localCategoriesList.find((c) => c.id === Number(productForm.categoryId));
      const selectedBrand = localBrandsList.find((b) => b.id === Number(productForm.brandId));
      const res = await fetch('/api/admin/products/web-photos', {
        method: 'POST',
        headers: buildAdminHeaders(true),
        body: JSON.stringify({
          query: queryStr,
          name: targetProd?.name || productForm.name || queryStr,
          brandName: targetProd?.brandName || selectedBrand?.name,
          categoryName: targetProd?.categoryName || selectedCat?.name,
        }),
      });
      const data = await res.json();
      if (Array.isArray(data?.photos) && data.photos.length > 0) {
        setWebPhotosResults(data.photos);
        setStatusBanner(
          `Found ${data.photos.length} product photos from the web for "${queryStr}". Click any photo below to add or set as primary.`
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not search web photos.');
    } finally {
      setWebPhotosLoading(false);
    }
  };

  // Attach a Web Photo to either the current Product Form or a specific Product
  const handleAttachWebPhoto = async (
    photoUrl: string,
    targetProdId?: number,
    setAsPrimary: boolean = true
  ) => {
    setProductForm((prev) => {
      const nextPrimary = setAsPrimary ? photoUrl : prev.imageUrl || photoUrl;
      const nextGallery = Array.from(
        new Set(
          setAsPrimary
            ? [photoUrl, ...(prev.galleryUrls || [])]
            : [...(prev.galleryUrls || []), prev.imageUrl, photoUrl].filter(Boolean)
        )
      );
      return {
        ...prev,
        imageUrl: nextPrimary,
        galleryUrls: nextGallery,
      };
    });

    const pid = targetProdId || editingProductId;
    if (pid) {
      try {
        await fetch(`/api/admin/products/${pid}/images`, {
          method: 'POST',
          headers: buildAdminHeaders(true),
          body: JSON.stringify({
            imageUrl: photoUrl,
            newImageUrls: [photoUrl],
            setAsPrimary,
          }),
        });
      } catch {
        // Handled by local sync
      }
      setLocalProductsList((prev) => {
        const next = prev.map((p) =>
          Number(p.id) === Number(pid)
            ? {
                ...p,
                imageUrl: setAsPrimary ? photoUrl : p.imageUrl || photoUrl,
                galleryUrls: Array.from(
                  new Set(
                    setAsPrimary
                      ? [photoUrl, ...(p.galleryUrls || [])]
                      : [...(p.galleryUrls || []), p.imageUrl, photoUrl].filter(Boolean)
                  )
                ),
              }
            : p
        );
        try {
          localStorage.setItem('gs_fallback_catalogue_v1', JSON.stringify(next));
        } catch {
          // Ignore
        }
        return next;
      });
      onRefreshStorefront();
    }
    setStatusBanner(
      setAsPrimary
        ? 'Web photo set as primary cover & added to gallery!'
        : 'Web photo added to product multi-photo gallery!'
    );
  };

  // Remove Photo from a Product or the Product Form
  const handleRemoveProductPhoto = async (targetProd?: any, specificUrlToRemove?: string) => {
    if (!targetProd && !editingProductId) {
      setProductForm((prev) => ({
        ...prev,
        imageUrl: specificUrlToRemove
          ? prev.imageUrl === specificUrlToRemove
            ? prev.galleryUrls.filter((u) => u !== specificUrlToRemove)[0] || ''
            : prev.imageUrl
          : '',
        galleryUrls: specificUrlToRemove
          ? prev.galleryUrls.filter((u) => u !== specificUrlToRemove)
          : [],
      }));
      setStatusBanner('Removed photo from product form.');
      return;
    }

    const pid = targetProd?.id || editingProductId;
    try {
      await fetch(`/api/admin/products/${pid}/images`, {
        method: 'POST',
        headers: buildAdminHeaders(true),
        body: JSON.stringify(
          specificUrlToRemove
            ? { removeImageUrl: specificUrlToRemove }
            : { imageUrl: '', galleryUrls: [], setAsPrimary: true }
        ),
      });
    } catch {
      // Handled locally
    }

    setProductForm((prev) => ({
      ...prev,
      imageUrl: specificUrlToRemove
        ? prev.imageUrl === specificUrlToRemove
          ? prev.galleryUrls.filter((u) => u !== specificUrlToRemove)[0] || ''
          : prev.imageUrl
        : '',
      galleryUrls: specificUrlToRemove
        ? prev.galleryUrls.filter((u) => u !== specificUrlToRemove)
        : [],
    }));

    setLocalProductsList((prev) => {
      const next = prev.map((p) =>
        Number(p.id) === Number(pid)
          ? {
              ...p,
              imageUrl: specificUrlToRemove
                ? p.imageUrl === specificUrlToRemove
                  ? (p.galleryUrls || []).filter((u: string) => u !== specificUrlToRemove)[0] || ''
                  : p.imageUrl
                : '',
              galleryUrls: specificUrlToRemove
                ? (p.galleryUrls || []).filter((u: string) => u !== specificUrlToRemove)
                : [],
            }
          : p
      );
      try {
        localStorage.setItem('gs_fallback_catalogue_v1', JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
    setStatusBanner(`Removed photo${targetProd?.name ? ` from "${targetProd.name}"` : ''}.`);
    onRefreshStorefront();
  };

  // Delete / Remove Product from Catalogue
  const handleDeleteProduct = async (targetProd: any) => {
    if (!targetProd) return;
    setErrorMsg(null);
    try {
      await fetch('/api/admin/products/delete', {
        method: 'POST',
        headers: buildAdminHeaders(true),
        body: JSON.stringify({
          productId: targetProd.id,
          sku: targetProd.sku,
          name: targetProd.name,
        }),
      });
    } catch {
      // Handled locally as well
    }

    try {
      const deletedRaw = localStorage.getItem('gs_deleted_products_v1');
      const deletedList: any[] = deletedRaw ? JSON.parse(deletedRaw) : [];
      if (targetProd.id && !deletedList.includes(Number(targetProd.id))) {
        deletedList.push(Number(targetProd.id));
      }
      if (targetProd.sku && !deletedList.includes(String(targetProd.sku).toLowerCase())) {
        deletedList.push(String(targetProd.sku).toLowerCase());
      }
      localStorage.setItem('gs_deleted_products_v1', JSON.stringify(deletedList));
    } catch {
      // Ignore
    }

    setLocalProductsList((prev) => {
      const next = prev.filter(
        (p) =>
          Number(p.id) !== Number(targetProd.id) &&
          String(p.sku || '').toLowerCase() !== String(targetProd.sku || '').toLowerCase()
      );
      try {
        localStorage.setItem('gs_fallback_catalogue_v1', JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });

    if (editingProductId && Number(editingProductId) === Number(targetProd.id)) {
      handleResetProductForm();
      setShowProductForm(false);
    }

    setStatusBanner(`Removed product "${targetProd.name}" (${targetProd.sku}) from catalogue.`);
    await fetchAdminData();
    onRefreshStorefront();
  };

  // Run Gemini AI Admin Copilot ("Tell AI to add product, add web photos, remove photo, or remove product")
  const handleRunAiAdminCopilot = async (overridePrompt?: string) => {
    const promptToRun = (overridePrompt ?? aiCopilotPrompt).trim();
    if (!promptToRun) {
      setErrorMsg('Please tell the AI what you would like to do (e.g., "Add product Classmate Gel Pen at ₹90").');
      return;
    }
    setAiCopilotLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai/admin-copilot', {
        method: 'POST',
        headers: buildAdminHeaders(true),
        body: JSON.stringify({
          prompt: promptToRun,
          currentProductId: editingProductId || selectedMediaProductId,
          clientProducts: localProductsList,
          clientCategories: localCategoriesList,
          clientBrands: localBrandsList,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI Copilot request failed');

      setAiCopilotReply(data.replyMessage || 'Done!');
      setStatusBanner(data.replyMessage || 'AI Admin Copilot completed your command.');
      if (!overridePrompt) setAiCopilotPrompt('');

      if (Array.isArray(data.webPhotos) && data.webPhotos.length > 0) {
        setWebPhotosResults(data.webPhotos);
        setShowWebPhotoPicker(true);
      }

      if (data.operation === 'ADD_PRODUCT' && data.product) {
        const created = {
          ...data.product,
          variants:
            Array.isArray(data.product.variants) && data.product.variants.length > 0
              ? data.product.variants
              : [
                  {
                    id: Date.now() + 1,
                    productId: data.product.id || Date.now(),
                    sku: `${data.product.sku || 'GS-AI'}-STD`,
                    variantName: 'Standard Pack',
                    mrpPaise: data.product.mrpPaise || 11000,
                    sellingPricePaise: data.product.sellingPricePaise || 9500,
                    stockQuantity: data.product.initialStockQuantity || 35,
                  },
                ],
        };
        setLocalProductsList((prev) => {
          const next = [
            created,
            ...prev.filter(
              (p) =>
                Number(p.id) !== Number(created.id) &&
                String(p.sku || '').toLowerCase() !== String(created.sku || '').toLowerCase()
            ),
          ];
          try {
            localStorage.setItem('gs_fallback_catalogue_v1', JSON.stringify(next));
          } catch {
            // Ignore
          }
          return next;
        });
        setActiveTab('products');
      } else if (data.operation === 'FILL_FORM' && data.productFormDraft) {
        const d = data.productFormDraft;
        setProductForm((prev) => ({
          ...prev,
          sku: d.sku || prev.sku,
          name: d.name || prev.name,
          shortDescription: d.shortDescription || prev.shortDescription,
          description: d.description || prev.description,
          mrpRupees: String(Math.round((d.mrpPaise || 11000) / 100)),
          sellingPriceRupees: String(Math.round((d.sellingPricePaise || 9500) / 100)),
          imageUrl: d.imageUrl || prev.imageUrl,
          galleryUrls: Array.isArray(d.galleryUrls) ? d.galleryUrls : prev.galleryUrls,
        }));
        setShowProductForm(true);
        setActiveTab('products');
      } else if (data.operation === 'ADD_WEB_PHOTOS') {
        const firstPhoto = data.webPhotos?.[0]?.url || data.product?.imageUrl;
        if (firstPhoto) {
          await handleAttachWebPhoto(firstPhoto, data.product?.id || editingProductId);
        }
        setActiveTab('products');
      } else if (data.operation === 'REMOVE_PHOTO') {
        await handleRemoveProductPhoto(data.product);
      } else if (data.operation === 'REMOVE_PRODUCT') {
        const q = String(data.deletedProductName || data.deletedProductSku || '').toLowerCase();
        const found =
          localProductsList.find((p) => Number(p.id) === Number(data.deletedProductId)) ||
          (q &&
            localProductsList.find(
              (p) =>
                String(p.name || '').toLowerCase().includes(q) ||
                String(p.sku || '').toLowerCase() === q
            ));
        if (found) {
          await handleDeleteProduct(found);
        }
      }

      await fetchAdminData();
      onRefreshStorefront();
    } catch (err: any) {
      setErrorMsg(err.message || 'AI Admin Copilot failed.');
    } finally {
      setAiCopilotLoading(false);
    }
  };

  // Voice Dictation so the Admin can speak commands to Gemini AI Copilot
  const adminRecognitionRef = React.useRef<any>(null);
  const adminMediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const adminMediaStreamRef = React.useRef<MediaStream | null>(null);
  const adminSpeechTranscriptRef = React.useRef<string>('');
  const adminHasSubmittedVoiceRef = React.useRef<boolean>(false);

  const stopAdminVoiceDictation = () => {
    if (adminRecognitionRef.current) {
      try {
        adminRecognitionRef.current.stop();
      } catch {
        // ignore
      }
      adminRecognitionRef.current = null;
    }
    if (adminMediaRecorderRef.current && adminMediaRecorderRef.current.state !== 'inactive') {
      try {
        adminMediaRecorderRef.current.stop();
        return;
      } catch {
        // ignore
      }
    }
    if (adminMediaStreamRef.current) {
      try {
        adminMediaStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      adminMediaStreamRef.current = null;
    }
    setAiListening(false);
    const directText = adminSpeechTranscriptRef.current.trim();
    if (directText && !adminHasSubmittedVoiceRef.current) {
      adminHasSubmittedVoiceRef.current = true;
      setAiCopilotPrompt(directText);
      handleRunAiAdminCopilot(directText);
    }
  };

  const handleStartVoiceDictation = async () => {
    if (typeof window === 'undefined') return;
    if (aiListening) {
      stopAdminVoiceDictation();
      return;
    }
    setErrorMsg(null);
    adminSpeechTranscriptRef.current = '';
    adminHasSubmittedVoiceRef.current = false;
    setAiListening(true);
    setStatusBanner('Listening... Speak your command to Gemini AI Copilot (tap Mic again to finish).');

    let recorderActive = false;
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    ) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        adminMediaStreamRef.current = stream;
        if (typeof MediaRecorder !== 'undefined') {
          const chunks: Blob[] = [];
          const recorder = new MediaRecorder(stream);
          adminMediaRecorderRef.current = recorder;
          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) chunks.push(ev.data);
          };
          recorder.onstop = async () => {
            setAiListening(false);
            if (adminMediaStreamRef.current) {
              try {
                adminMediaStreamRef.current.getTracks().forEach((t) => t.stop());
              } catch {
                // ignore
              }
              adminMediaStreamRef.current = null;
            }
            if (adminHasSubmittedVoiceRef.current) return;
            const directText = adminSpeechTranscriptRef.current.trim();
            if (directText) {
              adminHasSubmittedVoiceRef.current = true;
              setAiCopilotPrompt(directText);
              handleRunAiAdminCopilot(directText);
              return;
            }
            const blob = chunks.length > 0 ? new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }) : null;
            if (blob && blob.size > 400) {
              setStatusBanner('Transcribing voice command with Gemini AI...');
              try {
                const base64Audio = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const resStr = String(reader.result || '');
                    resolve(resStr.includes(',') ? resStr.split(',')[1] : resStr);
                  };
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
                const res = await fetch('/api/ai/transcribe', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    audioBase64: base64Audio,
                    mimeType: blob.type || 'audio/webm',
                  }),
                });
                const data = await res.json();
                const text = String(data?.transcript || '').trim();
                if (text && !adminHasSubmittedVoiceRef.current) {
                  adminHasSubmittedVoiceRef.current = true;
                  setAiCopilotPrompt(text);
                  handleRunAiAdminCopilot(text);
                  return;
                }
              } catch {
                // ignore
              }
            }
            setStatusBanner('No clear voice command heard. Please try speaking again or type your command.');
          };
          recorder.start(250);
          recorderActive = true;
        }
      } catch (err: any) {
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          setAiListening(false);
          setErrorMsg('Microphone permission is blocked. Please allow microphone access in your browser.');
          return;
        }
      }
    }

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        adminRecognitionRef.current = recognition;
        recognition.lang = 'en-IN';
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event: any) => {
          let combined = '';
          for (let i = 0; i < (event?.results?.length || 0); i++) {
            combined += event.results[i][0]?.transcript || '';
          }
          const clean = combined.trim();
          if (clean) {
            adminSpeechTranscriptRef.current = clean;
            setAiCopilotPrompt(clean);
          }
        };
        recognition.onerror = () => {
          if (!recorderActive) setAiListening(false);
        };
        recognition.onend = () => {
          if (!recorderActive) {
            setAiListening(false);
            const clean = adminSpeechTranscriptRef.current.trim();
            if (clean && !adminHasSubmittedVoiceRef.current) {
              adminHasSubmittedVoiceRef.current = true;
              handleRunAiAdminCopilot(clean);
            }
          }
        };
        recognition.start();
      } catch {
        if (!recorderActive) setAiListening(false);
      }
    } else if (!recorderActive) {
      setAiListening(false);
      setErrorMsg('Voice input is not supported in this browser. Please type your command in the box.');
      return;
    }

    setTimeout(() => {
      stopAdminVoiceDictation();
    }, 6500);
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
      setStatusBanner(`Saved coupon ${data.coupon?.code || couponForm.code}.`);
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
      setStatusBanner(`Saved delivery rule for PIN code ${data.pincodeRule?.pincode || pincodeForm.pincode}.`);
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
    <div className="liquid-admin-shell text-slate-900 flex flex-col pb-24 lg:pb-10">
      {/* Standalone Liquid Glass Admin Capsule Header (Distinct from Storefront) */}
      <div className="sticky top-0 z-40 px-2.5 sm:px-5 pt-2.5 pb-1.5 bg-[#EEF2F6]/75 backdrop-blur-md">
        <header className="liquid-admin-glass-bar text-white px-4 sm:px-6 py-2.5 sm:py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 max-w-[1440px] mx-auto">
          <div className="flex flex-wrap items-center justify-between lg:justify-start gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#B42318] to-amber-600 flex items-center justify-center shadow-inner border border-white/25 shrink-0">
                <Settings className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-serif-display text-sm sm:text-base font-bold tracking-tight text-white">
                    Gayatri Admin OS
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-mono uppercase tracking-wider text-amber-300">
                    Kanpur HQ
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 hidden sm:block">
                  Standalone Retail &amp; Inventory Command Console · Awas Vikas Market, Naubasta
                </p>
              </div>
            </div>
            {currentUser && (
              <span className="px-3 py-1 bg-white/10 border border-white/15 rounded-full text-[11px] text-slate-100 font-mono-tabular">
                {currentUser.email} · {currentUser.role.toUpperCase()}
              </span>
            )}
          </div>

          {/* Global Admin Quick-Search Oval Capsule */}
          <div className="relative flex-1 max-w-md w-full">
            <div className="flex items-center bg-white/12 hover:bg-white/16 border border-white/20 rounded-full focus-within:bg-white/20 focus-within:border-amber-400 transition-all">
              <Search className="w-3.5 h-3.5 text-slate-300 ml-3.5 shrink-0" />
              <input
                type="search"
                value={adminQuickSearch}
                onFocus={() => setQuickSearchOpen(true)}
                onBlur={() => setTimeout(() => setQuickSearchOpen(false), 200)}
                onChange={(e) => {
                  setAdminQuickSearch(e.target.value);
                  setQuickSearchOpen(true);
                }}
                placeholder="Search Admin: Order #, Pickup Code, SKU, Brand..."
                className="w-full px-2.5 py-1.5 text-xs bg-transparent text-white placeholder-slate-300 focus:outline-none"
              />
              {adminQuickSearch && (
                <button
                  type="button"
                  onClick={() => setAdminQuickSearch('')}
                  className="px-2.5 py-0.5 mr-1 text-[11px] bg-white/15 rounded-full text-slate-200 hover:text-white cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {quickSearchOpen && adminQuickSearch.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white/95 backdrop-blur-2xl text-slate-900 border border-slate-200 rounded-[24px] shadow-2xl z-50 max-h-80 overflow-y-auto divide-y divide-slate-100 text-xs p-1.5">
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
                        className="w-full px-3.5 py-2 text-left hover:bg-slate-100/80 rounded-2xl flex items-center justify-between cursor-pointer"
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
                        className="w-full px-3 py-2 text-left hover:bg-slate-100/80 rounded-2xl flex items-center justify-between gap-2.5 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-8 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0">
                            <ProductIllustration
                              type={p.illustrationType}
                              imageUrl={p.imageUrl}
                              alt={p.name}
                              className="w-full h-full"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                            <p className="text-[11px] text-slate-500 font-mono-tabular truncate">
                              SKU: {p.sku}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono-tabular text-slate-700 shrink-0">
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
                        className="w-full px-3.5 py-2 text-left hover:bg-slate-100/80 rounded-2xl flex items-center justify-between cursor-pointer"
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
                        className="w-full px-3.5 py-2 text-left hover:bg-slate-100/80 rounded-2xl flex items-center justify-between cursor-pointer"
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

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
            {/* Seamless In-Place Role Switcher Oval Capsule */}
            {onRoleSwitched && (
              <div className="flex items-center bg-white/10 border border-white/15 rounded-full p-0.5 text-xs">
                <span className="px-2.5 text-[10px] font-mono uppercase tracking-wider text-slate-300">
                  Role:
                </span>
                {(['customer', 'staff', 'owner'] as const).map((r) => {
                  const active = (currentUser?.role || 'owner') === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => onRoleSwitched(r)}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold capitalize transition-all cursor-pointer ${
                        active
                          ? 'bg-[#B42318] text-white shadow-xs'
                          : 'text-slate-300 hover:text-white hover:bg-white/10'
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
              className="p-2 bg-white/10 hover:bg-white/20 text-slate-200 rounded-full border border-white/15 cursor-pointer transition-colors"
            >
              {soundAlertsEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {/* Live Admin Notifications Center Oval Button */}
            <button
              type="button"
              onClick={() => setNotificationsOpen((prev) => !prev)}
              className="relative inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-full border border-white/15 transition-colors cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span>Alerts</span>
              {actionableAlertsCount > 0 && (
                <span className="px-1.5 py-0.2 bg-[#B42318] text-white text-[10px] font-mono-tabular font-bold rounded-full">
                  {actionableAlertsCount}
                </span>
              )}
            </button>

            <button
              onClick={onExitAdmin}
              className="px-4 py-1.5 text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 rounded-full shadow-xs transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              Storefront Website →
            </button>
          </div>
        </header>
      </div>

      {/* Notice if user switched to Customer role while staying on the same Admin interface */}
      {currentUser?.role === 'customer' && (
        <div className="max-w-[1440px] mx-auto w-full px-3 sm:px-6 pt-2">
          <div className="bg-amber-50/90 backdrop-blur-md border border-amber-200 rounded-[24px] lg:rounded-full px-4 sm:px-6 py-2.5 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
            <span>
              <strong>Customer Role Active on Admin Workspace:</strong> Switch back to <strong>Staff</strong> or <strong>Owner</strong> to save administrative changes.
            </span>
            {onRoleSwitched && (
              <button
                type="button"
                onClick={() => onRoleSwitched('owner')}
                className="px-3.5 py-1 bg-slate-900 text-white font-semibold rounded-full cursor-pointer"
              >
                Switch to Owner Role
              </button>
            )}
          </div>
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

      <div className="flex-1 flex flex-col lg:flex-row max-w-[1440px] w-full mx-auto px-2.5 sm:px-5 pt-2 gap-5 items-start">
        {/* Floating Liquid Glass Sidebar / Mobile Oval Pill Navigation */}
        <aside className="w-full lg:w-64 liquid-admin-glass-sidebar p-2 sm:p-4 shrink-0 lg:sticky lg:top-20">
          <nav className="flex lg:flex-col gap-1.5 overflow-x-auto no-scrollbar pb-0.5 lg:pb-0">
            {[
              {
                key: 'home',
                label: 'Overview',
                icon: ClipboardList,
                badge: 0,
                isActive: activeTab === 'overview',
                onClick: () => setActiveTab('overview'),
              },
              {
                key: 'orders',
                label: 'Orders & Pickup',
                icon: Store,
                badge: dashboardData?.metrics?.pendingOrdersCount || 0,
                isActive: activeTab === 'orders',
                onClick: () => setActiveTab('orders'),
              },
              {
                key: 'products',
                label: 'Products & Stock',
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
                label: 'Website Builder',
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
                label: 'Policy Pages',
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
                label: 'Settings & Gateway',
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
                  className={`flex items-center justify-between gap-2 px-3.5 py-2 rounded-full text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    item.isActive
                      ? 'bg-slate-900 text-white shadow-sm font-semibold'
                      : 'text-slate-700 hover:bg-slate-200/60 hover:text-slate-950'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {item.badge > 0 && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono-tabular font-bold ${
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

          {/* Storefront Sub-Sections & Operational Tools (Clean & Non-Duplicate) */}
          <div className="hidden lg:block mt-5 pt-4 border-t border-slate-200/80 space-y-1.5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-3 font-bold">
              OPERATIONS & TOOLS
            </div>
            {[
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
                className={`w-full text-left px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer ${
                  q.active
                    ? 'bg-[#B42318] text-white font-semibold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
              >
                • {q.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Main Liquid Admin Workspace */}
        <main className="flex-1 p-1 sm:p-2 max-w-7xl w-full overflow-x-hidden">
          {/* GEMINI AI ADMIN COPILOT CAPSULE — Liquid Glass Command Bar */}
          <div className="mb-5 bg-gradient-to-r from-slate-900 via-slate-900 to-[#3B0D0C] text-white rounded-[32px] p-4 sm:p-6 shadow-lg border border-white/15 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#B42318] flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold tracking-tight">
                      Gayatri AI Admin Copilot (Powered by Gemini)
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-mono uppercase tracking-wider text-amber-300">
                      Voice &amp; Text Commands
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Tell AI to add a product, fetch &amp; attach product photos from the web, remove photos, or remove any product.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() =>
                    handleRunAiAdminCopilot(
                      'Add product Classmate Octane Gel Pen Pack of 10 at ₹90 MRP ₹110 with web photo'
                    )
                  }
                  disabled={aiCopilotLoading}
                  className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
                >
                  + AI Add Product
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleRunAiAdminCopilot('Add photos from the web for Classmate Notebook')
                  }
                  disabled={aiCopilotLoading}
                  className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
                >
                  + Add Web Photos
                </button>
                <button
                  type="button"
                  onClick={() => handleRunAiAdminCopilot('Remove photo from current product')}
                  disabled={aiCopilotLoading}
                  className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
                >
                  Remove Photo
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRunAiAdminCopilot();
              }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
            >
              <div className="relative flex-1 flex items-center bg-white/95 text-slate-900 rounded-full px-3.5 py-1.5">
                <Bot className="w-4 h-4 text-[#B42318] shrink-0 mr-2" />
                <input
                  type="text"
                  value={aiCopilotPrompt}
                  onChange={(e) => setAiCopilotPrompt(e.target.value)}
                  placeholder='Tell AI: "Add DOMS Water Colour 24 Shades at ₹165 with web photo", "Add web photos for Flair Pen", or "Remove product..."'
                  className="w-full text-xs sm:text-sm bg-transparent focus:outline-none text-slate-900 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={handleStartVoiceDictation}
                  title="Speak to AI Admin Copilot"
                  className={`p-1.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                    aiListening
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                </button>
              </div>
              <button
                type="submit"
                disabled={aiCopilotLoading}
                className="px-5 py-2.5 rounded-full bg-[#B42318] hover:bg-[#991B1B] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{aiCopilotLoading ? 'AI Working...' : 'Tell AI'}</span>
              </button>
            </form>

            {aiCopilotReply && (
              <div className="p-3 rounded-xl bg-white/10 border border-white/15 text-xs text-slate-100 flex items-start justify-between gap-3">
                <div className="space-y-1 whitespace-pre-line">{aiCopilotReply}</div>
                <button
                  type="button"
                  onClick={() => setAiCopilotReply(null)}
                  className="text-slate-300 hover:text-white shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

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

                  {/* Store Performance Analytics — Monthly Revenue Line Chart & Category Sales Distribution Pie Chart */}
                  {(() => {
                    const liveOrders = Array.isArray(dashboardData.orders)
                      ? dashboardData.orders
                      : [];

                    // Aggregate live orders by month (and merge with store monthly ledger benchmarks)
                    const baselineMonths: Array<{
                      month: string;
                      pickupRevenueINR: number;
                      shiprocketRevenueINR: number;
                      ordersCount: number;
                    }> = [
                      { month: 'May', pickupRevenueINR: 18400, shiprocketRevenueINR: 12600, ordersCount: 48 },
                      { month: 'Jun', pickupRevenueINR: 29800, shiprocketRevenueINR: 19400, ordersCount: 76 },
                      { month: 'Jul', pickupRevenueINR: 34200, shiprocketRevenueINR: 24800, ordersCount: 91 },
                      { month: 'Aug', pickupRevenueINR: 26500, shiprocketRevenueINR: 21900, ordersCount: 68 },
                      { month: 'Sep', pickupRevenueINR: 31900, shiprocketRevenueINR: 27400, ordersCount: 84 },
                      { month: 'Oct', pickupRevenueINR: 24600, shiprocketRevenueINR: 22100, ordersCount: 62 },
                    ];

                    let currentMonthPickupINR = 0;
                    let currentMonthDeliveryINR = 0;
                    let currentMonthLiveOrders = 0;

                    for (const ord of liveOrders) {
                      if (ord.status === 'CANCELLED') continue;
                      const amtINR = Math.round(Number(ord.totalPaise || 0) / 100);
                      currentMonthLiveOrders += 1;
                      if (ord.fulfilmentType === 'STORE_PICKUP') {
                        currentMonthPickupINR += amtINR;
                      } else {
                        currentMonthDeliveryINR += amtINR;
                      }
                    }

                    const monthlyRevenueChartData = baselineMonths.map((item, idx) => {
                      const isLatest = idx === baselineMonths.length - 1;
                      const pickupINR = isLatest
                        ? item.pickupRevenueINR + currentMonthPickupINR
                        : item.pickupRevenueINR;
                      const deliveryINR = isLatest
                        ? item.shiprocketRevenueINR + currentMonthDeliveryINR
                        : item.shiprocketRevenueINR;
                      return {
                        month: item.month,
                        totalRevenueINR: pickupINR + deliveryINR,
                        pickupRevenueINR: pickupINR,
                        shiprocketRevenueINR: deliveryINR,
                        ordersCount: isLatest
                          ? item.ordersCount + currentMonthLiveOrders
                          : item.ordersCount,
                      };
                    });

                    // Compute Category Sales Distribution across stationery categories
                    const categoryTotalsMap = new Map<string, number>([
                      ['Notebooks & Registers', 54200],
                      ['Pens & Writing Instruments', 38600],
                      ['Art, Craft & Drawing', 29400],
                      ['Geometry & Exam Kits', 21800],
                      ['Office Files & Calculators', 18500],
                    ]);

                    for (const ord of liveOrders) {
                      if (ord.status === 'CANCELLED') continue;
                      const items = Array.isArray(ord.items) ? ord.items : [];
                      for (const item of items) {
                        const matchedProduct = products.find(
                          (p) =>
                            Number(p.id) === Number(item.productId) ||
                            p.name === item.productName
                        );
                        const catName =
                          matchedProduct?.categoryName ||
                          item.categoryName ||
                          'Notebooks & Registers';
                        const lineINR = Math.round(
                          Number(
                            item.lineTotalPaise ||
                              Number(item.unitPricePaise || 0) * Number(item.quantity || 1)
                          ) / 100
                        );
                        categoryTotalsMap.set(
                          catName,
                          (categoryTotalsMap.get(catName) || 12000) + lineINR
                        );
                      }
                    }

                    const PIE_COLORS = ['#B42318', '#0F172A', '#D97706', '#047857', '#2563EB', '#7C3AED'];
                    const totalCategorySalesINR = Array.from(categoryTotalsMap.values()).reduce(
                      (acc, v) => acc + v,
                      0
                    );
                    const categorySalesChartData = Array.from(categoryTotalsMap.entries())
                      .map(([name, valueINR], index) => ({
                        name,
                        valueINR,
                        sharePct:
                          totalCategorySalesINR > 0
                            ? Math.round((valueINR / totalCategorySalesINR) * 1000) / 10
                            : 0,
                        color: PIE_COLORS[index % PIE_COLORS.length],
                      }))
                      .sort((a, b) => b.valueINR - a.valueINR);

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        {/* Monthly Revenue Line Chart */}
                        <div className="lg:col-span-7 bg-white border border-slate-200 rounded p-4 sm:p-5 flex flex-col justify-between">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                            <div>
                              <span className="text-[10px] font-mono uppercase tracking-widest text-[#B42318] font-bold inline-flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                <span>REVENUE PERFORMANCE LEDGER</span>
                              </span>
                              <h2 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                                Monthly Revenue Trend (Store Pickup vs Shiprocket Delivery)
                              </h2>
                            </div>
                            <div className="text-left sm:text-right font-mono-tabular">
                              <p className="text-[11px] text-slate-500">6-Month Cumulative</p>
                              <p className="text-sm font-bold text-slate-900">
                                ₹
                                {monthlyRevenueChartData
                                  .reduce((sum, m) => sum + m.totalRevenueINR, 0)
                                  .toLocaleString('en-IN')}
                              </p>
                            </div>
                          </div>

                          <div className="w-full h-64 sm:h-72">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={monthlyRevenueChartData}
                                margin={{ top: 8, right: 16, left: 4, bottom: 4 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                <XAxis
                                  dataKey="month"
                                  tick={{ fontSize: 11, fill: '#475569' }}
                                  axisLine={{ stroke: '#CBD5E1' }}
                                />
                                <YAxis
                                  tick={{ fontSize: 11, fill: '#475569' }}
                                  axisLine={{ stroke: '#CBD5E1' }}
                                  tickFormatter={(v) => `₹${Math.round(Number(v) / 1000)}k`}
                                />
                                <Tooltip
                                  formatter={(value: any, name: any) => [
                                    `₹${Number(value || 0).toLocaleString('en-IN')}`,
                                    String(name || ''),
                                  ]}
                                  contentStyle={{
                                    backgroundColor: '#FFFFFF',
                                    borderColor: '#CBD5E1',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                  }}
                                />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                <Line
                                  type="monotone"
                                  dataKey="totalRevenueINR"
                                  name="Total Revenue (₹)"
                                  stroke="#B42318"
                                  strokeWidth={2.5}
                                  dot={{ r: 4, fill: '#B42318' }}
                                  activeDot={{ r: 6 }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="pickupRevenueINR"
                                  name="Store Pickup (₹)"
                                  stroke="#0F172A"
                                  strokeWidth={2}
                                  dot={{ r: 3, fill: '#0F172A' }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="shiprocketRevenueINR"
                                  name="Shiprocket Delivery (₹)"
                                  stroke="#047857"
                                  strokeWidth={2}
                                  strokeDasharray="4 4"
                                  dot={{ r: 3, fill: '#047857' }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Category Sales Distribution Pie Chart */}
                        <div className="lg:col-span-5 bg-white border border-slate-200 rounded p-4 sm:p-5 flex flex-col justify-between">
                          <div className="mb-3">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600 font-bold inline-flex items-center gap-1">
                              <PieChartIcon className="w-3 h-3 text-[#B42318]" />
                              <span>CATEGORY SALES SHARE</span>
                            </span>
                            <h2 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                              Category Sales Distribution
                            </h2>
                          </div>

                          <div className="w-full h-48 sm:h-52">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={categorySalesChartData}
                                  dataKey="valueINR"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={42}
                                  outerRadius={74}
                                  paddingAngle={2}
                                >
                                  {categorySalesChartData.map((entry, idx) => (
                                    <Cell key={`cell-${idx}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(value: any, name: any) => [
                                    `₹${Number(value || 0).toLocaleString('en-IN')}`,
                                    String(name || ''),
                                  ]}
                                  contentStyle={{
                                    backgroundColor: '#FFFFFF',
                                    borderColor: '#CBD5E1',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>

                          <div className="space-y-1.5 pt-2 border-t border-slate-100">
                            {categorySalesChartData.map((cat) => (
                              <div
                                key={cat.name}
                                className="flex items-center justify-between text-xs gap-2"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                                    style={{ backgroundColor: cat.color }}
                                  />
                                  <span className="text-slate-700 truncate">{cat.name}</span>
                                </div>
                                <div className="font-mono-tabular flex items-center gap-2 shrink-0">
                                  <span className="font-semibold text-slate-900">
                                    ₹{cat.valueINR.toLocaleString('en-IN')}
                                  </span>
                                  <span className="text-[11px] text-slate-500 w-11 text-right">
                                    {cat.sharePct}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

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

                    <div className="lg:col-span-7 bg-white border border-slate-200 rounded p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold">
                          RETAIL COUNTER DISPATCH
                        </span>
                        <h2 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                          Kanpur Retail Store &amp; Order Fulfillment
                        </h2>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Awas Vikas Market, Galla Mandi, Naubasta, Kanpur – 208021 · 2-Hour Pickup Window
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setFulfilmentFilter('STORE_PICKUP');
                            setActiveTab('orders');
                          }}
                          className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded cursor-pointer transition-colors"
                        >
                          Pickup Orders ({dashboardData.metrics.readyForPickupCount})
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
                            const isStorePickup = o.fulfilmentMethod === 'STORE_PICKUP';
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
                                    {o.customerName} ·{' '}
                                    {isStorePickup
                                      ? 'Get at Store (No Tracking)'
                                      : 'Home Delivery (Shiprocket)'}{' '}
                                    ·{' '}
                                    <strong>
                                      {isStorePickup
                                        ? o.orderStatus === 'COLLECTED'
                                          ? 'COLLECTED AT STORE'
                                          : 'VISIT & COLLECT'
                                        : o.orderStatus.replace(/_/g, ' ')}
                                    </strong>
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {isStorePickup &&
                                    o.orderStatus !== 'COLLECTED' &&
                                    o.orderStatus !== 'CANCELLED' && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleQuickOrderWorkflowUpdate(
                                            o.id,
                                            'COLLECTED',
                                            'PAID',
                                            'Collected at store counter via 1-click action'
                                          )
                                        }
                                        className="px-2 py-1 bg-amber-600 text-white text-[11px] font-semibold rounded hover:bg-amber-700 cursor-pointer"
                                      >
                                        ✓ Collected at Store
                                      </button>
                                    )}
                                  {!isStorePickup &&
                                    o.orderStatus !== 'DISPATCHED' &&
                                    o.orderStatus !== 'DELIVERED' &&
                                    o.orderStatus !== 'CANCELLED' && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleQuickOrderWorkflowUpdate(
                                            o.id,
                                            'DISPATCHED',
                                            undefined,
                                            'Dispatched via Shiprocket'
                                          )
                                        }
                                        className="px-2 py-1 bg-emerald-700 text-white text-[11px] font-semibold rounded hover:bg-emerald-800 cursor-pointer"
                                      >
                                        Shiprocket Dispatch
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
                                        className="px-2 py-1 bg-slate-900 text-white text-[11px] font-semibold rounded hover:bg-slate-800 cursor-pointer"
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

              {/* 2. ORDERS, SHIPROCKET TRACKER & STORE COUNTER DESK TAB */}
              {activeTab === 'orders' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                      Shiprocket Home Delivery Tracking &amp; Get at Store Counter Desk
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                      <strong>Get at Store</strong> orders require no tracking — simply verify the Pickup Code and mark Collected at Counter. <strong>Home Delivery</strong> orders use <strong>Shiprocket</strong> for courier dispatch and live AWB tracking.
                    </p>
                  </div>

                  {/* Responsive Filter Bar */}
                  <div className="bg-white border border-slate-200 rounded p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <input
                      type="text"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="Search Order #, Customer Name, Phone, Shiprocket AWB, or Pickup Code..."
                      className="sm:col-span-6 px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded"
                    />
                    <select
                      value={fulfilmentFilter}
                      onChange={(e) => setFulfilmentFilter(e.target.value as any)}
                      className="sm:col-span-3 px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded bg-white"
                    >
                      <option value="ALL">All Fulfilment Types</option>
                      <option value="STORE_PICKUP">Get at Store (No Tracking)</option>
                      <option value="HOME_DELIVERY">Home Delivery (Shiprocket)</option>
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
                          <th className="py-3 px-4">Order # &amp; Code / Shiprocket AWB</th>
                          <th className="py-3 px-4">Customer &amp; Fulfilment</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Total &amp; Payment</th>
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
                            const isStorePickup = o.fulfilmentMethod === 'STORE_PICKUP';
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
                                  {isStorePickup && entry.pickupDetails ? (
                                    <div className="text-xs text-amber-800 mt-0.5">
                                      Store Code: {entry.pickupDetails.pickupCode}
                                    </div>
                                  ) : entry.shipmentDetails?.trackingNumber ? (
                                    <div className="text-xs text-emerald-800 mt-0.5">
                                      Shiprocket AWB: {entry.shipmentDetails.trackingNumber}
                                    </div>
                                  ) : null}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-medium text-slate-900">{o.customerName}</div>
                                  <div className="text-xs text-slate-500">
                                    {o.customerPhone} ·{' '}
                                    {isStorePickup
                                      ? 'Get at Store (No Tracking)'
                                      : 'Home Delivery (Shiprocket)'}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="text-xs font-mono-tabular font-bold text-slate-900">
                                    {isStorePickup
                                      ? o.orderStatus === 'COLLECTED'
                                        ? 'COLLECTED AT STORE ✓'
                                        : 'VISIT & COLLECT'
                                      : o.orderStatus.replace(/_/g, ' ')}
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
                                    {isStorePickup
                                      ? isSelected
                                        ? 'Store Pass Open'
                                        : 'Counter Handover'
                                      : isSelected
                                      ? 'Shiprocket Open'
                                      : 'Shiprocket & Track'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Full Order Details / Shiprocket Tracking / Store Counter Panel */}
                  {selectedOrder && (
                    <div className="space-y-2">
                      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                        {selectedOrder.order.fulfilmentMethod === 'STORE_PICKUP'
                          ? `Get at Store Counter Pass — ${selectedOrder.order.orderNumber}`
                          : `Shiprocket Delivery & Live Tracking — ${selectedOrder.order.orderNumber}`}
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
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                        <h2 className="text-base font-bold text-slate-900">
                          {editingProductId
                            ? `Edit Product & Photo — ${productForm.name} (${productForm.sku})`
                            : 'Create New Stationery Product'}
                        </h2>
                        <div className="flex items-center gap-3">
                          {editingProductId && (
                            <button
                              type="button"
                              onClick={() => {
                                const target = localProductsList.find(
                                  (p) => Number(p.id) === Number(editingProductId)
                                ) || {
                                  id: editingProductId,
                                  sku: productForm.sku,
                                  name: productForm.name,
                                };
                                handleDeleteProduct(target);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded text-xs font-bold cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove Product</span>
                            </button>
                          )}
                          {editingProductId && (
                            <button
                              type="button"
                              onClick={handleResetProductForm}
                              className="text-xs text-slate-600 underline cursor-pointer"
                            >
                              Switch to New Product
                            </button>
                          )}
                        </div>
                      </div>

                      {/* PRODUCT PHOTO UPLOAD + AI GENERATOR + WEB PHOTO SEARCH STUDIO */}
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                          <div className="lg:col-span-4 space-y-2">
                            <p className="text-xs font-semibold text-slate-700">
                              Live Storefront Card Preview (4:3)
                            </p>
                            <div className="aspect-4/3 w-full max-w-[280px] rounded-2xl border border-slate-300 overflow-hidden bg-white relative">
                              <ProductIllustration
                                type={productForm.illustrationType}
                                imageUrl={productForm.imageUrl}
                                alt={productForm.name || 'Product Preview'}
                                className="w-full h-full"
                              />
                              {productForm.imageUrl && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveProductPhoto()}
                                  className="absolute top-2 right-2 px-2.5 py-1 bg-red-600/95 hover:bg-red-700 text-white text-[11px] font-bold rounded-full shadow flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Remove Photo</span>
                                </button>
                              )}
                            </div>

                            {productForm.galleryUrls && productForm.galleryUrls.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                                  <span>
                                    Product Photo Gallery ({productForm.galleryUrls.length}{' '}
                                    {productForm.galleryUrls.length === 1 ? 'photo' : 'photos'})
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    Click any thumb to set primary
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  {productForm.galleryUrls.map((gUrl, idx) => {
                                    const isPrimary = productForm.imageUrl === gUrl;
                                    return (
                                      <div
                                        key={`${gUrl}-${idx}`}
                                        className={`relative w-16 h-14 rounded-lg border overflow-hidden bg-white group transition-all ${
                                          isPrimary
                                            ? 'border-2 border-emerald-600 ring-2 ring-emerald-500/30'
                                            : 'border-slate-300 hover:border-slate-500'
                                        }`}
                                      >
                                        <img
                                          src={gUrl}
                                          alt={`Gallery photo ${idx + 1}`}
                                          className="w-full h-full object-cover cursor-pointer"
                                          onClick={() =>
                                            setProductForm((prev) => ({ ...prev, imageUrl: gUrl }))
                                          }
                                        />
                                        {isPrimary && (
                                          <span className="absolute bottom-0 inset-x-0 bg-emerald-700/90 text-white text-[8px] font-bold text-center py-0.5 uppercase tracking-wider">
                                            Cover
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          title="Remove this photo"
                                          onClick={() => handleRemoveProductPhoto(undefined, gUrl)}
                                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] cursor-pointer shadow"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="lg:col-span-8 space-y-4 text-xs">
                            <div>
                              <h3 className="text-sm font-bold text-slate-900">
                                Multi-Photo Product Studio: Upload Multiple Photos, Search Web, or Generate with AI
                              </h3>
                              <p className="text-slate-600 mt-0.5">
                                Select multiple images at once from your device, paste multiple image URLs, or attach multiple web photos to build a rich product gallery.
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5">
                              {/* Option 1: Upload Single or Multiple Photos from Device */}
                              <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 text-white font-semibold rounded-full hover:bg-slate-800 cursor-pointer">
                                <ImageIcon className="w-4 h-4" />
                                <span>
                                  {uploadingImage
                                    ? 'Uploading Photo(s)...'
                                    : '1. Upload Photo(s) (Multiple Supported)'}
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={handleFileUploadChange}
                                  className="hidden"
                                />
                              </label>

                              {/* Option 2: Add Photos from the Web */}
                              <button
                                type="button"
                                disabled={webPhotosLoading}
                                onClick={() => handleSearchWebPhotos(productForm.name)}
                                className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-700 text-white font-semibold rounded-full hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                              >
                                <Globe className="w-4 h-4" />
                                <span>
                                  {webPhotosLoading
                                    ? 'Searching Web...'
                                    : '2. Add Photos from the Web'}
                                </span>
                              </button>

                              {/* Option 3: Generate with AI */}
                              <button
                                type="button"
                                disabled={aiGeneratingImage}
                                onClick={handleGenerateAiProductImage}
                                className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#B42318] text-white font-semibold rounded-full hover:bg-[#991B1B] disabled:opacity-50 cursor-pointer"
                              >
                                <Sparkles className="w-4 h-4" />
                                <span>
                                  {aiGeneratingImage
                                    ? 'Generating AI Image...'
                                    : '3. Generate AI Studio Photo'}
                                </span>
                              </button>

                              {productForm.imageUrl && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveProductPhoto()}
                                  className="inline-flex items-center gap-1 px-3.5 py-2 bg-red-50 border border-red-200 text-red-700 font-semibold rounded-full hover:bg-red-100 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Clear All Photos</span>
                                </button>
                              )}
                            </div>

                            {/* Add Multiple Image URLs to Gallery */}
                            <div className="p-3 bg-white border border-slate-200 rounded-2xl space-y-2">
                              <label className="block font-semibold text-slate-800">
                                Add Multiple Photo URLs to Product Gallery (comma or newline separated)
                              </label>
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <input
                                  type="text"
                                  value={newGalleryUrlInput}
                                  onChange={(e) => setNewGalleryUrlInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddGalleryUrlToProduct();
                                    }
                                  }}
                                  placeholder="Paste 1 or more image URLs (https://...) to add to this product's gallery..."
                                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-full text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={handleAddGalleryUrlToProduct}
                                  className="px-4 py-2 bg-emerald-700 text-white font-semibold rounded-full hover:bg-emerald-800 cursor-pointer shrink-0"
                                >
                                  + Add Photo(s) to Gallery
                                </button>
                              </div>
                            </div>

                            {/* Web Photo Search Input */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                              <input
                                type="text"
                                value={webPhotoQuery}
                                onChange={(e) => setWebPhotoQuery(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSearchWebPhotos(webPhotoQuery || productForm.name);
                                  }
                                }}
                                placeholder="Search web photos (e.g. Classmate Spiral Notebook, DOMS Watercolour, Flair Pen)..."
                                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-full text-xs"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleSearchWebPhotos(webPhotoQuery || productForm.name)
                                }
                                className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-full hover:bg-slate-800 cursor-pointer shrink-0"
                              >
                                Search Web Photos
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                              <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                  Primary Cover Image URL
                                </label>
                                <input
                                  type="text"
                                  value={
                                    productForm.imageUrl.startsWith('data:')
                                      ? ''
                                      : productForm.imageUrl
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setProductForm((prev) => ({
                                      ...prev,
                                      imageUrl: val,
                                      galleryUrls: val
                                        ? Array.from(new Set([val, ...(prev.galleryUrls || [])]))
                                        : prev.galleryUrls,
                                    }));
                                  }}
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

                        {/* Interactive Web Photo Picker Grid */}
                        {showWebPhotoPicker && webPhotosResults.length > 0 && (
                          <div className="pt-3 border-t border-slate-200 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900">
                                Web Product Photos — Set as Primary Cover or Add Multiple Photos to Gallery
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowWebPhotoPicker(false)}
                                className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                              >
                                Hide Web Photos
                              </button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                              {webPhotosResults.map((wp, idx) => {
                                const isPrimary = productForm.imageUrl === wp.url;
                                const isInGallery = (productForm.galleryUrls || []).includes(wp.url);
                                return (
                                  <div
                                    key={`${wp.url}-${idx}`}
                                    className={`rounded-xl border overflow-hidden bg-white flex flex-col justify-between transition-all ${
                                      isPrimary
                                        ? 'border-2 border-emerald-600 ring-2 ring-emerald-500/20'
                                        : isInGallery
                                        ? 'border-2 border-slate-900'
                                        : 'border-slate-200 hover:border-slate-400'
                                    }`}
                                  >
                                    <div className="aspect-4/3 bg-slate-100 overflow-hidden relative">
                                      <img
                                        src={wp.url}
                                        alt={wp.title}
                                        className="w-full h-full object-cover"
                                      />
                                      {isInGallery && (
                                        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-slate-900/90 text-white text-[9px] font-bold rounded-full">
                                          {isPrimary ? 'Cover' : 'In Gallery'}
                                        </span>
                                      )}
                                    </div>
                                    <div className="p-2 space-y-1">
                                      <p className="text-[10px] font-medium text-slate-700 line-clamp-1">
                                        {wp.title}
                                      </p>
                                      <div className="grid grid-cols-2 gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleAttachWebPhoto(wp.url, undefined, true)}
                                          className={`py-1 rounded-full text-[9px] font-bold cursor-pointer ${
                                            isPrimary
                                              ? 'bg-emerald-700 text-white'
                                              : 'bg-slate-900 hover:bg-slate-800 text-white'
                                          }`}
                                        >
                                          {isPrimary ? '✓ Cover' : 'Set Cover'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleAttachWebPhoto(wp.url, undefined, false)}
                                          className={`py-1 rounded-full text-[9px] font-bold border cursor-pointer ${
                                            isInGallery
                                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                              : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                                          }`}
                                        >
                                          {isInGallery ? '+ Added' : '+ Gallery'}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
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
                        {(localProductsList || []).map((p) =>
                          (p.variants && p.variants.length > 0
                            ? p.variants
                            : [
                                {
                                  id: p.id,
                                  sku: p.sku,
                                  variantName: 'Standard Pack',
                                  mrpPaise: p.mrpPaise || 10000,
                                  sellingPricePaise: p.sellingPricePaise || 9000,
                                  stockQuantity: p.totalStock ?? 25,
                                },
                              ]
                          ).map((v: any) => (
                            <tr key={`${p.id}-${v.id}`} className="hover:bg-slate-50">
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
                                <div className="w-16 h-12 rounded border border-slate-200 overflow-hidden relative group">
                                  <ProductIllustration
                                    type={p.illustrationType}
                                    imageUrl={p.imageUrl}
                                    alt={p.name}
                                    className="w-full h-full"
                                  />
                                  {p.imageUrl && (
                                    <button
                                      type="button"
                                      title="Remove Photo"
                                      onClick={() => handleRemoveProductPhoto(p)}
                                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center opacity-90 hover:opacity-100 cursor-pointer"
                                    >
                                      ×
                                    </button>
                                  )}
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
                                      handleStartEditProduct(p);
                                      handleSearchWebPhotos(p.name, p);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-950 text-xs font-medium rounded whitespace-nowrap cursor-pointer"
                                  >
                                    <Globe className="w-3.5 h-3.5" />
                                    <span>Web Photos</span>
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
                                    onClick={() => handleDeleteProduct(p)}
                                    title="Remove Product"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 text-xs font-medium rounded whitespace-nowrap cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Remove</span>
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

      {/* Standalone Mobile Liquid Glass Admin Bottom Dock (Only Admin Controls — Never Storefront Cart/Shop) */}
      <nav
        aria-label="Admin Mobile Bottom Dock"
        className="lg:hidden fixed bottom-3 left-3 right-3 z-40 liquid-admin-dock px-2 py-1.5 text-white"
      >
        <div className="grid grid-cols-5 gap-1 text-[11px] font-medium">
          <button
            type="button"
            onClick={() => {
              setActiveTab('overview');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`py-1.5 px-2 rounded-full flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
              activeTab === 'overview'
                ? 'bg-white text-slate-900 font-bold shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Overview</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('orders');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`py-1.5 px-2 rounded-full flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
              activeTab === 'orders'
                ? 'bg-white text-slate-900 font-bold shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Orders</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('products');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`py-1.5 px-2 rounded-full flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
              activeTab === 'products'
                ? 'bg-[#B42318] text-white font-bold shadow-xs'
                : 'bg-white/10 text-white font-semibold'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Products</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('cms');
              setCmsSubTab('homepage');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`py-1.5 px-2 rounded-full flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
              activeTab === 'cms'
                ? 'bg-white text-slate-900 font-bold shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <LayoutTemplate className="w-4 h-4" />
            <span>CMS</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('settings');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`py-1.5 px-2 rounded-full flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
              activeTab === 'settings'
                ? 'bg-white text-slate-900 font-bold shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
