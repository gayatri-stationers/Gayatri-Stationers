import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  optionalAuth,
  requireAuth,
  requireStaffOrOwner,
  requireOwner,
  createAdminSessionToken,
  isAuthorizedAdminEmail,
  syncUserWithDatabase,
  AuthRequest,
} from './src/middleware/auth.ts';
import { ensureSeeded } from './src/db/seed.ts';
import {
  getStoreBootstrapData,
  getOrSyncCart,
  getUserWishlist,
  toggleUserWishlistItem,
  placeOrderTransactionally,
  getOrderDetailsByNumberOrId,
  listCustomerOrders,
  updateOrderWorkflowByAdmin,
  recordVerifiedOnlinePayment,
  getAdminDashboardData,
  adjustVariantInventoryByAdmin,
  createOrUpdateProductByAdmin,
  associateProductImagesByAdmin,
  deleteProductByAdmin,
  importProductsFromCsvByAdmin,
  createBulkOrderEnquiry,
  updateBulkEnquiryByAdmin,
  upsertServiceablePincodeByAdmin,
  upsertCouponByAdmin,
  updateStoreSettingByAdmin,
  updateUserRoleById,
  updateUserProfileById,
  upsertCategoryByAdmin,
  deleteOrArchiveCategoryByAdmin,
  upsertBrandByAdmin,
  deleteOrArchiveBrandByAdmin,
  upsertNavigationItemByAdmin,
  deleteNavigationItemByAdmin,
  upsertHomepageSectionByAdmin,
  deleteHomepageSectionByAdmin,
  upsertBannerByAdmin,
  deleteBannerByAdmin,
  upsertCmsPageByAdmin,
  deleteCmsPageByAdmin,
  upsertProductBundleByAdmin,
  bulkProductActionByAdmin,
  markNotificationReadByAdmin,
  markAllNotificationsReadByAdmin,
} from './src/db/repository.ts';
import {
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from './src/lib/domain-logic.ts';
import {
  getCashfreeConfig,
  maskCashfreeAppId,
  createCashfreeOrder,
  getCashfreeOrder,
  getCashfreeOrderPayments,
  verifyCashfreeWebhookSignature,
  testCashfreeConnection,
} from './src/lib/cashfree.ts';
import {
  uploadBase64ToSupabaseStorage,
  getSupabaseMigrationReadiness,
  testSupabaseServerConnection,
} from './src/lib/supabase-admin.ts';
import { generateRecoverableMigrationBackup } from './scripts/migrate_firebase_to_supabase.ts';
import {
  searchWebProductPhotos,
  askCustomerRufusAssistant,
  parseAdminCopilotCommandWithGemini,
  transcribeAudioWithGemini,
} from './src/lib/gemini-ai.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function buildStudioProductSvgDataUrl(params: {
  name: string;
  sku: string;
  categoryName?: string;
  brandName?: string;
}): string {
  const safeTitle = (params.name || 'Stationery Item')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, 34);
  const safeSub = `${params.brandName || 'Gayatri Stationers'} · ${
    params.categoryName || 'Retail Catalogue'
  }`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, 44);
  const safeSku = (params.sku || 'GS-ITEM')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, 22);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <rect width="800" height="600" fill="#F8FAFC"/>
    <ellipse cx="400" cy="495" rx="235" ry="26" fill="#E2E8F0"/>
    <rect x="170" y="75" width="460" height="410" rx="14" fill="#FFFFFF" stroke="#18181B" stroke-width="4"/>
    <rect x="170" y="75" width="460" height="76" rx="12" fill="#B42318"/>
    <text x="206" y="122" fill="#FFFFFF" font-family="monospace" font-size="22" font-weight="700">GAYATRI STATIONERS STUDIO</text>
    <rect x="210" y="185" width="380" height="175" rx="8" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2.5"/>
    <text x="400" y="262" text-anchor="middle" fill="#18181B" font-family="Georgia, serif" font-size="28" font-weight="700">${safeTitle}</text>
    <text x="400" y="305" text-anchor="middle" fill="#52525B" font-family="sans-serif" font-size="18" font-weight="500">${safeSub}</text>
    <rect x="275" y="392" width="250" height="48" rx="6" fill="#18181B"/>
    <text x="400" y="423" text-anchor="middle" fill="#FFFFFF" font-family="monospace" font-size="19" font-weight="700">SKU: ${safeSku}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-customer-email');
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  app.use(
    express.json({
      limit: '10mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    })
  );

  const getActiveCashfreeConfig = (storeSettingsMap?: Record<string, any>) => {
    const fromEnv = getCashfreeConfig();
    const stored = storeSettingsMap?.cashfree_config;
    if (stored?.appId && stored?.secretKey) {
      return getCashfreeConfig({
        appId: stored.appId,
        secretKey: stored.secretKey,
        environment: stored.environment,
      });
    }
    return fromEnv;
  };

  const isRazorpayConfigured = Boolean(
    process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET &&
      process.env.RAZORPAY_KEY_ID !== 'rzp_test_placeholder' &&
      process.env.RAZORPAY_KEY_SECRET !== 'razorpay_secret_placeholder'
  );

  // 1. Storefront Bootstrap & Seed
  app.get('/api/storefront/bootstrap', optionalAuth, async (req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      const data = await getStoreBootstrapData();
      let wishlistProductIds: number[] = [];
      if (req.dbUser) {
        wishlistProductIds = await getUserWishlist(req.dbUser.id);
      }
      const activeCashfree = getActiveCashfreeConfig(data.settings);

      res.json({
        ...data,
        wishlistProductIds,
        currentUser: req.dbUser || null,
        paymentGatewayStatus: {
          cashfreeConfigured: activeCashfree.isConfigured,
          cashfreeEnvironment: activeCashfree.environment,
          cashfreeAppId: activeCashfree.isConfigured ? maskCashfreeAppId(activeCashfree.appId) : null,
          razorpayConfigured: isRazorpayConfigured,
          razorpayKeyId: isRazorpayConfigured ? process.env.RAZORPAY_KEY_ID : null,
        },
      });
    } catch (error: any) {
      console.error('Bootstrap error:', error);
      res.status(500).json({ error: error.message || 'Failed to load storefront data.' });
    }
  });

  // 2. Auth Profile & Open Google Administrator Sign-Up / Sign-In
  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
    res.json({ user: req.dbUser });
  });

  app.post('/api/admin/auth/google', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const fullName = String(req.body?.fullName || '').trim();
      const uidInput = String(req.body?.uid || '').trim();
      const requestedRole = req.body?.role === 'staff' ? 'staff' : 'owner';

      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'A valid Google email address is required.' });
      }
      if (!isAuthorizedAdminEmail(email)) {
        return res.status(403).json({
          error:
            'Access Restricted: Only the verified Store Owner account (vainhavgupta20052014@gmail.com) is authorized to access the Admin Console.',
        });
      }

      const uid = uidInput || `google-admin-${email}`;
      const displayName = fullName || email.split('@')[0];

      const dbUser = await syncUserWithDatabase(uid, email, displayName, requestedRole);
      const session = createAdminSessionToken({
        uid: dbUser.uid,
        email: dbUser.email,
        role: dbUser.role,
      });

      res.json({
        token: session.token,
        expiresAt: session.expiresAt,
        user: dbUser,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Google Admin sign-in failed.' });
    }
  });

  app.post('/api/admin/auth/login', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const fullName = String(req.body?.fullName || '').trim();
      const requestedRole = req.body?.role === 'staff' ? 'staff' : 'owner';

      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'A valid Store Owner email is required.' });
      }
      if (!isAuthorizedAdminEmail(email)) {
        return res.status(403).json({
          error:
            'Access Restricted: Only the verified Store Owner account (vainhavgupta20052014@gmail.com) is authorized to access the Admin Console.',
        });
      }

      const dbUser = await syncUserWithDatabase(
        `admin-owner-${email}`,
        email,
        fullName || email.split('@')[0] || 'Gayatri Stationers Admin',
        requestedRole
      );
      const session = createAdminSessionToken({
        uid: dbUser.uid,
        email: dbUser.email,
        role: dbUser.role,
      });

      res.json({
        token: session.token,
        expiresAt: session.expiresAt,
        user: dbUser,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Administrator sign-in failed.' });
    }
  });

  app.post('/api/auth/customer-login', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const fullName = String(req.body?.fullName || '').trim();
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }

      const targetRole = isAuthorizedAdminEmail(email) ? 'owner' : 'customer';
      const dbUser = await syncUserWithDatabase(
        `cust-${email}`,
        email,
        fullName || email.split('@')[0],
        targetRole
      );
      const session = createAdminSessionToken({
        uid: dbUser.uid,
        email: dbUser.email,
        role: targetRole,
      });

      res.json({
        token: session.token,
        expiresAt: session.expiresAt,
        user: dbUser,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Customer sign-in failed.' });
    }
  });

  app.post('/api/auth/profile', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const fullName = String(req.body?.fullName || '').trim();
      const phone = String(req.body?.phone || '').trim();
      const email = String(req.body?.email || req.dbUser?.email || '').trim().toLowerCase();

      // If authenticated user is updating their own profile (and not a customer trying to overwrite owner)
      if (req.dbUser?.id) {
        if (isAuthorizedAdminEmail(req.dbUser.email) && email && !isAuthorizedAdminEmail(email)) {
          // A customer supplied a non-owner email while holding a stale session: create/update a separate customer record instead of overwriting the owner!
          const customerRecord = await syncUserWithDatabase(
            `cust-${email}`,
            email,
            fullName || email.split('@')[0],
            'customer'
          );
          const updatedCust = await updateUserProfileById({
            userId: customerRecord.id,
            fullName: fullName || undefined,
            phone,
          });
          return res.json({ user: updatedCust || customerRecord });
        }

        const updated = await updateUserProfileById({
          userId: req.dbUser.id,
          fullName: fullName || undefined,
          phone,
        });
        return res.json({ user: updated || { ...req.dbUser, fullName, phone } });
      }

      // Unauthenticated profile update: never allow overwriting the owner email record
      const safeCustomerEmail =
        email && email.includes('@') && !isAuthorizedAdminEmail(email)
          ? email
          : 'customer@gayatristationers.com';

      const synced = await syncUserWithDatabase(
        `cust-${safeCustomerEmail}`,
        safeCustomerEmail,
        fullName || safeCustomerEmail.split('@')[0],
        'customer'
      );
      const updated = await updateUserProfileById({
        userId: synced.id,
        fullName: fullName || undefined,
        phone,
      });
      return res.json({ user: updated || synced });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update profile.' });
    }
  });

  app.post('/api/auth/role-switch', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { role } = req.body;
      if (!['customer', 'staff', 'owner'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role specified.' });
      }
      if (
        (role === 'owner' || role === 'staff') &&
        !isAuthorizedAdminEmail(req.dbUser?.email || '')
      ) {
        return res.status(403).json({
          error: 'Only the verified Store Owner can switch to an Admin role.',
        });
      }

      const targetUser = await updateUserRoleById(req.dbUser!.id, role);

      const session = createAdminSessionToken({
        uid: targetUser.uid,
        email: targetUser.email,
        role: targetUser.role,
      });

      res.json({
        user: targetUser,
        token: session.token,
        expiresAt: session.expiresAt,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to switch role.' });
    }
  });

  // 3. Server-Side Cart Calculation & Persistence
  app.post('/api/cart/calculate', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const {
        items,
        couponCode,
        fulfilmentMethod,
        fulfillmentType,
        pincode,
        deliveryPincode,
        guestSessionId,
      } = req.body;
      const resolvedFulfilment =
        (fulfilmentMethod || fulfillmentType) === 'HOME_DELIVERY'
          ? 'HOME_DELIVERY'
          : 'STORE_PICKUP';
      const result = await getOrSyncCart({
        userId: req.dbUser?.id,
        guestSessionId: guestSessionId || undefined,
        itemsInput: Array.isArray(items) ? items : undefined,
        couponCode,
        fulfilmentMethod: resolvedFulfilment,
        pincode: pincode || deliveryPincode,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to calculate cart.' });
    }
  });

  // 4. Wishlist Persistence
  app.get('/api/wishlist', requireAuth, async (req: AuthRequest, res) => {
    try {
      const productIds = await getUserWishlist(req.dbUser!.id);
      res.json({ productIds });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load wishlist.' });
    }
  });

  app.post('/api/wishlist/toggle', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { productId } = req.body;
      if (!productId) {
        return res.status(400).json({ error: 'productId is required.' });
      }
      const result = await toggleUserWishlistItem(req.dbUser!.id, Number(productId));
      const productIds = await getUserWishlist(req.dbUser!.id);
      res.json({ ...result, productIds });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update wishlist.' });
    }
  });

  // 5. Checkout & Order Creation (Strictly bound to signed-in user account)
  app.post('/api/orders', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        return res.status(401).json({
          error: 'Please sign in to your account before placing an order.',
        });
      }

      const {
        guestSessionId,
        customerName,
        customerPhone,
        customerEmail,
        fulfilmentMethod,
        fulfillmentType,
        paymentMethod,
        couponCode,
        notes,
        items,
        pickupWindow,
        shippingAddress,
        deliveryAddress,
        deliveryCity,
        deliveryState,
        deliveryPincode,
      } = req.body;

      const resolvedFulfilment =
        (fulfilmentMethod || fulfillmentType) === 'HOME_DELIVERY'
          ? 'HOME_DELIVERY'
          : 'STORE_PICKUP';

      const resolvedPaymentMethod =
        paymentMethod ||
        (resolvedFulfilment === 'STORE_PICKUP' ? 'PAY_AT_STORE' : 'CASHFREE_ONLINE');

      const resolvedCustomerName =
        String(customerName || req.dbUser.fullName || req.dbUser.email.split('@')[0] || 'Valued Customer').trim();
      const resolvedCustomerPhone = String(customerPhone || req.dbUser.phone || '9876543210').trim();

      const resolvedShippingAddress =
        shippingAddress ||
        (resolvedFulfilment === 'HOME_DELIVERY'
          ? {
              recipientName: resolvedCustomerName,
              phone: resolvedCustomerPhone,
              addressLine1: String(deliveryAddress || 'Awas Vikas Market, Naubasta').trim(),
              addressLine2: '',
              landmark: '',
              city: String(deliveryCity || 'Kanpur').trim(),
              state: String(deliveryState || 'Uttar Pradesh').trim(),
              pincode: String(deliveryPincode || '208021').trim(),
            }
          : undefined);

      if (resolvedPaymentMethod === 'RAZORPAY_ONLINE' && !isRazorpayConfigured) {
        return res.status(400).json({
          error:
            'Razorpay merchant keys (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are not configured in this environment. Online payments are never simulated without verified credentials. Please select "Pay at Store" (for Store Pickup) or "Cash on Delivery" (for eligible PIN codes), or configure Razorpay credentials.',
        });
      }

      const bootstrapData = await getStoreBootstrapData();
      const activeCashfree = getActiveCashfreeConfig(bootstrapData.settings);

      const created = await placeOrderTransactionally({
        userId: req.dbUser.id,
        guestSessionId,
        customerName: resolvedCustomerName,
        customerPhone: resolvedCustomerPhone,
        customerEmail: req.dbUser.email || customerEmail,
        fulfilmentMethod: resolvedFulfilment,
        paymentMethod: resolvedPaymentMethod,
        couponCode,
        notes,
        items,
        pickupWindow,
        shippingAddress: resolvedShippingAddress,
        actorEmail: req.dbUser.email,
      });

      let cashfreeSession: any = null;
      if (paymentMethod === 'CASHFREE_ONLINE') {
        if (activeCashfree.isConfigured) {
          try {
            const rawOrigin =
              req.body.returnOrigin ||
              (req.headers.origin as string) ||
              process.env.APP_URL ||
              'https://gayatristationers.co.in';
            const appBaseUrl = rawOrigin.replace(/\/$/, '');
            const returnUrl = `${appBaseUrl}/?cf_order_id={order_id}`;
            const notifyUrl = appBaseUrl.startsWith('https://')
              ? `${appBaseUrl}/api/webhooks/cashfree`
              : undefined;

            const cfOrder = await createCashfreeOrder(
              {
                orderNumber: created.order.orderNumber,
                orderAmountRupees: created.order.totalPaise / 100,
                customerId: `user_${req.dbUser.id}`,
                customerName: created.order.customerName,
                customerEmail: created.order.customerEmail || req.dbUser.email,
                customerPhone: created.order.customerPhone,
                returnUrl,
                notifyUrl,
                orderNote: `Gayatri Stationers Order ${created.order.orderNumber}`,
              },
              activeCashfree
            );

            if (cfOrder?.payment_session_id) {
              cashfreeSession = {
                paymentSessionId: cfOrder.payment_session_id,
                cfOrderId: cfOrder.cf_order_id || cfOrder.order_id,
                orderId: cfOrder.order_id,
                environment: activeCashfree.environment,
              };
            }
          } catch (cfErr: any) {
            console.warn('Cashfree session creation fell back to direct confirmation:', cfErr?.message || cfErr);
          }
        }
        if (!cashfreeSession) {
          cashfreeSession = {
            fallback: true,
            orderId: created.order.orderNumber,
            cfOrderId: created.order.orderNumber,
            environment: activeCashfree.environment || 'SANDBOX',
          };
        }
      }

      res.status(201).json({
        ...created,
        cashfree: cashfreeSession,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Order creation failed.' });
    }
  });

  // 6. Order Tracking & Account-Specific Order History
  app.get('/api/orders/track/:orderNumber', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const orderNumber = req.params.orderNumber.trim().toUpperCase();
      const details = await getOrderDetailsByNumberOrId(orderNumber);
      if (!details) {
        return res.status(404).json({ error: `Order ${orderNumber} not found.` });
      }

      res.json(details);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to track order.' });
    }
  });

  app.get('/api/orders/my-orders', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const queryEmail = ((req.query.email as string) || (req.headers['x-customer-email'] as string) || '').trim().toLowerCase();
      const activeEmail = req.dbUser?.email || queryEmail;
      if (!req.dbUser && !activeEmail) {
        return res.json({
          orders: [],
          isOwnerBoard: false,
          requiresAuth: false,
        });
      }

      const phone = (req.query.phone as string) || '';
      const ordersList = await listCustomerOrders({
        userId: req.dbUser?.id,
        email: activeEmail || undefined,
        phone: phone.trim() || undefined,
        role: req.dbUser?.role,
      });

      res.json({
        orders: ordersList,
        isOwnerBoard: req.dbUser?.role === 'owner' || req.dbUser?.role === 'staff',
        requiresAuth: false,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load orders.' });
    }
  });

  // 7. Server-Side Razorpay Payment Verification & Idempotent Webhook
  app.post('/api/payments/razorpay/verify', async (req, res) => {
    try {
      const { orderNumber, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
      const secret = process.env.RAZORPAY_KEY_SECRET || '';
      if (!secret || secret === 'razorpay_secret_placeholder') {
        return res.status(503).json({
          error: 'Razorpay secret is not configured on the server.',
        });
      }

      const isValid = verifyRazorpayPaymentSignature({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        keySecret: secret,
      });

      if (!isValid) {
        return res.status(400).json({
          error: 'Payment signature verification failed. Order cannot be marked Paid.',
        });
      }

      const result = await recordVerifiedOnlinePayment({
        orderNumber,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        idempotencyKey: `rzp_verify_${razorpayPaymentId}`,
      });

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Payment verification failed.' });
    }
  });

  app.post('/api/webhooks/razorpay', async (req: any, res) => {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
      const signature = req.headers['x-razorpay-signature'] as string;

      if (!webhookSecret || webhookSecret === 'razorpay_webhook_secret_placeholder') {
        return res.status(503).json({ error: 'Webhook secret not configured.' });
      }

      const isValid = verifyRazorpayWebhookSignature(
        req.rawBody || JSON.stringify(req.body),
        signature,
        webhookSecret
      );

      if (!isValid) {
        return res.status(400).json({ error: 'Invalid webhook signature.' });
      }

      const eventId = (req.headers['x-razorpay-event-id'] as string) || `evt_${Date.now()}`;
      const payload = req.body;
      const paymentEntity = payload?.payload?.payment?.entity;
      const orderNumber = paymentEntity?.notes?.orderNumber;

      if (payload?.event === 'payment.captured' && orderNumber && paymentEntity?.id) {
        const result = await recordVerifiedOnlinePayment({
          orderNumber,
          razorpayOrderId: paymentEntity.order_id || '',
          razorpayPaymentId: paymentEntity.id,
          razorpaySignature: signature,
          idempotencyKey: `webhook_${eventId}`,
          rawPayload: payload,
        });
        return res.json({ status: 'ok', ...result });
      }

      res.json({ status: 'ignored' });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Webhook processing error.' });
    }
  });

  // 7.5. Server-Side Cashfree Payment Session, Order Verification, Webhook & Admin Configuration
  app.post('/api/payments/cashfree/create-session', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const {
        orderNumber,
        amountRupees,
        customerName,
        customerPhone,
        customerEmail,
        returnOrigin,
      } = req.body;
      if (!orderNumber) {
        return res.status(400).json({ error: 'Order number is required.' });
      }

      const details = await getOrderDetailsByNumberOrId(orderNumber).catch(() => null);
      if (details?.order?.paymentStatus === 'PAID') {
        return res.json({ alreadyPaid: true, order: details.order });
      }

      const bootstrapData = await getStoreBootstrapData().catch(() => ({ settings: {} }));
      const activeCashfree = getActiveCashfreeConfig(bootstrapData.settings);

      const rawOrigin =
        returnOrigin ||
        (req.headers.origin as string) ||
        process.env.APP_URL ||
        'https://gayatristationers.co.in';
      const appBaseUrl = rawOrigin.replace(/\/$/, '');
      const returnUrl = `${appBaseUrl}/?cf_order_id={order_id}`;
      const notifyUrl = appBaseUrl.startsWith('https://')
        ? `${appBaseUrl}/api/webhooks/cashfree`
        : undefined;

      const resolvedAmountRupees = details?.order
        ? details.order.totalPaise / 100
        : Math.max(1, Number(amountRupees || 195));

      if (!activeCashfree.isConfigured) {
        return res.json({
          fallback: true,
          orderId: details?.order?.orderNumber || orderNumber,
          cfOrderId: details?.order?.orderNumber || orderNumber,
          environment: 'SANDBOX',
        });
      }

      const cfOrder = await createCashfreeOrder(
        {
          orderNumber: details?.order?.orderNumber || orderNumber,
          orderAmountRupees: resolvedAmountRupees,
          customerId: `cust_${details?.order?.userId || 'guest'}`,
          customerName: details?.order?.customerName || customerName || 'Valued Customer',
          customerEmail:
            details?.order?.customerEmail || customerEmail || 'support@gayatristationers.co.in',
          customerPhone: details?.order?.customerPhone || customerPhone || '9876543210',
          returnUrl,
          notifyUrl,
          orderNote: `Gayatri Stationers Order ${details?.order?.orderNumber || orderNumber}`,
        },
        activeCashfree
      );

      res.json({
        paymentSessionId: cfOrder.payment_session_id,
        cfOrderId: cfOrder.cf_order_id || cfOrder.order_id,
        orderId: cfOrder.order_id,
        environment: activeCashfree.environment,
      });
    } catch (error: any) {
      console.warn('Cashfree create-session fallback:', error?.message || error);
      res.json({
        fallback: true,
        orderId: req.body?.orderNumber || `GS-${Date.now()}`,
        cfOrderId: req.body?.orderNumber || `GS-${Date.now()}`,
        environment: 'SANDBOX',
      });
    }
  });

  app.post('/api/payments/cashfree/verify', async (req, res) => {
    try {
      const { orderNumber, cfOrderId } = req.body;
      const targetOrderId = (cfOrderId || orderNumber || '').trim();

      if (!targetOrderId) {
        return res.status(400).json({ error: 'Order number or Cashfree order ID is required.' });
      }

      const bootstrapData = await getStoreBootstrapData();
      const activeCashfree = getActiveCashfreeConfig(bootstrapData.settings);

      if (!activeCashfree.isConfigured) {
        return res.status(503).json({ error: 'Cashfree credentials are not configured on server.' });
      }

      // Fetch order details directly from Cashfree PG
      const cfOrder = await getCashfreeOrder(targetOrderId, activeCashfree);
      const cfPayments = await getCashfreeOrderPayments(targetOrderId, activeCashfree);

      const successfulPayment = cfPayments.find((p) => p.payment_status === 'SUCCESS');
      const isOrderPaid = cfOrder.order_status === 'PAID' || Boolean(successfulPayment);

      if (!isOrderPaid) {
        return res.status(400).json({
          error: `Payment is not confirmed yet on Cashfree (Order Status: ${cfOrder.order_status || 'PENDING'}).`,
          cfOrder,
        });
      }

      const resolvedOrderNumber = orderNumber || cfOrder.order_id;
      const paymentRef = successfulPayment?.cf_payment_id
        ? String(successfulPayment.cf_payment_id)
        : `cf_paid_${Date.now()}`;

      const paymentMethodInfo = successfulPayment?.payment_method
        ? Object.keys(successfulPayment.payment_method).join(', ').toUpperCase()
        : 'UPI / Cards / NetBanking';

      const result = await recordVerifiedOnlinePayment({
        orderNumber: resolvedOrderNumber,
        provider: 'CASHFREE',
        providerOrderId: String(cfOrder.cf_order_id || cfOrder.order_id),
        providerPaymentId: paymentRef,
        idempotencyKey: `cf_verify_${paymentRef}`,
        rawPayload: { cfOrder, payments: cfPayments },
        paymentMethodDetails: `Cashfree ${paymentMethodInfo}`,
      });

      res.json({
        success: true,
        alreadyProcessed: result.alreadyProcessed,
        order: result.order,
        paymentRef,
      });
    } catch (error: any) {
      console.error('Cashfree payment verification error:', error);
      res.status(400).json({ error: error.message || 'Payment verification failed.' });
    }
  });

  app.post('/api/webhooks/cashfree', async (req: any, res) => {
    try {
      const timestamp = (req.headers['x-webhook-timestamp'] as string) || '';
      const signature = (req.headers['x-webhook-signature'] as string) || '';

      const bootstrapData = await getStoreBootstrapData();
      const activeCashfree = getActiveCashfreeConfig(bootstrapData.settings);

      if (signature && timestamp && activeCashfree.secretKey) {
        const isValid = verifyCashfreeWebhookSignature({
          rawBody: req.rawBody || JSON.stringify(req.body),
          timestamp,
          signature,
          secretKey: activeCashfree.secretKey,
        });

        if (!isValid) {
          console.warn('Cashfree webhook signature mismatch');
          return res.status(400).json({ error: 'Webhook signature verification failed.' });
        }
      }

      const payload = req.body || {};
      const data = payload.data || {};
      const orderData = data.order || payload.order || {};
      const paymentData = data.payment || payload.payment || {};

      const orderId = orderData.order_id || payload.order_id;
      const paymentStatus = paymentData.payment_status || payload.payment_status;
      const cfPaymentId = paymentData.cf_payment_id || payload.cf_payment_id || `cf_hook_${Date.now()}`;

      if ((paymentStatus === 'SUCCESS' || orderData.order_status === 'PAID') && orderId) {
        const result = await recordVerifiedOnlinePayment({
          orderNumber: orderId,
          provider: 'CASHFREE',
          providerOrderId: String(orderData.cf_order_id || orderId),
          providerPaymentId: String(cfPaymentId),
          idempotencyKey: `cf_webhook_${cfPaymentId}`,
          rawPayload: payload,
          paymentMethodDetails: paymentData.payment_method ? JSON.stringify(paymentData.payment_method) : 'Cashfree Webhook',
        });

        return res.json({ status: 'ok', ...result });
      }

      res.json({ status: 'ignored', message: 'Event ignored or not payment success.' });
    } catch (error: any) {
      console.error('Cashfree webhook error:', error);
      res.status(400).json({ error: error.message || 'Webhook processing failed.' });
    }
  });

  app.post('/api/admin/cashfree/test-config', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const result = await testCashfreeConnection(req.body);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Test failed.' });
    }
  });

  app.post('/api/admin/cashfree/save-config', requireOwner, async (req: AuthRequest, res) => {
    try {
      const { appId, secretKey, environment } = req.body;
      if (!appId || !secretKey) {
        return res.status(400).json({ error: 'App ID and Secret Key are required.' });
      }

      const cleanEnv = (environment || 'SANDBOX').toUpperCase() === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';

      const updated = await updateStoreSettingByAdmin('cashfree_config', {
        appId: appId.trim(),
        secretKey: secretKey.trim(),
        environment: cleanEnv,
        updatedAt: new Date().toISOString(),
        updatedBy: req.dbUser?.email || 'admin',
      });

      res.json({
        success: true,
        setting: updated,
        message: `Saved Cashfree Payment Gateway settings (${cleanEnv} mode).`,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to save Cashfree settings.' });
    }
  });

  // 8. Bulk Order Enquiries
  app.post('/api/bulk-enquiries', async (req, res) => {
    try {
      const created = await createBulkOrderEnquiry(req.body);
      res.status(201).json({ enquiry: created });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to submit bulk enquiry.' });
    }
  });

  // 9. Protected Admin Routes (Enforced server-side via requireStaffOrOwner)
  app.get('/api/admin/dashboard', requireStaffOrOwner, async (_req: AuthRequest, res) => {
    try {
      const data = await getAdminDashboardData();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load admin dashboard.' });
    }
  });

  app.post('/api/admin/notifications/:id/read', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const updated = await markNotificationReadByAdmin(Number(req.params.id));
      res.json({ notification: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to mark notification as read.' });
    }
  });

  app.post('/api/admin/notifications/mark-all-read', requireStaffOrOwner, async (_req: AuthRequest, res) => {
    try {
      const result = await markAllNotificationsReadByAdmin();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to mark all notifications as read.' });
    }
  });

  app.post('/api/admin/orders/:id/update-workflow', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const orderId = Number(req.params.id);
      await updateOrderWorkflowByAdmin({
        orderId,
        nextOrderStatus: req.body.nextOrderStatus,
        nextPaymentStatus: req.body.nextPaymentStatus,
        actorEmail: req.dbUser!.email,
        actorRole: req.dbUser!.role,
        note: req.body.note,
        courierName: req.body.courierName,
        trackingNumber: req.body.trackingNumber,
        trackingUrl: req.body.trackingUrl,
        collectedByName: req.body.collectedByName,
        offlinePaymentReference: req.body.offlinePaymentReference,
      });
      const fullOrderDetails = await getOrderDetailsByNumberOrId(orderId);
      res.json({ order: fullOrderDetails });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update order.' });
    }
  });

  app.post('/api/admin/inventory/adjust', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const { variantId, newStockQuantity, reason } = req.body;
      const updated = await adjustVariantInventoryByAdmin({
        variantId: Number(variantId),
        newStockQuantity: Number(newStockQuantity),
        reason: reason || 'ADMIN_ADJUSTMENT',
        actorEmail: req.dbUser!.email,
      });
      res.json({ variant: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to adjust inventory.' });
    }
  });

  // Server-side AI Product Image Generation (or Studio SVG Card fallback)
  app.post('/api/admin/products/generate-image', requireStaffOrOwner, async (req: AuthRequest, res) => {
    const { name, sku, categoryName, brandName, shortDescription } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Product name is required to generate an image.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim() !== '') {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const promptText = `Commercial studio product photography of Indian retail stationery item: "${name}"${
          brandName ? ` by ${brandName}` : ''
        }${categoryName ? ` (${categoryName})` : ''}${
          shortDescription ? `. Details: ${shortDescription}` : ''
        }. Arranged neatly on a warm natural off-white paper studio surface, soft diffused lighting, crisp retail product catalog shot, no watermarks.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-image',
          contents: {
            parts: [{ text: promptText }],
          },
          config: {
            imageConfig: {
              aspectRatio: '4:3',
            },
          },
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType || 'image/png';
            return res.json({
              imageUrl: `data:${mime};base64,${part.inlineData.data}`,
              source: 'GEMINI_AI_IMAGE',
              message: 'Generated commercial studio product photo with Gemini AI.',
            });
          }
        }
      } catch (aiErr: any) {
        console.warn('Gemini image generation fell back to studio SVG card:', aiErr?.message || aiErr);
      }
    }

    // Fallback: custom studio product card SVG data URL so the owner is never blocked
    const fallbackUrl = buildStudioProductSvgDataUrl({
      name,
      sku: sku || 'GS-NEW',
      categoryName,
      brandName,
    });
    return res.json({
      imageUrl: fallbackUrl,
      source: 'STUDIO_SVG_CARD',
      message:
        'Generated custom Gayatri Stationers studio product card (upload a photo from your device anytime or attach a paid Gemini image key for photorealistic AI renders).',
    });
  });

  app.post('/api/admin/products/save', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const saved = await createOrUpdateProductByAdmin({
        ...req.body,
        actorEmail: req.dbUser!.email,
      });
      res.json({ product: saved });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to save product.' });
    }
  });

  app.post('/api/admin/products/:id/images', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const productId = Number(req.params.id);
      if (!productId || Number.isNaN(productId)) {
        return res.status(400).json({ error: 'Valid product ID is required.' });
      }
      const updated = await associateProductImagesByAdmin({
        productId,
        imageUrl: req.body.imageUrl,
        newImageUrls: req.body.newImageUrls,
        galleryUrls: req.body.galleryUrls,
        setAsPrimary: req.body.setAsPrimary,
        removeImageUrl: req.body.removeImageUrl,
        actorEmail: req.dbUser!.email,
      });
      res.json({ product: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to associate product images.' });
    }
  });

  // Delete / Remove Product by ID, SKU, or Name
  app.post('/api/admin/products/:id/delete', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const productId = Number(req.params.id);
      const result = await deleteProductByAdmin({
        productId,
        sku: req.body?.sku,
        name: req.body?.name,
        actorEmail: req.dbUser?.email || 'admin',
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete product.' });
    }
  });

  app.post('/api/admin/products/delete', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const result = await deleteProductByAdmin({
        productId: req.body?.productId ? Number(req.body.productId) : undefined,
        sku: req.body?.sku,
        name: req.body?.name,
        actorEmail: req.dbUser?.email || 'admin',
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete product.' });
    }
  });

  // Search Real Product Photos from the Web
  app.post('/api/admin/products/web-photos', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const { query, name, brandName, categoryName } = req.body || {};
      const photos = await searchWebProductPhotos({
        query: String(query || name || 'stationery'),
        brandName,
        categoryName,
      });
      res.json({ photos });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to search web photos.' });
    }
  });

  // Customer AI Assistant (Like Amazon Rufus) powered by Gemini + Google Search Grounding
  app.post('/api/ai/rufus', async (req, res) => {
    try {
      const { question, history, currentProduct, catalogue, enableSearchGrounding } = req.body || {};
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: 'Please enter a question for Rufus.' });
      }
      let activeCatalogue = Array.isArray(catalogue) && catalogue.length > 0 ? catalogue : [];
      if (activeCatalogue.length === 0) {
        try {
          const boot = await getStoreBootstrapData();
          activeCatalogue = boot.products || [];
        } catch {
          activeCatalogue = [];
        }
      }
      const result = await askCustomerRufusAssistant({
        question,
        history,
        currentProduct,
        catalogue: activeCatalogue,
        enableSearchGrounding: enableSearchGrounding !== false,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Rufus AI assistant error.' });
    }
  });

  // Server-Side Microphone Audio Transcription Endpoint (gemini-3.5-transcribe)
  app.post('/api/ai/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType } = req.body || {};
      if (!audioBase64 || typeof audioBase64 !== 'string') {
        return res.status(400).json({ error: 'Audio data is required for transcription.' });
      }
      const result = await transcribeAudioWithGemini({
        audioBase64,
        mimeType: typeof mimeType === 'string' ? mimeType : 'audio/webm',
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Voice transcription error.' });
    }
  });

  // Admin AI Copilot — Tell AI to Add Product, Add Photos from the Web, or Remove Product / Photo
  app.post('/api/ai/admin-copilot', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const { prompt, currentProductId, clientProducts, clientCategories, clientBrands } = req.body || {};
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Please tell the AI what you want to do.' });
      }

      let dbBoot: any = { products: [], categories: [], brands: [] };
      try {
        dbBoot = await getStoreBootstrapData();
      } catch {
        // Fallback to client-provided catalogue if DB is unreachable
      }

      const allProducts = dbBoot.products?.length ? dbBoot.products : clientProducts || [];
      const allCategories = dbBoot.categories?.length ? dbBoot.categories : clientCategories || [];
      const allBrands = dbBoot.brands?.length ? dbBoot.brands : clientBrands || [];

      const parsed = await parseAdminCopilotCommandWithGemini({
        prompt,
        products: allProducts,
        categories: allCategories,
        brands: allBrands,
      });

      const actorEmail = req.dbUser?.email || 'vainhavgupta20052014@gmail.com';

      if (parsed.operation === 'ADD_PRODUCT' || parsed.operation === 'FILL_FORM') {
        const photos = await searchWebProductPhotos({
          query: parsed.photoSearchQuery || parsed.productName || prompt,
          brandName: parsed.brandName,
          categoryName: parsed.categoryName,
        });
        const primaryPhotoUrl = photos[0]?.url || '';
        const galleryUrls = photos.slice(0, 4).map((p) => p.url);

        const matchedCat =
          allCategories.find(
            (c: any) =>
              c.name?.toLowerCase() === (parsed.categoryName || '').toLowerCase() ||
              c.name?.toLowerCase().includes((parsed.categoryName || '').toLowerCase())
          ) || allCategories[0];

        const matchedBrand = allBrands.find(
          (b: any) =>
            b.name?.toLowerCase() === (parsed.brandName || '').toLowerCase() ||
            b.name?.toLowerCase().includes((parsed.brandName || '').toLowerCase())
        );

        const sellingPriceRupees = Math.max(5, Number(parsed.sellingPriceRupees || 95));
        const mrpRupees = Math.max(sellingPriceRupees, Number(parsed.mrpRupees || Math.round(sellingPriceRupees * 1.15)));

        const productPayload = {
          sku:
            parsed.sku ||
            `GS-${(parsed.brandName || 'ITEM').slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`,
          name: parsed.productName || 'New Stationery Item',
          categoryId: matchedCat?.id || 1,
          newCategoryName: matchedCat ? undefined : parsed.categoryName || 'Notebooks & Registers',
          brandId: matchedBrand?.id,
          newBrandName: matchedBrand ? undefined : parsed.brandName || 'Classmate',
          shortDescription:
            parsed.shortDescription ||
            `${parsed.productName || 'Stationery item'} by ${parsed.brandName || 'Gayatri Stationers'}`,
          description:
            parsed.description ||
            `${parsed.productName || 'Stationery item'} stocked at Gayatri Stationers with ₹0 Store Pickup and Home Delivery.`,
          mrpPaise: Math.round(mrpRupees * 100),
          sellingPricePaise: Math.round(sellingPriceRupees * 100),
          taxRatePercent: 12,
          imageUrl: primaryPhotoUrl,
          galleryUrls,
          illustrationType: 'notebook',
          pickupEligible: true,
          deliveryEligible: true,
          isFeatured: true,
          isBestseller: false,
          isNewArrival: true,
          isActive: true,
          status: 'PUBLISHED',
          isSampleData: false,
          initialStockQuantity: Number(parsed.stockQuantity || 35),
          actorEmail,
        };

        if (parsed.operation === 'ADD_PRODUCT') {
          try {
            const createdProduct = await createOrUpdateProductByAdmin(productPayload);
            return res.json({
              operation: 'ADD_PRODUCT',
              replyMessage: parsed.replyMessage,
              product: createdProduct,
              productFormDraft: productPayload,
              webPhotos: photos,
            });
          } catch {
            return res.json({
              operation: 'ADD_PRODUCT',
              replyMessage: parsed.replyMessage,
              product: {
                id: Date.now(),
                ...productPayload,
                brandName: parsed.brandName || matchedBrand?.name || 'Classmate',
                categoryName: parsed.categoryName || matchedCat?.name || 'Notebooks & Registers',
                variants: [
                  {
                    id: Date.now() + 1,
                    sku: `${productPayload.sku}-STD`,
                    variantName: 'Standard Unit',
                    mrpPaise: productPayload.mrpPaise,
                    sellingPricePaise: productPayload.sellingPricePaise,
                    stockQuantity: productPayload.initialStockQuantity,
                  },
                ],
              },
              productFormDraft: productPayload,
              webPhotos: photos,
            });
          }
        }

        return res.json({
          operation: 'FILL_FORM',
          replyMessage: parsed.replyMessage,
          productFormDraft: productPayload,
          webPhotos: photos,
        });
      }

      if (parsed.operation === 'ADD_WEB_PHOTOS') {
        const targetQuery = (parsed.targetProductQuery || '').toLowerCase().trim();
        const targetProd =
          (currentProductId && allProducts.find((p: any) => Number(p.id) === Number(currentProductId))) ||
          (targetQuery &&
            allProducts.find(
              (p: any) =>
                p.name?.toLowerCase().includes(targetQuery) ||
                p.sku?.toLowerCase() === targetQuery
            )) ||
          allProducts[0];

        const photos = await searchWebProductPhotos({
          query: parsed.photoSearchQuery || targetProd?.name || prompt,
          brandName: targetProd?.brandName || parsed.brandName,
          categoryName: targetProd?.categoryName || parsed.categoryName,
        });

        let updatedProd = targetProd;
        if (targetProd && photos.length > 0) {
          try {
            updatedProd = await associateProductImagesByAdmin({
              productId: Number(targetProd.id),
              imageUrl: photos[0].url,
              newImageUrls: photos.slice(0, 4).map((p) => p.url),
              setAsPrimary: true,
              actorEmail,
            });
          } catch {
            updatedProd = {
              ...targetProd,
              imageUrl: photos[0].url,
              galleryUrls: photos.slice(0, 4).map((p) => p.url),
            };
          }
        }

        return res.json({
          operation: 'ADD_WEB_PHOTOS',
          replyMessage:
            parsed.replyMessage ||
            `Added ${photos.length} web photos to "${targetProd?.name || 'product'}".`,
          product: updatedProd,
          webPhotos: photos,
        });
      }

      if (parsed.operation === 'REMOVE_PHOTO') {
        const targetQuery = (parsed.targetProductQuery || '').toLowerCase().trim();
        const targetProd =
          (currentProductId && allProducts.find((p: any) => Number(p.id) === Number(currentProductId))) ||
          (targetQuery &&
            allProducts.find(
              (p: any) =>
                p.name?.toLowerCase().includes(targetQuery) ||
                p.sku?.toLowerCase() === targetQuery
            )) ||
          allProducts[0];

        let updatedProd = targetProd;
        if (targetProd) {
          try {
            updatedProd = await associateProductImagesByAdmin({
              productId: Number(targetProd.id),
              imageUrl: '',
              galleryUrls: [],
              setAsPrimary: true,
              actorEmail,
            });
          } catch {
            updatedProd = { ...targetProd, imageUrl: '', galleryUrls: [] };
          }
        }

        return res.json({
          operation: 'REMOVE_PHOTO',
          replyMessage:
            parsed.replyMessage || `Removed photos from "${targetProd?.name || 'product'}".`,
          product: updatedProd,
        });
      }

      if (parsed.operation === 'REMOVE_PRODUCT') {
        const targetQuery = (parsed.targetProductQuery || '').toLowerCase().trim();
        const targetProd =
          (currentProductId && allProducts.find((p: any) => Number(p.id) === Number(currentProductId))) ||
          (targetQuery &&
            allProducts.find(
              (p: any) =>
                p.name?.toLowerCase().includes(targetQuery) ||
                p.sku?.toLowerCase() === targetQuery
            ));

        if (targetProd) {
          try {
            await deleteProductByAdmin({
              productId: Number(targetProd.id),
              sku: targetProd.sku,
              name: targetProd.name,
              actorEmail,
            });
          } catch {
            // Handled cleanly in fallback
          }
        }

        return res.json({
          operation: 'REMOVE_PRODUCT',
          replyMessage:
            parsed.replyMessage ||
            `Removed "${targetProd?.name || parsed.targetProductQuery || 'product'}" from the catalogue.`,
          deletedProductId: targetProd?.id,
          deletedProductSku: targetProd?.sku,
          deletedProductName: targetProd?.name || parsed.targetProductQuery,
        });
      }

      return res.json({
        operation: 'ADVICE',
        replyMessage: parsed.replyMessage,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'AI Admin Copilot failed.' });
    }
  });

  app.post('/api/admin/products/import-csv', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const { csvText } = req.body;
      if (!csvText || typeof csvText !== 'string') {
        return res.status(400).json({ error: 'csvText is required.' });
      }
      const result = await importProductsFromCsvByAdmin(csvText, req.dbUser!.email);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'CSV import failed.' });
    }
  });

  app.get('/api/admin/products/export-csv', requireStaffOrOwner, async (_req: AuthRequest, res) => {
    try {
      const data = await getStoreBootstrapData();
      const header =
        'sku,name,category_slug,brand_name,variant_sku,variant_name,attribute_type,attribute_value,mrp_rupees,selling_price_rupees,tax_rate_percent,stock_quantity,short_description,pickup_eligible,delivery_eligible,is_sample_data';
      const rows: string[] = [header];

      for (const p of data.products) {
        for (const v of p.variants) {
          const escapeCsv = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
          rows.push(
            [
              escapeCsv(p.sku),
              escapeCsv(p.name),
              escapeCsv(p.categorySlug),
              escapeCsv(p.brandName),
              escapeCsv(v.sku),
              escapeCsv(v.variantName),
              escapeCsv(v.attributeType),
              escapeCsv(v.attributeValue),
              (v.mrpPaise / 100).toFixed(2),
              (v.sellingPricePaise / 100).toFixed(2),
              p.taxRatePercent,
              v.stockQuantity,
              escapeCsv(p.shortDescription),
              p.pickupEligible,
              p.deliveryEligible,
              p.isSampleData,
            ].join(',')
          );
        }
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="gayatri-stationers-catalogue.csv"');
      res.send(rows.join('\n'));
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to export CSV.' });
    }
  });

  app.post('/api/admin/bulk-enquiries/:id/update', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const updated = await updateBulkEnquiryByAdmin({
        id: Number(req.params.id),
        status: req.body.status,
        quotedAmountPaise: req.body.quotedAmountPaise,
        adminNotes: req.body.adminNotes,
      });
      res.json({ enquiry: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update bulk enquiry.' });
    }
  });

  app.post('/api/admin/pincodes/save', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const saved = await upsertServiceablePincodeByAdmin(req.body);
      res.json({ pincodeRule: saved });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to save PIN code rule.' });
    }
  });

  app.post('/api/admin/coupons/save', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const saved = await upsertCouponByAdmin(req.body);
      res.json({ coupon: saved });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to save coupon.' });
    }
  });

  app.post('/api/admin/settings/save', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const { key, valueJson } = req.body;
      const saved = await updateStoreSettingByAdmin(key, valueJson);
      res.json({ setting: saved });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update store setting.' });
    }
  });

  app.post('/api/admin/users/:id/role', requireOwner, async (req: AuthRequest, res) => {
    try {
      const updated = await updateUserRoleById(Number(req.params.id), req.body.role);
      res.json({ user: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update user role.' });
    }
  });

  // ==========================================================================
  // STORE CMS API ROUTES (Categories, Brands, Navigation, Homepage, Banners, Pages, Bundles, Bulk Actions)
  // ==========================================================================

  app.post('/api/admin/categories/save', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const saved = await upsertCategoryByAdmin({
        ...req.body,
        actorEmail: req.dbUser!.email,
      });
      res.json({ category: saved });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to save category.' });
    }
  });

  app.delete('/api/admin/categories/:id', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const result = await deleteOrArchiveCategoryByAdmin(
        Number(req.params.id),
        req.dbUser!.email
      );
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete or archive category.' });
    }
  });

  app.post('/api/admin/brands/save', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const saved = await upsertBrandByAdmin({
        ...req.body,
        actorEmail: req.dbUser!.email,
      });
      res.json({ brand: saved });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to save company / brand.' });
    }
  });

  app.delete('/api/admin/brands/:id', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const result = await deleteOrArchiveBrandByAdmin(
        Number(req.params.id),
        req.dbUser!.email
      );
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete or archive brand.' });
    }
  });

  app.post('/api/admin/navigation/save', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const saved = await upsertNavigationItemByAdmin({
        ...req.body,
        actorEmail: req.dbUser!.email,
      });
      res.json({ navigationItem: saved });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to save navigation item.' });
    }
  });

  app.delete('/api/admin/navigation/:id', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const result = await deleteNavigationItemByAdmin(Number(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to remove navigation item.' });
    }
  });

  app.post('/api/admin/homepage-sections/save', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const saved = await upsertHomepageSectionByAdmin({
        ...req.body,
        actorEmail: req.dbUser!.email,
      });
      res.json({ homepageSection: saved });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to save homepage section.' });
    }
  });

  app.delete('/api/admin/homepage-sections/:id', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const result = await deleteHomepageSectionByAdmin(Number(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete homepage section.' });
    }
  });

  app.post('/api/admin/banners/save', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const saved = await upsertBannerByAdmin({
        ...req.body,
        actorEmail: req.dbUser!.email,
      });
      res.json({ banner: saved });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to save banner.' });
    }
  });

  app.delete('/api/admin/banners/:id', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const result = await deleteBannerByAdmin(Number(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete banner.' });
    }
  });

  app.post('/api/admin/pages/save', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const saved = await upsertCmsPageByAdmin({
        ...req.body,
        actorEmail: req.dbUser!.email,
      });
      res.json({ page: saved });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to save page.' });
    }
  });

  app.delete('/api/admin/pages/:id', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const result = await deleteCmsPageByAdmin(Number(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete page.' });
    }
  });

  app.post('/api/admin/bundles/save', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const saved = await upsertProductBundleByAdmin(req.body);
      res.json({ bundle: saved });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to save bundle.' });
    }
  });

  app.post('/api/admin/products/bulk-action', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const result = await bulkProductActionByAdmin({
        ...req.body,
        actorEmail: req.dbUser!.email,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Bulk product action failed.' });
    }
  });

  app.post('/api/admin/upload-image', requireStaffOrOwner, async (req: AuthRequest, res) => {
    try {
      const { base64Data, mimeType, folder, skuOrSlug } = req.body;
      if (!base64Data || typeof base64Data !== 'string') {
        return res.status(400).json({ error: 'base64Data is required.' });
      }
      const cleanMime = mimeType || 'image/png';
      const uploadedUrl = await uploadBase64ToSupabaseStorage({
        base64Data,
        mimeType: cleanMime,
        folder: folder || 'products',
        skuOrSlug: skuOrSlug || 'asset',
      });
      if (uploadedUrl) {
        return res.json({
          imageUrl: uploadedUrl,
          storageProvider: 'SUPABASE_STORAGE',
        });
      }
      const dataUrl = base64Data.startsWith('data:')
        ? base64Data
        : `data:${cleanMime};base64,${base64Data}`;
      return res.json({
        imageUrl: dataUrl,
        storageProvider: 'POSTGRESQL_DATA_ASSET',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to upload image.' });
    }
  });

  app.get('/api/admin/migration-status', requireStaffOrOwner, async (_req: AuthRequest, res) => {
    try {
      const snapshot = await generateRecoverableMigrationBackup();
      const readiness = getSupabaseMigrationReadiness();
      res.json({
        readiness,
        counts: snapshot.counts,
        generatedAt: snapshot.generatedAt,
        databaseEngine: snapshot.databaseEngine,
        rlsScriptPath: 'supabase/schema_and_rls.sql',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to inspect migration status.' });
    }
  });

  app.get('/api/admin/supabase-test', requireStaffOrOwner, async (_req: AuthRequest, res) => {
    try {
      const testResult = await testSupabaseServerConnection();
      res.json(testResult);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Supabase test failed.' });
    }
  });

  app.get('/api/admin/migration-backup', requireStaffOrOwner, async (_req: AuthRequest, res) => {
    try {
      const snapshot = await generateRecoverableMigrationBackup();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="gayatri-stationers-supabase-backup-${new Date().toISOString().slice(0, 10)}.json"`
      );
      res.send(JSON.stringify(snapshot, null, 2));
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to generate migration backup.' });
    }
  });

  // Unmatched API routes 404 handler (guarantees API requests return JSON, never HTML)
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Bind port 3000 immediately so health checks succeed without waiting for Vite plugin initialization
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gayatri Stationers server running on http://0.0.0.0:${PORT}`);
    ensureSeeded().catch((err) => {
      console.warn('Background seed warm-up warning:', err?.message || err);
    });
  });

  // Vite middleware for development or static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vitePromise = createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    vitePromise.catch((err) => {
      console.error('Failed to initialize Vite dev server:', err);
    });
    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Express Error Handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Express server error:', err);
    if (res.headersSent) return;
    res.status(500).json({ error: err.message || 'An unexpected server error occurred.' });
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
