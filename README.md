# Gayatri Stationers — Full-Stack E-Commerce Store & Retail Pickup Platform

Production-grade e-commerce storefront, dual-fulfilment checkout (**Store Pickup** & **Home Delivery**), institutional bulk-ordering portal, and role-protected **Admin Console** built for **Gayatri Stationers** (`https://gayatristationers.co.in/`).

## 1. Architecture Overview

- **Frontend**: React 19, TypeScript, Tailwind CSS (`src/App.tsx`, `src/components/AdminDashboard.tsx`, `src/components/ProductIllustration.tsx`).
- **Backend API**: Express + Vite full-stack server (`server.ts`) running on port `3000`.
- **Database**: Google Cloud SQL for PostgreSQL managed via **Drizzle ORM** (`src/db/schema.ts`, `src/db/index.ts`, `src/db/repository.ts`).
- **Authentication & RBAC**: Firebase Authentication (Google Sign-In via `signInWithPopup`) verified server-side via `firebase-admin` (`src/middleware/auth.ts`) and synchronized to PostgreSQL `users` with `customer`, `staff`, and `owner` roles.

## 2. Database Schema (`src/db/schema.ts`)

All monetary amounts are stored and calculated in **integer paise** (`100 paise = ₹1.00`) to eliminate floating-point rounding errors.

Provisioned PostgreSQL tables:
1. `users` & `roles_permissions`
2. `addresses`
3. `categories` & `brands`
4. `products` & `product_variants`
5. `inventory_movements`
6. `carts` & `cart_items`
7. `wishlists`
8. `coupons` & `product_bundles`
9. `store_settings` & `serviceable_pincodes`
10. `orders` & `order_items`
11. `payments` & `refunds`
12. `pickup_details`, `shipment_details`, & `order_activity_logs`
13. `bulk_order_enquiries` & `notifications`

## 3. Environment Variables (`.env.example`)

Copy `.env.example` to `.env` for local development:
- `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`: Runtime PostgreSQL credentials (injected automatically in AI Studio Cloud Run).
- `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`: Admin credentials used by Drizzle Kit (`src/db/drizzle.config.ts`) for schema migrations.
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`: Required for live Razorpay online payments. Online payments are never simulated without verified credentials.
- `ADMIN_OWNER_EMAILS`: Comma-separated list of emails automatically granted `owner` access upon sign-in.

## 4. Catalogue CSV Import Format

Authorised staff can export and import products via **Admin Console → CSV Import / Export**.
Required columns:
`sku,name,category_slug,brand_name,variant_sku,variant_name,attribute_type,attribute_value,mrp_rupees,selling_price_rupees,tax_rate_percent,stock_quantity,short_description,pickup_eligible,delivery_eligible,is_sample_data`

## 5. Commands to Run Locally

```bash
# Install dependencies
npm install

# Start full-stack Express + Vite server on port 3000
npm run dev

# Run TypeScript type-checking
npm run lint

# Run Vitest unit & PostgreSQL integration tests
npm test

# Build for production
npm run build
```
