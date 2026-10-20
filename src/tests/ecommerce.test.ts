import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  calculateOrderTotals,
  evaluateCouponDiscount,
  isValidOrderStatusTransition,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
  parseCatalogueCsv,
  PricedLineItemInput,
  CouponRule,
} from '../lib/domain-logic.ts';
import { ensureSeeded } from '../db/seed.ts';
import {
  getStoreBootstrapData,
  placeOrderTransactionally,
  updateOrderWorkflowByAdmin,
  createOrUpdateProductByAdmin,
} from '../db/repository.ts';

const SAMPLE_ITEMS: PricedLineItemInput[] = [
  {
    productId: 1,
    variantId: 1,
    productName: 'Classmate Pulse 6-Subject Spiral Notebook',
    variantName: 'Single — Ruled',
    sku: 'GS-NB-001-SGL',
    quantity: 2,
    unitMrpPaise: 22500, // ₹225
    unitPricePaise: 19500, // ₹195
    taxRatePercent: 12,
    availableStock: 40,
    pickupEligible: true,
    deliveryEligible: true,
  },
  {
    productId: 2,
    variantId: 2,
    productName: 'DOMS Mathematical Instrument Box',
    variantName: 'Standard Tin',
    sku: 'GS-GM-001-STD',
    quantity: 1,
    unitMrpPaise: 15000, // ₹150
    unitPricePaise: 13500, // ₹135
    taxRatePercent: 18,
    availableStock: 25,
    pickupEligible: true,
    deliveryEligible: true,
  },
];

describe('Gayatri Stationers E-Commerce Domain Logic & PostgreSQL Integration', () => {
  it('calculates subtotal, MRP savings, GST extraction, and zero pickup fee in integer paise', () => {
    const result = calculateOrderTotals({
      items: SAMPLE_ITEMS,
      fulfilmentMethod: 'STORE_PICKUP',
    });

    // 2 * 22500 + 1 * 15000 = 60000 paise (₹600 MRP)
    expect(result.mrpTotalPaise).toBe(60000);
    // 2 * 19500 + 1 * 13500 = 52500 paise (₹525 Selling Subtotal)
    expect(result.subtotalPaise).toBe(52500);
    expect(result.catalogSavingsPaise).toBe(7500);
    expect(result.shippingPaise).toBe(0);
    expect(result.totalPaise).toBe(52500);
    expect(result.taxPaise).toBeGreaterThan(0);
  });

  it('applies percentage coupon with max cap and computes Home Delivery shipping threshold', () => {
    const coupon: CouponRule = {
      code: 'BACKTOSCHOOL10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderPaise: 39900,
      maxDiscountPaise: 15000,
      usageLimit: 100,
      usedCount: 5,
      isActive: true,
    };

    const result = calculateOrderTotals({
      items: SAMPLE_ITEMS, // subtotal 52500 paise
      fulfilmentMethod: 'HOME_DELIVERY',
      coupon,
      pincodeRule: {
        pincode: '282010',
        city: 'Agra',
        state: 'Uttar Pradesh',
        deliveryFeePaise: 4500,
        freeDeliveryThresholdPaise: 50000, // ₹500 threshold
        codAvailable: true,
        estimatedDays: '1-2 Days',
        isActive: true,
      },
    });

    // 10% of 52500 = 5250 paise discount -> discounted subtotal = 47250 paise
    expect(result.couponDiscountPaise).toBe(5250);
    // Since 47250 < 50000 free threshold, delivery fee of 4500 paise applies
    expect(result.shippingPaise).toBe(4500);
    expect(result.totalPaise).toBe(47250 + 4500);
  });

  it('rejects coupons when minimum order value is not met', () => {
    const coupon: CouponRule = {
      code: 'OFFICE100',
      discountType: 'FLAT_PAISE',
      discountValue: 10000,
      minOrderPaise: 99900,
      maxDiscountPaise: 10000,
      usageLimit: 50,
      usedCount: 0,
      isActive: true,
    };

    const evalResult = evaluateCouponDiscount(52500, coupon);
    expect(evalResult.valid).toBe(false);
    expect(evalResult.discountPaise).toBe(0);
  });

  it('enforces valid order lifecycle transitions for Store Pickup and Home Delivery', () => {
    expect(
      isValidOrderStatusTransition('STORE_PICKUP', 'CONFIRMED', 'PREPARING')
    ).toBe(true);
    expect(
      isValidOrderStatusTransition('STORE_PICKUP', 'PREPARING', 'READY_FOR_PICKUP')
    ).toBe(true);
    expect(
      isValidOrderStatusTransition('STORE_PICKUP', 'READY_FOR_PICKUP', 'COLLECTED')
    ).toBe(true);
    // Store pickup cannot transition to DISPATCHED
    expect(
      isValidOrderStatusTransition('STORE_PICKUP', 'CONFIRMED', 'DISPATCHED')
    ).toBe(false);

    // Home delivery lifecycle
    expect(
      isValidOrderStatusTransition('HOME_DELIVERY', 'CONFIRMED', 'PROCESSING')
    ).toBe(true);
    expect(
      isValidOrderStatusTransition('HOME_DELIVERY', 'PACKED', 'DISPATCHED')
    ).toBe(true);
    expect(
      isValidOrderStatusTransition('HOME_DELIVERY', 'DISPATCHED', 'DELIVERED')
    ).toBe(true);
  });

  it('verifies cryptographic Razorpay HMAC-SHA256 payment and webhook signatures and rejects forged signatures', () => {
    const secret = 'rzp_live_secret_test_key_9988';
    const orderId = 'order_P9xabc123';
    const paymentId = 'pay_Q1xyz987';
    const validSig = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    expect(
      verifyRazorpayPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: validSig,
        keySecret: secret,
      })
    ).toBe(true);

    expect(
      verifyRazorpayPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: 'forged_signature_12345',
        keySecret: secret,
      })
    ).toBe(false);

    const webhookBody = JSON.stringify({ event: 'payment.captured' });
    const validWebhookSig = crypto
      .createHmac('sha256', secret)
      .update(webhookBody)
      .digest('hex');
    expect(verifyRazorpayWebhookSignature(webhookBody, validWebhookSig, secret)).toBe(true);
    expect(verifyRazorpayWebhookSignature(webhookBody, 'wrong', secret)).toBe(false);
  });

  it('parses valid catalogue CSV rows and reports validation errors on invalid prices', () => {
    const csv = `sku,name,category_slug,brand_name,variant_sku,variant_name,attribute_type,attribute_value,mrp_rupees,selling_price_rupees,tax_rate_percent,stock_quantity,short_description,pickup_eligible,delivery_eligible,is_sample_data
GS-TEST-01,Test Gel Pen,pens-and-pencils,Unomax,GS-TEST-01-BLU,Blue Pack,Colour,Blue,100,85,18,50,Smooth writing gel pen,true,true,false
GS-BAD-02,Invalid Price Item,pens-and-pencils,Unomax,GS-BAD-02-STD,Std,Colour,Blue,100,150,18,10,Selling price exceeds MRP,true,true,false`;

    const parsed = parseCatalogueCsv(csv);
    expect(parsed.rows.length).toBe(1);
    expect(parsed.rows[0].sku).toBe('GS-TEST-01');
    expect(parsed.rows[0].sellingPricePaise).toBe(8500);
    expect(parsed.errors.length).toBe(1);
  });

  it('executes transactional order placement in PostgreSQL, deducts stock, prevents overselling, and processes pickup collection after payment', async () => {
    await ensureSeeded();
    const bootstrap = await getStoreBootstrapData();
    expect(bootstrap.products.length).toBeGreaterThan(0);

    const targetProduct = bootstrap.products[0];
    const targetVariant = targetProduct.variants[0];
    const initialStock = targetVariant.stockQuantity;

    // 1. Place a Store Pickup order with Pay at Store
    const created = await placeOrderTransactionally({
      customerName: 'Aarav Sharma',
      customerPhone: '9876543210',
      customerEmail: 'aarav@example.com',
      fulfilmentMethod: 'STORE_PICKUP',
      paymentMethod: 'PAY_AT_STORE',
      items: [
        {
          productId: targetProduct.id,
          variantId: targetVariant.id,
          quantity: 2,
        },
      ],
      pickupWindow: 'Morning Counter Slot (10:30 AM – 1:30 PM)',
    });

    expect(created.order.orderNumber).toMatch(/^GS-/);
    expect(created.order.paymentStatus).toBe('PENDING');
    expect(created.pickupDetails?.pickupCode).toHaveLength(6);

    // 2. Verify stock was atomically deducted by 2
    const afterOrderBootstrap = await getStoreBootstrapData();
    const updatedVariant = afterOrderBootstrap.products
      .find((p) => p.id === targetProduct.id)!
      .variants.find((v: any) => v.id === targetVariant.id)!;
    expect(updatedVariant.stockQuantity).toBe(initialStock - 2);

    // 3. Attempt to oversell (requesting more than remaining stock) must fail & roll back
    await expect(
      placeOrderTransactionally({
        customerName: 'Oversell Attempt',
        customerPhone: '9999999999',
        fulfilmentMethod: 'STORE_PICKUP',
        paymentMethod: 'PAY_AT_STORE',
        items: [
          {
            productId: targetProduct.id,
            variantId: targetVariant.id,
            quantity: updatedVariant.stockQuantity + 50,
          },
        ],
      })
    ).rejects.toThrow(/Insufficient stock/);

    // 4. Advance pickup lifecycle: CONFIRMED -> PREPARING -> READY_FOR_PICKUP
    await updateOrderWorkflowByAdmin({
      orderId: created.order.id,
      nextOrderStatus: 'PREPARING',
      actorEmail: 'owner@gayatristationers.co.in',
      actorRole: 'owner',
    });
    await updateOrderWorkflowByAdmin({
      orderId: created.order.id,
      nextOrderStatus: 'READY_FOR_PICKUP',
      actorEmail: 'owner@gayatristationers.co.in',
      actorRole: 'owner',
    });

    // 5. Attempting to mark COLLECTED while payment is PENDING must be rejected
    await expect(
      updateOrderWorkflowByAdmin({
        orderId: created.order.id,
        nextOrderStatus: 'COLLECTED',
        actorEmail: 'owner@gayatristationers.co.in',
        actorRole: 'owner',
      })
    ).rejects.toThrow(/Cannot mark pickup order as Collected while payment status is Pending/);

    // 6. Record offline counter payment and then mark COLLECTED
    await updateOrderWorkflowByAdmin({
      orderId: created.order.id,
      nextPaymentStatus: 'PAID',
      offlinePaymentReference: 'CASH-COUNTER-101',
      actorEmail: 'owner@gayatristationers.co.in',
      actorRole: 'owner',
    });

    const collectedOrder = await updateOrderWorkflowByAdmin({
      orderId: created.order.id,
      nextOrderStatus: 'COLLECTED',
      collectedByName: 'Aarav Sharma',
      actorEmail: 'owner@gayatristationers.co.in',
      actorRole: 'owner',
    });

    expect(collectedOrder.orderStatus).toBe('COLLECTED');
    expect(collectedOrder.paymentStatus).toBe('PAID');

    // 7. Verify saving a product with an existing SKU (e.g. GS-011-20) updates cleanly without constraint errors
    const savedProd = await createOrUpdateProductByAdmin({
      sku: 'GS-011-20',
      name: 'Hearts Stickers',
      categoryId: bootstrap.categories[0].id,
      brandId: bootstrap.brands[0].id,
      shortDescription: 'Love',
      description: 'Love',
      mrpPaise: 13900,
      sellingPricePaise: 13900,
      taxRatePercent: 12,
      illustrationType: 'spiral_notebook',
      imageUrl: '',
      pickupEligible: true,
      deliveryEligible: true,
      isFeatured: false,
      isBestseller: false,
      isNewArrival: true,
      isActive: true,
      isSampleData: false,
      initialStockQuantity: 139,
      variantName: 'Soulmate Pack',
      actorEmail: 'owner@gayatristationers.co.in',
    });
    expect(savedProd.sku).toBe('GS-011-20');
    expect(savedProd.name).toBe('Hearts Stickers');
  }, 30000);
});
