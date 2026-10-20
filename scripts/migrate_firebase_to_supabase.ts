import fs from 'fs';
import path from 'path';
import { db } from '../src/db';
import {
  users,
  categories,
  brands,
  products,
  productVariants,
  orders,
  orderItems,
  cmsBanners,
  cmsNavigationItems,
  cmsHomepageSections,
  cmsPages,
  storeSettings,
  coupons,
  bulkOrderEnquiries,
  notifications,
} from '../src/db/schema';

export async function generateRecoverableMigrationBackup() {
  const [
    allUsers,
    allCategories,
    allBrands,
    allProducts,
    allVariants,
    allOrders,
    allOrderItems,
    allBanners,
    allNavigation,
    allHomepageSections,
    allCmsPages,
    allStoreSettings,
    allCoupons,
    allBulkEnquiries,
    allNotifications,
  ] = await Promise.all([
    db.select().from(users),
    db.select().from(categories),
    db.select().from(brands),
    db.select().from(products),
    db.select().from(productVariants),
    db.select().from(orders),
    db.select().from(orderItems),
    db.select().from(cmsBanners),
    db.select().from(cmsNavigationItems),
    db.select().from(cmsHomepageSections),
    db.select().from(cmsPages),
    db.select().from(storeSettings),
    db.select().from(coupons),
    db.select().from(bulkOrderEnquiries),
    db.select().from(notifications),
  ]);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    databaseEngine: 'PostgreSQL (Supabase / Drizzle ORM)',
    counts: {
      users: allUsers.length,
      categories: allCategories.length,
      brands: allBrands.length,
      products: allProducts.length,
      productVariants: allVariants.length,
      orders: allOrders.length,
      orderItems: allOrderItems.length,
      banners: allBanners.length,
      navigationItems: allNavigation.length,
      homepageSections: allHomepageSections.length,
      cmsPages: allCmsPages.length,
      storeSettings: allStoreSettings.length,
      coupons: allCoupons.length,
      bulkOrderEnquiries: allBulkEnquiries.length,
      notifications: allNotifications.length,
    },
    data: {
      users: allUsers,
      categories: allCategories,
      brands: allBrands,
      products: allProducts,
      productVariants: allVariants,
      orders: allOrders,
      orderItems: allOrderItems,
      banners: allBanners,
      navigationItems: allNavigation,
      homepageSections: allHomepageSections,
      cmsPages: allCmsPages,
      storeSettings: allStoreSettings,
      coupons: allCoupons,
      bulkOrderEnquiries: allBulkEnquiries,
      notifications: allNotifications,
    },
  };

  const backupPath = path.resolve(process.cwd(), 'migration-backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  return snapshot;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateRecoverableMigrationBackup()
    .then((snapshot) => {
      console.log('Recoverable migration backup written to migration-backup.json:', snapshot.counts);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration backup error:', err);
      process.exit(1);
    });
}
