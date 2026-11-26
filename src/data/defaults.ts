export const OWNER_EMAIL = 'vainhavgupta20052014@gmail.com';
export const STORE_ADDRESS =
  'Awas Vikas Market, Galla Mandi, Naubasta, Kanpur, Uttar Pradesh – 208021';
export const STORE_PHONE = '+91 98765 43210';
export const STORE_EMAIL = 'support@gayatristationers.co.in';

export const POLICY_URL_SLUG_MAP: Record<string, string> = {
  '/contact-us': 'contact-us',
  '/contact': 'contact-us',
  '/terms-and-conditions': 'terms-and-conditions',
  '/terms': 'terms-and-conditions',
  '/terms-of-service': 'terms-and-conditions',
  '/refunds-and-cancellations': 'refunds-and-cancellations',
  '/refund-policy': 'refunds-and-cancellations',
  '/returns-and-refunds': 'refunds-and-cancellations',
  '/shipping-and-pickup-policy': 'shipping-and-pickup-policy',
  '/shipping-policy': 'shipping-and-pickup-policy',
  '/shipping-and-delivery': 'shipping-and-pickup-policy',
  '/store-pickup-info': 'shipping-and-pickup-policy',
  '/privacy-policy': 'privacy-policy',
  '/privacy': 'privacy-policy',
  '/privacy-and-terms': 'privacy-policy',
  '/about-us': 'about-us',
  '/about': 'about-us',
  '/faq': 'faq',
};

export function normalizeCatalogueProduct(p: any): any {
  const rawPrice = Number(
    p?.sellingPricePaise ??
      p?.basePricePaise ??
      p?.pricePaise ??
      p?.variants?.[0]?.sellingPricePaise ??
      p?.variants?.[0]?.pricePaise ??
      0
  );
  const sellingPricePaise = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0;
  const rawMrp = Number(
    p?.mrpPaise ?? p?.baseMrpPaise ?? p?.variants?.[0]?.mrpPaise ?? sellingPricePaise
  );
  const mrpPaise =
    Number.isFinite(rawMrp) && rawMrp >= sellingPricePaise ? rawMrp : sellingPricePaise;

  const variants = Array.isArray(p?.variants)
    ? p.variants.map((v: any) => {
        const vRawPrice = Number(v?.sellingPricePaise ?? v?.pricePaise ?? sellingPricePaise);
        const vSellingPrice =
          Number.isFinite(vRawPrice) && vRawPrice > 0 ? vRawPrice : sellingPricePaise;
        const vRawMrp = Number(v?.mrpPaise ?? mrpPaise ?? vSellingPrice);
        const vMrp = Number.isFinite(vRawMrp) && vRawMrp >= vSellingPrice ? vRawMrp : vSellingPrice;
        return {
          ...v,
          sellingPricePaise: vSellingPrice,
          pricePaise: vSellingPrice,
          mrpPaise: vMrp,
          stockQuantity: Number.isFinite(Number(v?.stockQuantity)) ? Number(v.stockQuantity) : 50,
        };
      })
    : [];

  const totalStock = Number.isFinite(Number(p?.totalStock))
    ? Number(p.totalStock)
    : variants.reduce((sum: number, v: any) => sum + Math.max(0, Number(v.stockQuantity || 0)), 0);

  return {
    ...p,
    sellingPricePaise,
    basePricePaise: sellingPricePaise,
    mrpPaise,
    baseMrpPaise: mrpPaise,
    brandName: p?.brandName || 'Gayatri Essentials',
    categoryName: p?.categoryName || 'Stationery',
    shortDescription: p?.shortDescription || p?.description || '',
    illustrationType: p?.illustrationType || 'spiral_notebook',
    totalStock,
    variants,
  };
}

export const DEFAULT_CATEGORIES = [
  {
    id: 1,
    name: 'Notebooks & Diaries',
    slug: 'notebooks-and-diaries',
    description: 'Ruled registers, spiral notebooks, and planners',
    isActive: true,
    showInNav: true,
    showOnHomepage: true,
    showInFooter: true,
    productCount: 3,
  },
  {
    id: 2,
    name: 'Pens & Writing Instruments',
    slug: 'pens-and-writing-instruments',
    description: 'Gel pens, ball pens, rollerballs, and highlighters',
    isActive: true,
    showInNav: true,
    showOnHomepage: true,
    showInFooter: true,
    productCount: 4,
  },
  {
    id: 3,
    name: 'Art & Craft Supplies',
    slug: 'art-and-craft-supplies',
    description: 'Watercolours, sketchbooks, origami, and canvases',
    isActive: true,
    showInNav: true,
    showOnHomepage: true,
    showInFooter: true,
    productCount: 3,
  },
  {
    id: 4,
    name: 'School & Geometry Essentials',
    slug: 'school-and-geometry-essentials',
    description: 'Geometry boxes, compasses, exam pads, and rulers',
    isActive: true,
    showInNav: true,
    showOnHomepage: true,
    showInFooter: true,
    productCount: 2,
  },
  {
    id: 5,
    name: 'Office & Desk Supplies',
    slug: 'office-stationery',
    description: 'Calculators, staplers, files, and ring binders',
    isActive: true,
    showInNav: true,
    showOnHomepage: true,
    showInFooter: true,
    productCount: 2,
  },
];

export const DEFAULT_BRANDS = [
  {
    id: 1,
    name: 'ITC Classmate',
    slug: 'itc-classmate',
    description: 'Spiral notebooks, registers, and school stationery',
    isFeatured: true,
    showInNav: true,
    isActive: true,
    status: 'PUBLISHED',
    sortOrder: 1,
    productCount: 3,
  },
  {
    id: 2,
    name: 'Unomax',
    slug: 'unomax',
    description: 'Precision liquid ball pens and gel pens',
    isFeatured: true,
    showInNav: true,
    isActive: true,
    status: 'PUBLISHED',
    sortOrder: 2,
    productCount: 1,
  },
  {
    id: 3,
    name: 'Flair',
    slug: 'flair',
    description: 'Roller gel pens, fountain pens, and markers',
    isFeatured: true,
    showInNav: true,
    isActive: true,
    status: 'PUBLISHED',
    sortOrder: 3,
    productCount: 1,
  },
  {
    id: 4,
    name: 'DOMS',
    slug: 'doms',
    description: 'Colour pencils, geometry boxes, and art kits',
    isFeatured: true,
    showInNav: true,
    isActive: true,
    status: 'PUBLISHED',
    sortOrder: 4,
    productCount: 3,
  },
  {
    id: 5,
    name: 'Camlin Kokuyo',
    slug: 'camlin-kokuyo',
    description: 'Fine art paints, brushes, markers, and inks',
    isFeatured: true,
    showInNav: true,
    isActive: true,
    status: 'PUBLISHED',
    sortOrder: 5,
    productCount: 1,
  },
  {
    id: 6,
    name: 'Faber-Castell',
    slug: 'faber-castell',
    description: 'Highlighters, drawing pencils, and connectors',
    isFeatured: true,
    showInNav: true,
    isActive: true,
    status: 'PUBLISHED',
    sortOrder: 6,
    productCount: 1,
  },
  {
    id: 7,
    name: 'Schnieder Luxor',
    slug: 'schnieder-luxor',
    description: 'Precision German rollerball pens and highlighters',
    isFeatured: true,
    showInNav: true,
    isActive: true,
    status: 'PUBLISHED',
    sortOrder: 7,
    productCount: 1,
  },
  {
    id: 8,
    name: 'Casio',
    slug: 'casio',
    description: 'Desktop and scientific calculators',
    isFeatured: true,
    showInNav: true,
    isActive: true,
    status: 'PUBLISHED',
    sortOrder: 8,
    productCount: 1,
  },
];

export const DEFAULT_PRODUCTS = [
  {
    id: 1,
    name: 'Classmate Pulse 6-Subject Spiral Notebook (300 Pages, 70 GSM)',
    slug: 'classmate-pulse-6-subject-spiral-300p',
    sku: 'GS-NB-CM300',
    categoryId: 1,
    categoryName: 'Notebooks & Diaries',
    categorySlug: 'notebooks-and-diaries',
    brandId: 1,
    brandName: 'ITC Classmate',
    brandSlug: 'itc-classmate',
    description:
      'High quality 70 GSM elemental chlorine-free paper 6-subject spiral notebook with divider tabs for college lectures and coaching.',
    shortDescription: 'A4 6-subject spiral register with micro-perforated 70 GSM sheets.',
    illustrationType: 'spiral_notebook',
    mrpPaise: 22000,
    sellingPricePaise: 19500,
    taxRatePercent: 12,
    totalStock: 48,
    pickupEligible: true,
    deliveryEligible: true,
    isActive: true,
    isFeatured: true,
    isBestseller: true,
    status: 'PUBLISHED',
    badge: 'BESTSELLER',
    specifications: {
      'Paper Quality': '70 GSM Elemental Chlorine-Free',
      Binding: 'Twin-Wire Spiral',
      Size: 'A4 (29.7 x 21 cm)',
      Sections: '6 Divider Tabs',
    },
    variants: [
      {
        id: 1,
        variantName: 'Single Ruled — 300 Pages (A4)',
        sku: 'GS-NB-CM300-SR',
        mrpPaise: 22000,
        sellingPricePaise: 19500,
        stockQuantity: 48,
        inStock: true,
      },
      {
        id: 101,
        variantName: 'Unruled — 300 Pages (A4)',
        sku: 'GS-NB-CM300-UN',
        mrpPaise: 22000,
        sellingPricePaise: 19500,
        stockQuantity: 30,
        inStock: true,
      },
    ],
  },
  {
    id: 2,
    name: 'Long Hardbound Account & Register Book (240 Pages, A4)',
    slug: 'long-hardbound-register-240p',
    sku: 'GS-NB-REG240',
    categoryId: 1,
    categoryName: 'Notebooks & Diaries',
    categorySlug: 'notebooks-and-diaries',
    brandId: 1,
    brandName: 'ITC Classmate',
    brandSlug: 'itc-classmate',
    description:
      'Durable section-sewn hardbound register ideal for school notes, coaching institutes, and office ledger records.',
    shortDescription: 'Stiff laminated cover long register for daily academic and office work.',
    illustrationType: 'hardbound_register',
    mrpPaise: 14000,
    sellingPricePaise: 12000,
    taxRatePercent: 12,
    totalStock: 65,
    pickupEligible: true,
    deliveryEligible: true,
    isActive: true,
    isFeatured: true,
    isBestseller: false,
    status: 'PUBLISHED',
    specifications: {
      Binding: 'Section-Sewn Hardbound',
      Pages: '240 Numbered Pages',
      Ruling: 'Single Line with Margin',
    },
    variants: [
      {
        id: 4,
        variantName: 'Single Pack (240 Pages)',
        sku: 'GS-NB-REG240-1',
        mrpPaise: 14000,
        sellingPricePaise: 12000,
        stockQuantity: 65,
        inStock: true,
      },
      {
        id: 401,
        variantName: 'Value Pack of 4 Registers',
        sku: 'GS-NB-REG240-4',
        mrpPaise: 56000,
        sellingPricePaise: 46000,
        stockQuantity: 24,
        inStock: true,
      },
    ],
  },
  {
    id: 3,
    name: 'Unomax Ultron 2X Matte Liquid Ball Pen Set (0.7mm Tip)',
    slug: 'unomax-ultron-2x-ball-pen-set',
    sku: 'GS-PN-UNO2X',
    categoryId: 2,
    categoryName: 'Pens & Writing Instruments',
    categorySlug: 'pens-and-writing-instruments',
    brandId: 2,
    brandName: 'Unomax',
    brandSlug: 'unomax',
    description:
      'Ultra-low viscosity ink ball pens offering 2X writing length and smudge-free exam performance.',
    shortDescription: 'Smooth 0.7mm matte grip ball pens for fast exam writing.',
    illustrationType: 'ballpoint_pen',
    mrpPaise: 10000,
    sellingPricePaise: 9000,
    taxRatePercent: 18,
    totalStock: 80,
    pickupEligible: true,
    deliveryEligible: true,
    isActive: true,
    isFeatured: true,
    isBestseller: true,
    status: 'PUBLISHED',
    badge: 'POPULAR',
    variants: [
      {
        id: 6,
        variantName: 'Box of 10 Pens — Blue Ink',
        attributeType: 'Ink Colour',
        attributeValue: 'Blue Ink',
        sku: 'GS-PN-UNO2X-BLU',
        mrpPaise: 10000,
        sellingPricePaise: 9000,
        stockQuantity: 80,
        inStock: true,
      },
      {
        id: 601,
        variantName: 'Box of 10 Pens — Black Ink',
        attributeType: 'Ink Colour',
        attributeValue: 'Black Ink',
        sku: 'GS-PN-UNO2X-BLK',
        mrpPaise: 10000,
        sellingPricePaise: 9000,
        stockQuantity: 55,
        inStock: true,
      },
      {
        id: 602,
        variantName: 'Box of 10 Pens — Red Ink',
        attributeType: 'Ink Colour',
        attributeValue: 'Red Ink',
        sku: 'GS-PN-UNO2X-RED',
        mrpPaise: 10000,
        sellingPricePaise: 9000,
        stockQuantity: 35,
        inStock: true,
      },
      {
        id: 603,
        variantName: 'Box of 10 Pens — Green Ink',
        attributeType: 'Ink Colour',
        attributeValue: 'Green Ink',
        sku: 'GS-PN-UNO2X-GRN',
        mrpPaise: 10000,
        sellingPricePaise: 9000,
        stockQuantity: 25,
        inStock: true,
      },
      {
        id: 604,
        variantName: 'Box of 10 Pens — Assorted (Multi)',
        attributeType: 'Ink Colour',
        attributeValue: 'Assorted (Multi-Colour)',
        sku: 'GS-PN-UNO2X-AST',
        mrpPaise: 10000,
        sellingPricePaise: 9000,
        stockQuantity: 45,
        inStock: true,
      },
    ],
  },
  {
    id: 4,
    name: 'Flair Zoox F7 Roller Gel Pen Pack (0.5mm Needle Tip)',
    slug: 'flair-zoox-f7-roller-gel-pen',
    sku: 'GS-PN-FLZ7',
    categoryId: 2,
    categoryName: 'Pens & Writing Instruments',
    categorySlug: 'pens-and-writing-instruments',
    brandId: 3,
    brandName: 'Flair',
    brandSlug: 'flair',
    description:
      'Waterproof pigment gel ink pens with ergonomic barrel and fine 0.5mm needle tip.',
    shortDescription: 'Quick-dry waterproof gel ink pens for crisp handwriting.',
    illustrationType: 'roller_pen',
    mrpPaise: 15000,
    sellingPricePaise: 13500,
    taxRatePercent: 18,
    totalStock: 50,
    pickupEligible: true,
    deliveryEligible: true,
    isActive: true,
    isFeatured: true,
    isBestseller: false,
    status: 'PUBLISHED',
    variants: [
      {
        id: 8,
        variantName: 'Pack of 5 Pens — Blue Ink',
        attributeType: 'Ink Colour',
        attributeValue: 'Blue Ink',
        sku: 'GS-PN-FLZ7-5B',
        mrpPaise: 15000,
        sellingPricePaise: 13500,
        stockQuantity: 50,
        inStock: true,
      },
      {
        id: 801,
        variantName: 'Pack of 5 Pens — Black Ink',
        attributeType: 'Ink Colour',
        attributeValue: 'Black Ink',
        sku: 'GS-PN-FLZ7-5K',
        mrpPaise: 15000,
        sellingPricePaise: 13500,
        stockQuantity: 40,
        inStock: true,
      },
      {
        id: 802,
        variantName: 'Pack of 5 Pens — Red Ink',
        attributeType: 'Ink Colour',
        attributeValue: 'Red Ink',
        sku: 'GS-PN-FLZ7-5R',
        mrpPaise: 15000,
        sellingPricePaise: 13500,
        stockQuantity: 30,
        inStock: true,
      },
      {
        id: 803,
        variantName: 'Pack of 5 Pens — Green Ink',
        attributeType: 'Ink Colour',
        attributeValue: 'Green Ink',
        sku: 'GS-PN-FLZ7-5G',
        mrpPaise: 15000,
        sellingPricePaise: 13500,
        stockQuantity: 25,
        inStock: true,
      },
      {
        id: 804,
        variantName: 'Pack of 5 Pens — Assorted',
        attributeType: 'Ink Colour',
        attributeValue: 'Assorted (Multi-Colour)',
        sku: 'GS-PN-FLZ7-5A',
        mrpPaise: 15000,
        sellingPricePaise: 13500,
        stockQuantity: 35,
        inStock: true,
      },
    ],
  },
  {
    id: 6,
    name: 'DOMS Bi-Colour & Water Colour Pencils Studio Tin (24 Shades + Brush)',
    slug: 'doms-water-colour-pencils-24-tin',
    sku: 'GS-AR-DOM24',
    categoryId: 3,
    categoryName: 'Art & Craft Supplies',
    categorySlug: 'art-and-craft-supplies',
    brandId: 4,
    brandName: 'DOMS',
    brandSlug: 'doms',
    description:
      'Rich water-soluble colour pigments housed in a protective metal tin with detailing brush.',
    shortDescription: '24 vibrant water-soluble colour pencils in a collectible tin.',
    illustrationType: 'watercolor_set',
    mrpPaise: 32000,
    sellingPricePaise: 28500,
    taxRatePercent: 12,
    totalStock: 35,
    pickupEligible: true,
    deliveryEligible: true,
    isActive: true,
    isFeatured: true,
    isBestseller: true,
    status: 'PUBLISHED',
    variants: [
      {
        id: 11,
        variantName: '24 Shades Metal Tin + Free Brush',
        sku: 'GS-AR-DOM24-TIN',
        mrpPaise: 32000,
        sellingPricePaise: 28500,
        stockQuantity: 35,
        inStock: true,
      },
    ],
  },
  {
    id: 8,
    name: 'DOMS Geommy Mathematical Drawing Instrument Box (Die-Cast Compass Set)',
    slug: 'doms-geommy-geometry-box',
    sku: 'GS-GM-DOMG1',
    categoryId: 4,
    categoryName: 'School & Geometry Essentials',
    categorySlug: 'school-and-geometry-essentials',
    brandId: 4,
    brandName: 'DOMS',
    brandSlug: 'doms',
    description:
      'Complete school geometry kit with self-centering die-cast compass, divider, set squares, protractor, and 15cm scale.',
    shortDescription: 'Precision die-cast metal compass & mathematical drawing box.',
    illustrationType: 'geometry_box',
    mrpPaise: 16000,
    sellingPricePaise: 14500,
    taxRatePercent: 18,
    totalStock: 60,
    pickupEligible: true,
    deliveryEligible: true,
    isActive: true,
    isFeatured: true,
    isBestseller: true,
    status: 'PUBLISHED',
    variants: [
      {
        id: 15,
        variantName: 'Standard Metal Tin Box',
        sku: 'GS-GM-DOMG1-STD',
        mrpPaise: 16000,
        sellingPricePaise: 14500,
        stockQuantity: 60,
        inStock: true,
      },
    ],
  },
  {
    id: 9,
    name: 'Camlin Kokuyo Artist Water Colour Cakes Studio Palette (24 Shades + Brush)',
    slug: 'camlin-kokuyo-artist-water-colour-cakes-24',
    sku: 'GS-AR-CAM24',
    categoryId: 3,
    categoryName: 'Art & Craft Supplies',
    categorySlug: 'art-and-craft-supplies',
    brandId: 5,
    brandName: 'Camlin Kokuyo',
    brandSlug: 'camlin-kokuyo',
    description:
      'Vibrant transparent artist-grade watercolour cakes with mixing lid palette and synthetic round brush.',
    shortDescription: '24 vibrant artist watercolour cakes with mixing palette & brush.',
    illustrationType: 'drawing_book',
    mrpPaise: 24000,
    sellingPricePaise: 21500,
    taxRatePercent: 12,
    totalStock: 42,
    pickupEligible: true,
    deliveryEligible: true,
    isActive: true,
    isFeatured: true,
    isBestseller: false,
    isNewArrival: true,
    status: 'PUBLISHED',
    variants: [
      {
        id: 16,
        variantName: '24 Shades Studio Palette',
        sku: 'GS-AR-CAM24-STD',
        mrpPaise: 24000,
        sellingPricePaise: 21500,
        stockQuantity: 42,
        inStock: true,
      },
    ],
  },
  {
    id: 10,
    name: 'Faber-Castell Textliner 46 Superfluorescent Pastel Highlighter Set (Pack of 4)',
    slug: 'faber-castell-textliner-pastel-highlighters-4',
    sku: 'GS-PW-FAB04',
    categoryId: 2,
    categoryName: 'Pens & Writing Instruments',
    categorySlug: 'pens-and-writing-instruments',
    brandId: 6,
    brandName: 'Faber-Castell',
    brandSlug: 'faber-castell',
    description:
      'Smudge-proof water-based pastel highlighters with 3 line widths (1mm, 2mm, 5mm) for study notes and revision.',
    shortDescription: 'Set of 4 smudge-proof chisel-tip pastel highlighters for revision notes.',
    illustrationType: 'pen_set',
    mrpPaise: 18000,
    sellingPricePaise: 16000,
    taxRatePercent: 12,
    totalStock: 50,
    pickupEligible: true,
    deliveryEligible: true,
    isActive: true,
    isFeatured: true,
    isBestseller: false,
    isNewArrival: true,
    status: 'PUBLISHED',
    variants: [
      {
        id: 17,
        variantName: 'Pack of 4 Pastel Shades',
        sku: 'GS-PW-FAB04-SET',
        mrpPaise: 18000,
        sellingPricePaise: 16000,
        stockQuantity: 50,
        inStock: true,
      },
    ],
  },
  {
    id: 11,
    name: 'Schnieder Luxor One Business 0.6mm Liquid Rollerball & Fineliner Set (Pack of 5)',
    slug: 'schnieder-luxor-one-business-rollerball-set-5',
    sku: 'GS-PN-LUX-SCH05',
    categoryId: 2,
    categoryName: 'Pens & Writing Instruments',
    categorySlug: 'pens-and-writing-instruments',
    brandId: 7,
    brandName: 'Schnieder Luxor',
    brandSlug: 'schnieder-luxor',
    description:
      'Schnieder Luxor precision 0.6mm rollerball pens featuring regulator ink control, waterproof pigment ink, and ergonomic rubberised grip.',
    shortDescription:
      'German-engineered Super-Flow liquid ink rollerball pens for effortless executive writing.',
    illustrationType: 'gift_pen',
    mrpPaise: 25000,
    sellingPricePaise: 22000,
    taxRatePercent: 12,
    totalStock: 54,
    pickupEligible: true,
    deliveryEligible: true,
    isActive: true,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: true,
    status: 'PUBLISHED',
    variants: [
      {
        id: 18,
        variantName: 'Assorted Pack of 5 Pens',
        sku: 'GS-PN-LUX-SCH05-STD',
        mrpPaise: 25000,
        sellingPricePaise: 22000,
        stockQuantity: 54,
        inStock: true,
      },
    ],
  },
  {
    id: 12,
    name: 'DOMS Neon Super Dark Graphite Pencils (Box of 10 + Eraser & Sharpener)',
    slug: 'doms-neon-super-dark-graphite-pencils-10',
    sku: 'GS-PN-DOM10',
    categoryId: 4,
    categoryName: 'School & Geometry Essentials',
    categorySlug: 'school-and-geometry-essentials',
    brandId: 4,
    brandName: 'DOMS',
    brandSlug: 'doms',
    description:
      'Extra-dark 2B graphite bonded pencils with dust-free eraser and long-point sharpener included inside.',
    shortDescription: '10 extra-dark 2B graphite pencils with free eraser & sharpener.',
    illustrationType: 'pencil_box',
    mrpPaise: 7000,
    sellingPricePaise: 6200,
    taxRatePercent: 12,
    totalStock: 95,
    pickupEligible: true,
    deliveryEligible: true,
    isActive: true,
    isFeatured: false,
    isBestseller: true,
    isNewArrival: false,
    status: 'PUBLISHED',
    variants: [
      {
        id: 19,
        variantName: '1 Box (10 Pencils + Freebies)',
        sku: 'GS-PN-DOM10-BOX',
        mrpPaise: 7000,
        sellingPricePaise: 6200,
        stockQuantity: 95,
        inStock: true,
      },
    ],
  },
  {
    id: 13,
    name: 'ITC Classmate Heavy Cartridge Sketchbook (A3, 140 GSM, 40 Sheets)',
    slug: 'classmate-cartridge-sketchbook-a3-140gsm',
    sku: 'GS-AR-CM40A3',
    categoryId: 3,
    categoryName: 'Art & Craft Supplies',
    categorySlug: 'art-and-craft-supplies',
    brandId: 1,
    brandName: 'ITC Classmate',
    brandSlug: 'itc-classmate',
    description:
      'Acid-free cold-pressed 140 GSM cartridge drawing pad with top spiral binding and rigid greyboard backing.',
    shortDescription: 'A3 140 GSM acid-free cartridge sketch pad for drawing & washes.',
    illustrationType: 'sketchbook',
    mrpPaise: 19000,
    sellingPricePaise: 16500,
    taxRatePercent: 12,
    totalStock: 34,
    pickupEligible: true,
    deliveryEligible: true,
    isActive: true,
    isFeatured: false,
    isBestseller: false,
    isNewArrival: true,
    status: 'PUBLISHED',
    variants: [
      {
        id: 20,
        variantName: 'A3 Size (40 Sheets)',
        sku: 'GS-AR-CM40A3-STD',
        mrpPaise: 19000,
        sellingPricePaise: 16500,
        stockQuantity: 34,
        inStock: true,
      },
    ],
  },
  {
    id: 14,
    name: 'Casio DJ-120D Plus 12-Digit Desktop Check & Correct Calculator',
    slug: 'casio-dj-120d-plus-desktop-calculator',
    sku: 'GS-OF-CAS120',
    categoryId: 5,
    categoryName: 'Office & Desk Supplies',
    categorySlug: 'office-stationery',
    brandId: 8,
    brandName: 'Casio',
    brandSlug: 'casio',
    description:
      '300-step check and correct memory, dedicated Indian Lakh/Crore comma markers, and dual solar + battery power.',
    shortDescription: '300-step check & correct commercial desk calculator with Lakh/Crore display.',
    illustrationType: 'calculator',
    mrpPaise: 89500,
    sellingPricePaise: 79000,
    taxRatePercent: 18,
    totalStock: 18,
    pickupEligible: true,
    deliveryEligible: true,
    isActive: true,
    isFeatured: true,
    isBestseller: true,
    isNewArrival: false,
    status: 'PUBLISHED',
    variants: [
      {
        id: 21,
        variantName: 'DJ-120D Plus (Black)',
        sku: 'GS-OF-CAS120-BLK',
        mrpPaise: 89500,
        sellingPricePaise: 79000,
        stockQuantity: 18,
        inStock: true,
      },
    ],
  },
].map(normalizeCatalogueProduct);

export const DEFAULT_COUPONS = [
  {
    id: 1,
    code: 'BACKTOSCHOOL10',
    description: '10% off on school & college stationery orders above ₹399 (up to ₹150 off)',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minOrderPaise: 39900,
    maxDiscountPaise: 15000,
    usageLimit: 500,
    usedCount: 18,
    isActive: true,
  },
  {
    id: 2,
    code: 'STORE50',
    description: 'Flat ₹50 off on orders above ₹499',
    discountType: 'FLAT_PAISE',
    discountValue: 5000,
    minOrderPaise: 49900,
    maxDiscountPaise: 5000,
    usageLimit: 300,
    usedCount: 9,
    isActive: true,
  },
  {
    id: 3,
    code: 'OFFICE100',
    description: 'Flat ₹100 off on office & register orders above ₹999',
    discountType: 'FLAT_PAISE',
    discountValue: 10000,
    minOrderPaise: 99900,
    maxDiscountPaise: 10000,
    usageLimit: 200,
    usedCount: 4,
    isActive: true,
  },
];

export const DEFAULT_BUNDLES = [
  {
    id: 1,
    name: 'Board Exam Ready Kit (Class 10 & 12)',
    slug: 'board-exam-ready-kit',
    targetGroup: 'Secondary & Senior School (Class 9–12)',
    description:
      'Complete examination hall pack: DOMS Die-Cast Geometry Box + Unomax Ultron 2X Box of 10 Blue Pens + Long Hardbound Register (240p).',
    originalTotalPaise: 39500,
    mrpPaise: 39500,
    bundlePricePaise: 35500,
    discountPercent: 10,
    itemsJson: [
      {
        productId: 8,
        variantId: 15,
        productName: 'DOMS Geommy Mathematical Drawing Instrument Box',
        variantName: 'Standard Metal Tin Box',
        quantity: 1,
      },
      {
        productId: 3,
        variantId: 6,
        productName: 'Unomax Ultron 2X Matte Liquid Ball Pen Set',
        variantName: 'Box of 10 Pens — Blue Ink',
        quantity: 1,
      },
      {
        productId: 2,
        variantId: 4,
        productName: 'Long Hardbound Account & Register Book (240 Pages)',
        variantName: 'Single Pack (240 Pages)',
        quantity: 1,
      },
    ],
    isActive: true,
  },
  {
    id: 2,
    name: 'Fine Art & Illustration Studio Combo',
    slug: 'fine-art-studio-combo',
    targetGroup: 'Art Students & Hobbyists',
    description:
      'DOMS 24-Shade Water Colour Pencil Tin + Camlin Kokuyo 24 Watercolour Cakes Palette + ITC Classmate A3 140 GSM Sketchbook.',
    originalTotalPaise: 74500,
    mrpPaise: 74500,
    bundlePricePaise: 66500,
    discountPercent: 11,
    itemsJson: [
      {
        productId: 6,
        variantId: 11,
        productName: 'DOMS Bi-Colour & Water Colour Pencils Studio Tin (24 Shades)',
        variantName: '24 Shades Metal Tin + Free Brush',
        quantity: 1,
      },
      {
        productId: 9,
        variantId: 16,
        productName: 'Camlin Kokuyo Artist Water Colour Cakes Studio Palette',
        variantName: '24 Shades Studio Palette',
        quantity: 1,
      },
      {
        productId: 13,
        variantId: 20,
        productName: 'ITC Classmate Heavy Cartridge Sketchbook (A3, 140 GSM)',
        variantName: 'A3 Size (40 Sheets)',
        quantity: 1,
      },
    ],
    isActive: true,
  },
  {
    id: 3,
    name: 'Daily College & Study Desk Pack',
    slug: 'daily-college-study-pack',
    targetGroup: 'College Students & Competitive Aspirants',
    description:
      'Classmate Pulse 6-Subject 300p Spiral Register + Faber-Castell 4 Pastel Highlighters + Flair Zoox F7 0.5mm Gel Pen Pack.',
    originalTotalPaise: 49000,
    bundlePricePaise: 49000,
    itemsJson: [
      {
        productId: 1,
        variantId: 1,
        productName: 'Classmate Pulse 6-Subject Spiral Notebook (300 Pages)',
        variantName: 'Single Ruled — 300 Pages (A4)',
        quantity: 1,
      },
      {
        productId: 10,
        variantId: 17,
        productName: 'Faber-Castell Textliner 46 Pastel Highlighter Set (Pack of 4)',
        variantName: 'Pack of 4 Pastel Shades',
        quantity: 1,
      },
      {
        productId: 4,
        variantId: 8,
        productName: 'Flair Zoox F7 Roller Gel Pen Pack (0.5mm)',
        variantName: 'Pack of 5 Pens — Blue Ink',
        quantity: 1,
      },
    ],
    discountPercent: 10,
    mrpPaise: 54500,
    isActive: true,
  },
  {
    id: 4,
    name: 'Corporate & Accounting Desk Combo',
    slug: 'corporate-accounting-desk-combo',
    targetGroup: 'Offices, CAs & Shop Counters',
    description:
      'Casio DJ-120D Plus 12-Digit Check Calculator + Hardbound Account Register (240p) + Schnieder Luxor 0.6mm Executive Rollerballs.',
    originalTotalPaise: 96000,
    mrpPaise: 108000,
    bundlePricePaise: 89900,
    discountPercent: 17,
    itemsJson: [
      {
        productId: 14,
        variantId: 21,
        productName: 'Casio DJ-120D Plus 12-Digit Desktop Check & Correct Calculator',
        variantName: 'DJ-120D Plus (Black)',
        quantity: 1,
      },
      {
        productId: 2,
        variantId: 4,
        productName: 'Long Hardbound Account & Register Book (240 Pages)',
        variantName: 'Single Pack (240 Pages)',
        quantity: 1,
      },
      {
        productId: 11,
        variantId: 18,
        productName: 'Schnieder Luxor One Business 0.6mm Liquid Rollerball Set (Pack of 5)',
        variantName: 'Assorted Pack of 5 Pens',
        quantity: 1,
      },
    ],
    isActive: true,
  },
];

export const DEFAULT_PINCODES = [
  {
    id: 1,
    pincode: '208021',
    city: 'Kanpur (Naubasta / Awas Vikas / Galla Mandi)',
    state: 'Uttar Pradesh',
    deliveryFeePaise: 0,
    freeDeliveryThresholdPaise: 0,
    codAvailable: true,
    estimatedDays: 'Same Day / Next Day Delivery',
    isActive: true,
  },
  {
    id: 2,
    pincode: '208001',
    city: 'Kanpur (Civil Lines / Mall Road)',
    state: 'Uttar Pradesh',
    deliveryFeePaise: 0,
    freeDeliveryThresholdPaise: 0,
    codAvailable: true,
    estimatedDays: 'Same Day / Next Day Delivery',
    isActive: true,
  },
  {
    id: 3,
    pincode: '208002',
    city: 'Kanpur (Swaroop Nagar / Arya Nagar)',
    state: 'Uttar Pradesh',
    deliveryFeePaise: 0,
    freeDeliveryThresholdPaise: 0,
    codAvailable: true,
    estimatedDays: 'Same Day / Next Day Delivery',
    isActive: true,
  },
  {
    id: 4,
    pincode: '208012',
    city: 'Kanpur (Gumti No. 5 / Kidwai Nagar)',
    state: 'Uttar Pradesh',
    deliveryFeePaise: 0,
    freeDeliveryThresholdPaise: 0,
    codAvailable: true,
    estimatedDays: '1–2 Business Days',
    isActive: true,
  },
  {
    id: 5,
    pincode: '208005',
    city: 'Kanpur (Kakadeo / Pandu Nagar)',
    state: 'Uttar Pradesh',
    deliveryFeePaise: 0,
    freeDeliveryThresholdPaise: 0,
    codAvailable: true,
    estimatedDays: 'Same Day – 1 Business Day',
    isActive: true,
  },
];

export const DEFAULT_CMS_PAGES = [
  {
    id: 501,
    title: 'Contact Us',
    slug: 'contact-us',
    pageType: 'POLICY',
    summary:
      'Official merchant contact details, registered retail store address, telephone, email, and customer grievance redressal officer for Gayatri Stationers.',
    contentMarkdown: `Merchant & Legal Entity Name: Gayatri Stationers
Trade / Brand Name: Gayatri Stationers (gayatristationers.netlify.app)

Registered & Retail Store Address (Visit Us):
Gayatri Stationers — Retail & Institutional Supply Counter
Awas Vikas Market, Galla Mandi, Naubasta,
Kanpur, Uttar Pradesh – 208021, India

Customer Support & Order Helpline:
• Telephone / Mobile / WhatsApp: +91 98765 43210
• Customer Support Email: support@gayatristationers.co.in
• Owner / Escalation Email: vainhavgupta20052014@gmail.com
• Operating Hours: Monday to Saturday, 10:00 AM – 8:00 PM IST (Closed on Sundays & National Holidays)

Grievance Redressal Officer:
• Name: Vaibhav Gupta (Proprietor & Store Owner)
• Designation: Grievance Officer — Gayatri Stationers
• Address: Awas Vikas Market, Galla Mandi, Naubasta, Kanpur, Uttar Pradesh – 208021, India
• Email: vainhavgupta20052014@gmail.com
• Resolution Timeline: All payment, delivery, or product queries are acknowledged within 24 hours and resolved within 2–5 business days.`,
    isActive: true,
    showInFooter: true,
    showInHeader: true,
    status: 'PUBLISHED',
  },
  {
    id: 502,
    title: 'Terms & Conditions',
    slug: 'terms-and-conditions',
    pageType: 'POLICY',
    summary:
      'Terms of Service and Conditions of Sale governing online stationery purchases, INR pricing, GST invoicing, and order fulfilment at Gayatri Stationers.',
    contentMarkdown: `1. Introduction & Acceptance of Terms
Welcome to Gayatri Stationers ("we", "our", "us"). By accessing or placing an order on our website, you agree to be bound by these Terms & Conditions, our Refunds & Cancellations Policy, and applicable laws of India.

2. Products, Services & INR Pricing
• Gayatri Stationers retails authentic school notebooks, registers, writing instruments (pens, pencils, markers), fine art & craft materials, geometry instruments, calculators, and office filing stationery, as well as institutional bulk supply services.
• All product and service prices on this website are listed strictly in Indian Rupees (INR / ₹) and are inclusive of applicable Goods and Services Tax (GST) unless explicitly stated otherwise.
• We reserve the right to update product pricing, stock availability, and promotional offers prior to order confirmation.

3. Payments & Security
• We accept online payments in Indian Rupees (INR) via Cashfree Payments (UPI, Google Pay, PhonePe, Paytm, Credit Cards, Debit Cards, and NetBanking), Cash on Delivery (COD) for eligible delivery orders, and Pay at Store Counter for Store Pickup orders.
• All online payments are processed through PCI-DSS compliant payment gateways. Gayatri Stationers does not store your card numbers, CVV, or UPI PINs on its servers.

4. Order Fulfilment, Store Pickup & Home Delivery
• Store Pickup orders generate a 6-digit Pickup Code and can be collected from our Kanpur retail counter during business hours once ready.
• Home Delivery orders are dispatched to the customer's shipping address and PIN code within 24–48 business hours.

5. Limitation of Liability & Governing Law
• Our maximum liability for any claim arising out of an order shall not exceed the total amount paid by the customer in INR for that specific order.
• These Terms & Conditions are governed by the laws of India, and any disputes shall be subject to the exclusive jurisdiction of the courts in Kanpur, Uttar Pradesh.`,
    isActive: true,
    showInFooter: true,
    showInHeader: true,
    status: 'PUBLISHED',
  },
  {
    id: 503,
    title: 'Refunds & Cancellations',
    slug: 'refunds-and-cancellations',
    pageType: 'POLICY',
    summary:
      'Complete Order Cancellation, Return, Replacement, and Refund Policy with timelines for UPI, Card, NetBanking, and COD orders.',
    contentMarkdown: `1. Order Cancellation Policy
• Before Dispatch / Pickup: You may cancel your order at any time before it is marked "Dispatched / Out for Delivery" or collected at the Store Pickup counter. A 100% full refund in INR (₹) will be initiated with zero cancellation charges.
• How to Cancel: Contact our support desk at support@gayatristationers.co.in or +91 98765 43210 with your Order Number (e.g., GS-XXXXXX).

2. Return & Replacement Eligibility (7-Day Window)
• Customers can request a return, replacement, or refund within 7 calendar days of receiving the delivery or collecting the order if:
  (a) The stationery item received is physically damaged, defective, or broken in transit;
  (b) An incorrect product, variant, or quantity was delivered compared to the order invoice;
  (c) The item is unused, in its original manufacturer packaging, with intact tags and seals.
• Opened ink bottles, used pens/markers, or custom-printed institutional stationery are only eligible for return if delivered in a defective or damaged condition.

3. Refund Processing & Timelines (in INR / ₹)
• Online Prepaid Orders (UPI / Credit Card / Debit Card / NetBanking): Once your cancellation or return is approved, the refund is initiated within 24–48 business hours. The refunded amount in INR (₹) will be credited back to your original payment source within 5 to 7 business days, depending on your issuing bank or UPI provider.
• Cash on Delivery (COD) & Pay at Store Orders: Refunds for returned COD or counter-paid orders are processed in INR (₹) via UPI transfer or NEFT/IMPS bank transfer to the customer's verified bank account within 3 to 5 business days.`,
    isActive: true,
    showInFooter: true,
    showInHeader: true,
    status: 'PUBLISHED',
  },
  {
    id: 504,
    title: 'Shipping & Delivery Policy',
    slug: 'shipping-and-pickup-policy',
    pageType: 'POLICY',
    summary:
      'Store Pickup counter slots, Home Delivery shipping charges in INR, and estimated dispatch timelines.',
    contentMarkdown: `1. Store Pickup (FREE — ₹0 INR)
• Select "Store Pickup" at checkout to reserve your stationery items immediately at Gayatri Stationers (Awas Vikas Market, Galla Mandi, Naubasta, Kanpur – 208021).
• Present your 6-digit Pickup Code at our retail counter during business hours (Mon–Sat, 10:00 AM – 8:00 PM).

2. Home Delivery & Courier Dispatch
• Local Kanpur Delivery (PIN 208021, 208001, 208002, 208012): Same-Day or Next-Business-Day delivery (FREE ₹0 delivery surcharge).
• Outstation & National Delivery: Dispatched within 24–48 hours via tracked surface/air courier with delivery in 2–5 business days.`,
    isActive: true,
    showInFooter: true,
    showInHeader: false,
    status: 'PUBLISHED',
  },
  {
    id: 505,
    title: 'Privacy Policy',
    slug: 'privacy-policy',
    pageType: 'POLICY',
    summary:
      'How Gayatri Stationers collects, uses, and protects your personal contact details and payment information.',
    contentMarkdown: `1. Information We Collect
We collect your name, mobile number, email address, and delivery address solely to process your stationery orders, send GST invoices, provide order tracking updates, and fulfill customer support requests.

2. Payment Data Security
All online payments (UPI, Credit/Debit Cards, NetBanking) are processed securely through our encrypted Online Payment Gateway using industry-standard PCI-DSS compliance. We never store your card numbers, CVV, or banking passwords.

3. Data Sharing & Contact
We never sell or rent customer personal data to third parties. Data is shared only with logistics partners and payment processors strictly to complete your transaction. For privacy inquiries, email support@gayatristationers.co.in.`,
    isActive: true,
    showInFooter: true,
    showInHeader: false,
    status: 'PUBLISHED',
  },
  {
    id: 506,
    title: 'About Us',
    slug: 'about-us',
    pageType: 'INFO',
    summary:
      'Serving students, schools, artists, and offices in Kanpur with genuine stationery, notebooks, exam kits, and institutional supplies.',
    contentMarkdown: `Our Retail Heritage
Gayatri Stationers is a trusted stationery and educational supply store located in Awas Vikas Market, Galla Mandi, Naubasta, Kanpur. We serve students, parents, artists, schools, coaching centres, and corporate offices with genuine products at transparent GST-inclusive rates.

Dual Fulfilment Convenience
• Store Pickup Counter (₹0 Fee): Reserve your stationery online and collect your packed bag from our Kanpur counter with a 6-digit Pickup Code.
• Express Home Delivery: Doorstep dispatch across Kanpur PIN codes and nationwide.

Authorised Retail Partner
We stock genuine stationery from ITC Classmate, DOMS, Kokuyo Camlin, Faber-Castell, Unomax, Flair, Schnieder Luxor, and Casio.`,
    isActive: true,
    showInFooter: true,
    showInHeader: false,
    status: 'PUBLISHED',
  },
  {
    id: 507,
    title: 'Frequently Asked Questions (FAQ)',
    slug: 'faq',
    pageType: 'INFO',
    summary:
      'Answers to common questions about store pickup codes, bulk school orders, promo coupons, and GST invoices.',
    contentMarkdown: `Can I pay at the store when picking up my online order?
Yes! Choose "Get at Store" and select "Pay at Store Counter". Your items are reserved immediately, and you can pay by Cash or UPI when picking up your bag at our Naubasta, Kanpur store.

Which coupon codes can I apply?
You can apply BACKTOSCHOOL10 (10% off above ₹399), STORE50 (₹50 off above ₹499), or OFFICE100 (₹100 off above ₹999) directly in the Shopping Bag drawer or at Checkout.

Do you supply bulk stationery to schools and offices?
Yes. Visit our Bulk Orders page to submit your institutional requirement list with optional GSTIN for wholesale pricing.`,
    isActive: true,
    showInFooter: true,
    showInHeader: false,
    status: 'PUBLISHED',
  },
];
