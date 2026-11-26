import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {
  DEFAULT_BRANDS,
  DEFAULT_BUNDLES,
  DEFAULT_CATEGORIES,
  DEFAULT_CMS_PAGES,
  DEFAULT_COUPONS,
  DEFAULT_PINCODES,
  DEFAULT_PRODUCTS,
  OWNER_EMAIL,
  STORE_ADDRESS,
} from './data/defaults.ts';
import { calculateOrderTotals } from './lib/domain-logic.ts';

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

function getStoredList(key: string, fallback: any[] = []): any[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function getStoredRawList(key: string): any[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredList(key: string, list: any[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Ignore storage quota errors
  }
}

function getStoredObject(key: string): Record<string, any> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredObject(key: string, obj: Record<string, any>) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch {
    // Ignore
  }
}

function handleClientSideApiFallback(apiPath: string, init?: RequestInit): Response {
  const method = (init?.method || 'GET').toUpperCase();
  const cleanPath = apiPath.split('?')[0];
  const queryPart = apiPath.includes('?') ? apiPath.split('?')[1] : '';
  const searchParams = new URLSearchParams(queryPart);

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

  // 1. Auth, Admin Login & Profile Endpoints
  if (
    cleanPath.startsWith('/api/admin/auth/login') ||
    cleanPath.startsWith('/api/admin/auth/google')
  ) {
    const email = String(body.email || '')
      .trim()
      .toLowerCase();
    if (!email || !email.includes('@')) {
      return jsonResponse({ error: 'A valid Store Owner email is required.' }, 400);
    }
    if (email !== OWNER_EMAIL) {
      return jsonResponse(
        {
          error:
            'Access Restricted: Only the authorized Store Owner email is permitted to sign into Admin.',
        },
        403
      );
    }
    const role = body.role === 'staff' ? 'staff' : 'owner';
    const user = {
      id: 1,
      uid: `admin-owner-${email}`,
      email,
      fullName: body.fullName || email.split('@')[0] || 'Gayatri Stationers Admin',
      phone: body.phone || null,
      role,
    };
    const token = `gs_admin_direct_owner:${email}`;
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    saveStoredObject('gs_admin_session_v1', { token, expiresAt, user });
    return jsonResponse({ authenticated: true, token, expiresAt, user });
  }

  if (
    cleanPath.startsWith('/api/auth/promote-owner') ||
    cleanPath.startsWith('/api/auth/switch-role') ||
    cleanPath.startsWith('/api/auth/role-switch')
  ) {
    const saved = getStoredObject('gs_admin_session_v1');
    if (!saved?.user || saved.user.email !== OWNER_EMAIL) {
      return jsonResponse({ error: 'Unauthorized role switch request.' }, 403);
    }
    const role = body.role === 'customer' ? 'customer' : body.role === 'staff' ? 'staff' : 'owner';
    const user = { ...saved.user, role };
    saveStoredObject('gs_admin_session_v1', { ...saved, user });
    return jsonResponse({ user, role });
  }

  if (cleanPath.startsWith('/api/auth/customer-login')) {
    const email = String(body.email || 'customer@gayatristationers.com')
      .trim()
      .toLowerCase();
    const isOwner = email === OWNER_EMAIL;
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
    saveStoredObject('gs_admin_session_v1', { token, expiresAt, user });
    return jsonResponse({ authenticated: true, token, expiresAt, user });
  }

  if (cleanPath.startsWith('/api/auth/profile')) {
    const saved = getStoredObject('gs_admin_session_v1');
    const existingProfile = getStoredObject('gs_user_profile_v1');
    const email = String(body.email || saved?.user?.email || existingProfile.email || 'customer@gayatristationers.com')
      .trim()
      .toLowerCase();
    const isOwner = email === OWNER_EMAIL;
    const baseUser = saved?.user || {
      id: isOwner ? 1 : 2,
      uid: `cust-${email}`,
      email,
      role: isOwner ? 'owner' : 'customer',
    };
    const shippingAddressObj = {
      addressLine1: body.addressLine1 ?? existingProfile?.shippingAddress?.addressLine1 ?? '',
      addressLine2: body.addressLine2 ?? existingProfile?.shippingAddress?.addressLine2 ?? '',
      landmark: body.landmark ?? existingProfile?.shippingAddress?.landmark ?? '',
      city: body.city ?? existingProfile?.shippingAddress?.city ?? 'Kanpur',
      state: body.state ?? existingProfile?.shippingAddress?.state ?? 'Uttar Pradesh',
      pincode: body.pincode ?? existingProfile?.shippingAddress?.pincode ?? '208021',
    };
    const updatedUser = {
      ...baseUser,
      fullName: body.fullName || baseUser.fullName || existingProfile.fullName || 'Valued Customer',
      phone: body.phone !== undefined ? body.phone : baseUser.phone || existingProfile.phone || '',
      email,
      shippingAddress: shippingAddressObj,
    };
    saveStoredObject('gs_user_profile_v1', updatedUser);
    const activeToken =
      saved?.token || (isOwner ? `gs_admin_direct_owner:${email}` : `gs_customer_direct:${email}`);
    saveStoredObject('gs_admin_session_v1', {
      token: activeToken,
      expiresAt: saved?.expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000,
      user: updatedUser,
    });
    return jsonResponse({ user: updatedUser });
  }

  if (cleanPath.startsWith('/api/auth/me')) {
    const saved = getStoredObject('gs_admin_session_v1');
    return jsonResponse({ user: saved?.user || null });
  }

  // 1b. Client-Side Cart Calculation
  if (cleanPath === '/api/cart/calculate' && method === 'POST') {
    const catalogProducts = getStoredList('gs_fallback_catalogue_v1', DEFAULT_PRODUCTS);
    const activeCoupons = getStoredList('gs_coupons_v1', DEFAULT_COUPONS);
    const activePincodes = getStoredList('gs_pincodes_v1', DEFAULT_PINCODES);
    const rawItems = Array.isArray(body.items) ? body.items : [];

    const pricedItems = rawItems
      .map((ci: any) => {
        const prod = catalogProducts.find((p: any) => Number(p.id) === Number(ci.productId));
        if (!prod) return null;
        const variant =
          prod.variants?.find((v: any) => Number(v.id) === Number(ci.variantId)) ||
          prod.variants?.[0] || {
            id: ci.variantId || prod.id,
            variantName: 'Standard Pack',
            sku: prod.sku || `GS-${prod.id}`,
            sellingPricePaise: prod.sellingPricePaise || 9000,
            mrpPaise: prod.mrpPaise || 10000,
            stockQuantity: prod.totalStock ?? 50,
          };
        const unitPricePaise = Number(variant.sellingPricePaise ?? variant.pricePaise ?? prod.sellingPricePaise ?? 0);
        const unitMrpPaise = Number(variant.mrpPaise ?? prod.mrpPaise ?? unitPricePaise);
        const baseVarName = variant.variantName || 'Standard Pack';
        const displayVarName =
          ci.selectedColor &&
          !baseVarName.toLowerCase().includes(String(ci.selectedColor).split(' ')[0].toLowerCase())
            ? `${baseVarName} (${ci.selectedColor})`
            : baseVarName;
        return {
          productId: Number(prod.id),
          variantId: Number(variant.id),
          productName: prod.name,
          variantName: displayVarName,
          selectedColor: ci.selectedColor,
          sku: variant.sku || prod.sku || `GS-${prod.id}`,
          quantity: Math.max(1, Number(ci.quantity) || 1),
          unitMrpPaise,
          unitPricePaise,
          taxRatePercent: Number(prod.taxRatePercent ?? 12),
          availableStock: Number(variant.stockQuantity ?? 50),
          pickupEligible: prod.pickupEligible !== false,
          deliveryEligible: prod.deliveryEligible !== false,
        };
      })
      .filter(Boolean) as any[];

    const couponCode = String(body.couponCode || '').trim().toUpperCase();
    const matchedCoupon = couponCode
      ? activeCoupons.find((c: any) => String(c.code || '').toUpperCase() === couponCode) || null
      : null;
    const pin = String(body.pincode || '').trim();
    const matchedPincode = pin ? activePincodes.find((p: any) => p.pincode === pin && p.isActive) || null : null;

    const calculation = calculateOrderTotals({
      items: pricedItems,
      fulfilmentMethod: body.fulfilmentMethod === 'HOME_DELIVERY' ? 'HOME_DELIVERY' : 'STORE_PICKUP',
      coupon: matchedCoupon,
      pincodeRule: matchedPincode,
    });

    if (couponCode && !matchedCoupon && pricedItems.length > 0) {
      calculation.couponMessage = `Coupon "${couponCode}" was not recognized. Try BACKTOSCHOOL10 or STORE50.`;
    }

    return jsonResponse({ calculation });
  }

  // 2. Order Placement (POST /api/orders)
  if (cleanPath === '/api/orders' && method === 'POST') {
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const catalogProducts = getStoredList('gs_fallback_catalogue_v1', DEFAULT_PRODUCTS);

    const enrichedItems = rawItems.map((it: any, idx: number) => {
      const prod = catalogProducts.find((p: any) => Number(p.id) === Number(it.productId));
      const variant =
        prod?.variants?.find((v: any) => Number(v.id) === Number(it.variantId)) ||
        prod?.variants?.[0];
      const explicitUnitPrice = Number(it.unitPricePaise);
      const unitPricePaise =
        Number.isFinite(explicitUnitPrice) && explicitUnitPrice > 0
          ? explicitUnitPrice
          : Number(
              variant?.sellingPricePaise ??
                variant?.pricePaise ??
                prod?.sellingPricePaise ??
                prod?.basePricePaise ??
                0
            );
      const explicitMrp = Number(it.unitMrpPaise);
      const unitMrpPaise =
        Number.isFinite(explicitMrp) && explicitMrp >= unitPricePaise
          ? explicitMrp
          : Number(variant?.mrpPaise ?? prod?.mrpPaise ?? prod?.baseMrpPaise ?? unitPricePaise);
      const qty = Math.max(1, Number(it.quantity) || 1);
      return {
        id: idx + 1,
        productId: Number(it.productId) || idx + 1,
        variantId: Number(it.variantId) || idx + 1,
        productName: it.productName || prod?.name || 'Stationery Item',
        variantName: it.variantName || variant?.variantName || 'Standard Pack',
        sku: it.sku || variant?.sku || prod?.sku || `GS-SKU-${idx + 1}`,
        quantity: qty,
        unitMrpPaise,
        unitPricePaise,
        taxRatePercent: Number(it.taxRatePercent ?? prod?.taxRatePercent ?? 12),
        lineSubtotalPaise: unitPricePaise * qty,
        lineTotalPaise: unitPricePaise * qty,
      };
    });

    const computedSubtotal = enrichedItems.reduce(
      (sum: number, i: any) => sum + i.lineSubtotalPaise,
      0
    );
    const subtotalPaise =
      Number.isFinite(Number(body.subtotalPaise)) && Number(body.subtotalPaise) > 0
        ? Number(body.subtotalPaise)
        : computedSubtotal;
    const discountPaise =
      Number.isFinite(Number(body.discountPaise)) && Number(body.discountPaise) >= 0
        ? Number(body.discountPaise)
        : 0;
    const mrpTotalPaise = enrichedItems.reduce(
      (sum: number, i: any) => sum + i.unitMrpPaise * i.quantity,
      0
    );
    const fulfilmentMethod = body.fulfilmentMethod || 'STORE_PICKUP';
    const shippingPaise = 0;
    const totalPaise =
      Number.isFinite(Number(body.totalPaise)) && Number(body.totalPaise) > 0
        ? Number(body.totalPaise)
        : Math.max(0, subtotalPaise - discountPaise);
    const orderNumber = `GS-${Date.now().toString().slice(-6)}`;
    const nowIso = new Date().toISOString();

    const createdOrder = {
      id: Date.now(),
      orderNumber,
      userId: 1,
      customerName: body.customerName || 'Guest Customer',
      customerPhone: body.customerPhone || '',
      customerEmail: body.customerEmail || '',
      fulfilmentMethod,
      paymentMethod: body.paymentMethod || 'COD',
      paymentStatus: 'PENDING',
      orderStatus:
        body.paymentMethod === 'CASHFREE_ONLINE' ? 'PAYMENT_PENDING' : 'ORDER_PLACED',
      couponCode: body.couponCode || '',
      subtotalPaise,
      discountPaise,
      taxPaise: Math.round(subtotalPaise - (subtotalPaise * 100) / 112),
      shippingPaise,
      totalPaise,
      catalogSavingsPaise: Math.max(0, mrpTotalPaise - subtotalPaise),
      notes: body.customerNote || body.notes || '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const pickupDetails =
      fulfilmentMethod === 'STORE_PICKUP'
        ? {
            id: Date.now() + 1,
            orderId: createdOrder.id,
            pickupCode: String(Math.floor(100000 + Math.random() * 900000)),
            preferredWindow: body.pickupWindow || 'Today (2 Hours after confirmation)',
            storeLocationNote: `Gayatri Stationers — ${STORE_ADDRESS}`,
          }
        : null;

    const shipmentDetails =
      fulfilmentMethod === 'HOME_DELIVERY'
        ? {
            id: Date.now() + 2,
            orderId: createdOrder.id,
            addressLine1:
              typeof body.shippingAddress === 'string'
                ? body.shippingAddress
                : body.shippingAddress?.addressLine1 || '',
            city: body.shippingCity || body.shippingAddress?.city || 'Kanpur',
            pincode: body.shippingPincode || body.shippingAddress?.pincode || '',
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
          statusFrom: '',
          statusTo: 'CONFIRMED',
          paymentStatusFrom: '',
          paymentStatusTo: 'PENDING',
          note: `Order ${orderNumber} placed via ${createdOrder.paymentMethod}.`,
          actorEmail: createdOrder.customerEmail,
          actorRole: 'customer',
          createdAt: nowIso,
        },
      ],
    };

    saveStoredOrder(resultBundle);
    return jsonResponse(resultBundle, 201);
  }

  // 3. Guest Order Lookup, My Orders & Order Tracking
  if (cleanPath === '/api/orders/lookup') {
    const cleanId = String(searchParams.get('orderId') || '')
      .trim()
      .toUpperCase()
      .replace(/^#/, '');
    const cleanPhone = String(searchParams.get('phone') || '')
      .replace(/\D/g, '')
      .slice(-10);
    const withGs = cleanId.startsWith('GS-') ? cleanId : `GS-${cleanId}`;
    const found = getStoredOrders().find((o: any) => {
      const ordNum = String(o?.order?.orderNumber || '')
        .trim()
        .toUpperCase();
      const idMatch =
        ordNum === cleanId || ordNum === withGs || (cleanId.length >= 4 && ordNum.endsWith(cleanId));
      const ordPhone = String(o?.order?.customerPhone || '')
        .replace(/\D/g, '')
        .slice(-10);
      return idMatch && (!cleanPhone || ordPhone === cleanPhone);
    });
    if (found) return jsonResponse(found);
    return jsonResponse(
      { error: `No order found matching "${cleanId}" and that mobile number.` },
      404
    );
  }

  if (cleanPath.startsWith('/api/orders/my-orders')) {
    const orders = getStoredOrders();
    const filterEmail = String(searchParams.get('email') || '')
      .trim()
      .toLowerCase();
    const filterPhone = String(searchParams.get('phone') || '')
      .replace(/\D/g, '')
      .slice(-10);
    const isOwner = filterEmail === OWNER_EMAIL;
    const filtered =
      isOwner || (!filterEmail && !filterPhone)
        ? orders
        : orders.filter((o: any) => {
            const ordEmail = String(o?.order?.customerEmail || '')
              .trim()
              .toLowerCase();
            const ordPhone = String(o?.order?.customerPhone || '')
              .replace(/\D/g, '')
              .slice(-10);
            if (filterPhone && ordPhone === filterPhone) return true;
            if (filterEmail && ordEmail === filterEmail) return true;
            return orders.length <= 10; // keep guest orders placed on this device visible
          });
    return jsonResponse({
      orders: filtered,
      isOwnerBoard: isOwner,
      requiresAuth: false,
    });
  }

  if (cleanPath.startsWith('/api/orders/track/')) {
    const orderNum = decodeURIComponent(cleanPath.split('/api/orders/track/')[1] || '')
      .trim()
      .toUpperCase();
    const withGs = orderNum.startsWith('GS-') ? orderNum : `GS-${orderNum}`;
    const found = getStoredOrders().find((o: any) => {
      const ordNum = String(o?.order?.orderNumber || '').toUpperCase();
      return ordNum === orderNum || ordNum === withGs;
    });
    if (found) return jsonResponse(found);
    return jsonResponse({ error: `Order ${orderNum} not found.` }, 404);
  }

  // 3b. Admin Order Workflow Update (Persistence in localStorage)
  const orderWorkflowMatch = cleanPath.match(/^\/api\/admin\/orders\/(\d+)\/update-workflow$/);
  if (orderWorkflowMatch && method === 'POST') {
    const targetOrderId = Number(orderWorkflowMatch[1]);
    const orders = getStoredOrders();
    const idx = orders.findIndex(
      (o: any) =>
        Number(o?.order?.id) === targetOrderId ||
        String(o?.order?.orderNumber || '') === String(targetOrderId)
    );
    if (idx < 0) {
      return jsonResponse({ error: `Order #${targetOrderId} not found.` }, 404);
    }
    const bundle = { ...orders[idx] };
    const nowIso = new Date().toISOString();
    const prevOrderStatus = bundle.order.orderStatus;
    const prevPaymentStatus = bundle.order.paymentStatus;

    bundle.order = {
      ...bundle.order,
      orderStatus: body.nextOrderStatus || bundle.order.orderStatus,
      paymentStatus: body.nextPaymentStatus || bundle.order.paymentStatus,
      updatedAt: nowIso,
    };

    if (bundle.pickupDetails && (body.collectedByName || body.nextOrderStatus === 'COLLECTED')) {
      bundle.pickupDetails = {
        ...bundle.pickupDetails,
        collectedByName: body.collectedByName || bundle.order.customerName,
        collectedAt: body.nextOrderStatus === 'COLLECTED' ? nowIso : bundle.pickupDetails.collectedAt,
      };
    }

    if (bundle.shipmentDetails && (body.courierName || body.trackingNumber)) {
      bundle.shipmentDetails = {
        ...bundle.shipmentDetails,
        courierName: body.courierName || bundle.shipmentDetails.courierName,
        trackingNumber: body.trackingNumber || bundle.shipmentDetails.trackingNumber,
        trackingUrl: body.trackingUrl || bundle.shipmentDetails.trackingUrl,
        dispatchedAt:
          body.nextOrderStatus === 'DISPATCHED'
            ? nowIso
            : bundle.shipmentDetails.dispatchedAt,
      };
    }

    const logs = Array.isArray(bundle.activityLogs) ? [...bundle.activityLogs] : [];
    logs.unshift({
      id: Date.now(),
      orderId: bundle.order.id,
      action: 'ADMIN_UPDATE',
      statusFrom: prevOrderStatus,
      statusTo: bundle.order.orderStatus,
      paymentStatusFrom: prevPaymentStatus,
      paymentStatusTo: bundle.order.paymentStatus,
      note:
        body.note ||
        `Updated status to ${bundle.order.orderStatus} · Payment: ${bundle.order.paymentStatus}`,
      actorEmail: OWNER_EMAIL,
      actorRole: 'owner',
      createdAt: nowIso,
    });
    bundle.activityLogs = logs;

    orders[idx] = bundle;
    saveStoredList('gs_my_orders_v1', orders);
    return jsonResponse({ order: bundle });
  }

  // 4. Company / Brand Save & Delete Endpoints
  if (cleanPath === '/api/admin/brands/save' && method === 'POST') {
    const cleanName = String(body.name || '').trim();
    if (!cleanName) return jsonResponse({ error: 'Company / Brand name is required.' }, 400);
    const cleanSlug =
      String(body.slug || cleanName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || `brand-${Date.now().toString().slice(-4)}`;
    const status = body.status || (body.isActive === false ? 'HIDDEN' : 'PUBLISHED');
    const isActive = status === 'PUBLISHED';

    const brandsList = getStoredList('gs_fallback_brands_v1', DEFAULT_BRANDS);
    const existingIdx = brandsList.findIndex(
      (b: any) =>
        (body.id && Number(b.id) === Number(body.id)) ||
        b.slug === cleanSlug ||
        String(b.name || '').toLowerCase() === cleanName.toLowerCase()
    );

    const savedBrand =
      existingIdx >= 0
        ? {
            ...brandsList[existingIdx],
            ...body,
            name: cleanName,
            slug: cleanSlug,
            status,
            isActive,
          }
        : {
            id: Number(body.id) || Date.now(),
            name: cleanName,
            slug: cleanSlug,
            description: String(
              body.description || `Authorized ${cleanName} stationery & supplies`
            ).trim(),
            logoUrl: body.logoUrl || '',
            bannerUrl: body.bannerUrl || '',
            isFeatured: body.isFeatured !== undefined ? Boolean(body.isFeatured) : true,
            showInNav: body.showInNav !== undefined ? Boolean(body.showInNav) : true,
            sortOrder: Number(body.sortOrder) || brandsList.length + 1,
            status,
            isActive,
            productCount: 0,
            createdAt: new Date().toISOString(),
          };

    if (existingIdx >= 0) brandsList[existingIdx] = savedBrand;
    else brandsList.push(savedBrand);
    saveStoredList('gs_fallback_brands_v1', brandsList);
    return jsonResponse({ brand: savedBrand });
  }

  if (cleanPath.startsWith('/api/admin/brands/') && method === 'DELETE') {
    const id = Number(cleanPath.split('/api/admin/brands/')[1]);
    const brandsList = getStoredList('gs_fallback_brands_v1', DEFAULT_BRANDS).filter(
      (b: any) => Number(b.id) !== id
    );
    saveStoredList('gs_fallback_brands_v1', brandsList);
    return jsonResponse({ action: 'DELETED', id });
  }

  // 5. Category Save & Delete Endpoints
  if (cleanPath === '/api/admin/categories/save' && method === 'POST') {
    const cleanName = String(body.name || '').trim();
    if (!cleanName) return jsonResponse({ error: 'Category name is required.' }, 400);
    const cleanSlug =
      String(body.slug || cleanName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || `cat-${Date.now().toString().slice(-4)}`;
    const status = body.status || (body.isActive === false ? 'HIDDEN' : 'PUBLISHED');
    const isActive = status === 'PUBLISHED';

    const catsList = getStoredList('gs_fallback_categories_v1', DEFAULT_CATEGORIES);
    const existingIdx = catsList.findIndex(
      (c: any) =>
        (body.id && Number(c.id) === Number(body.id)) ||
        c.slug === cleanSlug ||
        String(c.name || '').toLowerCase() === cleanName.toLowerCase()
    );

    const savedCategory =
      existingIdx >= 0
        ? {
            ...catsList[existingIdx],
            ...body,
            name: cleanName,
            slug: cleanSlug,
            status,
            isActive,
            showOnHomepage: body.showOnHomepage !== false,
          }
        : {
            id: Number(body.id) || Date.now(),
            name: cleanName,
            slug: cleanSlug,
            description: String(body.description || `${cleanName} stationery essentials`).trim(),
            imageUrl: body.imageUrl || '',
            iconName: body.iconName || 'FolderOpen',
            parentId: body.parentId ? Number(body.parentId) : null,
            sortOrder: Number(body.sortOrder) || catsList.length + 1,
            showInNav: body.showInNav !== false,
            showOnHomepage: body.showOnHomepage !== false,
            showInFooter: body.showInFooter !== false,
            status,
            isActive,
            productCount: 0,
          };

    if (existingIdx >= 0) catsList[existingIdx] = savedCategory;
    else catsList.push(savedCategory);
    saveStoredList('gs_fallback_categories_v1', catsList);
    return jsonResponse({ category: savedCategory });
  }

  if (cleanPath.startsWith('/api/admin/categories/') && method === 'DELETE') {
    const id = Number(cleanPath.split('/api/admin/categories/')[1]);
    const catsList = getStoredList('gs_fallback_categories_v1', DEFAULT_CATEGORIES).filter(
      (c: any) => Number(c.id) !== id
    );
    saveStoredList('gs_fallback_categories_v1', catsList);
    return jsonResponse({ action: 'DELETED', id });
  }

  // 6. Product Save, Stock Adjust, Bulk Action & Delete
  if (cleanPath === '/api/admin/products/save' && method === 'POST') {
    const brandsList = getStoredList('gs_fallback_brands_v1', DEFAULT_BRANDS);
    const catsList = getStoredList('gs_fallback_categories_v1', DEFAULT_CATEGORIES);
    const prodsList = getStoredList('gs_fallback_catalogue_v1', DEFAULT_PRODUCTS);

    let targetBrandId = Number(body.brandId) || 1;
    let targetBrandName = 'Gayatri Essentials';
    let targetBrandSlug = 'gayatri';

    if (body.newBrandName && String(body.newBrandName).trim()) {
      const cleanBrandName = String(body.newBrandName).trim();
      const brandSlug =
        cleanBrandName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || `brand-${Date.now().toString().slice(-4)}`;
      let foundBrand = brandsList.find(
        (b: any) =>
          String(b.name || '').toLowerCase() === cleanBrandName.toLowerCase() || b.slug === brandSlug
      );
      if (!foundBrand) {
        foundBrand = {
          id: Date.now() - 10,
          name: cleanBrandName,
          slug: brandSlug,
          description: `Authorized ${cleanBrandName} stationery range`,
          isFeatured: true,
          showInNav: true,
          sortOrder: brandsList.length + 1,
          status: 'PUBLISHED',
          isActive: true,
          productCount: 1,
        };
        brandsList.push(foundBrand);
        saveStoredList('gs_fallback_brands_v1', brandsList);
      }
      targetBrandId = foundBrand.id;
      targetBrandName = foundBrand.name;
      targetBrandSlug = foundBrand.slug;
    } else {
      const foundBrand = brandsList.find((b: any) => Number(b.id) === targetBrandId);
      if (foundBrand) {
        targetBrandName = foundBrand.name;
        targetBrandSlug = foundBrand.slug;
      }
    }

    let targetCatId = Number(body.categoryId) || 1;
    let targetCatName = 'Stationery';
    let targetCatSlug = 'stationery';

    if (body.newCategoryName && String(body.newCategoryName).trim()) {
      const cleanCatName = String(body.newCategoryName).trim();
      const catSlug =
        cleanCatName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || `cat-${Date.now().toString().slice(-4)}`;
      let foundCat = catsList.find(
        (c: any) =>
          String(c.name || '').toLowerCase() === cleanCatName.toLowerCase() || c.slug === catSlug
      );
      if (!foundCat) {
        foundCat = {
          id: Date.now() - 20,
          name: cleanCatName,
          slug: catSlug,
          description: `${cleanCatName} stationery supplies`,
          showInNav: true,
          showOnHomepage: true,
          showInFooter: true,
          status: 'PUBLISHED',
          isActive: true,
          productCount: 1,
        };
        catsList.push(foundCat);
        saveStoredList('gs_fallback_categories_v1', catsList);
      }
      targetCatId = foundCat.id;
      targetCatName = foundCat.name;
      targetCatSlug = foundCat.slug;
    } else {
      const foundCat = catsList.find((c: any) => Number(c.id) === targetCatId);
      if (foundCat) {
        targetCatName = foundCat.name;
        targetCatSlug = foundCat.slug;
      }
    }

    const mrpPaise = Number(body.mrpPaise) || Math.round(Number(body.mrpRupees || 100) * 100);
    const sellingPricePaise =
      Number(body.sellingPricePaise) || Math.round(Number(body.sellingPriceRupees || 90) * 100);
    const stockQuantity = Number(body.initialStockQuantity ?? 25);
    const prodId = Number(body.id) || Date.now();
    const cleanSku = String(body.sku || `GS-${prodId.toString().slice(-4)}`).trim();
    const cleanName = String(body.name || 'Stationery Item').trim();

    const savedProduct = {
      id: prodId,
      sku: cleanSku,
      name: cleanName,
      slug:
        cleanName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') + `-${cleanSku.toLowerCase()}`,
      categoryId: targetCatId,
      categoryName: targetCatName,
      categorySlug: targetCatSlug,
      brandId: targetBrandId,
      brandName: targetBrandName,
      brandSlug: targetBrandSlug,
      shortDescription: body.shortDescription || cleanName,
      description: body.description || body.shortDescription || cleanName,
      mrpPaise,
      sellingPricePaise,
      baseMrpPaise: mrpPaise,
      basePricePaise: sellingPricePaise,
      taxRatePercent: Number(body.taxRatePercent ?? 12),
      imageUrl: body.imageUrl || '',
      galleryUrls: Array.isArray(body.galleryUrls) ? body.galleryUrls : [],
      illustrationType: body.illustrationType || 'spiral_notebook',
      pickupEligible: body.pickupEligible !== false,
      deliveryEligible: body.deliveryEligible !== false,
      isFeatured: Boolean(body.isFeatured),
      isBestseller: Boolean(body.isBestseller),
      isNewArrival: body.isNewArrival !== false,
      isActive: body.isActive !== false,
      status: body.status || 'PUBLISHED',
      totalStock: stockQuantity,
      variants: [
        {
          id: prodId + 1,
          productId: prodId,
          sku: `${cleanSku}-STD`,
          variantName: body.variantName || 'Standard Pack',
          mrpPaise,
          sellingPricePaise,
          pricePaise: sellingPricePaise,
          stockQuantity,
          inStock: stockQuantity > 0,
          isActive: true,
        },
      ],
    };

    const existingProdIdx = prodsList.findIndex(
      (p: any) => Number(p.id) === prodId || p.sku === cleanSku
    );
    if (existingProdIdx >= 0) prodsList[existingProdIdx] = savedProduct;
    else prodsList.unshift(savedProduct);
    saveStoredList('gs_fallback_catalogue_v1', prodsList);
    return jsonResponse({ product: savedProduct });
  }

  if (cleanPath === '/api/admin/inventory/adjust' && method === 'POST') {
    const variantId = Number(body.variantId);
    const nextQty = Math.max(0, Number(body.newStockQuantity || 0));
    const prodsList = getStoredList('gs_fallback_catalogue_v1', DEFAULT_PRODUCTS).map((p: any) => {
      const vars = Array.isArray(p.variants) ? p.variants : [];
      const hasVar = vars.some((v: any) => Number(v.id) === variantId) || Number(p.id) === variantId;
      if (!hasVar) return p;
      const updatedVars = vars.map((v: any) =>
        Number(v.id) === variantId || Number(p.id) === variantId
          ? { ...v, stockQuantity: nextQty, inStock: nextQty > 0 }
          : v
      );
      return {
        ...p,
        totalStock: updatedVars.reduce((s: number, v: any) => s + Number(v.stockQuantity || 0), 0) || nextQty,
        variants: updatedVars,
      };
    });
    saveStoredList('gs_fallback_catalogue_v1', prodsList);
    return jsonResponse({ updated: true, variantId, newStockQuantity: nextQty });
  }

  if (cleanPath === '/api/admin/products/bulk-action' && method === 'POST') {
    const ids = new Set((body.productIds || []).map(Number));
    const action = body.action;
    const prodsList = getStoredList('gs_fallback_catalogue_v1', DEFAULT_PRODUCTS).map((p: any) => {
      if (!ids.has(Number(p.id))) return p;
      if (action === 'PUBLISH') return { ...p, isActive: true, status: 'PUBLISHED' };
      if (action === 'HIDE' || action === 'ARCHIVE') return { ...p, isActive: false, status: 'HIDDEN' };
      if (action === 'MARK_FEATURED') return { ...p, isFeatured: true };
      if (action === 'MARK_BESTSELLER') return { ...p, isBestseller: true };
      return p;
    });
    saveStoredList('gs_fallback_catalogue_v1', prodsList);
    return jsonResponse({ updatedCount: ids.size });
  }

  if (cleanPath.match(/^\/api\/admin\/products\/\d+\/images$/) && method === 'POST') {
    const prodId = Number(cleanPath.split('/')[4]);
    const prodsList = getStoredList('gs_fallback_catalogue_v1', DEFAULT_PRODUCTS);
    const idx = prodsList.findIndex((p: any) => Number(p.id) === prodId);
    const existing = idx >= 0 ? prodsList[idx] : { id: prodId, imageUrl: '', galleryUrls: [] };
    let gallery = Array.isArray(body.galleryUrls)
      ? [...body.galleryUrls]
      : Array.isArray(existing.galleryUrls)
      ? [...existing.galleryUrls]
      : [];
    const incoming = [
      ...(body.imageUrl ? [body.imageUrl] : []),
      ...(Array.isArray(body.newImageUrls) ? body.newImageUrls : []),
    ].filter(Boolean);
    for (const u of incoming) {
      if (!gallery.includes(u)) gallery.push(u);
    }
    let primary =
      body.imageUrl !== undefined
        ? body.imageUrl
        : body.setAsPrimary && incoming[0]
        ? incoming[0]
        : existing.imageUrl || incoming[0] || '';
    if (body.removeImageUrl) {
      gallery = gallery.filter((u: string) => u !== body.removeImageUrl);
      if (primary === body.removeImageUrl) primary = gallery[0] || '';
    }
    const updated = { ...existing, imageUrl: primary, galleryUrls: gallery };
    if (idx >= 0) {
      prodsList[idx] = updated;
      saveStoredList('gs_fallback_catalogue_v1', prodsList);
    }
    return jsonResponse({ product: updated });
  }

  if (
    (cleanPath === '/api/admin/products/delete' ||
      cleanPath.match(/^\/api\/admin\/products\/\d+\/delete$/)) &&
    method === 'POST'
  ) {
    const pathId = cleanPath.match(/^\/api\/admin\/products\/(\d+)\/delete$/)?.[1];
    const targetId = Number(pathId || body.productId || 0);
    const targetSku = String(body.sku || '').trim().toLowerCase();
    const targetName = String(body.name || '').trim().toLowerCase();

    const prodsList = getStoredList('gs_fallback_catalogue_v1', DEFAULT_PRODUCTS);
    const filtered = prodsList.filter((p: any) => {
      if (targetId && Number(p.id) === targetId) return false;
      if (targetSku && String(p.sku || '').toLowerCase() === targetSku) return false;
      if (targetName && String(p.name || '').toLowerCase() === targetName) return false;
      return true;
    });
    saveStoredList('gs_fallback_catalogue_v1', filtered);

    const deletedIds = getStoredRawList('gs_deleted_products_v1');
    if (targetId && !deletedIds.includes(targetId)) deletedIds.push(targetId);
    if (targetSku && !deletedIds.includes(targetSku)) deletedIds.push(targetSku);
    saveStoredList('gs_deleted_products_v1', deletedIds);

    return jsonResponse({ deleted: true, productId: targetId });
  }

  // 6d. Web Product Photos Search Fallback
  if (cleanPath === '/api/admin/products/web-photos' && method === 'POST') {
    const q = String(body.query || body.name || 'stationery').toLowerCase();
    const allPhotos = [
      {
        url: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=900&q=85',
        title: `${body.name || 'Stationery'} — Spiral Notebook & Register`,
        source: 'Studio Stock · Notebooks',
      },
      {
        url: 'https://images.unsplash.com/photo-1585336261026-6a66e2e6f3fd?auto=format&fit=crop&w=900&q=85',
        title: `${body.name || 'Stationery'} — Ball & Gel Pens Set`,
        source: 'Studio Stock · Pens & Writing',
      },
      {
        url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=85',
        title: `${body.name || 'Stationery'} — Watercolour & Art Kit`,
        source: 'Studio Stock · Art & Craft',
      },
      {
        url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=900&q=85',
        title: `${body.name || 'Stationery'} — Hardbound A4 Register`,
        source: 'Studio Stock · Registers',
      },
      {
        url: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=900&q=85',
        title: `${body.name || 'Stationery'} — Geometry & Compass Box`,
        source: 'Studio Stock · Exam & Geometry',
      },
      {
        url: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=900&q=85',
        title: `${body.name || 'Stationery'} — DIY Craft & Adhesive Kit`,
        source: 'Studio Stock · DIY & Craft',
      },
    ];
    if (q.includes('pen') || q.includes('pencil') || q.includes('flair') || q.includes('unomax')) {
      allPhotos.unshift(allPhotos.splice(1, 1)[0]);
    } else if (q.includes('art') || q.includes('doms') || q.includes('paint') || q.includes('craft')) {
      allPhotos.unshift(allPhotos.splice(2, 1)[0]);
    }
    return jsonResponse({ photos: allPhotos });
  }

  // 6e. Bulk Enquiries Fallback
  if (cleanPath === '/api/bulk-enquiries' && method === 'POST') {
    const list = getStoredRawList('gs_bulk_enquiries_v1');
    const enquiry = {
      id: Date.now(),
      enquiryNumber: `GS-BULK-${Date.now().toString().slice(-5)}`,
      institutionName: body.institutionName || 'Institution',
      contactPerson: body.contactPerson || 'Representative',
      phone: body.phone || '',
      email: body.email || '',
      gstin: body.gstin || '',
      deliveryPincode: body.deliveryPincode || '208021',
      requiredByDate: body.requiredByDate || '',
      notes: body.notes || '',
      itemsRequestedJson: Array.isArray(body.itemsRequested) ? body.itemsRequested : [],
      status: 'NEW',
      createdAt: new Date().toISOString(),
    };
    list.unshift(enquiry);
    saveStoredList('gs_bulk_enquiries_v1', list);
    return jsonResponse({ enquiry }, 201);
  }

  const bulkUpdateMatch = cleanPath.match(/^\/api\/admin\/bulk-enquiries\/(\d+)\/update$/);
  if (bulkUpdateMatch && method === 'POST') {
    const enqId = Number(bulkUpdateMatch[1]);
    const list = getStoredRawList('gs_bulk_enquiries_v1').map((e: any) =>
      Number(e.id) === enqId
        ? {
            ...e,
            status: body.status || e.status,
            quotedAmountPaise: body.quotedAmountPaise ?? e.quotedAmountPaise,
            adminNotes: body.adminNotes || e.adminNotes,
          }
        : e
    );
    saveStoredList('gs_bulk_enquiries_v1', list);
    return jsonResponse({ ok: true });
  }

  // 6f. Coupons, Banners, Store Settings & Cashfree Config Fallback
  if (cleanPath === '/api/admin/coupons/save' && method === 'POST') {
    const list = getStoredList('gs_coupons_v1', DEFAULT_COUPONS);
    const code = String(body.code || '').trim().toUpperCase();
    if (!code) return jsonResponse({ error: 'Coupon code is required.' }, 400);
    const idx = list.findIndex((c: any) => String(c.code || '').toUpperCase() === code);
    const coupon = {
      id: idx >= 0 ? list[idx].id : Date.now(),
      code,
      description: body.description || `${code} Promo Discount`,
      discountType: body.discountType || 'PERCENTAGE',
      discountValue: Number(body.discountValue || 10),
      minOrderPaise: Number(body.minOrderPaise || 0),
      maxDiscountPaise: Number(body.maxDiscountPaise || 15000),
      usageLimit: Number(body.usageLimit || 200),
      usedCount: idx >= 0 ? list[idx].usedCount || 0 : 0,
      isActive: body.isActive !== false,
    };
    if (idx >= 0) list[idx] = coupon;
    else list.unshift(coupon);
    saveStoredList('gs_coupons_v1', list);
    return jsonResponse({ coupon });
  }

  if (cleanPath === '/api/admin/settings/save' && method === 'POST') {
    const settings = getStoredObject('gs_store_settings_v1');
    if (body.key) {
      settings[body.key] = body.valueJson;
      saveStoredObject('gs_store_settings_v1', settings);
    }
    return jsonResponse({ ok: true, settings });
  }

  if (cleanPath === '/api/admin/banners/save' && method === 'POST') {
    const list = getStoredRawList('gs_banners_v1');
    const banner = {
      ...body,
      id: Number(body.id) || Date.now(),
      isActive: body.isActive !== false,
      status: body.status || 'PUBLISHED',
    };
    const idx = list.findIndex((b: any) => Number(b.id) === Number(banner.id));
    if (idx >= 0) list[idx] = banner;
    else list.unshift(banner);
    saveStoredList('gs_banners_v1', list);
    return jsonResponse({ banner });
  }

  if (cleanPath === '/api/admin/cashfree/save-config' && method === 'POST') {
    const settings = getStoredObject('gs_store_settings_v1');
    settings.cashfree_config = {
      appId: body.appId || '',
      secretKey: body.secretKey || '',
      environment: body.environment || 'SANDBOX',
    };
    saveStoredObject('gs_store_settings_v1', settings);
    return jsonResponse({ ok: true });
  }

  // 6g. Customer AI Shopping Assistant (Vidya AI) Smart Fallback
  if (cleanPath === '/api/ai/rufus' && method === 'POST') {
    const q = String(body.question || '').toLowerCase();
    const cat =
      Array.isArray(body.catalogue) && body.catalogue.length > 0
        ? body.catalogue
        : getStoredList('gs_fallback_catalogue_v1', DEFAULT_PRODUCTS);
    const activeCat = cat.filter((p: any) => p && p.isActive !== false);

    // Filter matching items dynamically based on customer query tokens
    const tokens = q
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !['best', 'good', 'for', 'the', 'and', 'with', 'show', 'compare'].includes(t));

    const scored = activeCat.map((p: any) => {
      const hay = `${p.name} ${p.brandName} ${p.categoryName} ${p.shortDescription}`.toLowerCase();
      let score = 0;
      for (const tok of tokens) {
        if (hay.includes(tok)) score += 2;
      }
      if (q.includes('under 150') && Number(p.sellingPricePaise || 0) <= 15000) score += 3;
      if (q.includes('under 100') && Number(p.sellingPricePaise || 0) <= 10000) score += 3;
      if (p.isBestseller) score += 0.5;
      return { p, score };
    });

    scored.sort((a: any, b: any) => b.score - a.score);
    const matched = scored.slice(0, 3).map((x: any) => x.p);

    const lines = matched
      .map(
        (p: any) =>
          `• **${p.name}** (${p.brandName || 'Gayatri Stationers'}) — **₹${Math.round(
            Number(p.sellingPricePaise || 0) / 100
          )}**`
      )
      .join('\n');

    let answer = `Here are top recommendations from **Gayatri Stationers**:\n\n${lines}\n\nAll items qualify for **₹0 Store Pickup** in Naubasta, Kanpur or Express Home Delivery.`;
    if (q.includes('pickup') || q.includes('delivery')) {
      answer = `At **Gayatri Stationers**, both **Store Pickup** (${STORE_ADDRESS}, with a 6-digit pickup code) and **Express Home Delivery** have **₹0 delivery fee**! Use code **BACKTOSCHOOL10** for 10% off above ₹399.`;
    } else if (q.includes('coupon') || q.includes('discount') || q.includes('offer')) {
      answer = `Active promo codes you can apply right in your Shopping Bag:\n• **BACKTOSCHOOL10** — 10% off orders ₹399+\n• **STORE50** — Flat ₹50 off orders ₹499+\n• **OFFICE100** — Flat ₹100 off orders ₹999+`;
    }

    return jsonResponse({
      answer,
      recommendedProductIds: matched.map((p: any) => Number(p.id)),
      followUpQuestions: [
        'Best pens for fast board exam writing under ₹150?',
        'What promo coupons can I apply right now?',
        'How does ₹0 Store Pickup work in Kanpur?',
      ],
      clientAction: { type: 'NONE' },
    });
  }

  // 7. Admin Dashboard & Storefront Bootstrap Fallback
  if (cleanPath.startsWith('/api/admin/dashboard')) {
    const savedOrders = getStoredOrders();
    const products = getStoredList('gs_fallback_catalogue_v1', DEFAULT_PRODUCTS);
    const categories = getStoredList('gs_fallback_categories_v1', DEFAULT_CATEGORIES);
    const brands = getStoredList('gs_fallback_brands_v1', DEFAULT_BRANDS);
    const coupons = getStoredList('gs_coupons_v1', DEFAULT_COUPONS);
    const bulkEnquiries = getStoredRawList('gs_bulk_enquiries_v1');
    const storeSettings = getStoredObject('gs_store_settings_v1');
    const banners = getStoredRawList('gs_banners_v1');
    const notifs = getStoredRawList('gs_admin_order_alerts_v1');
    const totalRev = savedOrders
      .filter((o: any) => o?.order?.orderStatus !== 'CANCELLED')
      .reduce((s: number, o: any) => s + Number(o?.order?.totalPaise || 0), 0);
    const lowStockVariants = products
      .filter((p: any) => Number(p.totalStock ?? p.variants?.[0]?.stockQuantity ?? 50) <= 10)
      .map((p: any) => ({
        id: p.variants?.[0]?.id || p.id,
        productName: p.name,
        sku: p.sku,
        variantName: p.variants?.[0]?.variantName || 'Standard',
        stockQuantity: p.totalStock ?? p.variants?.[0]?.stockQuantity ?? 0,
        lowStockThreshold: 10,
      }));

    const savedSession = getStoredObject('gs_admin_session_v1');
    const savedProfile = getStoredObject('gs_user_profile_v1');
    const knownUsers: any[] = [];
    if (savedSession?.user) knownUsers.push(savedSession.user);
    else if (savedProfile?.email) knownUsers.push(savedProfile);

    return jsonResponse({
      metrics: {
        todaysOrdersCount: savedOrders.length,
        totalOrdersCount: savedOrders.length,
        totalOrders: savedOrders.length,
        readyForPickupCount: savedOrders.filter(
          (o: any) =>
            o?.order?.fulfilmentMethod === 'STORE_PICKUP' &&
            o?.order?.orderStatus !== 'COLLECTED' &&
            o?.order?.orderStatus !== 'CANCELLED'
        ).length,
        pendingOrdersCount: savedOrders.filter(
          (o: any) => !['COLLECTED', 'DELIVERED', 'CANCELLED'].includes(o?.order?.orderStatus)
        ).length,
        pendingOfflinePaymentsCount: savedOrders.filter(
          (o: any) => o?.order?.paymentStatus !== 'PAID' && o?.order?.orderStatus !== 'CANCELLED'
        ).length,
        paidRevenuePaise: totalRev,
        activeOrdersValuePaise: totalRev,
        lowStockVariantsCount: lowStockVariants.length,
        openBulkEnquiriesCount: bulkEnquiries.filter((b: any) => b.status !== 'CLOSED').length,
        unreadNotificationsCount: notifs.filter((n: any) => !n.isRead).length,
      },
      orders: savedOrders,
      lowStockVariants,
      inventoryMovements: [],
      products,
      categories,
      brands,
      coupons,
      serviceablePincodes: DEFAULT_PINCODES,
      bulkEnquiries,
      users: knownUsers,
      notifications: notifs,
      pages: DEFAULT_CMS_PAGES,
      banners,
      homepageSections: [],
      navigationItems: [],
      bundles: DEFAULT_BUNDLES,
      revisions: [],
      settings: storeSettings,
    });
  }

  if (cleanPath.startsWith('/api/storefront/bootstrap')) {
    const storedCats = getStoredList('gs_fallback_categories_v1', DEFAULT_CATEGORIES);
    const storedBrands = getStoredList('gs_fallback_brands_v1', DEFAULT_BRANDS);
    const storedProds = getStoredList('gs_fallback_catalogue_v1', DEFAULT_PRODUCTS);
    const coupons = getStoredList('gs_coupons_v1', DEFAULT_COUPONS);
    const settings = getStoredObject('gs_store_settings_v1');
    const banners = getStoredRawList('gs_banners_v1');
    const hasCashfreeKeys = Boolean(
      settings?.cashfree_config?.appId && settings?.cashfree_config?.secretKey
    );
    return jsonResponse({
      categories: storedCats,
      brands: storedBrands,
      products: storedProds,
      bundles: DEFAULT_BUNDLES,
      coupons,
      serviceablePincodes: DEFAULT_PINCODES,
      settings,
      navigationItems: [],
      banners,
      homepageSections: [],
      pages: DEFAULT_CMS_PAGES,
      paymentGatewayStatus: {
        cashfreeConfigured: hasCashfreeKeys,
        cashfreeEnvironment: settings?.cashfree_config?.environment || 'SANDBOX',
        razorpayConfigured: false,
        razorpayKeyId: null,
      },
    });
  }

  if (cleanPath.startsWith('/api/payments/cashfree/create-session')) {
    return jsonResponse(
      {
        fallback: true,
        error:
          'Online Cashfree gateway requires a live backend or Netlify function with API keys. Choose Pay at Store Counter or Cash on Delivery below.',
      },
      400
    );
  }

  if (cleanPath.startsWith('/api/payments/cashfree/verify')) {
    return jsonResponse(
      {
        success: false,
        error:
          'Online Cashfree verification requires a live backend or Netlify function. Payment was not marked paid automatically.',
      },
      400
    );
  }

  return jsonResponse({ ok: true, fallback: true });
}

function installResilientApiInterceptor() {
  if (typeof window === 'undefined') return;
  const originalFetch = window.fetch.bind(window);

  // Guard Response.prototype.json so HTML never throws "Unexpected token '<'"
  Response.prototype.json = async function () {
    try {
      const rawText = await this.text();
      const trimmed = (rawText || '').trim();
      if (!trimmed) return {};
      if (trimmed.startsWith('<')) {
        return {
          _isHtmlFallback: true,
          ok: true,
          fallback: true,
        };
      }
      return JSON.parse(trimmed);
    } catch {
      return {
        _isInvalidJsonFallback: true,
        ok: true,
        fallback: true,
      };
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
      const peekText = await res.clone().text();
      const isHtml = peekText.trim().startsWith('<');

      if (
        !isHtml &&
        (contentType.includes('application/json') ||
          peekText.trim().startsWith('{') ||
          peekText.trim().startsWith('['))
      ) {
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
    } catch {
      // Network error on primary fetch — proceed to Netlify function or client fallback
    }

    // If this is a Cashfree API call on Netlify, call Netlify serverless function directly
    if (apiPath.startsWith('/api/payments/cashfree/') || apiPath.startsWith('/api/admin/cashfree/')) {
      try {
        const fnSuffix = apiPath.split('/').pop() || 'create-session';
        const fnRes = await originalFetch(`/.netlify/functions/cashfree/${fnSuffix}`, init);
        const fnText = await fnRes.clone().text();
        if (
          !fnText.trim().startsWith('<') &&
          (fnText.trim().startsWith('{') || fnText.trim().startsWith('['))
        ) {
          return fnRes;
        }
      } catch {
        // Ignore
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
        <div className="min-h-screen flex items-center justify-center p-6 text-[#1F1C18] font-sans">
          <div className="max-w-md w-full liquid-glass rounded-[32px] p-6 sm:p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#FDF2ED] text-[#B44C2E] flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h1 className="font-serif-display text-xl font-bold text-[#1F1C18]">
              Gayatri Stationers
            </h1>
            <p className="text-xs text-[#5C5349]">
              Something interrupted the screen render. Tap below to reload cleanly.
            </p>
            {this.state.error?.message && (
              <div className="p-3 liquid-glass-subtle rounded-2xl text-[11px] font-mono text-[#1F1C18] text-left overflow-x-auto">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="w-full py-3 liquid-btn-primary rounded-full text-xs font-semibold cursor-pointer"
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
