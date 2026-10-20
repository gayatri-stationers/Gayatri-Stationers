import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase.ts';
import {
  formatPaiseToINR,
  FulfilmentMethod,
  PaymentMethod,
} from './lib/domain-logic.ts';
import { ProductIllustration } from './components/ProductIllustration.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { OrderTrackingTimeline } from './components/OrderTrackingTimeline.tsx';
import {
  Search,
  ShoppingBag,
  Heart,
  Store,
  Truck,
  Check,
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  User,
  LogOut,
  FileSpreadsheet,
  SlidersHorizontal,
  Package,
  X,
  Menu,
  ChevronRight,
  Sparkles,
  Tag,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

interface LocalCartItem {
  productId: number;
  variantId: number;
  quantity: number;
}

interface FlyingCartItem {
  id: string;
  name: string;
  priceFormatted: string;
  illustrationType: string;
  imageUrl?: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export default function App() {
  // Navigation view state (recognizes private /admin/login and /admin routes via URL path)
  const [activeView, setActiveView] = useState<
    | 'storefront'
    | 'pdp'
    | 'combos'
    | 'bulk'
    | 'track'
    | 'checkout'
    | 'confirmation'
    | 'wishlist'
    | 'page'
    | 'admin-login'
    | 'admin'
  >(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.replace(/\/+$/, '') || '/';
      if (p === '/admin/login') return 'admin-login';
      if (p === '/admin') return 'admin';
    }
    return 'storefront';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activePageSlug, setActivePageSlug] = useState<string | null>(null);
  const [activeHeroBannerIdx, setActiveHeroBannerIdx] = useState<number>(0);

  // Auth & Persistent Admin Session state
  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  const [idToken, setIdToken] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem('gs_admin_session_v1');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.token && parsed?.expiresAt && Date.now() < Number(parsed.expiresAt)) {
        return parsed.token;
      }
      localStorage.removeItem('gs_admin_session_v1');
      return null;
    } catch {
      return null;
    }
  });
  const [dbUser, setDbUser] = useState<{
    id: number;
    uid: string;
    email: string;
    fullName?: string | null;
    role: string;
  } | null>(() => {
    try {
      const raw = localStorage.getItem('gs_admin_session_v1');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.user && parsed?.expiresAt && Date.now() < Number(parsed.expiresAt)) {
        return parsed.user;
      }
      return null;
    } catch {
      return null;
    }
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [adminLoginEmail, setAdminLoginEmail] = useState('');
  const [adminLoginName, setAdminLoginName] = useState('');
  const [adminLoginAccessCode, setAdminLoginAccessCode] = useState('');
  const [adminLoginSubmitting, setAdminLoginSubmitting] = useState(false);

  // Customer Sign-In Modal state (Supabase Auth + PostgreSQL Profile)
  const [customerAuthModalOpen, setCustomerAuthModalOpen] = useState(false);
  const [customerAuthEmail, setCustomerAuthEmail] = useState('');
  const [customerAuthPassword, setCustomerAuthPassword] = useState('');
  const [customerAuthName, setCustomerAuthName] = useState('');
  const [customerAuthSubmitting, setCustomerAuthSubmitting] = useState(false);
  const [visibleProductCount, setVisibleProductCount] = useState<number>(12);

const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Notebooks & Diaries', slug: 'notebooks-and-diaries', description: 'Ruled registers, spiral notebooks, and planners', isActive: true, showInNav: true, showOnHomepage: true },
  { id: 2, name: 'Pens & Writing Instruments', slug: 'pens-and-writing-instruments', description: 'Gel pens, ball pens, fountain pens, and highlighters', isActive: true, showInNav: true, showOnHomepage: true },
  { id: 3, name: 'Art & Craft Supplies', slug: 'art-and-craft-supplies', description: 'Acrylic paints, sketchbooks, and canvases', isActive: true, showInNav: true, showOnHomepage: true },
  { id: 4, name: 'School & Geometry Essentials', slug: 'school-and-geometry-essentials', description: 'Geometry boxes, compasses, and rulers', isActive: true, showInNav: true, showOnHomepage: true },
];

const DEFAULT_PRODUCTS = [
  {
    id: 101,
    name: 'Classmate Pulsar Premium Spiral Notebook (A4, 300 Pages)',
    slug: 'classmate-pulsar-premium-spiral-notebook-a4-300-pages',
    categoryId: 1,
    brandId: 1,
    description: 'High quality 70 GSM elemental chlorine-free paper notebook.',
    baseMrpPaise: 25000,
    basePricePaise: 22000,
    isActive: true,
    status: 'PUBLISHED',
    badge: 'BESTSELLER',
    variants: [{ id: 1001, variantName: 'A4 / Single Line / 300 Pages', sku: 'GS-NB-001', mrpPaise: 25000, pricePaise: 22000, stockQuantity: 50, inStock: true }],
  },
  {
    id: 102,
    name: 'Uniball Eye UB-150 Fine Rollerball Pen (Pack of 3)',
    slug: 'uniball-eye-ub-150-fine-rollerball-pen-pack-of-3',
    categoryId: 2,
    brandId: 2,
    description: 'Waterproof fade-proof pigment ink rollerball pens.',
    baseMrpPaise: 30000,
    basePricePaise: 27000,
    isActive: true,
    status: 'PUBLISHED',
    badge: 'POPULAR',
    variants: [{ id: 1002, variantName: 'Pack of 3 (Blue/Black/Red)', sku: 'GS-PEN-002', mrpPaise: 30000, pricePaise: 27000, stockQuantity: 40, inStock: true }],
  },
];

// Storefront data from PostgreSQL
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>(DEFAULT_CATEGORIES);
  const [brands, setBrands] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>(DEFAULT_PRODUCTS);
  const [bundles, setBundles] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [serviceablePincodes, setServiceablePincodes] = useState<any[]>([]);
  const [storeSettings, setStoreSettings] = useState<Record<string, any>>({});
  const [navigationItems, setNavigationItems] = useState<any[]>([]);
  const [homepageSections, setHomepageSections] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [cmsPages, setCmsPages] = useState<any[]>([]);
  const [cmsRevisions, setCmsRevisions] = useState<any[]>([]);
  const [paymentGatewayStatus, setPaymentGatewayStatus] = useState<{
    cashfreeConfigured: boolean;
    cashfreeEnvironment?: 'SANDBOX' | 'PRODUCTION';
    cashfreeAppId?: string | null;
    razorpayConfigured: boolean;
    razorpayKeyId: string | null;
  }>({ cashfreeConfigured: false, razorpayConfigured: false, razorpayKeyId: null });

  // Catalogue search, filters, sorting, and budget filters
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestionsOpen, setSearchSuggestionsOpen] = useState(false);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('ALL');
  const [selectedBrandSlug, setSelectedBrandSlug] = useState<string>('ALL');
  const [maxPriceFilterPaise, setMaxPriceFilterPaise] = useState<number>(0); // 0 = no limit
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'featured' | 'bestseller' | 'newest' | 'price_asc' | 'price_desc'>('featured');
  const [selectedVariantByProduct, setSelectedVariantByProduct] = useState<Record<number, number>>({});

  // Product Detail Page (PDP) state
  const [activeProductSlug, setActiveProductSlug] = useState<string | null>(null);
  const [pdpVariantId, setPdpVariantId] = useState<number | null>(null);
  const [pdpQuantity, setPdpQuantity] = useState<number>(1);
  const [pdpSelectedImageUrl, setPdpSelectedImageUrl] = useState<string | null>(null);

  // Cart & Server Calculation state
  const [guestSessionId] = useState<string>(() => {
    try {
      const existing = localStorage.getItem('gs_guest_session_v1');
      if (existing) return existing;
      const created = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem('gs_guest_session_v1', created);
      return created;
    } catch {
      return `guest_${Date.now()}`;
    }
  });

  const [cartItems, setCartItems] = useState<LocalCartItem[]>(() => {
    try {
      const saved = localStorage.getItem('gs_cart_items_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCouponCode, setAppliedCouponCode] = useState('');
  const [serverCartResult, setServerCartResult] = useState<any>(null);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartFeedbackToast, setCartFeedbackToast] = useState<string | null>(null);
  const [flyingCartItems, setFlyingCartItems] = useState<FlyingCartItem[]>([]);
  const [cartButtonBouncing, setCartButtonBouncing] = useState(false);
  const cartButtonRef = useRef<HTMLButtonElement | null>(null);

  // Wishlist state
  const [wishlistProductIds, setWishlistProductIds] = useState<number[]>([]);

  // Checkout state
  const [fulfilmentMethod, setFulfilmentMethod] = useState<FulfilmentMethod>('STORE_PICKUP');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASHFREE_ONLINE');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [pickupWindow, setPickupWindow] = useState('Today — Within 2 Hours of Ready Notification');
  const [shippingAddress, setShippingAddress] = useState({
    addressLine1: '',
    addressLine2: '',
    landmark: '',
    city: 'Agra',
    state: 'Uttar Pradesh',
    pincode: '282010',
  });
  const [orderNotes, setOrderNotes] = useState('');
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [confirmedOrderData, setConfirmedOrderData] = useState<any>(null);

  // Order Tracking & History state
  const [trackOrderNumberInput, setTrackOrderNumberInput] = useState('');
  const [trackPhoneInput, setTrackPhoneInput] = useState('');
  const [trackedOrderResult, setTrackedOrderResult] = useState<any>(null);
  const [myOrdersList, setMyOrdersList] = useState<any[]>([]);
  const [trackBoardFilter, setTrackBoardFilter] = useState<
    'ALL' | 'ACTION_NEEDED' | 'READY_PICKUP' | 'IN_TRANSIT' | 'COMPLETED'
  >('ALL');
  const [orderDateRangeFilter, setOrderDateRangeFilter] = useState<
    'ALL_TIME' | '30_DAYS' | '3_MONTHS' | '6_MONTHS'
  >('ALL_TIME');
  const [trackError, setTrackError] = useState<string | null>(null);

  // Bulk Order Enquiry state
  const [bulkForm, setBulkForm] = useState({
    institutionName: '',
    contactPerson: '',
    email: '',
    phone: '',
    gstin: '',
    deliveryPincode: '',
    requiredByDate: '',
    notes: '',
  });
  const [bulkItems, setBulkItems] = useState<
    Array<{ itemName: string; skuOrCategory: string; quantity: number }>
  >([
    { itemName: 'Long Hardbound Registers (240 Pages)', skuOrCategory: 'Notebooks & Diaries', quantity: 100 },
    { itemName: 'Unomax Ultron 2X Ball Pens (Blue)', skuOrCategory: 'Pens & Pencils', quantity: 200 },
  ]);
  const [bulkSubmittedEnquiry, setBulkSubmittedEnquiry] = useState<any>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Save cart items to localStorage so refresh preserves active cart
  useEffect(() => {
    try {
      localStorage.setItem('gs_cart_items_v1', JSON.stringify(cartItems));
    } catch {
      // ignore storage quota errors
    }
  }, [cartItems]);

  // Sync browser URL popstate for /admin/login and /admin
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname.replace(/\/+$/, '') || '/';
      if (p === '/admin/login') {
        setActiveView('admin-login');
      } else if (p === '/admin') {
        setActiveView('admin');
      } else {
        setActiveView('storefront');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Listen to Supabase Auth state while preserving valid persistent session tokens
  useEffect(() => {
    const restoreLocalSession = () => {
      try {
        const raw = localStorage.getItem('gs_admin_session_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.token && parsed?.expiresAt && Date.now() < Number(parsed.expiresAt)) {
            setIdToken(parsed.token);
            if (parsed.user) setDbUser(parsed.user);
            return true;
          }
          localStorage.removeItem('gs_admin_session_v1');
        }
      } catch {
        // ignore
      }
      return false;
    };

    if (!supabase) {
      restoreLocalSession();
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        setSupabaseUser(data.session.user);
        setIdToken(data.session.access_token);
      } else {
        restoreLocalSession();
      }
    });

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        setIdToken(session.access_token);
        if (!customerEmail && session.user.email) setCustomerEmail(session.user.email);
      } else {
        setSupabaseUser(null);
        if (!restoreLocalSession()) {
          setIdToken(null);
          setDbUser(null);
        }
      }
    });

    return () => {
      authSub?.subscription?.unsubscribe();
    };
  }, []);

  // Load Storefront Bootstrap Data
  const loadStoreBootstrap = useCallback(async (tokenOverride?: string | null) => {
    setLoadingBootstrap(true);
    setBootstrapError(null);
    try {
      const headers: Record<string, string> = {};
      const activeToken = tokenOverride !== undefined ? tokenOverride : idToken;
      if (activeToken) {
        headers.Authorization = `Bearer ${activeToken}`;
      }
      const apiBase = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
      const bootstrapUrl = apiBase ? `${apiBase}/api/storefront/bootstrap` : '/api/storefront/bootstrap';
      const res = await fetch(bootstrapUrl, { headers });
      const contentType = res.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        console.warn('Backend returned non-JSON response (likely static Netlify host without API proxy)');
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load store catalogue');
      }
      if (data.categories?.length) setCategories(data.categories);
      if (data.brands) setBrands(data.brands);
      if (data.products?.length) setProducts(data.products);
      if (data.bundles) setBundles(data.bundles);
      if (data.coupons) setCoupons(data.coupons);
      if (data.serviceablePincodes) setServiceablePincodes(data.serviceablePincodes);
      if (data.settings) setStoreSettings(data.settings);
      if (data.navigationItems) setNavigationItems(data.navigationItems);
      if (data.homepageSections) setHomepageSections(data.homepageSections);
      if (data.banners) setBanners(data.banners);
      if (data.pages) setCmsPages(data.pages);
      if (data.revisions) setCmsRevisions(data.revisions);
      if (data.wishlistProductIds) setWishlistProductIds(data.wishlistProductIds);
      if (data.currentUser) {
        setDbUser(data.currentUser);
      } else {
        setDbUser(null);
      }
      if (data.paymentGatewayStatus) {
        setPaymentGatewayStatus(data.paymentGatewayStatus);
      }

      // Initialize default selected variant for each product
      const initialVarMap: Record<number, number> = {};
      for (const p of data.products || []) {
        if (p.variants && p.variants.length > 0) {
          initialVarMap[p.id] = p.variants[0].id;
        }
      }
      setSelectedVariantByProduct((prev) => ({ ...initialVarMap, ...prev }));
    } catch (err: any) {
      console.warn('Storefront bootstrap load error:', err.message);
    } finally {
      setLoadingBootstrap(false);
    }
  }, [idToken]);

  useEffect(() => {
    loadStoreBootstrap();
  }, [loadStoreBootstrap]);

  // Recalculate cart totals on the server whenever cart items, coupon, fulfilment, or pincode change
  const syncAndCalculateCart = useCallback(async () => {
    setCartLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) headers.Authorization = `Bearer ${idToken}`;
      const res = await fetch('/api/cart/calculate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          guestSessionId,
          items: cartItems,
          couponCode: appliedCouponCode,
          fulfilmentMethod,
          pincode: fulfilmentMethod === 'HOME_DELIVERY' ? shippingAddress.pincode : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data) {
        setServerCartResult(data);
        if (data.calculation?.items && Array.isArray(data.calculation.items)) {
          const syncedItems: LocalCartItem[] = data.calculation.items.map((i: any) => ({
            productId: Number(i.productId),
            variantId: Number(i.variantId),
            quantity: Number(i.quantity),
          }));
          const currentSig = cartItems.map((c) => `${c.productId}_${c.variantId}_${c.quantity}`).sort().join('|');
          const syncedSig = syncedItems.map((c) => `${c.productId}_${c.variantId}_${c.quantity}`).sort().join('|');
          if (syncedSig !== currentSig) {
            setCartItems(syncedItems);
          }
        }
      }
    } catch (err) {
      console.error('Failed to calculate cart:', err);
    } finally {
      setCartLoading(false);
    }
  }, [cartItems, appliedCouponCode, fulfilmentMethod, shippingAddress.pincode, idToken, guestSessionId]);

  useEffect(() => {
    syncAndCalculateCart();
  }, [syncAndCalculateCart]);

  // Keep payment method aligned with fulfilment method
  useEffect(() => {
    if (fulfilmentMethod === 'STORE_PICKUP' && paymentMethod === 'COD') {
      setPaymentMethod('PAY_AT_STORE');
    } else if (fulfilmentMethod === 'HOME_DELIVERY' && paymentMethod === 'PAY_AT_STORE') {
      setPaymentMethod('COD');
    }
  }, [fulfilmentMethod, paymentMethod]);

  const showToast = (msg: string) => {
    setCartFeedbackToast(msg);
    setTimeout(() => {
      setCartFeedbackToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const triggerSwipeToCartAnimation = (
    product: any,
    pricePaise: number,
    sourceEventOrEl?: React.MouseEvent<HTMLElement> | HTMLElement | null
  ) => {
    try {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 768;

      let startX = Math.round(vw / 2 - 72);
      let startY = Math.round(vh / 2 - 54);

      const rawEl: HTMLElement | null =
        sourceEventOrEl && 'currentTarget' in sourceEventOrEl
          ? (sourceEventOrEl.currentTarget as HTMLElement)
          : (sourceEventOrEl as HTMLElement | null);

      if (rawEl && typeof rawEl.getBoundingClientRect === 'function') {
        const cardEl = (rawEl.closest('article') as HTMLElement | null) || rawEl;
        const rect = cardEl.getBoundingClientRect();
        startX = Math.round(rect.left + Math.min(rect.width * 0.2, 42));
        startY = Math.round(rect.top + Math.min(rect.height * 0.18, 42));
      }

      let endX = Math.max(24, vw - 160);
      let endY = 20;
      if (cartButtonRef.current) {
        const cartRect = cartButtonRef.current.getBoundingClientRect();
        endX = Math.round(cartRect.left + cartRect.width / 2 - 64);
        endY = Math.round(cartRect.top + cartRect.height / 2 - 38);
      }

      const flyId = `fly_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newItem: FlyingCartItem = {
        id: flyId,
        name: product.name || 'Stationery Item',
        priceFormatted: formatPaiseToINR(pricePaise),
        illustrationType: product.illustrationType || 'spiral_notebook',
        imageUrl: product.imageUrl || undefined,
        startX,
        startY,
        endX,
        endY,
      };

      setFlyingCartItems((prev) => [...prev, newItem]);

      setTimeout(() => {
        setCartButtonBouncing(true);
        setTimeout(() => setCartButtonBouncing(false), 420);
      }, 480);

      setTimeout(() => {
        setFlyingCartItems((prev) => prev.filter((item) => item.id !== flyId));
      }, 820);
    } catch {
      // Never block cart addition if animation coordinates fail
    }
  };

  // Cart manipulation handlers
  const handleAddToCart = (
    product: any,
    variantId?: number,
    qtyToAdd = 1,
    sourceEventOrEl?: React.MouseEvent<HTMLElement> | HTMLElement | null
  ) => {
    const targetVarId =
      variantId || selectedVariantByProduct[product.id] || product.variants?.[0]?.id;
    const variant = product.variants?.find((v: any) => v.id === targetVarId);
    if (!variant) return;

    if (variant.stockQuantity <= 0) {
      showToast(`${product.name} is currently out of stock.`);
      return;
    }

    const existingItem = cartItems.find(
      (i) => i.productId === product.id && i.variantId === variant.id
    );
    if (existingItem && existingItem.quantity >= variant.stockQuantity) {
      showToast(`Maximum available stock (${variant.stockQuantity}) reached for ${product.name}.`);
      return;
    }

    triggerSwipeToCartAnimation(
      product,
      variant.sellingPricePaise || product.sellingPricePaise || 0,
      sourceEventOrEl
    );

    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.productId === product.id && i.variantId === variant.id
      );
      if (existingIdx > -1) {
        const currentQty = prev[existingIdx].quantity;
        const nextQty = Math.min(variant.stockQuantity, currentQty + qtyToAdd);
        const copy = [...prev];
        copy[existingIdx] = { ...copy[existingIdx], quantity: nextQty };
        showToast(`Swiped ${product.name} (${variant.variantName}) into cart.`);
        return copy;
      } else {
        const clampedQty = Math.min(variant.stockQuantity, qtyToAdd);
        showToast(`Swiped ${product.name} (${variant.variantName}) into cart.`);
        return [
          ...prev,
          { productId: product.id, variantId: variant.id, quantity: clampedQty },
        ];
      }
    });
  };

  const handleAddBundleToCart = (
    bundle: any,
    sourceEvent?: React.MouseEvent<HTMLElement>
  ) => {
    const bundleItems = bundle.itemsJson || [];
    let animatedFirst = false;
    for (const bi of bundleItems) {
      const prod = products.find((p) => p.id === bi.productId);
      if (prod) {
        handleAddToCart(
          prod,
          bi.variantId,
          bi.quantity,
          !animatedFirst ? sourceEvent : undefined
        );
        animatedFirst = true;
      }
    }
  };

  const handleUpdateCartQuantity = (productId: number, variantId: number, nextQty: number) => {
    if (nextQty <= 0) {
      setCartItems((prev) =>
        prev.filter((i) => !(i.productId === productId && i.variantId === variantId))
      );
      return;
    }
    const prod = products.find((p) => p.id === productId);
    const variant = prod?.variants?.find((v: any) => v.id === variantId);
    const maxStock = variant ? variant.stockQuantity : 99;
    const clamped = Math.min(maxStock, nextQty);

    setCartItems((prev) =>
      prev.map((i) =>
        i.productId === productId && i.variantId === variantId
          ? { ...i, quantity: clamped }
          : i
      )
    );
  };

  // Wishlist handler
  const handleToggleWishlist = async (productId: number) => {
    if (!idToken) {
      setWishlistProductIds((prev) =>
        prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
      );
      showToast('Saved to session wishlist. Sign in with Google to persist across devices.');
      return;
    }
    try {
      const res = await fetch('/api/wishlist/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (res.ok) {
        setWishlistProductIds(data.productIds || []);
        showToast(data.added ? 'Saved to your wishlist.' : 'Removed from wishlist.');
      }
    } catch (err) {
      console.error('Wishlist error:', err);
    }
  };

  // Customer Sign-In handler (Supabase Auth + PostgreSQL Customer Session)
  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setCustomerAuthModalOpen(true);
  };

  // Open Google Account Admin Sign-Up / Sign-In handler (Firebase Google Popup + PostgreSQL Admin Registration)
  // Open Google Account Admin Sign-Up / Sign-In handler (Supabase OAuth + PostgreSQL Admin Registration)
  const handleGoogleAdminSignUp = async () => {
    setAuthError(null);
    setAdminLoginSubmitting(true);
    try {
      if (!supabase) {
        throw new Error('Supabase client is not configured.');
      }
      const { data: _oauthData, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) {
        throw error;
      }
    } catch (err: any) {
      setAuthError(
        err.message ||
          'Enter your email address below to sign up or log in to the Admin Console.'
      );
    } finally {
      setAdminLoginSubmitting(false);
    }
  };

  const handleCustomerAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setCustomerAuthSubmitting(true);
    try {
      const cleanEmail = customerAuthEmail.trim().toLowerCase();
      if (!cleanEmail) {
        throw new Error('Please enter your email address.');
      }

      // 1. If password is provided and Supabase Auth is configured, attempt Supabase Auth sign-in or auto sign-up
      if (supabase && customerAuthPassword.trim().length >= 6) {
        try {
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: customerAuthPassword.trim(),
          });
          if (!signInErr && signInData?.session) {
            setIdToken(signInData.session.access_token);
            await loadStoreBootstrap(signInData.session.access_token);
            setCustomerAuthModalOpen(false);
            showToast(`Signed in via Supabase Auth as ${cleanEmail}`);
            return;
          }

          // If user doesn't exist yet, attempt sign up in Supabase
          if (signInErr && (signInErr.message.toLowerCase().includes('invalid login credentials') || signInErr.message.toLowerCase().includes('user not found'))) {
            const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
              email: cleanEmail,
              password: customerAuthPassword.trim(),
              options: {
                data: {
                  full_name: customerAuthName.trim() || cleanEmail.split('@')[0],
                },
              },
            });
            if (!signUpErr && signUpData?.session?.access_token) {
              setIdToken(signUpData.session.access_token);
              await loadStoreBootstrap(signUpData.session.access_token);
              setCustomerAuthModalOpen(false);
              showToast(`Account registered and signed in via Supabase as ${cleanEmail}`);
              return;
            }
          }
        } catch {
          // Seamless fallback to unified customer session below
        }
      }

      // 2. Sync customer account with PostgreSQL (strictly role: 'customer')
      const res = await fetch('/api/auth/customer-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          fullName: customerAuthName.trim() || cleanEmail.split('@')[0],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Customer sign-in failed.');
      }

      localStorage.setItem(
        'gs_admin_session_v1',
        JSON.stringify({
          token: data.token,
          expiresAt: data.expiresAt,
          user: data.user,
        })
      );
      setIdToken(data.token);
      setDbUser(data.user);
      if (!customerEmail) setCustomerEmail(data.user.email);
      if (!customerName && data.user.fullName) setCustomerName(data.user.fullName);
      await loadStoreBootstrap(data.token);
      setCustomerAuthModalOpen(false);
      showToast(`Signed in as ${data.user.email}`);
    } catch (err: any) {
      setAuthError(err.message || 'Sign-in failed.');
    } finally {
      setCustomerAuthSubmitting(false);
    }
  };

  // Open Google Account Administrator Sign-Up / Login handler (/admin/login & /admin)
  const handleAdminCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAdminLoginSubmitting(true);
    try {
      const cleanEmail = adminLoginEmail.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new Error('Please enter a valid Google email address.');
      }
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          fullName: adminLoginName.trim() || cleanEmail.split('@')[0],
          accessCode: adminLoginAccessCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Administrator sign-up failed.');
      }
      localStorage.setItem(
        'gs_admin_session_v1',
        JSON.stringify({
          token: data.token,
          expiresAt: data.expiresAt,
          user: data.user,
        })
      );
      setIdToken(data.token);
      setDbUser(data.user);
      setAdminLoginAccessCode('');
      await loadStoreBootstrap(data.token);
      window.history.pushState({}, '', '/admin');
      setActiveView('admin');
      showToast(`Welcome to Admin Console, ${data.user.email}!`);
    } catch (err: any) {
      setAuthError(err.message || 'Could not sign up for Admin Console.');
    } finally {
      setAdminLoginSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem('gs_admin_session_v1');
    } catch {
      // ignore
    }
    setSupabaseUser(null);
    setIdToken(null);
    setDbUser(null);
    setMyOrdersList([]);
    setTrackedOrderResult(null);
    setConfirmedOrderData(null);
    setTrackError(null);
    if (activeView === 'admin' || activeView === 'admin-login') {
      window.history.pushState({}, '', '/admin/login');
      setActiveView('admin-login');
    }
    showToast('Signed out.');
  };

  // Seamless 1-Click Role Switcher (preserves exact same current interface without redirecting)
  const handleSwitchRole = async (nextRole: 'customer' | 'staff' | 'owner') => {
    setAuthError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) headers.Authorization = `Bearer ${idToken}`;
      const res = await fetch('/api/auth/role-switch', {
        method: 'POST',
        headers,
        body: JSON.stringify({ role: nextRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to switch role');
      }
      if (data.token && data.user) {
        localStorage.setItem(
          'gs_admin_session_v1',
          JSON.stringify({
            token: data.token,
            expiresAt: data.expiresAt,
            user: data.user,
          })
        );
        setIdToken(data.token);
        setDbUser(data.user);
      } else if (data.user) {
        setDbUser(data.user);
      }
      showToast(
        `Switched active role to ${nextRole.toUpperCase()} — keeping the exact same interface open.`
      );
    } catch (err: any) {
      setAuthError(err.message || 'Could not switch role.');
    }
  };

  // Open Product Detail Page
  const openProductDetail = (product: any) => {
    setActiveProductSlug(product.slug);
    setPdpSelectedImageUrl(null);
    const defaultVar =
      selectedVariantByProduct[product.id] || product.variants?.[0]?.id || null;
    setPdpVariantId(defaultVar);
    setPdpQuantity(1);
    setActiveView('pdp');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Navigate via Dynamic CMS Navigation Item or Banner Link
  const handleNavigateCmsDestination = (linkType: string, targetValue: string) => {
    const cleanTarget = (targetValue || '').trim();
    if (linkType === 'CATEGORY') {
      setSelectedCategorySlug(cleanTarget || 'ALL');
      setSelectedBrandSlug('ALL');
      setActiveView('storefront');
      setTimeout(() => {
        document.getElementById('catalogue-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
      return;
    }
    if (linkType === 'BRAND') {
      setSelectedBrandSlug(cleanTarget || 'ALL');
      setSelectedCategorySlug('ALL');
      setActiveView('storefront');
      setTimeout(() => {
        document.getElementById('catalogue-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
      return;
    }
    if (linkType === 'COLLECTION') {
      setSelectedCategorySlug('ALL');
      setSelectedBrandSlug('ALL');
      if (cleanTarget === 'BESTSELLERS') setSortBy('bestseller');
      else if (cleanTarget === 'NEW_ARRIVALS') setSortBy('newest');
      else if (cleanTarget === 'UNDER_99') setMaxPriceFilterPaise(10000);
      else setSortBy('featured');
      setActiveView('storefront');
      setTimeout(() => {
        document.getElementById('catalogue-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
      return;
    }
    if (linkType === 'BUNDLES' || cleanTarget === 'bundles' || cleanTarget === 'combos') {
      setActiveView('combos');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (linkType === 'BULK_ORDER' || cleanTarget === 'bulk') {
      setActiveView('bulk');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (linkType === 'PAGE') {
      setActivePageSlug(cleanTarget);
      setActiveView('page');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (cleanTarget.startsWith('category:')) {
      setSelectedCategorySlug(cleanTarget.replace('category:', ''));
      setActiveView('storefront');
      return;
    }
    if (cleanTarget === 'track') {
      setActiveView('track');
      return;
    }
    setSelectedCategorySlug('ALL');
    setActiveView('storefront');
  };

  // Filtered and Sorted Products
  const filteredProducts = useMemo(() => {
    const selectedCatObj = categories.find((c) => c.slug === selectedCategorySlug);
    const childCatSlugs = selectedCatObj
      ? categories.filter((c) => c.parentId === selectedCatObj.id).map((c) => c.slug)
      : [];

    return products
      .filter((p) => {
        if (!p.isActive) return false;
        if (selectedCategorySlug !== 'ALL') {
          const matchesPrimary = p.categorySlug === selectedCategorySlug;
          const matchesSub = p.subcategorySlug === selectedCategorySlug;
          const matchesChild = childCatSlugs.includes(p.categorySlug);
          const matchesSecondary =
            selectedCatObj &&
            Array.isArray(p.secondaryCategoryIds) &&
            p.secondaryCategoryIds.includes(selectedCatObj.id);
          if (!matchesPrimary && !matchesSub && !matchesChild && !matchesSecondary) {
            return false;
          }
        }
        if (selectedBrandSlug !== 'ALL' && p.brandSlug !== selectedBrandSlug) {
          return false;
        }
        if (inStockOnly && p.totalStock <= 0) {
          return false;
        }
        if (maxPriceFilterPaise > 0 && p.sellingPricePaise > maxPriceFilterPaise) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchSku = p.sku.toLowerCase().includes(q);
          const matchCat = p.categoryName.toLowerCase().includes(q);
          const matchBrand = p.brandName.toLowerCase().includes(q);
          const matchDesc = p.shortDescription.toLowerCase().includes(q);
          return matchName || matchSku || matchCat || matchBrand || matchDesc;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') return a.sellingPricePaise - b.sellingPricePaise;
        if (sortBy === 'price_desc') return b.sellingPricePaise - a.sellingPricePaise;
        if (sortBy === 'bestseller') return Number(b.isBestseller) - Number(a.isBestseller);
        if (sortBy === 'newest') return Number(b.isNewArrival) - Number(a.isNewArrival);
        return Number(b.isFeatured) - Number(a.isFeatured);
      });
  }, [
    products,
    selectedCategorySlug,
    selectedBrandSlug,
    inStockOnly,
    maxPriceFilterPaise,
    searchQuery,
    sortBy,
  ]);

  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brandName.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [products, searchQuery]);

  const activePdpProduct = useMemo(
    () => products.find((p) => p.slug === activeProductSlug) || null,
    [products, activeProductSlug]
  );

  const activePdpVariant = useMemo(() => {
    if (!activePdpProduct) return null;
    return (
      activePdpProduct.variants?.find((v: any) => v.id === pdpVariantId) ||
      activePdpProduct.variants?.[0] ||
      null
    );
  }, [activePdpProduct, pdpVariantId]);

  const matchedPincodeRule = useMemo(() => {
    const pin = shippingAddress.pincode.trim();
    return serviceablePincodes.find((p) => p.pincode === pin && p.isActive) || null;
  }, [serviceablePincodes, shippingAddress.pincode]);

  const totalCartItemsCount = useMemo(
    () => cartItems.reduce((sum, i) => sum + i.quantity, 0),
    [cartItems]
  );

  // Place Order Submission
  const loadCashfreeSdkScript = async (): Promise<any> => {
    if ((window as any).Cashfree) return (window as any).Cashfree;
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="cashfree.com"]');
      if (existing) {
        existing.addEventListener('load', () => resolve((window as any).Cashfree));
        existing.addEventListener('error', () => reject(new Error('Cashfree Payment SDK script failed to load')));
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.async = true;
      script.onload = () => resolve((window as any).Cashfree);
      script.onerror = () => reject(new Error('Cashfree Payment SDK script failed to load'));
      document.head.appendChild(script);
    });
  };

  const triggerCashfreePaymentModal = async (orderNumber: string) => {
    try {
      setCheckoutSubmitting(true);
      const res = await fetch('/api/payments/cashfree/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber }),
      });
      const data = await res.json();
      if (!res.ok || !data.paymentSessionId) {
        throw new Error(data.error || 'Failed to initialize Cashfree payment session.');
      }

      const CashfreeFactory = await loadCashfreeSdkScript();
      if (!CashfreeFactory) {
        throw new Error('Cashfree SDK is not available.');
      }

      const cashfree = CashfreeFactory({
        mode: data.environment === 'PRODUCTION' ? 'production' : 'sandbox',
      });

      await cashfree.checkout({
        paymentSessionId: data.paymentSessionId,
        redirectTarget: '_modal',
      });

      // Auto-verify payment status server side after modal closes
      const vRes = await fetch('/api/payments/cashfree/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber,
          cfOrderId: data.cfOrderId || orderNumber,
        }),
      });
      const vData = await vRes.json();
      if (vRes.ok && vData.order) {
        setConfirmedOrderData((prev: any) =>
          prev && prev.order?.orderNumber === orderNumber ? { ...prev, order: vData.order } : prev
        );
      }
    } catch (err: any) {
      console.error('Cashfree payment modal error:', err.message || err);
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);

    if (!dbUser || !idToken) {
      setCheckoutError('Please sign in to your account before placing an order so it is assigned to your account.');
      setCustomerAuthModalOpen(true);
      return;
    }

    setCheckoutSubmitting(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          guestSessionId,
          customerName: customerName || dbUser.fullName || dbUser.email.split('@')[0],
          customerPhone,
          customerEmail: dbUser.email || customerEmail,
          fulfilmentMethod,
          paymentMethod,
          couponCode: appliedCouponCode,
          notes: orderNotes,
          items: cartItems,
          pickupWindow: fulfilmentMethod === 'STORE_PICKUP' ? pickupWindow : undefined,
          shippingAddress:
            fulfilmentMethod === 'HOME_DELIVERY'
              ? {
                  recipientName: customerName || dbUser.fullName || dbUser.email.split('@')[0],
                  phone: customerPhone,
                  ...shippingAddress,
                }
              : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order.');
      }

      setConfirmedOrderData(data);
      setCartItems([]);
      setAppliedCouponCode('');
      setCouponInput('');
      await loadStoreBootstrap();
      setActiveView('confirmation');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Trigger Cashfree Drop-in Checkout modal if payment method is CASHFREE_ONLINE
      if (paymentMethod === 'CASHFREE_ONLINE') {
        if (data.cashfree?.paymentSessionId) {
          triggerCashfreePaymentModal(data.order.orderNumber);
        }
      }
    } catch (err: any) {
      setCheckoutError(err.message || 'Could not complete order.');
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  // Track Order Lookup (Requires signed-in account that owns the order)
  const handleTrackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackError(null);
    if (!dbUser || !idToken) {
      setTrackedOrderResult(null);
      setTrackError('Please sign in to your account to view or track your orders.');
      setCustomerAuthModalOpen(true);
      return;
    }
    if (!trackOrderNumberInput.trim()) return;
    try {
      const res = await fetch(
        `/api/orders/track/${encodeURIComponent(trackOrderNumberInput.trim())}`,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Order not found on your account.');
      setTrackedOrderResult(data);
    } catch (err: any) {
      setTrackedOrderResult(null);
      setTrackError(err.message);
    }
  };

  const handleLoadMyOrders = useCallback(async () => {
    if (!idToken || !dbUser) {
      setMyOrdersList([]);
      setTrackedOrderResult(null);
      return;
    }
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${idToken}`,
      };
      const query = trackPhoneInput.trim()
        ? `?phone=${encodeURIComponent(trackPhoneInput.trim())}`
        : '';
      const res = await fetch(`/api/orders/my-orders${query}`, { headers });
      const data = await res.json();
      if (res.ok) {
        const list = data.orders || [];
        setMyOrdersList(list);
        setTrackedOrderResult((prev: any) => {
          if (prev?.order?.id) {
            const refreshed = list.find((o: any) => o.order.id === prev.order.id);
            return refreshed || (list.length > 0 ? list[0] : null);
          }
          return list.length > 0 ? list[0] : null;
        });
      } else {
        setMyOrdersList([]);
        setTrackedOrderResult(null);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
      setMyOrdersList([]);
      setTrackedOrderResult(null);
    }
  }, [idToken, dbUser, trackPhoneInput]);

  useEffect(() => {
    if (!dbUser || !idToken) {
      setMyOrdersList([]);
      setTrackedOrderResult(null);
      return;
    }
    if (activeView === 'track') {
      handleLoadMyOrders();
    }
  }, [activeView, dbUser, idToken, handleLoadMyOrders]);

  // Submit Institutional Bulk Order Enquiry
  const handleSubmitBulkEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkError(null);
    try {
      const res = await fetch('/api/bulk-enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bulkForm,
          itemsRequested: bulkItems.filter((i) => i.itemName.trim() && i.quantity > 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit bulk enquiry.');
      setBulkSubmittedEnquiry(data.enquiry);
    } catch (err: any) {
      setBulkError(err.message);
    }
  };

  const calculation = serverCartResult?.calculation || {
    items: [],
    mrpTotalPaise: 0,
    subtotalPaise: 0,
    catalogSavingsPaise: 0,
    couponDiscountPaise: 0,
    appliedCouponCode: '',
    couponMessage: '',
    taxPaise: 0,
    shippingPaise: 0,
    totalPaise: 0,
  };

  const themeConfig = storeSettings?.theme_config || {};
  const footerConfig = storeSettings?.footer_config || {};
  const activeHeroBanners = useMemo(
    () =>
      banners.filter(
        (b) => b.isActive !== false && b.status === 'PUBLISHED' && b.placement === 'HERO_MAIN'
      ),
    [banners]
  );
  const currentHeroBanner =
    activeHeroBanners[activeHeroBannerIdx % Math.max(1, activeHeroBanners.length)] || null;
  const activeNavCategories = useMemo(
    () => categories.filter((c) => c.isActive !== false && c.showInNav !== false),
    [categories]
  );
  const activeHomepageCategories = useMemo(
    () => categories.filter((c) => c.isActive !== false && c.showOnHomepage !== false),
    [categories]
  );
  const activeBrands = useMemo(
    () => brands.filter((b) => b.isActive !== false),
    [brands]
  );
  const activeCmsPage = useMemo(
    () => cmsPages.find((p) => p.slug === activePageSlug) || cmsPages[0] || null,
    [cmsPages, activePageSlug]
  );

  return (
    <div className="min-h-screen flex flex-col text-[#111827] bg-[#FAFAFA] pb-20 md:pb-0">
      {/* Slim Promotional Announcement Bar */}
      {themeConfig.announcementEnabled !== false && (
        <div
          className="px-3 sm:px-4 py-2 text-[11px] sm:text-xs"
          style={{
            backgroundColor: themeConfig.announcementBgColor || '#0F172A',
            color: themeConfig.announcementTextColor || '#F8FAFC',
          }}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <p className="truncate font-medium">
              {themeConfig.announcementText ||
                storeSettings?.promo_banner?.text ||
                'Store Pickup Counter Ready (Zero Delivery Fee) · Use code BACKTOSCHOOL10 for 10% off above ₹399'}
            </p>
            <span className="hidden md:inline opacity-80 whitespace-nowrap shrink-0 text-[11px]">
              Free Home Delivery on serviceable PIN codes from ₹399
            </span>
          </div>
        </div>
      )}

      {/* Strict 3-Zone Top Bar */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 sm:gap-6">
          {/* Left Zone: Mobile Menu Toggle + Wordmark */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 -ml-1 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <button
              onClick={() => {
                setSelectedCategorySlug('ALL');
                setSelectedBrandSlug('ALL');
                setActiveView('storefront');
                setMobileMenuOpen(false);
              }}
              className="font-serif-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left cursor-pointer"
            >
              {themeConfig.storeName || 'Gayatri Stationers'}
            </button>
          </div>

          {/* Center Zone: Concise Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <button
              onClick={() => {
                setSelectedCategorySlug('ALL');
                setSelectedBrandSlug('ALL');
                setActiveView('storefront');
              }}
              className={`px-3.5 py-1.5 rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'storefront'
                  ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                  : 'hover:bg-slate-100 hover:text-slate-950'
              }`}
            >
              Shop Catalogue
            </button>
            <button
              onClick={() => setActiveView('combos')}
              className={`px-3.5 py-1.5 rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'combos'
                  ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                  : 'hover:bg-slate-100 hover:text-slate-950'
              }`}
            >
              School Combos
            </button>
            <button
              onClick={() => setActiveView('bulk')}
              className={`px-3.5 py-1.5 rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'bulk'
                  ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                  : 'hover:bg-slate-100 hover:text-slate-950'
              }`}
            >
              Bulk Orders
            </button>
            <button
              onClick={() => setActiveView('track')}
              className={`px-3.5 py-1.5 rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'track'
                  ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                  : 'hover:bg-slate-100 hover:text-slate-950'
              }`}
            >
              Track Order
            </button>
            {cmsPages
              .filter((p) => p.isActive !== false && p.showInHeader)
              .map((p) => (
                <button
                  key={`hdr-page-${p.id}`}
                  onClick={() => {
                    setActivePageSlug(p.slug);
                    setActiveView('page');
                  }}
                  className={`px-3.5 py-1.5 rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeView === 'page' && activePageSlug === p.slug
                      ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                      : 'hover:bg-slate-100 hover:text-slate-950'
                  }`}
                >
                  {p.title}
                </button>
              ))}
          </nav>

          {/* Right Zone: Cart Button (Responsive Pill) */}
          <div className="flex items-center shrink-0">
            <button
              ref={cartButtonRef}
              onClick={() => setCartDrawerOpen(true)}
              className={`px-3.5 sm:px-5 py-2 sm:py-2.5 text-xs font-semibold text-white bg-[#B42318] rounded-full shadow-xs hover:bg-[#991B1B] transition-all duration-200 whitespace-nowrap shrink-0 font-mono-tabular cursor-pointer flex items-center gap-1.5 sm:gap-2 ${
                cartButtonBouncing
                  ? 'scale-110 ring-4 ring-amber-400/70 shadow-lg'
                  : 'scale-100'
              }`}
              aria-label="Open Shopping Bag"
            >
              <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="font-bold">Cart ({totalCartItemsCount})</span>
              <span className="hidden sm:inline opacity-90">· {formatPaiseToINR(calculation.totalPaise)}</span>
            </button>
          </div>
        </div>

        {/* Responsive Mobile Drawer / Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-3 pb-2 border-t border-slate-200/80 mt-3 space-y-3 animate-in fade-in duration-200">
            <div className="grid grid-cols-2 gap-2 text-xs font-medium">
              <button
                onClick={() => {
                  setSelectedCategorySlug('ALL');
                  setSelectedBrandSlug('ALL');
                  setActiveView('storefront');
                  setMobileMenuOpen(false);
                }}
                className={`p-2.5 rounded-2xl text-left flex items-center justify-between ${
                  activeView === 'storefront' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'
                }`}
              >
                <span>Shop Catalogue</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
              <button
                onClick={() => {
                  setActiveView('combos');
                  setMobileMenuOpen(false);
                }}
                className={`p-2.5 rounded-2xl text-left flex items-center justify-between ${
                  activeView === 'combos' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'
                }`}
              >
                <span>School Combos</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
              <button
                onClick={() => {
                  setActiveView('bulk');
                  setMobileMenuOpen(false);
                }}
                className={`p-2.5 rounded-2xl text-left flex items-center justify-between ${
                  activeView === 'bulk' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'
                }`}
              >
                <span>Bulk Orders</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
              <button
                onClick={() => {
                  setActiveView('track');
                  setMobileMenuOpen(false);
                }}
                className={`p-2.5 rounded-2xl text-left flex items-center justify-between ${
                  activeView === 'track' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'
                }`}
              >
                <span>Track Order</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            </div>

            {/* Quick Actions in Mobile Menu */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
              <button
                onClick={() => {
                  setActiveView('wishlist');
                  setMobileMenuOpen(false);
                }}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200/80 rounded-full text-xs font-medium text-slate-800 flex items-center justify-center gap-1.5"
              >
                <Heart className="w-3.5 h-3.5 text-[#B42318]" />
                <span>Wishlist ({wishlistProductIds.length})</span>
              </button>

              <button
                onClick={() => {
                  window.history.pushState({}, '', '/admin');
                  setActiveView('admin');
                  setMobileMenuOpen(false);
                }}
                className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Admin Console</span>
              </button>

              {supabaseUser || dbUser ? (
                <button
                  onClick={() => {
                    handleSignOut();
                    setMobileMenuOpen(false);
                  }}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200/80 rounded-full text-xs font-medium text-slate-700 flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    handleGoogleSignIn();
                    setMobileMenuOpen(false);
                  }}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-full text-xs font-medium flex items-center justify-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Practical Retail Search, Account & Discovery Bar */}
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <div className="bg-slate-100/90 hover:bg-slate-100 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-900 border border-slate-200 rounded-full flex items-center px-3.5 py-1.5 transition-all">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="search"
                aria-label="Search stationery catalogue by product name, brand, or SKU"
                value={searchQuery}
                onFocus={() => setSearchSuggestionsOpen(true)}
                onBlur={() => setTimeout(() => setSearchSuggestionsOpen(false), 180)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeView !== 'storefront') setActiveView('storefront');
                }}
                placeholder="Search notebooks, pens, DOMS, Classmate..."
                className="w-full px-2.5 py-0.5 text-xs bg-transparent focus:outline-none border-none text-slate-900 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-2 py-0.5 text-[11px] bg-slate-200/80 hover:bg-slate-300 rounded-full text-slate-700 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {searchSuggestionsOpen && searchSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl z-40 divide-y divide-slate-100 overflow-hidden p-1.5">
                {searchSuggestions.map((s) => (
                  <button
                    key={s.id}
                    onMouseDown={() => openProductDetail(s)}
                    className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center justify-between text-xs rounded-xl cursor-pointer"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{s.name}</p>
                      <p className="text-slate-500">
                        {s.brandName} · {s.categoryName} · SKU: {s.sku}
                      </p>
                    </div>
                    <span className="font-mono-tabular font-semibold text-slate-900">
                      {formatPaiseToINR(s.sellingPricePaise)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Filter Button (School Kits & Combos) */}
          <button
            type="button"
            onClick={() => setActiveView('combos')}
            className="w-9 h-9 flex items-center justify-center shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            title="School Kits & Combos"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Desktop & Tablet Account, Admin & Wishlist Buttons */}
          <div className="hidden sm:flex items-center justify-end gap-2 shrink-0 text-xs">
            <button
              onClick={() => setActiveView('track')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <Package className="w-3.5 h-3.5 text-slate-500" />
              <span>My Orders</span>
            </button>

            <button
              onClick={() => setActiveView('wishlist')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <Heart className="w-3.5 h-3.5 text-slate-500" />
              <span>Wishlist ({wishlistProductIds.length})</span>
            </button>

            <button
              onClick={() => {
                window.history.pushState({}, '', '/admin');
                setActiveView('admin');
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>{dbUser?.role === 'owner' || dbUser?.role === 'staff' ? 'Admin' : 'Admin Sign In'}</span>
            </button>

            {supabaseUser || dbUser ? (
              <div className="flex items-center gap-2">
                <span className="text-slate-700 hidden xl:inline truncate max-w-[120px] px-3 py-1 bg-white rounded-full border border-slate-200 text-[11px]">
                  {dbUser?.email || supabaseUser?.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCustomerAuthModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold whitespace-nowrap shrink-0 cursor-pointer text-xs transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic CMS Navigation & Category Filter Strip */}
      <div className="bg-slate-50/90 border-b border-slate-200/80 px-4 py-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedCategorySlug('ALL');
              setSelectedBrandSlug('ALL');
              setActiveView('storefront');
            }}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-full whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              selectedCategorySlug === 'ALL' && selectedBrandSlug === 'ALL' && activeView === 'storefront'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            All Stationery ({products.filter((p) => p.isActive !== false).length})
          </button>

          {/* Dynamic Categories managed from Store CMS */}
          {activeNavCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategorySlug(cat.slug);
                setSelectedBrandSlug('ALL');
                setActiveView('storefront');
              }}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-full whitespace-nowrap shrink-0 transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                selectedCategorySlug === cat.slug && activeView === 'storefront'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <span>{cat.name}</span>
              {cat.slug === 'diy-and-crafts' && (
                <span className="px-1.5 py-0.2 bg-[#B42318] text-white text-[9px] font-mono font-bold rounded-full">
                  NEW
                </span>
              )}
            </button>
          ))}

          {/* Additional Custom Navigation Items from CMS Navigation Builder */}
          {navigationItems
            .filter(
              (item) =>
                item.isActive !== false &&
                item.showOnDesktop !== false &&
                item.linkType !== 'CATEGORY'
            )
            .map((item) => (
              <button
                key={`nav-${item.id}`}
                onClick={() => handleNavigateCmsDestination(item.linkType, item.targetValue)}
                className="px-4 py-1.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200/80 transition-all whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>{item.label}</span>
                {item.highlightBadge && (
                  <span className="px-2 py-0.5 bg-[#B42318] text-white text-[9px] font-mono font-bold rounded-full">
                    {item.highlightBadge}
                  </span>
                )}
              </button>
            ))}
        </div>
      </div>

      {/* Toast Notification (Apple Floating Capsule) */}
      {cartFeedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900/95 backdrop-blur-md text-white px-5 py-3 rounded-full shadow-xl text-xs font-medium flex items-center gap-3 border border-stone-700">
          <span>{cartFeedbackToast}</span>
          <button
            onClick={() => setCartDrawerOpen(true)}
            className="px-3 py-1 bg-amber-400/20 text-amber-300 rounded-full font-semibold whitespace-nowrap hover:bg-amber-400/30"
          >
            View Cart
          </button>
        </div>
      )}

      {authError && (
        <div className="max-w-7xl mx-auto mt-4 px-6">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-900 flex items-center justify-between">
            <span>{authError}</span>
            <button onClick={() => setAuthError(null)} className="underline ml-4">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT VIEWPORT */}
      <main className="flex-1">
        {loadingBootstrap ? (
          <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="h-80 bg-white border border-stone-200/80 rounded-[32px] p-5 flex flex-col justify-between shadow-xs"
                >
                  <div className="h-44 bg-stone-100 rounded-[22px]" />
                  <div className="space-y-2">
                    <div className="h-4 bg-stone-200 rounded-full w-2/3" />
                    <div className="h-4 bg-stone-100 rounded-full w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : bootstrapError ? (
          <div className="max-w-3xl mx-auto px-6 py-12">
            <div className="bg-white border border-red-200 rounded-[32px] p-8 text-center space-y-3 shadow-xs">
              <p className="text-base font-semibold text-red-900">{bootstrapError}</p>
              <button
                onClick={() => loadStoreBootstrap()}
                className="px-5 py-2.5 bg-stone-900 text-white text-xs font-medium rounded-full"
              >
                Retry Connection
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* VIEW 1: STOREFRONT & CATALOGUE */}
            {activeView === 'storefront' && (
              <div className="max-w-7xl mx-auto px-6 py-8 space-y-12">
                {/* Dynamic CMS Storefront Hero & Promotional Banners */}
                {selectedCategorySlug === 'ALL' && selectedBrandSlug === 'ALL' && !searchQuery.trim() && (
                  <section className="space-y-4">
                    {/* Clean Editorial Hero Showcase */}
                    <div className="bg-white border border-slate-200/90 rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 relative overflow-hidden shadow-xs">
                      <div className="space-y-3 max-w-xl">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-800 shadow-2xs">
                          <Sparkles className="w-3.5 h-3.5 text-[#B42318]" />
                          <span>{currentHeroBanner?.badgeText || 'Gayatri Stationers · Premium Stationery Retail'}</span>
                        </div>

                        <h1 className="font-serif-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
                          Craft Your Story with Premium Stationery
                        </h1>

                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                          Curated ruled Classmate registers, Flair & Unomax pens, DOMS art sets, and office essentials at honest retail rates.
                        </p>

                        <div className="flex flex-wrap items-center gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById('catalogue-section');
                              el?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="px-5 py-2.5 rounded-full bg-[#B42318] hover:bg-[#991B1B] text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <span>Explore Catalogue</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveView('combos')}
                            className="px-4 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium cursor-pointer transition-colors"
                          >
                            School Kits
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveView('bulk')}
                            className="px-3.5 py-2 text-slate-700 text-xs font-medium hover:underline cursor-pointer"
                          >
                            Bulk Orders →
                          </button>
                        </div>
                      </div>

                      {/* Quick Category Showcase Cards */}
                      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mt-6">
                        <div className="p-3 text-center rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs hover:bg-white hover:border-slate-300 transition-all cursor-pointer" onClick={() => setSelectedCategorySlug('notebooks-and-registers')}>
                          <ProductIllustration type="spiral_notebook" alt="Ruled Books" className="w-full h-14 object-contain mx-auto" />
                          <p className="text-[10px] sm:text-xs font-bold text-slate-800 mt-1.5">Ruled Books</p>
                        </div>
                        <div className="p-3 text-center rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs hover:bg-white hover:border-slate-300 transition-all cursor-pointer" onClick={() => setSelectedCategorySlug('pens-and-writing')}>
                          <ProductIllustration type="ballpoint_pen" alt="Pastel Pens" className="w-full h-14 object-contain mx-auto" />
                          <p className="text-[10px] sm:text-xs font-bold text-slate-800 mt-1.5">Pastel Pens</p>
                        </div>
                        <div className="p-3 text-center rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs hover:bg-white hover:border-slate-300 transition-all cursor-pointer" onClick={() => setSelectedCategorySlug('diy-and-crafts')}>
                          <ProductIllustration type="drawing_book" alt="Fine Art Kits" className="w-full h-14 object-contain mx-auto" />
                          <p className="text-[10px] sm:text-xs font-bold text-slate-800 mt-1.5">Fine Art Kits</p>
                        </div>
                      </div>
                    </div>

                    {/* Clean Retail Promo Card (Flat 25% Off) */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#B42318]">
                          <Tag className="w-3.5 h-3.5 text-[#B42318]" />
                          <span>Flat 25% Off on First Order</span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Use code <strong className="font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">BACKTOSCHOOL10</strong> on orders above ₹399
                        </p>
                      </div>
                      <span className="shrink-0 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-bold rounded-full shadow-2xs">
                        ₹0 Pickup Fee
                      </span>
                    </div>

                    {/* Prominent Dual Fulfilment Banner (Store Pickup & Home Delivery — Apple Oval Cards) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="p-6 bg-white border border-stone-200/80 rounded-[32px] shadow-xs flex items-start justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-[#B42318] shrink-0" />
                            <h2 className="text-sm font-bold text-stone-900">
                              Option 1: Buy Online, Pick Up at Store Counter (₹0 Fee)
                            </h2>
                          </div>
                          <p className="text-xs text-stone-600 leading-relaxed">
                            Reserve stock online and choose <strong>Pay at Store</strong> or Online Payment. Collect your packed bag at the counter using your 6-character Pickup Code once staff marks it <em>Ready for Pickup</em>.
                          </p>
                          <p className="text-[11px] text-stone-500 pt-1">
                            {(
                              storeSettings?.store_profile?.pickupCounterLabel ||
                              'Gayatri Stationers — Retail Pickup Counter'
                            ).replace(/\s*\([^)]*Admin[^)]*\)/gi, '')}{' '}
                            ·{' '}
                            {(
                              storeSettings?.store_profile?.businessHoursNote ||
                              'Mon–Sat: 10:00 AM – 8:00 PM'
                            ).replace(/\s*\([^)]*Admin[^)]*\)/gi, '')}
                          </p>
                        </div>
                      </div>

                      <div className="p-6 bg-white border border-stone-200/80 rounded-[32px] shadow-xs flex items-start justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-stone-900 shrink-0" />
                            <h2 className="text-sm font-bold text-stone-900">
                              Option 2: Doorstep Home Delivery (PIN-Code Verified)
                            </h2>
                          </div>
                          <p className="text-xs text-stone-600 leading-relaxed">
                            Enter your 6-digit PIN code at checkout for instant serviceability validation, transparent shipping charges, free-delivery thresholds, and dispatch tracking.
                          </p>
                          <p className="text-[11px] text-stone-500 pt-1 font-mono-tabular">
                            Serviceable PINs:{' '}
                            {serviceablePincodes
                              .slice(0, 5)
                              .map((p) => p.pincode)
                              .join(', ')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Dynamic Shop by Category Grid */}
                    {activeHomepageCategories.length > 0 && (
                      <div className="bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-6 sm:p-8 space-y-5">
                        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-widest text-[#B42318] font-bold">
                              COMPLETE DEPARTMENT DIRECTORY
                            </span>
                            <h2 className="font-serif-display text-xl font-bold text-stone-900">
                              Shop by Stationery & Craft Category
                            </h2>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                          {activeHomepageCategories.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setSelectedCategorySlug(cat.slug);
                                setSelectedBrandSlug('ALL');
                                document
                                  .getElementById('catalogue-section')
                                  ?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="apple-card-btn p-4 bg-slate-50 border border-slate-200/90 hover:border-slate-800 rounded-[26px] text-left transition-all flex flex-col justify-between gap-2.5 cursor-pointer group hover:-translate-y-0.5"
                            >
                              <div>
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-bold text-xs sm:text-sm text-stone-900 group-hover:text-[#B42318]">
                                    {cat.name}
                                  </span>
                                  {cat.slug === 'diy-and-crafts' && (
                                    <span className="px-2 py-0.5 bg-[#B42318] text-white text-[9px] font-mono font-bold rounded-full">
                                      DIY
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-stone-500 line-clamp-2 mt-1">
                                  {cat.description}
                                </p>
                              </div>
                              <div className="text-[10px] font-mono text-stone-700 font-semibold pt-1.5 border-t border-stone-200/70 flex items-center justify-between">
                                <span>{cat.productCount ?? 0} Items</span>
                                <span>Browse →</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dynamic Shop by Stationery Company / Brand Strip (Apple Oval Brand Pills) */}
                    {activeBrands.length > 0 && (
                      <div className="bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-6 sm:p-8 space-y-5">
                        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-widest text-[#B42318] font-bold">
                              AUTHORISED RETAIL BRANDS
                            </span>
                            <h2 className="font-serif-display text-xl font-bold text-stone-900">
                              Shop by Stationery Company & Brand
                            </h2>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 overflow-x-auto pb-1">
                          {activeBrands.map((brand) => (
                            <button
                              key={brand.id}
                              type="button"
                              onClick={() => {
                                setSelectedBrandSlug(brand.slug);
                                setSelectedCategorySlug('ALL');
                                document
                                  .getElementById('catalogue-section')
                                  ?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className={`px-5 py-2.5 border rounded-full flex items-center gap-3 shrink-0 transition-all cursor-pointer ${
                                selectedBrandSlug === brand.slug
                                  ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                                  : 'bg-slate-50 text-stone-900 border-slate-200/90 hover:border-slate-800'
                              }`}
                            >
                              {brand.logoUrl ? (
                                <img
                                  src={brand.logoUrl}
                                  alt={brand.name}
                                  className="w-7 h-7 object-contain bg-white rounded-full p-0.5"
                                />
                              ) : (
                                <span className="w-7 h-7 bg-stone-900 text-white text-[10px] font-mono font-bold flex items-center justify-center rounded-full">
                                  {brand.name.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                              <div className="text-left">
                                <div className="text-xs font-bold leading-tight">{brand.name}</div>
                                <div className="text-[10px] opacity-75 font-mono">
                                  {brand.productCount ?? 0} Products
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Curated Bestsellers & New Arrivals Showcase */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Bestsellers Card */}
                      <div className="bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-6 sm:p-7 space-y-4">
                        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-widest text-[#B42318] font-bold">
                              MOST POPULAR ESSENTIALS
                            </span>
                            <h2 className="font-serif-display text-lg font-bold text-stone-900">
                              Store Bestsellers
                            </h2>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSortBy('bestseller');
                              document
                                .getElementById('catalogue-section')
                                ?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 rounded-full text-xs font-semibold text-stone-900 cursor-pointer"
                          >
                            View All →
                          </button>
                        </div>
                        <div className="divide-y divide-stone-100">
                          {products
                            .filter((p) => p.isActive !== false && p.isBestseller)
                            .slice(0, 3)
                            .map((item) => {
                              const v = item.variants?.[0];
                              const itemPrice = v?.sellingPricePaise || item.sellingPricePaise;
                              const itemStock = v?.stockQuantity ?? item.totalStock;
                              return (
                                <div
                                  key={`bs-${item.id}`}
                                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                                >
                                  <button
                                    type="button"
                                    onClick={() => openProductDetail(item)}
                                    className="apple-row-btn flex items-center gap-3 text-left group cursor-pointer min-w-0"
                                  >
                                    <div className="w-14 h-12 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shrink-0">
                                      <ProductIllustration
                                        type={item.illustrationType}
                                        imageUrl={item.imageUrl}
                                        alt={item.name}
                                        className="w-full h-full"
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-stone-900 group-hover:underline truncate">
                                        {item.name}
                                      </p>
                                      <p className="text-[11px] text-stone-500 truncate">
                                        {item.brandName} · {item.categoryName}
                                      </p>
                                    </div>
                                  </button>
                                  <div className="flex items-center gap-2.5 shrink-0">
                                    <span className="font-mono-tabular text-xs font-bold text-stone-900">
                                      {formatPaiseToINR(itemPrice)}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={itemStock <= 0}
                                      onClick={(e) => handleAddToCart(item, v?.id, 1, e)}
                                      className="px-3.5 py-1.5 bg-stone-900 text-white text-[11px] font-semibold rounded-full hover:bg-stone-800 disabled:opacity-40 cursor-pointer"
                                    >
                                      + Add
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>

                      {/* New Arrivals & DIY Highlights Card */}
                      <div className="bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-6 sm:p-7 space-y-4">
                        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-widest text-[#B42318] font-bold">
                              FRESH COUNTER ARRIVALS
                            </span>
                            <h2 className="font-serif-display text-lg font-bold text-stone-900">
                              New Arrivals & DIY Craft Kits
                            </h2>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSortBy('newest');
                              document
                                .getElementById('catalogue-section')
                                ?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 rounded-full text-xs font-semibold text-stone-900 cursor-pointer"
                          >
                            View All →
                          </button>
                        </div>
                        <div className="divide-y divide-stone-100">
                          {products
                            .filter(
                              (p) =>
                                p.isActive !== false &&
                                (p.isNewArrival || p.categorySlug === 'diy-and-crafts')
                            )
                            .slice(0, 3)
                            .map((item) => {
                              const v = item.variants?.[0];
                              const itemPrice = v?.sellingPricePaise || item.sellingPricePaise;
                              const itemStock = v?.stockQuantity ?? item.totalStock;
                              return (
                                <div
                                  key={`na-${item.id}`}
                                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                                >
                                  <button
                                    type="button"
                                    onClick={() => openProductDetail(item)}
                                    className="apple-row-btn flex items-center gap-3 text-left group cursor-pointer min-w-0"
                                  >
                                    <div className="w-14 h-12 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shrink-0">
                                      <ProductIllustration
                                        type={item.illustrationType}
                                        imageUrl={item.imageUrl}
                                        alt={item.name}
                                        className="w-full h-full"
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-stone-900 group-hover:underline truncate">
                                        {item.name}
                                      </p>
                                      <p className="text-[11px] text-stone-500 truncate">
                                        {item.brandName} · {item.categoryName}
                                      </p>
                                    </div>
                                  </button>
                                  <div className="flex items-center gap-2.5 shrink-0">
                                    <span className="font-mono-tabular text-xs font-bold text-stone-900">
                                      {formatPaiseToINR(itemPrice)}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={itemStock <= 0}
                                      onClick={(e) => handleAddToCart(item, v?.id, 1, e)}
                                      className="px-3.5 py-1.5 bg-stone-900 text-white text-[11px] font-semibold rounded-full hover:bg-stone-800 disabled:opacity-40 cursor-pointer"
                                    >
                                      + Add
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* Catalogue Filter & Product Grid Section */}
                <section id="catalogue-section" className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-stone-200 pb-4">
                    <div>
                      <h2 className="font-serif-display text-2xl font-bold text-stone-900">
                        {selectedCategorySlug === 'ALL'
                          ? 'Stationery & School Supply Catalogue'
                          : categories.find((c) => c.slug === selectedCategorySlug)?.name ||
                            'Products'}
                      </h2>
                      <p className="text-xs text-stone-600 mt-1">
                        Showing {filteredProducts.length} items · All prices inclusive of applicable GST
                      </p>
                    </div>

                    {/* Budget & Sort Controls (Apple Pill Controls) */}
                    <div className="flex flex-wrap items-center gap-2.5 text-xs">
                      {/* Budget quick filters inspired by practical stationery shopping */}
                      <div className="flex items-center bg-stone-200/75 p-1 rounded-full gap-1">
                        {[
                          { label: 'All Prices', val: 0 },
                          { label: 'Under ₹100', val: 10000 },
                          { label: 'Under ₹200', val: 20000 },
                          { label: 'Under ₹500', val: 50000 },
                        ].map((b) => (
                          <button
                            key={b.val}
                            onClick={() => setMaxPriceFilterPaise(b.val)}
                            className={`px-3 py-1 rounded-full font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                              maxPriceFilterPaise === b.val
                                ? 'bg-white text-stone-900 shadow-xs'
                                : 'text-stone-600 hover:text-stone-900'
                            }`}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>

                      <select
                        aria-label="Filter by Brand"
                        value={selectedBrandSlug}
                        onChange={(e) => setSelectedBrandSlug(e.target.value)}
                        className="px-4 py-1.5 bg-white border border-stone-300/90 rounded-full text-stone-800 shadow-2xs"
                      >
                        <option value="ALL">All Brands</option>
                        {brands.map((b) => (
                          <option key={b.id} value={b.slug}>
                            {b.name}
                          </option>
                        ))}
                      </select>

                      <label className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-stone-300/90 rounded-full text-stone-800 shadow-2xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inStockOnly}
                          onChange={(e) => setInStockOnly(e.target.checked)}
                        />
                        <span>In Stock Only</span>
                      </label>

                      <select
                        aria-label="Sort products"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="px-4 py-1.5 bg-white border border-stone-300/90 rounded-full text-stone-800 shadow-2xs"
                      >
                        <option value="featured">Sort: Featured</option>
                        <option value="bestseller">Sort: Bestsellers</option>
                        <option value="newest">Sort: New Arrivals</option>
                        <option value="price_asc">Price: Low to High</option>
                        <option value="price_desc">Price: High to Low</option>
                      </select>
                    </div>
                  </div>

                  {/* Product Grid (3 columns on desktop, 2 on tablet, 1 on mobile) */}
                  {filteredProducts.length === 0 ? (
                    <div className="bg-white border border-stone-200/80 rounded-[32px] p-10 text-center space-y-3 shadow-xs">
                      <p className="text-base font-semibold text-stone-900">
                        No matching stationery products found
                      </p>
                      <p className="text-xs text-stone-600">
                        Try clearing your search query or adjusting the brand and price filters.
                      </p>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedCategorySlug('ALL');
                          setSelectedBrandSlug('ALL');
                          setMaxPriceFilterPaise(0);
                          setInStockOnly(false);
                        }}
                        className="px-5 py-2.5 bg-stone-900 text-white text-xs font-medium rounded-full"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                        {filteredProducts.slice(0, visibleProductCount).map((product) => {
                        const selectedVarId =
                          selectedVariantByProduct[product.id] || product.variants?.[0]?.id;
                        const activeVariant =
                          product.variants?.find((v: any) => v.id === selectedVarId) ||
                          product.variants?.[0];
                        const mrp = activeVariant?.mrpPaise || product.mrpPaise;
                        const price = activeVariant?.sellingPricePaise || product.sellingPricePaise;
                        const savingsPercent =
                          mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
                        const stock = activeVariant?.stockQuantity ?? product.totalStock;
                        const isWishlisted = wishlistProductIds.includes(product.id);

                        return (
                          <article
                            key={product.id}
                            className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-[28px] flex flex-col justify-between overflow-hidden shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all"
                          >
                            <div>
                              {/* Product Image / Studio SVG Container */}
                              <div className="relative aspect-square sm:aspect-4/3 border-b border-slate-100 overflow-hidden bg-slate-50/50">
                                <button
                                  onClick={() => openProductDetail(product)}
                                  className="w-full h-full block text-left cursor-pointer"
                                >
                                  <ProductIllustration
                                    type={product.illustrationType}
                                    imageUrl={product.imageUrl}
                                    alt={product.name}
                                  />
                                </button>
                                <button
                                  onClick={() => handleToggleWishlist(product.id)}
                                  aria-label="Save to wishlist"
                                  className="absolute top-2.5 right-2.5 sm:top-3.5 sm:right-3.5 w-7 h-7 sm:w-9 sm:h-9 bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-full shadow-2xs flex items-center justify-center hover:bg-white cursor-pointer"
                                >
                                  <Heart
                                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                                      isWishlisted
                                        ? 'fill-[#B42318] text-[#B42318]'
                                        : 'text-slate-500'
                                    }`}
                                  />
                                </button>
                              </div>

                              {/* Clean Unboxed Metadata & Product Title */}
                              <div className="p-3 sm:p-5 space-y-1 sm:space-y-2">
                                <div className="text-[10px] sm:text-xs text-slate-500 flex items-center flex-wrap gap-1">
                                  <span className="uppercase tracking-wider font-semibold text-slate-600 truncate max-w-[80px] sm:max-w-none">
                                    {product.brandName}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate max-w-[80px] sm:max-w-none">{product.categoryName}</span>
                                </div>

                                <h3 className="text-xs sm:text-base font-semibold text-slate-900 leading-snug line-clamp-2">
                                  <button
                                    onClick={() => openProductDetail(product)}
                                    className="hover:underline text-left cursor-pointer"
                                  >
                                    {product.name}
                                  </button>
                                </h3>

                                <p className="hidden sm:block text-xs text-slate-600 line-clamp-2">
                                  {product.shortDescription}
                                </p>

                                {/* Variant Selector if multiple variants exist */}
                                {product.variants && product.variants.length > 1 && (
                                  <div className="pt-1">
                                    <select
                                      aria-label={`Select variant for ${product.name}`}
                                      value={activeVariant?.id}
                                      onChange={(e) =>
                                        setSelectedVariantByProduct({
                                          ...selectedVariantByProduct,
                                          [product.id]: Number(e.target.value),
                                        })
                                      }
                                      className="w-full px-2 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs bg-slate-50 border border-slate-200 rounded-full text-slate-800"
                                    >
                                      {product.variants.map((v: any) => (
                                        <option key={v.id} value={v.id}>
                                          {v.variantName} — {formatPaiseToINR(v.sellingPricePaise)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Price & Add to Cart Footer */}
                            <div className="p-3 sm:px-5 sm:pb-5 sm:pt-3 border-t border-slate-100 space-y-2 sm:space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3">
                                <div className="font-mono-tabular">
                                  <div className="flex items-baseline gap-1.5">
                                    <span className="text-sm sm:text-[15px] font-bold text-slate-900">
                                      {formatPaiseToINR(price)}
                                    </span>
                                    {mrp > price && (
                                      <span className="text-[10px] sm:text-xs text-slate-400 line-through">
                                        {formatPaiseToINR(mrp)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] sm:text-[11px] text-slate-500">
                                    {savingsPercent > 0 ? `Save ${savingsPercent}% · ` : ''}
                                    {stock > 0 ? `${stock} left` : 'Out of stock'}
                                  </div>
                                </div>

                                <button
                                  disabled={stock <= 0}
                                  onClick={(e) => handleAddToCart(product, activeVariant?.id, 1, e)}
                                  className={`w-full sm:w-auto px-3 sm:px-5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold rounded-full transition-transform active:scale-95 whitespace-nowrap shrink-0 cursor-pointer ${
                                    stock > 0
                                      ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-2xs'
                                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                  }`}
                                >
                                  {stock > 0 ? '+ Add' : 'Out of Stock'}
                                </button>
                              </div>

                              {/* Interactive Swipe / Drag Product into Cart Track (Tablet & Desktop) */}
                              {stock > 0 && (
                                <div className="hidden sm:flex relative h-8 bg-slate-100 border border-slate-200 rounded-full overflow-hidden items-center px-1.5 select-none">
                                  <span className="w-full text-center text-[10px] font-mono text-slate-500 pointer-events-none">
                                    Swipe or Drag into Cart →
                                  </span>
                                  <motion.div
                                    drag="x"
                                    dragConstraints={{ left: 0, right: 0 }}
                                    dragElastic={0.65}
                                    whileTap={{ scale: 0.96, cursor: 'grabbing' }}
                                    onDragEnd={(event, info) => {
                                      if (info.offset.x > 45 || info.velocity.x > 260) {
                                        const targetEl = event.target as HTMLElement | null;
                                        handleAddToCart(product, activeVariant?.id, 1, targetEl);
                                      }
                                    }}
                                    className="absolute left-1 top-1 bottom-1 w-6 h-6 bg-white border border-slate-200 rounded-full shadow-2xs flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-700"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </motion.div>
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    {/* Incremental Pagination Controls */}
                      {filteredProducts.length > visibleProductCount && (
                        <div className="pt-2 flex flex-col items-center justify-center gap-2">
                          <p className="text-xs text-stone-500 font-mono-tabular">
                            Showing {Math.min(visibleProductCount, filteredProducts.length)} of{' '}
                            {filteredProducts.length} stationery products
                          </p>
                          <button
                            type="button"
                            onClick={() => setVisibleProductCount((prev) => prev + 12)}
                            className="px-6 py-2.5 bg-white border border-stone-300 hover:border-stone-900 text-stone-900 text-xs font-semibold rounded-full shadow-2xs transition-colors cursor-pointer"
                          >
                            Load More Products ({filteredProducts.length - visibleProductCount} remaining)
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                {/* School Combos & Bundles Highlight Section */}
                {bundles.length > 0 && selectedCategorySlug === 'ALL' && (
                  <section className="bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-6 lg:p-8 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-stone-200 pb-4">
                      <div>
                        <h2 className="font-serif-display text-xl font-bold text-stone-900">
                          Curated School & Studio Stationery Combos
                        </h2>
                        <p className="text-xs text-stone-600 mt-0.5">
                          Ready-made examination and art supply kits with all items added to your cart in one click.
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveView('combos')}
                        className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200/80 rounded-full text-xs font-semibold text-stone-900 whitespace-nowrap"
                      >
                        View All Combos →
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {bundles.map((bundle) => (
                        <div
                          key={bundle.id}
                          className="p-6 bg-slate-50 border border-slate-200/90 rounded-[28px] flex flex-col justify-between space-y-4"
                        >
                          <div className="space-y-2">
                            <p className="text-xs text-stone-500">
                              {bundle.targetGroup} · Verified Bundle
                            </p>
                            <h3 className="text-base font-bold text-stone-900">{bundle.name}</h3>
                            <p className="text-xs text-stone-600 leading-relaxed">
                              {bundle.description}
                            </p>
                            <ul className="text-xs text-stone-700 space-y-1 pt-1">
                              {(bundle.itemsJson || []).map((item: any, idx: number) => (
                                <li key={idx}>
                                  • {item.quantity}x {item.productName} ({item.variantName})
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="pt-3 border-t border-stone-200 flex items-center justify-between">
                            <div className="font-mono-tabular">
                              <span className="text-sm font-bold text-stone-900">
                                Combined Value: {formatPaiseToINR(bundle.originalTotalPaise)}
                              </span>
                            </div>
                            <button
                              onClick={(e) => handleAddBundleToCart(bundle, e)}
                              className="px-5 py-2.5 bg-[#B42318] text-white text-xs font-semibold rounded-full shadow-2xs hover:bg-[#991B1B] active:scale-95 transition-transform whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Add All Kit Items to Cart
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* VIEW 2: CONTIGUOUS PRODUCT DETAIL PAGE (PDP) */}
            {activeView === 'pdp' && activePdpProduct && (
              <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">
                <button
                  onClick={() => setActiveView('storefront')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-stone-300/90 rounded-full text-xs font-medium text-stone-700 hover:text-stone-950 shadow-2xs cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Catalogue</span>
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start bg-white border border-stone-200/80 rounded-[36px] shadow-xs p-6 lg:p-10">
                  {/* Left: Sticky Product Gallery */}
                  <div className="lg:col-span-6 space-y-4">
                    <div className="aspect-4/3 border border-stone-200/80 rounded-[28px] overflow-hidden">
                      <ProductIllustration
                        type={activePdpProduct.illustrationType}
                        imageUrl={pdpSelectedImageUrl || activePdpProduct.imageUrl}
                        alt={activePdpProduct.name}
                      />
                    </div>
                    {Array.isArray(activePdpProduct.galleryUrls) &&
                      activePdpProduct.galleryUrls.length > 1 && (
                        <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                          {activePdpProduct.galleryUrls.map((gUrl: string, idx: number) => {
                            const isCurrent =
                              (pdpSelectedImageUrl || activePdpProduct.imageUrl) === gUrl;
                            return (
                              <button
                                key={`${idx}-${gUrl.slice(-16)}`}
                                type="button"
                                onClick={() => setPdpSelectedImageUrl(gUrl)}
                                className={`apple-row-btn w-16 h-12 rounded-2xl border overflow-hidden shrink-0 cursor-pointer transition-all ${
                                  isCurrent
                                    ? 'border-stone-900 ring-2 ring-stone-900'
                                    : 'border-stone-300 opacity-75 hover:opacity-100'
                                }`}
                              >
                                <img
                                  src={gUrl}
                                  alt={`${activePdpProduct.name} view ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    <p className="text-xs text-stone-500">
                      SKU: <span className="font-mono-tabular">{activePdpVariant?.sku || activePdpProduct.sku}</span> · Verified Gayatri Stationers Catalogue Item
                    </p>
                  </div>

                  {/* Right: Contiguous Purchase Module */}
                  <div className="lg:col-span-6 space-y-5">
                    <div className="space-y-2 border-b border-stone-200 pb-4">
                      <p className="text-xs text-stone-500">
                        {activePdpProduct.brandName} · {activePdpProduct.categoryName} · GST{' '}
                        {activePdpProduct.taxRatePercent}% Inclusive
                      </p>
                      <h1 className="font-serif-display text-2xl font-bold text-stone-900">
                        {activePdpProduct.name}
                      </h1>
                      <div className="flex items-baseline gap-3 font-mono-tabular pt-1">
                        <span className="text-2xl font-bold text-stone-900">
                          {formatPaiseToINR(
                            activePdpVariant?.sellingPricePaise ||
                              activePdpProduct.sellingPricePaise
                          )}
                        </span>
                        {(activePdpVariant?.mrpPaise || activePdpProduct.mrpPaise) >
                          (activePdpVariant?.sellingPricePaise ||
                            activePdpProduct.sellingPricePaise) && (
                          <span className="text-sm text-stone-400 line-through">
                            MRP:{' '}
                            {formatPaiseToINR(
                              activePdpVariant?.mrpPaise || activePdpProduct.mrpPaise
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-stone-700 leading-relaxed">
                      {activePdpProduct.description}
                    </p>

                    {/* Variant Selection (Apple Oval Pills) */}
                    {activePdpProduct.variants && activePdpProduct.variants.length > 0 && (
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-stone-800">
                          Select Option ({activePdpProduct.variants[0].attributeType}):
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {activePdpProduct.variants.map((v: any) => (
                            <button
                              key={v.id}
                              onClick={() => {
                                setPdpVariantId(v.id);
                                setPdpQuantity(1);
                              }}
                              className={`px-4 py-2 text-xs font-medium rounded-full border transition-all cursor-pointer ${
                                activePdpVariant?.id === v.id
                                  ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                                  : 'bg-white text-stone-800 border-stone-300 hover:border-stone-500'
                              }`}
                            >
                              {v.variantName} · {formatPaiseToINR(v.sellingPricePaise)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quantity Stepper & Stock Guard */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-stone-800">Quantity</span>
                        <span className="font-mono-tabular text-stone-600">
                          Available Stock: {activePdpVariant?.stockQuantity ?? 0} units
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="inline-flex items-center border border-stone-300 rounded-full bg-white p-0.5">
                          <button
                            type="button"
                            onClick={() => setPdpQuantity((q) => Math.max(1, q - 1))}
                            className="p-2 text-stone-700 hover:bg-stone-100 rounded-full"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-4 py-1 text-sm font-mono-tabular font-semibold">
                            {pdpQuantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPdpQuantity((q) =>
                                Math.min(activePdpVariant?.stockQuantity || 1, q + 1)
                              )
                            }
                            className="p-2 text-stone-700 hover:bg-stone-100 rounded-full"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          disabled={(activePdpVariant?.stockQuantity ?? 0) <= 0}
                          onClick={(e) =>
                            handleAddToCart(activePdpProduct, activePdpVariant?.id, pdpQuantity, e)
                          }
                          className="flex-1 py-3 px-6 bg-stone-900 text-white text-xs font-semibold rounded-full shadow-xs hover:bg-stone-800 active:scale-95 transition-transform disabled:bg-stone-300 cursor-pointer"
                        >
                          Add to Cart
                        </button>

                        <button
                          disabled={(activePdpVariant?.stockQuantity ?? 0) <= 0}
                          onClick={(e) => {
                            handleAddToCart(
                              activePdpProduct,
                              activePdpVariant?.id,
                              pdpQuantity,
                              e
                            );
                            setActiveView('checkout');
                          }}
                          className="py-3 px-6 bg-[#B42318] text-white text-xs font-semibold rounded-full shadow-xs hover:bg-[#991B1B] disabled:bg-stone-300 cursor-pointer"
                        >
                          Buy Now
                        </button>
                      </div>
                    </div>

                    {/* Fulfilment Availability Summary */}
                    <div className="p-5 bg-slate-50 border border-slate-200/90 rounded-[24px] space-y-2 text-xs">
                      <p className="font-semibold text-stone-900">
                        Fulfilment Options for this Item:
                      </p>
                      <p className="text-stone-700">
                        • <strong>Store Pickup:</strong>{' '}
                        {activePdpProduct.pickupEligible
                          ? 'Available (Pay Online or Pay at Store Counter upon collection)'
                          : 'Not available for counter pickup'}
                      </p>
                      <p className="text-stone-700">
                        • <strong>Home Delivery:</strong>{' '}
                        {activePdpProduct.deliveryEligible
                          ? 'Available for serviceable PIN codes'
                          : 'Store pickup only'}
                      </p>
                    </div>

                    {/* Specifications Table */}
                    {activePdpProduct.specifications &&
                      Object.keys(activePdpProduct.specifications).length > 0 && (
                        <div className="border-t border-stone-200 pt-4">
                          <h3 className="text-xs font-semibold text-stone-800 mb-2">
                            Product Specifications
                          </h3>
                          <dl className="divide-y divide-stone-200 text-xs">
                            {Object.entries(activePdpProduct.specifications).map(([k, v]) => (
                              <div key={k} className="py-2 flex justify-between gap-4">
                                <dt className="text-stone-500">{k}</dt>
                                <dd className="font-medium text-stone-900 text-right">
                                  {String(v)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 3: SCHOOL COMBOS & BUNDLES */}
            {activeView === 'combos' && (
              <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
                <div>
                  <h1 className="font-serif-display text-2xl font-bold text-stone-900">
                    School Supply Bundles & Stationery Combos
                  </h1>
                  <p className="text-xs text-stone-600 mt-1">
                    Add complete examination kits or fine-art studio packs directly to your cart.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {bundles.map((b) => (
                    <div
                      key={b.id}
                      className="bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-6 sm:p-7 flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2">
                        <p className="text-xs text-stone-500">{b.targetGroup}</p>
                        <h2 className="text-lg font-bold text-stone-900">{b.name}</h2>
                        <p className="text-xs text-stone-600">{b.description}</p>
                        <div className="pt-2 space-y-1 text-xs text-stone-800">
                          {(b.itemsJson || []).map((item: any, idx: number) => (
                            <div key={idx}>
                              • {item.quantity}x {item.productName} ({item.variantName})
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="pt-4 border-t border-stone-200 flex items-center justify-between">
                        <span className="font-mono-tabular text-sm font-bold">
                          Kit Total: {formatPaiseToINR(b.originalTotalPaise)}
                        </span>
                        <button
                          onClick={(e) => handleAddBundleToCart(b, e)}
                          className="px-5 py-2.5 bg-[#B42318] text-white text-xs font-semibold rounded-full shadow-2xs hover:bg-[#991B1B] active:scale-95 transition-transform cursor-pointer"
                        >
                          Add Bundle Items to Cart
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* VIEW 4: INSTITUTIONAL BULK ORDERS */}
            {activeView === 'bulk' && (
              <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
                <div>
                  <h1 className="font-serif-display text-2xl font-bold text-stone-900">
                    Bulk Orders for Schools, Colleges & Offices
                  </h1>
                  <p className="text-xs text-stone-600 mt-1">
                    Submit your institutional requirement list for custom wholesale pricing and GST tax invoicing.
                  </p>
                </div>

                {bulkSubmittedEnquiry ? (
                  <div className="bg-white border border-emerald-300 rounded-[32px] p-6 sm:p-8 space-y-3 shadow-xs">
                    <h2 className="text-lg font-bold text-emerald-950">
                      Bulk Enquiry Received — Reference #{bulkSubmittedEnquiry.enquiryNumber}
                    </h2>
                    <p className="text-xs text-stone-700">
                      Thank you, <strong>{bulkSubmittedEnquiry.contactPerson}</strong> (
                      {bulkSubmittedEnquiry.institutionName}). Our wholesale desk has logged your enquiry and will contact you shortly with a formal quotation.
                    </p>
                    <button
                      onClick={() => setBulkSubmittedEnquiry(null)}
                      className="px-5 py-2.5 bg-stone-900 text-white text-xs font-medium rounded-full"
                    >
                      Submit Another Enquiry
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={handleSubmitBulkEnquiry}
                    className="bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-6 sm:p-8 space-y-5 text-sm"
                  >
                    {bulkError && (
                      <div className="p-3.5 bg-red-50 border border-red-200 rounded-3xl text-xs text-red-900">
                        {bulkError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          School / Office / Institution Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={bulkForm.institutionName}
                          onChange={(e) =>
                            setBulkForm({ ...bulkForm, institutionName: e.target.value })
                          }
                          placeholder="e.g. St. Peter's Senior Secondary School"
                          className="w-full px-4 py-2 border border-stone-300 rounded-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Contact Person Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={bulkForm.contactPerson}
                          onChange={(e) =>
                            setBulkForm({ ...bulkForm, contactPerson: e.target.value })
                          }
                          placeholder="Purchase Officer / Principal Name"
                          className="w-full px-4 py-2 border border-stone-300 rounded-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Phone Number *
                        </label>
                        <input
                          type="tel"
                          required
                          value={bulkForm.phone}
                          onChange={(e) => setBulkForm({ ...bulkForm, phone: e.target.value })}
                          placeholder="10-digit mobile or landline"
                          className="w-full px-4 py-2 border border-stone-300 rounded-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Official Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={bulkForm.email}
                          onChange={(e) => setBulkForm({ ...bulkForm, email: e.target.value })}
                          placeholder="office@institution.edu.in"
                          className="w-full px-4 py-2 border border-stone-300 rounded-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          GSTIN (Optional — for B2B Input Tax Credit)
                        </label>
                        <input
                          type="text"
                          value={bulkForm.gstin}
                          onChange={(e) =>
                            setBulkForm({ ...bulkForm, gstin: e.target.value.toUpperCase() })
                          }
                          placeholder="e.g. 09AAACG1234A1Z5"
                          className="w-full px-4 py-2 border border-stone-300 rounded-full font-mono-tabular"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Required Delivery / Pickup Date
                        </label>
                        <input
                          type="date"
                          value={bulkForm.requiredByDate}
                          onChange={(e) =>
                            setBulkForm({ ...bulkForm, requiredByDate: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-stone-300 rounded-full"
                        />
                      </div>
                    </div>

                    {/* Requested Items List */}
                    <div className="space-y-3 border-t border-stone-200 pt-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-stone-800">
                          Stationery Items & Quantities Requested
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setBulkItems([
                              ...bulkItems,
                              { itemName: '', skuOrCategory: 'Notebooks & Diaries', quantity: 50 },
                            ])
                          }
                          className="px-3.5 py-1 bg-slate-100 hover:bg-slate-200/80 rounded-full text-xs font-semibold text-stone-900"
                        >
                          + Add Item Row
                        </button>
                      </div>

                      {bulkItems.map((row, idx) => (
                        <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Item description (e.g. A4 Ruled Registers 240p)"
                            value={row.itemName}
                            onChange={(e) => {
                              const next = [...bulkItems];
                              next[idx].itemName = e.target.value;
                              setBulkItems(next);
                            }}
                            className="sm:col-span-6 px-4 py-1.5 text-xs border border-stone-300 rounded-full"
                          />
                          <input
                            type="text"
                            placeholder="Category or SKU"
                            value={row.skuOrCategory}
                            onChange={(e) => {
                              const next = [...bulkItems];
                              next[idx].skuOrCategory = e.target.value;
                              setBulkItems(next);
                            }}
                            className="sm:col-span-3 px-4 py-1.5 text-xs border border-stone-300 rounded-full"
                          />
                          <input
                            type="number"
                            min={1}
                            required
                            value={row.quantity}
                            onChange={(e) => {
                              const next = [...bulkItems];
                              next[idx].quantity = Number(e.target.value);
                              setBulkItems(next);
                            }}
                            className="sm:col-span-2 px-4 py-1.5 text-xs border border-stone-300 rounded-full font-mono-tabular"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setBulkItems(bulkItems.filter((_, i) => i !== idx))
                            }
                            className="sm:col-span-1 text-xs text-red-700 hover:underline rounded-full"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Custom Printing / Packaging or Delivery Notes
                      </label>
                      <textarea
                        rows={3}
                        value={bulkForm.notes}
                        onChange={(e) => setBulkForm({ ...bulkForm, notes: e.target.value })}
                        placeholder="Mention custom school crest printing, class-wise bundling, or delivery schedule..."
                        className="w-full px-4 py-2.5 border border-stone-300 rounded-[24px] text-xs"
                      />
                    </div>

                    <button
                      type="submit"
                      className="px-6 py-3 bg-[#B42318] text-white text-xs font-semibold rounded-full shadow-xs hover:bg-[#991B1B]"
                    >
                      Submit Institutional Bulk Enquiry
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* VIEW 5: ACCOUNT-BOUND ORDER TRACKING & STORE PICKUP PASS */}
            {activeView === 'track' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
                {/* Responsive Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-stone-200 pb-4">
                  <div>
                    <h1 className="font-serif-display text-xl sm:text-2xl font-bold text-stone-900">
                      My Account Orders & Live Order Tracking
                    </h1>
                    <p className="text-xs sm:text-sm text-stone-600 mt-1">
                      Orders are privately assigned to one account only and are visible exclusively when signed in to that account.
                    </p>
                  </div>
                  {dbUser && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-full text-xs font-medium text-stone-800 shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      <span>Signed in as: <strong>{dbUser.email}</strong></span>
                    </div>
                  )}
                </div>

                {!dbUser ? (
                  <div className="bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-8 sm:p-12 text-center max-w-xl mx-auto space-y-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-stone-900 flex items-center justify-center mx-auto font-bold text-lg">
                      🔒
                    </div>
                    <h2 className="font-serif-display text-xl font-bold text-stone-900">
                      Sign In Required to View Your Orders
                    </h2>
                    <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                      For your privacy, orders are never shown when signed out and are strictly assigned to the single account that placed them. Please sign in to view or track your orders.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setCustomerAuthModalOpen(true)}
                        className="px-6 py-3 bg-[#B42318] text-white text-xs sm:text-sm font-semibold rounded-full shadow-xs hover:bg-[#991B1B] cursor-pointer"
                      >
                        Sign In to Your Account
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveView('storefront')}
                        className="px-5 py-3 bg-slate-100 text-stone-800 text-xs sm:text-sm font-medium rounded-full hover:bg-slate-200 cursor-pointer"
                      >
                        Back to Storefront
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Search Lookup Bar (Order Number + Phone Number within Signed-In Account) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      <form
                        onSubmit={handleTrackOrder}
                        className="lg:col-span-7 bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-4 flex flex-col sm:flex-row gap-2.5"
                      >
                        <input
                          type="text"
                          value={trackOrderNumberInput}
                          onChange={(e) => setTrackOrderNumberInput(e.target.value.toUpperCase())}
                          placeholder="Enter Your Order Number (e.g. GS-261017-6294)"
                          className="flex-1 px-4 py-2 text-xs sm:text-sm border border-stone-300 rounded-full font-mono-tabular"
                        />
                        <button
                          type="submit"
                          className="px-5 py-2.5 bg-[#B42318] text-white text-xs font-semibold rounded-full shadow-2xs hover:bg-[#991B1B] whitespace-nowrap cursor-pointer"
                        >
                          Track Order #
                        </button>
                      </form>

                      <div className="lg:col-span-5 bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-4 flex flex-col sm:flex-row gap-2.5">
                        <input
                          type="tel"
                          placeholder="Filter your orders by phone..."
                          value={trackPhoneInput}
                          onChange={(e) => setTrackPhoneInput(e.target.value)}
                          className="flex-1 px-4 py-2 text-xs sm:text-sm border border-stone-300 rounded-full font-mono-tabular"
                        />
                        <button
                          type="button"
                          onClick={handleLoadMyOrders}
                          className="px-5 py-2.5 bg-stone-900 text-white text-xs font-semibold rounded-full shadow-2xs hover:bg-stone-800 whitespace-nowrap cursor-pointer"
                        >
                          Filter
                        </button>
                      </div>
                    </div>

                    {trackError && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-3xl text-xs text-red-900">
                        {trackError}
                      </div>
                    )}

                    {/* Responsive Two-Column Split: Left = Signed-In Account Orders, Right = Visual Order Tracker */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* Left Column: Orders Assigned to Signed-In Account */}
                      <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-[28px] sm:rounded-[32px] shadow-xs overflow-hidden">
                        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h2 className="text-sm font-bold text-slate-900">
                                My Account Orders
                              </h2>
                              <p className="text-[11px] text-slate-500 font-mono-tabular">
                                {myOrdersList.length} total orders
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleLoadMyOrders}
                              className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs"
                            >
                              Refresh
                            </button>
                          </div>

                          {/* Date-Range Filter Selector (Last 30 days, Last 3 months, Last 6 months, All time) */}
                          <div className="space-y-1.5 pt-1 border-t border-slate-200/70">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                <span>Period:</span>
                              </span>
                              {orderDateRangeFilter !== 'ALL_TIME' && (
                                <button
                                  type="button"
                                  onClick={() => setOrderDateRangeFilter('ALL_TIME')}
                                  className="text-[10px] text-slate-500 hover:text-slate-900 underline cursor-pointer"
                                >
                                  Clear filter
                                </button>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 text-[11px]">
                              {[
                                { id: '30_DAYS', label: 'Last 30 days' },
                                { id: '3_MONTHS', label: 'Last 3 months' },
                                { id: '6_MONTHS', label: 'Last 6 months' },
                                { id: 'ALL_TIME', label: 'All time' },
                              ].map((dr) => (
                                <button
                                  key={dr.id}
                                  type="button"
                                  onClick={() => setOrderDateRangeFilter(dr.id as any)}
                                  className={`px-2.5 py-1 rounded-full text-[11px] transition-all cursor-pointer ${
                                    orderDateRangeFilter === dr.id
                                      ? 'bg-slate-900 text-white font-medium shadow-2xs'
                                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  {dr.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Status Filter Tabs */}
                          <div className="space-y-1.5 pt-1 border-t border-slate-200/70">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                              <span>Status Filter:</span>
                            </div>
                            <div className="flex flex-wrap gap-1 text-[11px]">
                              {[
                                { id: 'ALL', label: 'All' },
                                { id: 'ACTION_NEEDED', label: 'Needs Action' },
                                { id: 'READY_PICKUP', label: 'Ready Pickup' },
                                { id: 'IN_TRANSIT', label: 'Dispatched' },
                                { id: 'COMPLETED', label: 'Completed' },
                              ].map((tab) => (
                                <button
                                  key={tab.id}
                                  type="button"
                                  onClick={() => setTrackBoardFilter(tab.id as any)}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                                    trackBoardFilter === tab.id
                                      ? 'bg-slate-900 text-white shadow-2xs'
                                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  {tab.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {myOrdersList.length === 0 ? (
                          <div className="p-6 text-center space-y-3 text-xs text-slate-500">
                            <p>
                              No orders are assigned to <strong>{dbUser.email}</strong> yet. Any order you place while signed in will appear here.
                            </p>
                            <button
                              type="button"
                              onClick={() => setActiveView('storefront')}
                              className="px-5 py-2 bg-slate-900 text-white font-semibold rounded-full cursor-pointer hover:bg-slate-800"
                            >
                              Browse Catalogue
                            </button>
                          </div>
                        ) : (() => {
                          const filteredOrders = myOrdersList.filter((entry: any) => {
                            // 1. Status Filter
                            const st = entry.order.orderStatus;
                            if (trackBoardFilter === 'ACTION_NEEDED') {
                              if (!['ORDER_PLACED', 'CONFIRMED', 'PREPARING', 'PACKED'].includes(st)) {
                                return false;
                              }
                            } else if (trackBoardFilter === 'READY_PICKUP') {
                              if (st !== 'READY_FOR_PICKUP') return false;
                            } else if (trackBoardFilter === 'IN_TRANSIT') {
                              if (!['DISPATCHED', 'OUT_FOR_DELIVERY'].includes(st)) return false;
                            } else if (trackBoardFilter === 'COMPLETED') {
                              if (!['COLLECTED', 'DELIVERED'].includes(st)) return false;
                            }

                            // 2. Date-Range Filter
                            if (orderDateRangeFilter !== 'ALL_TIME') {
                              const rawDate = entry.order.createdAt;
                              if (rawDate) {
                                const orderTs = new Date(rawDate).getTime();
                                if (!isNaN(orderTs)) {
                                  const now = Date.now();
                                  if (orderDateRangeFilter === '30_DAYS') {
                                    if (now - orderTs > 30 * 24 * 60 * 60 * 1000) return false;
                                  } else if (orderDateRangeFilter === '3_MONTHS') {
                                    if (now - orderTs > 90 * 24 * 60 * 60 * 1000) return false;
                                  } else if (orderDateRangeFilter === '6_MONTHS') {
                                    if (now - orderTs > 180 * 24 * 60 * 60 * 1000) return false;
                                  }
                                }
                              }
                            }

                            return true;
                          });

                          if (filteredOrders.length === 0) {
                            return (
                              <div className="p-6 text-center space-y-3 text-xs text-slate-500">
                                <p className="font-semibold text-slate-700">
                                  No orders match your selected filters.
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  Try switching to "All time" or clearing the status filter.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOrderDateRangeFilter('ALL_TIME');
                                    setTrackBoardFilter('ALL');
                                  }}
                                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-full cursor-pointer transition-colors"
                                >
                                  Reset All Filters
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
                              <div className="px-4 py-2 bg-slate-50/70 flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-100 font-mono-tabular">
                                <span>Showing {filteredOrders.length} of {myOrdersList.length} orders</span>
                                {orderDateRangeFilter !== 'ALL_TIME' && (
                                  <span className="text-[10px] font-semibold text-[#B42318]">
                                    {orderDateRangeFilter.replace('_', ' ')}
                                  </span>
                                )}
                              </div>
                              {filteredOrders.map((entry: any) => {
                                const isSelected = trackedOrderResult?.order?.id === entry.order.id;
                                const formattedDate = entry.order.createdAt
                                  ? new Date(entry.order.createdAt).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    })
                                  : null;

                                return (
                                  <button
                                    key={entry.order.id}
                                    type="button"
                                    onClick={() => {
                                      setTrackedOrderResult(entry);
                                      setTrackOrderNumberInput(entry.order.orderNumber);
                                    }}
                                    className={`w-full p-4 text-left transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                                      isSelected
                                        ? 'bg-amber-50/90 border-l-4 border-l-[#B42318]'
                                        : 'hover:bg-slate-50/80'
                                    }`}
                                  >
                                    <div className="space-y-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono-tabular font-bold text-xs sm:text-sm text-slate-900">
                                          {entry.order.orderNumber}
                                        </span>
                                        {entry.pickupDetails && (
                                          <span className="font-mono-tabular text-[11px] px-2 py-0.5 bg-amber-100 text-amber-950 rounded-full font-semibold">
                                            Code: {entry.pickupDetails.pickupCode}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs font-medium text-slate-800 truncate">
                                        {entry.order.customerName} · {entry.order.customerPhone}
                                      </p>
                                      <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                                        <span>{entry.order.fulfilmentMethod.replace('_', ' ')}</span>
                                        <span>·</span>
                                        <strong className="text-slate-800">
                                          {entry.order.orderStatus.replace(/_/g, ' ')}
                                        </strong>
                                        {formattedDate && (
                                          <>
                                            <span>·</span>
                                            <span className="inline-flex items-center gap-1 font-mono-tabular text-slate-500">
                                              <Calendar className="w-3 h-3 text-slate-400" />
                                              {formattedDate}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    <div className="text-right font-mono-tabular shrink-0">
                                      <p className="text-xs font-bold text-slate-900">
                                        {formatPaiseToINR(entry.order.totalPaise)}
                                      </p>
                                      <p
                                        className={`text-[11px] font-semibold ${
                                          entry.order.paymentStatus === 'PAID'
                                            ? 'text-emerald-700'
                                            : 'text-amber-700'
                                        }`}
                                      >
                                        {entry.order.paymentStatus}
                                      </p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Right Column: Full Visual Order Tracking Timeline */}
                      <div className="lg:col-span-8">
                        {trackedOrderResult ? (
                          <OrderTrackingTimeline
                            orderEntry={trackedOrderResult}
                            isOwnerOrStaff={Boolean(
                              dbUser && (dbUser.role === 'owner' || dbUser.role === 'staff')
                            )}
                            idToken={idToken}
                            onOrderUpdated={async (updatedEntry) => {
                              if (updatedEntry) {
                                setTrackedOrderResult(updatedEntry);
                              }
                              await handleLoadMyOrders();
                              await loadStoreBootstrap();
                            }}
                          />
                        ) : (
                          <div className="bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-8 text-center space-y-3">
                            <p className="text-base font-semibold text-stone-900">
                              Select an order from your account list on the left
                            </p>
                            <p className="text-xs text-stone-600 max-w-md mx-auto">
                              View the live multi-stage fulfilment progress bar, Store Pickup verification code, and Home Delivery courier tracking details.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* VIEW 6: WISHLIST */}
            {activeView === 'wishlist' && (
              <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h1 className="font-serif-display text-2xl font-bold text-stone-900">
                    Saved Wishlist ({wishlistProductIds.length})
                  </h1>
                  <button
                    onClick={() => setActiveView('storefront')}
                    className="px-4 py-2 bg-white border border-stone-300 rounded-full text-xs font-medium hover:border-stone-900"
                  >
                    Continue Shopping
                  </button>
                </div>

                {wishlistProductIds.length === 0 ? (
                  <div className="bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-10 text-center text-sm text-stone-600">
                    Your wishlist is empty. Click the heart icon on any stationery item to save it for later.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products
                      .filter((p) => wishlistProductIds.includes(p.id))
                      .map((p) => (
                        <div
                          key={p.id}
                          className="bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-5 flex flex-col justify-between space-y-4 overflow-hidden"
                        >
                          <div>
                            <div className="aspect-4/3 mb-3 rounded-[22px] overflow-hidden">
                              <ProductIllustration
                                type={p.illustrationType}
                                imageUrl={p.imageUrl}
                                alt={p.name}
                              />
                            </div>
                            <h3 className="font-semibold text-sm text-stone-900">{p.name}</h3>
                            <p className="text-xs text-stone-500 font-mono-tabular mt-1">
                              {formatPaiseToINR(p.sellingPricePaise)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => handleAddToCart(p, undefined, 1, e)}
                              className="flex-1 py-2.5 bg-stone-900 text-white text-xs font-medium rounded-full active:scale-95 transition-transform cursor-pointer"
                            >
                              Move to Cart
                            </button>
                            <button
                              onClick={() => handleToggleWishlist(p.id)}
                              className="px-4 py-2.5 border border-stone-300 text-xs rounded-full cursor-pointer hover:bg-stone-50"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* VIEW 7: COMPLETE 4-STEP CHECKOUT (Store Pickup vs Home Delivery) */}
            {activeView === 'checkout' && (
              <div className="max-w-6xl mx-auto px-6 py-8">
                <button
                  onClick={() => setActiveView('storefront')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-stone-300/90 rounded-full text-xs font-medium text-stone-700 hover:text-stone-950 mb-6 shadow-2xs cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to Catalogue</span>
                </button>

                {cartItems.length === 0 ? (
                  <div className="bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-8 text-center space-y-3">
                    <p className="text-base font-semibold">Your cart is empty</p>
                    <button
                      onClick={() => setActiveView('storefront')}
                      className="px-5 py-2.5 bg-stone-900 text-white text-xs font-medium rounded-full"
                    >
                      Browse Stationery
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={handlePlaceOrder}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
                  >
                    <div className="lg:col-span-7 space-y-6">
                      <h1 className="font-serif-display text-2xl font-bold text-stone-900">
                        Checkout & Fulfilment Selection
                      </h1>

                      {!dbUser ? (
                        <div className="p-5 bg-slate-50 border border-slate-200 rounded-[28px] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1 text-xs">
                            <p className="font-bold text-stone-900">
                              Sign In Required to Place an Order
                            </p>
                            <p className="text-stone-600">
                              Orders are assigned strictly to one account. Please sign in so this order is linked privately to your account.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCustomerAuthModalOpen(true)}
                            className="px-5 py-2.5 bg-[#B42318] text-white text-xs font-semibold rounded-full shadow-2xs hover:bg-[#991B1B] whitespace-nowrap cursor-pointer"
                          >
                            Sign In to Account
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-[24px] flex items-center justify-between gap-3 text-xs text-emerald-950">
                          <span>
                            Order will be assigned exclusively to account: <strong>{dbUser.email}</strong>
                          </span>
                        </div>
                      )}

                      {checkoutError && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-3xl text-xs text-red-900 space-y-1">
                          <p className="font-bold">Checkout Validation Notice</p>
                          <p>{checkoutError}</p>
                        </div>
                      )}

                      {/* STEP 1: Customer Information */}
                      <div className="bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-6 space-y-4">
                        <h2 className="text-sm font-bold text-stone-900">
                          01. Customer Contact Details
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div>
                            <label className="block text-xs font-medium text-stone-700 mb-1">
                              Full Name *
                            </label>
                            <input
                              type="text"
                              required
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                              placeholder="Enter full name"
                              className="w-full px-4 py-2 border border-stone-300 rounded-full"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-700 mb-1">
                              10-Digit Mobile Number *
                            </label>
                            <input
                              type="tel"
                              required
                              value={customerPhone}
                              onChange={(e) => setCustomerPhone(e.target.value)}
                              placeholder="For pickup code / delivery updates"
                              className="w-full px-4 py-2 border border-stone-300 rounded-full font-mono-tabular"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-stone-700 mb-1">
                              Email Address (Optional — for GST invoice & receipt)
                            </label>
                            <input
                              type="email"
                              value={customerEmail}
                              onChange={(e) => setCustomerEmail(e.target.value)}
                              placeholder="you@example.com"
                              className="w-full px-4 py-2 border border-stone-300 rounded-full"
                            />
                          </div>
                        </div>
                      </div>

                      {/* STEP 2: Fulfilment Method (Store Pickup vs Home Delivery) */}
                      <div className="bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-6 space-y-4">
                        <h2 className="text-sm font-bold text-stone-900">
                          02. Choose Fulfilment Method
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <button
                            type="button"
                            onClick={() => setFulfilmentMethod('STORE_PICKUP')}
                            className={`apple-card-btn p-4 rounded-[26px] border text-left transition-colors cursor-pointer ${
                              fulfilmentMethod === 'STORE_PICKUP'
                                ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                                : 'bg-slate-50 text-stone-900 border-stone-300 hover:border-stone-500'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider">
                                Option A: Store Pickup
                              </span>
                              <span className="font-mono-tabular text-xs font-semibold">FREE</span>
                            </div>
                            <p
                              className={`text-xs mt-1.5 ${
                                fulfilmentMethod === 'STORE_PICKUP'
                                  ? 'text-stone-300'
                                  : 'text-stone-600'
                              }`}
                            >
                              Collect from Gayatri Stationers counter once marked Ready for Pickup.
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setFulfilmentMethod('HOME_DELIVERY')}
                            className={`apple-card-btn p-4 rounded-[26px] border text-left transition-colors cursor-pointer ${
                              fulfilmentMethod === 'HOME_DELIVERY'
                                ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                                : 'bg-slate-50 text-stone-900 border-stone-300 hover:border-stone-500'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider">
                                Option B: Home Delivery
                              </span>
                              <span className="font-mono-tabular text-xs font-semibold">
                                {calculation.shippingPaise === 0
                                  ? 'FREE'
                                  : formatPaiseToINR(calculation.shippingPaise)}
                              </span>
                            </div>
                            <p
                              className={`text-xs mt-1.5 ${
                                fulfilmentMethod === 'HOME_DELIVERY'
                                  ? 'text-stone-300'
                                  : 'text-stone-600'
                              }`}
                            >
                              Doorstep dispatch to serviceable PIN codes with tracking.
                            </p>
                          </button>
                        </div>

                        {fulfilmentMethod === 'STORE_PICKUP' ? (
                          <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-[24px] space-y-3 text-xs">
                            <div>
                              <p className="font-semibold text-stone-900">
                                Pickup Counter Information:
                              </p>
                              <p className="text-stone-700 mt-0.5">
                                {storeSettings?.store_profile?.pickupCounterLabel}
                              </p>
                              <p className="text-stone-500 mt-0.5">
                                Hours: {storeSettings?.store_profile?.businessHoursNote}
                              </p>
                            </div>
                            <div>
                              <label className="block font-medium text-stone-700 mb-1">
                                Preferred Collection Window
                              </label>
                              <select
                                value={pickupWindow}
                                onChange={(e) => setPickupWindow(e.target.value)}
                                className="w-full px-4 py-2 bg-white border border-stone-300 rounded-full text-stone-900"
                              >
                                {(
                                  storeSettings?.fulfilment_rules?.scheduledPickupWindows || [
                                    'Today — Within 2 Hours of Ready Notification',
                                    'Morning Counter Slot (10:30 AM – 1:30 PM)',
                                    'Afternoon Counter Slot (2:00 PM – 5:00 PM)',
                                    'Evening Counter Slot (5:00 PM – 7:30 PM)',
                                  ]
                                ).map((slot: string) => (
                                  <option key={slot} value={slot}>
                                    {slot}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <p className="text-stone-600">
                              Note: You will receive a 6-character <strong>Pickup Code</strong> on confirmation. Collection is enabled as soon as store staff prepares your items and marks the order <strong>Ready for Pickup</strong>.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3 pt-2 text-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-stone-700 mb-1">
                                  6-Digit Delivery PIN Code *
                                </label>
                                <input
                                  type="text"
                                  required
                                  maxLength={6}
                                  value={shippingAddress.pincode}
                                  onChange={(e) =>
                                    setShippingAddress({
                                      ...shippingAddress,
                                      pincode: e.target.value,
                                    })
                                  }
                                  placeholder="e.g. 282010"
                                  className="w-full px-4 py-2 border border-stone-300 rounded-full font-mono-tabular"
                                />
                              </div>
                              <div className="flex items-end">
                                {matchedPincodeRule ? (
                                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 w-full">
                                    Serviceable: {matchedPincodeRule.city} (
                                    {matchedPincodeRule.estimatedDays}) · Free above{' '}
                                    {formatPaiseToINR(
                                      matchedPincodeRule.freeDeliveryThresholdPaise
                                    )}
                                  </div>
                                ) : (
                                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 w-full">
                                    PIN not in active list. Try{' '}
                                    {serviceablePincodes
                                      .slice(0, 3)
                                      .map((p) => p.pincode)
                                      .join(', ')}{' '}
                                    or select Store Pickup.
                                  </div>
                                )}
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-stone-700 mb-1">
                                House / Flat / Building & Street Address *
                              </label>
                              <input
                                type="text"
                                required
                                value={shippingAddress.addressLine1}
                                onChange={(e) =>
                                  setShippingAddress({
                                    ...shippingAddress,
                                    addressLine1: e.target.value,
                                  })
                                }
                                placeholder="House No., Street, Locality"
                                className="w-full px-4 py-2 border border-stone-300 rounded-full"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-stone-700 mb-1">
                                  City / District *
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={shippingAddress.city}
                                  onChange={(e) =>
                                    setShippingAddress({
                                      ...shippingAddress,
                                      city: e.target.value,
                                    })
                                  }
                                  className="w-full px-4 py-2 border border-stone-300 rounded-full"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-stone-700 mb-1">
                                  State *
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={shippingAddress.state}
                                  onChange={(e) =>
                                    setShippingAddress({
                                      ...shippingAddress,
                                      state: e.target.value,
                                    })
                                  }
                                  className="w-full px-4 py-2 border border-stone-300 rounded-full"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* STEP 3: Payment Method */}
                      <div className="bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-6 space-y-4">
                        <h2 className="text-sm font-bold text-stone-900">
                          03. Select Payment Method
                        </h2>

                        <div className="space-y-2.5 text-xs">
                          {fulfilmentMethod === 'STORE_PICKUP' && (
                            <label className="flex items-start gap-3 p-4 border border-stone-300 rounded-[24px] cursor-pointer hover:bg-stone-50">
                              <input
                                type="radio"
                                name="paymentMethod"
                                checked={paymentMethod === 'PAY_AT_STORE'}
                                onChange={() => setPaymentMethod('PAY_AT_STORE')}
                                className="mt-0.5"
                              />
                              <div>
                                <p className="font-bold text-stone-900">
                                  Pay at Store Counter (Cash / UPI on Collection)
                                </p>
                                <p className="text-stone-600 mt-0.5">
                                  Your items are reserved immediately. Payment status remains Pending until staff records your payment at pickup.
                                </p>
                              </div>
                            </label>
                          )}

                          {fulfilmentMethod === 'HOME_DELIVERY' && (
                            <label className="flex items-start gap-3 p-4 border border-stone-300 rounded-[24px] cursor-pointer hover:bg-stone-50">
                              <input
                                type="radio"
                                name="paymentMethod"
                                checked={paymentMethod === 'COD'}
                                onChange={() => setPaymentMethod('COD')}
                                className="mt-0.5"
                              />
                              <div>
                                <p className="font-bold text-stone-900">
                                  Cash on Delivery (COD)
                                </p>
                                <p className="text-stone-600 mt-0.5">
                                  {matchedPincodeRule?.codAvailable
                                    ? `Available for PIN ${shippingAddress.pincode}. Pay ${formatPaiseToINR(
                                        calculation.totalPaise
                                      )} upon doorstep delivery.`
                                    : 'Available only on COD-enabled PIN codes.'}
                                </p>
                              </div>
                            </label>
                          )}

                          <label className="flex items-start gap-3 p-4 border border-emerald-300 bg-emerald-50/20 rounded-[24px] cursor-pointer hover:bg-emerald-50/40">
                            <input
                              type="radio"
                              name="paymentMethod"
                              checked={paymentMethod === 'CASHFREE_ONLINE'}
                              onChange={() => setPaymentMethod('CASHFREE_ONLINE')}
                              className="mt-0.5 accent-emerald-700"
                            />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-stone-900">
                                  Cashfree Payments (Google Pay, PhonePe, Paytm, UPI, Cards & NetBanking)
                                </p>
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                                  INSTANT & SECURE
                                </span>
                              </div>
                              <p className="text-stone-600 mt-1">
                                {paymentGatewayStatus.cashfreeConfigured
                                  ? `Verified Cashfree ${paymentGatewayStatus.cashfreeEnvironment === 'SANDBOX' ? 'Sandbox' : 'Production'} Payment Gateway. Opens drop-in modal checkout.`
                                  : 'Requires CASHFREE_APP_ID & CASHFREE_SECRET_KEY in Admin Settings or .env file.'}
                              </p>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Server-Validated Order Summary */}
                    <div className="lg:col-span-5 bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-6 sm:p-7 space-y-5 sticky top-20">
                      <h2 className="text-base font-bold text-stone-900 border-b border-stone-200 pb-3">
                        Server-Validated Order Summary
                      </h2>

                      <div className="space-y-2.5 max-h-64 overflow-y-auto text-xs">
                        {calculation.items.map((item: any) => (
                          <div
                            key={`${item.productId}-${item.variantId}`}
                            className="flex justify-between gap-3 py-1.5 border-b border-stone-100"
                          >
                            <div>
                              <p className="font-semibold text-stone-900">
                                {item.quantity}x {item.productName}
                              </p>
                              <p className="text-stone-500">{item.variantName}</p>
                            </div>
                            <span className="font-mono-tabular font-medium shrink-0">
                              {formatPaiseToINR(item.lineSubtotalPaise)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Coupon Application */}
                      <div className="space-y-2 pt-2 border-t border-stone-200">
                        <label className="block text-xs font-medium text-stone-700">
                          Promo / Coupon Code
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={couponInput}
                            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                            placeholder="e.g. BACKTOSCHOOL10"
                            className="flex-1 px-4 py-1.5 text-xs border border-stone-300 rounded-full font-mono-tabular"
                          />
                          <button
                            type="button"
                            onClick={() => setAppliedCouponCode(couponInput)}
                            className="px-4 py-1.5 bg-stone-900 text-white text-xs font-medium rounded-full"
                          >
                            Apply
                          </button>
                        </div>
                        {calculation.couponMessage && (
                          <p className="text-xs text-emerald-800">{calculation.couponMessage}</p>
                        )}
                      </div>

                      {/* Price Breakdown in Integer Paise */}
                      <div className="space-y-2 text-xs border-t border-stone-200 pt-3 font-mono-tabular">
                        <div className="flex justify-between text-stone-600">
                          <span>Items Subtotal (Incl. GST)</span>
                          <span>{formatPaiseToINR(calculation.subtotalPaise)}</span>
                        </div>
                        {calculation.catalogSavingsPaise > 0 && (
                          <div className="flex justify-between text-emerald-700">
                            <span>Savings on MRP</span>
                            <span>-{formatPaiseToINR(calculation.catalogSavingsPaise)}</span>
                          </div>
                        )}
                        {calculation.couponDiscountPaise > 0 && (
                          <div className="flex justify-between text-emerald-700 font-semibold">
                            <span>Coupon ({calculation.appliedCouponCode})</span>
                            <span>-{formatPaiseToINR(calculation.couponDiscountPaise)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-stone-600">
                          <span>
                            {fulfilmentMethod === 'STORE_PICKUP'
                              ? 'Store Pickup Fee'
                              : 'Home Delivery Shipping'}
                          </span>
                          <span>
                            {calculation.shippingPaise === 0
                              ? 'FREE'
                              : formatPaiseToINR(calculation.shippingPaise)}
                          </span>
                        </div>
                        <div className="flex justify-between text-stone-500 text-[11px]">
                          <span>Included GST Component</span>
                          <span>{formatPaiseToINR(calculation.taxPaise, true)}</span>
                        </div>
                        <div className="flex justify-between text-base font-bold text-stone-900 border-t border-stone-200 pt-3">
                          <span>Final Payable Total</span>
                          <span>{formatPaiseToINR(calculation.totalPaise)}</span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={checkoutSubmitting}
                        className="w-full py-3.5 bg-[#B42318] text-white text-sm font-semibold rounded-full shadow-xs hover:bg-[#991B1B] disabled:opacity-50 cursor-pointer"
                      >
                        {checkoutSubmitting
                          ? 'Validating Stock & Placing Order...'
                          : `Complete Order (${formatPaiseToINR(calculation.totalPaise)})`}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* VIEW 8: STEP 4 ORDER CONFIRMATION RECEIPT */}
            {activeView === 'confirmation' && confirmedOrderData && (
              <div className="max-w-3xl mx-auto px-6 py-10">
                <div className="bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-6 lg:p-8 space-y-6">
                  <div className="border-b border-stone-200 pb-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                        Order Confirmed & Stock Reserved
                      </p>
                      <h1 className="font-serif-display text-2xl font-bold text-stone-900 mt-1">
                        Order #{confirmedOrderData.order.orderNumber}
                      </h1>
                      <p className="text-xs text-stone-600 mt-1">
                        Placed by {confirmedOrderData.order.customerName} (
                        {confirmedOrderData.order.customerPhone})
                      </p>
                    </div>
                    <div className="text-right font-mono-tabular text-xs">
                      <p className="font-bold text-stone-900">
                        Order Status: {confirmedOrderData.order.orderStatus.replace(/_/g, ' ')}
                      </p>
                      <p className="text-stone-600 mt-0.5">
                        Payment: {confirmedOrderData.order.paymentStatus} (
                        {confirmedOrderData.order.paymentMethod.replace(/_/g, ' ')})
                      </p>
                    </div>
                  </div>

                  {confirmedOrderData.pickupDetails && (
                    <div className="p-5 bg-amber-50 border border-amber-200 rounded-[24px] space-y-1.5 text-xs">
                      <p className="font-bold text-amber-950 text-sm">
                        Store Pickup Code:{' '}
                        <span className="font-mono-tabular">
                          {confirmedOrderData.pickupDetails.pickupCode}
                        </span>
                      </p>
                      <p className="text-amber-900">
                        Preferred Window: {confirmedOrderData.pickupDetails.preferredWindow}
                      </p>
                      <p className="text-amber-800">
                        {confirmedOrderData.pickupDetails.storeLocationNote}
                      </p>
                    </div>
                  )}

                  {confirmedOrderData.shipmentDetails && (
                    <div className="p-5 bg-stone-50 border border-stone-200 rounded-[24px] space-y-1 text-xs">
                      <p className="font-bold text-stone-900">Home Delivery Destination:</p>
                      <p className="text-stone-700">
                        {confirmedOrderData.shipmentDetails.recipientName},{' '}
                        {confirmedOrderData.shipmentDetails.addressLine1},{' '}
                        {confirmedOrderData.shipmentDetails.city},{' '}
                        {confirmedOrderData.shipmentDetails.state} -{' '}
                        {confirmedOrderData.shipmentDetails.pincode}
                      </p>
                    </div>
                  )}

                  {confirmedOrderData.order.paymentMethod === 'CASHFREE_ONLINE' && (
                    <div className={`p-5 rounded-[24px] border text-xs space-y-2.5 ${
                      confirmedOrderData.order.paymentStatus === 'PAID'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        : 'bg-amber-50 border-amber-300 text-amber-950'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">
                          {confirmedOrderData.order.paymentStatus === 'PAID'
                            ? '✓ Online Payment Verified & Confirmed'
                            : '⚡ Payment Pending — Complete via Cashfree Gateway'}
                        </span>
                        <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-white/80 border border-current">
                          {confirmedOrderData.order.paymentStatus}
                        </span>
                      </div>
                      {confirmedOrderData.order.paymentStatus !== 'PAID' ? (
                        <>
                          <p className="text-amber-900 leading-relaxed">
                            Your order is saved as <strong>Pending Payment</strong>. Click below to open the Cashfree Drop-in Payment Gateway to pay via <strong>UPI (GPay / PhonePe / Paytm / BHIM)</strong>, Credit/Debit Cards, or NetBanking.
                          </p>
                          <button
                            type="button"
                            onClick={() => triggerCashfreePaymentModal(confirmedOrderData.order.orderNumber)}
                            disabled={checkoutSubmitting}
                            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-full shadow-md transition-all cursor-pointer flex items-center gap-2"
                          >
                            <span>Pay Now via UPI / Cards / NetBanking (Cashfree)</span>
                          </button>
                        </>
                      ) : (
                        <p className="text-emerald-800 text-[11px]">
                          Payment was securely verified with Cashfree Payments PG. Thank you for your purchase!
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-2 text-xs">
                    <h2 className="font-bold text-stone-900">Ordered Items</h2>
                    <div className="divide-y divide-stone-100">
                      {confirmedOrderData.items.map((item: any, idx: number) => (
                        <div key={idx} className="py-2 flex justify-between">
                          <span>
                            {item.quantity}x {item.productName} ({item.variantName})
                          </span>
                          <span className="font-mono-tabular font-medium">
                            {formatPaiseToINR(item.lineSubtotalPaise)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-stone-200 pt-3 flex justify-between text-sm font-bold font-mono-tabular">
                      <span>Final Order Total</span>
                      <span>{formatPaiseToINR(confirmedOrderData.order.totalPaise)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      onClick={() => {
                        setTrackOrderNumberInput(confirmedOrderData.order.orderNumber);
                        setTrackedOrderResult(null);
                        setActiveView('track');
                      }}
                      className="px-5 py-2.5 bg-stone-900 text-white text-xs font-semibold rounded-full"
                    >
                      Track Order Status
                    </button>
                    <button
                      onClick={() => setActiveView('storefront')}
                      className="px-5 py-2.5 bg-stone-100 text-stone-800 text-xs font-medium rounded-full hover:bg-stone-200"
                    >
                      Continue Shopping
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* VIEW 8.5: DYNAMIC CMS INFORMATIONAL & POLICY PAGES */}
            {activeView === 'page' && (
              <div className="max-w-5xl mx-auto px-6 py-10">
                <button
                  onClick={() => setActiveView('storefront')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-stone-300/90 rounded-full text-xs font-medium text-stone-700 hover:text-stone-950 mb-6 shadow-2xs cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Storefront</span>
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <div className="lg:col-span-8 bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-6 lg:p-8 space-y-5">
                    {activeCmsPage ? (
                      <>
                        <div className="border-b border-stone-200 pb-4 space-y-1">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-[#B42318] font-bold">
                            GAYATRI STATIONERS · STORE INFORMATION & POLICY
                          </span>
                          <h1 className="font-serif-display text-2xl sm:text-3xl font-bold text-stone-900">
                            {activeCmsPage.title}
                          </h1>
                          {activeCmsPage.summary && (
                            <p className="text-xs sm:text-sm text-stone-600 pt-1">
                              {activeCmsPage.summary}
                            </p>
                          )}
                        </div>
                        <div className="text-sm text-stone-800 leading-relaxed whitespace-pre-line space-y-3">
                          {activeCmsPage.contentMarkdown}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-stone-600">Page not found.</p>
                    )}
                  </div>

                  <aside className="lg:col-span-4 bg-white border border-stone-200/80 rounded-[32px] shadow-xs p-6 space-y-3">
                    <h2 className="text-xs font-mono uppercase tracking-wider text-stone-500 font-bold">
                      Store Guides & Policies
                    </h2>
                    <div className="flex flex-col gap-1.5">
                      {cmsPages
                        .filter((p) => p.isActive !== false)
                        .map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setActivePageSlug(p.slug)}
                            className={`text-left px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                              activeCmsPage?.slug === p.slug
                                ? 'bg-stone-900 text-white'
                                : 'text-stone-700 hover:bg-stone-100'
                            }`}
                          >
                            {p.title}
                          </button>
                        ))}
                    </div>
                  </aside>
                </div>
              </div>
            )}

            {/* VIEW 9: PRIVATE ADMIN LOGIN (/admin/login) & PROTECTED ADMIN CONSOLE (/admin) */}
            {(activeView === 'admin-login' || activeView === 'admin') && (
              <>
                {dbUser &&
                (dbUser.role === 'owner' || dbUser.role === 'staff') &&
                activeView === 'admin' ? (
                  <AdminDashboard
                    idToken={idToken}
                    currentUser={dbUser}
                    categories={categories}
                    brands={brands}
                    products={products}
                    storeSettings={storeSettings}
                    bootstrap={{
                      categories,
                      brands,
                      products,
                      bundles,
                      coupons,
                      serviceablePincodes,
                      settings: storeSettings,
                      navigationItems,
                      homepageSections,
                      banners,
                      pages: cmsPages,
                      revisions: cmsRevisions,
                    }}
                    onRefreshStorefront={() => loadStoreBootstrap()}
                    onRoleSwitched={handleSwitchRole}
                    onExitAdmin={() => {
                      window.history.pushState({}, '', '/');
                      setActiveView('storefront');
                    }}
                    onNavigateStorefront={(target) => {
                      window.history.pushState({}, '', '/');
                      if (target.view === 'page' && target.pageSlug) {
                        setActivePageSlug(target.pageSlug);
                        setActiveView('page');
                        return;
                      }
                      if (target.categorySlug) {
                        setSelectedCategorySlug(target.categorySlug);
                        setSelectedBrandSlug('ALL');
                        setActiveView('storefront');
                        return;
                      }
                      if (target.brandSlug) {
                        setSelectedBrandSlug(target.brandSlug);
                        setSelectedCategorySlug('ALL');
                        setActiveView('storefront');
                        return;
                      }
                      setActiveView('storefront');
                    }}
                  />
                ) : (
                  <div className="max-w-md mx-auto px-4 sm:px-6 py-10 sm:py-12">
                    <div className="bg-white border border-slate-200/90 rounded-[32px] p-6 sm:p-8 space-y-6 shadow-sm">
                      <div className="border-b border-slate-200 pb-4 space-y-1">
                        <span className="text-[11px] font-mono-tabular uppercase tracking-widest text-[#B42318] font-bold">
                          STORE ADMINISTRATOR PORTAL
                        </span>
                        <h1 className="font-serif-display text-2xl font-bold text-slate-900">
                          Admin Sign Up & Sign In
                        </h1>
                        <p className="text-xs text-slate-600">
                          Anyone with a Google account can sign up or sign in to manage products, inventory, orders, and Store CMS.
                        </p>
                      </div>

                      {dbUser && (dbUser.role === 'owner' || dbUser.role === 'staff') ? (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-[24px] space-y-3 text-xs text-emerald-950">
                          <p className="font-bold">
                            Active Administrator Session: {dbUser.email} ({dbUser.role.toUpperCase()})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                window.history.pushState({}, '', '/admin');
                                setActiveView('admin');
                              }}
                              className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-full cursor-pointer"
                            >
                              Continue to Admin Dashboard →
                            </button>
                            <button
                              type="button"
                              onClick={handleSignOut}
                              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-full cursor-pointer"
                            >
                              Sign Out
                            </button>
                          </div>
                        </div>
                      ) : dbUser && dbUser.role === 'customer' ? (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-[24px] space-y-3 text-xs text-amber-950">
                          <p className="font-bold text-sm">Upgrade Your Google Account to Admin</p>
                          <p>
                            You are currently signed in as <strong>{dbUser.email}</strong>. Click below to activate full Store Administrator access for this account.
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={async () => {
                                await handleSwitchRole('owner');
                                window.history.pushState({}, '', '/admin');
                                setActiveView('admin');
                              }}
                              className="px-4 py-2 bg-[#B42318] text-white font-semibold rounded-full cursor-pointer hover:bg-[#991B1B]"
                            >
                              Activate Admin Access for {dbUser.email} →
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                window.history.pushState({}, '', '/');
                                setActiveView('storefront');
                              }}
                              className="px-4 py-2 bg-white border border-amber-300 text-amber-900 font-medium rounded-full cursor-pointer"
                            >
                              Return to Storefront
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {authError && (
                        <div className="p-3.5 bg-red-50 border border-red-200 rounded-3xl text-xs text-red-900">
                          {authError}
                        </div>
                      )}

                      {/* Primary 1-Click Google OAuth Sign-Up / Sign-In Button */}
                      <button
                        type="button"
                        disabled={adminLoginSubmitting}
                        onClick={handleGoogleAdminSignUp}
                        className="w-full py-3.5 px-4 bg-slate-900 text-white text-xs sm:text-sm font-semibold rounded-full hover:bg-slate-800 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2.5 shadow-sm transition-all"
                      >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.09.73-2.5 1.16-4.22 1.16-3.24 0-6-2.19-6.98-5.14H1.01v3.14C3.03 21.2 7.21 24 12 24z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.02 14.01c-.25-.73-.39-1.52-.39-2.34s.14-1.61.39-2.34V6.19H1.01C.37 7.47 0 8.91 0 10.67s.37 3.2 1.01 4.48l4.01-1.14z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.03 2.8 1.01 6.85l4.01 3.14c.98-2.95 3.74-5.24 6.98-5.24z"
                          />
                        </svg>
                        <span>
                          {adminLoginSubmitting
                            ? 'Connecting Google Account...'
                            : 'Sign Up / Sign In with Google'}
                        </span>
                      </button>

                      <div className="relative flex py-1 items-center">
                        <div className="flex-grow border-t border-slate-200" />
                        <span className="flex-shrink mx-3 text-[11px] text-slate-400 uppercase font-mono-tabular">
                          OR SIGN UP WITH GOOGLE EMAIL
                        </span>
                        <div className="flex-grow border-t border-slate-200" />
                      </div>

                      <form onSubmit={handleAdminCredentialsLogin} className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Your Name
                          </label>
                          <input
                            type="text"
                            value={adminLoginName}
                            onChange={(e) => setAdminLoginName(e.target.value)}
                            placeholder="e.g. Priya Verma"
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-full text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Google Account Email *
                          </label>
                          <input
                            type="email"
                            required
                            value={adminLoginEmail}
                            onChange={(e) => setAdminLoginEmail(e.target.value)}
                            placeholder="yourname@gmail.com"
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-full text-sm"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={adminLoginSubmitting}
                          className="w-full py-3 bg-[#B42318] text-white text-xs font-semibold rounded-full shadow-xs hover:bg-[#991B1B] disabled:opacity-50 cursor-pointer"
                        >
                          {adminLoginSubmitting
                            ? 'Creating Admin Session...'
                            : 'Sign Up & Enter Admin Dashboard →'}
                        </button>
                      </form>

                      <div className="pt-2 border-t border-slate-200 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            window.history.pushState({}, '', '');
                            window.history.replaceState({}, '', '/');
                            setActiveView('storefront');
                          }}
                          className="text-xs text-slate-600 hover:text-slate-900 underline cursor-pointer"
                        >
                          ← Return to Public Storefront
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* SWIPE / DRAG PRODUCT INTO CART ANIMATION OVERLAY WITH MOTION TRAIL */}
      <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
        <AnimatePresence>
          {flyingCartItems.map((item) => {
            const midX = item.startX + (item.endX - item.startX) * 0.36;
            const peakY = Math.max(12, Math.min(item.startY, item.endY) - 68);
            return (
              <React.Fragment key={item.id}>
                {/* Motion Trail Echo 1 */}
                <motion.div
                  initial={{ x: item.startX, y: item.startY, scale: 0.85, opacity: 0.45 }}
                  animate={{
                    x: [item.startX, midX, item.endX],
                    y: [item.startY, peakY, item.endY],
                    scale: [0.85, 0.9, 0.15],
                    rotate: [0, -12, 16],
                    opacity: [0.45, 0.35, 0],
                  }}
                  transition={{
                    duration: 0.72,
                    delay: 0.045,
                    ease: [0.22, 1, 0.36, 1],
                    times: [0, 0.38, 1],
                  }}
                  className="fixed top-0 left-0 w-40 h-28 rounded-3xl bg-[#B42318]/25 border border-[#B42318]/50 pointer-events-none"
                />

                {/* Primary Dragged / Swiped Product Card */}
                <motion.div
                  initial={{
                    x: item.startX,
                    y: item.startY,
                    scale: 0.95,
                    rotate: 0,
                    opacity: 1,
                  }}
                  animate={{
                    x: [item.startX, midX, item.endX],
                    y: [item.startY, peakY, item.endY],
                    scale: [0.96, 1.08, 0.22],
                    rotate: [0, -9, 12],
                    opacity: [1, 1, 0.15],
                  }}
                  exit={{ opacity: 0, scale: 0.1 }}
                  transition={{
                    duration: 0.72,
                    ease: [0.22, 1, 0.36, 1],
                    times: [0, 0.38, 1],
                  }}
                  className="fixed top-0 left-0 w-40 bg-white border-2 border-[#B42318] rounded-3xl shadow-2xl p-2 pointer-events-none"
                >
                  <div className="bg-[#B42318] text-white text-[9px] font-mono uppercase tracking-wider font-bold px-2 py-0.5 rounded-full mb-1.5 flex items-center justify-between">
                    <span>SWIPING TO CART</span>
                    <span>→</span>
                  </div>
                  <div className="aspect-4/3 w-full rounded-2xl overflow-hidden bg-slate-50 border border-slate-200">
                    <ProductIllustration
                      type={item.illustrationType}
                      imageUrl={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="pt-1 px-1 flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold text-stone-900 truncate">
                      {item.name}
                    </span>
                    <span className="text-[10px] font-mono-tabular font-bold text-[#B42318] shrink-0">
                      {item.priceFormatted}
                    </span>
                  </div>
                </motion.div>
              </React.Fragment>
            );
          })}
        </AnimatePresence>
      </div>

      {/* CUSTOMER ACCOUNT SIGN-IN MODAL (Supabase Auth + PostgreSQL Profile) */}
      {customerAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-stone-200/80 rounded-[32px] p-6 sm:p-7 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-stone-200 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#B42318] font-bold">
                  GAYATRI STATIONERS · CUSTOMER ACCOUNT
                </span>
                <h2 className="font-serif-display text-xl font-bold text-stone-900 mt-0.5">
                  Sign In to Your Account
                </h2>
                <p className="text-xs text-stone-600 mt-0.5">
                  Save your wishlist, view order history, and track Store Pickup or Home Delivery orders.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomerAuthModalOpen(false)}
                className="p-1.5 bg-stone-100 hover:bg-stone-200 rounded-full text-stone-500 hover:text-stone-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {authError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-3xl text-xs text-red-900">
                {authError}
              </div>
            )}

            <form onSubmit={handleCustomerAccountSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-stone-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={customerAuthName}
                  onChange={(e) => setCustomerAuthName(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className="w-full px-4 py-2 border border-stone-300 rounded-full text-sm"
                />
              </div>
              <div>
                <label className="block font-medium text-stone-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={customerAuthEmail}
                  onChange={(e) => setCustomerAuthEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2 border border-stone-300 rounded-full text-sm"
                />
              </div>
              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Password (Optional — for Supabase Auth password accounts)
                </label>
                <input
                  type="password"
                  value={customerAuthPassword}
                  onChange={(e) => setCustomerAuthPassword(e.target.value)}
                  placeholder="Leave blank for instant customer session"
                  className="w-full px-4 py-2 border border-stone-300 rounded-full text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={customerAuthSubmitting}
                className="w-full py-3 bg-slate-900 text-white text-xs font-semibold rounded-full shadow-xs hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {customerAuthSubmitting ? 'Signing In...' : 'Continue to Customer Account'}
              </button>
            </form>

            <div className="pt-3 border-t border-slate-200 space-y-2">
              <button
                type="button"
                onClick={handleGoogleAdminSignUp}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-semibold rounded-full cursor-pointer flex items-center justify-center gap-2 transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#B42318]" />
                <span>Sign Up / Sign In to Admin with Google</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SLIDE-OVER CART DRAWER */}
      {cartDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white h-full flex flex-col justify-between shadow-2xl">
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <h2 className="font-serif-display text-lg font-bold text-stone-900">
                Shopping Bag ({totalCartItemsCount})
              </h2>
              <button
                onClick={() => setCartDrawerOpen(false)}
                className="p-1.5 bg-stone-100 hover:bg-stone-200 rounded-full text-stone-500 hover:text-stone-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {serverCartResult?.warnings?.length > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-3xl text-xs text-amber-900 space-y-1">
                  {serverCartResult.warnings.map((w: string, i: number) => (
                    <p key={i}>{w}</p>
                  ))}
                </div>
              )}

              {calculation.items.length === 0 ? (
                <div className="py-12 text-center space-y-3 text-xs text-stone-500">
                  <p>Your shopping bag is currently empty.</p>
                  <button
                    onClick={() => {
                      setCartDrawerOpen(false);
                      setActiveView('storefront');
                    }}
                    className="px-5 py-2.5 bg-stone-900 text-white font-medium rounded-full"
                  >
                    Explore Catalogue
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-stone-200">
                  {calculation.items.map((item: any) => (
                    <div key={`${item.productId}-${item.variantId}`} className="py-3.5 space-y-2">
                      <div className="flex justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-stone-900">
                            {item.productName}
                          </p>
                          <p className="text-[11px] text-stone-500">
                            {item.variantName} · {formatPaiseToINR(item.unitPricePaise)} each
                          </p>
                        </div>
                        <span className="font-mono-tabular text-xs font-bold">
                          {formatPaiseToINR(item.lineSubtotalPaise)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="inline-flex items-center border border-stone-300 rounded-full p-0.5">
                          <button
                            onClick={() =>
                              handleUpdateCartQuantity(
                                item.productId,
                                item.variantId,
                                item.quantity - 1
                              )
                            }
                            className="px-2.5 py-0.5 text-xs hover:bg-stone-100 rounded-full"
                          >
                            -
                          </button>
                          <span className="px-3 py-0.5 text-xs font-mono-tabular font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              handleUpdateCartQuantity(
                                item.productId,
                                item.variantId,
                                item.quantity + 1
                              )
                            }
                            className="px-2.5 py-0.5 text-xs hover:bg-stone-100 rounded-full"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() =>
                            handleUpdateCartQuantity(item.productId, item.variantId, 0)
                          }
                          className="px-3 py-1 text-xs text-stone-500 hover:text-red-700 hover:bg-red-50 rounded-full"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {calculation.items.length > 0 && (
              <div className="p-5 bg-slate-50 border-t border-slate-200 space-y-4">
                <div className="space-y-1.5 text-xs font-mono-tabular">
                  <div className="flex justify-between text-stone-600">
                    <span>Subtotal (Incl. GST)</span>
                    <span>{formatPaiseToINR(calculation.subtotalPaise)}</span>
                  </div>
                  {calculation.catalogSavingsPaise > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>MRP Savings</span>
                      <span>-{formatPaiseToINR(calculation.catalogSavingsPaise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-stone-900 pt-1 border-t border-stone-200">
                    <span>Estimated Total</span>
                    <span>{formatPaiseToINR(calculation.totalPaise)}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setCartDrawerOpen(false);
                    setActiveView('checkout');
                  }}
                  className="w-full py-3.5 bg-[#B42318] text-white text-xs font-semibold rounded-full shadow-xs hover:bg-[#991B1B] cursor-pointer"
                >
                  Proceed to Checkout (Store Pickup / Delivery)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quiet, Authentic Retail Footer (Dynamically powered by Store CMS) */}
      <footer className="bg-white border-t border-stone-200 px-6 py-10 mt-16 text-xs text-stone-600">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-2">
            <p className="font-serif-display text-base font-bold text-stone-900">
              {themeConfig.storeName || 'Gayatri Stationers'}
            </p>
            <p className="leading-relaxed">
              {footerConfig.brandSummary ||
                'Retail and institutional stationery supplier for school notebooks, writing instruments, DIY & craft supplies, fine art materials, geometry sets, and office files.'}
            </p>
            <p className="text-[11px] text-stone-500">
              {footerConfig.copyrightText || 'Reference: https://gayatristationers.co.in/'}
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-stone-900">Categories</p>
            <ul className="space-y-1">
              {categories
                .filter((c) => c.isActive !== false && c.showInFooter !== false)
                .slice(0, 7)
                .map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => {
                        setSelectedCategorySlug(c.slug);
                        setSelectedBrandSlug('ALL');
                        setActiveView('storefront');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="hover:underline cursor-pointer"
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-stone-900">Store Guides & Policies</p>
            <ul className="space-y-1">
              {cmsPages
                .filter((p) => p.isActive !== false && p.showInFooter !== false)
                .map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => {
                        setActivePageSlug(p.slug);
                        setActiveView('page');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="hover:underline cursor-pointer text-left"
                    >
                      {p.title}
                    </button>
                  </li>
                ))}
              <li>
                <button onClick={() => setActiveView('bulk')} className="hover:underline cursor-pointer">
                  School & Corporate Bulk Enquiries
                </button>
              </li>
              <li>
                <button onClick={() => setActiveView('track')} className="hover:underline cursor-pointer">
                  Order Lookup & Pickup Code Tracker
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-stone-900">Store Information Notice</p>
            <p className="leading-relaxed">
              {(
                storeSettings?.store_profile?.pickupCounterLabel ||
                'Gayatri Stationers — Retail Pickup Counter'
              ).replace(/\s*\([^)]*Admin[^)]*\)/gi, '')}
            </p>
            <p>
              {(
                storeSettings?.store_profile?.businessHoursNote ||
                'Mon–Sat: 10:00 AM – 8:00 PM'
              ).replace(/\s*\([^)]*Admin[^)]*\)/gi, '')}
            </p>
            <p className="text-[11px] text-stone-500">
              Authentic school, office, art, and institutional stationery with GST billing.
            </p>
          </div>
        </div>
      </footer>

      {/* Mobile Floating Bottom Navigation Dock (Adapted to original color palette, hidden on desktop) */}
      <nav aria-label="Quick mobile navigation" className="md:hidden fixed bottom-3 left-0 right-0 z-40 px-3 w-full max-w-[390px] mx-auto pointer-events-auto">
        <div className="bg-white/94 backdrop-blur-xl border border-slate-200/90 rounded-full px-3 py-1.5 flex items-center justify-between shadow-[0_10px_30px_-5px_rgba(15,23,42,0.14)]">
          <button
            type="button"
            onClick={() => {
              setSelectedCategorySlug('ALL');
              setSelectedBrandSlug('ALL');
              setActiveView('storefront');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-full transition-all cursor-pointer ${
              activeView === 'storefront'
                ? 'text-slate-900 font-bold scale-105'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Store className={`w-4 h-4 ${activeView === 'storefront' ? 'text-slate-900' : 'text-slate-500'}`} />
            <span className="text-[10px] mt-0.5">Store</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveView('combos');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-full transition-all cursor-pointer ${
              activeView === 'combos'
                ? 'text-slate-900 font-bold scale-105'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Tag className={`w-4 h-4 ${activeView === 'combos' ? 'text-slate-900' : 'text-slate-500'}`} />
            <span className="text-[10px] mt-0.5">Combos</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveView('track');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-full transition-all cursor-pointer ${
              activeView === 'track'
                ? 'text-slate-900 font-bold scale-105'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className={`w-4 h-4 ${activeView === 'track' ? 'text-slate-900' : 'text-slate-500'}`} />
            <span className="text-[10px] mt-0.5">Orders</span>
          </button>

          <button
            type="button"
            onClick={() => setCartDrawerOpen(true)}
            className="relative flex flex-col items-center justify-center py-1 px-3 rounded-full text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-slate-700" />
            <span className="text-[10px] mt-0.5">Bag</span>
            {totalCartItemsCount > 0 && (
              <span className="absolute -top-1 -right-0.5 min-w-[16px] h-[16px] px-1 bg-[#B42318] text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-xs">
                {totalCartItemsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (dbUser || supabaseUser) {
                setActiveView('track');
              } else {
                setCustomerAuthModalOpen(true);
              }
            }}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-full transition-all cursor-pointer ${
              (activeView === 'track' && Boolean(dbUser)) || customerAuthModalOpen
                ? 'text-slate-900 font-bold scale-105'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4 text-slate-600" />
            <span className="text-[10px] mt-0.5">{dbUser ? 'Account' : 'Sign In'}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
