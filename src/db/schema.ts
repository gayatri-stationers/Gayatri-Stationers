import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';

// 1. Users / Profiles
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name').default(''),
  phone: text('phone').default(''),
  role: text('role').notNull().default('customer'), // 'customer' | 'staff' | 'owner'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Roles and Permissions
export const rolesPermissions = pgTable('roles_permissions', {
  id: serial('id').primaryKey(),
  role: text('role').notNull().unique(),
  permissions: jsonb('permissions').$type<string[]>().notNull(),
  description: text('description').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. Customer Addresses
export const addresses = pgTable('addresses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  recipientName: text('recipient_name').notNull(),
  phone: text('phone').notNull(),
  line1: text('line1').notNull(),
  line2: text('line2').default(''),
  landmark: text('landmark').default(''),
  city: text('city').notNull(),
  state: text('state').notNull(),
  pincode: text('pincode').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Categories (supports parent-child hierarchy, visibility, SEO, and publication status)
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').default(''),
  parentId: integer('parent_id'),
  imageUrl: text('image_url').default(''),
  iconName: text('icon_name').default('Folder'),
  sortOrder: integer('sort_order').default(0).notNull(),
  showInNav: boolean('show_in_nav').default(true).notNull(),
  showOnHome: boolean('show_on_home').default(true).notNull(),
  showInFooter: boolean('show_in_footer').default(true).notNull(),
  status: text('status').default('PUBLISHED').notNull(), // 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED' | 'DRAFT'
  seoTitle: text('seo_title').default(''),
  seoDescription: text('seo_description').default(''),
  isActive: boolean('is_active').default(true).notNull(),
  isSampleData: boolean('is_sample_data').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Brands / Companies (supports logo, banner, featured ordering, SEO, and publication status)
export const brands = pgTable('brands', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').default(''),
  logoUrl: text('logo_url').default(''),
  bannerUrl: text('banner_url').default(''),
  isFeatured: boolean('is_featured').default(true).notNull(),
  showInNav: boolean('show_in_nav').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  status: text('status').default('PUBLISHED').notNull(), // 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED' | 'DRAFT'
  seoTitle: text('seo_title').default(''),
  seoDescription: text('seo_description').default(''),
  isActive: boolean('is_active').default(true).notNull(),
  isSampleData: boolean('is_sample_data').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Products (Monetary values stored in integer paise to prevent floating-point errors)
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  brandId: integer('brand_id').references(() => brands.id),
  categoryId: integer('category_id')
    .references(() => categories.id)
    .notNull(),
  subcategoryId: integer('subcategory_id'),
  secondaryCategoryIds: jsonb('secondary_category_ids').$type<number[]>().default([]),
  shortDescription: text('short_description').notNull(),
  description: text('description').notNull(),
  specifications: jsonb('specifications').$type<Record<string, string>>().default({}),
  mrpPaise: integer('mrp_paise').notNull(),
  sellingPricePaise: integer('selling_price_paise').notNull(),
  taxRatePercent: integer('tax_rate_percent').default(12).notNull(),
  imageUrl: text('image_url').default(''),
  galleryUrls: jsonb('gallery_urls').$type<string[]>().default([]),
  illustrationType: text('illustration_type').default('notebook').notNull(),
  status: text('status').default('PUBLISHED').notNull(), // 'PUBLISHED' | 'DRAFT' | 'ARCHIVED'
  isFeatured: boolean('is_featured').default(false).notNull(),
  isBestseller: boolean('is_bestseller').default(false).notNull(),
  isNewArrival: boolean('is_new_arrival').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  pickupEligible: boolean('pickup_eligible').default(true).notNull(),
  deliveryEligible: boolean('delivery_eligible').default(true).notNull(),
  isSampleData: boolean('is_sample_data').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 7. Product Variants & Inventory
export const productVariants = pgTable('product_variants', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  sku: text('sku').notNull().unique(),
  variantName: text('variant_name').notNull(),
  attributeType: text('attribute_type').notNull(), // e.g., 'Pack Size', 'Ruling', 'Ink Colour'
  attributeValue: text('attribute_value').notNull(),
  mrpPaise: integer('mrp_paise').notNull(),
  sellingPricePaise: integer('selling_price_paise').notNull(),
  stockQuantity: integer('stock_quantity').default(0).notNull(),
  reservedQuantity: integer('reserved_quantity').default(0).notNull(),
  lowStockThreshold: integer('low_stock_threshold').default(10).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 8. Inventory Movements (Audit trail for every stock deduction, addition, or reservation)
export const inventoryMovements = pgTable('inventory_movements', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  variantId: integer('variant_id')
    .references(() => productVariants.id)
    .notNull(),
  deltaQuantity: integer('delta_quantity').notNull(),
  previousStock: integer('previous_stock').notNull(),
  newStock: integer('new_stock').notNull(),
  reason: text('reason').notNull(), // 'ORDER_PLACED', 'ORDER_CANCELLED', 'ADMIN_ADJUSTMENT', 'CSV_IMPORT', 'INITIAL_SEED'
  referenceOrderNumber: text('reference_order_number').default(''),
  actorEmail: text('actor_email').default('system'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. Persistent Carts (for both authenticated users and guest sessions)
export const carts = pgTable('carts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  guestSessionId: text('guest_session_id').unique(),
  couponCode: text('coupon_code').default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const cartItems = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  cartId: integer('cart_id')
    .references(() => carts.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  variantId: integer('variant_id')
    .references(() => productVariants.id)
    .notNull(),
  quantity: integer('quantity').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 10. Wishlists
export const wishlists = pgTable('wishlists', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 11. Coupons & Promotions
export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  discountType: text('discount_type').notNull(), // 'PERCENTAGE' | 'FLAT_PAISE'
  discountValue: integer('discount_value').notNull(), // percentage (e.g. 10) or paise (e.g. 5000)
  minOrderPaise: integer('min_order_paise').default(0).notNull(),
  maxDiscountPaise: integer('max_discount_paise').default(0).notNull(),
  usageLimit: integer('usage_limit').default(500).notNull(),
  usedCount: integer('used_count').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. Product Bundles & School Combos
export const productBundles = pgTable('product_bundles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  targetGroup: text('target_group').notNull(), // e.g., 'Primary School (Class 1-5)', 'Board Exam Kit (Class 10-12)', 'Office Desk Starter'
  bundlePricePaise: integer('bundle_price_paise').notNull(),
  originalTotalPaise: integer('original_total_paise').notNull(),
  itemsJson: jsonb('items_json')
    .$type<Array<{ productId: number; variantId: number; productName: string; variantName: string; quantity: number }>>()
    .notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  isSampleData: boolean('is_sample_data').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 13. Store Configuration & Fulfilment Settings
export const storeSettings = pgTable('store_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  valueJson: jsonb('value_json').$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 14. Serviceable PIN Codes & Delivery Fee Rules
export const serviceablePincodes = pgTable('serviceable_pincodes', {
  id: serial('id').primaryKey(),
  pincode: text('pincode').notNull().unique(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  deliveryFeePaise: integer('delivery_fee_paise').notNull(),
  freeDeliveryThresholdPaise: integer('free_delivery_threshold_paise').notNull(),
  codAvailable: boolean('cod_available').default(false).notNull(),
  estimatedDays: text('estimated_days').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  isSampleRule: boolean('is_sample_rule').default(true).notNull(),
});

// 15. Orders (Models order_status and payment_status independently)
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  userId: integer('user_id').references(() => users.id),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerEmail: text('customer_email').default(''),
  fulfilmentMethod: text('fulfilment_method').notNull(), // 'STORE_PICKUP' | 'HOME_DELIVERY'
  orderStatus: text('order_status').notNull(),
  // Pickup lifecycle: 'ORDER_PLACED' -> 'CONFIRMED' -> 'PREPARING' -> 'READY_FOR_PICKUP' -> 'COLLECTED'
  // Delivery lifecycle: 'ORDER_PLACED' -> 'CONFIRMED' -> 'PROCESSING' -> 'PACKED' -> 'DISPATCHED' -> 'DELIVERED'
  // Exception states: 'CANCELLED', 'OUT_OF_STOCK_CONFLICT', 'DELIVERY_FAILED', 'RETURNED'
  paymentMethod: text('payment_method').notNull(), // 'RAZORPAY_ONLINE' | 'PAY_AT_STORE' | 'COD'
  paymentStatus: text('payment_status').notNull(), // 'PENDING' | 'PAID' | 'FAILED' | 'REFUND_REQUESTED' | 'REFUNDED'
  subtotalPaise: integer('subtotal_paise').notNull(),
  discountPaise: integer('discount_paise').default(0).notNull(),
  couponCode: text('coupon_code').default(''),
  taxPaise: integer('tax_paise').default(0).notNull(),
  shippingPaise: integer('shipping_paise').default(0).notNull(),
  totalPaise: integer('total_paise').notNull(),
  notes: text('notes').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 16. Order Line Items
export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  variantId: integer('variant_id')
    .references(() => productVariants.id)
    .notNull(),
  productName: text('product_name').notNull(),
  variantName: text('variant_name').notNull(),
  sku: text('sku').notNull(),
  quantity: integer('quantity').notNull(),
  unitMrpPaise: integer('unit_mrp_paise').notNull(),
  unitPricePaise: integer('unit_price_paise').notNull(),
  taxRatePercent: integer('tax_rate_percent').notNull(),
  lineTotalPaise: integer('line_total_paise').notNull(),
});

// 17. Payments & Idempotent Webhook Transactions
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id)
    .notNull(),
  provider: text('provider').notNull(), // 'RAZORPAY' | 'STORE_COUNTER' | 'COD_COLLECTION'
  providerOrderId: text('provider_order_id').default(''),
  providerPaymentId: text('provider_payment_id').default(''),
  providerSignature: text('provider_signature').default(''),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  amountPaise: integer('amount_paise').notNull(),
  status: text('status').notNull(), // 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'PAID_OFFLINE' | 'FAILED' | 'REFUNDED'
  recordedByStaffEmail: text('recorded_by_staff_email').default(''),
  rawWebhookPayload: jsonb('raw_webhook_payload').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 18. Refunds
export const refunds = pgTable('refunds', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id)
    .notNull(),
  paymentId: integer('payment_id').references(() => payments.id),
  amountPaise: integer('amount_paise').notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('REQUESTED'), // 'REQUESTED' | 'PROCESSED' | 'REJECTED'
  processedByEmail: text('processed_by_email').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 19. Shipment / Home Delivery Details
export const shipmentDetails = pgTable('shipment_details', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id)
    .notNull()
    .unique(),
  recipientName: text('recipient_name').notNull(),
  phone: text('phone').notNull(),
  addressLine1: text('address_line1').notNull(),
  addressLine2: text('address_line2').default(''),
  landmark: text('landmark').default(''),
  city: text('city').notNull(),
  state: text('state').notNull(),
  pincode: text('pincode').notNull(),
  courierName: text('courier_name').default(''),
  trackingNumber: text('tracking_number').default(''),
  trackingUrl: text('tracking_url').default(''),
  dispatchedAt: timestamp('dispatched_at'),
  deliveredAt: timestamp('delivered_at'),
  deliveryNotes: text('delivery_notes').default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 20. Store Pickup Details
export const pickupDetails = pgTable('pickup_details', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id)
    .notNull()
    .unique(),
  pickupCode: text('pickup_code').notNull(),
  preferredWindow: text('preferred_window').default('Standard Store Hours'),
  storeLocationNote: text('store_location_note').notNull(),
  readyAt: timestamp('ready_at'),
  collectedAt: timestamp('collected_at'),
  collectedByName: text('collected_by_name').default(''),
  verifiedByStaffEmail: text('verified_by_staff_email').default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 21. Order Activity History
export const orderActivityLogs = pgTable('order_activity_logs', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id)
    .notNull(),
  statusFrom: text('status_from').default(''),
  statusTo: text('status_to').notNull(),
  paymentStatusFrom: text('payment_status_from').default(''),
  paymentStatusTo: text('payment_status_to').default(''),
  actorRole: text('actor_role').notNull(),
  actorEmail: text('actor_email').notNull(),
  note: text('note').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 22. Bulk Order Enquiries (Schools, Offices, Institutions)
export const bulkOrderEnquiries = pgTable('bulk_order_enquiries', {
  id: serial('id').primaryKey(),
  enquiryNumber: text('enquiry_number').notNull().unique(),
  institutionName: text('institution_name').notNull(),
  contactPerson: text('contact_person').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  gstin: text('gstin').default(''),
  deliveryPincode: text('delivery_pincode').default(''),
  requiredByDate: text('required_by_date').default(''),
  itemsRequestedJson: jsonb('items_requested_json')
    .$type<Array<{ itemName: string; skuOrCategory: string; quantity: number; targetPriceNote?: string }>>()
    .notNull(),
  notes: text('notes').default(''),
  status: text('status').notNull().default('NEW'), // 'NEW' | 'REVIEWING' | 'QUOTED' | 'CONFIRMED' | 'CLOSED'
  quotedAmountPaise: integer('quoted_amount_paise'),
  adminNotes: text('admin_notes').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 23. Notification Records
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  orderId: integer('order_id').references(() => orders.id),
  channel: text('channel').notNull(), // 'IN_APP' | 'EMAIL_LOG' | 'SMS_LOG'
  recipient: text('recipient').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('DELIVERED_IN_APP'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 24. Dynamic CMS Navigation Menu Items
export const cmsNavigationItems = pgTable('cms_navigation_items', {
  id: serial('id').primaryKey(),
  label: text('label').notNull(),
  targetType: text('target_type').notNull(), // 'CATEGORY' | 'SUBCATEGORY' | 'BRAND' | 'COLLECTION' | 'PAGE' | 'VIEW' | 'CUSTOM_URL'
  targetValue: text('target_value').notNull(),
  parentId: integer('parent_id'),
  sortOrder: integer('sort_order').default(0).notNull(),
  showOnDesktop: boolean('show_on_desktop').default(true).notNull(),
  showOnMobile: boolean('show_on_mobile').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  status: text('status').default('PUBLISHED').notNull(), // 'PUBLISHED' | 'DRAFT' | 'HIDDEN'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 25. Dynamic CMS Homepage Sections
export const cmsHomepageSections = pgTable('cms_homepage_sections', {
  id: serial('id').primaryKey(),
  sectionKey: text('section_key').notNull().unique(),
  sectionType: text('section_type').notNull(),
  // 'HERO_BANNER' | 'FULFILMENT_STRIP' | 'SHOP_BY_CATEGORY' | 'FEATURED_BRANDS' | 'PRODUCT_COLLECTION' | 'STATIONERY_COMBOS' | 'PROMO_BANNER' | 'BULK_ORDER_CTA'
  title: text('title').notNull(),
  subtitle: text('subtitle').default(''),
  ctaLabel: text('cta_label').default(''),
  ctaTarget: text('cta_target').default(''),
  imageUrl: text('image_url').default(''),
  mobileImageUrl: text('mobile_image_url').default(''),
  filterConfigJson: jsonb('filter_config_json').$type<Record<string, any>>().default({}),
  sortOrder: integer('sort_order').default(0).notNull(),
  isVisible: boolean('is_visible').default(true).notNull(),
  status: text('status').default('PUBLISHED').notNull(), // 'PUBLISHED' | 'DRAFT' | 'HIDDEN'
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 26. Dynamic CMS Banners & Promotional Campaigns
export const cmsBanners = pgTable('cms_banners', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  subtitle: text('subtitle').default(''),
  badgeText: text('badge_text').default(''),
  ctaLabel: text('cta_label').default('Shop Collection'),
  ctaTargetType: text('cta_target_type').default('CATEGORY').notNull(),
  ctaTargetValue: text('cta_target_value').default('ALL').notNull(),
  desktopImageUrl: text('desktop_image_url').default(''),
  mobileImageUrl: text('mobile_image_url').default(''),
  illustrationType: text('illustration_type').default('spiral_notebook').notNull(),
  placement: text('placement').default('HERO').notNull(), // 'HERO' | 'MID_PAGE' | 'CATEGORY_HEADER'
  startDate: text('start_date').default(''),
  endDate: text('end_date').default(''),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  status: text('status').default('PUBLISHED').notNull(), // 'PUBLISHED' | 'DRAFT' | 'HIDDEN'
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 27. Dynamic CMS Informational & Policy Pages
export const cmsPages = pgTable('cms_pages', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  pageType: text('page_type').default('INFO').notNull(),
  summary: text('summary').default(''),
  contentMarkdown: text('content_markdown').notNull(),
  bannerImageUrl: text('banner_image_url').default(''),
  seoTitle: text('seo_title').default(''),
  seoDescription: text('seo_description').default(''),
  showInHeader: boolean('show_in_header').default(false).notNull(),
  showInFooter: boolean('show_in_footer').default(true).notNull(),
  footerColumn: text('footer_column').default('POLICIES').notNull(), // 'QUICK_LINKS' | 'POLICIES' | 'SUPPORT'
  status: text('status').default('PUBLISHED').notNull(), // 'PUBLISHED' | 'DRAFT' | 'HIDDEN'
  updatedByEmail: text('updated_by_email').default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 28. CMS Audit Log, Draft Snapshots & Publication Rollback Revisions
export const cmsRevisions = pgTable('cms_revisions', {
  id: serial('id').primaryKey(),
  entityType: text('entity_type').notNull(), // 'THEME' | 'HOMEPAGE' | 'NAVIGATION' | 'PAGE' | 'FOOTER' | 'CATEGORY' | 'BRAND'
  entityKey: text('entity_key').notNull(),
  action: text('action').notNull(), // 'SAVE_DRAFT' | 'PUBLISH' | 'ROLLBACK' | 'ARCHIVE'
  snapshotJson: jsonb('snapshot_json').$type<Record<string, any>>().notNull(),
  actorEmail: text('actor_email').notNull(),
  summary: text('summary').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

