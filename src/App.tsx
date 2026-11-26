import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  Heart,
  Layers,
  Mail,
  MapPin,
  Menu,
  Minus,
  Package,
  Phone,
  Plus,
  Receipt,
  Scale,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Store,
  Tag,
  Trash2,
  Truck,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { auth, googleAuthProvider } from './lib/firebase.ts';
import {
  FulfilmentMethod,
  PaymentMethod,
  calculateOrderTotals,
  formatPaiseToINR,
} from './lib/domain-logic.ts';
import {
  DEFAULT_BRANDS,
  DEFAULT_BUNDLES,
  DEFAULT_CATEGORIES,
  DEFAULT_CMS_PAGES,
  DEFAULT_COUPONS,
  DEFAULT_PINCODES,
  DEFAULT_PRODUCTS,
  OWNER_EMAIL,
  POLICY_URL_SLUG_MAP,
  STORE_ADDRESS,
  STORE_EMAIL,
  STORE_PHONE,
  normalizeCatalogueProduct,
} from './data/defaults.ts';
import {
  LocalCartItem,
  getCartItemKey,
  getProductColorOptions,
  matchesPriceRangeFilter,
  matchesRulingFilter,
  matchesTipOrGradeFilter,
} from './lib/catalog-helpers.ts';
import { ProductIllustration } from './components/ProductIllustration.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { RufusAssistant } from './components/RufusAssistant.tsx';
import { ProductComparisonModal } from './components/ProductComparisonModal.tsx';
import { CartDrawer } from './components/CartDrawer.tsx';
import {
  AdminLoginView,
  BulkEnquiryView,
  ProfileView,
  SignInView,
  TrackOrdersView,
} from './components/AccountAndAuthViews.tsx';
import {
  CheckoutView,
  ConfirmationView,
} from './components/CheckoutAndConfirmation.tsx';

type ActiveView =
  | 'storefront'
  | 'pdp'
  | 'combos'
  | 'bulk'
  | 'track'
  | 'wishlist'
  | 'checkout'
  | 'confirmation'
  | 'page'
  | 'signin'
  | 'profile'
  | 'admin-login'
  | 'admin';

function resolveRouteFromUrl(pathname: string): {
  view: ActiveView;
  productSlug?: string;
  pageSlug?: string;
} {
  const clean = pathname.replace(/\/+$/, '').toLowerCase() || '/';
  if (clean === '/' || clean === '/catalog' || clean === '/shop') {
    return { view: 'storefront' };
  }
  if (clean.startsWith('/product/')) {
    return {
      view: 'pdp',
      productSlug: decodeURIComponent(pathname.slice('/product/'.length).split('?')[0]),
    };
  }
  if (clean === '/combos' || clean === '/bundles') return { view: 'combos' };
  if (clean === '/bulk' || clean === '/wholesale') return { view: 'bulk' };
  if (clean === '/track' || clean === '/orders') return { view: 'track' };
  if (clean === '/wishlist' || clean === '/saved') return { view: 'wishlist' };
  if (clean === '/checkout' || clean === '/cart') return { view: 'checkout' };
  if (clean === '/signin' || clean === '/login') return { view: 'signin' };
  if (clean === '/profile' || clean === '/account') return { view: 'profile' };
  if (clean === '/admin/login') return { view: 'admin-login' };
  if (clean === '/admin') return { view: 'admin' };
  const mappedPolicy = POLICY_URL_SLUG_MAP[clean];
  if (mappedPolicy) return { view: 'page', pageSlug: mappedPolicy };
  return { view: 'storefront' };
}

function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function App() {
  const initialRoute = useMemo(
    () =>
      resolveRouteFromUrl(
        typeof window !== 'undefined' ? window.location.pathname : '/'
      ),
    []
  );

  // Navigation & Route View
  const [activeView, setActiveView] = useState<ActiveView>(initialRoute.view);
  const [activeProductSlug, setActiveProductSlug] = useState<string>(
    initialRoute.productSlug || ''
  );
  const [activePageSlug, setActivePageSlug] = useState<string>(
    initialRoute.pageSlug || 'about-us'
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);

  // Storefront Data
  const [categories, setCategories] = useState<any[]>(() =>
    readStoredJson('gs_fallback_categories_v1', DEFAULT_CATEGORIES)
  );
  const [brands, setBrands] = useState<any[]>(() =>
    readStoredJson('gs_fallback_brands_v1', DEFAULT_BRANDS)
  );
  const [products, setProducts] = useState<any[]>(() =>
    readStoredJson('gs_fallback_catalogue_v1', DEFAULT_PRODUCTS).map(normalizeCatalogueProduct)
  );
  const [bundles, setBundles] = useState<any[]>(DEFAULT_BUNDLES);
  const [coupons, setCoupons] = useState<any[]>(() =>
    readStoredJson('gs_coupons_v1', DEFAULT_COUPONS)
  );
  const [serviceablePincodes, setServiceablePincodes] = useState<any[]>(DEFAULT_PINCODES);
  const [storeSettings, setStoreSettings] = useState<Record<string, any>>(() =>
    readStoredJson('gs_store_settings_v1', {})
  );
  const [cmsPages, setCmsPages] = useState<any[]>(DEFAULT_CMS_PAGES);
  const [bootstrapData, setBootstrapData] = useState<any>(null);

  // Smart Filters (Category, Brand, Ruling, Tip/Spec, Price Range, Sort)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('');
  const [selectedBrandSlug, setSelectedBrandSlug] = useState<string>('');
  const [rulingFilter, setRulingFilter] = useState<string>('ALL');
  const [tipFilter, setTipFilter] = useState<string>('ALL');
  const [priceRangeFilter, setPriceRangeFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc'>('featured');
  const [bulkPreFillNote, setBulkPreFillNote] = useState<string>('');

  // Variant & Ink Colour selections per product ID
  const [selectedVariantByProduct, setSelectedVariantByProduct] = useState<Record<number, number>>(
    {}
  );
  const [selectedColorByProduct, setSelectedColorByProduct] = useState<Record<number, string>>({});
  const [pdpQuantity, setPdpQuantity] = useState(1);

  // Cart & Fulfilment State
  const [cartItems, setCartItems] = useState<LocalCartItem[]>(() =>
    readStoredJson('gs_cart_items_v1', [])
  );
  const [wishlistProductIds, setWishlistProductIds] = useState<number[]>(() =>
    readStoredJson('gs_wishlist_v1', [])
  );
  const [compareProductIds, setCompareProductIds] = useState<number[]>(() =>
    readStoredJson('gs_compare_ids_v1', [])
  );
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareToast, setCompareToast] = useState<string | null>(null);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  const [fulfilmentMethod, setFulfilmentMethod] = useState<FulfilmentMethod>('STORE_PICKUP');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASHFREE_ONLINE');
  const [appliedCouponCode, setAppliedCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState<string | undefined>(undefined);
  const [orderNote, setOrderNote] = useState('');
  const [pickupWindow, setPickupWindow] = useState('Today · Within 2 Hours (10 AM – 9 PM)');
  const [gstin, setGstin] = useState('');

  // Customer & Auth State
  const storedSession = useMemo(() => readStoredJson<any>('gs_admin_session_v1', null), []);
  const storedProfile = useMemo(() => readStoredJson<any>('gs_user_profile_v1', {}), []);

  const [idToken, setIdToken] = useState<string | null>(storedSession?.token || null);
  const [dbUser, setDbUser] = useState<any>(storedSession?.user || null);

  const [customerName, setCustomerName] = useState<string>(
    storedProfile?.fullName || storedSession?.user?.fullName || ''
  );
  const [customerPhone, setCustomerPhone] = useState<string>(
    storedProfile?.phone || storedSession?.user?.phone || ''
  );
  const [customerEmail, setCustomerEmail] = useState<string>(
    storedProfile?.email || storedSession?.user?.email || ''
  );
  const [shippingAddress, setShippingAddress] = useState<string>(
    storedProfile?.shippingAddress || ''
  );
  const [shippingCity, setShippingCity] = useState<string>(
    storedProfile?.shippingCity || 'Kanpur'
  );
  const [shippingPincode, setShippingPincode] = useState<string>(
    storedProfile?.shippingPincode || '208021'
  );

  // Auth form fields
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authEmailInput, setAuthEmailInput] = useState('');
  const [authNameInput, setAuthNameInput] = useState('');
  const [authPhoneInput, setAuthPhoneInput] = useState('');
  const [authPasswordInput, setAuthPasswordInput] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Admin Login fields
  const [adminEmailInput, setAdminEmailInput] = useState(OWNER_EMAIL);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [adminAuthSubmitting, setAdminAuthSubmitting] = useState(false);

  // Profile saving & Order state
  const [savingProfile, setSavingProfile] = useState(false);
  const [myOrders, setMyOrders] = useState<any[]>(() =>
    readStoredJson('gs_my_orders_v1', [])
  );

  // Order Tracking
  const [trackQuery, setTrackQuery] = useState('');
  const [trackSearching, setTrackSearching] = useState(false);
  const [trackResults, setTrackResults] = useState<any[]>(() =>
    readStoredJson('gs_my_orders_v1', []).slice(0, 2)
  );

  // Checkout & Cashfree recovery state
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [pendingOnlineOrder, setPendingOnlineOrder] = useState<any | null>(null);
  const [confirmedOrderData, setConfirmedOrderData] = useState<any | null>(null);

  // Vidya AI Assistant
  const [isRufusOpen, setIsRufusOpen] = useState(false);
  const [rufusInitialQuestion, setRufusInitialQuestion] = useState<string | null>(null);

  // Toast
  const [toastText, setToastText] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastText(msg);
    window.setTimeout(() => {
      setToastText((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  useEffect(() => {
    localStorage.setItem('gs_cart_items_v1', JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    localStorage.setItem('gs_wishlist_v1', JSON.stringify(wishlistProductIds));
  }, [wishlistProductIds]);

  useEffect(() => {
    localStorage.setItem('gs_compare_ids_v1', JSON.stringify(compareProductIds));
  }, [compareProductIds]);

  // Unified Route Navigation + Popstate
  const navigateTo = useCallback(
    (
      view: ActiveView,
      path: string,
      opts?: { productSlug?: string; pageSlug?: string; bulkNote?: string }
    ) => {
      if (opts?.productSlug !== undefined) setActiveProductSlug(opts.productSlug);
      if (opts?.pageSlug !== undefined) setActivePageSlug(opts.pageSlug);
      if (opts?.bulkNote !== undefined) setBulkPreFillNote(opts.bulkNote);
      setActiveView(view);
      setMobileMenuOpen(false);
      setMegaMenuOpen(false);
      if (typeof window !== 'undefined' && window.location.pathname !== path) {
        window.history.pushState({}, '', path);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
  );

  useEffect(() => {
    const onPopState = () => {
      const resolved = resolveRouteFromUrl(window.location.pathname);
      setActiveView(resolved.view);
      if (resolved.productSlug) setActiveProductSlug(resolved.productSlug);
      if (resolved.pageSlug) setActivePageSlug(resolved.pageSlug);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Load Storefront Bootstrap
  const loadStoreBootstrap = useCallback(async (tokenOverride?: string | null) => {
    try {
      const tokenToUse = tokenOverride ?? idToken;
      const res = await fetch('/api/storefront/bootstrap', {
        headers: tokenToUse ? { Authorization: `Bearer ${tokenToUse}` } : undefined,
      });
      const data = await res.json();
      if (!data || data.error) return;
      setBootstrapData(data);
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        setCategories(data.categories);
      }
      if (Array.isArray(data.brands) && data.brands.length > 0) {
        setBrands(data.brands);
      }
      if (Array.isArray(data.products) && data.products.length > 0) {
        setProducts(data.products.map(normalizeCatalogueProduct));
      }
      if (Array.isArray(data.bundles) && data.bundles.length > 0) {
        setBundles(data.bundles);
      }
      if (Array.isArray(data.coupons) && data.coupons.length > 0) {
        setCoupons(data.coupons);
      }
      if (Array.isArray(data.serviceablePincodes) && data.serviceablePincodes.length > 0) {
        setServiceablePincodes(data.serviceablePincodes);
      }
      if (data.settings) setStoreSettings(data.settings);
      if (Array.isArray(data.pages) && data.pages.length > 0) {
        setCmsPages(data.pages);
      }
    } catch {
      // Keep cached/default data
    }
  }, [idToken]);

  useEffect(() => {
    loadStoreBootstrap();
  }, [loadStoreBootstrap]);

  // Refresh customer orders
  const loadMyOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (customerPhone) params.set('phone', customerPhone);
      if (customerEmail) params.set('email', customerEmail);
      const res = await fetch(`/api/orders/my-orders?${params.toString()}`, {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
      });
      const data = await res.json();
      if (Array.isArray(data.orders)) {
        setMyOrders(data.orders);
      }
    } catch {
      setMyOrders(readStoredJson('gs_my_orders_v1', []));
    }
  }, [customerEmail, customerPhone, idToken]);

  useEffect(() => {
    loadMyOrders();
  }, [loadMyOrders]);

  // Handle Cashfree Gateway Return URL (?cf_order_id=...&order_num=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const cfOrderId = params.get('cf_order_id');
    const orderNum = params.get('order_num');
    if (!cfOrderId && !orderNum) return;

    const verifyReturnedPayment = async () => {
      try {
        const res = await fetch('/api/payments/cashfree/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cfOrderId: cfOrderId || orderNum,
            orderNumber: orderNum || cfOrderId,
          }),
        });
        const vData = await res.json();
        const existingOrders = readStoredJson<any[]>('gs_my_orders_v1', []);
        const matchedIdx = existingOrders.findIndex(
          (o) =>
            o?.order?.orderNumber === orderNum ||
            o?.order?.orderNumber === cfOrderId
        );

        if (vData?.success || vData?.order?.paymentStatus === 'PAID') {
          let finalizedEntry = matchedIdx >= 0 ? existingOrders[matchedIdx] : null;
          if (finalizedEntry) {
            finalizedEntry = {
              ...finalizedEntry,
              order: {
                ...finalizedEntry.order,
                ...vData.order,
                paymentStatus: 'PAID',
                orderStatus: 'CONFIRMED',
              },
            };
            existingOrders[matchedIdx] = finalizedEntry;
            localStorage.setItem('gs_my_orders_v1', JSON.stringify(existingOrders));
            setMyOrders(existingOrders);
          } else {
            finalizedEntry = { order: vData.order, items: [] };
          }
          setConfirmedOrderData(finalizedEntry);
          setCartItems([]);
          setAppliedCouponCode('');
          setActiveView('confirmation');
          showToast('Payment verified cleanly!');
        }
      } catch {
        // Ignore transient verification failure
      } finally {
        window.history.replaceState({}, '', '/');
      }
    };

    verifyReturnedPayment();
  }, [showToast]);

  // Live Cart Calculation
  const cartCalculation = useMemo(() => {
    const pricedItems = cartItems
      .map((ci) => {
        const prod = products.find((p) => Number(p.id) === Number(ci.productId));
        if (!prod) return null;
        const variant =
          prod.variants?.find((v: any) => Number(v.id) === Number(ci.variantId)) ||
          prod.variants?.[0] || {
            id: ci.variantId || prod.id,
            variantName: 'Standard Pack',
            sku: prod.sku || `GS-${prod.id}`,
            sellingPricePaise: prod.sellingPricePaise || 0,
            mrpPaise: prod.mrpPaise || prod.sellingPricePaise || 0,
            stockQuantity: prod.totalStock ?? 50,
          };
        const unitPricePaise = Number(
          variant.sellingPricePaise ?? variant.pricePaise ?? prod.sellingPricePaise ?? 0
        );
        const unitMrpPaise = Number(variant.mrpPaise ?? prod.mrpPaise ?? unitPricePaise);
        const baseName = variant.variantName || 'Standard Pack';
        const displayVar =
          ci.selectedColor &&
          !baseName.toLowerCase().includes(String(ci.selectedColor).split(' ')[0].toLowerCase())
            ? `${baseName} (${ci.selectedColor})`
            : baseName;
        return {
          productId: Number(prod.id),
          variantId: Number(variant.id),
          productName: prod.name,
          variantName: displayVar,
          selectedColor: ci.selectedColor,
          sku: variant.sku || prod.sku || `GS-${prod.id}`,
          quantity: Math.max(1, Number(ci.quantity) || 1),
          unitMrpPaise,
          unitPricePaise,
          taxRatePercent: Number(prod.taxRatePercent ?? 12),
          availableStock: Number(variant.stockQuantity ?? prod.totalStock ?? 50),
          pickupEligible: prod.pickupEligible !== false,
          deliveryEligible: prod.deliveryEligible !== false,
        };
      })
      .filter(Boolean) as any[];

    const cleanCoupon = appliedCouponCode.trim().toUpperCase();
    const matchedCoupon = cleanCoupon
      ? coupons.find((c) => String(c.code || '').toUpperCase() === cleanCoupon) || null
      : null;

    const cleanPin = shippingPincode.trim();
    const matchedPin = cleanPin
      ? serviceablePincodes.find((p) => p.pincode === cleanPin && p.isActive !== false) || null
      : null;

    return calculateOrderTotals({
      items: pricedItems,
      fulfilmentMethod,
      coupon: matchedCoupon,
      pincodeRule: matchedPin,
    });
  }, [
    cartItems,
    products,
    appliedCouponCode,
    coupons,
    shippingPincode,
    serviceablePincodes,
    fulfilmentMethod,
  ]);

  useEffect(() => {
    if (appliedCouponCode && cartCalculation.couponMessage) {
      setCouponMessage(cartCalculation.couponMessage);
    } else if (appliedCouponCode && cartCalculation.couponDiscountPaise > 0) {
      setCouponMessage(
        `${appliedCouponCode} applied — saved ${formatPaiseToINR(
          cartCalculation.couponDiscountPaise,
          false
        )}!`
      );
    } else {
      setCouponMessage(undefined);
    }
  }, [appliedCouponCode, cartCalculation]);

  const totalCartItemsCount = useMemo(
    () => cartItems.reduce((sum, ci) => sum + Number(ci.quantity || 1), 0),
    [cartItems]
  );

  // Add item using composite (productId, variantId, selectedColor) key
  const addItemToCart = useCallback(
    (
      productId: number,
      explicitVariantId?: number,
      qty = 1,
      explicitColor?: string,
      openDrawer = true
    ) => {
      const prod = products.find((p) => Number(p.id) === Number(productId));
      if (!prod) return;
      const colorOpts = getProductColorOptions(prod);
      const chosenColor =
        explicitColor ||
        selectedColorByProduct[productId] ||
        (colorOpts.length > 0 ? colorOpts[0].label : undefined);
      const matchedColorOpt = colorOpts.find((c) => c.label === chosenColor);
      const chosenVariantId =
        explicitVariantId ||
        selectedVariantByProduct[productId] ||
        matchedColorOpt?.variantId ||
        prod.variants?.[0]?.id ||
        productId;

      const targetKey = getCartItemKey({
        productId,
        variantId: chosenVariantId,
        selectedColor: chosenColor,
      });

      setCartItems((prev) => {
        const idx = prev.findIndex((item) => getCartItemKey(item) === targetKey);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
          return next;
        }
        return [
          ...prev,
          {
            productId,
            variantId: chosenVariantId,
            quantity: qty,
            selectedColor: chosenColor,
          },
        ];
      });

      showToast(`Added ${prod.name} to bag`);
      if (openDrawer) setCartDrawerOpen(true);
    },
    [products, selectedColorByProduct, selectedVariantByProduct, showToast]
  );

  const handleUpdateCartQuantity = (
    productId: number,
    variantId: number,
    selectedColor: string | undefined,
    delta: number
  ) => {
    const key = getCartItemKey({ productId, variantId, selectedColor });
    setCartItems((prev) =>
      prev
        .map((item) =>
          getCartItemKey(item) === key
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveCartItem = (
    productId: number,
    variantId: number,
    selectedColor: string | undefined
  ) => {
    const key = getCartItemKey({ productId, variantId, selectedColor });
    setCartItems((prev) => prev.filter((item) => getCartItemKey(item) !== key));
  };

  const handleSaveCartItemToWishlist = (
    prod: any,
    variantId: number,
    selectedColor?: string
  ) => {
    setWishlistProductIds((prev) =>
      prev.includes(Number(prod.id)) ? prev : [...prev, Number(prod.id)]
    );
    handleRemoveCartItem(prod.id, variantId, selectedColor);
    showToast(`Saved ${prod.name} to wishlist`);
  };

  const toggleWishlist = (productId: number) => {
    setWishlistProductIds((prev) => {
      const exists = prev.includes(productId);
      showToast(exists ? 'Removed from wishlist' : 'Saved to wishlist');
      return exists ? prev.filter((id) => id !== productId) : [...prev, productId];
    });
  };

  const toggleCompareProduct = (productId: number) => {
    setCompareProductIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      }
      if (prev.length >= 4) {
        setCompareToast('Compare up to 4 stationery items side-by-side.');
        return prev;
      }
      setCompareToast('Added to side-by-side compare tray.');
      return [...prev, productId];
    });
  };

  const handleSelectFulfilment = (nextMethod: FulfilmentMethod) => {
    setFulfilmentMethod(nextMethod);
    if (nextMethod === 'STORE_PICKUP' && paymentMethod === 'COD') {
      setPaymentMethod('PAY_AT_STORE');
    } else if (nextMethod === 'HOME_DELIVERY' && paymentMethod === 'PAY_AT_STORE') {
      setPaymentMethod('COD');
    }
  };

  // Smart Indian Stationery Multi-Attribute Filter
  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      selectedCategorySlug ||
      selectedBrandSlug ||
      rulingFilter !== 'ALL' ||
      tipFilter !== 'ALL' ||
      priceRangeFilter !== 'ALL'
  );

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedCategorySlug('');
    setSelectedBrandSlug('');
    setRulingFilter('ALL');
    setTipFilter('ALL');
    setPriceRangeFilter('ALL');
    setSortBy('featured');
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = products.filter((p) => {
      if (p.isActive === false) return false;
      if (selectedCategorySlug && p.categorySlug !== selectedCategorySlug) return false;
      if (selectedBrandSlug && p.brandSlug !== selectedBrandSlug) return false;
      if (!matchesRulingFilter(p, rulingFilter)) return false;
      if (!matchesTipOrGradeFilter(p, tipFilter)) return false;
      if (!matchesPriceRangeFilter(p, priceRangeFilter)) return false;
      if (!q) return true;
      const blob = [p.name, p.brandName, p.categoryName, p.shortDescription, p.description, p.sku]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });

    if (sortBy === 'price-asc') {
      return [...list].sort(
        (a, b) => Number(a.sellingPricePaise || 0) - Number(b.sellingPricePaise || 0)
      );
    }
    if (sortBy === 'price-desc') {
      return [...list].sort(
        (a, b) => Number(b.sellingPricePaise || 0) - Number(a.sellingPricePaise || 0)
      );
    }
    return list;
  }, [
    products,
    searchQuery,
    selectedCategorySlug,
    selectedBrandSlug,
    rulingFilter,
    tipFilter,
    priceRangeFilter,
    sortBy,
  ]);

  const activePdpProduct = useMemo(
    () => products.find((p) => p.slug === activeProductSlug) || null,
    [products, activeProductSlug]
  );

  const wishlistProducts = useMemo(
    () => products.filter((p) => wishlistProductIds.includes(Number(p.id))),
    [products, wishlistProductIds]
  );

  const activePolicyPage = useMemo(
    () =>
      cmsPages.find((p) => p.slug === activePageSlug) ||
      DEFAULT_CMS_PAGES.find((p) => p.slug === activePageSlug) ||
      DEFAULT_CMS_PAGES[0],
    [cmsPages, activePageSlug]
  );

  // Auth Handlers
  const completeCustomerSignIn = async (
    resolvedEmail: string,
    resolvedName: string,
    phoneVal = ''
  ) => {
    const cleanEmail = resolvedEmail.trim().toLowerCase();
    const cleanName = resolvedName.trim() || cleanEmail.split('@')[0] || 'Student Member';
    const res = await fetch('/api/auth/customer-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        fullName: cleanName,
        phone: phoneVal || customerPhone,
      }),
    });
    const data = await res.json();
    const isOwner = cleanEmail === OWNER_EMAIL;
    const finalUser = data?.user
      ? { ...data.user, role: isOwner ? 'owner' : 'customer' }
      : {
          id: isOwner ? 1 : 2,
          uid: `cust-${cleanEmail}`,
          email: cleanEmail,
          fullName: cleanName,
          phone: phoneVal || customerPhone,
          role: isOwner ? 'owner' : 'customer',
        };
    const finalToken =
      data?.token ||
      (isOwner ? `gs_admin_direct_owner:${cleanEmail}` : `gs_customer_direct:${cleanEmail}`);

    localStorage.setItem(
      'gs_admin_session_v1',
      JSON.stringify({
        token: finalToken,
        expiresAt: data?.expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000,
        user: finalUser,
      })
    );
    localStorage.setItem(
      'gs_user_profile_v1',
      JSON.stringify({
        ...finalUser,
        shippingAddress,
        shippingCity,
        shippingPincode,
      })
    );
    setIdToken(finalToken);
    setDbUser(finalUser);
    setCustomerEmail(finalUser.email);
    if (finalUser.fullName) setCustomerName(finalUser.fullName);
    if (finalUser.phone) setCustomerPhone(finalUser.phone);
    await loadStoreBootstrap(finalToken);
    navigateTo('storefront', '/');
    showToast(`Welcome, ${finalUser.fullName || finalUser.email}!`);
  };

  const handleCustomerGoogleSignIn = async () => {
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      let emailVal = authEmailInput.trim().toLowerCase();
      let nameVal = authNameInput.trim();
      try {
        const res = await signInWithPopup(auth, googleAuthProvider);
        if (res?.user?.email) {
          emailVal = res.user.email.trim().toLowerCase();
          nameVal = res.user.displayName || nameVal;
        }
      } catch {
        // Fallback when embedded popup is blocked
      }
      if (!emailVal || !emailVal.includes('@')) {
        throw new Error(
          'Google popup was blocked by your browser. Enter your email below and click Sign In.'
        );
      }
      await completeCustomerSignIn(emailVal, nameVal, authPhoneInput);
    } catch (err: any) {
      setAuthError(err.message || 'Sign-in could not complete.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!authEmailInput.trim().includes('@')) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    setAuthSubmitting(true);
    try {
      await completeCustomerSignIn(
        authEmailInput,
        authNameInput || authEmailInput.split('@')[0],
        authPhoneInput
      );
    } catch (err: any) {
      setAuthError(err.message || 'Could not sign in.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleAdminPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError(null);
    setAdminAuthSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmailInput.trim(),
          password: adminPasswordInput,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Invalid shop owner credentials.');
      }
      const userObj = data.user || {
        id: 1,
        uid: 'admin-owner',
        email: adminEmailInput.trim(),
        fullName: 'Gayatri Stationers Owner',
        role: 'owner',
      };
      const tok = data.token || `gs_admin_direct_owner:${userObj.email}`;
      localStorage.setItem(
        'gs_admin_session_v1',
        JSON.stringify({
          token: tok,
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
          user: userObj,
        })
      );
      setIdToken(tok);
      setDbUser(userObj);
      await loadStoreBootstrap(tok);
      navigateTo('admin', '/admin');
      showToast('Welcome back to Shop Manager.');
    } catch (err: any) {
      setAdminAuthError(err.message || 'Admin login failed.');
    } finally {
      setAdminAuthSubmitting(false);
    }
  };

  const handleAdminGoogleSignIn = async () => {
    setAdminAuthError(null);
    setAdminAuthSubmitting(true);
    try {
      let emailVal = adminEmailInput.trim() || OWNER_EMAIL;
      let firebaseIdToken = '';
      try {
        const res = await signInWithPopup(auth, googleAuthProvider);
        if (res?.user?.email) {
          emailVal = res.user.email.trim().toLowerCase();
          firebaseIdToken = await res.user.getIdToken();
        }
      } catch {
        // Popup fallback
      }
      const apiRes = await fetch('/api/admin/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: firebaseIdToken, email: emailVal }),
      });
      const data = await apiRes.json();
      if (!apiRes.ok || data.error) throw new Error(data.error || 'Owner Google login failed.');
      const userObj = data.user || {
        id: 1,
        uid: 'admin-owner',
        email: emailVal,
        fullName: 'Gayatri Stationers Owner',
        role: 'owner',
      };
      const tok = data.token || `gs_admin_direct_owner:${emailVal}`;
      localStorage.setItem(
        'gs_admin_session_v1',
        JSON.stringify({
          token: tok,
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
          user: userObj,
        })
      );
      setIdToken(tok);
      setDbUser(userObj);
      navigateTo('admin', '/admin');
    } catch (err: any) {
      setAdminAuthError(err.message || 'Owner login failed.');
    } finally {
      setAdminAuthSubmitting(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updatedProfile = {
        ...(dbUser || {}),
        fullName: customerName.trim(),
        phone: customerPhone.replace(/\D/g, '').slice(-10),
        email: customerEmail.trim(),
        shippingAddress: shippingAddress.trim(),
        shippingCity: shippingCity.trim(),
        shippingPincode: shippingPincode.trim(),
      };
      localStorage.setItem('gs_user_profile_v1', JSON.stringify(updatedProfile));
      if (dbUser) {
        const nextUser = {
          ...dbUser,
          fullName: updatedProfile.fullName,
          phone: updatedProfile.phone,
        };
        setDbUser(nextUser);
        const sess = readStoredJson<any>('gs_admin_session_v1', null);
        if (sess) {
          localStorage.setItem('gs_admin_session_v1', JSON.stringify({ ...sess, user: nextUser }));
        }
      }
      await fetch('/api/auth/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify(updatedProfile),
      });
      showToast('Profile & Kanpur address saved!');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('gs_admin_session_v1');
    setIdToken(null);
    setDbUser(null);
    showToast('Signed out safely. Your order receipts remain saved on this device.');
    navigateTo('storefront', '/');
  };

  // Track Order Lookup
  const performTrackSearch = async (qStr: string) => {
    const clean = qStr.trim();
    if (!clean) return;
    setTrackSearching(true);
    try {
      const res = await fetch(`/api/orders/lookup?q=${encodeURIComponent(clean)}`);
      const data = await res.json();
      setTrackResults(Array.isArray(data.orders) ? data.orders : []);
      if (!data.orders || data.orders.length === 0) {
        showToast('No matching order found for that number or mobile.');
      }
    } finally {
      setTrackSearching(false);
    }
  };

  // Cashfree Payment Modal & Order Placement
  const loadCashfreeSdk = async (): Promise<any> => {
    if (typeof window !== 'undefined' && typeof (window as any).Cashfree === 'function') {
      return (window as any).Cashfree;
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.async = true;
      script.onload = () => resolve((window as any).Cashfree);
      script.onerror = () => reject(new Error('Cashfree SDK could not load. Check your network.'));
      document.head.appendChild(script);
    });
  };

  const markLocalOrderPaid = (orderNumber: string, updatedOrderObj: any) => {
    const existing = readStoredJson<any[]>('gs_my_orders_v1', []);
    const updated = existing.map((o) =>
      o?.order?.orderNumber === orderNumber
        ? {
            ...o,
            order: {
              ...o.order,
              ...updatedOrderObj,
              paymentStatus: 'PAID',
              orderStatus:
                o.order.orderStatus === 'PAYMENT_PENDING' ? 'CONFIRMED' : o.order.orderStatus,
            },
          }
        : o
    );
    localStorage.setItem('gs_my_orders_v1', JSON.stringify(updated));
    setMyOrders(updated);
  };

  const triggerCashfreePayment = async (orderBundle: any) => {
    const orderNumber = orderBundle.order.orderNumber;
    setCheckoutSubmitting(true);
    setCheckoutError(null);
    try {
      const CashfreeFactory = await loadCashfreeSdk();
      let sessionId = orderBundle?.cashfree?.paymentSessionId || '';
      let cfOrderId = orderBundle?.cashfree?.cfOrderId || orderNumber;
      let env = orderBundle?.cashfree?.environment || 'SANDBOX';

      if (!sessionId) {
        const cfCfg = storeSettings?.cashfree_config || {};
        const res = await fetch('/api/payments/cashfree/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNumber,
            amountRupees: Number((Number(orderBundle.order.totalPaise || 0) / 100).toFixed(2)),
            customerName: orderBundle.order.customerName,
            customerPhone: orderBundle.order.customerPhone,
            customerEmail: orderBundle.order.customerEmail,
            returnOrigin: window.location.origin,
            ...(cfCfg.appId && cfCfg.secretKey
              ? {
                  appId: cfCfg.appId,
                  secretKey: cfCfg.secretKey,
                  environment: cfCfg.environment || 'SANDBOX',
                }
              : {}),
          }),
        });
        const sData = await res.json();
        if (sData?.fallback && !sData?.paymentSessionId) {
          throw new Error(
            sData.error ||
              'Live Cashfree payment gateway is not connected right now. Retry or switch to Pay at Store Counter / Cash on Delivery below.'
          );
        }
        if (!res.ok || !sData.paymentSessionId) {
          throw new Error(sData.error || 'Could not start online payment session.');
        }
        sessionId = sData.paymentSessionId;
        cfOrderId = sData.cfOrderId || orderNumber;
        env = sData.environment || 'SANDBOX';
      }

      const cashfree = CashfreeFactory({
        mode: env === 'PRODUCTION' ? 'production' : 'sandbox',
      });
      const result = await cashfree.checkout({
        paymentSessionId: sessionId,
        redirectTarget: '_modal',
      });
      if (result?.error) {
        throw new Error(
          result.error.message ||
            'Payment popup was closed before finishing. Retry or switch to Counter/COD.'
        );
      }

      const cfCfgVerify = storeSettings?.cashfree_config || {};
      const vRes = await fetch('/api/payments/cashfree/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber,
          cfOrderId,
          ...(cfCfgVerify.appId && cfCfgVerify.secretKey
            ? {
                appId: cfCfgVerify.appId,
                secretKey: cfCfgVerify.secretKey,
                environment: cfCfgVerify.environment || 'SANDBOX',
              }
            : {}),
        }),
      });
      const vData = await vRes.json();
      if (!vRes.ok || vData.order?.paymentStatus !== 'PAID') {
        throw new Error(
          vData.error ||
            'Payment was not completed yet. Retry UPI/Card or finish via Counter/COD.'
        );
      }

      markLocalOrderPaid(orderNumber, vData.order);
      const finalized = {
        ...orderBundle,
        order: { ...orderBundle.order, ...vData.order, paymentStatus: 'PAID' },
      };
      setConfirmedOrderData(finalized);
      setPendingOnlineOrder(null);
      setCartItems([]);
      setAppliedCouponCode('');
      await loadMyOrders();
      navigateTo('confirmation', '/confirmation');
    } catch (err: any) {
      setPendingOnlineOrder(orderBundle);
      setCheckoutError(err.message || 'Online payment could not finish.');
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const handleSwitchPendingOrderToOffline = async () => {
    if (!pendingOnlineOrder?.order) return;
    setCheckoutSubmitting(true);
    try {
      const nextMethod = fulfilmentMethod === 'STORE_PICKUP' ? 'PAY_AT_STORE' : 'COD';
      const updatedEntry = {
        ...pendingOnlineOrder,
        order: {
          ...pendingOnlineOrder.order,
          paymentMethod: nextMethod,
          orderStatus: 'ORDER_PLACED',
        },
      };
      const existing = readStoredJson<any[]>('gs_my_orders_v1', []);
      const synced = existing.map((o) =>
        o?.order?.orderNumber === updatedEntry.order.orderNumber ? updatedEntry : o
      );
      localStorage.setItem('gs_my_orders_v1', JSON.stringify(synced));
      setMyOrders(synced);
      setConfirmedOrderData(updatedEntry);
      setPendingOnlineOrder(null);
      setCheckoutError(null);
      setCartItems([]);
      setAppliedCouponCode('');
      navigateTo('confirmation', '/confirmation');
      showToast('Order confirmed with offline payment!');
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);

    if (!customerName.trim()) {
      setCheckoutError('Please enter buyer name.');
      return;
    }
    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      setCheckoutError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (fulfilmentMethod === 'HOME_DELIVERY') {
      if (!shippingAddress.trim()) {
        setCheckoutError('Please enter your delivery street/house address.');
        return;
      }
      if (shippingPincode.replace(/\D/g, '').length !== 6) {
        setCheckoutError('Please enter a valid 6-digit Kanpur / UP PIN code.');
        return;
      }
    }

    setCheckoutSubmitting(true);
    try {
      localStorage.setItem(
        'gs_user_profile_v1',
        JSON.stringify({
          fullName: customerName.trim(),
          phone: phoneDigits,
          email: customerEmail.trim() || STORE_EMAIL,
          shippingAddress: shippingAddress.trim(),
          shippingCity: shippingCity.trim() || 'Kanpur',
          shippingPincode: shippingPincode.trim() || '208021',
        })
      );

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          fulfilmentMethod,
          paymentMethod,
          customerName: customerName.trim(),
          customerPhone: phoneDigits,
          customerEmail: customerEmail.trim() || STORE_EMAIL,
          shippingAddress:
            fulfilmentMethod === 'HOME_DELIVERY' ? shippingAddress.trim() : STORE_ADDRESS,
          shippingCity: shippingCity.trim() || 'Kanpur',
          shippingPincode: shippingPincode.trim() || '208021',
          pickupWindow,
          customerNote: orderNote,
          gstin,
          couponCode: appliedCouponCode,
          items: cartCalculation.items,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error || !data.order) {
        throw new Error(data.error || 'Could not create your order.');
      }

      if (paymentMethod === 'CASHFREE_ONLINE') {
        await triggerCashfreePayment(data);
        return;
      }

      setConfirmedOrderData(data);
      setCartItems([]);
      setAppliedCouponCode('');
      await loadMyOrders();
      navigateTo('confirmation', '/confirmation');
    } catch (err: any) {
      setCheckoutError(err.message || 'Order placement encountered an issue.');
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  // Add full Combo Bundle directly into Bag (supports both itemsJson & items)
  const handleAddBundleToCart = (bundle: any) => {
    const components = Array.isArray(bundle.items)
      ? bundle.items
      : Array.isArray(bundle.itemsJson)
      ? bundle.itemsJson
      : [];
    let added = 0;
    components.forEach((comp: any) => {
      const targetProd = products.find((p) => Number(p.id) === Number(comp.productId));
      if (targetProd) {
        addItemToCart(
          targetProd.id,
          comp.variantId || targetProd.variants?.[0]?.id,
          Number(comp.quantity || 1),
          undefined,
          false
        );
        added += 1;
      }
    });
    if (added > 0) {
      showToast(`${bundle.name} added to your bag!`);
      setCartDrawerOpen(true);
    }
  };

  const handleReorderPastOrder = (items: any[]) => {
    items.forEach((it) => {
      addItemToCart(
        Number(it.productId),
        Number(it.variantId),
        Math.max(1, Number(it.quantity || 1)),
        it.selectedColor,
        false
      );
    });
    showToast('Previous items added back to your bag!');
    setCartDrawerOpen(true);
  };

  const themeCfg = storeSettings?.theme_config || {};
  const announcementText =
    themeCfg.announcementText ||
    'Free 2-Hr Store Pickup in Kanpur · UPI & COD Available · GST Invoice Ready · Use BACKTOSCHOOL10';
  const heroTitle =
    themeCfg.heroTitle || 'Everyday Essentials, Fine Paper & Art Supplies.';

  if (activeView === 'admin') {
    return (
      <AdminDashboard
        idToken={idToken}
        currentUser={dbUser}
        categories={categories}
        brands={brands}
        products={products}
        storeSettings={storeSettings}
        bootstrap={bootstrapData}
        onRefreshStorefront={() => loadStoreBootstrap()}
        onRoleSwitched={async (nextRole) => {
          if (dbUser) setDbUser({ ...dbUser, role: nextRole });
        }}
        onExitAdmin={() => navigateTo('storefront', '/')}
        onNavigateStorefront={(target) => {
          if (target.categorySlug) setSelectedCategorySlug(target.categorySlug);
          if (target.brandSlug) setSelectedBrandSlug(target.brandSlug);
          navigateTo((target.view as ActiveView) || 'storefront', '/');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col text-[#1F1C18] pb-24 lg:pb-0">
      {/* Live Toast Feedback */}
      {toastText && (
        <div className="fixed top-20 right-4 z-50 max-w-sm">
          <div className="liquid-glass-accent text-white px-4 py-2.5 rounded-full shadow-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#FCEAE3] shrink-0" />
            <span>{toastText}</span>
          </div>
        </div>
      )}

      {/* Top Warm Terracotta Notice Strip */}
      <div className="liquid-glass-accent text-white text-[11px] sm:text-xs font-medium py-2 px-4 text-center">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 flex-wrap">
          <Sparkles className="w-3.5 h-3.5 text-[#FCEAE3] shrink-0" />
          <span>{announcementText}</span>
          <button
            type="button"
            onClick={() => navigateTo('bulk', '/bulk', { bulkNote: '' })}
            className="underline font-bold text-[#FFF5F0] hover:text-white cursor-pointer"
          >
            School & Office Bulk Orders →
          </button>
        </div>
      </div>

      {/* Floating Liquid Glass Header + Interactive Mega Menu */}
      <header className="sticky top-0 z-40 px-3 sm:px-6 pt-2.5">
        <div className="max-w-7xl mx-auto relative">
          <div className="liquid-glass-nav rounded-[28px] lg:rounded-full px-3.5 sm:px-6 py-2.5 flex items-center justify-between gap-2.5">
            {/* Brand Identity */}
            <button
              type="button"
              onClick={() => {
                resetAllFilters();
                navigateTo('storefront', '/');
              }}
              className="flex items-center gap-2.5 text-left shrink-0 cursor-pointer"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl liquid-btn-primary flex items-center justify-center shrink-0">
                <Store className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <span className="block text-sm sm:text-base font-bold text-[#1F1C18] font-serif-display leading-none">
                  Gayatri Stationers
                </span>
                <span className="block text-[10px] text-[#5C5349] font-semibold mt-0.5">
                  Naubasta, Kanpur · Fine Stationery
                </span>
              </div>
            </button>

            {/* Desktop Search */}
            <div className="hidden md:flex flex-1 max-w-md relative">
              <Search className="w-4 h-4 text-[#8B8075] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeView !== 'storefront') navigateTo('storefront', '/');
                }}
                placeholder="Search Classmate notebooks, Flair 0.5mm, Camlin..."
                className="liquid-input w-full pl-10 pr-4 py-2 rounded-full text-xs"
              />
            </div>

            {/* Desktop Mega Menu Trigger & Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold text-[#1F1C18]">
              <button
                type="button"
                onClick={() => setMegaMenuOpen((v) => !v)}
                className={`px-3.5 py-2 rounded-full inline-flex items-center gap-1 transition cursor-pointer ${
                  megaMenuOpen ? 'bg-[#FDF2ED] text-[#8C341B] font-bold' : 'hover:bg-white/80'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-[#B44C2E]" />
                <span>Shop Categories</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    megaMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() => navigateTo('combos', '/combos')}
                className={`px-3.5 py-2 rounded-full transition cursor-pointer ${
                  activeView === 'combos' ? 'bg-[#FDF2ED] text-[#8C341B] font-bold' : 'hover:bg-white/80'
                }`}
              >
                Exam & Art Combos
              </button>

              <button
                type="button"
                onClick={() => navigateTo('bulk', '/bulk', { bulkNote: '' })}
                className={`px-3.5 py-2 rounded-full transition cursor-pointer ${
                  activeView === 'bulk' ? 'bg-[#FDF2ED] text-[#8C341B] font-bold' : 'hover:bg-white/80'
                }`}
              >
                Bulk Inquiry
              </button>

              <button
                type="button"
                onClick={() => navigateTo('track', '/track')}
                className={`px-3.5 py-2 rounded-full transition cursor-pointer ${
                  activeView === 'track' ? 'bg-[#FDF2ED] text-[#8C341B] font-bold' : 'hover:bg-white/80'
                }`}
              >
                Track
              </button>
            </nav>

            {/* Right Utility Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {compareProductIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsCompareOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1 liquid-btn-glass px-3 py-2 rounded-full text-xs font-semibold cursor-pointer"
                >
                  <Scale className="w-3.5 h-3.5 text-[#B44C2E]" />
                  <span>({compareProductIds.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => navigateTo('wishlist', '/wishlist')}
                className="liquid-btn-glass p-2 sm:px-3 sm:py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                aria-label="Wishlist"
              >
                <Heart className="w-4 h-4 text-[#B44C2E]" />
                {wishlistProductIds.length > 0 && (
                  <span className="text-[11px] font-bold">{wishlistProductIds.length}</span>
                )}
              </button>

              {dbUser ? (
                <div className="hidden sm:inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => navigateTo('profile', '/profile')}
                    className="liquid-btn-glass px-3.5 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 max-w-[155px] cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-[#B44C2E] shrink-0" />
                    <span className="truncate">{dbUser.fullName || dbUser.email}</span>
                  </button>
                  {(dbUser.role === 'owner' || dbUser.role === 'staff') && (
                    <button
                      type="button"
                      onClick={() => navigateTo('admin', '/admin')}
                      className="liquid-btn-primary px-3.5 py-2 rounded-full text-xs font-semibold cursor-pointer"
                    >
                      Admin
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateTo('signin', '/signin')}
                  className="hidden sm:inline-flex liquid-btn-glass px-3.5 py-2 rounded-full text-xs font-semibold items-center gap-1.5 cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-[#B44C2E]" />
                  Sign In
                </button>
              )}

              <button
                type="button"
                onClick={() => setCartDrawerOpen(true)}
                className="liquid-btn-primary px-3.5 sm:px-4 py-2 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                aria-label="Open Shopping Bag"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{totalCartItemsCount}</span>
                {totalCartItemsCount > 0 && (
                  <span className="hidden sm:inline font-mono-tabular">
                    · {formatPaiseToINR(cartCalculation.totalPaise, false)}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="lg:hidden liquid-btn-glass p-2 rounded-full cursor-pointer"
                aria-label="Menu"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Desktop Liquid Glass Mega Menu Dropdown */}
          {megaMenuOpen && (
            <div className="hidden lg:grid grid-cols-12 gap-6 mt-2.5 liquid-glass rounded-[32px] p-6 shadow-2xl">
              <div className="col-span-5 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#B44C2E]">
                  Stationery Departments
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {categories.map((cat) => (
                    <button
                      key={cat.id || cat.slug}
                      type="button"
                      onClick={() => {
                        setSelectedCategorySlug(cat.slug);
                        setMegaMenuOpen(false);
                        if (activeView !== 'storefront') navigateTo('storefront', '/');
                        else
                          document
                            .getElementById('catalog-grid')
                            ?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl hover:bg-[#FDF2ED] text-left transition cursor-pointer"
                    >
                      <div>
                        <p className="text-xs font-bold text-[#1F1C18]">{cat.name}</p>
                        <p className="text-[11px] text-[#5C5349]">{cat.description}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[#B44C2E]" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-4 space-y-3 border-x border-[#E8DFD5] px-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#B44C2E]">
                  Popular Indian Brands
                </p>
                <div className="flex flex-wrap gap-2">
                  {brands.map((brand) => (
                    <button
                      key={brand.id || brand.slug}
                      type="button"
                      onClick={() => {
                        setSelectedBrandSlug(brand.slug);
                        setMegaMenuOpen(false);
                        if (activeView !== 'storefront') navigateTo('storefront', '/');
                        else
                          document
                            .getElementById('catalog-grid')
                            ?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="liquid-btn-glass px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
                    >
                      {brand.name}
                    </button>
                  ))}
                </div>

                <p className="text-[11px] font-bold uppercase tracking-wider text-[#B44C2E] pt-3">
                  Quick Ruling & Spec Shortcuts
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Single Ruled Notebooks', fn: () => setRulingFilter('SINGLE_RULED') },
                    { label: '0.5mm Needle Gel Pens', fn: () => setTipFilter('0.5mm') },
                    { label: 'Spiral Registers', fn: () => setRulingFilter('SPIRAL') },
                    { label: 'Under ₹150 Budget Picks', fn: () => setPriceRangeFilter('UNDER_150') },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        item.fn();
                        setMegaMenuOpen(false);
                        if (activeView !== 'storefront') navigateTo('storefront', '/');
                        else
                          document
                            .getElementById('catalog-grid')
                            ?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="px-2.5 py-1 rounded-full bg-[#FDF2ED] text-[#8C341B] text-[11px] font-semibold hover:underline cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-3 liquid-glass-accent text-white rounded-3xl p-5 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                    Institutional Desk
                  </span>
                  <h3 className="text-base font-bold font-serif-display">
                    Schools & Office Wholesale Slabs
                  </h3>
                  <p className="text-[11px] text-[#FFF5F0]/85 leading-relaxed">
                    Get GST-compliant B2B quotes for annual booklists, A4 ream cartons & exam kits.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo('bulk', '/bulk', { bulkNote: '' })}
                  className="mt-4 w-full py-2 rounded-full bg-white text-[#1F1C18] text-xs font-bold cursor-pointer"
                >
                  Open Bulk Quote Form →
                </button>
              </div>
            </div>
          )}

          {/* Mobile Drawer */}
          {mobileMenuOpen && (
            <div className="lg:hidden mt-2 liquid-glass rounded-3xl p-4 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-[#8B8075] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (activeView !== 'storefront') navigateTo('storefront', '/');
                  }}
                  placeholder="Search notebooks, Classmate, Flair..."
                  className="liquid-input w-full pl-10 pr-4 py-2.5 rounded-full text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => navigateTo('combos', '/combos')}
                  className="liquid-btn-glass py-2.5 rounded-2xl cursor-pointer"
                >
                  Exam & Art Combos
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo('bulk', '/bulk', { bulkNote: '' })}
                  className="liquid-btn-glass py-2.5 rounded-2xl cursor-pointer"
                >
                  Bulk & Schools
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo('track', '/track')}
                  className="liquid-btn-glass py-2.5 rounded-2xl cursor-pointer"
                >
                  Track Orders
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigateTo(dbUser ? 'profile' : 'signin', dbUser ? '/profile' : '/signin')
                  }
                  className="liquid-btn-glass py-2.5 rounded-2xl cursor-pointer"
                >
                  {dbUser ? 'My Profile' : 'Sign In'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => navigateTo('admin-login', '/admin/login')}
                className="w-full liquid-btn-primary py-2.5 rounded-full text-xs font-bold cursor-pointer"
              >
                Shop Owner Admin Portal
              </button>
            </div>
          )}
        </div>
      </header>

      {/* MAIN PAGE AREA */}
      <main className="flex-1">
        {/* ================================================================
            VIEW: HOMEPAGE & STOREFRONT CATALOGUE
           ================================================================ */}
        {activeView === 'storefront' && (
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-8">
            {/* 1. BRIGHT HIGH-RESOLUTION LIQUID GLASS HERO BANNER */}
            <section className="liquid-hero-bright rounded-[34px] p-5 sm:p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
              <div className="lg:col-span-7 space-y-5">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FDF2ED] border border-[#E8D8CC] text-[11px] font-bold text-[#8C341B]">
                  <MapPin className="w-3.5 h-3.5 text-[#B44C2E]" />
                  <span>Awas Vikas Market, Naubasta, Kanpur</span>
                </div>

                <h1 className="text-3xl sm:text-5xl font-bold font-serif-display text-[#1F1C18] leading-[1.08]">
                  {heroTitle}
                </h1>

                <p className="text-xs sm:text-base text-[#4A423B] max-w-xl leading-relaxed">
                  Tactile archival notebooks, precision gel & rollerball pens, Camlin & DOMS fine art
                  palettes, and complete school & corporate desk supplies at genuine MRP prices.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById('catalog-grid')?.scrollIntoView({ behavior: 'smooth' })
                    }
                    className="liquid-btn-primary px-6 py-3 rounded-full text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    Shop All Stationery
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateTo('bulk', '/bulk', { bulkNote: '' })}
                    className="liquid-btn-glass px-5 py-3 rounded-full text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Building2 className="w-4 h-4 text-[#B44C2E]" />
                    School & Office Bulk Orders
                  </button>
                </div>

                {/* Indian Shopper Trust Badges */}
                <div className="pt-2 flex flex-wrap items-center gap-2.5 text-[11px] font-semibold text-[#1F1C18]">
                  <span className="liquid-glass-subtle px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-[#B44C2E]" />
                    UPI & Cash on Delivery
                  </span>
                  <span className="liquid-glass-subtle px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-[#B44C2E]" />
                    100% GST Tax Invoice
                  </span>
                  <span className="liquid-glass-subtle px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-[#B44C2E]" />
                    2-Hr Kanpur Pickup & Fast Delivery
                  </span>
                </div>
              </div>

              {/* Bright Curated Paper & Craft Hero Visual */}
              <div className="lg:col-span-5">
                <div className="liquid-glass rounded-[28px] p-3 relative overflow-hidden">
                  <div className="aspect-[4/3] rounded-[22px] overflow-hidden bg-[#F4EDE4]">
                    <img
                      src="https://images.unsplash.com/photo-1513519245088-02929501502f?auto=format&fit=crop&w=1100&q=85"
                      alt="Fine paper notebooks, wooden pencils, fountain pens and art brushes"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="mt-3 px-2 pb-1 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-[#1F1C18]">
                        Back-to-School & Art Studio Collection
                      </p>
                      <p className="text-[11px] text-[#5C5349]">
                        Use code <span className="font-mono-tabular font-bold text-[#B44C2E]">BACKTOSCHOOL10</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRufusInitialQuestion('Best stationery picks under ₹300');
                        setIsRufusOpen(true);
                      }}
                      className="liquid-btn-glass px-3 py-1.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-[#B44C2E]" /> Ask Vidya AI
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. IMMEDIATE VISUAL CATEGORY GRID RIGHT BELOW BANNER */}
            <section aria-label="Visual Categories" className="space-y-3">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#1F1C18] font-serif-display">
                    Browse by Department
                  </h2>
                  <p className="text-xs text-[#5C5349]">
                    Jump directly to classroom essentials, desk hardware, fine art or gift pens.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[
                  {
                    title: 'School & College',
                    caption: 'Notebooks, Registers & Geometry Boxes',
                    slug: 'notebooks-and-diaries',
                    image:
                      'https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=700&q=80',
                  },
                  {
                    title: 'Office Supplies',
                    caption: 'Calculators, Files & Accounting Books',
                    slug: 'office-stationery',
                    image:
                      'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=700&q=80',
                  },
                  {
                    title: 'Art & Craft',
                    caption: 'Watercolour Cakes, Sketchbooks & Pencils',
                    slug: 'art-and-craft-supplies',
                    image:
                      'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=700&q=80',
                  },
                  {
                    title: 'Gifting & Festive Pens',
                    caption: 'Rollerballs, Fineliners & Highlighters',
                    slug: 'pens-and-writing-instruments',
                    image:
                      'https://images.unsplash.com/photo-1585336261026-6a66e2e6f3fd?auto=format&fit=crop&w=700&q=80',
                  },
                ].map((cat) => {
                  const isActive = selectedCategorySlug === cat.slug;
                  return (
                    <button
                      key={cat.title}
                      type="button"
                      onClick={() => {
                        setSelectedCategorySlug(isActive ? '' : cat.slug);
                        document
                          .getElementById('catalog-grid')
                          ?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`liquid-card-hover rounded-[26px] p-3 sm:p-4 text-left flex flex-col gap-3 cursor-pointer ${
                        isActive ? 'ring-2 ring-[#B44C2E]' : ''
                      }`}
                    >
                      <div className="aspect-[16/10] rounded-2xl overflow-hidden bg-[#F4EDE4]">
                        <img
                          src={cat.image}
                          alt={cat.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="text-sm sm:text-base font-bold text-[#1F1C18] font-serif-display leading-snug">
                          {cat.title}
                        </p>
                        <p className="text-[11px] text-[#5C5349] mt-0.5 line-clamp-1">
                          {cat.caption}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 3. DEDICATED HORIZONTAL SLIDER: EXAM KITS, JOURNALING & DESK COMBOS */}
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#B44C2E]">
                    Value Combo Sliders
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#1F1C18] font-serif-display">
                    Curated Exam Kits, Art & Desk Bundles
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo('combos', '/combos')}
                  className="liquid-btn-glass px-4 py-2 rounded-full text-xs font-bold shrink-0 cursor-pointer"
                >
                  View All Combos →
                </button>
              </div>

              <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2">
                {bundles.map((bundle) => {
                  const bundleItems = Array.isArray(bundle.items)
                    ? bundle.items
                    : Array.isArray(bundle.itemsJson)
                    ? bundle.itemsJson
                    : [];
                  const mrpPaise = Number(
                    bundle.mrpPaise || bundle.originalTotalPaise || bundle.bundlePricePaise
                  );
                  const discountPct =
                    bundle.discountPercent ||
                    (mrpPaise > bundle.bundlePricePaise
                      ? Math.round(((mrpPaise - bundle.bundlePricePaise) / mrpPaise) * 100)
                      : 0);

                  return (
                    <div
                      key={bundle.id || bundle.slug}
                      className="liquid-glass rounded-[28px] p-5 w-[300px] sm:w-[340px] shrink-0 snap-start flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2.5 py-1 rounded-full bg-[#FDF2ED] text-[#8C341B] text-[10px] font-bold uppercase tracking-wider">
                            {bundle.targetGroup || 'Value Kit'}
                          </span>
                          {discountPct > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-[#B44C2E] text-white text-[10px] font-bold">
                              SAVE {discountPct}%
                            </span>
                          )}
                        </div>

                        <h3 className="text-base sm:text-lg font-bold text-[#1F1C18] font-serif-display leading-snug">
                          {bundle.name}
                        </h3>
                        <p className="text-xs text-[#5C5349] line-clamp-2">{bundle.description}</p>

                        <ul className="space-y-1 text-[11px] text-[#2E2924] pt-1">
                          {bundleItems.slice(0, 3).map((comp: any, idx: number) => (
                            <li key={idx} className="flex items-center gap-1.5 truncate">
                              <Check className="w-3.5 h-3.5 text-[#B44C2E] shrink-0" />
                              <span className="truncate">{comp.productName || comp.title}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-3 border-t border-[#E8DFD5] flex items-center justify-between gap-2">
                        <div>
                          <span className="text-lg font-bold text-[#1F1C18] tabular-nums">
                            {formatPaiseToINR(bundle.bundlePricePaise, false)}
                          </span>
                          {mrpPaise > bundle.bundlePricePaise && (
                            <span className="ml-1.5 text-xs line-through text-[#8B8075] tabular-nums">
                              {formatPaiseToINR(mrpPaise, false)}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddBundleToCart(bundle)}
                          className="liquid-btn-primary px-4 py-2 rounded-full text-xs font-bold cursor-pointer"
                        >
                          + Add Kit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 4. SMART MULTI-ATTRIBUTE FILTER TOOLBAR & CATALOGUE GRID */}
            <section id="catalog-grid" className="space-y-4">
              <div className="liquid-glass rounded-[28px] p-4 sm:p-5 space-y-3.5">
                {/* Category Horizontal Pills */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCategorySlug('')}
                    className={`category-pill px-4 py-2 text-xs font-semibold shrink-0 cursor-pointer ${
                      selectedCategorySlug === '' ? 'active' : 'liquid-btn-glass text-[#1F1C18]'
                    }`}
                  >
                    All Stationery
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id || cat.slug}
                      type="button"
                      onClick={() =>
                        setSelectedCategorySlug(
                          selectedCategorySlug === cat.slug ? '' : cat.slug
                        )
                      }
                      className={`category-pill px-4 py-2 text-xs font-semibold shrink-0 cursor-pointer ${
                        selectedCategorySlug === cat.slug
                          ? 'active'
                          : 'liquid-btn-glass text-[#1F1C18]'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Smart Indian Stationery Filters: Brand, Ruling Type, Tip Size, Price Range & Sort */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1 items-center">
                  <select
                    aria-label="Filter by Brand"
                    value={selectedBrandSlug}
                    onChange={(e) => setSelectedBrandSlug(e.target.value)}
                    className="liquid-input px-3 py-2 rounded-full text-xs font-semibold"
                  >
                    <option value="">All Brands (Classmate, DOMS...)</option>
                    {brands.map((b) => (
                      <option key={b.id || b.slug} value={b.slug}>
                        {b.name}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter by Ruling Type"
                    value={rulingFilter}
                    onChange={(e) => setRulingFilter(e.target.value)}
                    className="liquid-input px-3 py-2 rounded-full text-xs font-semibold"
                  >
                    <option value="ALL">Ruling: All Formats</option>
                    <option value="SINGLE_RULED">Single Ruled</option>
                    <option value="UNRULED">Unruled / Sketchbook</option>
                    <option value="SPIRAL">Spiral Bound</option>
                    <option value="HARDBOUND">Hardbound Register</option>
                  </select>

                  <select
                    aria-label="Filter by Tip Size or Spec"
                    value={tipFilter}
                    onChange={(e) => setTipFilter(e.target.value)}
                    className="liquid-input px-3 py-2 rounded-full text-xs font-semibold"
                  >
                    <option value="ALL">Tip / Grade: All Specs</option>
                    <option value="0.5mm">0.5mm Needle Gel</option>
                    <option value="0.7mm">0.6–0.7mm Liquid / Ball</option>
                    <option value="HIGHLIGHTER">Highlighters & Pastels</option>
                    <option value="ART_SHADES">24 Shades / Pencil / Brush</option>
                  </select>

                  <select
                    aria-label="Filter by Price Range"
                    value={priceRangeFilter}
                    onChange={(e) => setPriceRangeFilter(e.target.value)}
                    className="liquid-input px-3 py-2 rounded-full text-xs font-semibold"
                  >
                    <option value="ALL">Price: Any ₹</option>
                    <option value="UNDER_150">Under ₹150</option>
                    <option value="150_299">₹150 – ₹299</option>
                    <option value="300_599">₹300 – ₹599</option>
                    <option value="600_PLUS">₹600 & Above</option>
                  </select>

                  <select
                    aria-label="Sort Products"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="liquid-input px-3 py-2 rounded-full text-xs font-semibold"
                  >
                    <option value="featured">Sort: Featured</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                  </select>

                  <div className="flex items-center justify-between lg:justify-end gap-2">
                    <span className="text-[11px] font-semibold text-[#5C5349] inline-flex items-center gap-1">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-[#B44C2E]" />
                      {filteredProducts.length} items
                    </span>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="px-3 py-1.5 rounded-full bg-[#FDF2ED] text-[#8C341B] text-[11px] font-bold cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Product Cards Grid */}
              {filteredProducts.length === 0 ? (
                <div className="liquid-glass rounded-3xl p-10 text-center space-y-3">
                  <Package className="w-10 h-10 text-[#B44C2E]/40 mx-auto" />
                  <p className="text-sm font-bold text-[#1F1C18]">
                    No stationery matches your selected filters
                  </p>
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="liquid-btn-primary px-5 py-2.5 rounded-full text-xs font-semibold cursor-pointer"
                  >
                    Clear Filters & Show All
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
                  {filteredProducts.map((prod) => {
                    const colorOptions = getProductColorOptions(prod);
                    const selectedColor =
                      selectedColorByProduct[prod.id] ||
                      (colorOptions.length > 0 ? colorOptions[0].label : undefined);
                    const selectedVariantId =
                      selectedVariantByProduct[prod.id] ||
                      prod.variants?.[0]?.id ||
                      prod.id;
                    const activeVar =
                      prod.variants?.find((v: any) => Number(v.id) === Number(selectedVariantId)) ||
                      prod.variants?.[0];
                    const sellPaise = Number(
                      activeVar?.sellingPricePaise ?? prod.sellingPricePaise ?? 0
                    );
                    const mrpPaise = Number(activeVar?.mrpPaise ?? prod.mrpPaise ?? sellPaise);
                    const discountPct =
                      mrpPaise > sellPaise
                        ? Math.round(((mrpPaise - sellPaise) / mrpPaise) * 100)
                        : 0;
                    const stock = Number(activeVar?.stockQuantity ?? prod.totalStock ?? 0);
                    const isWishlisted = wishlistProductIds.includes(Number(prod.id));
                    const isCompared = compareProductIds.includes(Number(prod.id));

                    return (
                      <article
                        key={prod.id}
                        className="liquid-card-hover rounded-[26px] p-3 sm:p-4 flex flex-col justify-between gap-3"
                      >
                        <div>
                          <div className="relative aspect-[4/3] rounded-2xl bg-[#FFFDF9] overflow-hidden mb-3">
                            <button
                              type="button"
                              onClick={() =>
                                navigateTo('pdp', `/product/${prod.slug}`, {
                                  productSlug: prod.slug,
                                })
                              }
                              className="w-full h-full block cursor-pointer"
                            >
                              <ProductIllustration
                                type={prod.illustrationType}
                                imageUrl={prod.imageUrl}
                                alt={prod.name}
                                colorTint={selectedColor}
                                className="w-full h-full object-cover"
                              />
                            </button>

                            {discountPct > 0 && (
                              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#B44C2E] text-white text-[10px] font-bold">
                                {discountPct}% OFF
                              </span>
                            )}

                            <div className="absolute top-2 right-2 flex flex-col gap-1.5">
                              <button
                                type="button"
                                onClick={() => toggleWishlist(Number(prod.id))}
                                className={`w-7 h-7 rounded-full flex items-center justify-center shadow-sm cursor-pointer transition ${
                                  isWishlisted
                                    ? 'bg-[#B44C2E] text-white'
                                    : 'bg-white/95 text-[#1F1C18] hover:bg-white'
                                }`}
                                title="Save to Wishlist"
                              >
                                <Heart
                                  className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-current' : ''}`}
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleCompareProduct(Number(prod.id))}
                                className={`w-7 h-7 rounded-full flex items-center justify-center shadow-sm cursor-pointer transition ${
                                  isCompared
                                    ? 'bg-[#B44C2E] text-white'
                                    : 'bg-white/95 text-[#1F1C18] hover:bg-white'
                                }`}
                                title="Compare Item"
                              >
                                <Scale className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#B44C2E]">
                            {prod.brandName}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              navigateTo('pdp', `/product/${prod.slug}`, {
                                productSlug: prod.slug,
                              })
                            }
                            className="text-xs sm:text-sm font-bold text-[#1F1C18] text-left hover:underline line-clamp-2 mt-0.5 cursor-pointer"
                          >
                            {prod.name}
                          </button>

                          {colorOptions.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-2">
                              {colorOptions.slice(0, 5).map((opt) => {
                                const isActive = selectedColor === opt.label;
                                return (
                                  <button
                                    key={opt.label}
                                    type="button"
                                    onClick={() => {
                                      setSelectedColorByProduct((prev) => ({
                                        ...prev,
                                        [prod.id]: opt.label,
                                      }));
                                      if (opt.variantId) {
                                        setSelectedVariantByProduct((prev) => ({
                                          ...prev,
                                          [prod.id]: opt.variantId!,
                                        }));
                                      }
                                    }}
                                    title={opt.label}
                                    className={`w-4 h-4 rounded-full cursor-pointer transition ${
                                      isActive
                                        ? 'ring-2 ring-[#B44C2E] ring-offset-1 scale-110'
                                        : ''
                                    }`}
                                    style={{
                                      background: opt.swatch,
                                      border: `1px solid ${opt.border}`,
                                    }}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2.5 pt-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <div>
                              <span className="text-sm sm:text-base font-bold text-[#1F1C18] tabular-nums">
                                {formatPaiseToINR(sellPaise, false)}
                              </span>
                              {mrpPaise > sellPaise && (
                                <span className="ml-1.5 text-[11px] line-through text-[#8B8075] tabular-nums">
                                  {formatPaiseToINR(mrpPaise, false)}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-semibold text-[#5C5349]">
                              {stock > 0 ? 'In Stock' : 'Out of Stock'}
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={stock <= 0}
                            onClick={() =>
                              addItemToCart(prod.id, selectedVariantId, 1, selectedColor, true)
                            }
                            className="w-full liquid-btn-primary py-2 rounded-full text-xs font-semibold cursor-pointer disabled:opacity-50"
                          >
                            {stock > 0 ? '+ Add to Bag' : 'Out of Stock'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 5. BULK / INSTITUTIONAL SUPPLY BANNER ON HOMEPAGE */}
            <section className="liquid-glass-accent text-white rounded-[32px] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="space-y-2 max-w-2xl">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-[11px] font-bold uppercase tracking-wider">
                  <Building2 className="w-3.5 h-3.5" /> Buy in Bulk · School, Coaching & Office
                </span>
                <h2 className="text-xl sm:text-2xl font-bold font-serif-display">
                  Ordering Notebooks, Pens or JK Copier Reams for a School or Office?
                </h2>
                <p className="text-xs sm:text-sm text-[#FFF5F0]/85">
                  Request institutional carton pricing with GST tax invoice billing and scheduled
                  delivery across Kanpur Nagar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigateTo('bulk', '/bulk', { bulkNote: '' })}
                className="px-6 py-3 rounded-full bg-white text-[#1F1C18] hover:bg-[#FDF2ED] text-xs sm:text-sm font-bold shrink-0 cursor-pointer"
              >
                Request Wholesale Quote →
              </button>
            </section>
          </div>
        )}

        {/* ================================================================
            VIEW: PRODUCT DETAIL PAGE (/product/:slug) WITH BULK INQUIRY CTA
           ================================================================ */}
        {activeView === 'pdp' && (
          <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10 space-y-6">
            <button
              type="button"
              onClick={() => navigateTo('storefront', '/')}
              className="liquid-btn-glass inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Catalogue
            </button>

            {!activePdpProduct ? (
              <div className="liquid-glass rounded-3xl p-8 text-center">
                <p className="text-sm font-bold text-[#1F1C18]">Product not found</p>
              </div>
            ) : (
              (() => {
                const prod = activePdpProduct;
                const colorOpts = getProductColorOptions(prod);
                const selectedColor =
                  selectedColorByProduct[prod.id] ||
                  (colorOpts.length > 0 ? colorOpts[0].label : undefined);
                const selectedVarId =
                  selectedVariantByProduct[prod.id] || prod.variants?.[0]?.id || prod.id;
                const activeVar =
                  prod.variants?.find((v: any) => Number(v.id) === Number(selectedVarId)) ||
                  prod.variants?.[0];
                const sellPaise = Number(
                  activeVar?.sellingPricePaise ?? prod.sellingPricePaise ?? 0
                );
                const mrpPaise = Number(activeVar?.mrpPaise ?? prod.mrpPaise ?? sellPaise);

                return (
                  <div className="liquid-glass rounded-[36px] p-5 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8">
                    <div className="md:col-span-5 aspect-square rounded-3xl bg-[#FFFDF9] overflow-hidden">
                      <ProductIllustration
                        type={prod.illustrationType}
                        imageUrl={prod.imageUrl}
                        alt={prod.name}
                        colorTint={selectedColor}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="md:col-span-7 flex flex-col justify-between space-y-5">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#B44C2E]">
                          <span>{prod.brandName}</span>
                          <span>·</span>
                          <span>{prod.categoryName}</span>
                          <span>·</span>
                          <span className="font-mono-tabular">{prod.sku}</span>
                        </div>

                        <h1 className="text-2xl sm:text-3xl font-bold text-[#1F1C18] font-serif-display">
                          {prod.name}
                        </h1>

                        <p className="text-xs sm:text-sm text-[#4A423B] leading-relaxed">
                          {prod.description || prod.shortDescription}
                        </p>

                        <div className="flex flex-wrap items-baseline gap-3 pt-1">
                          <span className="text-2xl sm:text-3xl font-bold text-[#1F1C18] tabular-nums">
                            {formatPaiseToINR(sellPaise, false)}
                          </span>
                          {mrpPaise > sellPaise && (
                            <span className="text-sm line-through text-[#8B8075] tabular-nums">
                              MRP {formatPaiseToINR(mrpPaise, false)}
                            </span>
                          )}
                          <span className="px-2.5 py-0.5 rounded-full bg-[#FDF2ED] text-[#8C341B] text-[11px] font-bold">
                            Incl. {prod.taxRatePercent ?? 12}% GST
                          </span>
                        </div>

                        {Array.isArray(prod.variants) && prod.variants.length > 0 && (
                          <div className="space-y-1.5 pt-2">
                            <p className="text-xs font-bold text-[#1F1C18]">Pack / Option</p>
                            <div className="flex flex-wrap gap-2">
                              {prod.variants.map((v: any) => (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() =>
                                    setSelectedVariantByProduct((prev) => ({
                                      ...prev,
                                      [prod.id]: v.id,
                                    }))
                                  }
                                  className={`px-3.5 py-2 rounded-full text-xs font-semibold cursor-pointer ${
                                    Number(selectedVarId) === Number(v.id)
                                      ? 'liquid-btn-primary text-white'
                                      : 'liquid-btn-glass text-[#1F1C18]'
                                  }`}
                                >
                                  {v.variantName} · {formatPaiseToINR(v.sellingPricePaise, false)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {colorOpts.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <p className="text-xs font-bold text-[#1F1C18]">
                              Ink / Finish: <span className="text-[#B44C2E]">{selectedColor}</span>
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {colorOpts.map((opt) => (
                                <button
                                  key={opt.label}
                                  type="button"
                                  onClick={() =>
                                    setSelectedColorByProduct((prev) => ({
                                      ...prev,
                                      [prod.id]: opt.label,
                                    }))
                                  }
                                  className={`px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                                    selectedColor === opt.label
                                      ? 'liquid-btn-primary text-white'
                                      : 'liquid-btn-glass text-[#1F1C18]'
                                  }`}
                                >
                                  <span
                                    className="w-3 h-3 rounded-full"
                                    style={{ background: opt.swatch }}
                                  />
                                  {opt.shortLabel}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 pt-2">
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                          <div className="inline-flex items-center liquid-btn-glass rounded-full px-2 py-1">
                            <button
                              type="button"
                              onClick={() => setPdpQuantity((q) => Math.max(1, q - 1))}
                              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-4 text-sm font-bold tabular-nums">{pdpQuantity}</span>
                            <button
                              type="button"
                              onClick={() => setPdpQuantity((q) => q + 1)}
                              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              addItemToCart(
                                prod.id,
                                selectedVarId,
                                pdpQuantity,
                                selectedColor,
                                true
                              )
                            }
                            className="flex-1 liquid-btn-primary py-3 rounded-full text-xs sm:text-sm font-bold cursor-pointer"
                          >
                            Add to Bag
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              addItemToCart(
                                prod.id,
                                selectedVarId,
                                pdpQuantity,
                                selectedColor,
                                false
                              );
                              navigateTo('checkout', '/checkout');
                            }}
                            className="liquid-btn-glass px-5 py-3 rounded-full text-xs sm:text-sm font-bold cursor-pointer"
                          >
                            Buy Now →
                          </button>
                        </div>

                        {/* Institutional / School Bulk Order Inquiry Box directly on PDP */}
                        <div className="liquid-glass-subtle rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-[#1F1C18] inline-flex items-center gap-1.5">
                              <Building2 className="w-4 h-4 text-[#B44C2E]" />
                              Buy in Bulk / School & Office Orders
                            </p>
                            <p className="text-[11px] text-[#5C5349]">
                              Need 25+ cartons or GST invoice quote for this item?
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              navigateTo('bulk', '/bulk', {
                                bulkNote: `Wholesale / Bulk Quote Request for: ${prod.name} (SKU: ${prod.sku}, Pack: ${
                                  activeVar?.variantName || 'Standard'
                                }) — Quantity needed: 50+ units.`,
                              })
                            }
                            className="liquid-btn-glass px-4 py-2 rounded-full text-xs font-bold shrink-0 cursor-pointer"
                          >
                            Get Bulk Quote →
                          </button>
                        </div>

                        {/* Trust Row */}
                        <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-[#5C5349] pt-1">
                          <span className="inline-flex items-center gap-1">
                            <Store className="w-3.5 h-3.5 text-[#B44C2E]" /> 2-Hr Kanpur Counter
                            Pickup
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Wallet className="w-3.5 h-3.5 text-[#B44C2E]" /> UPI & COD Available
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Receipt className="w-3.5 h-3.5 text-[#B44C2E]" /> GST Invoice Included
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* ================================================================
            VIEW: CURATED STUDY & ART COMBOS (/combos)
           ================================================================ */}
        {activeView === 'combos' && (
          <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
            <div className="liquid-glass-accent text-white rounded-[32px] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold font-serif-display">
                  Curated School, Exam & Art Combo Kits
                </h1>
                <p className="text-xs sm:text-sm text-[#FFF5F0]/85 mt-1">
                  Hand-packed by Gayatri Stationers with extra bundle savings — add an entire kit
                  in 1 tap.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigateTo('storefront', '/')}
                className="px-5 py-2.5 rounded-full bg-white text-[#1F1C18] text-xs font-bold shrink-0 cursor-pointer"
              >
                Browse Individual Items
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {bundles.map((bundle) => {
                const components = Array.isArray(bundle.items)
                  ? bundle.items
                  : Array.isArray(bundle.itemsJson)
                  ? bundle.itemsJson
                  : [];
                const mrpPaise = Number(
                  bundle.mrpPaise || bundle.originalTotalPaise || bundle.bundlePricePaise
                );
                const discountPct =
                  bundle.discountPercent ||
                  (mrpPaise > bundle.bundlePricePaise
                    ? Math.round(((mrpPaise - bundle.bundlePricePaise) / mrpPaise) * 100)
                    : 0);

                return (
                  <div
                    key={bundle.id || bundle.slug}
                    className="liquid-glass rounded-[28px] p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FDF2ED] text-[#8C341B] text-[11px] font-bold">
                        <Sparkles className="w-3 h-3" />{' '}
                        {discountPct > 0 ? `Save ${discountPct}%` : bundle.targetGroup}
                      </span>
                      <h2 className="text-lg font-bold text-[#1F1C18] font-serif-display">
                        {bundle.name}
                      </h2>
                      <p className="text-xs text-[#4A423B] leading-relaxed">
                        {bundle.description}
                      </p>

                      {components.length > 0 && (
                        <ul className="space-y-1 text-xs text-[#2E2924] pt-1">
                          {components.map((comp: any, idx: number) => {
                            const matchedProd = products.find(
                              (p) => Number(p.id) === Number(comp.productId)
                            );
                            return (
                              <li key={idx} className="flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5 text-[#B44C2E] shrink-0" />
                                <span>
                                  {matchedProd?.name || comp.productName || comp.title} ×{' '}
                                  {comp.quantity || 1}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div className="pt-3 border-t border-[#E8DFD5] flex items-center justify-between gap-3">
                      <div>
                        <span className="text-lg font-bold text-[#1F1C18] tabular-nums">
                          {formatPaiseToINR(bundle.bundlePricePaise, false)}
                        </span>
                        {mrpPaise > bundle.bundlePricePaise && (
                          <span className="ml-2 text-xs line-through text-[#8B8075] tabular-nums">
                            {formatPaiseToINR(mrpPaise, false)}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddBundleToCart(bundle)}
                        className="liquid-btn-primary px-4 py-2.5 rounded-full text-xs font-bold cursor-pointer"
                      >
                        Add Combo Kit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================
            VIEW: WISHLIST (/wishlist)
           ================================================================ */}
        {activeView === 'wishlist' && (
          <div className="max-w-5xl mx-auto px-4 py-8 space-y-5">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-[#1F1C18] font-serif-display">
                Saved Stationery Wishlist ({wishlistProducts.length})
              </h1>
              <button
                type="button"
                onClick={() => navigateTo('storefront', '/')}
                className="liquid-btn-glass px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
              >
                Continue Shopping
              </button>
            </div>

            {wishlistProducts.length === 0 ? (
              <div className="liquid-glass rounded-3xl p-10 text-center space-y-3">
                <Heart className="w-10 h-10 text-[#B44C2E]/40 mx-auto" />
                <p className="text-sm font-bold text-[#1F1C18]">Your wishlist is empty</p>
                <p className="text-xs text-[#5C5349]">
                  Tap the heart icon on any notebook or pen set to save it for later.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {wishlistProducts.map((prod) => (
                  <div key={prod.id} className="liquid-glass rounded-3xl p-4 space-y-3">
                    <div className="flex gap-3">
                      <div className="w-16 h-16 rounded-2xl bg-[#FFFDF9] overflow-hidden shrink-0">
                        <ProductIllustration
                          type={prod.illustrationType}
                          imageUrl={prod.imageUrl}
                          alt={prod.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#1F1C18] line-clamp-2">{prod.name}</p>
                        <p className="text-sm font-bold text-[#B44C2E] mt-1">
                          {formatPaiseToINR(prod.sellingPricePaise, false)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          addItemToCart(prod.id, prod.variants?.[0]?.id, 1, undefined, true)
                        }
                        className="flex-1 liquid-btn-primary py-2 rounded-full text-xs font-semibold cursor-pointer"
                      >
                        Move to Bag
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleWishlist(Number(prod.id))}
                        className="liquid-btn-glass p-2 rounded-full cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================
            VIEW: POLICY / ABOUT / CONTACT / FAQ (/contact-us etc.)
           ================================================================ */}
        {activeView === 'page' && (
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
            <button
              type="button"
              onClick={() => navigateTo('storefront', '/')}
              className="liquid-btn-glass inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Storefront
            </button>

            <div className="liquid-glass rounded-[32px] p-6 sm:p-9 space-y-5">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#1F1C18] font-serif-display">
                {activePolicyPage.title}
              </h1>
              <div className="space-y-3 text-xs sm:text-sm text-[#2E2924] leading-relaxed whitespace-pre-line">
                {activePolicyPage.contentMarkdown || activePolicyPage.summary}
              </div>

              <div className="liquid-glass-subtle rounded-2xl p-4 space-y-2 text-xs">
                <p className="font-bold text-[#1F1C18]">Gayatri Stationers · Kanpur Counter</p>
                <p className="text-[#4A423B]">{STORE_ADDRESS}</p>
                <div className="flex flex-wrap gap-4 pt-1">
                  <a
                    href={`tel:${STORE_PHONE.replace(/\s+/g, '')}`}
                    className="inline-flex items-center gap-1.5 font-semibold text-[#8C341B] underline"
                  >
                    <Phone className="w-3.5 h-3.5" /> {STORE_PHONE}
                  </a>
                  <a
                    href={`mailto:${STORE_EMAIL}`}
                    className="inline-flex items-center gap-1.5 font-semibold text-[#8C341B] underline"
                  >
                    <Mail className="w-3.5 h-3.5" /> {STORE_EMAIL}
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            ACCOUNT, AUTH, TRACK, BULK, CHECKOUT, CONFIRMATION
           ================================================================ */}
        {activeView === 'signin' && (
          <SignInView
            authMode={authMode}
            onChangeAuthMode={setAuthMode}
            email={authEmailInput}
            onChangeEmail={setAuthEmailInput}
            fullName={authNameInput}
            onChangeFullName={setAuthNameInput}
            phone={authPhoneInput}
            onChangePhone={setAuthPhoneInput}
            password={authPasswordInput}
            onChangePassword={setAuthPasswordInput}
            submitting={authSubmitting}
            error={authError}
            onGoogleSignIn={handleCustomerGoogleSignIn}
            onEmailAuthSubmit={handleEmailAuthSubmit}
            onOpenAdminLogin={() => navigateTo('admin-login', '/admin/login')}
            onBackHome={() => navigateTo('storefront', '/')}
          />
        )}

        {activeView === 'admin-login' && (
          <AdminLoginView
            email={adminEmailInput}
            onChangeEmail={setAdminEmailInput}
            password={adminPasswordInput}
            onChangePassword={setAdminPasswordInput}
            submitting={adminAuthSubmitting}
            error={adminAuthError}
            onSubmit={handleAdminPasswordLogin}
            onGoogleAdminSignIn={handleAdminGoogleSignIn}
            onBackHome={() => navigateTo('storefront', '/')}
          />
        )}

        {activeView === 'profile' && (
          <ProfileView
            currentUser={dbUser}
            fullName={customerName}
            onChangeFullName={setCustomerName}
            phone={customerPhone}
            onChangePhone={setCustomerPhone}
            email={customerEmail}
            shippingAddress={shippingAddress}
            onChangeShippingAddress={setShippingAddress}
            shippingCity={shippingCity}
            onChangeShippingCity={setShippingCity}
            shippingPincode={shippingPincode}
            onChangeShippingPincode={setShippingPincode}
            onSaveProfile={handleSaveProfile}
            savingProfile={savingProfile}
            orders={myOrders}
            wishlistProducts={wishlistProducts}
            onRefreshOrders={loadMyOrders}
            onReorderItems={handleReorderPastOrder}
            onOpenProduct={(slug) => navigateTo('pdp', `/product/${slug}`, { productSlug: slug })}
            onAddProductToBag={(prod) =>
              addItemToCart(prod.id, prod.variants?.[0]?.id, 1, undefined, true)
            }
            onSignOut={handleSignOut}
            onOpenAdminDashboard={
              dbUser?.role === 'owner' || dbUser?.role === 'staff'
                ? () => navigateTo('admin', '/admin')
                : undefined
            }
            onOpenSignIn={() => navigateTo('signin', '/signin')}
          />
        )}

        {activeView === 'track' && (
          <TrackOrdersView
            query={trackQuery}
            onChangeQuery={setTrackQuery}
            searching={trackSearching}
            results={trackResults}
            recentOrders={myOrders}
            onSearchSubmit={(e) => {
              e.preventDefault();
              performTrackSearch(trackQuery);
            }}
            onSelectOrderNumber={(ordNum) => {
              setTrackQuery(ordNum);
              performTrackSearch(ordNum);
            }}
            onBackHome={() => navigateTo('storefront', '/')}
          />
        )}

        {activeView === 'bulk' && (
          <BulkEnquiryView
            key={bulkPreFillNote}
            initialEnquiryText={bulkPreFillNote}
            onBackHome={() => navigateTo('storefront', '/')}
          />
        )}

        {activeView === 'checkout' && (
          <CheckoutView
            cartItems={cartItems}
            products={products}
            calculation={cartCalculation}
            fulfilmentMethod={fulfilmentMethod}
            onSelectFulfilment={handleSelectFulfilment}
            paymentMethod={paymentMethod}
            onSelectPaymentMethod={setPaymentMethod}
            customerName={customerName}
            onChangeCustomerName={setCustomerName}
            customerPhone={customerPhone}
            onChangeCustomerPhone={setCustomerPhone}
            customerEmail={customerEmail}
            onChangeCustomerEmail={setCustomerEmail}
            shippingAddress={shippingAddress}
            onChangeShippingAddress={setShippingAddress}
            shippingCity={shippingCity}
            onChangeShippingCity={setShippingCity}
            shippingPincode={shippingPincode}
            onChangeShippingPincode={setShippingPincode}
            pickupWindow={pickupWindow}
            onChangePickupWindow={setPickupWindow}
            orderNote={orderNote}
            onChangeOrderNote={setOrderNote}
            gstin={gstin}
            onChangeGstin={setGstin}
            availableCoupons={coupons}
            appliedCouponCode={appliedCouponCode}
            onApplyCoupon={setAppliedCouponCode}
            onRemoveCoupon={() => setAppliedCouponCode('')}
            submitting={checkoutSubmitting}
            error={checkoutError}
            pendingOnlineOrder={pendingOnlineOrder}
            onRetryOnlinePayment={() =>
              pendingOnlineOrder && triggerCashfreePayment(pendingOnlineOrder)
            }
            onSwitchPendingToOffline={handleSwitchPendingOrderToOffline}
            onPlaceOrder={handlePlaceOrder}
            onBackToShop={() => navigateTo('storefront', '/')}
          />
        )}

        {activeView === 'confirmation' && confirmedOrderData && (
          <ConfirmationView
            orderData={confirmedOrderData}
            completingPayment={checkoutSubmitting}
            onCompleteOnlinePayment={() => triggerCashfreePayment(confirmedOrderData)}
            onTrackOrder={() => {
              const ordNum = confirmedOrderData.order?.orderNumber || '';
              setTrackQuery(ordNum);
              performTrackSearch(ordNum);
              navigateTo('track', '/track');
            }}
            onContinueShopping={() => navigateTo('storefront', '/')}
          />
        )}
      </main>

      {/* UNIFIED WARM PAPER LIQUID GLASS FOOTER */}
      <footer className="mt-14 px-3 sm:px-6 pb-8">
        <div className="max-w-7xl mx-auto liquid-glass rounded-[32px] p-6 sm:p-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl liquid-btn-primary flex items-center justify-center">
                <Store className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-bold text-[#1F1C18] font-serif-display">
                Gayatri Stationers
              </span>
            </div>
            <p className="text-[#5C5349] leading-relaxed">{STORE_ADDRESS}</p>
            <div className="flex flex-col gap-1 pt-1">
              <a
                href={`tel:${STORE_PHONE.replace(/\s+/g, '')}`}
                className="font-semibold text-[#8C341B] hover:underline inline-flex items-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" /> {STORE_PHONE}
              </a>
              <a
                href={`mailto:${STORE_EMAIL}`}
                className="font-semibold text-[#8C341B] hover:underline inline-flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" /> {STORE_EMAIL}
              </a>
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-[#1F1C18] uppercase tracking-wider text-[11px]">
              Shop Departments
            </p>
            <ul className="space-y-1.5 text-[#4A423B]">
              {categories.slice(0, 5).map((c) => (
                <li key={c.slug}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategorySlug(c.slug);
                      navigateTo('storefront', '/');
                    }}
                    className="hover:text-[#B44C2E] hover:underline cursor-pointer"
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-[#1F1C18] uppercase tracking-wider text-[11px]">
              Shop Services
            </p>
            <ul className="space-y-1.5 text-[#4A423B]">
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo('track', '/track')}
                  className="hover:text-[#B44C2E] hover:underline cursor-pointer"
                >
                  Track Pickup & Delivery
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo('combos', '/combos')}
                  className="hover:text-[#B44C2E] hover:underline cursor-pointer"
                >
                  Exam & Art Combos
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo('bulk', '/bulk', { bulkNote: '' })}
                  className="hover:text-[#B44C2E] hover:underline cursor-pointer"
                >
                  School & Office Bulk Quotes
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo('profile', '/profile')}
                  className="hover:text-[#B44C2E] hover:underline cursor-pointer"
                >
                  My Profile & Saved Address
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo('admin-login', '/admin/login')}
                  className="hover:text-[#B44C2E] hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  <FileSpreadsheet className="w-3 h-3" /> Shop Owner Portal
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-[#1F1C18] uppercase tracking-wider text-[11px]">
              Policies & Support
            </p>
            <ul className="space-y-1.5 text-[#4A423B]">
              {[
                { label: 'About Gayatri Stationers', slug: 'about-us', path: '/about-us' },
                {
                  label: 'Shipping & 2-Hr Store Pickup',
                  slug: 'shipping-and-pickup-policy',
                  path: '/shipping-and-pickup-policy',
                },
                {
                  label: 'Refunds & Cancellations',
                  slug: 'refunds-and-cancellations',
                  path: '/refunds-and-cancellations',
                },
                { label: 'Privacy Policy', slug: 'privacy-policy', path: '/privacy-policy' },
                {
                  label: 'Terms & Conditions',
                  slug: 'terms-and-conditions',
                  path: '/terms-and-conditions',
                },
                { label: 'FAQs & Contact', slug: 'faq', path: '/faq' },
              ].map((link) => (
                <li key={link.slug}>
                  <button
                    type="button"
                    onClick={() => navigateTo('page', link.path, { pageSlug: link.slug })}
                    className="hover:text-[#B44C2E] hover:underline cursor-pointer"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Capsule Dock */}
      <div className="lg:hidden fixed bottom-3 inset-x-3 z-40">
        <div className="mobile-bottom-dock px-2 py-2 flex items-center justify-around text-[11px] font-semibold text-[#1F1C18]">
          <button
            type="button"
            onClick={() => {
              resetAllFilters();
              navigateTo('storefront', '/');
            }}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-full cursor-pointer ${
              activeView === 'storefront' ? 'bg-[#B44C2E] text-white' : ''
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Shop</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('combos', '/combos')}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-full cursor-pointer ${
              activeView === 'combos' ? 'bg-[#B44C2E] text-white' : ''
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Combos</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('track', '/track')}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-full cursor-pointer ${
              activeView === 'track' ? 'bg-[#B44C2E] text-white' : ''
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Track</span>
          </button>

          <button
            type="button"
            onClick={() => setCartDrawerOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-full cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Bag ({totalCartItemsCount})</span>
          </button>

          <button
            type="button"
            onClick={() =>
              navigateTo(dbUser ? 'profile' : 'signin', dbUser ? '/profile' : '/signin')
            }
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-full cursor-pointer ${
              activeView === 'profile' || activeView === 'signin' ? 'bg-[#B44C2E] text-white' : ''
            }`}
          >
            <User className="w-4 h-4" />
            <span>{dbUser ? 'Account' : 'Sign In'}</span>
          </button>
        </div>
      </div>

      {/* Floating Vidya AI Assistant Trigger */}
      <button
        type="button"
        onClick={() => setIsRufusOpen(true)}
        className="fixed bottom-20 right-3.5 lg:bottom-6 lg:right-6 z-30 liquid-btn-primary px-4 py-2.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 shadow-xl cursor-pointer"
      >
        <Sparkles className="w-4 h-4" />
        <span>Vidya AI</span>
      </button>

      {/* Slide-Over Cart Drawer */}
      <CartDrawer
        isOpen={cartDrawerOpen}
        onClose={() => setCartDrawerOpen(false)}
        cartItems={cartItems}
        products={products}
        calculation={cartCalculation}
        fulfilmentMethod={fulfilmentMethod}
        onChangeFulfilmentMethod={handleSelectFulfilment}
        availableCoupons={coupons}
        appliedCouponCode={appliedCouponCode}
        onApplyCoupon={setAppliedCouponCode}
        onRemoveCoupon={() => setAppliedCouponCode('')}
        couponMessage={couponMessage}
        orderNote={orderNote}
        onChangeOrderNote={setOrderNote}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onSaveToWishlist={handleSaveCartItemToWishlist}
        onClearBag={() => setCartItems([])}
        onQuickAddProduct={(prod) =>
          addItemToCart(prod.id, prod.variants?.[0]?.id, 1, undefined, false)
        }
        onProceedToCheckout={() => {
          setCartDrawerOpen(false);
          navigateTo('checkout', '/checkout');
        }}
        onOpenProduct={(slug) => navigateTo('pdp', `/product/${slug}`, { productSlug: slug })}
      />

      {/* Vidya AI Modal */}
      <RufusAssistant
        isOpen={isRufusOpen}
        onClose={() => setIsRufusOpen(false)}
        products={products}
        activeProduct={activePdpProduct}
        onAddToCart={(prod) =>
          prod && addItemToCart(Number(prod.id), prod.variants?.[0]?.id, 1, undefined, true)
        }
        onOpenProduct={(prodOrSlug) => {
          const slug = typeof prodOrSlug === 'string' ? prodOrSlug : prodOrSlug?.slug;
          if (slug) navigateTo('pdp', `/product/${slug}`, { productSlug: slug });
        }}
        onFilterCategory={(slug) => {
          setSelectedCategorySlug(slug);
          navigateTo('storefront', '/');
        }}
        onToggleCompare={toggleCompareProduct}
        compareProductIds={compareProductIds}
        onOpenComparison={() => setIsCompareOpen(true)}
        initialQuestion={rufusInitialQuestion}
        onClearInitialQuestion={() => setRufusInitialQuestion(null)}
      />

      {/* Product Comparison Modal */}
      <ProductComparisonModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        onOpenModal={() => setIsCompareOpen(true)}
        compareProductIds={compareProductIds}
        products={products}
        selectedVariantByProduct={selectedVariantByProduct}
        selectedColorByProduct={selectedColorByProduct}
        onSelectVariant={(pid, vid) =>
          setSelectedVariantByProduct((prev) => ({ ...prev, [pid]: vid }))
        }
        onSelectColor={(pid, color) =>
          setSelectedColorByProduct((prev) => ({ ...prev, [pid]: color }))
        }
        onToggleCompare={toggleCompareProduct}
        onClearCompare={() => setCompareProductIds([])}
        onAddToCart={(prod, vid, color) =>
          prod && addItemToCart(Number(prod.id), vid, 1, color, true)
        }
        onOpenProduct={(prodOrSlug) => {
          const slug = typeof prodOrSlug === 'string' ? prodOrSlug : prodOrSlug?.slug;
          if (slug) navigateTo('pdp', `/product/${slug}`, { productSlug: slug });
        }}
        getProductColorOptions={getProductColorOptions}
        compareToastMessage={compareToast}
        onDismissToast={() => setCompareToast(null)}
      />
    </div>
  );
}

export default App;
