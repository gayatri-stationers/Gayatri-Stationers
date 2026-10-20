// Isomorphic domain logic for Gayatri Stationers (Browser & Server)

export type DiscountType = 'PERCENTAGE' | 'FLAT_PAISE';
export type FulfilmentMethod = 'STORE_PICKUP' | 'HOME_DELIVERY';
export type PaymentMethod = 'CASHFREE_ONLINE' | 'RAZORPAY_ONLINE' | 'PAY_AT_STORE' | 'COD';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUND_REQUESTED' | 'REFUNDED';

export type OrderStatus =
  | 'ORDER_PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'COLLECTED'
  | 'PROCESSING'
  | 'PACKED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'OUT_OF_STOCK_CONFLICT'
  | 'DELIVERY_FAILED'
  | 'RETURNED';

export interface PricedLineItemInput {
  productId: number;
  variantId: number;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  unitMrpPaise: number;
  unitPricePaise: number;
  taxRatePercent: number;
  availableStock: number;
  pickupEligible: boolean;
  deliveryEligible: boolean;
}

export interface CouponRule {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderPaise: number;
  maxDiscountPaise: number;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
  expiresAt?: Date | null;
}

export interface PincodeServiceRule {
  pincode: string;
  city: string;
  state: string;
  deliveryFeePaise: number;
  freeDeliveryThresholdPaise: number;
  codAvailable: boolean;
  estimatedDays: string;
  isActive: boolean;
  isSampleRule?: boolean;
}

export interface CartCalculationResult {
  items: Array<
    PricedLineItemInput & {
      lineMrpTotalPaise: number;
      lineSubtotalPaise: number;
      lineSavingsPaise: number;
      extractedTaxPaise: number;
    }
  >;
  mrpTotalPaise: number;
  subtotalPaise: number;
  catalogSavingsPaise: number;
  couponDiscountPaise: number;
  appliedCouponCode: string;
  couponMessage: string;
  taxPaise: number;
  shippingPaise: number;
  totalPaise: number;
}

/**
 * Formats integer paise to INR currency string (e.g. 14900 -> "₹149.00" or "₹149")
 */
export function formatPaiseToINR(paise: number, showDecimals = false): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Validates and calculates coupon discount in integer paise.
 */
export function evaluateCouponDiscount(
  subtotalPaise: number,
  coupon: CouponRule | null | undefined,
  now: Date = new Date()
): { valid: boolean; discountPaise: number; message: string } {
  if (!coupon) {
    return { valid: false, discountPaise: 0, message: 'Invalid coupon code.' };
  }
  if (!coupon.isActive) {
    return { valid: false, discountPaise: 0, message: 'This coupon is no longer active.' };
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now.getTime()) {
    return { valid: false, discountPaise: 0, message: 'This coupon has expired.' };
  }
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, discountPaise: 0, message: 'This coupon has reached its redemption limit.' };
  }
  if (subtotalPaise < coupon.minOrderPaise) {
    return {
      valid: false,
      discountPaise: 0,
      message: `Minimum order value of ${formatPaiseToINR(coupon.minOrderPaise)} required for ${coupon.code}.`,
    };
  }

  let discountPaise = 0;
  if (coupon.discountType === 'PERCENTAGE') {
    discountPaise = Math.round((subtotalPaise * coupon.discountValue) / 100);
    if (coupon.maxDiscountPaise > 0 && discountPaise > coupon.maxDiscountPaise) {
      discountPaise = coupon.maxDiscountPaise;
    }
  } else {
    discountPaise = coupon.discountValue;
  }

  if (discountPaise > subtotalPaise) {
    discountPaise = subtotalPaise;
  }

  return {
    valid: true,
    discountPaise,
    message: `Coupon ${coupon.code} applied (-${formatPaiseToINR(discountPaise)}).`,
  };
}

/**
 * Calculates complete server-authoritative cart and order totals in integer paise.
 * Retail selling prices in India are inclusive of GST; we compute the embedded GST component
 * transparently so invoices show exact taxable value + GST without surprising customers at checkout.
 */
export function calculateOrderTotals(params: {
  items: PricedLineItemInput[];
  fulfilmentMethod: FulfilmentMethod;
  coupon?: CouponRule | null;
  pincodeRule?: PincodeServiceRule | null;
  defaultDeliveryFeePaise?: number;
  defaultFreeThresholdPaise?: number;
}): CartCalculationResult {
  const {
    items,
    fulfilmentMethod,
    coupon,
    pincodeRule,
    defaultDeliveryFeePaise = 6000,
    defaultFreeThresholdPaise = 59900,
  } = params;

  let mrpTotalPaise = 0;
  let subtotalPaise = 0;
  let taxPaise = 0;

  const calculatedItems = items.map((item) => {
    const qty = Math.max(0, Math.floor(item.quantity));
    const lineMrpTotalPaise = item.unitMrpPaise * qty;
    const lineSubtotalPaise = item.unitPricePaise * qty;
    const lineSavingsPaise = Math.max(0, lineMrpTotalPaise - lineSubtotalPaise);
    // Inclusive GST extraction: Tax = Price - (Price / (1 + rate/100))
    const extractedTaxPaise = Math.round(
      lineSubtotalPaise - (lineSubtotalPaise * 100) / (100 + item.taxRatePercent)
    );

    mrpTotalPaise += lineMrpTotalPaise;
    subtotalPaise += lineSubtotalPaise;
    taxPaise += extractedTaxPaise;

    return {
      ...item,
      quantity: qty,
      lineMrpTotalPaise,
      lineSubtotalPaise,
      lineSavingsPaise,
      extractedTaxPaise,
    };
  });

  const catalogSavingsPaise = Math.max(0, mrpTotalPaise - subtotalPaise);

  let couponDiscountPaise = 0;
  let appliedCouponCode = '';
  let couponMessage = '';

  if (coupon && subtotalPaise > 0) {
    const evaluation = evaluateCouponDiscount(subtotalPaise, coupon);
    if (evaluation.valid) {
      couponDiscountPaise = evaluation.discountPaise;
      appliedCouponCode = coupon.code;
      couponMessage = evaluation.message;
    } else {
      couponMessage = evaluation.message;
    }
  }

  const discountedSubtotalPaise = Math.max(0, subtotalPaise - couponDiscountPaise);

  let shippingPaise = 0;
  if (fulfilmentMethod === 'STORE_PICKUP' || subtotalPaise === 0) {
    shippingPaise = 0;
  } else {
    const fee = pincodeRule ? pincodeRule.deliveryFeePaise : defaultDeliveryFeePaise;
    const threshold = pincodeRule
      ? pincodeRule.freeDeliveryThresholdPaise
      : defaultFreeThresholdPaise;
    shippingPaise =
      threshold > 0 && discountedSubtotalPaise >= threshold ? 0 : fee;
  }

  const totalPaise = discountedSubtotalPaise + shippingPaise;

  return {
    items: calculatedItems,
    mrpTotalPaise,
    subtotalPaise,
    catalogSavingsPaise,
    couponDiscountPaise,
    appliedCouponCode,
    couponMessage,
    taxPaise,
    shippingPaise,
    totalPaise,
  };
}

/**
 * Enforces valid order status lifecycle transitions for Store Pickup and Home Delivery.
 */
const PICKUP_TRANSITIONS: Record<string, OrderStatus[]> = {
  ORDER_PLACED: ['CONFIRMED', 'CANCELLED', 'OUT_OF_STOCK_CONFLICT'],
  CONFIRMED: ['PREPARING', 'READY_FOR_PICKUP', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['COLLECTED', 'CANCELLED'],
  COLLECTED: ['RETURNED'],
  CANCELLED: [],
  OUT_OF_STOCK_CONFLICT: ['CANCELLED', 'CONFIRMED'],
  RETURNED: [],
};

const DELIVERY_TRANSITIONS: Record<string, OrderStatus[]> = {
  ORDER_PLACED: ['CONFIRMED', 'CANCELLED', 'OUT_OF_STOCK_CONFLICT'],
  CONFIRMED: ['PROCESSING', 'PACKED', 'CANCELLED'],
  PROCESSING: ['PACKED', 'CANCELLED'],
  PACKED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED', 'DELIVERY_FAILED'],
  DELIVERED: ['RETURNED'],
  DELIVERY_FAILED: ['DISPATCHED', 'RETURNED', 'CANCELLED'],
  CANCELLED: [],
  OUT_OF_STOCK_CONFLICT: ['CANCELLED', 'CONFIRMED'],
  RETURNED: [],
};

export function isValidOrderStatusTransition(
  fulfilmentMethod: FulfilmentMethod,
  currentStatus: OrderStatus,
  nextStatus: OrderStatus
): boolean {
  if (currentStatus === nextStatus) return true;
  const map =
    fulfilmentMethod === 'STORE_PICKUP' ? PICKUP_TRANSITIONS : DELIVERY_TRANSITIONS;
  const allowed = map[currentStatus] || [];
  return allowed.includes(nextStatus);
}

export function getAllowedNextOrderStatuses(
  fulfilmentMethod: FulfilmentMethod,
  currentStatus: OrderStatus
): OrderStatus[] {
  const map =
    fulfilmentMethod === 'STORE_PICKUP' ? PICKUP_TRANSITIONS : DELIVERY_TRANSITIONS;
  return map[currentStatus] || [];
}

function getRandomHexBytes(length: number): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint8Array(length);
    window.crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
    const arr = new Uint8Array(length);
    globalThis.crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  }
  return result;
}

function getRandomByteArray(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(arr);
  } else if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return arr;
}

/**
 * Verifies Razorpay payment signature using HMAC-SHA256.
 * Never trusts client flags; requires exact cryptographic match with server secret.
 */
export function verifyRazorpayPaymentSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  keySecret: string;
}): boolean {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, keySecret } = params;
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !keySecret) {
    return false;
  }
  const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
  try {
    const nodeCrypto = require('crypto');
    const expectedSignature = nodeCrypto
      .createHmac('sha256', keySecret)
      .update(payload)
      .digest('hex');
    return expectedSignature === razorpaySignature;
  } catch {
    return false;
  }
}

/**
 * Verifies Razorpay Webhook signature using HMAC-SHA256.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecret: string
): boolean {
  if (!rawBody || !signature || !webhookSecret) return false;
  try {
    const nodeCrypto = require('crypto');
    const expected = nodeCrypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');
    return expected === signature;
  } catch {
    return false;
  }
}

/**
 * Generates a readable, collision-resistant order number and 6-character store pickup verification code.
 */
export function generateOrderNumber(): string {
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomPart = getRandomHexBytes(2).toUpperCase();
  return `GS-${datePart}-${randomPart}`;
}

export function generatePickupCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  const bytes = getRandomByteArray(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Parses a catalogue CSV string into structured product rows for admin import.
 * Expected columns:
 * sku,name,category_slug,brand_name,variant_sku,variant_name,attribute_type,attribute_value,mrp_rupees,selling_price_rupees,tax_rate_percent,stock_quantity,short_description,pickup_eligible,delivery_eligible,is_sample_data
 */
export interface CsvProductImportRow {
  sku: string;
  name: string;
  categorySlug: string;
  brandName: string;
  variantSku: string;
  variantName: string;
  attributeType: string;
  attributeValue: string;
  mrpPaise: number;
  sellingPricePaise: number;
  taxRatePercent: number;
  stockQuantity: number;
  shortDescription: string;
  pickupEligible: boolean;
  deliveryEligible: boolean;
  isSampleData: boolean;
}

export function parseCatalogueCsv(csvText: string): {
  rows: CsvProductImportRow[];
  errors: string[];
} {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { rows: [], errors: ['CSV file must contain a header row and at least one data row.'] };
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const requiredHeaders = [
    'sku',
    'name',
    'category_slug',
    'mrp_rupees',
    'selling_price_rupees',
    'stock_quantity',
  ];

  const missing = requiredHeaders.filter((req) => !headers.includes(req));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [`Missing required CSV columns: ${missing.join(', ')}`],
    };
  }

  const rows: CsvProductImportRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = (cols[idx] ?? '').trim();
    });

    const sku = record['sku'];
    const name = record['name'];
    const categorySlug = record['category_slug'];
    const mrpRupees = Number(record['mrp_rupees']);
    const sellingRupees = Number(record['selling_price_rupees']);
    const stockQuantity = Number(record['stock_quantity']);

    if (!sku || !name || !categorySlug) {
      errors.push(`Row ${i + 1}: sku, name, and category_slug are required.`);
      continue;
    }
    if (Number.isNaN(mrpRupees) || mrpRupees <= 0 || Number.isNaN(sellingRupees) || sellingRupees <= 0) {
      errors.push(`Row ${i + 1} (${sku}): mrp_rupees and selling_price_rupees must be positive numbers.`);
      continue;
    }
    if (sellingRupees > mrpRupees) {
      errors.push(`Row ${i + 1} (${sku}): selling_price_rupees cannot exceed mrp_rupees.`);
      continue;
    }
    if (Number.isNaN(stockQuantity) || stockQuantity < 0) {
      errors.push(`Row ${i + 1} (${sku}): stock_quantity must be a non-negative integer.`);
      continue;
    }

    rows.push({
      sku,
      name,
      categorySlug,
      brandName: record['brand_name'] || 'Gayatri Essentials',
      variantSku: record['variant_sku'] || `${sku}-STD`,
      variantName: record['variant_name'] || 'Standard Pack',
      attributeType: record['attribute_type'] || 'Format',
      attributeValue: record['attribute_value'] || 'Standard',
      mrpPaise: Math.round(mrpRupees * 100),
      sellingPricePaise: Math.round(sellingRupees * 100),
      taxRatePercent: Number(record['tax_rate_percent'] || '12'),
      stockQuantity: Math.floor(stockQuantity),
      shortDescription: record['short_description'] || `${name} — available at Gayatri Stationers.`,
      pickupEligible: record['pickup_eligible']?.toLowerCase() !== 'false',
      deliveryEligible: record['delivery_eligible']?.toLowerCase() !== 'false',
      isSampleData: record['is_sample_data']?.toLowerCase() === 'true',
    });
  }

  return { rows, errors };
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
