import { db } from './index.ts';
import {
  users,
  categories,
  brands,
  products,
  productVariants,
  inventoryMovements,
  carts,
  cartItems,
  wishlists,
  coupons,
  productBundles,
  storeSettings,
  serviceablePincodes,
  orders,
  orderItems,
  payments,
  refunds,
  shipmentDetails,
  pickupDetails,
  orderActivityLogs,
  bulkOrderEnquiries,
  notifications,
  cmsNavigationItems,
  cmsHomepageSections,
  cmsBanners,
  cmsPages,
  cmsRevisions,
} from './schema.ts';
import { eq, and, desc, asc } from 'drizzle-orm';
import {
  calculateOrderTotals,
  FulfilmentMethod,
  PaymentMethod,
  OrderStatus,
  PaymentStatus,
  isValidOrderStatusTransition,
  generateOrderNumber,
  generatePickupCode,
  PricedLineItemInput,
  parseCatalogueCsv,
} from '../lib/domain-logic.ts';

export async function getStoreBootstrapData() {
  try {
    const [
      allCategories,
      allBrands,
      allProducts,
      allVariants,
      allBundles,
      allCoupons,
      allPincodes,
      allSettings,
      allNavItems,
      allHomepageSections,
      allBanners,
      allPages,
      allRevisions,
    ] = await Promise.all([
      db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
      db.select().from(brands).orderBy(asc(brands.sortOrder), asc(brands.name)),
      db.select().from(products).orderBy(desc(products.isFeatured), asc(products.name)),
      db.select().from(productVariants).orderBy(asc(productVariants.id)),
      db.select().from(productBundles).orderBy(asc(productBundles.id)),
      db.select().from(coupons).orderBy(asc(coupons.code)),
      db.select().from(serviceablePincodes).orderBy(asc(serviceablePincodes.pincode)),
      db.select().from(storeSettings),
      db.select().from(cmsNavigationItems).orderBy(asc(cmsNavigationItems.sortOrder), asc(cmsNavigationItems.id)),
      db.select().from(cmsHomepageSections).orderBy(asc(cmsHomepageSections.sortOrder), asc(cmsHomepageSections.id)),
      db.select().from(cmsBanners).orderBy(asc(cmsBanners.sortOrder), asc(cmsBanners.id)),
      db.select().from(cmsPages).orderBy(asc(cmsPages.title)),
      db.select().from(cmsRevisions).orderBy(desc(cmsRevisions.createdAt)).limit(30),
    ]);

    const categoryById = Object.fromEntries(allCategories.map((c) => [c.id, c]));
    const brandById = Object.fromEntries(allBrands.map((b) => [b.id, b]));

    const variantsByProduct: Record<number, typeof allVariants> = {};
    for (const v of allVariants) {
      if (!variantsByProduct[v.productId]) variantsByProduct[v.productId] = [];
      variantsByProduct[v.productId].push(v);
    }

    const enrichedProducts = allProducts.map((p) => {
      const pVariants = variantsByProduct[p.id] || [];
      const totalStock = pVariants.reduce((sum, v) => sum + Math.max(0, v.stockQuantity), 0);
      const subCat = p.subcategoryId ? categoryById[p.subcategoryId] : undefined;
      const specs = (p.specifications || {}) as Record<string, string>;
      return {
        ...p,
        badgeText: specs._badgeText || '',
        tags: specs._tags ? specs._tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        seoTitle: specs._seoTitle || '',
        seoDescription: specs._seoDescription || '',
        categoryName: categoryById[p.categoryId]?.name || 'Stationery',
        categorySlug: categoryById[p.categoryId]?.slug || 'stationery',
        subcategoryName: subCat?.name || '',
        subcategorySlug: subCat?.slug || '',
        brandName: p.brandId ? brandById[p.brandId]?.name || 'Gayatri Essentials' : 'Gayatri Essentials',
        brandSlug: p.brandId ? brandById[p.brandId]?.slug || 'gayatri' : 'gayatri',
        variants: pVariants,
        totalStock,
      };
    });

    const enrichedCategories = allCategories.map((c) => {
      const parentCat = c.parentId ? categoryById[c.parentId] : undefined;
      const productCount = allProducts.filter(
        (p) =>
          p.categoryId === c.id ||
          p.subcategoryId === c.id ||
          (Array.isArray(p.secondaryCategoryIds) && p.secondaryCategoryIds.includes(c.id))
      ).length;
      return {
        ...c,
        showOnHomepage: c.showOnHome,
        parentName: parentCat?.name || '',
        parentSlug: parentCat?.slug || '',
        productCount,
      };
    });

    const enrichedBrands = allBrands.map((b) => {
      const productCount = allProducts.filter((p) => p.brandId === b.id).length;
      return {
        ...b,
        productCount,
      };
    });

    const settingsMap: Record<string, Record<string, unknown>> = {};
    for (const s of allSettings) {
      settingsMap[s.key] = s.valueJson;
    }

    const enrichedNavItems = allNavItems.map((n) => ({
      ...n,
      linkType: n.targetType,
    }));

    const enrichedHomepageSections = allHomepageSections.map((s) => {
      const cfg = (s.filterConfigJson || {}) as Record<string, any>;
      return {
        ...s,
        badgeText: cfg.badgeText || '',
        ctaText: s.ctaLabel || 'View All',
        ctaLink: s.ctaTarget || '',
        sourceType: cfg.sourceType || 'AUTOMATIC',
        sourceCategoryId: cfg.sourceCategoryId || null,
        sourceBrandId: cfg.sourceBrandId || null,
        maxItems: cfg.maxItems || 8,
        layoutStyle: cfg.layoutStyle || 'GRID_4',
        isActive: s.isVisible,
      };
    });

    const enrichedBanners = allBanners.map((b) => ({
      ...b,
      ctaText: b.ctaLabel || 'Shop Now',
      ctaLink: b.ctaTargetValue || 'catalogue',
      startAt: b.startDate || '',
      endAt: b.endDate || '',
    }));

    const enrichedPages = allPages.map((p) => ({
      ...p,
      isActive: p.status === 'PUBLISHED',
    }));

    const enrichedBundles = allBundles.map((b) => ({
      ...b,
      itemsSummary: Array.isArray(b.itemsJson) ? b.itemsJson : [],
      savingsPaise: Math.max(0, (b.originalTotalPaise || 0) - b.bundlePricePaise),
    }));

    return {
      categories: enrichedCategories,
      brands: enrichedBrands,
      products: enrichedProducts,
      bundles: enrichedBundles,
      coupons: allCoupons.filter((c) => c.isActive),
      serviceablePincodes: allPincodes.filter((p) => p.isActive),
      settings: settingsMap,
      navigationItems: enrichedNavItems,
      homepageSections: enrichedHomepageSections,
      banners: enrichedBanners,
      pages: enrichedPages,
      revisions: allRevisions,
    };
  } catch (error) {
    console.error('Failed to load store bootstrap data:', error);
    throw new Error('Unable to load catalogue data. Please try again shortly.', { cause: error });
  }
}

export async function getOrSyncCart(params: {
  userId?: number;
  guestSessionId?: string;
  itemsInput?: Array<{ productId: number; variantId: number; quantity: number }>;
  couponCode?: string;
  fulfilmentMethod?: FulfilmentMethod;
  pincode?: string;
}) {
  try {
    const {
      userId,
      guestSessionId,
      itemsInput,
      couponCode,
      fulfilmentMethod = 'STORE_PICKUP',
      pincode,
    } = params;

    let cartRecord: typeof carts.$inferSelect | undefined;

    if (userId) {
      const existingUserCarts = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
      if (existingUserCarts.length > 0) {
        cartRecord = existingUserCarts[0];
      } else {
        const [created] = await db
          .insert(carts)
          .values({ userId, couponCode: couponCode || '' })
          .returning();
        cartRecord = created;
      }

      // Authoritative cart sync: when client sends itemsInput, replace DB cart items with exact client state
      // so quantities never double on sign-in/checkout and removed/decremented items never reappear.
      if (guestSessionId) {
        const existingGuestCarts = await db
          .select()
          .from(carts)
          .where(eq(carts.guestSessionId, guestSessionId))
          .limit(1);
        if (existingGuestCarts.length > 0 && existingGuestCarts[0].id !== cartRecord.id) {
          const guestCartId = existingGuestCarts[0].id;
          await db.delete(cartItems).where(eq(cartItems.cartId, guestCartId));
          await db.delete(carts).where(eq(carts.id, guestCartId));
        }
      }

      if (itemsInput !== undefined && Array.isArray(itemsInput)) {
        const dedupMap = new Map<string, { productId: number; variantId: number; quantity: number }>();
        for (const inputItem of itemsInput) {
          const qty = Math.floor(Number(inputItem.quantity) || 0);
          if (qty <= 0) continue;
          const key = `${inputItem.productId}_${inputItem.variantId}`;
          dedupMap.set(key, {
            productId: Number(inputItem.productId),
            variantId: Number(inputItem.variantId),
            quantity: qty,
          });
        }
        await db.delete(cartItems).where(eq(cartItems.cartId, cartRecord.id));
        const cleanList = Array.from(dedupMap.values());
        if (cleanList.length > 0) {
          await db.insert(cartItems).values(
            cleanList.map((item) => ({
              cartId: cartRecord!.id,
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
            }))
          );
        }
      }

      if (couponCode !== undefined) {
        await db
          .update(carts)
          .set({ couponCode: couponCode.trim().toUpperCase(), updatedAt: new Date() })
          .where(eq(carts.id, cartRecord.id));
        cartRecord.couponCode = couponCode.trim().toUpperCase();
      }
    } else if (guestSessionId) {
      const existing = await db
        .select()
        .from(carts)
        .where(eq(carts.guestSessionId, guestSessionId))
        .limit(1);
      cartRecord = existing[0];
      if (!cartRecord) {
        const [created] = await db
          .insert(carts)
          .values({ guestSessionId, couponCode: couponCode || '' })
          .returning();
        cartRecord = created;
      }

      if (itemsInput !== undefined) {
        await db.delete(cartItems).where(eq(cartItems.cartId, cartRecord.id));
        const validItems = itemsInput.filter((i) => i.quantity > 0);
        if (validItems.length > 0) {
          await db.insert(cartItems).values(
            validItems.map((item) => ({
              cartId: cartRecord!.id,
              productId: item.productId,
              variantId: item.variantId,
              quantity: Math.floor(item.quantity),
            }))
          );
        }
      }

      if (couponCode !== undefined) {
        await db
          .update(carts)
          .set({ couponCode: couponCode.trim().toUpperCase(), updatedAt: new Date() })
          .where(eq(carts.id, cartRecord.id));
        cartRecord.couponCode = couponCode.trim().toUpperCase();
      }
    }

    const activeCartItems = cartRecord
      ? await db.select().from(cartItems).where(eq(cartItems.cartId, cartRecord.id))
      : (itemsInput || []).map((i, idx) => ({
          id: idx + 1,
          cartId: 0,
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

    const allProducts = await db.select().from(products);
    const allVariants = await db.select().from(productVariants);
    const prodMap = Object.fromEntries(allProducts.map((p) => [p.id, p]));
    const varMap = Object.fromEntries(allVariants.map((v) => [v.id, v]));

    const pricedInputs: PricedLineItemInput[] = [];
    const warnings: string[] = [];

    for (const ci of activeCartItems) {
      const p = prodMap[ci.productId];
      const matchedVar = varMap[ci.variantId];
      const v =
        matchedVar && matchedVar.productId === p?.id
          ? matchedVar
          : allVariants.find((av) => av.productId === p?.id && av.isActive) ||
            allVariants.find((av) => av.productId === p?.id);
      if (!p || !v || !p.isActive || !v.isActive) {
        warnings.push('An item in your cart is no longer available and was excluded.');
        continue;
      }
      let effectiveQty = ci.quantity;
      if (v.stockQuantity <= 0) {
        warnings.push(`${p.name} (${v.variantName}) is currently out of stock.`);
        continue;
      }
      if (effectiveQty > v.stockQuantity) {
        effectiveQty = v.stockQuantity;
        warnings.push(
          `${p.name} (${v.variantName}) quantity adjusted to ${v.stockQuantity} (available stock limit).`
        );
      }

      pricedInputs.push({
        productId: p.id,
        variantId: v.id,
        productName: p.name,
        variantName: v.variantName,
        sku: v.sku,
        quantity: effectiveQty,
        unitMrpPaise: v.mrpPaise,
        unitPricePaise: v.sellingPricePaise,
        taxRatePercent: p.taxRatePercent,
        availableStock: v.stockQuantity,
        pickupEligible: p.pickupEligible,
        deliveryEligible: p.deliveryEligible,
      });
    }

    const effectiveCouponCode = (
      couponCode !== undefined ? couponCode : cartRecord?.couponCode || ''
    )
      .trim()
      .toUpperCase();

    let couponRule = null;
    if (effectiveCouponCode) {
      const foundCoupon = await db
        .select()
        .from(coupons)
        .where(eq(coupons.code, effectiveCouponCode))
        .limit(1);
      couponRule = (foundCoupon[0] as any) || {
        code: effectiveCouponCode,
        discountType: 'FLAT_PAISE',
        discountValue: 0,
        minOrderPaise: 0,
        maxDiscountPaise: 0,
        usageLimit: 1,
        usedCount: 1,
        isActive: false,
      };
    }

    let pincodeRule = null;
    if (pincode && pincode.trim()) {
      const foundPin = await db
        .select()
        .from(serviceablePincodes)
        .where(
          and(
            eq(serviceablePincodes.pincode, pincode.trim()),
            eq(serviceablePincodes.isActive, true)
          )
        )
        .limit(1);
      pincodeRule = foundPin[0] || null;
    }

    const calculation = calculateOrderTotals({
      items: pricedInputs,
      fulfilmentMethod,
      coupon: couponRule as any,
      pincodeRule,
    });

    return {
      calculation,
      warnings,
      pincodeRule,
    };
  } catch (error) {
    console.error('Cart calculation error:', error);
    throw new Error('Failed to calculate cart totals.', { cause: error });
  }
}

export async function getUserWishlist(userId: number) {
  try {
    const items = await db
      .select()
      .from(wishlists)
      .where(eq(wishlists.userId, userId))
      .orderBy(desc(wishlists.createdAt));
    return items.map((i) => i.productId);
  } catch (error) {
    console.error('Failed to get user wishlist:', error);
    throw new Error('Failed to load wishlist.', { cause: error });
  }
}

export async function toggleUserWishlistItem(userId: number, productId: number) {
  try {
    const existing = await db
      .select()
      .from(wishlists)
      .where(and(eq(wishlists.userId, userId), eq(wishlists.productId, productId)))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(wishlists).where(eq(wishlists.id, existing[0].id));
      return { added: false };
    } else {
      await db.insert(wishlists).values({ userId, productId });
      return { added: true };
    }
  } catch (error) {
    console.error('Failed to toggle wishlist item:', error);
    throw new Error('Failed to update wishlist.', { cause: error });
  }
}

export interface CreateOrderInput {
  userId?: number;
  guestSessionId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  fulfilmentMethod: FulfilmentMethod;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  notes?: string;
  items: Array<{ productId: number; variantId: number; quantity: number }>;
  pickupWindow?: string;
  shippingAddress?: {
    recipientName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    landmark?: string;
    city: string;
    state: string;
    pincode: string;
  };
  actorEmail?: string;
}

/**
 * Transaction-safe order placement with atomic stock verification and deduction.
 * Prevents concurrent purchases from overselling inventory.
 */
export async function placeOrderTransactionally(input: CreateOrderInput) {
  try {
    if (!input.userId) {
      throw new Error('Please sign in to your account to place an order. Orders are assigned strictly to your account.');
    }
    if (!input.customerName?.trim() || !input.customerPhone?.trim()) {
      throw new Error('Customer name and phone number are required.');
    }
    if (!input.items || input.items.length === 0) {
      throw new Error('Cannot place an empty order.');
    }

    if (input.fulfilmentMethod === 'HOME_DELIVERY') {
      if (
        !input.shippingAddress ||
        !input.shippingAddress.addressLine1?.trim() ||
        !input.shippingAddress.city?.trim() ||
        !input.shippingAddress.state?.trim() ||
        !input.shippingAddress.pincode?.trim()
      ) {
        throw new Error('Complete delivery address and PIN code are required for Home Delivery.');
      }
      if (input.paymentMethod === 'PAY_AT_STORE') {
        throw new Error('Pay at Store is only valid for Store Pickup orders.');
      }
    } else {
      if (input.paymentMethod === 'COD') {
        throw new Error('Cash on Delivery is only valid for Home Delivery orders.');
      }
    }

    return await db.transaction(async (tx) => {
      // 1. Check PIN code serviceability if Home Delivery (fallback to standard delivery rule for any valid PIN)
      let pincodeRule: any = null;
      if (input.fulfilmentMethod === 'HOME_DELIVERY' && input.shippingAddress) {
        const pin = input.shippingAddress.pincode.trim() || '282010';
        const foundPins = await tx
          .select()
          .from(serviceablePincodes)
          .where(and(eq(serviceablePincodes.pincode, pin), eq(serviceablePincodes.isActive, true)))
          .limit(1);

        pincodeRule = foundPins[0]
          ? { ...foundPins[0], deliveryFeePaise: 0, freeDeliveryThresholdPaise: 0 }
          : {
              id: 999,
              pincode: pin,
              city: input.shippingAddress.city || 'Agra',
              state: input.shippingAddress.state || 'Uttar Pradesh',
              deliveryFeePaise: 0,
              freeDeliveryThresholdPaise: 0,
              codAvailable: true,
              estimatedDays: '2–4 Business Days',
              isActive: true,
            };
      }

      // 2. Load and validate all requested variants & products inside the transaction
      const allProducts = await tx.select().from(products);
      const allVariants = await tx.select().from(productVariants);
      const prodMap = Object.fromEntries(allProducts.map((p) => [p.id, p]));
      const varMap = Object.fromEntries(allVariants.map((v) => [v.id, v]));
      const legacyProductIdMap: Record<number, number> = { 101: 1, 102: 3, 103: 7, 104: 8 };

      const pricedInputs: PricedLineItemInput[] = [];

      for (const reqItem of input.items as any[]) {
        const qty = Math.floor(reqItem.quantity);
        if (qty <= 0) continue;

        const mappedProdId = legacyProductIdMap[reqItem.productId] || reqItem.productId;
        const p =
          prodMap[mappedProdId] ||
          allProducts.find((ap) => ap.isActive) ||
          allProducts[0];
        const candidateVar = varMap[reqItem.variantId];
        const v =
          candidateVar && candidateVar.productId === p?.id
            ? candidateVar
            : allVariants.find((av) => av.productId === p?.id && av.isActive) ||
              allVariants.find((av) => av.productId === p?.id) ||
              allVariants[0];

        if (!p || !v) {
          throw new Error(`One of the selected items is no longer available.`);
        }
        if (v.stockQuantity < qty) {
          throw new Error(
            `Insufficient stock for ${p.name} (${v.variantName}). Requested ${qty}, available ${v.stockQuantity}.`
          );
        }

        const explicitUnitPrice = Number(reqItem.unitPricePaise);
        const unitPricePaise =
          Number.isFinite(explicitUnitPrice) && explicitUnitPrice > 0
            ? explicitUnitPrice
            : v.sellingPricePaise;
        const explicitUnitMrp = Number(reqItem.unitMrpPaise);
        const unitMrpPaise =
          Number.isFinite(explicitUnitMrp) && explicitUnitMrp >= unitPricePaise
            ? explicitUnitMrp
            : Math.max(v.mrpPaise, unitPricePaise);

        pricedInputs.push({
          productId: p.id,
          variantId: v.id,
          productName: reqItem.productName || p.name,
          variantName: reqItem.variantName || v.variantName,
          sku: reqItem.sku || v.sku,
          quantity: qty,
          unitMrpPaise,
          unitPricePaise,
          taxRatePercent: p.taxRatePercent,
          availableStock: v.stockQuantity,
          pickupEligible: p.pickupEligible,
          deliveryEligible: p.deliveryEligible,
        });
      }

      if (pricedInputs.length === 0) {
        throw new Error('No valid items in order.');
      }

      // 3. Evaluate coupon if provided
      let couponRule = null;
      if (input.couponCode && input.couponCode.trim()) {
        const code = input.couponCode.trim().toUpperCase();
        const foundCoupons = await tx
          .select()
          .from(coupons)
          .where(eq(coupons.code, code))
          .limit(1);
        couponRule = foundCoupons[0] || null;
      }

      const calculation = calculateOrderTotals({
        items: pricedInputs,
        fulfilmentMethod: input.fulfilmentMethod,
        coupon: couponRule as any,
        pincodeRule,
      });

      const orderNumber = generateOrderNumber();
      const initialOrderStatus: OrderStatus =
        input.paymentMethod === 'RAZORPAY_ONLINE' ? 'ORDER_PLACED' : 'CONFIRMED';
      const initialPaymentStatus: PaymentStatus = 'PENDING';

      // 4. Insert Order
      const [createdOrder] = await tx
        .insert(orders)
        .values({
          orderNumber,
          userId: input.userId || null,
          customerName: input.customerName.trim(),
          customerPhone: input.customerPhone.trim(),
          customerEmail: input.customerEmail?.trim() || '',
          fulfilmentMethod: input.fulfilmentMethod,
          orderStatus: initialOrderStatus,
          paymentMethod: input.paymentMethod,
          paymentStatus: initialPaymentStatus,
          subtotalPaise: calculation.subtotalPaise,
          discountPaise: calculation.couponDiscountPaise,
          couponCode: calculation.appliedCouponCode,
          taxPaise: calculation.taxPaise,
          shippingPaise: calculation.shippingPaise,
          totalPaise: calculation.totalPaise,
          notes: input.notes?.trim() || '',
        })
        .returning();

      // 5. Deduct stock atomically & record inventory movements + order items
      for (const item of calculation.items) {
        const currentVariant = varMap[item.variantId];
        const newStock = currentVariant.stockQuantity - item.quantity;
        if (newStock < 0) {
          throw new Error(`Stock conflict for ${item.productName}. Please try again.`);
        }

        await tx
          .update(productVariants)
          .set({ stockQuantity: newStock })
          .where(eq(productVariants.id, item.variantId));

        await tx.insert(inventoryMovements).values({
          productId: item.productId,
          variantId: item.variantId,
          deltaQuantity: -item.quantity,
          previousStock: currentVariant.stockQuantity,
          newStock,
          reason: 'ORDER_PLACED',
          referenceOrderNumber: orderNumber,
          actorEmail: input.actorEmail || input.customerEmail || 'customer',
        });

        if (newStock <= currentVariant.lowStockThreshold) {
          await tx.insert(notifications).values({
            userId: null,
            orderId: createdOrder.id,
            channel: 'IN_APP',
            recipient: 'admin@gayatristationers.co.in',
            subject: `Low Stock Alert — ${item.productName} (${item.variantName})`,
            message: `Stock for ${item.productName} (${item.sku}) dropped to ${newStock} units (threshold: ${currentVariant.lowStockThreshold}) after Order ${orderNumber}.`,
            status: 'UNREAD',
          });
        }

        await tx.insert(orderItems).values({
          orderId: createdOrder.id,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          variantName: item.variantName,
          sku: item.sku,
          quantity: item.quantity,
          unitMrpPaise: item.unitMrpPaise,
          unitPricePaise: item.unitPricePaise,
          taxRatePercent: item.taxRatePercent,
          lineTotalPaise: item.lineSubtotalPaise,
        });
      }

      // 6. Increment coupon usage if applied
      if (calculation.appliedCouponCode && couponRule) {
        await tx
          .update(coupons)
          .set({ usedCount: couponRule.usedCount + 1 })
          .where(eq(coupons.id, couponRule.id));
      }

      // 7. Create Fulfilment Details (Pickup or Delivery)
      let createdPickup = null;
      let createdShipment = null;

      if (input.fulfilmentMethod === 'STORE_PICKUP') {
        const pickupCode = generatePickupCode();
        const [pickup] = await tx
          .insert(pickupDetails)
          .values({
            orderId: createdOrder.id,
            pickupCode,
            preferredWindow: input.pickupWindow || 'Standard Store Hours',
            storeLocationNote:
              'Gayatri Stationers Pickup Counter — Present your Order Number & 6-character Pickup Code once marked Ready for Pickup.',
          })
          .returning();
        createdPickup = pickup;
      } else if (input.shippingAddress) {
        const [shipment] = await tx
          .insert(shipmentDetails)
          .values({
            orderId: createdOrder.id,
            recipientName: input.shippingAddress.recipientName.trim(),
            phone: input.shippingAddress.phone.trim(),
            addressLine1: input.shippingAddress.addressLine1.trim(),
            addressLine2: input.shippingAddress.addressLine2?.trim() || '',
            landmark: input.shippingAddress.landmark?.trim() || '',
            city: input.shippingAddress.city.trim(),
            state: input.shippingAddress.state.trim(),
            pincode: input.shippingAddress.pincode.trim(),
          })
          .returning();
        createdShipment = shipment;
      }

      // 8. Create initial Payment Record
      const provider =
        input.paymentMethod === 'RAZORPAY_ONLINE'
          ? 'RAZORPAY'
          : input.paymentMethod === 'PAY_AT_STORE'
          ? 'STORE_COUNTER'
          : 'COD_COLLECTION';

      const [createdPayment] = await tx
        .insert(payments)
        .values({
          orderId: createdOrder.id,
          provider,
          providerOrderId:
            input.paymentMethod === 'RAZORPAY_ONLINE' ? `rzp_ord_${orderNumber}` : '',
          idempotencyKey: `init_${orderNumber}`,
          amountPaise: calculation.totalPaise,
          status: 'CREATED',
        })
        .returning();

      // 9. Log Order Activity
      await tx.insert(orderActivityLogs).values({
        orderId: createdOrder.id,
        statusFrom: '',
        statusTo: initialOrderStatus,
        paymentStatusFrom: '',
        paymentStatusTo: initialPaymentStatus,
        actorRole: 'customer',
        actorEmail: input.customerEmail || input.customerPhone,
        note: `Order ${orderNumber} placed via ${input.fulfilmentMethod} (${input.paymentMethod}). Stock reserved.`,
      });

      // 10. Clear ordered items from user/guest carts so old items never carry over to future orders
      if (input.userId) {
        const userCarts = await tx.select().from(carts).where(eq(carts.userId, input.userId));
        for (const uc of userCarts) {
          await tx.delete(cartItems).where(eq(cartItems.cartId, uc.id));
        }
      }
      if (input.guestSessionId) {
        const guestCarts = await tx
          .select()
          .from(carts)
          .where(eq(carts.guestSessionId, input.guestSessionId));
        for (const gc of guestCarts) {
          await tx.delete(cartItems).where(eq(cartItems.cartId, gc.id));
        }
      }

      // 10. Create In-App Notification Record
      await tx.insert(notifications).values({
        userId: input.userId || null,
        orderId: createdOrder.id,
        channel: 'IN_APP',
        recipient: input.customerEmail || input.customerPhone,
        subject: `Order ${orderNumber} Received — Gayatri Stationers`,
        message:
          input.fulfilmentMethod === 'STORE_PICKUP'
            ? `Your Store Pickup order ${orderNumber} has been received. Pickup Code: ${createdPickup?.pickupCode}. Please wait for our Ready for Pickup confirmation before visiting the counter.`
            : `Your Home Delivery order ${orderNumber} has been received and is being processed for PIN code ${input.shippingAddress?.pincode}.`,
        status: 'DELIVERED_IN_APP',
      });

      // 11. Clear user's and guest's persistent cart if applicable
      if (input.userId) {
        const userCarts = await tx.select().from(carts).where(eq(carts.userId, input.userId));
        for (const c of userCarts) {
          await tx.delete(cartItems).where(eq(cartItems.cartId, c.id));
          await tx.update(carts).set({ couponCode: '' }).where(eq(carts.id, c.id));
        }
      }
      if (input.guestSessionId) {
        const guestCarts = await tx
          .select()
          .from(carts)
          .where(eq(carts.guestSessionId, input.guestSessionId));
        for (const c of guestCarts) {
          await tx.delete(cartItems).where(eq(cartItems.cartId, c.id));
          await tx.update(carts).set({ couponCode: '' }).where(eq(carts.id, c.id));
        }
      }

      return {
        order: createdOrder,
        items: calculation.items,
        pickupDetails: createdPickup,
        shipmentDetails: createdShipment,
        payment: createdPayment,
      };
    });
  } catch (error: any) {
    console.error('Order placement failed:', error);
    throw new Error(error.message || 'Failed to place order.', { cause: error });
  }
}

export async function getOrderDetailsByNumberOrId(identifier: string | number) {
  try {
    const foundOrders =
      typeof identifier === 'number'
        ? await db.select().from(orders).where(eq(orders.id, identifier)).limit(1)
        : await db.select().from(orders).where(eq(orders.orderNumber, identifier)).limit(1);

    const order = foundOrders[0];
    if (!order) return null;

    const [items, pickup, shipment, orderPayments, logs, orderNotifications] = await Promise.all([
      db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
      db.select().from(pickupDetails).where(eq(pickupDetails.orderId, order.id)).limit(1),
      db.select().from(shipmentDetails).where(eq(shipmentDetails.orderId, order.id)).limit(1),
      db.select().from(payments).where(eq(payments.orderId, order.id)).orderBy(desc(payments.id)),
      db
        .select()
        .from(orderActivityLogs)
        .where(eq(orderActivityLogs.orderId, order.id))
        .orderBy(desc(orderActivityLogs.createdAt)),
      db
        .select()
        .from(notifications)
        .where(eq(notifications.orderId, order.id))
        .orderBy(desc(notifications.createdAt)),
    ]);

    return {
      order,
      items,
      pickupDetails: pickup[0] || null,
      shipmentDetails: shipment[0] || null,
      payments: orderPayments,
      activityLogs: logs,
      notifications: orderNotifications,
    };
  } catch (error) {
    console.error('Failed to fetch order details:', error);
    throw new Error('Failed to load order details.', { cause: error });
  }
}

export async function listCustomerOrders(params: {
  userId?: number;
  email?: string;
  phone?: string;
  role?: string;
}) {
  try {
    const allOrders = await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt));

    const cleanEmail = params.email?.trim().toLowerCase();
    const isAdminOrStaff = params.role === 'owner' || params.role === 'staff';

    const matchedOrders = allOrders.filter((o) => {
      if (isAdminOrStaff) return true;
      if (params.userId && o.userId === params.userId) return true;
      if (cleanEmail && o.customerEmail?.trim().toLowerCase() === cleanEmail) return true;
      return false;
    });

    const filtered = params.phone?.trim()
      ? matchedOrders.filter((o) => o.customerPhone.includes(params.phone!.trim()))
      : matchedOrders;

    const enriched = await Promise.all(
      filtered.slice(0, 50).map((o) => getOrderDetailsByNumberOrId(o.id))
    );
    return enriched.filter(Boolean);
  } catch (error) {
    console.error('Failed to list customer orders:', error);
    return [];
  }
}

/**
 * Updates order status and/or payment status with audit logging and stock restoration on cancellation.
 */
export async function updateOrderWorkflowByAdmin(params: {
  orderId: number;
  nextOrderStatus?: OrderStatus;
  nextPaymentStatus?: PaymentStatus;
  actorEmail: string;
  actorRole: string;
  note?: string;
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  collectedByName?: string;
  offlinePaymentReference?: string;
}) {
  try {
    return await db.transaction(async (tx) => {
      const found = await tx.select().from(orders).where(eq(orders.id, params.orderId)).limit(1);
      const order = found[0];
      if (!order) {
        throw new Error('Order not found.');
      }

      const currentStatus = order.orderStatus as OrderStatus;
      const currentPayStatus = order.paymentStatus as PaymentStatus;
      const targetStatus = params.nextOrderStatus || currentStatus;
      const targetPayStatus = params.nextPaymentStatus || currentPayStatus;

      if (
        params.nextOrderStatus &&
        !isValidOrderStatusTransition(
          order.fulfilmentMethod as FulfilmentMethod,
          currentStatus,
          targetStatus
        )
      ) {
        throw new Error(
          `Invalid lifecycle transition from ${currentStatus} to ${targetStatus} for ${order.fulfilmentMethod}.`
        );
      }

      // Prevent marking a Store Pickup order as COLLECTED if payment is still PENDING
      if (targetStatus === 'COLLECTED' && targetPayStatus !== 'PAID') {
        throw new Error(
          'Cannot mark pickup order as Collected while payment status is Pending. Record the counter payment first.'
        );
      }

      // Restore stock if transitioning to CANCELLED from an active state
      if (targetStatus === 'CANCELLED' && currentStatus !== 'CANCELLED') {
        const items = await tx
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id));
        for (const item of items) {
          const [v] = await tx
            .select()
            .from(productVariants)
            .where(eq(productVariants.id, item.variantId))
            .limit(1);
          if (v) {
            const restoredStock = v.stockQuantity + item.quantity;
            await tx
              .update(productVariants)
              .set({ stockQuantity: restoredStock })
              .where(eq(productVariants.id, v.id));

            await tx.insert(inventoryMovements).values({
              productId: item.productId,
              variantId: item.variantId,
              deltaQuantity: item.quantity,
              previousStock: v.stockQuantity,
              newStock: restoredStock,
              reason: 'ORDER_CANCELLED',
              referenceOrderNumber: order.orderNumber,
              actorEmail: params.actorEmail,
            });
          }
        }
      }

      const [updatedOrder] = await tx
        .update(orders)
        .set({
          orderStatus: targetStatus,
          paymentStatus: targetPayStatus,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id))
        .returning();

      // Update Pickup Details timestamps
      if (order.fulfilmentMethod === 'STORE_PICKUP') {
        const pickupUpdate: Record<string, unknown> = { updatedAt: new Date() };
        if (targetStatus === 'READY_FOR_PICKUP') {
          pickupUpdate.readyAt = new Date();
        }
        if (targetStatus === 'COLLECTED') {
          pickupUpdate.collectedAt = new Date();
          pickupUpdate.verifiedByStaffEmail = params.actorEmail;
          if (params.collectedByName) {
            pickupUpdate.collectedByName = params.collectedByName;
          }
        }
        await tx
          .update(pickupDetails)
          .set(pickupUpdate)
          .where(eq(pickupDetails.orderId, order.id));
      }

      // Update Shipment Details
      if (order.fulfilmentMethod === 'HOME_DELIVERY') {
        const shipUpdate: Record<string, unknown> = { updatedAt: new Date() };
        if (params.courierName !== undefined) shipUpdate.courierName = params.courierName;
        if (params.trackingNumber !== undefined) shipUpdate.trackingNumber = params.trackingNumber;
        if (params.trackingUrl !== undefined) shipUpdate.trackingUrl = params.trackingUrl;
        if (targetStatus === 'DISPATCHED') shipUpdate.dispatchedAt = new Date();
        if (targetStatus === 'DELIVERED') shipUpdate.deliveredAt = new Date();

        await tx
          .update(shipmentDetails)
          .set(shipUpdate)
          .where(eq(shipmentDetails.orderId, order.id));
      }

      // Record offline payment if paymentStatus changed to PAID
      if (targetPayStatus === 'PAID' && currentPayStatus !== 'PAID') {
        await tx.insert(payments).values({
          orderId: order.id,
          provider:
            order.paymentMethod === 'PAY_AT_STORE' ? 'STORE_COUNTER' : 'COD_COLLECTION',
          providerPaymentId:
            params.offlinePaymentReference || `OFFLINE-${Date.now()}`,
          idempotencyKey: `paid_${order.orderNumber}_${Date.now()}`,
          amountPaise: order.totalPaise,
          status: 'PAID_OFFLINE',
          recordedByStaffEmail: params.actorEmail,
        });
      }

      // Record refund if paymentStatus changed to REFUNDED
      if (targetPayStatus === 'REFUNDED' && currentPayStatus !== 'REFUNDED') {
        await tx.insert(refunds).values({
          orderId: order.id,
          amountPaise: order.totalPaise,
          reason: params.note || 'Order refund processed by admin',
          status: 'PROCESSED',
          processedByEmail: params.actorEmail,
        });
      }

      // Activity Log
      await tx.insert(orderActivityLogs).values({
        orderId: order.id,
        statusFrom: currentStatus,
        statusTo: targetStatus,
        paymentStatusFrom: currentPayStatus,
        paymentStatusTo: targetPayStatus,
        actorRole: params.actorRole,
        actorEmail: params.actorEmail,
        note:
          params.note ||
          `Updated status to ${targetStatus} / payment to ${targetPayStatus}.`,
      });

      // Customer Notification
      if (targetStatus !== currentStatus || targetPayStatus !== currentPayStatus) {
        let notifMessage = `Order ${order.orderNumber} is now ${targetStatus.replace(/_/g, ' ')}.`;
        if (targetStatus === 'READY_FOR_PICKUP') {
          notifMessage = `Your order ${order.orderNumber} is READY FOR PICKUP at Gayatri Stationers! Please bring your pickup code to the counter.`;
        } else if (targetStatus === 'DISPATCHED') {
          notifMessage = `Your order ${order.orderNumber} has been dispatched${params.courierName ? ` via ${params.courierName}` : ''}${params.trackingNumber ? ` (Tracking: ${params.trackingNumber})` : ''}.`;
        }

        await tx.insert(notifications).values({
          userId: order.userId,
          orderId: order.id,
          channel: 'IN_APP',
          recipient: order.customerEmail || order.customerPhone,
          subject: `Update on Order ${order.orderNumber}`,
          message: notifMessage,
          status: 'DELIVERED_IN_APP',
        });
      }

      return updatedOrder;
    });
  } catch (error: any) {
    console.error('Admin order workflow update failed:', error);
    throw new Error(error.message || 'Failed to update order status.', { cause: error });
  }
}

/**
 * Processes verified Cashfree or Razorpay online payment or idempotent webhook event.
 */
export async function recordVerifiedOnlinePayment(params: {
  orderNumber: string;
  provider?: 'CASHFREE' | 'RAZORPAY';
  providerOrderId?: string;
  providerPaymentId?: string;
  providerSignature?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  idempotencyKey: string;
  rawPayload?: Record<string, unknown>;
  paymentMethodDetails?: string;
}) {
  try {
    const provider = params.provider || (params.razorpayPaymentId ? 'RAZORPAY' : 'CASHFREE');
    const providerOrderId = params.providerOrderId || params.razorpayOrderId || '';
    const providerPaymentId = params.providerPaymentId || params.razorpayPaymentId || '';
    const providerSignature = params.providerSignature || params.razorpaySignature || '';
    const actorEmail = provider === 'CASHFREE' ? 'cashfree-verifier' : 'razorpay-verifier';

    return await db.transaction(async (tx) => {
      // Check idempotency key first
      const existingPay = await tx
        .select()
        .from(payments)
        .where(eq(payments.idempotencyKey, params.idempotencyKey))
        .limit(1);

      if (existingPay.length > 0 && existingPay[0].status === 'CAPTURED') {
        const [ord] = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, existingPay[0].orderId))
          .limit(1);
        return { alreadyProcessed: true, order: ord };
      }

      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.orderNumber, params.orderNumber))
        .limit(1);

      if (!order) {
        throw new Error(`Order ${params.orderNumber} not found.`);
      }

      const nextStatus: OrderStatus =
        order.orderStatus === 'ORDER_PLACED' ? 'CONFIRMED' : (order.orderStatus as OrderStatus);

      const [updatedOrder] = await tx
        .update(orders)
        .set({
          paymentStatus: 'PAID',
          orderStatus: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id))
        .returning();

      await tx.insert(payments).values({
        orderId: order.id,
        provider,
        providerOrderId,
        providerPaymentId,
        providerSignature,
        idempotencyKey: params.idempotencyKey,
        amountPaise: order.totalPaise,
        status: 'CAPTURED',
        rawWebhookPayload: params.rawPayload || {},
      });

      const note = params.paymentMethodDetails
        ? `Online payment verified via ${provider} (${params.paymentMethodDetails}, Ref: ${providerPaymentId}).`
        : `Online payment verified server-side via ${provider} (Ref: ${providerPaymentId}).`;

      await tx.insert(orderActivityLogs).values({
        orderId: order.id,
        statusFrom: order.orderStatus,
        statusTo: nextStatus,
        paymentStatusFrom: order.paymentStatus,
        paymentStatusTo: 'PAID',
        actorRole: 'system_payment_verifier',
        actorEmail,
        note,
      });

      return { alreadyProcessed: false, order: updatedOrder };
    });
  } catch (error: any) {
    console.error('Failed to record verified online payment:', error);
    throw new Error(error.message || 'Failed to record payment verification.', { cause: error });
  }
}

export async function getAdminDashboardData() {
  try {
    const [
      allOrders,
      allProducts,
      allVariants,
      allMovements,
      allEnquiries,
      allUsers,
      allCoupons,
      allPincodes,
      allCategories,
      allBrands,
      allBundles,
      allNavItems,
      allHomepageSections,
      allBanners,
      allPages,
      allRevisions,
      allNotifications,
    ] = await Promise.all([
      db.select().from(orders).orderBy(desc(orders.createdAt)),
      db.select().from(products).orderBy(desc(products.updatedAt)),
      db.select().from(productVariants).orderBy(asc(productVariants.stockQuantity)),
      db
        .select()
        .from(inventoryMovements)
        .orderBy(desc(inventoryMovements.createdAt))
        .limit(50),
      db.select().from(bulkOrderEnquiries).orderBy(desc(bulkOrderEnquiries.createdAt)),
      db.select().from(users).orderBy(desc(users.createdAt)),
      db.select().from(coupons).orderBy(desc(coupons.createdAt)),
      db.select().from(serviceablePincodes).orderBy(asc(serviceablePincodes.pincode)),
      db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
      db.select().from(brands).orderBy(asc(brands.sortOrder), asc(brands.name)),
      db.select().from(productBundles).orderBy(asc(productBundles.id)),
      db.select().from(cmsNavigationItems).orderBy(asc(cmsNavigationItems.sortOrder), asc(cmsNavigationItems.id)),
      db.select().from(cmsHomepageSections).orderBy(asc(cmsHomepageSections.sortOrder), asc(cmsHomepageSections.id)),
      db.select().from(cmsBanners).orderBy(asc(cmsBanners.sortOrder), asc(cmsBanners.id)),
      db.select().from(cmsPages).orderBy(asc(cmsPages.title)),
      db.select().from(cmsRevisions).orderBy(desc(cmsRevisions.createdAt)).limit(40),
      db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(60),
    ]);

    const todayStr = new Date().toISOString().slice(0, 10);
    const todaysOrders = allOrders.filter(
      (o) => new Date(o.createdAt).toISOString().slice(0, 10) === todayStr
    );
    const pendingOrders = allOrders.filter((o) =>
      ['ORDER_PLACED', 'CONFIRMED', 'PREPARING', 'PROCESSING', 'PACKED'].includes(o.orderStatus)
    );
    const readyForPickupOrders = allOrders.filter(
      (o) => o.orderStatus === 'READY_FOR_PICKUP'
    );
    const pendingOfflinePayments = allOrders.filter(
      (o) =>
        o.paymentStatus === 'PENDING' &&
        o.orderStatus !== 'CANCELLED' &&
        (o.paymentMethod === 'PAY_AT_STORE' || o.paymentMethod === 'COD')
    );

    const paidRevenuePaise = allOrders
      .filter((o) => o.paymentStatus === 'PAID')
      .reduce((sum, o) => sum + o.totalPaise, 0);

    const activeOrdersValuePaise = allOrders
      .filter((o) => o.orderStatus !== 'CANCELLED')
      .reduce((sum, o) => sum + o.totalPaise, 0);

    const prodMap = Object.fromEntries(allProducts.map((p) => [p.id, p]));
    const lowStockVariants = allVariants
      .filter((v) => v.stockQuantity <= v.lowStockThreshold)
      .map((v) => ({
        ...v,
        productName: prodMap[v.productId]?.name || 'Unknown Product',
      }));

    const detailedOrders = await Promise.all(
      allOrders.slice(0, 50).map((o) => getOrderDetailsByNumberOrId(o.id))
    );

    const orderMap = Object.fromEntries(allOrders.map((o) => [o.id, o]));
    const dbNotificationItems = allNotifications.map((n) => {
      const linkedOrder = n.orderId ? orderMap[n.orderId] : null;
      const lowerSub = (n.subject || '').toLowerCase();
      const type = lowerSub.includes('stock')
        ? 'LOW_STOCK'
        : lowerSub.includes('bulk')
        ? 'BULK_ENQUIRY'
        : 'ORDER';
      return {
        id: n.id,
        orderId: n.orderId,
        orderNumber: linkedOrder?.orderNumber || null,
        type,
        subject: n.subject,
        message: n.message,
        recipient: n.recipient,
        status: n.status,
        isRead: n.status === 'READ',
        createdAt: n.createdAt,
      };
    });

    const newBulkCount = allEnquiries.filter((e) => e.status === 'NEW').length;
    const unreadDbCount = dbNotificationItems.filter((n) => !n.isRead).length;

    return {
      metrics: {
        todaysOrdersCount: todaysOrders.length,
        pendingOrdersCount: pendingOrders.length,
        readyForPickupCount: readyForPickupOrders.length,
        pendingOfflinePaymentsCount: pendingOfflinePayments.length,
        paidRevenuePaise,
        activeOrdersValuePaise,
        totalOrdersCount: allOrders.length,
        lowStockCount: lowStockVariants.length,
        newBulkEnquiriesCount: newBulkCount,
        unreadNotificationsCount: unreadDbCount,
      },
      notifications: dbNotificationItems,
      lowStockVariants,
      orders: detailedOrders.filter(Boolean),
      inventoryMovements: allMovements.map((m) => ({
        ...m,
        productName: prodMap[m.productId]?.name || 'Product',
      })),
      bulkEnquiries: allEnquiries,
      users: allUsers,
      coupons: allCoupons,
      serviceablePincodes: allPincodes,
      categories: allCategories,
      brands: allBrands,
      bundles: allBundles,
      navigationItems: allNavItems,
      homepageSections: allHomepageSections,
      banners: allBanners,
      pages: allPages,
      revisions: allRevisions,
    };
  } catch (error) {
    console.error('Failed to load admin dashboard data:', error);
    throw new Error('Failed to load admin dashboard data.', { cause: error });
  }
}

export async function markNotificationReadByAdmin(notificationId: number) {
  const [updated] = await db
    .update(notifications)
    .set({ status: 'READ' })
    .where(eq(notifications.id, Number(notificationId)))
    .returning();
  return updated || null;
}

export async function markAllNotificationsReadByAdmin() {
  const allRows = await db.select().from(notifications);
  let count = 0;
  for (const row of allRows) {
    if (row.status !== 'READ') {
      await db
        .update(notifications)
        .set({ status: 'READ' })
        .where(eq(notifications.id, row.id));
      count++;
    }
  }
  return { updatedCount: count };
}

export async function adjustVariantInventoryByAdmin(params: {
  variantId: number;
  newStockQuantity: number;
  reason: string;
  actorEmail: string;
}) {
  try {
    return await db.transaction(async (tx) => {
      const [variant] = await tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, params.variantId))
        .limit(1);

      if (!variant) {
        throw new Error('Product variant not found.');
      }

      const cleanStock = Math.max(0, Math.floor(params.newStockQuantity));
      const delta = cleanStock - variant.stockQuantity;

      const [updated] = await tx
        .update(productVariants)
        .set({ stockQuantity: cleanStock })
        .where(eq(productVariants.id, variant.id))
        .returning();

      await tx.insert(inventoryMovements).values({
        productId: variant.productId,
        variantId: variant.id,
        deltaQuantity: delta,
        previousStock: variant.stockQuantity,
        newStock: cleanStock,
        reason: params.reason || 'ADMIN_ADJUSTMENT',
        referenceOrderNumber: 'MANUAL-ADJ',
        actorEmail: params.actorEmail,
      });

      return updated;
    });
  } catch (error: any) {
    console.error('Inventory adjustment error:', error);
    throw new Error(error.message || 'Failed to update inventory.', { cause: error });
  }
}

export function sanitizeDbError(error: any, fallbackMessage: string): Error {
  const rawMessage = typeof error?.message === 'string' ? error.message : '';
  const pgCode = error?.cause?.code || error?.code;

  if (pgCode === '23505') {
    const constraint = error?.cause?.constraint || error?.constraint || '';
    if (constraint.includes('sku')) {
      return new Error('A product or variant with this SKU already exists.', { cause: error });
    }
    if (constraint.includes('slug')) {
      return new Error('A record with a conflicting URL slug already exists.', { cause: error });
    }
    if (constraint.includes('code')) {
      return new Error('This coupon code already exists.', { cause: error });
    }
    return new Error('A record with these unique details already exists.', { cause: error });
  }

  if (pgCode === '23503') {
    return new Error('The selected category, brand, or referenced item is invalid.', {
      cause: error,
    });
  }

  if (!rawMessage || rawMessage.startsWith('Failed query:')) {
    return new Error(fallbackMessage, { cause: error });
  }

  return new Error(rawMessage, { cause: error });
}

export async function createOrUpdateProductByAdmin(params: {
  id?: number;
  sku: string;
  name: string;
  slug?: string;
  categoryId: number;
  subcategoryId?: number | null;
  secondaryCategoryIds?: number[];
  newCategoryName?: string;
  newCategoryDescription?: string;
  brandId?: number;
  newBrandName?: string;
  newBrandDescription?: string;
  shortDescription: string;
  description: string;
  specifications?: Record<string, string>;
  tags?: string[];
  badgeText?: string;
  mrpPaise: number;
  sellingPricePaise: number;
  taxRatePercent: number;
  illustrationType?: string;
  imageUrl?: string;
  galleryUrls?: string[];
  pickupEligible: boolean;
  deliveryEligible: boolean;
  isFeatured: boolean;
  isBestseller: boolean;
  isNewArrival: boolean;
  isActive: boolean;
  status?: string;
  seoTitle?: string;
  seoDescription?: string;
  isSampleData: boolean;
  initialStockQuantity?: number;
  lowStockThreshold?: number;
  variantName?: string;
  actorEmail: string;
}) {
  try {
    const cleanSku = (params.sku || '').trim().toUpperCase();
    const cleanName = (params.name || '').trim();
    if (!cleanSku || !cleanName) {
      throw new Error('Product SKU and Product Name are required.');
    }
    if (params.sellingPricePaise > params.mrpPaise) {
      throw new Error('Selling price cannot exceed MRP.');
    }

    return await db.transaction(async (tx) => {
      let targetCategoryId = Number(params.categoryId);
      if (params.newCategoryName && params.newCategoryName.trim().length > 0) {
        const cleanCatName = params.newCategoryName.trim();
        const catSlug =
          cleanCatName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') || `category-${Date.now().toString().slice(-4)}`;
        const allCats = await tx.select().from(categories);
        const existingCat = allCats.find(
          (c) => c.name.toLowerCase() === cleanCatName.toLowerCase() || c.slug === catSlug
        );
        if (existingCat) {
          targetCategoryId = existingCat.id;
        } else {
          const [createdCat] = await tx
            .insert(categories)
            .values({
              name: cleanCatName,
              slug: catSlug,
              description: (params.newCategoryDescription || `${cleanCatName} stationery and supplies`).trim(),
              sortOrder: allCats.length + 1,
              showInNav: true,
              showOnHome: true,
              showInFooter: true,
              status: 'PUBLISHED',
              isActive: true,
              isSampleData: false,
            })
            .returning();
          targetCategoryId = createdCat.id;
        }
      }

      let targetBrandId: number | null = params.brandId ? Number(params.brandId) : null;
      if (params.newBrandName && params.newBrandName.trim().length > 0) {
        const cleanBrandName = params.newBrandName.trim();
        const brandSlug =
          cleanBrandName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') || `brand-${Date.now().toString().slice(-4)}`;
        const allBrandsList = await tx.select().from(brands);
        const existingBrand = allBrandsList.find(
          (b) => b.name.toLowerCase() === cleanBrandName.toLowerCase() || b.slug === brandSlug
        );
        if (existingBrand) {
          targetBrandId = existingBrand.id;
        } else {
          const [createdBrand] = await tx
            .insert(brands)
            .values({
              name: cleanBrandName,
              slug: brandSlug,
              description: (params.newBrandDescription || `Authorized ${cleanBrandName} stationery range`).trim(),
              isFeatured: true,
              showInNav: true,
              sortOrder: allBrandsList.length + 1,
              status: 'PUBLISHED',
              isActive: true,
              isSampleData: false,
            })
            .returning();
          targetBrandId = createdBrand.id;
        }
      }

      const baseSlug =
        (params.slug || cleanName)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || 'stationery-item';

      // Check if product already exists by id OR by SKU (so re-submitting an existing SKU updates cleanly)
      let existingProduct: typeof products.$inferSelect | undefined;
      if (params.id) {
        const byId = await tx
          .select()
          .from(products)
          .where(eq(products.id, params.id))
          .limit(1);
        existingProduct = byId[0];
      }
      if (!existingProduct) {
        const bySku = await tx
          .select()
          .from(products)
          .where(eq(products.sku, cleanSku))
          .limit(1);
        existingProduct = bySku[0];
      }

      const nextStatus = params.status || (params.isActive === false ? 'HIDDEN' : 'PUBLISHED');
      const nextIsActive = nextStatus === 'PUBLISHED';

      if (existingProduct) {
        const existingGallery = Array.isArray(existingProduct.galleryUrls)
          ? existingProduct.galleryUrls
          : [];
        const nextImageUrl =
          params.imageUrl !== undefined ? params.imageUrl : existingProduct.imageUrl || '';
        const baseGallery =
          params.galleryUrls !== undefined ? params.galleryUrls : existingGallery;
        const normalizedGallery = Array.from(
          new Set(
            [...(nextImageUrl ? [nextImageUrl] : []), ...baseGallery].filter(
              (u) => typeof u === 'string' && u.trim().length > 0
            )
          )
        );

        const mergedSpecs: Record<string, string> = {
          ...(existingProduct.specifications || {}),
          ...(params.specifications || {}),
        };
        if (params.badgeText !== undefined) mergedSpecs._badgeText = params.badgeText;
        if (params.tags !== undefined) mergedSpecs._tags = params.tags.join(', ');
        if (params.seoTitle !== undefined) mergedSpecs._seoTitle = params.seoTitle;
        if (params.seoDescription !== undefined) mergedSpecs._seoDescription = params.seoDescription;

        const [updated] = await tx
          .update(products)
          .set({
            sku: cleanSku,
            name: cleanName,
            categoryId: targetCategoryId,
            subcategoryId:
              params.subcategoryId !== undefined ? params.subcategoryId : existingProduct.subcategoryId,
            secondaryCategoryIds:
              params.secondaryCategoryIds !== undefined
                ? params.secondaryCategoryIds
                : existingProduct.secondaryCategoryIds,
            brandId: targetBrandId,
            shortDescription: (params.shortDescription || cleanName).trim(),
            description: (params.description || params.shortDescription || cleanName).trim(),
            specifications: mergedSpecs,
            mrpPaise: params.mrpPaise,
            sellingPricePaise: params.sellingPricePaise,
            taxRatePercent: params.taxRatePercent ?? 12,
            imageUrl: nextImageUrl,
            galleryUrls: normalizedGallery,
            illustrationType:
              params.illustrationType || existingProduct.illustrationType || 'notebook',
            pickupEligible: params.pickupEligible,
            deliveryEligible: params.deliveryEligible,
            isFeatured: params.isFeatured,
            isBestseller: params.isBestseller,
            isNewArrival: params.isNewArrival,
            status: nextStatus,
            isActive: nextIsActive,
            isSampleData: params.isSampleData,
            updatedAt: new Date(),
          })
          .where(eq(products.id, existingProduct.id))
          .returning();

        // Also synchronize the primary variant price & stock if provided
        const existingVariants = await tx
          .select()
          .from(productVariants)
          .where(eq(productVariants.productId, existingProduct.id))
          .orderBy(asc(productVariants.id));

        const targetStock =
          params.initialStockQuantity !== undefined
            ? Math.max(0, Math.floor(params.initialStockQuantity))
            : undefined;

        if (existingVariants.length > 0) {
          const primaryVar = existingVariants[0];
          const nextStock = targetStock !== undefined ? targetStock : primaryVar.stockQuantity;
          const stockDelta = nextStock - primaryVar.stockQuantity;

          await tx
            .update(productVariants)
            .set({
              variantName: params.variantName || primaryVar.variantName,
              mrpPaise: params.mrpPaise,
              sellingPricePaise: params.sellingPricePaise,
              stockQuantity: nextStock,
              lowStockThreshold:
                params.lowStockThreshold !== undefined
                  ? Math.max(1, Math.floor(params.lowStockThreshold))
                  : primaryVar.lowStockThreshold,
            })
            .where(eq(productVariants.id, primaryVar.id));

          if (stockDelta !== 0) {
            await tx.insert(inventoryMovements).values({
              productId: existingProduct.id,
              variantId: primaryVar.id,
              deltaQuantity: stockDelta,
              previousStock: primaryVar.stockQuantity,
              newStock: nextStock,
              reason: 'ADMIN_PRODUCT_UPDATED',
              referenceOrderNumber: cleanSku,
              actorEmail: params.actorEmail,
            });
          }
        } else {
          const initStock = targetStock ?? 25;
          const [createdVariant] = await tx
            .insert(productVariants)
            .values({
              productId: existingProduct.id,
              sku: `${cleanSku}-STD`,
              variantName: params.variantName || 'Standard Unit',
              attributeType: 'Format',
              attributeValue: 'Standard',
              mrpPaise: params.mrpPaise,
              sellingPricePaise: params.sellingPricePaise,
              stockQuantity: initStock,
              lowStockThreshold: params.lowStockThreshold ?? 10,
              isActive: true,
            })
            .returning();

          await tx.insert(inventoryMovements).values({
            productId: existingProduct.id,
            variantId: createdVariant.id,
            deltaQuantity: initStock,
            previousStock: 0,
            newStock: initStock,
            reason: 'ADMIN_PRODUCT_UPDATED',
            referenceOrderNumber: cleanSku,
            actorEmail: params.actorEmail,
          });
        }

        return updated;
      } else {
        const uniqueSlug = `${baseSlug}-${cleanSku.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()
          .toString()
          .slice(-4)}`;

        const nextImageUrl = params.imageUrl || '';
        const normalizedGallery = Array.from(
          new Set(
            [...(nextImageUrl ? [nextImageUrl] : []), ...(params.galleryUrls || [])].filter(
              (u) => typeof u === 'string' && u.trim().length > 0
            )
          )
        );

        const initialSpecs: Record<string, string> = {
          ...(params.specifications || {}),
        };
        if (params.badgeText) initialSpecs._badgeText = params.badgeText;
        if (params.tags && params.tags.length > 0) initialSpecs._tags = params.tags.join(', ');
        if (params.seoTitle) initialSpecs._seoTitle = params.seoTitle;
        if (params.seoDescription) initialSpecs._seoDescription = params.seoDescription;

        const [created] = await tx
          .insert(products)
          .values({
            sku: cleanSku,
            name: cleanName,
            slug: uniqueSlug,
            categoryId: targetCategoryId,
            subcategoryId: params.subcategoryId || null,
            secondaryCategoryIds: params.secondaryCategoryIds || [],
            brandId: targetBrandId,
            shortDescription: (params.shortDescription || cleanName).trim(),
            description: (params.description || params.shortDescription || cleanName).trim(),
            specifications: initialSpecs,
            mrpPaise: params.mrpPaise,
            sellingPricePaise: params.sellingPricePaise,
            taxRatePercent: params.taxRatePercent ?? 12,
            imageUrl: nextImageUrl,
            galleryUrls: normalizedGallery,
            illustrationType: params.illustrationType || 'notebook',
            pickupEligible: params.pickupEligible,
            deliveryEligible: params.deliveryEligible,
            isFeatured: params.isFeatured,
            isBestseller: params.isBestseller,
            isNewArrival: params.isNewArrival,
            status: nextStatus,
            isActive: nextIsActive,
            isSampleData: params.isSampleData,
          })
          .returning();

        const initialStock = Math.max(0, Math.floor(params.initialStockQuantity ?? 25));
        const variantSku = `${created.sku}-STD`;

        const [createdVariant] = await tx
          .insert(productVariants)
          .values({
            productId: created.id,
            sku: variantSku,
            variantName: params.variantName || 'Standard Unit',
            attributeType: 'Format',
            attributeValue: 'Standard',
            mrpPaise: params.mrpPaise,
            sellingPricePaise: params.sellingPricePaise,
            stockQuantity: initialStock,
            lowStockThreshold: params.lowStockThreshold ?? 10,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: productVariants.sku,
            set: {
              productId: created.id,
              variantName: params.variantName || 'Standard Unit',
              mrpPaise: params.mrpPaise,
              sellingPricePaise: params.sellingPricePaise,
              stockQuantity: initialStock,
              isActive: true,
            },
          })
          .returning();

        await tx.insert(inventoryMovements).values({
          productId: created.id,
          variantId: createdVariant.id,
          deltaQuantity: initialStock,
          previousStock: 0,
          newStock: initialStock,
          reason: 'ADMIN_PRODUCT_CREATED',
          referenceOrderNumber: created.sku,
          actorEmail: params.actorEmail,
        });

        return created;
      }
    });
  } catch (error: any) {
    console.error('Create/update product failed:', error);
    throw sanitizeDbError(
      error,
      'Failed to save product. Please check the SKU, prices, and category.'
    );
  }
}

export async function associateProductImagesByAdmin(params: {
  productId: number;
  imageUrl?: string;
  newImageUrls?: string[];
  galleryUrls?: string[];
  setAsPrimary?: boolean;
  removeImageUrl?: string;
  actorEmail: string;
}) {
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(products)
        .where(eq(products.id, Number(params.productId)))
        .limit(1);

      if (!existing) {
        throw new Error('Product not found.');
      }

      const currentGallery = Array.isArray(existing.galleryUrls) ? existing.galleryUrls : [];
      let nextGallery = params.galleryUrls !== undefined ? [...params.galleryUrls] : [...currentGallery];
      if (existing.imageUrl && !nextGallery.includes(existing.imageUrl)) {
        nextGallery.unshift(existing.imageUrl);
      }

      const incomingUrls = [
        ...(params.imageUrl ? [params.imageUrl] : []),
        ...(Array.isArray(params.newImageUrls) ? params.newImageUrls : []),
      ].filter((u) => typeof u === 'string' && u.trim().length > 0);

      for (const url of incomingUrls) {
        if (!nextGallery.includes(url)) {
          nextGallery.push(url);
        }
      }

      let nextPrimary = existing.imageUrl || '';
      if (params.setAsPrimary && incomingUrls.length > 0) {
        nextPrimary = incomingUrls[0];
      } else if (params.imageUrl !== undefined && params.setAsPrimary !== false) {
        nextPrimary = params.imageUrl;
      } else if (!nextPrimary && incomingUrls.length > 0) {
        nextPrimary = incomingUrls[0];
      }

      if (params.removeImageUrl) {
        nextGallery = nextGallery.filter((u) => u !== params.removeImageUrl);
        if (nextPrimary === params.removeImageUrl) {
          nextPrimary = nextGallery[0] || '';
        }
      }

      if (nextPrimary) {
        nextGallery = [nextPrimary, ...nextGallery.filter((u) => u !== nextPrimary)];
      }

      const [updated] = await tx
        .update(products)
        .set({
          imageUrl: nextPrimary,
          galleryUrls: nextGallery,
          updatedAt: new Date(),
        })
        .where(eq(products.id, existing.id))
        .returning();

      return updated;
    });
  } catch (error: any) {
    console.error('Associate product images error:', error);
    throw sanitizeDbError(error, 'Failed to associate uploaded images with product.');
  }
}

export async function deleteProductByAdmin(params: {
  productId?: number;
  sku?: string;
  name?: string;
  actorEmail: string;
}) {
  try {
    return await db.transaction(async (tx) => {
      let target: typeof products.$inferSelect | undefined;
      if (params.productId && !Number.isNaN(Number(params.productId))) {
        const found = await tx
          .select()
          .from(products)
          .where(eq(products.id, Number(params.productId)))
          .limit(1);
        target = found[0];
      }
      if (!target && params.sku) {
        const cleanSku = params.sku.trim().toUpperCase();
        const found = await tx
          .select()
          .from(products)
          .where(eq(products.sku, cleanSku))
          .limit(1);
        target = found[0];
      }
      if (!target && params.name) {
        const cleanName = params.name.trim().toLowerCase();
        const allProds = await tx.select().from(products);
        target =
          allProds.find((p) => p.name.toLowerCase() === cleanName) ||
          allProds.find((p) => p.name.toLowerCase().includes(cleanName));
      }

      if (!target) {
        throw new Error('Product not found to remove.');
      }

      // Check if referenced in historical orders
      const referencedOrders = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.productId, target.id))
        .limit(1);

      await tx.delete(cartItems).where(eq(cartItems.productId, target.id));

      if (referencedOrders.length > 0) {
        // Soft-delete / archive so order history remains intact
        const [archived] = await tx
          .update(products)
          .set({
            isActive: false,
            status: 'HIDDEN',
            updatedAt: new Date(),
          })
          .where(eq(products.id, target.id))
          .returning();
        await tx
          .update(productVariants)
          .set({ isActive: false })
          .where(eq(productVariants.productId, target.id));
        return { deleted: true, softDeleted: true, product: archived };
      }

      await tx.delete(inventoryMovements).where(eq(inventoryMovements.productId, target.id));
      await tx.delete(productVariants).where(eq(productVariants.productId, target.id));
      const [deletedProd] = await tx
        .delete(products)
        .where(eq(products.id, target.id))
        .returning();

      return { deleted: true, softDeleted: false, product: deletedProd };
    });
  } catch (error: any) {
    console.error('Delete product error:', error);
    throw sanitizeDbError(error, 'Failed to delete product.');
  }
}

export async function importProductsFromCsvByAdmin(csvText: string, actorEmail: string) {
  try {
    const parsed = parseCatalogueCsv(csvText);
    if (parsed.errors.length > 0 && parsed.rows.length === 0) {
      throw new Error(parsed.errors.join(' | '));
    }

    const importedCount = await db.transaction(async (tx) => {
      const allCategories = await tx.select().from(categories);
      const allBrands = await tx.select().from(brands);
      const catBySlug = Object.fromEntries(allCategories.map((c) => [c.slug, c]));
      const brandByName = Object.fromEntries(
        allBrands.map((b) => [b.name.toLowerCase(), b])
      );

      let count = 0;
      for (const row of parsed.rows) {
        let category = catBySlug[row.categorySlug];
        if (!category) {
          const [newCat] = await tx
            .insert(categories)
            .values({
              name: row.categorySlug
                .split('-')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' '),
              slug: row.categorySlug,
              isActive: true,
              isSampleData: row.isSampleData,
            })
            .returning();
          category = newCat;
          catBySlug[row.categorySlug] = newCat;
        }

        let brand = brandByName[row.brandName.toLowerCase()];
        if (!brand) {
          const brandSlug = row.brandName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
          const [newBrand] = await tx
            .insert(brands)
            .values({
              name: row.brandName,
              slug: `${brandSlug}-${Date.now().toString().slice(-3)}`,
              isActive: true,
              isSampleData: row.isSampleData,
            })
            .returning();
          brand = newBrand;
          brandByName[row.brandName.toLowerCase()] = newBrand;
        }

        const existingProd = await tx
          .select()
          .from(products)
          .where(eq(products.sku, row.sku))
          .limit(1);

        let productRecord = existingProd[0];
        if (!productRecord) {
          const slug = `${row.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')}-${row.sku.toLowerCase()}`;
          const [createdProd] = await tx
            .insert(products)
            .values({
              sku: row.sku,
              name: row.name,
              slug,
              categoryId: category.id,
              brandId: brand.id,
              shortDescription: row.shortDescription,
              description: row.shortDescription,
              mrpPaise: row.mrpPaise,
              sellingPricePaise: row.sellingPricePaise,
              taxRatePercent: row.taxRatePercent,
              pickupEligible: row.pickupEligible,
              deliveryEligible: row.deliveryEligible,
              isSampleData: row.isSampleData,
              isActive: true,
            })
            .returning();
          productRecord = createdProd;
        }

        const existingVar = await tx
          .select()
          .from(productVariants)
          .where(eq(productVariants.sku, row.variantSku))
          .limit(1);

        if (existingVar.length > 0) {
          const prev = existingVar[0];
          await tx
            .update(productVariants)
            .set({
              mrpPaise: row.mrpPaise,
              sellingPricePaise: row.sellingPricePaise,
              stockQuantity: row.stockQuantity,
            })
            .where(eq(productVariants.id, prev.id));

          await tx.insert(inventoryMovements).values({
            productId: productRecord.id,
            variantId: prev.id,
            deltaQuantity: row.stockQuantity - prev.stockQuantity,
            previousStock: prev.stockQuantity,
            newStock: row.stockQuantity,
            reason: 'CSV_IMPORT',
            referenceOrderNumber: 'CSV-BULK',
            actorEmail,
          });
        } else {
          const [createdVar] = await tx
            .insert(productVariants)
            .values({
              productId: productRecord.id,
              sku: row.variantSku,
              variantName: row.variantName,
              attributeType: row.attributeType,
              attributeValue: row.attributeValue,
              mrpPaise: row.mrpPaise,
              sellingPricePaise: row.sellingPricePaise,
              stockQuantity: row.stockQuantity,
              isActive: true,
            })
            .returning();

          await tx.insert(inventoryMovements).values({
            productId: productRecord.id,
            variantId: createdVar.id,
            deltaQuantity: row.stockQuantity,
            previousStock: 0,
            newStock: row.stockQuantity,
            reason: 'CSV_IMPORT',
            referenceOrderNumber: 'CSV-BULK',
            actorEmail,
          });
        }
        count++;
      }
      return count;
    });

    return {
      importedCount,
      warnings: parsed.errors,
    };
  } catch (error: any) {
    console.error('CSV import failed:', error);
    throw new Error(error.message || 'Failed to import CSV catalogue.', { cause: error });
  }
}

export async function createBulkOrderEnquiry(params: {
  institutionName: string;
  contactPerson: string;
  email: string;
  phone: string;
  gstin?: string;
  deliveryPincode?: string;
  requiredByDate?: string;
  itemsRequested: Array<{
    itemName: string;
    skuOrCategory: string;
    quantity: number;
    targetPriceNote?: string;
  }>;
  notes?: string;
}) {
  try {
    if (!params.institutionName?.trim() || !params.contactPerson?.trim() || !params.phone?.trim()) {
      throw new Error('Institution name, contact person, and phone number are required.');
    }
    if (!params.itemsRequested || params.itemsRequested.length === 0) {
      throw new Error('Please include at least one stationery item in your bulk enquiry.');
    }

    const enquiryNumber = `BLK-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(
      100 + Math.random() * 900
    )}`;

    const [created] = await db
      .insert(bulkOrderEnquiries)
      .values({
        enquiryNumber,
        institutionName: params.institutionName.trim(),
        contactPerson: params.contactPerson.trim(),
        email: params.email.trim(),
        phone: params.phone.trim(),
        gstin: params.gstin?.trim().toUpperCase() || '',
        deliveryPincode: params.deliveryPincode?.trim() || '',
        requiredByDate: params.requiredByDate?.trim() || '',
        itemsRequestedJson: params.itemsRequested,
        notes: params.notes?.trim() || '',
        status: 'NEW',
      })
      .returning();

    await db.insert(notifications).values({
      userId: null,
      orderId: null,
      channel: 'IN_APP',
      recipient: 'admin@gayatristationers.co.in',
      subject: `New Bulk Order Enquiry ${enquiryNumber} — ${params.institutionName.trim()}`,
      message: `${params.contactPerson.trim()} (${params.phone.trim()}) submitted a bulk enquiry for ${params.itemsRequested.length} stationery item(s).`,
      status: 'UNREAD',
    });

    return created;
  } catch (error: any) {
    console.error('Bulk order enquiry failed:', error);
    throw new Error(error.message || 'Failed to submit bulk order enquiry.', { cause: error });
  }
}

export async function updateBulkEnquiryByAdmin(params: {
  id: number;
  status: string;
  quotedAmountPaise?: number;
  adminNotes?: string;
}) {
  try {
    const [updated] = await db
      .update(bulkOrderEnquiries)
      .set({
        status: params.status,
        quotedAmountPaise: params.quotedAmountPaise ?? null,
        adminNotes: params.adminNotes ?? '',
        updatedAt: new Date(),
      })
      .where(eq(bulkOrderEnquiries.id, params.id))
      .returning();
    return updated;
  } catch (error) {
    console.error('Failed to update bulk enquiry:', error);
    throw new Error('Failed to update bulk enquiry.', { cause: error });
  }
}

export async function upsertServiceablePincodeByAdmin(params: {
  pincode: string;
  city: string;
  state: string;
  deliveryFeePaise: number;
  freeDeliveryThresholdPaise: number;
  codAvailable: boolean;
  estimatedDays: string;
  isActive: boolean;
}) {
  try {
    const [upserted] = await db
      .insert(serviceablePincodes)
      .values({
        pincode: params.pincode.trim(),
        city: params.city.trim(),
        state: params.state.trim(),
        deliveryFeePaise: params.deliveryFeePaise,
        freeDeliveryThresholdPaise: params.freeDeliveryThresholdPaise,
        codAvailable: params.codAvailable,
        estimatedDays: params.estimatedDays.trim(),
        isActive: params.isActive,
        isSampleRule: false,
      })
      .onConflictDoUpdate({
        target: serviceablePincodes.pincode,
        set: {
          city: params.city.trim(),
          state: params.state.trim(),
          deliveryFeePaise: params.deliveryFeePaise,
          freeDeliveryThresholdPaise: params.freeDeliveryThresholdPaise,
          codAvailable: params.codAvailable,
          estimatedDays: params.estimatedDays.trim(),
          isActive: params.isActive,
          isSampleRule: false,
        },
      })
      .returning();
    return upserted;
  } catch (error) {
    console.error('Failed to upsert pincode rule:', error);
    throw new Error('Failed to save PIN code rule.', { cause: error });
  }
}

export async function upsertCouponByAdmin(params: {
  code: string;
  description: string;
  discountType: 'PERCENTAGE' | 'FLAT_PAISE';
  discountValue: number;
  minOrderPaise: number;
  maxDiscountPaise: number;
  usageLimit: number;
  isActive: boolean;
}) {
  try {
    const cleanCode = params.code.trim().toUpperCase();
    const [upserted] = await db
      .insert(coupons)
      .values({
        code: cleanCode,
        description: params.description.trim(),
        discountType: params.discountType,
        discountValue: params.discountValue,
        minOrderPaise: params.minOrderPaise,
        maxDiscountPaise: params.maxDiscountPaise,
        usageLimit: params.usageLimit,
        isActive: params.isActive,
      })
      .onConflictDoUpdate({
        target: coupons.code,
        set: {
          description: params.description.trim(),
          discountType: params.discountType,
          discountValue: params.discountValue,
          minOrderPaise: params.minOrderPaise,
          maxDiscountPaise: params.maxDiscountPaise,
          usageLimit: params.usageLimit,
          isActive: params.isActive,
        },
      })
      .returning();
    return upserted;
  } catch (error) {
    console.error('Failed to upsert coupon:', error);
    throw new Error('Failed to save coupon.', { cause: error });
  }
}

export async function updateStoreSettingByAdmin(key: string, valueJson: Record<string, unknown>) {
  try {
    const [upserted] = await db
      .insert(storeSettings)
      .values({ key, valueJson, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: storeSettings.key,
        set: { valueJson, updatedAt: new Date() },
      })
      .returning();
    return upserted;
  } catch (error) {
    console.error('Failed to update store setting:', error);
    throw new Error('Failed to update store setting.', { cause: error });
  }
}

export async function updateUserRoleById(userId: number, role: 'customer' | 'staff' | 'owner') {
  try {
    const [updated] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  } catch (error) {
    console.error('Failed to update user role:', error);
    throw new Error('Failed to update user role.', { cause: error });
  }
}

export async function updateUserProfileById(params: {
  userId: number;
  fullName?: string;
  phone?: string;
}) {
  try {
    const updateSet: Record<string, any> = { updatedAt: new Date() };
    if (params.fullName !== undefined && params.fullName.trim()) {
      updateSet.fullName = params.fullName.trim();
    }
    if (params.phone !== undefined) {
      updateSet.phone = params.phone.trim() || null;
    }
    const [updated] = await db
      .update(users)
      .set(updateSet)
      .where(eq(users.id, params.userId))
      .returning();
    return updated;
  } catch (error) {
    console.error('Failed to update user profile:', error);
    throw new Error('Failed to update user profile.', { cause: error });
  }
}

// ============================================================================
// STORE CMS MANAGEMENT REPOSITORY FUNCTIONS
// ============================================================================

async function logCmsRevision(params: {
  entityType: string;
  entityId: string;
  action: string;
  snapshotJson: Record<string, unknown>;
  actorEmail: string;
  summary?: string;
}) {
  try {
    await db.insert(cmsRevisions).values({
      entityType: params.entityType,
      entityKey: params.entityId,
      action: params.action,
      snapshotJson: params.snapshotJson,
      actorEmail: params.actorEmail,
      summary: params.summary || `${params.action} ${params.entityType} (${params.entityId})`,
    });
  } catch (err) {
    console.warn('CMS revision log warning:', err);
  }
}

export async function upsertCategoryByAdmin(params: {
  id?: number;
  name: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  bannerUrl?: string;
  iconName?: string;
  parentId?: number | null;
  sortOrder?: number;
  showInNav?: boolean;
  showOnHomepage?: boolean;
  showInFooter?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  status?: string;
  isActive?: boolean;
  actorEmail?: string;
}) {
  try {
    const cleanName = (params.name || '').trim();
    if (!cleanName) {
      throw new Error('Category name is required.');
    }
    const cleanSlug =
      (params.slug || cleanName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || `category-${Date.now().toString().slice(-4)}`;

    const nextStatus = params.status || (params.isActive === false ? 'HIDDEN' : 'PUBLISHED');
    const nextIsActive = nextStatus === 'PUBLISHED';

    const allCats = await db.select().from(categories);
    let existing = params.id ? allCats.find((c) => c.id === Number(params.id)) : undefined;
    if (!existing) {
      existing = allCats.find(
        (c) => c.slug === cleanSlug || c.name.toLowerCase() === cleanName.toLowerCase()
      );
    }

    if (existing) {
      // Prevent circular parentId
      const safeParentId =
        params.parentId && Number(params.parentId) !== existing.id ? Number(params.parentId) : null;

      const [updated] = await db
        .update(categories)
        .set({
          name: cleanName,
          slug: cleanSlug,
          description: params.description !== undefined ? params.description.trim() : existing.description,
          imageUrl: params.imageUrl !== undefined ? params.imageUrl : existing.imageUrl,
          iconName: params.iconName !== undefined ? params.iconName : existing.iconName,
          parentId: params.parentId !== undefined ? safeParentId : existing.parentId,
          sortOrder: params.sortOrder !== undefined ? Number(params.sortOrder) : existing.sortOrder,
          showInNav: params.showInNav !== undefined ? Boolean(params.showInNav) : existing.showInNav,
          showOnHome:
            params.showOnHomepage !== undefined ? Boolean(params.showOnHomepage) : existing.showOnHome,
          showInFooter:
            params.showInFooter !== undefined ? Boolean(params.showInFooter) : existing.showInFooter,
          seoTitle: params.seoTitle !== undefined ? params.seoTitle.trim() : existing.seoTitle,
          seoDescription:
            params.seoDescription !== undefined ? params.seoDescription.trim() : existing.seoDescription,
          status: nextStatus,
          isActive: nextIsActive,
          isSampleData: false,
        })
        .where(eq(categories.id, existing.id))
        .returning();

      await logCmsRevision({
        entityType: 'CATEGORY',
        entityId: String(updated.id),
        action: 'UPDATED',
        snapshotJson: updated as unknown as Record<string, unknown>,
        actorEmail: params.actorEmail || 'owner',
      });

      return updated;
    } else {
      const [created] = await db
        .insert(categories)
        .values({
          name: cleanName,
          slug: cleanSlug,
          description: (params.description || `${cleanName} stationery & supplies`).trim(),
          imageUrl: params.imageUrl || '',
          iconName: params.iconName || 'FolderOpen',
          parentId: params.parentId ? Number(params.parentId) : null,
          sortOrder: params.sortOrder !== undefined ? Number(params.sortOrder) : allCats.length + 1,
          showInNav: params.showInNav !== undefined ? Boolean(params.showInNav) : true,
          showOnHome: params.showOnHomepage !== undefined ? Boolean(params.showOnHomepage) : true,
          showInFooter: params.showInFooter !== undefined ? Boolean(params.showInFooter) : true,
          seoTitle: (params.seoTitle || '').trim(),
          seoDescription: (params.seoDescription || '').trim(),
          status: nextStatus,
          isActive: nextIsActive,
          isSampleData: false,
        })
        .returning();

      await logCmsRevision({
        entityType: 'CATEGORY',
        entityId: String(created.id),
        action: 'CREATED',
        snapshotJson: created as unknown as Record<string, unknown>,
        actorEmail: params.actorEmail || 'owner',
      });

      return created;
    }
  } catch (error: any) {
    console.error('Upsert category error:', error);
    throw sanitizeDbError(error, 'Failed to save category.');
  }
}

export async function deleteOrArchiveCategoryByAdmin(id: number, actorEmail: string) {
  try {
    const prodList = await db.select().from(products).where(eq(products.categoryId, id));
    const subCats = await db.select().from(categories).where(eq(categories.parentId, id));

    if (prodList.length > 0 || subCats.length > 0) {
      // Safe archive instead of hard delete to prevent broken references
      const [archived] = await db
        .update(categories)
        .set({ status: 'ARCHIVED', isActive: false, showInNav: false })
        .where(eq(categories.id, id))
        .returning();
      await logCmsRevision({
        entityType: 'CATEGORY',
        entityId: String(id),
        action: 'ARCHIVED_SAFE',
        snapshotJson: { id, reason: 'Has linked products or subcategories' },
        actorEmail,
      });
      return { action: 'ARCHIVED', category: archived };
    }

    await db.delete(categories).where(eq(categories.id, id));
    await logCmsRevision({
      entityType: 'CATEGORY',
      entityId: String(id),
      action: 'DELETED',
      snapshotJson: { id },
      actorEmail,
    });
    return { action: 'DELETED', id };
  } catch (error: any) {
    throw sanitizeDbError(error, 'Failed to delete or archive category.');
  }
}

export async function upsertBrandByAdmin(params: {
  id?: number;
  name: string;
  slug?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  isFeatured?: boolean;
  showInNav?: boolean;
  sortOrder?: number;
  seoTitle?: string;
  seoDescription?: string;
  status?: string;
  isActive?: boolean;
  actorEmail?: string;
}) {
  try {
    const cleanName = (params.name || '').trim();
    if (!cleanName) {
      throw new Error('Company / Brand name is required.');
    }
    const cleanSlug =
      (params.slug || cleanName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || `brand-${Date.now().toString().slice(-4)}`;

    const nextStatus = params.status || (params.isActive === false ? 'HIDDEN' : 'PUBLISHED');
    const nextIsActive = nextStatus === 'PUBLISHED';

    const allBrandsList = await db.select().from(brands);
    let existing = params.id ? allBrandsList.find((b) => b.id === Number(params.id)) : undefined;
    if (!existing) {
      existing = allBrandsList.find(
        (b) => b.slug === cleanSlug || b.name.toLowerCase() === cleanName.toLowerCase()
      );
    }

    if (existing) {
      const [updated] = await db
        .update(brands)
        .set({
          name: cleanName,
          slug: cleanSlug,
          description: params.description !== undefined ? params.description.trim() : existing.description,
          logoUrl: params.logoUrl !== undefined ? params.logoUrl : existing.logoUrl,
          bannerUrl: params.bannerUrl !== undefined ? params.bannerUrl : existing.bannerUrl,
          isFeatured: params.isFeatured !== undefined ? Boolean(params.isFeatured) : existing.isFeatured,
          showInNav: params.showInNav !== undefined ? Boolean(params.showInNav) : existing.showInNav,
          sortOrder: params.sortOrder !== undefined ? Number(params.sortOrder) : existing.sortOrder,
          seoTitle: params.seoTitle !== undefined ? params.seoTitle.trim() : existing.seoTitle,
          seoDescription:
            params.seoDescription !== undefined ? params.seoDescription.trim() : existing.seoDescription,
          status: nextStatus,
          isActive: nextIsActive,
          isSampleData: false,
        })
        .where(eq(brands.id, existing.id))
        .returning();

      await logCmsRevision({
        entityType: 'BRAND',
        entityId: String(updated.id),
        action: 'UPDATED',
        snapshotJson: updated as unknown as Record<string, unknown>,
        actorEmail: params.actorEmail || 'owner',
      });

      return updated;
    } else {
      const [created] = await db
        .insert(brands)
        .values({
          name: cleanName,
          slug: cleanSlug,
          description: (params.description || `Authorized ${cleanName} stationery & supplies`).trim(),
          logoUrl: params.logoUrl || '',
          bannerUrl: params.bannerUrl || '',
          isFeatured: params.isFeatured !== undefined ? Boolean(params.isFeatured) : true,
          showInNav: params.showInNav !== undefined ? Boolean(params.showInNav) : true,
          sortOrder: params.sortOrder !== undefined ? Number(params.sortOrder) : allBrandsList.length + 1,
          seoTitle: (params.seoTitle || '').trim(),
          seoDescription: (params.seoDescription || '').trim(),
          status: nextStatus,
          isActive: nextIsActive,
          isSampleData: false,
        })
        .returning();

      await logCmsRevision({
        entityType: 'BRAND',
        entityId: String(created.id),
        action: 'CREATED',
        snapshotJson: created as unknown as Record<string, unknown>,
        actorEmail: params.actorEmail || 'owner',
      });

      return created;
    }
  } catch (error: any) {
    console.error('Upsert brand error:', error);
    throw sanitizeDbError(error, 'Failed to save company / brand.');
  }
}

export async function deleteOrArchiveBrandByAdmin(id: number, actorEmail: string) {
  try {
    const prodList = await db.select().from(products).where(eq(products.brandId, id));
    if (prodList.length > 0) {
      const [archived] = await db
        .update(brands)
        .set({ status: 'ARCHIVED', isActive: false, showInNav: false })
        .where(eq(brands.id, id))
        .returning();
      return { action: 'ARCHIVED', brand: archived };
    }
    await db.delete(brands).where(eq(brands.id, id));
    await logCmsRevision({
      entityType: 'BRAND',
      entityId: String(id),
      action: 'DELETED',
      snapshotJson: { id },
      actorEmail,
    });
    return { action: 'DELETED', id };
  } catch (error: any) {
    throw sanitizeDbError(error, 'Failed to delete or archive brand.');
  }
}

export async function upsertNavigationItemByAdmin(params: {
  id?: number;
  label: string;
  linkType?: string;
  targetType?: string;
  targetValue: string;
  parentId?: number | null;
  sortOrder?: number;
  showOnDesktop?: boolean;
  showOnMobile?: boolean;
  openInNewTab?: boolean;
  highlightBadge?: string;
  status?: string;
  isActive?: boolean;
  actorEmail?: string;
}) {
  try {
    const cleanLabel = (params.label || '').trim();
    if (!cleanLabel) {
      throw new Error('Navigation label is required.');
    }
    const nextStatus = params.status || (params.isActive === false ? 'HIDDEN' : 'PUBLISHED');
    const nextIsActive = nextStatus === 'PUBLISHED';
    const resolvedTargetType = params.targetType || params.linkType || 'CATEGORY';

    if (params.id) {
      const [updated] = await db
        .update(cmsNavigationItems)
        .set({
          label: cleanLabel,
          targetType: resolvedTargetType,
          targetValue: (params.targetValue || '').trim(),
          parentId: params.parentId ? Number(params.parentId) : null,
          sortOrder: params.sortOrder !== undefined ? Number(params.sortOrder) : 0,
          showOnDesktop: params.showOnDesktop !== undefined ? Boolean(params.showOnDesktop) : true,
          showOnMobile: params.showOnMobile !== undefined ? Boolean(params.showOnMobile) : true,
          status: nextStatus,
          isActive: nextIsActive,
        })
        .where(eq(cmsNavigationItems.id, Number(params.id)))
        .returning();
      return updated;
    } else {
      const allItems = await db.select().from(cmsNavigationItems);
      const [created] = await db
        .insert(cmsNavigationItems)
        .values({
          label: cleanLabel,
          targetType: resolvedTargetType,
          targetValue: (params.targetValue || '').trim(),
          parentId: params.parentId ? Number(params.parentId) : null,
          sortOrder: params.sortOrder !== undefined ? Number(params.sortOrder) : allItems.length + 1,
          showOnDesktop: params.showOnDesktop !== undefined ? Boolean(params.showOnDesktop) : true,
          showOnMobile: params.showOnMobile !== undefined ? Boolean(params.showOnMobile) : true,
          status: nextStatus,
          isActive: nextIsActive,
        })
        .returning();
      return created;
    }
  } catch (error: any) {
    throw sanitizeDbError(error, 'Failed to save navigation item.');
  }
}

export async function deleteNavigationItemByAdmin(id: number) {
  await db.delete(cmsNavigationItems).where(eq(cmsNavigationItems.id, id));
  return { deletedId: id };
}

export async function upsertHomepageSectionByAdmin(params: {
  id?: number;
  sectionKey?: string;
  sectionType: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  ctaText?: string;
  ctaLabel?: string;
  ctaLink?: string;
  ctaTarget?: string;
  sourceType?: string;
  sourceCategoryId?: number | null;
  sourceBrandId?: number | null;
  productIds?: number[];
  categoryIds?: number[];
  brandIds?: number[];
  maxItems?: number;
  layoutStyle?: string;
  configJson?: Record<string, unknown>;
  sortOrder?: number;
  status?: string;
  isActive?: boolean;
  actorEmail?: string;
}) {
  try {
    const cleanTitle = (params.title || '').trim();
    if (!cleanTitle) {
      throw new Error('Section title is required.');
    }
    const nextStatus = params.status || (params.isActive === false ? 'HIDDEN' : 'PUBLISHED');
    const nextIsVisible = nextStatus === 'PUBLISHED';
    const filterConfigJson: Record<string, any> = {
      ...(params.configJson || {}),
      badgeText: (params.badgeText || '').trim(),
      sourceType: params.sourceType || 'AUTOMATIC',
      sourceCategoryId: params.sourceCategoryId ? Number(params.sourceCategoryId) : null,
      sourceBrandId: params.sourceBrandId ? Number(params.sourceBrandId) : null,
      productIds: Array.isArray(params.productIds) ? params.productIds.map(Number) : [],
      categoryIds: Array.isArray(params.categoryIds) ? params.categoryIds.map(Number) : [],
      brandIds: Array.isArray(params.brandIds) ? params.brandIds.map(Number) : [],
      maxItems: params.maxItems ? Number(params.maxItems) : 8,
      layoutStyle: params.layoutStyle || 'GRID_4',
    };

    if (params.id) {
      const [updated] = await db
        .update(cmsHomepageSections)
        .set({
          sectionType: params.sectionType || 'PRODUCT_CAROUSEL',
          title: cleanTitle,
          subtitle: (params.subtitle || '').trim(),
          ctaLabel: (params.ctaText || params.ctaLabel || 'View All').trim(),
          ctaTarget: (params.ctaLink || params.ctaTarget || '').trim(),
          filterConfigJson,
          sortOrder: params.sortOrder !== undefined ? Number(params.sortOrder) : 0,
          status: nextStatus,
          isVisible: nextIsVisible,
          updatedAt: new Date(),
        })
        .where(eq(cmsHomepageSections.id, Number(params.id)))
        .returning();

      await logCmsRevision({
        entityType: 'HOMEPAGE_SECTION',
        entityId: String(updated.id),
        action: 'UPDATED',
        snapshotJson: updated as unknown as Record<string, unknown>,
        actorEmail: params.actorEmail || 'owner',
      });
      return updated;
    } else {
      const allSections = await db.select().from(cmsHomepageSections);
      const sectionKey =
        params.sectionKey ||
        `${cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;

      const [created] = await db
        .insert(cmsHomepageSections)
        .values({
          sectionKey,
          sectionType: params.sectionType || 'PRODUCT_CAROUSEL',
          title: cleanTitle,
          subtitle: (params.subtitle || '').trim(),
          ctaLabel: (params.ctaText || params.ctaLabel || 'View All').trim(),
          ctaTarget: (params.ctaLink || params.ctaTarget || '').trim(),
          filterConfigJson,
          sortOrder: params.sortOrder !== undefined ? Number(params.sortOrder) : allSections.length + 1,
          status: nextStatus,
          isVisible: nextIsVisible,
        })
        .returning();

      await logCmsRevision({
        entityType: 'HOMEPAGE_SECTION',
        entityId: String(created.id),
        action: 'CREATED',
        snapshotJson: created as unknown as Record<string, unknown>,
        actorEmail: params.actorEmail || 'owner',
      });
      return created;
    }
  } catch (error: any) {
    throw sanitizeDbError(error, 'Failed to save homepage section.');
  }
}

export async function deleteHomepageSectionByAdmin(id: number) {
  await db.delete(cmsHomepageSections).where(eq(cmsHomepageSections.id, id));
  return { deletedId: id };
}

export async function upsertBannerByAdmin(params: {
  id?: number;
  placement?: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  ctaText?: string;
  ctaLink?: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  desktopImageUrl?: string;
  mobileImageUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  textAlignment?: string;
  startAt?: string;
  endAt?: string;
  sortOrder?: number;
  status?: string;
  isActive?: boolean;
  actorEmail?: string;
}) {
  try {
    const cleanTitle = (params.title || '').trim();
    if (!cleanTitle) {
      throw new Error('Banner title is required.');
    }
    const nextStatus = params.status || (params.isActive === false ? 'HIDDEN' : 'PUBLISHED');
    const nextIsActive = nextStatus === 'PUBLISHED';

    if (params.id) {
      const [updated] = await db
        .update(cmsBanners)
        .set({
          placement: params.placement || 'HERO_MAIN',
          title: cleanTitle,
          subtitle: (params.subtitle || '').trim(),
          badgeText: (params.badgeText || '').trim(),
          ctaLabel: (params.ctaText || 'Shop Now').trim(),
          ctaTargetType: 'CATEGORY',
          ctaTargetValue: (params.ctaLink || 'catalogue').trim(),
          desktopImageUrl: params.desktopImageUrl || '',
          mobileImageUrl: params.mobileImageUrl || '',
          startDate: params.startAt || '',
          endDate: params.endAt || '',
          sortOrder: params.sortOrder !== undefined ? Number(params.sortOrder) : 0,
          status: nextStatus,
          isActive: nextIsActive,
          updatedAt: new Date(),
        })
        .where(eq(cmsBanners.id, Number(params.id)))
        .returning();

      await logCmsRevision({
        entityType: 'BANNER',
        entityId: String(updated.id),
        action: 'UPDATED',
        snapshotJson: updated as unknown as Record<string, unknown>,
        actorEmail: params.actorEmail || 'owner',
      });
      return updated;
    } else {
      const allBanners = await db.select().from(cmsBanners);
      const [created] = await db
        .insert(cmsBanners)
        .values({
          placement: params.placement || 'HERO_MAIN',
          title: cleanTitle,
          subtitle: (params.subtitle || '').trim(),
          badgeText: (params.badgeText || '').trim(),
          ctaLabel: (params.ctaText || 'Shop Now').trim(),
          ctaTargetType: 'CATEGORY',
          ctaTargetValue: (params.ctaLink || 'catalogue').trim(),
          desktopImageUrl: params.desktopImageUrl || '',
          mobileImageUrl: params.mobileImageUrl || '',
          startDate: params.startAt || '',
          endDate: params.endAt || '',
          sortOrder: params.sortOrder !== undefined ? Number(params.sortOrder) : allBanners.length + 1,
          status: nextStatus,
          isActive: nextIsActive,
        })
        .returning();

      await logCmsRevision({
        entityType: 'BANNER',
        entityId: String(created.id),
        action: 'CREATED',
        snapshotJson: created as unknown as Record<string, unknown>,
        actorEmail: params.actorEmail || 'owner',
      });
      return created;
    }
  } catch (error: any) {
    throw sanitizeDbError(error, 'Failed to save banner.');
  }
}

export async function deleteBannerByAdmin(id: number) {
  await db.delete(cmsBanners).where(eq(cmsBanners.id, id));
  return { deletedId: id };
}

export async function upsertCmsPageByAdmin(params: {
  id?: number;
  title: string;
  slug?: string;
  pageType?: string;
  summary?: string;
  contentMarkdown: string;
  bannerImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  showInFooter?: boolean;
  showInHeader?: boolean;
  status?: string;
  isActive?: boolean;
  actorEmail?: string;
}) {
  try {
    const cleanTitle = (params.title || '').trim();
    if (!cleanTitle) {
      throw new Error('Page title is required.');
    }
    const cleanSlug =
      (params.slug || cleanTitle)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || `page-${Date.now().toString().slice(-4)}`;

    const nextStatus = params.status || (params.isActive === false ? 'DRAFT' : 'PUBLISHED');

    const allPages = await db.select().from(cmsPages);
    let existing = params.id ? allPages.find((p) => p.id === Number(params.id)) : undefined;
    if (!existing) {
      existing = allPages.find((p) => p.slug === cleanSlug);
    }

    if (existing) {
      const [updated] = await db
        .update(cmsPages)
        .set({
          title: cleanTitle,
          slug: cleanSlug,
          pageType: params.pageType || existing.pageType,
          summary: params.summary !== undefined ? params.summary.trim() : existing.summary,
          contentMarkdown: params.contentMarkdown,
          bannerImageUrl: params.bannerImageUrl !== undefined ? params.bannerImageUrl : existing.bannerImageUrl,
          seoTitle: params.seoTitle !== undefined ? params.seoTitle.trim() : existing.seoTitle,
          seoDescription:
            params.seoDescription !== undefined ? params.seoDescription.trim() : existing.seoDescription,
          showInFooter: params.showInFooter !== undefined ? Boolean(params.showInFooter) : existing.showInFooter,
          showInHeader: params.showInHeader !== undefined ? Boolean(params.showInHeader) : existing.showInHeader,
          status: nextStatus,
          updatedByEmail: params.actorEmail || 'owner',
          updatedAt: new Date(),
        })
        .where(eq(cmsPages.id, existing.id))
        .returning();

      await logCmsRevision({
        entityType: 'PAGE',
        entityId: String(updated.id),
        action: 'UPDATED',
        snapshotJson: updated as unknown as Record<string, unknown>,
        actorEmail: params.actorEmail || 'owner',
      });
      return updated;
    } else {
      const [created] = await db
        .insert(cmsPages)
        .values({
          title: cleanTitle,
          slug: cleanSlug,
          pageType: params.pageType || 'INFO',
          summary: (params.summary || '').trim(),
          contentMarkdown: params.contentMarkdown || '',
          bannerImageUrl: params.bannerImageUrl || '',
          seoTitle: (params.seoTitle || '').trim(),
          seoDescription: (params.seoDescription || '').trim(),
          showInFooter: params.showInFooter !== undefined ? Boolean(params.showInFooter) : true,
          showInHeader: Boolean(params.showInHeader),
          status: nextStatus,
          updatedByEmail: params.actorEmail || 'owner',
        })
        .returning();

      await logCmsRevision({
        entityType: 'PAGE',
        entityId: String(created.id),
        action: 'CREATED',
        snapshotJson: created as unknown as Record<string, unknown>,
        actorEmail: params.actorEmail || 'owner',
      });
      return created;
    }
  } catch (error: any) {
    throw sanitizeDbError(error, 'Failed to save informational page.');
  }
}

export async function deleteCmsPageByAdmin(id: number) {
  await db.delete(cmsPages).where(eq(cmsPages.id, id));
  return { deletedId: id };
}

export async function upsertProductBundleByAdmin(params: {
  id?: number;
  name: string;
  slug?: string;
  description: string;
  targetGroup: string;
  itemsSummary: Array<{ productName: string; quantity: number }>;
  bundlePricePaise: number;
  savingsPaise: number;
  illustrationType?: string;
  isActive?: boolean;
}) {
  try {
    const cleanName = (params.name || '').trim();
    if (!cleanName) {
      throw new Error('Bundle / Combo name is required.');
    }
    const cleanSlug =
      (params.slug || cleanName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || `bundle-${Date.now().toString().slice(-4)}`;

    const normalizedItemsJson = (params.itemsSummary || []).map((item, idx) => ({
      productId: idx + 1,
      variantId: idx + 1,
      productName: item.productName,
      variantName: 'Standard',
      quantity: Number(item.quantity) || 1,
    }));
    const bundlePricePaise = Number(params.bundlePricePaise);
    const originalTotalPaise = bundlePricePaise + Number(params.savingsPaise || 0);

    if (params.id) {
      const [updated] = await db
        .update(productBundles)
        .set({
          name: cleanName,
          slug: cleanSlug,
          description: (params.description || '').trim(),
          targetGroup: (params.targetGroup || 'All Classes').trim(),
          itemsJson: normalizedItemsJson,
          bundlePricePaise,
          originalTotalPaise,
          isActive: params.isActive !== undefined ? Boolean(params.isActive) : true,
          isSampleData: false,
        })
        .where(eq(productBundles.id, Number(params.id)))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(productBundles)
        .values({
          name: cleanName,
          slug: cleanSlug,
          description: (params.description || '').trim(),
          targetGroup: (params.targetGroup || 'All Classes').trim(),
          itemsJson: normalizedItemsJson,
          bundlePricePaise,
          originalTotalPaise,
          isActive: params.isActive !== undefined ? Boolean(params.isActive) : true,
          isSampleData: false,
        })
        .returning();
      return created;
    }
  } catch (error: any) {
    throw sanitizeDbError(error, 'Failed to save bundle / combo kit.');
  }
}

export async function bulkProductActionByAdmin(params: {
  productIds: number[];
  action:
    | 'PUBLISH'
    | 'HIDE'
    | 'ARCHIVE'
    | 'MARK_FEATURED'
    | 'UNMARK_FEATURED'
    | 'MARK_BESTSELLER'
    | 'MARK_NEW_ARRIVAL'
    | 'ASSIGN_CATEGORY'
    | 'ASSIGN_BRAND';
  categoryId?: number;
  brandId?: number;
  actorEmail: string;
}) {
  if (!Array.isArray(params.productIds) || params.productIds.length === 0) {
    throw new Error('Select at least one product for bulk action.');
  }
  let count = 0;
  for (const pid of params.productIds) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (params.action === 'PUBLISH') {
      updateData.status = 'PUBLISHED';
      updateData.isActive = true;
    } else if (params.action === 'HIDE') {
      updateData.status = 'HIDDEN';
      updateData.isActive = false;
    } else if (params.action === 'ARCHIVE') {
      updateData.status = 'ARCHIVED';
      updateData.isActive = false;
    } else if (params.action === 'MARK_FEATURED') {
      updateData.isFeatured = true;
    } else if (params.action === 'UNMARK_FEATURED') {
      updateData.isFeatured = false;
    } else if (params.action === 'MARK_BESTSELLER') {
      updateData.isBestseller = true;
    } else if (params.action === 'MARK_NEW_ARRIVAL') {
      updateData.isNewArrival = true;
    } else if (params.action === 'ASSIGN_CATEGORY' && params.categoryId) {
      updateData.categoryId = Number(params.categoryId);
    } else if (params.action === 'ASSIGN_BRAND' && params.brandId) {
      updateData.brandId = Number(params.brandId);
    }
    await db.update(products).set(updateData).where(eq(products.id, Number(pid)));
    count++;
  }
  return { updatedCount: count };
}

