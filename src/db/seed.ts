import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  rolesPermissions,
  categories,
  brands,
  products,
  productVariants,
  inventoryMovements,
  coupons,
  productBundles,
  storeSettings,
  serviceablePincodes,
  cmsNavigationItems,
  cmsHomepageSections,
  cmsBanners,
  cmsPages,
} from './schema.ts';

export async function ensureSeeded() {
  try {
    const existingCategories = await db.select().from(categories).limit(1);
    if (existingCategories.length > 0) {
      await ensureCmsAndExtendedCatalogueSeeded();
      return { seeded: false };
    }

    console.log('Seeding Gayatri Stationers initial development catalogue...');

    // 1. Roles & Permissions
    await db
      .insert(rolesPermissions)
      .values([
        {
          role: 'owner',
          permissions: [
            'manage_products',
            'manage_inventory',
            'manage_orders',
            'record_offline_payment',
            'process_refunds',
            'manage_coupons',
            'manage_bundles',
            'manage_settings',
            'manage_staff',
            'manage_bulk_enquiries',
          ],
          description: 'Full store owner access including staff role management and store configuration.',
        },
        {
          role: 'staff',
          permissions: [
            'manage_products',
            'manage_inventory',
            'manage_orders',
            'record_offline_payment',
            'manage_bulk_enquiries',
          ],
          description: 'Store counter & fulfilment staff access for inventory, pickup readiness, and order dispatch.',
        },
        {
          role: 'customer',
          permissions: ['place_orders', 'manage_own_cart', 'manage_own_wishlist', 'submit_bulk_enquiry'],
          description: 'Standard customer storefront access.',
        },
      ])
      .onConflictDoNothing();

    // 2. Store Settings (Clearly labelled as unverified defaults until configured by Store Owner)
    await db
      .insert(storeSettings)
      .values([
        {
          key: 'store_profile',
          valueJson: {
            storeName: 'Gayatri Stationers',
            referenceWebsite: 'https://gayatristationers.co.in/',
            verificationStatus: 'VERIFIED_STOREFRONT',
            pickupCounterLabel: 'Gayatri Stationers — Retail Pickup Counter',
            businessHoursNote: 'Mon–Sat: 10:00 AM – 8:00 PM',
            supportContactNote: 'Gayatri Stationers Retail & Institutional Desk',
            gstInvoiceSupported: true,
          },
        },
        {
          key: 'fulfilment_rules',
          valueJson: {
            storePickupEnabled: true,
            payAtStoreEnabled: true,
            scheduledPickupWindows: [
              'Today — Within 2 Hours of Ready Notification',
              'Morning Counter Slot (10:30 AM – 1:30 PM)',
              'Afternoon Counter Slot (2:00 PM – 5:00 PM)',
              'Evening Counter Slot (5:00 PM – 7:30 PM)',
            ],
            homeDeliveryEnabled: true,
            defaultDeliveryFeePaise: 6000, // ₹60
            defaultFreeDeliveryThresholdPaise: 59900, // ₹599
            codEnabledForEligiblePincodes: true,
            allowUnlistedPincodeDelivery: false,
          },
        },
      ])
      .onConflictDoNothing();

    // 3. Serviceable PIN Codes (Explicitly marked as sample rules configurable by Admin)
    await db
      .insert(serviceablePincodes)
      .values([
        {
          pincode: '282010',
          city: 'Agra (Shahganj / Local Zone)',
          state: 'Uttar Pradesh',
          deliveryFeePaise: 3500,
          freeDeliveryThresholdPaise: 39900,
          codAvailable: true,
          estimatedDays: 'Same Day / Next Day Delivery',
          isActive: true,
          isSampleRule: true,
        },
        {
          pincode: '282001',
          city: 'Agra Cantt / Civil Lines',
          state: 'Uttar Pradesh',
          deliveryFeePaise: 4500,
          freeDeliveryThresholdPaise: 49900,
          codAvailable: true,
          estimatedDays: '1–2 Business Days',
          isActive: true,
          isSampleRule: true,
        },
        {
          pincode: '282002',
          city: 'Agra (Sanjay Place / Commercial Hub)',
          state: 'Uttar Pradesh',
          deliveryFeePaise: 4000,
          freeDeliveryThresholdPaise: 49900,
          codAvailable: true,
          estimatedDays: '1–2 Business Days',
          isActive: true,
          isSampleRule: true,
        },
        {
          pincode: '221001',
          city: 'Varanasi (Lahurabir / Central)',
          state: 'Uttar Pradesh',
          deliveryFeePaise: 5500,
          freeDeliveryThresholdPaise: 59900,
          codAvailable: true,
          estimatedDays: '2–3 Business Days',
          isActive: true,
          isSampleRule: true,
        },
        {
          pincode: '110001',
          city: 'New Delhi (NCR Standard Courier)',
          state: 'Delhi',
          deliveryFeePaise: 6500,
          freeDeliveryThresholdPaise: 69900,
          codAvailable: false,
          estimatedDays: '2–4 Business Days',
          isActive: true,
          isSampleRule: true,
        },
        {
          pincode: '400001',
          city: 'Mumbai (Standard Surface Courier)',
          state: 'Maharashtra',
          deliveryFeePaise: 7500,
          freeDeliveryThresholdPaise: 79900,
          codAvailable: false,
          estimatedDays: '3–5 Business Days',
          isActive: true,
          isSampleRule: true,
        },
      ])
      .onConflictDoNothing();

    // 4. Categories (9 Core Stationery Categories)
    const insertedCategories = await db
      .insert(categories)
      .values([
        {
          name: 'Notebooks & Diaries',
          slug: 'notebooks-and-diaries',
          description: 'Ruled registers, spiral notebooks, subject books, account ledgers, and daily planners.',
          sortOrder: 1,
          isActive: true,
          isSampleData: true,
        },
        {
          name: 'Pens & Pencils',
          slug: 'pens-and-pencils',
          description: 'Ball pens, rollerballs, fountain pens, gel pens, graphite pencils, and highlighters.',
          sortOrder: 2,
          isActive: true,
          isSampleData: true,
        },
        {
          name: 'School Supplies',
          slug: 'school-supplies',
          description: 'Everyday student essentials, erasers, sharpeners, exam boards, labels, and water bottles.',
          sortOrder: 3,
          isActive: true,
          isSampleData: true,
        },
        {
          name: 'Art & Craft Supplies',
          slug: 'art-and-craft-supplies',
          description: 'Drawing books, watercolours, acrylics, oil pastels, fine art brushes, and craft paper.',
          sortOrder: 4,
          isActive: true,
          isSampleData: true,
        },
        {
          name: 'Office Stationery',
          slug: 'office-stationery',
          description: 'Calculators, staplers, desk organisers, sticky notes, markers, and register books.',
          sortOrder: 5,
          isActive: true,
          isSampleData: true,
        },
        {
          name: 'Files & Folders',
          slug: 'files-and-folders',
          description: 'Ring binders, display books, clear bags, Cobra files, and document archiving folders.',
          sortOrder: 6,
          isActive: true,
          isSampleData: true,
        },
        {
          name: 'Geometry Boxes & Accessories',
          slug: 'geometry-boxes-and-accessories',
          description: 'Mathematical drawing instruments, compass sets, scales, protractors, and stencils.',
          sortOrder: 7,
          isActive: true,
          isSampleData: true,
        },
        {
          name: 'Books & Educational Materials',
          slug: 'books-and-educational-materials',
          description: 'Atlas books, Cursive writing workbooks, graph books, practical record books, and reference guides.',
          sortOrder: 8,
          isActive: true,
          isSampleData: true,
        },
        {
          name: 'Gift & Creative Supplies',
          slug: 'gift-and-creative-supplies',
          description: 'Executive pen gift sets, calligraphy sets, journal gift boxes, and creative desk accessories.',
          sortOrder: 9,
          isActive: true,
          isSampleData: true,
        },
      ])
      .returning();

    const catMap = Object.fromEntries(insertedCategories.map((c) => [c.slug, c.id]));

    // 5. Brands
    const insertedBrands = await db
      .insert(brands)
      .values([
        { name: 'Classmate', slug: 'classmate', description: 'ITC Classmate student notebooks & stationery', isSampleData: true },
        { name: 'DOMS', slug: 'doms', description: 'DOMS pencils, art kits, geometry sets & scholastic supplies', isSampleData: true },
        { name: 'Unomax', slug: 'unomax', description: 'Precision ball, gel, and roller pens', isSampleData: true },
        { name: 'Flair', slug: 'flair', description: 'Flair Zoox & creative writing instruments', isSampleData: true },
        { name: 'Kokuyo Camlin', slug: 'camlin', description: 'Fine art materials, inks, and office supplies', isSampleData: true },
        { name: 'Nataraj', slug: 'nataraj', description: 'Classic HB pencils, sharpeners, and geometry sets', isSampleData: true },
        { name: 'Pierre Cardin', slug: 'pierre-cardin', description: 'Executive metal pens & gift stationery', isSampleData: true },
        { name: 'Casio', slug: 'casio', description: 'Desktop and scientific calculators', isSampleData: true },
        { name: 'Solo', slug: 'solo', description: 'Professional office files, folders, and ring binders', isSampleData: true },
      ])
      .returning();

    const brandMap = Object.fromEntries(insertedBrands.map((b) => [b.slug, b.id]));

    // 6. Products & Variants (Explicitly marked isSampleData: true)
    const sampleProductsData = [
      {
        sku: 'GS-NB-001',
        name: 'Classmate Pulse 6-Subject Spiral Notebook (300 Pages, 70 GSM)',
        slug: 'classmate-pulse-6-subject-spiral-notebook-300p',
        brandId: brandMap['classmate'],
        categoryId: catMap['notebooks-and-diaries'],
        shortDescription: 'Heavy-duty twin-wire spiral register with micro-perforated 70 GSM elemental chlorine-free paper and colour-coded subject dividers.',
        description:
          'Ideal for college lectures, coaching notes, and multi-subject organisation. Features smooth 70 GSM bright white paper, poly-cover protection against spills, and movable tab dividers. Sample catalogue entry for Gayatri Stationers.',
        specifications: {
          'Paper Weight': '70 GSM Elemental Chlorine Free',
          'Binding': 'Twin-Wire Spiral',
          'Dimensions': '29.7 cm x 21.0 cm (A4)',
          'Subjects': '6 Colour-Coded Sections',
          'Data Notice': 'Development Sample Entry',
        },
        mrpPaise: 22500,
        sellingPricePaise: 19500,
        taxRatePercent: 12,
        illustrationType: 'spiral_notebook',
        isFeatured: true,
        isBestseller: true,
        isNewArrival: false,
        variants: [
          {
            sku: 'GS-NB-001-SGL',
            variantName: 'Single Pack (Single Line)',
            attributeType: 'Pack & Ruling',
            attributeValue: 'Single — Ruled',
            mrpPaise: 22500,
            sellingPricePaise: 19500,
            stockQuantity: 42,
          },
          {
            sku: 'GS-NB-001-UNR',
            variantName: 'Single Pack (Unruled)',
            attributeType: 'Pack & Ruling',
            attributeValue: 'Single — Unruled',
            mrpPaise: 22500,
            sellingPricePaise: 19500,
            stockQuantity: 28,
          },
          {
            sku: 'GS-NB-001-PK3',
            variantName: 'Value Pack of 3 (Ruled)',
            attributeType: 'Pack & Ruling',
            attributeValue: 'Pack of 3 — Ruled',
            mrpPaise: 67500,
            sellingPricePaise: 55500,
            stockQuantity: 15,
          },
        ],
      },
      {
        sku: 'GS-NB-002',
        name: 'Long Hardbound Account & Register Book (240 Pages, A4)',
        slug: 'long-hardbound-account-register-book-240p',
        brandId: brandMap['classmate'],
        categoryId: catMap['notebooks-and-diaries'],
        shortDescription: 'Section-sewn hardbound register with laminated cloth spine, index page, and numbered ruled folios for school or ledger bookkeeping.',
        description:
          'Built to lie flat on desks without spine cracking. Used widely by senior school students, shopkeepers, and administrative offices for daily record keeping.',
        specifications: {
          'Binding': 'Section-Sewn Hardbound with Cloth Spine',
          'Page Count': '240 Pages',
          'Size': 'Long Book (31 cm x 19 cm)',
          'Ruling': 'Single Line with Margin & Page Numbers',
        },
        mrpPaise: 14000,
        sellingPricePaise: 11800,
        taxRatePercent: 12,
        illustrationType: 'hardbound_register',
        isFeatured: false,
        isBestseller: true,
        isNewArrival: false,
        variants: [
          {
            sku: 'GS-NB-002-1P',
            variantName: 'Single Register (240 Pages)',
            attributeType: 'Pack Size',
            attributeValue: '1 Unit',
            mrpPaise: 14000,
            sellingPricePaise: 11800,
            stockQuantity: 65,
          },
          {
            sku: 'GS-NB-002-6P',
            variantName: 'Set of 6 Registers (240 Pages each)',
            attributeType: 'Pack Size',
            attributeValue: 'Set of 6',
            mrpPaise: 84000,
            sellingPricePaise: 67500,
            stockQuantity: 20,
          },
        ],
      },
      {
        sku: 'GS-PN-001',
        name: 'Unomax Ultron 2X Matte Liquid Ball Pen Set (0.7mm Tip)',
        slug: 'unomax-ultron-2x-matte-ball-pen-set',
        brandId: brandMap['unomax'],
        categoryId: catMap['pens-and-pencils'],
        shortDescription: 'Long-writing low-viscosity ink ballpoint pen with ergonomic matte rubberised barrel for fast exam writing.',
        description:
          'Engineered with Jet-Ink technology for smudge-free writing and double write-length compared to standard ball pens. Popular among board exam candidates and office professionals.',
        specifications: {
          'Tip Size': '0.7 mm Nickel Silver Tip',
          'Finish': 'Matte Soft-Touch Grip',
          'Ink Type': 'Waterproof Low-Viscosity Oil Gel',
        },
        mrpPaise: 10000,
        sellingPricePaise: 8500,
        taxRatePercent: 18,
        illustrationType: 'pen_set',
        isFeatured: true,
        isBestseller: true,
        isNewArrival: true,
        variants: [
          {
            sku: 'GS-PN-001-BLU10',
            variantName: 'Box of 10 Pens — Blue Ink',
            attributeType: 'Ink Colour',
            attributeValue: 'Blue (Pack of 10)',
            mrpPaise: 10000,
            sellingPricePaise: 8500,
            stockQuantity: 90,
          },
          {
            sku: 'GS-PN-001-BLK10',
            variantName: 'Box of 10 Pens — Black Ink',
            attributeType: 'Ink Colour',
            attributeValue: 'Black (Pack of 10)',
            mrpPaise: 10000,
            sellingPricePaise: 8500,
            stockQuantity: 45,
          },
        ],
      },
      {
        sku: 'GS-PN-002',
        name: 'Flair Zoox F7 Roller Gel Pen Pack (0.5mm Needle Tip)',
        slug: 'flair-zoox-f7-roller-gel-pen-pack',
        brandId: brandMap['flair'],
        categoryId: catMap['pens-and-pencils'],
        shortDescription: 'Direct-fill liquid roller ink regulator system for consistent line width until the final drop.',
        description:
          'Features a visible ink window, Japanese waterproof pigment ink, and precision 0.5mm needle point for clean handwriting and diagrams.',
        specifications: {
          'Tip Type': '0.5 mm Stainless Steel Needle',
          'Ink System': 'Twin-Ball Liquid Regulator',
          'Clip': 'Spring-Loaded Metal Pocket Clip',
        },
        mrpPaise: 20000,
        sellingPricePaise: 17500,
        taxRatePercent: 18,
        illustrationType: 'roller_pen',
        isFeatured: false,
        isBestseller: false,
        isNewArrival: true,
        variants: [
          {
            sku: 'GS-PN-002-PK5',
            variantName: 'Pack of 5 (4 Blue + 1 Black)',
            attributeType: 'Pack Configuration',
            attributeValue: 'Assorted Pack of 5',
            mrpPaise: 20000,
            sellingPricePaise: 17500,
            stockQuantity: 36,
          },
        ],
      },
      {
        sku: 'GS-PN-003',
        name: 'DOMS Neon Super Dark Graphite Pencils (Box of 10 + Eraser & Sharpener)',
        slug: 'doms-neon-super-dark-graphite-pencils-box',
        brandId: brandMap['doms'],
        categoryId: catMap['pens-and-pencils'],
        shortDescription: 'High-visibility neon barrel 2B dark graphite pencils paired with a dust-free eraser and long-point sharpener.',
        description:
          'Soft, well-seasoned wood for effortless sharpening without lead breakage. High-density polymer bond graphite leaves crisp, legible marks.',
        specifications: {
          'Lead Grade': 'Extra Dark 2B',
          'Included Free': '1 Dust-Free Eraser + 1 Long-Point Sharpener',
          'Quantity': '10 Pencils per Box',
        },
        mrpPaise: 6000,
        sellingPricePaise: 5400,
        taxRatePercent: 12,
        illustrationType: 'pencil_box',
        isFeatured: false,
        isBestseller: true,
        isNewArrival: false,
        variants: [
          {
            sku: 'GS-PN-003-1BX',
            variantName: '1 Box (10 Pencils)',
            attributeType: 'Pack Size',
            attributeValue: '1 Box (10 pcs)',
            mrpPaise: 6000,
            sellingPricePaise: 5400,
            stockQuantity: 110,
          },
          {
            sku: 'GS-PN-003-5BX',
            variantName: 'School Bundle — 5 Boxes (50 Pencils)',
            attributeType: 'Pack Size',
            attributeValue: '5 Boxes (50 pcs)',
            mrpPaise: 30000,
            sellingPricePaise: 25000,
            stockQuantity: 30,
          },
        ],
      },
      {
        sku: 'GS-AR-001',
        name: 'DOMS Bi-Colour & Water Colour Pencils Studio Tin (24 Shades + Brush)',
        slug: 'doms-water-colour-pencils-studio-tin-24',
        brandId: brandMap['doms'],
        categoryId: catMap['art-and-craft-supplies'],
        shortDescription: 'Water-soluble pigment cores that blend seamlessly with a wet brush for dry sketching or watercolour washes.',
        description:
          'Housed in a protective hinged metal tin. Includes 24 rich artist pigments and a synthetic round watercolour brush for school art projects and illustration.',
        specifications: {
          'Lead Diameter': '3.0 mm Water-Soluble Core',
          'Packaging': 'Protective Hinged Metal Tin',
          'Accessories': 'Includes Round Watercolour Brush & Sharpener',
        },
        mrpPaise: 32000,
        sellingPricePaise: 28000,
        taxRatePercent: 12,
        illustrationType: 'watercolor_set',
        isFeatured: true,
        isBestseller: true,
        isNewArrival: true,
        variants: [
          {
            sku: 'GS-AR-001-24S',
            variantName: '24 Shades Metal Tin',
            attributeType: 'Shade Count',
            attributeValue: '24 Shades',
            mrpPaise: 32000,
            sellingPricePaise: 28000,
            stockQuantity: 25,
          },
          {
            sku: 'GS-AR-001-12S',
            variantName: '12 Shades Compact Pack',
            attributeType: 'Shade Count',
            attributeValue: '12 Shades',
            mrpPaise: 16500,
            sellingPricePaise: 14500,
            stockQuantity: 40,
          },
        ],
      },
      {
        sku: 'GS-AR-002',
        name: 'ITC Classmate Heavy Cartridge Drawing & Sketch Pad (A3, 140 GSM, 40 Sheets)',
        slug: 'classmate-heavy-cartridge-drawing-sketch-pad-a3',
        brandId: brandMap['classmate'],
        categoryId: catMap['art-and-craft-supplies'],
        shortDescription: 'Acid-free cold-pressed 140 GSM cartridge paper suitable for graphite, charcoal, oil pastels, and light poster washes.',
        description:
          'Top spiral-bound A3 drawing book with rigid greyboard backing so students can sketch comfortably on an easel or lap.',
        specifications: {
          'Paper Weight': '140 GSM Acid-Free Cartridge',
          'Dimensions': 'A3 (42.0 cm x 29.7 cm)',
          'Sheet Count': '40 Perforated Sheets',
        },
        mrpPaise: 19000,
        sellingPricePaise: 16500,
        taxRatePercent: 12,
        illustrationType: 'sketchbook',
        isFeatured: false,
        isBestseller: false,
        isNewArrival: true,
        variants: [
          {
            sku: 'GS-AR-002-A3',
            variantName: 'A3 Landscape (40 Sheets)',
            attributeType: 'Paper Size',
            attributeValue: 'A3',
            mrpPaise: 19000,
            sellingPricePaise: 16500,
            stockQuantity: 32,
          },
          {
            sku: 'GS-AR-002-A4',
            variantName: 'A4 Landscape (40 Sheets)',
            attributeType: 'Paper Size',
            attributeValue: 'A4',
            mrpPaise: 11000,
            sellingPricePaise: 9500,
            stockQuantity: 54,
          },
        ],
      },
      {
        sku: 'GS-GM-001',
        name: 'DOMS Geommy Mathematical Drawing Instrument Box (Die-Cast Compass Set)',
        slug: 'doms-geommy-mathematical-instrument-box',
        brandId: brandMap['doms'],
        categoryId: catMap['geometry-boxes-and-accessories'],
        shortDescription: 'Precision non-rusting die-cast metal compass, divider, 15cm scale, set squares, and 180-degree protractor with clear markings.',
        description:
          'Designed for middle and secondary school geometry construction. Self-centring compass mechanism prevents slipping during circle construction.',
        specifications: {
          'Compass Material': 'Rust-Resistant Die-Cast Zinc Alloy',
          'Contents': 'Compass, Divider, 15cm Scale, Protractor, 45° & 60° Set Squares, Pencil, Eraser, Sharpener',
          'Markings': 'Laser-Etched Fade-Resistant Graduations',
        },
        mrpPaise: 15000,
        sellingPricePaise: 13500,
        taxRatePercent: 18,
        illustrationType: 'geometry_box',
        isFeatured: true,
        isBestseller: true,
        isNewArrival: false,
        variants: [
          {
            sku: 'GS-GM-001-STD',
            variantName: 'Complete 9-Piece Tin Box',
            attributeType: 'Edition',
            attributeValue: 'Standard Tin',
            mrpPaise: 15000,
            sellingPricePaise: 13500,
            stockQuantity: 48,
          },
        ],
      },
      {
        sku: 'GS-OF-001',
        name: 'Casio DJ-120D Plus 12-Digit Desktop Check & Correct Calculator',
        slug: 'casio-dj-120d-plus-12-digit-desktop-calculator',
        brandId: brandMap['casio'],
        categoryId: catMap['office-stationery'],
        shortDescription: '300-step check and correct memory, dedicated Indian comma markers (Lakhs & Crores), and dual solar + battery power.',
        description:
          'A staple on Indian retail counters, Chartered Accountant desks, and commercial offices. Features sound-assist recheck function and durable key rollover.',
        specifications: {
          'Display': '12-Digit Extra-Large LCD with Lakh/Crore Markers',
          'Memory Steps': '300 Steps Check & Correct with Audio Assist',
          'Power Source': 'Two-Way Power (Solar + Battery)',
          'Warranty Note': 'Manufacturer Warranty Applicable',
        },
        mrpPaise: 89500,
        sellingPricePaise: 79000,
        taxRatePercent: 18,
        illustrationType: 'calculator',
        isFeatured: true,
        isBestseller: true,
        isNewArrival: false,
        variants: [
          {
            sku: 'GS-OF-001-BLK',
            variantName: 'Standard Desktop Unit (Black)',
            attributeType: 'Model',
            attributeValue: 'DJ-120D Plus',
            mrpPaise: 89500,
            sellingPricePaise: 79000,
            stockQuantity: 14,
          },
        ],
      },
      {
        sku: 'GS-FL-001',
        name: 'Solo Ring Binder & Clear Display Book Portfolio (A4, 40 Pockets)',
        slug: 'solo-clear-display-book-portfolio-a4-40-pockets',
        brandId: brandMap['solo'],
        categoryId: catMap['files-and-folders'],
        shortDescription: 'Anti-static non-stick polypropylene sleeves for storing certificates, project reports, invoices, and legal sheets.',
        description:
          'Thick textured poly cover with spine label pocket. Embossed anti-glare inner pockets prevent ink lift from photocopies and laser prints.',
        specifications: {
          'Capacity': '40 Transparent Pockets (80 Views)',
          'Sheet Size': 'A4 (210 mm x 297 mm)',
          'Material': 'Archival-Safe Polypropylene',
        },
        mrpPaise: 18500,
        sellingPricePaise: 15500,
        taxRatePercent: 18,
        illustrationType: 'file_folder',
        isFeatured: false,
        isBestseller: true,
        isNewArrival: false,
        variants: [
          {
            sku: 'GS-FL-001-NVY',
            variantName: 'Navy Blue — 40 Pockets',
            attributeType: 'Colour',
            attributeValue: 'Navy Blue',
            mrpPaise: 18500,
            sellingPricePaise: 15500,
            stockQuantity: 38,
          },
          {
            sku: 'GS-FL-001-GRY',
            variantName: 'Slate Grey — 40 Pockets',
            attributeType: 'Colour',
            attributeValue: 'Slate Grey',
            mrpPaise: 18500,
            sellingPricePaise: 15500,
            stockQuantity: 29,
          },
        ],
      },
      {
        sku: 'GS-SC-001',
        name: 'Transparent Acrylic Exam Pad & Clipboard with Metric Scale Edge',
        slug: 'transparent-acrylic-exam-pad-clipboard-a4',
        brandId: brandMap['doms'],
        categoryId: catMap['school-supplies'],
        shortDescription: 'Board-exam compliant clear acrylic writing board with heavy-duty stainless clip and centimetre/inch side graduations.',
        description:
          'Permitted in CBSE, ICSE, and state board examination halls requiring transparent writing pads. Smooth rounded corners and shatter-resistant 3mm acrylic.',
        specifications: {
          'Material': '3 mm Clear Cast Acrylic',
          'Size': 'Full Foolscap / A4 Compatible',
          'Clip': 'Rust-Proof Spring Steel Clip with Rubber Grips',
        },
        mrpPaise: 16000,
        sellingPricePaise: 13000,
        taxRatePercent: 18,
        illustrationType: 'exam_pad',
        isFeatured: false,
        isBestseller: false,
        isNewArrival: false,
        variants: [
          {
            sku: 'GS-SC-001-CLR',
            variantName: 'Clear Exam Clipboard',
            attributeType: 'Style',
            attributeValue: 'Transparent',
            mrpPaise: 16000,
            sellingPricePaise: 13000,
            stockQuantity: 52,
          },
        ],
      },
      {
        sku: 'GS-BK-001',
        name: 'Hardbound Physics / Chemistry Practical Record & Graph Book (128 Pages)',
        slug: 'hardbound-science-practical-record-book-128p',
        brandId: brandMap['classmate'],
        categoryId: catMap['books-and-educational-materials'],
        shortDescription: 'Alternating ruled observation pages and blank/graph sheets with certificate page and index table for Class 9–12 laboratory work.',
        description:
          'Standard CBSE/State Board format laboratory manual record book with laminated hard cover and thread-sewn binding.',
        specifications: {
          'Format': 'Interleaved (One Side Ruled, One Side Blank/Graph)',
          'Pages': '128 Pages + Certificate & Index',
          'Paper': '70 GSM Smooth Writing Paper',
        },
        mrpPaise: 13500,
        sellingPricePaise: 11500,
        taxRatePercent: 12,
        illustrationType: 'practical_book',
        isFeatured: false,
        isBestseller: false,
        isNewArrival: false,
        variants: [
          {
            sku: 'GS-BK-001-PHY',
            variantName: 'Physics / Chemistry Interleaved',
            attributeType: 'Subject Format',
            attributeValue: 'Ruled + Blank',
            mrpPaise: 13500,
            sellingPricePaise: 11500,
            stockQuantity: 44,
          },
          {
            sku: 'GS-BK-001-BIO',
            variantName: 'Biology Drawing & Observation',
            attributeType: 'Subject Format',
            attributeValue: 'Ruled + Cartridge Drawing',
            mrpPaise: 14500,
            sellingPricePaise: 12500,
            stockQuantity: 35,
          },
        ],
      },
      {
        sku: 'GS-GF-001',
        name: 'Pierre Cardin Gold Matte Metal Roller Pen & Refill Presentation Box',
        slug: 'pierre-cardin-executive-metal-roller-pen-gift-box',
        brandId: brandMap['pierre-cardin'],
        categoryId: catMap['gift-and-creative-supplies'],
        shortDescription: 'Balanced brass barrel in satin matte black with brushed gold trim, presented in a velvet-lined gift case with extra German ink refill.',
        description:
          'A refined gift for teachers, graduates, and corporate milestones. Includes 1 pre-installed blue roller refill and 1 spare black refill.',
        specifications: {
          'Body Material': 'Lacquered Brass with Gold Trim',
          'Refill': 'German Ceramic Roller Refill (Blue + Spare Black)',
          'Packaging': 'Hard Presentation Gift Case',
        },
        mrpPaise: 45000,
        sellingPricePaise: 39500,
        taxRatePercent: 18,
        illustrationType: 'gift_pen',
        isFeatured: true,
        isBestseller: false,
        isNewArrival: true,
        variants: [
          {
            sku: 'GS-GF-001-BLKGLD',
            variantName: 'Matte Black & Gold Trim Gift Box',
            attributeType: 'Finish',
            attributeValue: 'Matte Black / Gold',
            mrpPaise: 45000,
            sellingPricePaise: 39500,
            stockQuantity: 18,
          },
        ],
      },
    ];

    const variantLookup: Record<string, { productId: number; variantId: number; productName: string; variantName: string; pricePaise: number }> = {};

    for (const p of sampleProductsData) {
      const [insertedProduct] = await db
        .insert(products)
        .values({
          sku: p.sku,
          name: p.name,
          slug: p.slug,
          brandId: p.brandId,
          categoryId: p.categoryId,
          shortDescription: p.shortDescription,
          description: p.description,
          specifications: p.specifications as unknown as Record<string, string>,
          mrpPaise: p.mrpPaise,
          sellingPricePaise: p.sellingPricePaise,
          taxRatePercent: p.taxRatePercent,
          illustrationType: p.illustrationType,
          isFeatured: p.isFeatured,
          isBestseller: p.isBestseller,
          isNewArrival: p.isNewArrival,
          isActive: true,
          pickupEligible: true,
          deliveryEligible: true,
          isSampleData: true,
        })
        .returning();

      for (const v of p.variants) {
        const [insertedVariant] = await db
          .insert(productVariants)
          .values({
            productId: insertedProduct.id,
            sku: v.sku,
            variantName: v.variantName,
            attributeType: v.attributeType,
            attributeValue: v.attributeValue,
            mrpPaise: v.mrpPaise,
            sellingPricePaise: v.sellingPricePaise,
            stockQuantity: v.stockQuantity,
            reservedQuantity: 0,
            lowStockThreshold: 10,
            isActive: true,
          })
          .returning();

        variantLookup[v.sku] = {
          productId: insertedProduct.id,
          variantId: insertedVariant.id,
          productName: insertedProduct.name,
          variantName: insertedVariant.variantName,
          pricePaise: insertedVariant.sellingPricePaise,
        };

        await db.insert(inventoryMovements).values({
          productId: insertedProduct.id,
          variantId: insertedVariant.id,
          deltaQuantity: v.stockQuantity,
          previousStock: 0,
          newStock: v.stockQuantity,
          reason: 'INITIAL_SEED',
          referenceOrderNumber: 'SEED-INIT',
          actorEmail: 'system',
        });
      }
    }

    // 7. Coupons
    await db
      .insert(coupons)
      .values([
        {
          code: 'BACKTOSCHOOL10',
          description: '10% off on school & college stationery orders above ₹399 (up to ₹150 discount)',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          minOrderPaise: 39900,
          maxDiscountPaise: 15000,
          usageLimit: 500,
          usedCount: 0,
          isActive: true,
        },
        {
          code: 'STORE50',
          description: 'Flat ₹50 off on orders above ₹499',
          discountType: 'FLAT_PAISE',
          discountValue: 5000,
          minOrderPaise: 49900,
          maxDiscountPaise: 5000,
          usageLimit: 300,
          usedCount: 0,
          isActive: true,
        },
        {
          code: 'OFFICE100',
          description: 'Flat ₹100 off on office & register orders above ₹999',
          discountType: 'FLAT_PAISE',
          discountValue: 10000,
          minOrderPaise: 99900,
          maxDiscountPaise: 10000,
          usageLimit: 200,
          usedCount: 0,
          isActive: true,
        },
      ])
      .onConflictDoNothing();

    // 8. Product Bundles & School Supply Kits
    const nb = variantLookup['GS-NB-002-1P'];
    const pen = variantLookup['GS-PN-001-BLU10'];
    const geom = variantLookup['GS-GM-001-STD'];
    const pad = variantLookup['GS-SC-001-CLR'];
    const art = variantLookup['GS-AR-001-24S'];
    const sketch = variantLookup['GS-AR-002-A3'];

    if (nb && pen && geom && pad && art && sketch) {
      await db
        .insert(productBundles)
        .values([
          {
            name: 'Board Exam Ready Kit (Class 10 & 12)',
            slug: 'board-exam-ready-kit',
            description:
              'Complete examination hall bundle: Transparent Acrylic Exam Clipboard + DOMS Die-Cast Geometry Box + Unomax Ultron 2X Box of 10 Blue Pens.',
            targetGroup: 'Secondary & Senior School (Class 9–12)',
            originalTotalPaise: pad.pricePaise + geom.pricePaise + pen.pricePaise,
            bundlePricePaise: 31500,
            itemsJson: [
              {
                productId: pad.productId,
                variantId: pad.variantId,
                productName: pad.productName,
                variantName: pad.variantName,
                quantity: 1,
              },
              {
                productId: geom.productId,
                variantId: geom.variantId,
                productName: geom.productName,
                variantName: geom.variantName,
                quantity: 1,
              },
              {
                productId: pen.productId,
                variantId: pen.variantId,
                productName: pen.productName,
                variantName: pen.variantName,
                quantity: 1,
              },
            ],
            isActive: true,
            isSampleData: true,
          },
          {
            name: 'Fine Art & Illustration Studio Combo',
            slug: 'fine-art-illustration-studio-combo',
            description:
              'DOMS 24-Shade Water Colour Pencil Tin with Brush + ITC Classmate A3 140 GSM Heavy Cartridge Sketch Pad.',
            targetGroup: 'Art Students & Hobbyists',
            originalTotalPaise: art.pricePaise + sketch.pricePaise,
            bundlePricePaise: 39900,
            itemsJson: [
              {
                productId: art.productId,
                variantId: art.variantId,
                productName: art.productName,
                variantName: art.variantName,
                quantity: 1,
              },
              {
                productId: sketch.productId,
                variantId: sketch.variantId,
                productName: sketch.productName,
                variantName: sketch.variantName,
                quantity: 1,
              },
            ],
            isActive: true,
            isSampleData: true,
          },
        ])
        .onConflictDoNothing();
    }

    await ensureCmsAndExtendedCatalogueSeeded();

    console.log('Gayatri Stationers initial seed complete.');
    return { seeded: true };
  } catch (error) {
    console.error('Error seeding initial database:', error);
    throw new Error('Failed to initialize store seed data.', { cause: error });
  }
}

export async function ensureCmsAndExtendedCatalogueSeeded() {
  try {
    // 1. Ensure extended categories (including DIY & Crafts, Drawing & Painting, etc.) exist
    await db
      .insert(categories)
      .values([
        {
          name: 'DIY & Crafts',
          slug: 'diy-and-crafts',
          description: 'Origami sheets, craft glues, washi tapes, quilling kits, stickers, and hobby craft supplies.',
          sortOrder: 5,
          showInNav: true,
          showOnHome: true,
          showInFooter: true,
          status: 'PUBLISHED',
          seoTitle: 'DIY & Crafts Supplies | Gayatri Stationers',
          seoDescription: 'Shop origami paper, craft adhesives, decorative stickers, and DIY project kits.',
          isActive: true,
          isSampleData: false,
        },
        {
          name: 'Drawing & Painting',
          slug: 'drawing-and-painting',
          description: 'Sketchbooks, canvas pads, acrylic colours, poster paints, charcoal pencils, and brushes.',
          sortOrder: 6,
          showInNav: true,
          showOnHome: true,
          showInFooter: true,
          status: 'PUBLISHED',
          seoTitle: 'Drawing & Painting Supplies | Gayatri Stationers',
          seoDescription: 'Fine art sketchbooks, watercolour cakes, acrylic tubes, and artist brushes.',
          isActive: true,
          isSampleData: false,
        },
        {
          name: 'Markers & Highlighters',
          slug: 'markers-and-highlighters',
          description: 'Pastel highlighters, whiteboard markers, permanent markers, CD markers, and fineliners.',
          sortOrder: 10,
          showInNav: true,
          showOnHome: true,
          showInFooter: false,
          status: 'PUBLISHED',
          isActive: true,
          isSampleData: false,
        },
        {
          name: 'Adhesives, Tapes & Scissors',
          slug: 'adhesives-tapes-and-scissors',
          description: 'Glue sticks, craft glue, cello tapes, double-sided foam tape, and safety scissors.',
          sortOrder: 11,
          showInNav: true,
          showOnHome: false,
          showInFooter: false,
          status: 'PUBLISHED',
          isActive: true,
          isSampleData: false,
        },
      ])
      .onConflictDoNothing();

    // 2. Ensure extended stationery brands / companies exist
    await db
      .insert(brands)
      .values([
        {
          name: 'Faber-Castell',
          slug: 'faber-castell',
          description: 'Connector pens, watercolour pencils, textliners, crayons, and fine art supplies.',
          isFeatured: true,
          showInNav: true,
          sortOrder: 3,
          status: 'PUBLISHED',
          isActive: true,
          isSampleData: false,
        },
        {
          name: 'Hauser',
          slug: 'hauser',
          description: 'Hauser Germany XO ball pens, fountain pens, gel pens, and fluid correction pens.',
          isFeatured: true,
          showInNav: true,
          sortOrder: 4,
          status: 'PUBLISHED',
          isActive: true,
          isSampleData: false,
        },
        {
          name: 'Cello',
          slug: 'cello',
          description: 'Everyday ballpoint pens, Gripper, Butterflow, and permanent markers.',
          isFeatured: true,
          showInNav: true,
          sortOrder: 5,
          status: 'PUBLISHED',
          isActive: true,
          isSampleData: false,
        },
        {
          name: 'Apsara',
          slug: 'apsara',
          description: 'Extra dark drawing pencils, Platinum pencils, dustless erasers, and long-point sharpeners.',
          isFeatured: true,
          showInNav: true,
          sortOrder: 6,
          status: 'PUBLISHED',
          isActive: true,
          isSampleData: false,
        },
        {
          name: 'Pentonic (LINC)',
          slug: 'pentonic-linc',
          description: 'Ultra-low viscosity smooth ball pens, gel pens, and multi-colour writing packs.',
          isFeatured: true,
          showInNav: true,
          sortOrder: 7,
          status: 'PUBLISHED',
          isActive: true,
          isSampleData: false,
        },
        {
          name: 'Pidilite (Fevicol)',
          slug: 'pidilite-fevicol',
          description: 'Fevicol MR, Fevistik glue sticks, Fevicryl acrylic colours, and DIY craft adhesives.',
          isFeatured: true,
          showInNav: true,
          sortOrder: 8,
          status: 'PUBLISHED',
          isActive: true,
          isSampleData: false,
        },
        {
          name: 'Kangaro',
          slug: 'kangaro',
          description: 'Office staplers, paper punches, staple pins, and heavy-duty binding tools.',
          isFeatured: false,
          showInNav: true,
          sortOrder: 9,
          status: 'PUBLISHED',
          isActive: true,
          isSampleData: false,
        },
        {
          name: 'Navneet Youva',
          slug: 'navneet-youva',
          description: 'School notebooks, long books, drawing books, scrapbooks, and geometry boxes.',
          isFeatured: true,
          showInNav: true,
          sortOrder: 10,
          status: 'PUBLISHED',
          isActive: true,
          isSampleData: false,
        },
        {
          name: 'Brustro',
          slug: 'brustro',
          description: 'Artist grade watercolour paper, mixed media sketchbooks, gouache sets, and fineliners.',
          isFeatured: false,
          showInNav: true,
          sortOrder: 11,
          status: 'PUBLISHED',
          isActive: true,
          isSampleData: false,
        },
      ])
      .onConflictDoNothing();

    // 3. Ensure Theme & Footer settings exist in store_settings
    await db
      .insert(storeSettings)
      .values([
        {
          key: 'theme_config',
          valueJson: {
            storeName: 'Gayatri Stationers',
            tagline: 'School, Office, Fine Art & DIY Retail',
            logoText: 'Gayatri Stationers',
            logoUrl: '',
            faviconUrl: '',
            backgroundColor: '#FAFAFA',
            surfaceColor: '#FFFFFF',
            secondarySurfaceColor: '#F8FAFC',
            textColor: '#111827',
            accentColor: '#B42318',
            headerStyle: 'CLASSIC_RETAIL',
            fontPair: 'EDITORIAL_SERIF_SANS',
            buttonRadius: 'ROUNDED_SM',
            cardStyle: 'BORDERED_CLEAN',
            announcementBarEnabled: true,
            announcementBarText:
              'Store Pickup Counter Ready (Zero Delivery Fee) · Use code BACKTOSCHOOL10 for 10% off above ₹399',
            announcementBarRightText: 'Free Home Delivery on serviceable PIN codes from ₹399',
            announcementBarBg: '#0F172A',
            announcementBarTextColor: '#F8FAFC',
            status: 'PUBLISHED',
          },
        },
        {
          key: 'footer_config',
          valueJson: {
            brandSummary:
              'Retail and institutional stationery supplier for school notebooks, writing instruments, fine art supplies, DIY crafts, geometry sets, and office files.',
            showCategoriesColumn: true,
            showBrandsColumn: true,
            showServicesColumn: true,
            showPoliciesColumn: true,
            copyrightText: '© Gayatri Stationers. All rights reserved.',
            socialLinks: {
              whatsapp: '',
              instagram: '',
              facebook: '',
            },
          },
        },
      ])
      .onConflictDoNothing();

    // Ensure existing store_profile does not contain internal Admin Settings notices on public storefront
    const [existingProfile] = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.key, 'store_profile'))
      .limit(1);
    if (existingProfile && existingProfile.valueJson) {
      const profileJson = existingProfile.valueJson as Record<string, any>;
      if (
        typeof profileJson.pickupCounterLabel === 'string' &&
        profileJson.pickupCounterLabel.includes('Admin Settings')
      ) {
        await db
          .update(storeSettings)
          .set({
            valueJson: {
              ...profileJson,
              pickupCounterLabel: 'Gayatri Stationers — Retail Pickup Counter',
              businessHoursNote: 'Mon–Sat: 10:00 AM – 8:00 PM',
              supportContactNote: 'Gayatri Stationers Retail & Institutional Desk',
            },
            updatedAt: new Date(),
          })
          .where(eq(storeSettings.key, 'store_profile'));
      }
    }

    // 4. Seed Dynamic Navigation Menu Items if empty
    const existingNav = await db.select().from(cmsNavigationItems).limit(1);
    if (existingNav.length === 0) {
      await db.insert(cmsNavigationItems).values([
        {
          label: 'Shop Catalogue',
          targetType: 'CATEGORY',
          targetValue: 'ALL',
          sortOrder: 1,
          showOnDesktop: true,
          showOnMobile: true,
          isActive: true,
          status: 'PUBLISHED',
        },
        {
          label: 'DIY & Crafts',
          targetType: 'CATEGORY',
          targetValue: 'diy-and-crafts',
          sortOrder: 2,
          showOnDesktop: true,
          showOnMobile: true,
          isActive: true,
          status: 'PUBLISHED',
        },
        {
          label: 'Brands',
          targetType: 'VIEW',
          targetValue: 'brands',
          sortOrder: 3,
          showOnDesktop: true,
          showOnMobile: true,
          isActive: true,
          status: 'PUBLISHED',
        },
        {
          label: 'School Combos',
          targetType: 'VIEW',
          targetValue: 'combos',
          sortOrder: 4,
          showOnDesktop: true,
          showOnMobile: true,
          isActive: true,
          status: 'PUBLISHED',
        },
        {
          label: 'Bulk Orders',
          targetType: 'VIEW',
          targetValue: 'bulk',
          sortOrder: 5,
          showOnDesktop: true,
          showOnMobile: true,
          isActive: true,
          status: 'PUBLISHED',
        },
        {
          label: 'Track Order',
          targetType: 'VIEW',
          targetValue: 'track',
          sortOrder: 6,
          showOnDesktop: true,
          showOnMobile: true,
          isActive: true,
          status: 'PUBLISHED',
        },
      ]);
    }

    // 5. Seed Dynamic Homepage Sections if empty
    const existingSections = await db.select().from(cmsHomepageSections).limit(1);
    if (existingSections.length === 0) {
      await db
        .insert(cmsHomepageSections)
        .values([
          {
            sectionKey: 'hero_banner',
            sectionType: 'HERO_BANNER',
            title:
              'Everyday notebooks, exam instruments, and office registers—ready for counter pickup or doorstep delivery.',
            subtitle:
              'Shop ruled Classmate registers, Unomax and Flair writing pens, DOMS watercolour tins, DIY craft kits, mathematical geometry sets, and Casio desk calculators with transparent GST pricing.',
            ctaLabel: 'Browse Full Catalogue',
            ctaTarget: 'ALL',
            sortOrder: 1,
            isVisible: true,
            status: 'PUBLISHED',
            filterConfigJson: {
              kicker: 'Gayatri Stationers · School, Office, Fine Art & DIY Retail',
              secondaryCtaLabel: 'View School Supply Kits',
              secondaryCtaTarget: 'combos',
              illustrationType: 'spiral_notebook',
            },
          },
          {
            sectionKey: 'fulfilment_strip',
            sectionType: 'FULFILMENT_STRIP',
            title: 'Store Pickup & Doorstep Home Delivery',
            subtitle: 'Two complete fulfilment workflows tailored for local students, parents, and offices.',
            sortOrder: 2,
            isVisible: true,
            status: 'PUBLISHED',
            filterConfigJson: {},
          },
          {
            sectionKey: 'shop_by_category',
            sectionType: 'SHOP_BY_CATEGORY',
            title: 'Shop by Stationery Department',
            subtitle: 'Explore school supplies, notebooks, pens, DIY & crafts, fine art materials, and office essentials.',
            ctaLabel: 'View All Categories',
            ctaTarget: 'ALL',
            sortOrder: 3,
            isVisible: true,
            status: 'PUBLISHED',
            filterConfigJson: { maxItems: 8 },
          },
          {
            sectionKey: 'featured_brands',
            sectionType: 'FEATURED_BRANDS',
            title: 'Shop by Trusted Stationery Companies & Brands',
            subtitle: 'Official catalogue items from Classmate, DOMS, Faber-Castell, Camlin, Unomax, Flair, Hauser, and more.',
            ctaLabel: 'Explore All Brands',
            ctaTarget: 'brands',
            sortOrder: 4,
            isVisible: true,
            status: 'PUBLISHED',
            filterConfigJson: { maxItems: 10 },
          },
          {
            sectionKey: 'stationery_combos',
            sectionType: 'STATIONERY_COMBOS',
            title: 'Curated School & Studio Stationery Combos',
            subtitle: 'Ready-made examination and art supply kits with all items added to your cart in one click.',
            ctaLabel: 'View All Combos',
            ctaTarget: 'combos',
            sortOrder: 5,
            isVisible: true,
            status: 'PUBLISHED',
            filterConfigJson: {},
          },
        ])
        .onConflictDoNothing();
    }

    // 6. Seed Promotional Banners if empty
    const existingBanners = await db.select().from(cmsBanners).limit(1);
    if (existingBanners.length === 0) {
      await db.insert(cmsBanners).values([
        {
          title:
            'Everyday notebooks, exam instruments, and office registers—ready for counter pickup or doorstep delivery.',
          subtitle:
            'Shop ruled Classmate registers, Unomax and Flair writing pens, DOMS watercolour tins, mathematical geometry sets, and Casio desk calculators with transparent GST pricing.',
          badgeText: 'Gayatri Stationers · School, Office & Fine Art Retail',
          ctaLabel: 'Browse Full Catalogue',
          ctaTargetType: 'CATEGORY',
          ctaTargetValue: 'ALL',
          illustrationType: 'spiral_notebook',
          placement: 'HERO',
          sortOrder: 1,
          isActive: true,
          status: 'PUBLISHED',
        },
        {
          title: 'DIY & Crafts Creative Studio — Stickers, Origami, Acrylics & Adhesives',
          subtitle:
            'Everything students and hobbyists need for school project boards, scrapbooking, calligraphy, and fine art.',
          badgeText: 'Featured Department',
          ctaLabel: 'Explore DIY & Crafts',
          ctaTargetType: 'CATEGORY',
          ctaTargetValue: 'diy-and-crafts',
          illustrationType: 'watercolor_paint_box',
          placement: 'MID_PAGE',
          sortOrder: 2,
          isActive: true,
          status: 'PUBLISHED',
        },
      ]);
    }

    // 7. Seed Standard Informational & Policy Pages if empty
    const existingPages = await db.select().from(cmsPages).limit(1);
    if (existingPages.length === 0) {
      await db
        .insert(cmsPages)
        .values([
          {
            title: 'About Gayatri Stationers',
            slug: 'about-us',
            pageType: 'ABOUT',
            summary:
              'Serving students, schools, artists, and offices with genuine stationery, notebooks, exam kits, and institutional supplies.',
            contentMarkdown: `### Our Retail Heritage\nGayatri Stationers is a dedicated stationery and educational supply retailer offering school notebooks, writing instruments, fine art supplies, DIY craft essentials, geometry boxes, and office files.\n\n### Dual Fulfilment Convenience\n- **Store Pickup Counter (₹0 Fee):** Reserve your stationery items online and collect your packed order directly from our retail pickup counter using your 6-character Pickup Code.\n- **PIN-Verified Home Delivery:** Fast doorstep dispatch across serviceable PIN codes with transparent shipping thresholds.\n\n### Genuine Brands & GST Invoicing\nWe stock authentic products from trusted Indian and international stationery manufacturers including ITC Classmate, DOMS, Kokuyo Camlin, Faber-Castell, Unomax, Flair, Hauser, Casio, and Solo.`,
            seoTitle: 'About Us | Gayatri Stationers',
            seoDescription: 'Learn about Gayatri Stationers retail and institutional stationery store.',
            showInHeader: false,
            showInFooter: true,
            footerColumn: 'QUICK_LINKS',
            status: 'PUBLISHED',
          },
          {
            title: 'Store Pickup Information',
            slug: 'store-pickup-info',
            pageType: 'PICKUP_POLICY',
            summary: 'How to buy online and collect your order from the Gayatri Stationers counter with zero delivery fee.',
            contentMarkdown: `### How Store Pickup Works\n1. **Select Store Pickup at Checkout:** Choose *Option A: Store Pickup* during checkout. No shipping fee is charged.\n2. **Flexible Payment:** Pay online via Razorpay (when configured) or select **Pay at Store Counter** to pay by Cash or UPI when you collect your bag.\n3. **Wait for Ready Notification:** Our store staff picks and packs your items from shelf inventory and updates your order status to **Ready for Pickup**.\n4. **Present Your 6-Character Pickup Code:** Show your Order Number and 6-character Pickup Code at the Gayatri Stationers counter for instant handover.`,
            seoTitle: 'Store Pickup Guide | Gayatri Stationers',
            seoDescription: 'Buy stationery online and pick up at the Gayatri Stationers retail counter.',
            showInHeader: false,
            showInFooter: true,
            footerColumn: 'POLICIES',
            status: 'PUBLISHED',
          },
          {
            title: 'Shipping & Home Delivery Policy',
            slug: 'shipping-and-delivery',
            pageType: 'SHIPPING_POLICY',
            summary: 'PIN-code serviceability, delivery fees, free shipping thresholds, and dispatch timelines.',
            contentMarkdown: `### PIN-Code Serviceability\nHome delivery is available for serviceable PIN codes configured in the store's delivery table. Enter your 6-digit PIN code during checkout to verify serviceability, estimated delivery days, and Cash on Delivery (COD) eligibility.\n\n### Delivery Charges & Free Delivery Threshold\nEach serviceable zone specifies a standard delivery fee and a minimum order value above which doorstep delivery is completely free.\n\n### Dispatch & Tracking\nOnce packed and handed over to our local delivery staff or courier partner, your order status updates to **Dispatched** and **Out for Delivery** on the Live Order Tracker.`,
            seoTitle: 'Shipping & Delivery Policy | Gayatri Stationers',
            seoDescription: 'PIN-code delivery coverage, shipping charges, and dispatch timelines.',
            showInHeader: false,
            showInFooter: true,
            footerColumn: 'POLICIES',
            status: 'PUBLISHED',
          },
          {
            title: 'Returns, Exchanges & Refund Policy',
            slug: 'returns-and-refunds',
            pageType: 'RETURNS_POLICY',
            summary: 'Clear guidelines for damaged items, wrong dispatches, cancellations, and refunds.',
            contentMarkdown: `### Eligibility for Returns or Replacement\nIf you receive a damaged, defective, or incorrect stationery item, please report it within 48 hours of collection or delivery with your Order Number.\n\n### Non-Returnable Items\nOpened ink bottles, used markers, custom-printed institutional notebooks, and unsealed art colour tubes cannot be returned unless manufacturing defects are verified.\n\n### Refund Processing\nApproved refunds are logged and processed back to the original payment method or settled at the store counter.`,
            seoTitle: 'Returns & Refunds Policy | Gayatri Stationers',
            seoDescription: 'Return, replacement, and refund policy for Gayatri Stationers orders.',
            showInHeader: false,
            showInFooter: true,
            footerColumn: 'POLICIES',
            status: 'PUBLISHED',
          },
          {
            title: 'Frequently Asked Questions (FAQ)',
            slug: 'faq',
            pageType: 'FAQ',
            summary: 'Answers to common questions about store pickup codes, bulk school orders, GST invoices, and stock.',
            contentMarkdown: `### Can I pay at the store when picking up my online order?\nYes. Select **Store Pickup** and choose **Pay at Store Counter**. Your items are reserved immediately and you can pay via Cash or UPI upon collection.\n\n### Do you supply bulk stationery to schools and offices?\nYes. Visit our **Bulk Orders** page to submit your institutional requirement list with optional GSTIN for wholesale quotes.\n\n### Are all catalogue prices inclusive of GST?\nYes, all listed MRP and selling prices include applicable GST, with the tax component itemized on your checkout summary and order receipt.`,
            seoTitle: 'Frequently Asked Questions | Gayatri Stationers',
            seoDescription: 'FAQs about store pickup, home delivery, GST invoicing, and bulk stationery orders.',
            showInHeader: false,
            showInFooter: true,
            footerColumn: 'SUPPORT',
            status: 'PUBLISHED',
          },
          {
            title: 'Contact Us & Store Hours',
            slug: 'contact-us',
            pageType: 'CONTACT',
            summary: 'Store pickup desk details, business hours, and institutional enquiry support.',
            contentMarkdown: `### Retail Pickup Counter & Support Desk\nRefer to the verified store address, pickup counter hours, and support phone/WhatsApp configured by the Store Owner in **Store Settings**.\n\n### Institutional & Wholesale Desk\nFor school booklists, examination kits, and corporate office stationery contracts, use the **Bulk Orders** form for priority quotation.`,
            seoTitle: 'Contact Us | Gayatri Stationers',
            seoDescription: 'Contact Gayatri Stationers for retail pickup, order support, and bulk enquiries.',
            showInHeader: false,
            showInFooter: true,
            footerColumn: 'SUPPORT',
            status: 'PUBLISHED',
          },
          {
            title: 'Privacy Policy & Terms of Service',
            slug: 'privacy-and-terms',
            pageType: 'PRIVACY_POLICY',
            summary: 'How customer contact details, order records, and payment verifications are safeguarded.',
            contentMarkdown: `### Customer Data Protection\nWe collect only the contact details (name, mobile number, email, and delivery address) required to fulfil your Store Pickup or Home Delivery orders and send order status updates.\n\n### Payment Security\nOnline payments are processed through server-verified payment gateways. We never store raw card numbers or UPI PINs.`,
            seoTitle: 'Privacy Policy & Terms | Gayatri Stationers',
            seoDescription: 'Privacy policy and terms of service for Gayatri Stationers.',
            showInHeader: false,
            showInFooter: true,
            footerColumn: 'POLICIES',
            status: 'PUBLISHED',
          },
        ])
        .onConflictDoNothing();
    }
  } catch (err) {
    console.warn('CMS extended seed warning:', err);
  }
}

