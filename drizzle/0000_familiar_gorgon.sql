CREATE TABLE "addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"recipient_name" text NOT NULL,
	"phone" text NOT NULL,
	"line1" text NOT NULL,
	"line2" text DEFAULT '',
	"landmark" text DEFAULT '',
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pincode" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '',
	"logo_url" text DEFAULT '',
	"banner_url" text DEFAULT '',
	"is_featured" boolean DEFAULT true NOT NULL,
	"show_in_nav" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'PUBLISHED' NOT NULL,
	"seo_title" text DEFAULT '',
	"seo_description" text DEFAULT '',
	"is_active" boolean DEFAULT true NOT NULL,
	"is_sample_data" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "bulk_order_enquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"enquiry_number" text NOT NULL,
	"institution_name" text NOT NULL,
	"contact_person" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"gstin" text DEFAULT '',
	"delivery_pincode" text DEFAULT '',
	"required_by_date" text DEFAULT '',
	"items_requested_json" jsonb NOT NULL,
	"notes" text DEFAULT '',
	"status" text DEFAULT 'NEW' NOT NULL,
	"quoted_amount_paise" integer,
	"admin_notes" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bulk_order_enquiries_enquiry_number_unique" UNIQUE("enquiry_number")
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"cart_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"guest_session_id" text,
	"coupon_code" text DEFAULT '',
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "carts_guest_session_id_unique" UNIQUE("guest_session_id")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '',
	"parent_id" integer,
	"image_url" text DEFAULT '',
	"icon_name" text DEFAULT 'Folder',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"show_in_nav" boolean DEFAULT true NOT NULL,
	"show_on_home" boolean DEFAULT true NOT NULL,
	"show_in_footer" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'PUBLISHED' NOT NULL,
	"seo_title" text DEFAULT '',
	"seo_description" text DEFAULT '',
	"is_active" boolean DEFAULT true NOT NULL,
	"is_sample_data" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cms_banners" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subtitle" text DEFAULT '',
	"badge_text" text DEFAULT '',
	"cta_label" text DEFAULT 'Shop Collection',
	"cta_target_type" text DEFAULT 'CATEGORY' NOT NULL,
	"cta_target_value" text DEFAULT 'ALL' NOT NULL,
	"desktop_image_url" text DEFAULT '',
	"mobile_image_url" text DEFAULT '',
	"illustration_type" text DEFAULT 'spiral_notebook' NOT NULL,
	"placement" text DEFAULT 'HERO' NOT NULL,
	"start_date" text DEFAULT '',
	"end_date" text DEFAULT '',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'PUBLISHED' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_homepage_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_key" text NOT NULL,
	"section_type" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text DEFAULT '',
	"cta_label" text DEFAULT '',
	"cta_target" text DEFAULT '',
	"image_url" text DEFAULT '',
	"mobile_image_url" text DEFAULT '',
	"filter_config_json" jsonb DEFAULT '{}'::jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'PUBLISHED' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cms_homepage_sections_section_key_unique" UNIQUE("section_key")
);
--> statement-breakpoint
CREATE TABLE "cms_navigation_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"target_type" text NOT NULL,
	"target_value" text NOT NULL,
	"parent_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"show_on_desktop" boolean DEFAULT true NOT NULL,
	"show_on_mobile" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'PUBLISHED' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"page_type" text DEFAULT 'INFO' NOT NULL,
	"summary" text DEFAULT '',
	"content_markdown" text NOT NULL,
	"banner_image_url" text DEFAULT '',
	"seo_title" text DEFAULT '',
	"seo_description" text DEFAULT '',
	"show_in_header" boolean DEFAULT false NOT NULL,
	"show_in_footer" boolean DEFAULT true NOT NULL,
	"footer_column" text DEFAULT 'POLICIES' NOT NULL,
	"status" text DEFAULT 'PUBLISHED' NOT NULL,
	"updated_by_email" text DEFAULT '',
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cms_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cms_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_key" text NOT NULL,
	"action" text NOT NULL,
	"snapshot_json" jsonb NOT NULL,
	"actor_email" text NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" integer NOT NULL,
	"min_order_paise" integer DEFAULT 0 NOT NULL,
	"max_discount_paise" integer DEFAULT 0 NOT NULL,
	"usage_limit" integer DEFAULT 500 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"delta_quantity" integer NOT NULL,
	"previous_stock" integer NOT NULL,
	"new_stock" integer NOT NULL,
	"reason" text NOT NULL,
	"reference_order_number" text DEFAULT '',
	"actor_email" text DEFAULT 'system',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"order_id" integer,
	"channel" text NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'DELIVERED_IN_APP' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"status_from" text DEFAULT '',
	"status_to" text NOT NULL,
	"payment_status_from" text DEFAULT '',
	"payment_status_to" text DEFAULT '',
	"actor_role" text NOT NULL,
	"actor_email" text NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"variant_name" text NOT NULL,
	"sku" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_mrp_paise" integer NOT NULL,
	"unit_price_paise" integer NOT NULL,
	"tax_rate_percent" integer NOT NULL,
	"line_total_paise" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"user_id" integer,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_email" text DEFAULT '',
	"fulfilment_method" text NOT NULL,
	"order_status" text NOT NULL,
	"payment_method" text NOT NULL,
	"payment_status" text NOT NULL,
	"subtotal_paise" integer NOT NULL,
	"discount_paise" integer DEFAULT 0 NOT NULL,
	"coupon_code" text DEFAULT '',
	"tax_paise" integer DEFAULT 0 NOT NULL,
	"shipping_paise" integer DEFAULT 0 NOT NULL,
	"total_paise" integer NOT NULL,
	"notes" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"provider" text NOT NULL,
	"provider_order_id" text DEFAULT '',
	"provider_payment_id" text DEFAULT '',
	"provider_signature" text DEFAULT '',
	"idempotency_key" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"status" text NOT NULL,
	"recorded_by_staff_email" text DEFAULT '',
	"raw_webhook_payload" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "pickup_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"pickup_code" text NOT NULL,
	"preferred_window" text DEFAULT 'Standard Store Hours',
	"store_location_note" text NOT NULL,
	"ready_at" timestamp,
	"collected_at" timestamp,
	"collected_by_name" text DEFAULT '',
	"verified_by_staff_email" text DEFAULT '',
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pickup_details_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "product_bundles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"target_group" text NOT NULL,
	"bundle_price_paise" integer NOT NULL,
	"original_total_paise" integer NOT NULL,
	"items_json" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_sample_data" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_bundles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"sku" text NOT NULL,
	"variant_name" text NOT NULL,
	"attribute_type" text NOT NULL,
	"attribute_value" text NOT NULL,
	"mrp_paise" integer NOT NULL,
	"selling_price_paise" integer NOT NULL,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"reserved_quantity" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 10 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"brand_id" integer,
	"category_id" integer NOT NULL,
	"subcategory_id" integer,
	"secondary_category_ids" jsonb DEFAULT '[]'::jsonb,
	"short_description" text NOT NULL,
	"description" text NOT NULL,
	"specifications" jsonb DEFAULT '{}'::jsonb,
	"mrp_paise" integer NOT NULL,
	"selling_price_paise" integer NOT NULL,
	"tax_rate_percent" integer DEFAULT 12 NOT NULL,
	"image_url" text DEFAULT '',
	"gallery_urls" jsonb DEFAULT '[]'::jsonb,
	"illustration_type" text DEFAULT 'notebook' NOT NULL,
	"status" text DEFAULT 'PUBLISHED' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_bestseller" boolean DEFAULT false NOT NULL,
	"is_new_arrival" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"pickup_eligible" boolean DEFAULT true NOT NULL,
	"delivery_eligible" boolean DEFAULT true NOT NULL,
	"is_sample_data" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku"),
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"payment_id" integer,
	"amount_paise" integer NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'REQUESTED' NOT NULL,
	"processed_by_email" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"permissions" jsonb NOT NULL,
	"description" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_permissions_role_unique" UNIQUE("role")
);
--> statement-breakpoint
CREATE TABLE "serviceable_pincodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"pincode" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"delivery_fee_paise" integer NOT NULL,
	"free_delivery_threshold_paise" integer NOT NULL,
	"cod_available" boolean DEFAULT false NOT NULL,
	"estimated_days" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_sample_rule" boolean DEFAULT true NOT NULL,
	CONSTRAINT "serviceable_pincodes_pincode_unique" UNIQUE("pincode")
);
--> statement-breakpoint
CREATE TABLE "shipment_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"recipient_name" text NOT NULL,
	"phone" text NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text DEFAULT '',
	"landmark" text DEFAULT '',
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pincode" text NOT NULL,
	"courier_name" text DEFAULT '',
	"tracking_number" text DEFAULT '',
	"tracking_url" text DEFAULT '',
	"dispatched_at" timestamp,
	"delivered_at" timestamp,
	"delivery_notes" text DEFAULT '',
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shipment_details_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "store_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value_json" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "store_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"email" text NOT NULL,
	"full_name" text DEFAULT '',
	"phone" text DEFAULT '',
	"role" text DEFAULT 'customer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_activity_logs" ADD CONSTRAINT "order_activity_logs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_details" ADD CONSTRAINT "pickup_details_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_details" ADD CONSTRAINT "shipment_details_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;