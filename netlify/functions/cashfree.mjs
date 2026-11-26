const DEFAULT_SANDBOX_APP_ID = 'TEST109386008d393f8344acfd7f332b00683901';
const DEFAULT_SANDBOX_SECRET = 'cfsk_ma_test_95c8c9ca404d7f56cc76f146247fe886_e2ef4f0c';

function sanitizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length > 10) return digits.slice(-10);
  return '9876543210';
}

function sanitizeId(id, fallback) {
  const cleaned = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 45);
  return cleaned || fallback;
}

async function safeParseJson(res) {
  try {
    const text = await res.text();
    const trimmed = (text || '').trim();
    if (!trimmed || trimmed.startsWith('<')) {
      return {};
    }
    return JSON.parse(trimmed);
  } catch {
    return {};
  }
}

export const handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-customer-email',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  try {
    const path = (event.path || '').toLowerCase();
    let body = {};
    if (event.body && typeof event.body === 'string') {
      const trimmedBody = event.body.trim();
      if (trimmedBody && !trimmedBody.startsWith('<')) {
        try {
          body = JSON.parse(trimmedBody);
        } catch {
          body = {};
        }
      }
    }

    const appId = (
      body.appId ||
      process.env.CASHFREE_APP_ID ||
      process.env.CASHFREE_CLIENT_ID ||
      DEFAULT_SANDBOX_APP_ID
    ).trim();

    const secretKey = (
      body.secretKey ||
      process.env.CASHFREE_SECRET_KEY ||
      process.env.CASHFREE_CLIENT_SECRET ||
      DEFAULT_SANDBOX_SECRET
    ).trim();

    const rawEnv = (
      body.environment ||
      process.env.CASHFREE_ENVIRONMENT ||
      (appId.startsWith('TEST') ? 'SANDBOX' : 'PRODUCTION')
    )
      .trim()
      .toUpperCase();

    const environment = rawEnv === 'PRODUCTION' || rawEnv === 'PROD' ? 'PRODUCTION' : 'SANDBOX';
    const baseUrl =
      environment === 'PRODUCTION'
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg';
    const apiVersion = '2023-08-01';

    // 1. Test Connection
    if (path.endsWith('/test') || path.endsWith('/test-config')) {
      const testId = `test_ping_${Date.now()}`;
      const res = await fetch(`${baseUrl}/orders/${testId}`, {
        method: 'GET',
        headers: {
          'x-client-id': appId,
          'x-client-secret': secretKey,
          'x-api-version': apiVersion,
          'Content-Type': 'application/json',
        },
      });
      const data = await safeParseJson(res);
      const ok = res.status === 404 || res.status === 200;
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: ok,
          message: ok
            ? `Successfully connected to Cashfree ${environment} Payment Gateway.`
            : data?.message || `Cashfree returned status ${res.status}`,
          environment,
          appIdMasked: `${appId.slice(0, 4)}...${appId.slice(-4)}`,
        }),
      };
    }

    // 2. Verify Order Payment
    if (path.endsWith('/verify')) {
      const targetOrderId = sanitizeId(body.cfOrderId || body.orderNumber, '');
      if (!targetOrderId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Order ID is required for verification.' }),
        };
      }

      const [orderRes, paymentsRes] = await Promise.all([
        fetch(`${baseUrl}/orders/${encodeURIComponent(targetOrderId)}`, {
          method: 'GET',
          headers: {
            'x-client-id': appId,
            'x-client-secret': secretKey,
            'x-api-version': apiVersion,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${baseUrl}/orders/${encodeURIComponent(targetOrderId)}/payments`, {
          method: 'GET',
          headers: {
            'x-client-id': appId,
            'x-client-secret': secretKey,
            'x-api-version': apiVersion,
            'Content-Type': 'application/json',
          },
        }),
      ]);

      const cfOrder = await safeParseJson(orderRes);
      const cfPaymentsRaw = await safeParseJson(paymentsRes);
      const cfPayments = Array.isArray(cfPaymentsRaw) ? cfPaymentsRaw : [];
      const successfulPayment = cfPayments.find((p) => p.payment_status === 'SUCCESS');
      const isOrderPaid = cfOrder?.order_status === 'PAID' || Boolean(successfulPayment);

      if (!isOrderPaid) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            error: `Payment is not confirmed yet on Cashfree (Status: ${cfOrder?.order_status || 'PENDING'}).`,
            cfOrder,
          }),
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          order: {
            orderNumber: body.orderNumber || cfOrder.order_id,
            paymentStatus: 'PAID',
            orderStatus: 'CONFIRMED',
            paymentMethod: 'CASHFREE_ONLINE',
          },
          paymentRef: successfulPayment?.cf_payment_id || `cf_${Date.now()}`,
        }),
      };
    }

    // 3. Create Cashfree Order Session (/create-session)
    const rawOrderNum = String(body.orderNumber || `GS-${Date.now().toString().slice(-6)}`);
    const cleanOrderId = sanitizeId(
      `${rawOrderNum}_${Date.now().toString().slice(-5)}`,
      `GS_${Date.now()}`
    );
    const amountRupees = Math.max(1, Number(body.amountRupees || 195));
    const returnOrigin = (body.returnOrigin || 'https://gayatristationers.netlify.app').replace(/\/$/, '');

    const payload = {
      order_id: cleanOrderId,
      order_amount: Number(amountRupees.toFixed(2)),
      order_currency: 'INR',
      customer_details: {
        customer_id: sanitizeId(body.customerId || 'cust_gayatri', 'cust_gayatri'),
        customer_name: String(body.customerName || 'Valued Customer').slice(0, 50),
        customer_email: String(body.customerEmail || 'support@gayatristationers.co.in'),
        customer_phone: sanitizePhone(body.customerPhone),
      },
      order_meta: {
        return_url: `${returnOrigin}/?cf_order_id={order_id}&order_num=${encodeURIComponent(rawOrderNum)}`,
      },
      order_note: `Gayatri Stationers Order ${rawOrderNum}`.slice(0, 150),
    };

    const cfRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'x-client-id': appId,
        'x-client-secret': secretKey,
        'x-api-version': apiVersion,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const cfData = await safeParseJson(cfRes);
    if (!cfRes.ok || !cfData?.payment_session_id) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: cfData?.message || 'Failed to create Cashfree payment session.',
        }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        paymentSessionId: cfData.payment_session_id,
        cfOrderId: cfData.order_id,
        orderId: rawOrderNum,
        environment,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Cashfree function error' }),
    };
  }
};
