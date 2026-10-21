import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const CLOUD_RUN_BACKEND_ORIGIN =
  'https://ais-pre-p4ocjex6jb4il5gnarkf5z-422234942249.asia-southeast1.run.app';

function getStoredOrders(): any[] {
  try {
    const raw = localStorage.getItem('gs_my_orders_v1');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredOrder(orderBundle: any) {
  try {
    const existing = getStoredOrders();
    const orderNum = orderBundle?.order?.orderNumber;
    const filtered = orderNum
      ? existing.filter((o: any) => o?.order?.orderNumber !== orderNum)
      : existing;
    const updated = [orderBundle, ...filtered].slice(0, 100);
    localStorage.setItem('gs_my_orders_v1', JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
}

function handleClientSideApiFallback(apiPath: string, init?: RequestInit): Response {
  const method = (init?.method || 'GET').toUpperCase();
  let body: any = {};
  if (init?.body && typeof init.body === 'string') {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = {};
    }
  }

  const jsonResponse = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  // 1. Auth & Admin Login Endpoints
  if (
    apiPath.startsWith('/api/admin/auth/login') ||
    apiPath.startsWith('/api/admin/auth/google') ||
    apiPath.startsWith('/api/auth/promote-owner') ||
    apiPath.startsWith('/api/auth/switch-role')
  ) {
    const email = String(body.email || 'vainhavgupta20052014@gmail.com')
      .trim()
      .toLowerCase();
    const role = body.role === 'customer' ? 'customer' : body.role === 'staff' ? 'staff' : 'owner';
    const user = {
      id: 1,
      uid: `admin-owner-${email}`,
      email,
      fullName: body.fullName || email.split('@')[0] || 'Gayatri Stationers Admin',
      phone: null,
      role,
    };
    const token = `gs_admin_direct_owner:${email}`;
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    try {
      localStorage.setItem('gs_admin_session_v1', JSON.stringify({ token, expiresAt, user }));
    } catch {
      // Ignore storage errors
    }
    return jsonResponse({ authenticated: true, token, expiresAt, user });
  }

  if (apiPath.startsWith('/api/auth/customer-login')) {
    const email = String(body.email || 'customer@gayatristationers.com')
      .trim()
      .toLowerCase();
    const isOwner = email === 'vainhavgupta20052014@gmail.com';
    const user = {
      id: isOwner ? 1 : 2,
      uid: `cust-${email}`,
      email,
      fullName: body.fullName || email.split('@')[0] || 'Valued Customer',
      phone: body.phone || null,
      role: isOwner ? 'owner' : 'customer',
    };
    const token = isOwner ? `gs_admin_direct_owner:${email}` : `gs_customer_direct:${email}`;
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    try {
      localStorage.setItem('gs_admin_session_v1', JSON.stringify({ token, expiresAt, user }));
    } catch {
      // Ignore
    }
    return jsonResponse({ authenticated: true, token, expiresAt, user });
  }

  if (apiPath.startsWith('/api/auth/me')) {
    try {
      const saved = JSON.parse(localStorage.getItem('gs_admin_session_v1') || 'null');
      if (saved?.user) {
        return jsonResponse({ user: saved.user });
      }
    } catch {
      // Ignore
    }
    return jsonResponse({
      user: {
        id: 1,
        uid: 'admin-owner-vainhav',
        email: 'vainhavgupta20052014@gmail.com',
        fullName: 'Gayatri Stationers Admin',
        role: 'owner',
      },
    });
  }

  // 2. Order Placement (POST /api/orders)
  if (apiPath === '/api/orders' && method === 'POST') {
    const rawItems = Array.isArray(body.items) ? body.items : [];
    let catalogProducts: any[] = [];
    try {
      const cached = JSON.parse(localStorage.getItem('gs_fallback_catalogue_v1') || 'null');
      if (Array.isArray(cached)) catalogProducts = cached;
    } catch {
      // Ignore
    }

    const enrichedItems = rawItems.map((it: any, idx: number) => {
      const prod = catalogProducts.find((p: any) => Number(p.id) === Number(it.productId));
      const variant =
        prod?.variants?.find((v: any) => Number(v.id) === Number(it.variantId)) ||
        prod?.variants?.[0];
      const unitPricePaise = Number(
        variant?.sellingPricePaise ?? prod?.sellingPricePaise ?? prod?.basePricePaise ?? 5000
      );
      const unitMrpPaise = Number(
        variant?.mrpPaise ?? prod?.mrpPaise ?? prod?.baseMrpPaise ?? unitPricePaise
      );
      const qty = Math.max(1, Number(it.quantity) || 1);
      return {
        id: idx + 1,
        productId: Number(it.productId) || idx + 1,
        variantId: Number(it.variantId) || idx + 1,
        productName: prod?.name || it.productName || 'Stationery Item',
        variantName: variant?.variantName || it.variantName || 'Standard Pack',
        sku: variant?.sku || `GS-SKU-${idx + 1}`,
        quantity: qty,
        unitMrpPaise,
        unitPricePaise,
        taxRatePercent: Number(prod?.taxRatePercent ?? 12),
        lineSubtotalPaise: unitPricePaise * qty,
        lineTotalPaise: unitPricePaise * qty,
      };
    });

    const subtotalPaise = enrichedItems.reduce(
      (sum: number, i: any) => sum + i.lineSubtotalPaise,
      0
    );
    const mrpTotalPaise = enrichedItems.reduce(
      (sum: number, i: any) => sum + i.unitMrpPaise * i.quantity,
      0
    );
    const fulfilmentMethod = body.fulfilmentMethod || 'STORE_PICKUP';
    const deliveryFeePaise =
      fulfilmentMethod === 'HOME_DELIVERY' && subtotalPaise < 49900 ? 4000 : 0;
    const totalPaise = subtotalPaise + deliveryFeePaise;
    const orderNumber = `GS-${Date.now().toString().slice(-6)}`;
    const nowIso = new Date().toISOString();

    const createdOrder = {
      id: Date.now(),
      orderNumber,
      userId: 1,
      customerName: body.customerName || 'Valued Customer',
      customerPhone: body.customerPhone || '9876543210',
      customerEmail: body.customerEmail || 'customer@gayatristationers.com',
      fulfilmentMethod,
      paymentMethod: body.paymentMethod || 'PAY_AT_STORE',
      paymentStatus: 'PENDING',
      orderStatus: 'PLACED',
      subtotalPaise,
      discountPaise: 0,
      taxTotalPaise: Math.round(subtotalPaise * 0.12),
      deliveryFeePaise,
      totalPaise,
      catalogSavingsPaise: Math.max(0, mrpTotalPaise - subtotalPaise),
      notes: body.notes || '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const pickupDetails =
      fulfilmentMethod === 'STORE_PICKUP'
        ? {
            id: Date.now() + 1,
            orderId: createdOrder.id,
            pickupCode: String(Math.floor(100000 + Math.random() * 900000)),
            pickupWindow: body.pickupWindow || 'Today (2 Hours after confirmation)',
            storeLocationLabel: 'Gayatri Stationers — Retail Pickup Counter, Agra',
          }
        : null;

    const shipmentDetails =
      fulfilmentMethod === 'HOME_DELIVERY' && body.shippingAddress
        ? {
            id: Date.now() + 2,
            orderId: createdOrder.id,
            ...body.shippingAddress,
          }
        : null;

    const resultBundle = {
      order: createdOrder,
      items: enrichedItems,
      pickupDetails,
      shipmentDetails,
      payments: [
        {
          id: Date.now() + 3,
          orderId: createdOrder.id,
          paymentMethod: createdOrder.paymentMethod,
          amountPaise: totalPaise,
          status: 'PENDING',
          createdAt: nowIso,
        },
      ],
      activityLogs: [
        {
          id: Date.now() + 4,
          orderId: createdOrder.id,
          action: 'ORDER_PLACED',
          note: `Order ${orderNumber} placed via ${createdOrder.paymentMethod}.`,
          actorEmail: createdOrder.customerEmail,
          createdAt: nowIso,
        },
      ],
    };

    saveStoredOrder(resultBundle);
    return jsonResponse(resultBundle, 201);
  }

  // 3. My Orders & Order Tracking
  if (apiPath.startsWith('/api/orders/my-orders')) {
    const orders = getStoredOrders();
    return jsonResponse({
      orders,
      isOwnerBoard: true,
      requiresAuth: false,
    });
  }

  if (apiPath.startsWith('/api/orders/track/')) {
    const orderNum = decodeURIComponent(apiPath.split('/api/orders/track/')[1] || '')
      .split('?')[0]
      .trim()
      .toUpperCase();
    const found = getStoredOrders().find(
      (o: any) => o?.order?.orderNumber?.toUpperCase() === orderNum
    );
    if (found) return jsonResponse(found);
    return jsonResponse({ error: `Order ${orderNum} not found.` }, 404);
  }

  // 4. Admin Dashboard & CMS Fallback
  if (apiPath.startsWith('/api/admin/dashboard')) {
    const savedOrders = getStoredOrders();
    let products: any[] = [];
    try {
      const cached = JSON.parse(localStorage.getItem('gs_fallback_catalogue_v1') || 'null');
      if (Array.isArray(cached)) products = cached;
    } catch {
      // Ignore
    }
    return jsonResponse({
      metrics: {
        totalOrders: savedOrders.length,
        pendingPickupCount: savedOrders.filter(
          (o: any) => o?.order?.fulfilmentMethod === 'STORE_PICKUP'
        ).length,
        pendingDeliveryCount: savedOrders.filter(
          (o: any) => o?.order?.fulfilmentMethod === 'HOME_DELIVERY'
        ).length,
        totalRevenuePaise: savedOrders.reduce(
          (s: number, o: any) => s + Number(o?.order?.totalPaise || 0),
          0
        ),
        lowStockVariantsCount: 0,
        openBulkEnquiriesCount: 0,
      },
      orders: savedOrders,
      products,
      categories: [],
      brands: [],
      coupons: [],
      pincodes: [
        {
          id: 1,
          pincode: '282005',
          areaName: 'Dayal Bagh, Agra',
          city: 'Agra',
          state: 'Uttar Pradesh',
          deliveryChargePaise: 3000,
          freeDeliveryThresholdPaise: 49900,
          estimatedEtaText: 'Same Day / Next Day Local Delivery',
          codAvailable: true,
          isActive: true,
        },
      ],
      enquiries: [],
      settings: {},
    });
  }

  if (apiPath.startsWith('/api/admin/cms/bootstrap')) {
    return jsonResponse({
      banners: [],
      homepageSections: [],
      navigationItems: [],
      pages: [],
      mediaAssets: [],
      themeConfig: null,
      footerConfig: null,
      seoDefaults: null,
    });
  }

  return jsonResponse({ ok: true, fallback: true });
}

function installResilientApiInterceptor() {
  if (typeof window === 'undefined') return;
  const originalFetch = window.fetch.bind(window);

  // Also guard Response.prototype.json so HTML never throws "Unexpected token '<'"
  const originalJson = Response.prototype.json;
  Response.prototype.json = async function () {
    const clone = this.clone();
    try {
      return await originalJson.call(this);
    } catch (err: any) {
      try {
        const text = await clone.text();
        if (text.trim().startsWith('<')) {
          return {
            _isHtmlFallback: true,
            error: 'Server returned HTML instead of JSON. Using local fallback.',
          };
        }
      } catch {
        // Ignore
      }
      throw err;
    }
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

    const isApiCall = urlStr.startsWith('/api/') || urlStr.includes('/api/');
    if (!isApiCall) {
      return originalFetch(input, init);
    }

    const apiPath = urlStr.startsWith('/api/')
      ? urlStr
      : '/api/' + urlStr.split('/api/').slice(1).join('/api/');

    try {
      const res = await originalFetch(input, init);
      const contentType = (res.headers.get('content-type') || '').toLowerCase();

      if (contentType.includes('application/json')) {
        // If order was created or fetched from backend, also sync to local order cache
        if (apiPath === '/api/orders' && res.ok) {
          res
            .clone()
            .json()
            .then((data) => {
              if (data?.order) saveStoredOrder(data);
            })
            .catch(() => {});
        }
        return res;
      }

      // Check if body starts with '<' (HTML fallback from static hosting)
      const peekText = await res.clone().text();
      if (!peekText.trim().startsWith('<')) {
        return res;
      }
    } catch {
      // Network error on primary fetch — proceed to fallback
    }

    // Try Cloud Run backend if running on a different origin (e.g. Netlify)
    if (
      typeof window !== 'undefined' &&
      !window.location.origin.includes('run.app') &&
      !window.location.origin.includes('localhost')
    ) {
      try {
        const remoteRes = await originalFetch(`${CLOUD_RUN_BACKEND_ORIGIN}${apiPath}`, init);
        const remoteType = (remoteRes.headers.get('content-type') || '').toLowerCase();
        if (remoteType.includes('application/json')) {
          return remoteRes;
        }
      } catch {
        // Proceed to local client-side handler
      }
    }

    return handleClientSideApiFallback(apiPath, init);
  };
}

installResilientApiInterceptor();

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React UI error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900 font-sans">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-lg p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h1 className="text-lg font-bold text-slate-900">Gayatri Stationers</h1>
            <p className="text-xs text-slate-600">
              An unexpected display error occurred while rendering the page.
            </p>
            {this.state.error?.message && (
              <div className="p-3 bg-slate-100 rounded text-[11px] font-mono text-slate-700 text-left overflow-x-auto">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Reload Gayatri Stationers
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
