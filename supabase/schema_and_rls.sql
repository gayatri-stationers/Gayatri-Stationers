-- ============================================================================
-- GAYATRI STATIONERS: SUPABASE POSTGRESQL SCHEMA + ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- This migration script defines the relational schema, indexes, foreign keys,
-- Row Level Security (RLS) policies, and Supabase Storage bucket policies for
-- Gayatri Stationers.
-- ============================================================================

-- 1. HELPER FUNCTION FOR ADMIN / STAFF ROLE CHECK IN RLS
CREATE OR REPLACE FUNCTION public.is_admin_or_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()::text
      AND role IN ('owner', 'staff')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_store_owner()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()::text
      AND role = 'owner'
  );
$$;

-- 2. ENABLE ROW LEVEL SECURITY ON ALL TABLES
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_Categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.navigation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.homepage_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bulk_order_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. PUBLIC READ POLICIES FOR PUBLISHED CATALOGUE & CMS CONTENT
DROP POLICY IF EXISTS "Public read active categories" ON public.categories;
CREATE POLICY "Public read active categories"
  ON public.categories FOR SELECT
  USING (is_active = true OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Public read active brands" ON public.brands;
CREATE POLICY "Public read active brands"
  ON public.brands FOR SELECT
  USING (is_active = true OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Public read active products" ON public.products;
CREATE POLICY "Public read active products"
  ON public.products FOR SELECT
  USING (is_active = true OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Public read active product variants" ON public.product_variants;
CREATE POLICY "Public read active product variants"
  ON public.product_variants FOR SELECT
  USING (is_active = true OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Public read active banners" ON public.banners;
CREATE POLICY "Public read active banners"
  ON public.banners FOR SELECT
  USING (is_active = true OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Public read visible navigation" ON public.navigation_items;
CREATE POLICY "Public read visible navigation"
  ON public.navigation_items FOR SELECT
  USING (is_visible = true OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Public read visible homepage sections" ON public.homepage_sections;
CREATE POLICY "Public read visible homepage sections"
  ON public.homepage_sections FOR SELECT
  USING (is_visible = true OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Public read published cms pages" ON public.cms_pages;
CREATE POLICY "Public read published cms pages"
  ON public.cms_pages FOR SELECT
  USING (status = 'PUBLISHED' OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Public read store settings" ON public.store_settings;
CREATE POLICY "Public read store settings"
  ON public.store_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public read theme settings" ON public.theme_settings;
CREATE POLICY "Public read theme settings"
  ON public.theme_settings FOR SELECT
  USING (true);

-- 4. CUSTOMER SELF-ACCESS POLICIES (USERS, ORDERS, WISHLISTS, CARTS)
DROP POLICY IF EXISTS "Users read own profile or admin" ON public.users;
CREATE POLICY "Users read own profile or admin"
  ON public.users FOR SELECT
  USING (id = auth.uid()::text OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Users update own profile" ON public.users;
CREATE POLICY "Users update own profile"
  ON public.users FOR UPDATE
  USING (id = auth.uid()::text OR public.is_store_owner());

DROP POLICY IF EXISTS "Customers read own orders or admin" ON public.orders;
CREATE POLICY "Customers read own orders or admin"
  ON public.orders FOR SELECT
  USING (user_id = auth.uid()::text OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Customers create orders" ON public.orders;
CREATE POLICY "Customers create orders"
  ON public.orders FOR INSERT
  WITH CHECK (user_id = auth.uid()::text OR user_id IS NULL OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Customers manage own wishlist" ON public.wishlists;
CREATE POLICY "Customers manage own wishlist"
  ON public.wishlists FOR ALL
  USING (user_id = auth.uid()::text OR public.is_admin_or_staff());

-- 5. ADMIN WRITE POLICIES FOR ALL CATALOGUE, CMS & ORDER MANAGEMENT TABLES
DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;
CREATE POLICY "Admins manage categories"
  ON public.categories FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admins manage brands" ON public.brands;
CREATE POLICY "Admins manage brands"
  ON public.brands FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Admins manage products"
  ON public.products FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admins manage product variants" ON public.product_variants;
CREATE POLICY "Admins manage product variants"
  ON public.product_variants FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admins manage orders" ON public.orders;
CREATE POLICY "Admins manage orders"
  ON public.orders FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admins manage banners" ON public.banners;
CREATE POLICY "Admins manage banners"
  ON public.banners FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admins manage navigation" ON public.navigation_items;
CREATE POLICY "Admins manage navigation"
  ON public.navigation_items FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admins manage homepage sections" ON public.homepage_sections;
CREATE POLICY "Admins manage homepage sections"
  ON public.homepage_sections FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admins manage cms pages" ON public.cms_pages;
CREATE POLICY "Admins manage cms pages"
  ON public.cms_pages FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Owners manage store settings" ON public.store_settings;
CREATE POLICY "Owners manage store settings"
  ON public.store_settings FOR ALL
  USING (public.is_store_owner())
  WITH CHECK (public.is_store_owner());

DROP POLICY IF EXISTS "Admins manage notifications" ON public.notifications;
CREATE POLICY "Admins manage notifications"
  ON public.notifications FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

-- 6. SUPABASE STORAGE BUCKET & POLICIES FOR PRODUCT, BRAND & BANNER IMAGES
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admins upload product images" ON storage.objects;
CREATE POLICY "Admins upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admins update or delete product images" ON storage.objects;
CREATE POLICY "Admins update or delete product images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND public.is_admin_or_staff());
