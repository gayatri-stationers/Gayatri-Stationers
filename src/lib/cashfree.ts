import crypto from 'crypto';

export interface CashfreeConfig {
  isConfigured: boolean;
  appId: string;
  secretKey: string;
  environment: 'SANDBOX' | 'PRODUCTION';
  baseUrl: string;
  apiVersion: string;
}

export interface CreateCashfreeOrderParams {
  orderNumber: string;
  orderAmountRupees: number;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  returnUrl: string;
  notifyUrl?: string;
  orderNote?: string;
}

export interface CashfreeOrderResponse {
  cf_order_id?: string | number;
  order_id: string;
  order_amount: number;
  order_currency: string;
  order_status: string;
  payment_session_id?: string;
  order_expiry_time?: string;
  message?: string;
  code?: string;
  type?: string;
}

export interface CashfreePaymentItem {
  cf_payment_id?: string | number;
  payment_status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'CANCELLED' | 'USER_DROPPED' | string;
  payment_amount: number;
  payment_currency: string;
  payment_message?: string;
  payment_time?: string;
  payment_method?: Record<string, any>;
  bank_reference?: string;
}

/**
 * Normalizes customer phone number to 10-digit Indian mobile number format.
 */
export function sanitizeCashfreePhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length > 10) return digits.slice(-10);
  return digits.padEnd(10, '0');
}

/**
 * Sanitizes alphanumeric identifier for Cashfree customer and order IDs.
 */
export function sanitizeCashfreeIdentifier(id: string, fallback: string): string {
  const cleaned = (id || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 45);
  return cleaned || fallback;
}

/**
 * Resolves Cashfree configuration from environment variables or custom overrides.
 */
export function getCashfreeConfig(overrides?: {
  appId?: string;
  secretKey?: string;
  environment?: string;
  apiVersion?: string;
}): CashfreeConfig {
  const appId = (
    overrides?.appId ||
    process.env.CASHFREE_APP_ID ||
    process.env.CASHFREE_CLIENT_ID ||
    ''
  ).trim();

  const secretKey = (
    overrides?.secretKey ||
    process.env.CASHFREE_SECRET_KEY ||
    process.env.CASHFREE_CLIENT_SECRET ||
    ''
  ).trim();

  const rawEnv = (
    overrides?.environment ||
    process.env.CASHFREE_ENVIRONMENT ||
    'SANDBOX'
  )
    .trim()
    .toUpperCase();

  const environment: 'SANDBOX' | 'PRODUCTION' =
    rawEnv === 'PRODUCTION' || rawEnv === 'PROD' ? 'PRODUCTION' : 'SANDBOX';

  const baseUrl =
    environment === 'PRODUCTION'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';

  const apiVersion = (
    overrides?.apiVersion ||
    process.env.CASHFREE_API_VERSION ||
    '2023-08-01'
  ).trim();

  const isConfigured = Boolean(
    appId &&
      secretKey &&
      appId !== 'YOUR_CASHFREE_APP_ID' &&
      secretKey !== 'YOUR_CASHFREE_SECRET_KEY' &&
      !appId.includes('placeholder') &&
      !secretKey.includes('placeholder')
  );

  return {
    isConfigured,
    appId,
    secretKey,
    environment,
    baseUrl,
    apiVersion,
  };
}

/**
 * Masks App ID for safe public presentation (e.g. CF123...456).
 */
export function maskCashfreeAppId(appId: string): string {
  if (!appId) return '';
  if (appId.length <= 8) return '****';
  return `${appId.slice(0, 4)}...${appId.slice(-4)}`;
}

/**
 * Creates an order on Cashfree Payment Gateway and retrieves the payment_session_id.
 */
export async function createCashfreeOrder(
  params: CreateCashfreeOrderParams,
  customConfig?: CashfreeConfig
): Promise<CashfreeOrderResponse> {
  const config = customConfig || getCashfreeConfig();

  if (!config.isConfigured) {
    throw new Error(
      'Cashfree is not configured. Please provide CASHFREE_APP_ID and CASHFREE_SECRET_KEY in settings or environment.'
    );
  }

  const cleanPhone = sanitizeCashfreePhone(params.customerPhone);
  const cleanCustomerId = sanitizeCashfreeIdentifier(
    params.customerId,
    `cust_${Date.now()}`
  );
  const cleanOrderId = sanitizeCashfreeIdentifier(
    params.orderNumber,
    `GS_${Date.now()}`
  );

  const requestPayload = {
    order_id: cleanOrderId,
    order_amount: Number(params.orderAmountRupees.toFixed(2)),
    order_currency: 'INR',
    customer_details: {
      customer_id: cleanCustomerId,
      customer_name: params.customerName.slice(0, 50),
      customer_email: params.customerEmail || 'support@gayatristationers.com',
      customer_phone: cleanPhone,
    },
    order_meta: {
      return_url: params.returnUrl,
      notify_url: params.notifyUrl,
    },
    order_note: (params.orderNote || `Gayatri Stationers Order ${cleanOrderId}`).slice(0, 150),
  };

  const response = await fetch(`${config.baseUrl}/orders`, {
    method: 'POST',
    headers: {
      'x-client-id': config.appId,
      'x-client-secret': config.secretKey,
      'x-api-version': config.apiVersion,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestPayload),
  });

  const responseData: any = await response.json();

  if (!response.ok) {
    // If order with same ID already exists on Cashfree, fetch it or create a fresh attempt ID
    if (
      response.status === 409 ||
      responseData?.code === 'order_already_exists' ||
      String(responseData?.message || '').toLowerCase().includes('already present') ||
      String(responseData?.message || '').toLowerCase().includes('already exists')
    ) {
      try {
        const existingOrder = await getCashfreeOrder(cleanOrderId, config);
        if (existingOrder && existingOrder.order_status === 'ACTIVE' && existingOrder.payment_session_id) {
          return existingOrder;
        }
      } catch {
        // Fall through to retry with unique attempt suffix
      }

      const retryOrderId = sanitizeCashfreeIdentifier(
        `${cleanOrderId}_${Date.now().toString().slice(-5)}`,
        `GS_${Date.now()}`
      );
      const retryPayload = {
        ...requestPayload,
        order_id: retryOrderId,
      };
      const retryRes = await fetch(`${config.baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'x-client-id': config.appId,
          'x-client-secret': config.secretKey,
          'x-api-version': config.apiVersion,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(retryPayload),
      });
      const retryData: any = await retryRes.json();
      if (retryRes.ok && retryData?.payment_session_id) {
        return retryData as CashfreeOrderResponse;
      }
    }

    const errorMsg =
      responseData?.message ||
      responseData?.error ||
      `Cashfree Order API returned status ${response.status}`;
    console.error('Cashfree order creation error:', responseData);
    throw new Error(`Cashfree order creation failed: ${errorMsg}`);
  }

  return responseData as CashfreeOrderResponse;
}

/**
 * Retrieves the latest order details directly from Cashfree PG.
 */
export async function getCashfreeOrder(
  orderId: string,
  customConfig?: CashfreeConfig
): Promise<CashfreeOrderResponse> {
  const config = customConfig || getCashfreeConfig();
  if (!config.isConfigured) {
    throw new Error('Cashfree is not configured.');
  }

  const cleanOrderId = encodeURIComponent(orderId.trim());
  const response = await fetch(`${config.baseUrl}/orders/${cleanOrderId}`, {
    method: 'GET',
    headers: {
      'x-client-id': config.appId,
      'x-client-secret': config.secretKey,
      'x-api-version': config.apiVersion,
      'Content-Type': 'application/json',
    },
  });

  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || `Failed to fetch Cashfree order ${orderId}`);
  }

  return data as CashfreeOrderResponse;
}

/**
 * Retrieves all payment attempts and transactions associated with a Cashfree order.
 */
export async function getCashfreeOrderPayments(
  orderId: string,
  customConfig?: CashfreeConfig
): Promise<CashfreePaymentItem[]> {
  const config = customConfig || getCashfreeConfig();
  if (!config.isConfigured) {
    throw new Error('Cashfree is not configured.');
  }

  const cleanOrderId = encodeURIComponent(orderId.trim());
  const response = await fetch(`${config.baseUrl}/orders/${cleanOrderId}/payments`, {
    method: 'GET',
    headers: {
      'x-client-id': config.appId,
      'x-client-secret': config.secretKey,
      'x-api-version': config.apiVersion,
      'Content-Type': 'application/json',
    },
  });

  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || `Failed to fetch Cashfree payments for order ${orderId}`);
  }

  return Array.isArray(data) ? (data as CashfreePaymentItem[]) : [];
}

/**
 * Verifies webhook HMAC-SHA256 signature sent by Cashfree Payment Gateway.
 */
export function verifyCashfreeWebhookSignature(params: {
  rawBody: string;
  timestamp: string;
  signature: string;
  secretKey?: string;
}): boolean {
  const { rawBody, timestamp, signature } = params;
  const secret = params.secretKey || getCashfreeConfig().secretKey;

  if (!rawBody || !timestamp || !signature || !secret) {
    return false;
  }

  const payload = `${timestamp}${rawBody}`;
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64');

  try {
    const a = Buffer.from(computedSignature, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Tests connection with Cashfree PG by attempting an authenticated ping to the orders endpoint.
 */
export async function testCashfreeConnection(overrides?: {
  appId?: string;
  secretKey?: string;
  environment?: string;
}): Promise<{
  success: boolean;
  message: string;
  environment: string;
  appIdMasked: string;
}> {
  const config = getCashfreeConfig(overrides);
  if (!config.isConfigured) {
    return {
      success: false,
      message: 'App ID or Secret Key is missing or invalid.',
      environment: config.environment,
      appIdMasked: maskCashfreeAppId(config.appId),
    };
  }

  try {
    // Attempt to fetch a non-existent or test order to verify authentication credentials
    const testOrderId = `test_ping_${Date.now()}`;
    const response = await fetch(`${config.baseUrl}/orders/${testOrderId}`, {
      method: 'GET',
      headers: {
        'x-client-id': config.appId,
        'x-client-secret': config.secretKey,
        'x-api-version': config.apiVersion,
        'Content-Type': 'application/json',
      },
    });

    const data: any = await response.json();

    // If HTTP status is 404 (order not found), credentials were authenticated successfully!
    // If HTTP status is 401/403, credentials failed authentication.
    if (response.status === 404 || response.status === 200) {
      return {
        success: true,
        message: `Successfully connected to Cashfree ${config.environment} Payment Gateway.`,
        environment: config.environment,
        appIdMasked: maskCashfreeAppId(config.appId),
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        message: data?.message || 'Authentication failed. Please verify your App ID and Secret Key.',
        environment: config.environment,
        appIdMasked: maskCashfreeAppId(config.appId),
      };
    }

    return {
      success: false,
      message: data?.message || `Cashfree returned status code ${response.status}`,
      environment: config.environment,
      appIdMasked: maskCashfreeAppId(config.appId),
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Network error reaching Cashfree servers.',
      environment: config.environment,
      appIdMasked: maskCashfreeAppId(config.appId),
    };
  }
}
