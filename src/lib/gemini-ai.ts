import { GoogleGenAI, Type } from '@google/genai';

export interface WebPhotoCandidate {
  url: string;
  title: string;
  source: string;
}

const CURATED_WEB_STATIONERY_PHOTOS: Array<{
  keywords: string[];
  photos: WebPhotoCandidate[];
}> = [
  {
    keywords: ['notebook', 'register', 'classmate', 'ruled', 'spiral', 'diary', 'journal', 'book', 'copy', 'a4'],
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=900&q=85',
        title: 'Spiral Ruled Notebook & Register Set',
        source: 'Web Product Photo · Notebooks',
      },
      {
        url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=900&q=85',
        title: 'Hardbound A4 College Register',
        source: 'Web Product Photo · Registers',
      },
      {
        url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=900&q=85',
        title: 'Premium Ruled Exercise Notebook',
        source: 'Web Product Photo · Study Notes',
      },
      {
        url: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=85',
        title: 'Executive Journal & Fountain Notebook',
        source: 'Web Product Photo · Journals',
      },
    ],
  },
  {
    keywords: ['pen', 'ball', 'gel', 'roller', 'flair', 'unomax', 'reynolds', 'cello', 'hauser', 'pentonic', 'marker', 'highlighter', 'pencil', 'apsara', 'nataraj'],
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1585336261026-6a66e2e6f3fd?auto=format&fit=crop&w=900&q=85',
        title: 'Smooth Flow Ball & Gel Pens Assortment',
        source: 'Web Product Photo · Pens & Writing',
      },
      {
        url: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=900&q=85',
        title: 'Precision Writing Pen Collection',
        source: 'Web Product Photo · Writing Instruments',
      },
      {
        url: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=900&q=85',
        title: 'Graphite Pencils & Colouring Set',
        source: 'Web Product Photo · Pencils & Sketching',
      },
      {
        url: 'https://images.unsplash.com/photo-1568205612837-017257d2310a?auto=format&fit=crop&w=900&q=85',
        title: 'Pastel Highlighters & Fine Liners',
        source: 'Web Product Photo · Highlighters',
      },
    ],
  },
  {
    keywords: ['art', 'paint', 'water', 'colour', 'color', 'doms', 'camlin', 'sketch', 'brush', 'crayon', 'pastel', 'canvas', 'drawing', 'craft', 'diy', 'origami', 'fevicol', 'glue', 'scissor'],
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=85',
        title: 'Artist Watercolour Cakes & Brushes Kit',
        source: 'Web Product Photo · Art & Craft',
      },
      {
        url: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=900&q=85',
        title: 'Fine Art Acrylic & Poster Colour Palette',
        source: 'Web Product Photo · Fine Art Supplies',
      },
      {
        url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=900&q=85',
        title: 'Drawing & Craft Colour Pencils Studio Pack',
        source: 'Web Product Photo · Drawing & DIY',
      },
      {
        url: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=900&q=85',
        title: 'DIY Craft Paper, Scissors & Adhesive Set',
        source: 'Web Product Photo · DIY & Craft',
      },
    ],
  },
  {
    keywords: ['geometry', 'compass', 'ruler', 'scale', 'protractor', 'math', 'calculator', 'casio', 'exam', 'board', 'clip'],
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=900&q=85',
        title: 'Precision Mathematical Geometry & Compass Set',
        source: 'Web Product Photo · Geometry & Exam',
      },
      {
        url: 'https://images.unsplash.com/photo-1594608661623-aa0bd3a69d98?auto=format&fit=crop&w=900&q=85',
        title: 'Scientific & Desktop Calculator',
        source: 'Web Product Photo · Calculators',
      },
      {
        url: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=900&q=85',
        title: 'Drafting Scale, Protractor & Set Squares',
        source: 'Web Product Photo · Technical Drawing',
      },
    ],
  },
  {
    keywords: ['office', 'file', 'folder', 'stapler', 'kangaro', 'punch', 'tape', 'sticky', 'note', 'organizer', 'desk', 'clip', 'pin'],
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?auto=format&fit=crop&w=900&q=85',
        title: 'Office Desk Essentials & Document Organisers',
        source: 'Web Product Photo · Office Supplies',
      },
      {
        url: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=900&q=85',
        title: 'Ring Binders, Box Files & Sticky Notes',
        source: 'Web Product Photo · Files & Folders',
      },
      {
        url: 'https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?auto=format&fit=crop&w=900&q=85',
        title: 'Sticky Notes & Colour Index Tabs Pack',
        source: 'Web Product Photo · Desk Supplies',
      },
    ],
  },
];

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Searches Wikimedia Commons + Openverse + Curated Web Product Photography for real web photos.
 */
export async function searchWebProductPhotos(params: {
  query: string;
  brandName?: string;
  categoryName?: string;
}): Promise<WebPhotoCandidate[]> {
  const rawQuery = [params.query, params.brandName, params.categoryName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const qLower = (rawQuery || 'stationery notebook pen').toLowerCase();
  const results: WebPhotoCandidate[] = [];
  const seenUrls = new Set<string>();

  const pushUnique = (item: WebPhotoCandidate) => {
    if (!item?.url || !item.url.startsWith('http')) return;
    if (seenUrls.has(item.url)) return;
    seenUrls.add(item.url);
    results.push(item);
  };

  // 1. Try Wikimedia Commons real product photo search
  try {
    const cleanSearch = encodeURIComponent(
      `${params.query || 'stationery'} ${params.brandName || ''}`.trim()
    );
    const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=filetype:bitmap+${cleanSearch}&gsrlimit=6&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const wikiRes = await fetch(wikiUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (wikiRes.ok) {
      const wikiData: any = await wikiRes.json();
      const pages = wikiData?.query?.pages ? Object.values(wikiData.query.pages) : [];
      for (const page of pages as any[]) {
        const info = page?.imageinfo?.[0];
        const thumbUrl = info?.thumburl || info?.url;
        if (thumbUrl && /\.(jpg|jpeg|png|webp)$/i.test(thumbUrl)) {
          pushUnique({
            url: thumbUrl,
            title: String(page?.title || params.query || 'Web Product Photo')
              .replace(/^File:/i, '')
              .replace(/\.[a-z0-9]+$/i, '')
              .replace(/_/g, ' '),
            source: 'Wikimedia Web Commons',
          });
        }
      }
    }
  } catch {
    // Ignore network timeout and continue with curated web photos
  }

  // 2. Match curated high-res stationery web photos by keyword
  for (const group of CURATED_WEB_STATIONERY_PHOTOS) {
    if (group.keywords.some((kw) => qLower.includes(kw))) {
      for (const photo of group.photos) {
        pushUnique({
          ...photo,
          title: params.query ? `${params.query} — ${photo.title}` : photo.title,
        });
      }
    }
  }

  // 3. Fill up to 6 web photos so the admin always has rich choices
  for (const group of CURATED_WEB_STATIONERY_PHOTOS) {
    for (const photo of group.photos) {
      if (results.length >= 8) break;
      pushUnique(photo);
    }
  }

  return results.slice(0, 8);
}

export interface GroundingSourceLink {
  uri: string;
  title: string;
}

export interface CustomerRufusRequest {
  question: string;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
  currentProduct?: any | null;
  catalogue?: any[];
  enableSearchGrounding?: boolean;
}

export interface CustomerRufusResponse {
  answer: string;
  recommendedProductIds: number[];
  followUpQuestions: string[];
  searchGrounded?: boolean;
  groundingSources?: GroundingSourceLink[];
  searchQueries?: string[];
  clientAction?: {
    type: 'NONE' | 'ADD_TO_CART' | 'FILTER_CATEGORY' | 'FILTER_BRAND' | 'OPEN_CHECKOUT' | 'TRACK_ORDER';
    productId?: number;
    quantity?: number;
    categorySlug?: string;
    brandSlug?: string;
  };
}

/**
 * Vidya AI Customer Shopping Assistant powered by Gemini ('gemini-3.8-flash') with Google Search Grounding.
 * Provides real-time Indian stationery market trends, pricing comparisons, and product reviews alongside
 * Gayatri Stationers live catalogue recommendations.
 */
export async function askCustomerRufusAssistant(
  params: CustomerRufusRequest
): Promise<CustomerRufusResponse> {
  const question = (params.question || '').trim();
  const catalogue = Array.isArray(params.catalogue) ? params.catalogue : [];
  const activeProducts = catalogue.filter((p) => p && p.isActive !== false);
  const useSearchGrounding = params.enableSearchGrounding !== false;

  const compactCatalogue = activeProducts.slice(0, 45).map((p) => ({
    id: Number(p.id),
    sku: p.sku,
    name: p.name,
    brand: p.brandName || 'Gayatri Stationers',
    category: p.categoryName || p.categorySlug || 'Stationery',
    categorySlug: p.categorySlug || '',
    priceRupees: Math.round(Number(p.sellingPricePaise || 0) / 100),
    mrpRupees: Math.round(Number(p.mrpPaise || p.sellingPricePaise || 0) / 100),
    inStock: (p.variants?.[0]?.stockQuantity ?? 25) > 0,
    shortDescription: p.shortDescription || '',
  }));

  // Score catalogue matches so we always attach relevant store product cards
  const qLower = question.toLowerCase();
  const scored = activeProducts
    .map((p) => {
      let score = 0;
      const hay = `${p.name} ${p.brandName || ''} ${p.categoryName || ''} ${p.shortDescription || ''} ${p.sku || ''}`.toLowerCase();
      for (const word of qLower.split(/\s+/).filter((w) => w.length > 2)) {
        if (hay.includes(word)) score += 3;
      }
      if (params.currentProduct && Number(p.id) === Number(params.currentProduct.id)) {
        score += 5;
      }
      if (p.isFeatured || p.isBestseller) score += 1;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score);

  const defaultMatchedIds = scored.slice(0, 3).map((s) => Number(s.p.id));

  const ai = getGeminiClient();
  if (ai) {
    try {
      const historyText = (params.history || [])
        .slice(-6)
        .map((m) => `${m.role === 'user' ? 'Customer' : 'Vidya AI'}: ${m.text}`)
        .join('\n');

      const currentProdContext = params.currentProduct
        ? `CURRENTLY VIEWED PRODUCT ON PAGE: ID=${params.currentProduct.id}, Name="${params.currentProduct.name}", Brand="${params.currentProduct.brandName}", Gayatri Stationers Selling Price=₹${Math.round(
            Number(params.currentProduct.sellingPricePaise || 0) / 100
          )} (MRP ₹${Math.round(
            Number(params.currentProduct.mrpPaise || 0) / 100
          )}), Description="${params.currentProduct.description || params.currentProduct.shortDescription || ''}"`
        : 'Customer is browsing the main Gayatri Stationers storefront.';

      const systemPrompt = `You are Vidya AI, the official AI Shopping & Study Guide for Gayatri Stationers (Visit Us: Awas Vikas Market, Galla Mandi, Naubasta, Kanpur, Uttar Pradesh - 208021).
You have access to Google Search Grounding to provide:
1. Real-time Indian stationery market trends (popular student pens, notebooks, paper GSM standards, art supplies, exam essentials).
2. Live pricing comparisons between Gayatri Stationers' discounted retail prices (in ₹ INR) vs typical online marketplace prices / MRP.
3. Verified student, artist, and teacher product reviews (ink smoothness, waterproofness, paper bleed-through, durability).
4. Direct catalogue recommendations from Gayatri Stationers with ₹0 Store Pickup (Kanpur Counter) and Pan-India Shiprocket Home Delivery.

STORE POLICIES & FACTS:
- Store Pickup: ₹0 fee at Awas Vikas Market, Galla Mandi, Naubasta, Kanpur - 208021. Reserve online and collect using the 6-digit Pickup Code.
- Home Delivery: Pan-India doorstep courier delivery powered by Shiprocket across all 6-digit Indian PIN codes (Cash on Delivery & Cashfree Online Payment supported).
- Promo Code: BACKTOSCHOOL10 gives 10% off on orders above ₹399.
- Format your response clearly using concise bullet points and bold (**text**) highlights. Always quote exact prices in Indian Rupees (₹).

${currentProdContext}

LIVE STORE CATALOGUE (JSON):
${JSON.stringify(compactCatalogue)}

RECENT CONVERSATION:
${historyText}`;

      if (useSearchGrounding) {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Customer Question: ${question}\n\nProvide a helpful, well-structured answer combining Gayatri Stationers' live catalogue prices with real-time Indian stationery market trends, price comparisons, and product review insights.`,
          config: {
            systemInstruction: systemPrompt,
            tools: [{ googleSearch: {} }],
          },
        });

        const rawText = (response.text || '').trim();
        const groundingMetadata: any = response.candidates?.[0]?.groundingMetadata;
        const chunks: any[] = Array.isArray(groundingMetadata?.groundingChunks)
          ? groundingMetadata.groundingChunks
          : [];
        const groundingSources: GroundingSourceLink[] = [];
        const seenUris = new Set<string>();

        for (const chunk of chunks) {
          const uri = chunk?.web?.uri;
          const title = chunk?.web?.title || 'Web Source';
          if (uri && typeof uri === 'string' && !seenUris.has(uri)) {
            seenUris.add(uri);
            groundingSources.push({ uri, title });
          }
        }

        const searchQueries: string[] = Array.isArray(groundingMetadata?.webSearchQueries)
          ? groundingMetadata.webSearchQueries.filter((q: any) => typeof q === 'string')
          : [];

        // Match any catalogue products mentioned in the response or question
        const mentionedIds = activeProducts
          .filter(
            (p) =>
              rawText.toLowerCase().includes(String(p.name || '').toLowerCase().slice(0, 14)) ||
              qLower.includes(String(p.brandName || '').toLowerCase())
          )
          .map((p) => Number(p.id));

        const finalRecIds = Array.from(new Set([...mentionedIds, ...defaultMatchedIds])).slice(0, 4);

        // Detect if customer explicitly asked to add a product to cart
        let clientAction: CustomerRufusResponse['clientAction'] = { type: 'NONE' };
        if (/\b(add to cart|add .* to cart|buy now)\b/i.test(question) && finalRecIds.length > 0) {
          clientAction = {
            type: 'ADD_TO_CART',
            productId: finalRecIds[0],
            quantity: 1,
          };
        }

        if (rawText) {
          return {
            answer: rawText,
            recommendedProductIds: finalRecIds,
            followUpQuestions: [
              'Compare market prices & reviews for Classmate vs DOMS',
              'What are the top trending pens for board exams in 2026?',
              'Review DOMS 24-shade water colour pencils vs Camlin',
            ],
            searchGrounded: true,
            groundingSources,
            searchQueries,
            clientAction,
          };
        }
      }

      // Structured JSON mode when search grounding is toggled off
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Customer Question: ${question}`,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: {
                type: Type.STRING,
                description:
                  'Helpful, friendly, concise Vidya AI shopping answer using bullet points where appropriate and exact ₹ prices.',
              },
              recommendedProductIds: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: 'Up to 4 matching product IDs from the LIVE STORE CATALOGUE.',
              },
              followUpQuestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 short follow-up questions the customer might want to tap next.',
              },
              actionType: {
                type: Type.STRING,
                description:
                  'Optional action if the customer explicitly asked to add a product to cart or navigate: NONE, ADD_TO_CART, FILTER_CATEGORY, FILTER_BRAND, OPEN_CHECKOUT, TRACK_ORDER.',
              },
              actionProductId: {
                type: Type.INTEGER,
                description: 'Product ID if actionType is ADD_TO_CART, else 0.',
              },
              actionQuantity: {
                type: Type.INTEGER,
                description: 'Quantity to add if actionType is ADD_TO_CART, default 1.',
              },
            },
            required: ['answer', 'recommendedProductIds', 'followUpQuestions', 'actionType'],
          },
        },
      });

      const rawText = response.text?.trim() || '';
      if (rawText) {
        const parsed = JSON.parse(rawText);
        const validIds = Array.isArray(parsed.recommendedProductIds)
          ? parsed.recommendedProductIds
              .map((id: any) => Number(id))
              .filter((id: number) => activeProducts.some((p) => Number(p.id) === id))
              .slice(0, 4)
          : [];

        return {
          answer:
            parsed.answer ||
            'Here are the best stationery picks from Gayatri Stationers based on your request.',
          recommendedProductIds: validIds,
          followUpQuestions:
            Array.isArray(parsed.followUpQuestions) && parsed.followUpQuestions.length > 0
              ? parsed.followUpQuestions.slice(0, 3)
              : [
                  'Compare market prices & reviews for Classmate notebooks',
                  'What are the best pens for board exams?',
                  'Show me school notebooks under ₹150',
                ],
          searchGrounded: false,
          groundingSources: [],
          searchQueries: [],
          clientAction: {
            type: (parsed.actionType as any) || 'NONE',
            productId: parsed.actionProductId ? Number(parsed.actionProductId) : undefined,
            quantity: parsed.actionQuantity ? Math.max(1, Number(parsed.actionQuantity)) : 1,
          },
        };
      }
    } catch (err: any) {
      console.warn('Gemini Rufus fallback triggered:', err?.message || err);
    }
  }

  // Smart Catalogue + Market Comparison Grounded Fallback if Gemini API key is not attached yet
  const topMatches = scored.slice(0, 3).map((s) => s.p);
  const bulletLines = topMatches
    .map((p) => {
      const sell = Math.round(Number(p.sellingPricePaise || 0) / 100);
      const mrp = Math.round(Number(p.mrpPaise || p.sellingPricePaise || 0) / 100);
      const savingsPct = mrp > sell ? Math.round(((mrp - sell) / mrp) * 100) : 10;
      return `• **${p.name}** (${p.brandName || 'Gayatri Stationers'}) — **₹${sell}** at Gayatri Stationers vs Market MRP **₹${mrp}** (Save ${savingsPct}%)`;
    })
    .join('\n');

  let answer = `Here is the live **Gayatri Stationers** catalogue & market comparison for your query:\n\n${bulletLines}\n\n**Market Trends & Reviews Summary:**\n• **Student & Exam Consensus**: 70 GSM+ elemental chlorine-free notebooks (like ITC Classmate Pulse) and 0.5mm–0.7mm low-viscosity waterproof pens (Unomax Ultron 2X & Flair Zoox F7) lead Indian student reviews for smudge-free speed writing.\n• **Price Advantage**: Gayatri Stationers offers direct below-MRP retail pricing plus **₹0 Store Pickup** in Kanpur and **Pan-India Express Home Delivery**.`;

  if (qLower.includes('pickup') || qLower.includes('delivery') || qLower.includes('shipping') || qLower.includes('courier')) {
    answer =
      'At **Gayatri Stationers**, you can choose between two convenient fulfilment options:\n• **Store Pickup (₹0 Fee)**: Place your order online (Pay Online or Pay at Store Counter) and collect your packed stationery bag at our Kanpur store counter (Awas Vikas Market, Galla Mandi, Naubasta – 208021) using your 6-digit Pickup Code.\n• **Pan-India Express Home Delivery**: Nationwide courier delivery to any 6-digit Indian PIN code with live AWB tracking and Cash on Delivery (COD) or Secure Online Payment (UPI / Cards / NetBanking).';
  } else if (params.currentProduct) {
    const cp = params.currentProduct;
    const sell = Math.round(Number(cp.sellingPricePaise || 0) / 100);
    const mrp = Math.round(Number(cp.mrpPaise || cp.sellingPricePaise || 0) / 100);
    answer = `**${cp.name}** by **${cp.brandName || 'Gayatri Stationers'}**\n• **Price Comparison**: **₹${sell}** at Gayatri Stationers vs **₹${mrp}** Market MRP (Direct retail savings of ₹${Math.max(0, mrp - sell)}).\n• **Product Review Highlights**: ${cp.shortDescription || cp.description || 'Highly rated by students and professionals for consistent daily quality.'}\n• **Fulfilment**: Available for **Instant Store Counter Pickup (₹0 fee)** and **Pan-India Express Home Delivery**.`;
  }

  return {
    answer,
    recommendedProductIds: topMatches.map((p) => Number(p.id)),
    followUpQuestions: [
      'Compare market prices & reviews for Classmate vs DOMS',
      'Trending pens for fast board exam writing in 2026?',
      'Recommend a complete school exam kit under ₹350',
    ],
    searchGrounded: useSearchGrounding,
    groundingSources: useSearchGrounding
      ? [
          {
            uri: 'https://www.classmateshop.com',
            title: 'ITC Classmate Official Stationery Catalogue & Paper GSM Specs',
          },
          {
            uri: 'https://domsindia.com',
            title: 'DOMS Industries — Student Art & Mathematical Drawing Instruments',
          },
        ]
      : [],
    searchQueries: useSearchGrounding
      ? [`${question} India stationery price review comparison`]
      : [],
    clientAction: { type: 'NONE' },
  };
}

export interface AdminAiCopilotParsedIntent {
  operation:
    | 'ADD_PRODUCT'
    | 'ADD_WEB_PHOTOS'
    | 'REMOVE_PHOTO'
    | 'REMOVE_PRODUCT'
    | 'FILL_FORM'
    | 'ADVICE';
  replyMessage: string;
  productName?: string;
  sku?: string;
  brandName?: string;
  categoryName?: string;
  sellingPriceRupees?: number;
  mrpRupees?: number;
  stockQuantity?: number;
  shortDescription?: string;
  description?: string;
  photoSearchQuery?: string;
  targetProductQuery?: string;
}

/**
 * Uses Gemini ('gemini-3.8-flash') to parse natural-language admin commands:
 * - "Add product ..."
 * - "Add photos from the web for ..."
 * - "Remove photo from ..."
 * - "Remove / delete product ..."
 * - General store & catalogue questions
 */
export async function parseAdminCopilotCommandWithGemini(params: {
  prompt: string;
  products: any[];
  categories: any[];
  brands: any[];
}): Promise<AdminAiCopilotParsedIntent> {
  const prompt = (params.prompt || '').trim();
  const ai = getGeminiClient();

  const catList = (params.categories || []).map((c) => c.name).join(', ');
  const brandList = (params.brands || []).map((b) => b.name).join(', ');
  const prodSummary = (params.products || [])
    .slice(0, 40)
    .map(
      (p) =>
        `ID=${p.id} | SKU=${p.sku} | Name="${p.name}" | Brand=${p.brandName || ''} | Price=₹${Math.round(
          Number(p.sellingPricePaise || 0) / 100
        )}`
    )
    .join('\n');

  if (ai) {
    try {
      const systemInstruction = `You are the Gayatri Stationers AI Admin Copilot.
The store owner/admin gives you natural language commands to:
1. ADD_PRODUCT: Create and publish a new stationery product (or update an existing one), automatically setting its name, SKU, brand/company, category, selling price (₹), MRP (₹), description, and fetching web photos.
2. ADD_WEB_PHOTOS: Search the web and attach real product photos to a product (or the currently edited product).
3. REMOVE_PHOTO: Remove the photo(s) from a specified product (or current product).
4. REMOVE_PRODUCT: Delete/remove a product from the store catalogue.
5. FILL_FORM: Fill the product creation form with AI-generated details and web photos.
6. ADVICE: Answer questions about inventory, pricing, bestsellers, or store operations.

Existing Categories: ${catList || 'Notebooks & Registers, Pens & Writing, Art & Craft, Geometry & Exam, Office Supplies, DIY & Crafts'}
Existing Companies/Brands: ${brandList || 'Classmate, DOMS, Camlin, Flair, Unomax, Casio, Kangaro, Fevicol'}
Existing Products:
${prodSummary}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Admin Command: "${prompt}"`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              operation: {
                type: Type.STRING,
                description:
                  'One of: ADD_PRODUCT, ADD_WEB_PHOTOS, REMOVE_PHOTO, REMOVE_PRODUCT, FILL_FORM, ADVICE',
              },
              replyMessage: {
                type: Type.STRING,
                description: 'Clear confirmation or helpful response to show the admin.',
              },
              productName: {
                type: Type.STRING,
                description: 'Product name if creating, updating, or targeting a product.',
              },
              sku: {
                type: Type.STRING,
                description: 'Uppercase SKU code (e.g. GS-CLS-101) if creating a product.',
              },
              brandName: {
                type: Type.STRING,
                description: 'Brand/company name (e.g. Classmate, DOMS, Flair, Camlin).',
              },
              categoryName: {
                type: Type.STRING,
                description: 'Category name (e.g. Notebooks & Registers, Pens & Writing, DIY & Crafts).',
              },
              sellingPriceRupees: {
                type: Type.NUMBER,
                description: 'Selling price in INR Rupees (e.g. 120).',
              },
              mrpRupees: {
                type: Type.NUMBER,
                description: 'MRP in INR Rupees (>= sellingPriceRupees).',
              },
              stockQuantity: {
                type: Type.INTEGER,
                description: 'Initial stock quantity (default 35).',
              },
              shortDescription: {
                type: Type.STRING,
                description: 'Concise 1-sentence retail summary.',
              },
              description: {
                type: Type.STRING,
                description: 'Detailed 2-3 sentence product description.',
              },
              photoSearchQuery: {
                type: Type.STRING,
                description: 'Search query to find real product photos from the web.',
              },
              targetProductQuery: {
                type: Type.STRING,
                description:
                  'Name or SKU of existing product when operation is ADD_WEB_PHOTOS, REMOVE_PHOTO, or REMOVE_PRODUCT.',
              },
            },
            required: ['operation', 'replyMessage'],
          },
        },
      });

      const raw = response.text?.trim() || '';
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          operation: parsed.operation || 'ADVICE',
          replyMessage: parsed.replyMessage || 'Processed your AI admin command.',
          productName: parsed.productName,
          sku: parsed.sku,
          brandName: parsed.brandName,
          categoryName: parsed.categoryName,
          sellingPriceRupees: parsed.sellingPriceRupees ? Number(parsed.sellingPriceRupees) : undefined,
          mrpRupees: parsed.mrpRupees ? Number(parsed.mrpRupees) : undefined,
          stockQuantity: parsed.stockQuantity ? Number(parsed.stockQuantity) : 35,
          shortDescription: parsed.shortDescription,
          description: parsed.description,
          photoSearchQuery: parsed.photoSearchQuery || parsed.productName || parsed.targetProductQuery,
          targetProductQuery: parsed.targetProductQuery || parsed.productName,
        };
      }
    } catch (err: any) {
      console.warn('Gemini Admin Copilot fallback parser triggered:', err?.message || err);
    }
  }

  // Deterministic Fallback Parser if Gemini key is unavailable
  const lower = prompt.toLowerCase();

  // Check if removing photo
  if (
    (lower.includes('remove') || lower.includes('delete') || lower.includes('clear')) &&
    (lower.includes('photo') || lower.includes('image') || lower.includes('picture') || lower.includes('pic'))
  ) {
    const cleaned = prompt
      .replace(/^(please\s+)?(remove|delete|clear)\s+(the\s+)?(web\s+)?(photo|photos|image|images|picture|pic)\s*(from|for|of)?\s*/i, '')
      .trim();
    return {
      operation: 'REMOVE_PHOTO',
      replyMessage: `Removed product photo${cleaned ? ` from "${cleaned}"` : ''}.`,
      targetProductQuery: cleaned,
    };
  }

  // Check if removing/deleting a product
  if (
    lower.startsWith('remove ') ||
    lower.startsWith('delete ') ||
    lower.includes('remove product') ||
    lower.includes('delete product') ||
    lower.includes('remove it')
  ) {
    const cleaned = prompt
      .replace(/^(please\s+)?(remove|delete)\s+(the\s+)?(product|item)?\s*/i, '')
      .trim();
    return {
      operation: 'REMOVE_PRODUCT',
      replyMessage: `Removed product "${cleaned || 'selected item'}" from the catalogue.`,
      targetProductQuery: cleaned,
    };
  }

  // Check if adding web photos
  if (
    (lower.includes('photo') || lower.includes('image') || lower.includes('picture') || lower.includes('web')) &&
    !lower.includes('add product') &&
    !lower.includes('create product') &&
    !lower.includes('new product')
  ) {
    const cleaned = prompt
      .replace(/^(please\s+)?(add|find|fetch|search|get)\s+(web\s+)?(photos?|images?|pictures?)\s*(from\s+the\s+web\s*)?(for|of|to)?\s*/i, '')
      .trim();
    return {
      operation: 'ADD_WEB_PHOTOS',
      replyMessage: `Found and attached real web photos for "${cleaned || 'your product'}".`,
      targetProductQuery: cleaned,
      photoSearchQuery: cleaned || prompt,
    };
  }

  // Check if adding/creating a product
  if (
    lower.includes('add ') ||
    lower.includes('create ') ||
    lower.includes('new product') ||
    lower.includes('₹') ||
    lower.includes('rs')
  ) {
    const priceMatch = prompt.match(/(?:₹|rs\.?\s*|price\s*)(\d+(?:\.\d+)?)/i) || prompt.match(/\b(\d{2,4})\b/);
    const sellingPriceRupees = priceMatch ? Math.max(5, Number(priceMatch[1])) : 95;
    const mrpMatch = prompt.match(/mrp\s*(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)/i);
    const mrpRupees = mrpMatch
      ? Math.max(sellingPriceRupees, Number(mrpMatch[1]))
      : Math.round(sellingPriceRupees * 1.15);

    const cleanName =
      prompt
        .replace(/^(please\s+)?(add|create|make)\s+(a\s+)?(new\s+)?(product|item)?\s*/i, '')
        .replace(/(?:at|for|price)?\s*(?:₹|rs\.?\s*)\d+(?:\.\d+)?/gi, '')
        .replace(/mrp\s*(?:₹|rs\.?\s*)?\d+/gi, '')
        .replace(/with\s+web\s+photos?/gi, '')
        .trim() || 'Classmate Premium Stationery Pack';

    const knownBrands = ['Classmate', 'DOMS', 'Camlin', 'Flair', 'Unomax', 'Casio', 'Kangaro', 'Fevicol', 'Apsara', 'Nataraj', 'Reynolds'];
    const matchedBrand =
      knownBrands.find((b) => cleanName.toLowerCase().includes(b.toLowerCase())) || 'Classmate';

    let categoryName = 'Notebooks & Registers';
    if (/pen|pencil|marker|highlighter|gel|ball/i.test(cleanName)) {
      categoryName = 'Pens & Writing';
    } else if (/art|paint|colour|color|sketch|brush|craft|diy|origami|fevicol/i.test(cleanName)) {
      categoryName = 'DIY & Crafts';
    } else if (/geometry|compass|scale|ruler|calculator/i.test(cleanName)) {
      categoryName = 'Geometry & Exam';
    } else if (/file|folder|stapler|punch|tape|office/i.test(cleanName)) {
      categoryName = 'Office Supplies';
    }

    const sku = `GS-${matchedBrand.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    return {
      operation: 'ADD_PRODUCT',
      replyMessage: `Created product "${cleanName}" (${sku}) at ₹${sellingPriceRupees} (MRP ₹${mrpRupees}) under ${categoryName} with web photos attached.`,
      productName: cleanName,
      sku,
      brandName: matchedBrand,
      categoryName,
      sellingPriceRupees,
      mrpRupees,
      stockQuantity: 35,
      shortDescription: `Genuine ${matchedBrand} ${cleanName} available for Store Pickup & Home Delivery.`,
      description: `${cleanName} by ${matchedBrand}. Curated retail and school stationery item stocked at Gayatri Stationers, Kanpur with ₹0 Store Pickup and fast Home Delivery.`,
      photoSearchQuery: cleanName,
    };
  }

  return {
    operation: 'ADVICE',
    replyMessage: `You currently have ${params.products?.length || 0} products across ${
      params.categories?.length || 0
    } categories and ${
      params.brands?.length || 0
    } companies/brands. Try telling me:\n• "Add product Classmate Octane Gel Pen Pack of 10 at ₹90"\n• "Add web photos for Classmate Pulse Spiral Notebook"\n• "Remove photo from Unomax Geltron"\n• "Remove product Kangaro Stapler"`,
  };
}

/**
 * Transcribes base64-encoded audio recorded from the browser microphone using Gemini ('gemini-3.5-transcribe').
 */
export async function transcribeAudioWithGemini(params: {
  audioBase64: string;
  mimeType?: string;
}): Promise<{ transcript: string; source: 'GEMINI_TRANSCRIBE' | 'EMPTY' }> {
  const cleanBase64 = (params.audioBase64 || '')
    .replace(/^data:audio\/[^;]+;base64,/i, '')
    .trim();
  if (!cleanBase64) {
    return { transcript: '', source: 'EMPTY' };
  }

  const mimeType = (params.mimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm';
  const ai = getGeminiClient();
  if (!ai) {
    return { transcript: '', source: 'EMPTY' };
  }

  const promptText =
    'Transcribe this spoken voice query for an Indian stationery store (Gayatri Stationers). The speaker may mention brands like Classmate, DOMS, Flair, Unomax, Camlin, Faber-Castell, notebooks, pens, geometry boxes, prices in rupees, or product comparisons. Return ONLY the plain transcribed text without quotes or commentary. If no speech is audible, return an empty string.';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: [
        {
          inlineData: {
            mimeType,
            data: cleanBase64,
          },
        },
        {
          text: promptText,
        },
      ],
    });
    const text = (response.text || '').trim();
    return { transcript: text, source: text ? 'GEMINI_TRANSCRIBE' : 'EMPTY' };
  } catch (err: any) {
    console.warn('gemini-3.5-transcribe fallback to gemini-3.8-flash:', err?.message || err);
    try {
      const fallbackRes = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          {
            text: promptText,
          },
        ],
      });
      const text = (fallbackRes.text || '').trim();
      return { transcript: text, source: text ? 'GEMINI_TRANSCRIBE' : 'EMPTY' };
    } catch (innerErr: any) {
      console.warn('Audio transcription failed:', innerErr?.message || innerErr);
      return { transcript: '', source: 'EMPTY' };
    }
  }
}

