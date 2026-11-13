import {
  CustomerRFMTD,
  PersonaType,
  CleanedTransaction,
} from './types';
import { productType, type ProductType } from './productType';

/** Why a product was suggested; the message writer may only claim what the reason supports. */
export type SuggestionKind = 'bought together' | 'same kind' | 'best seller' | 'something new';

export interface ProductCatalogItem {
  sku: string;
  name: string;
  category: string;
  price: number;
  description?: string;
  complementaryCategories: string[];
  /** Share of the shop's buyers who bought it, relative to the best seller (shop catalogs only). */
  popularity?: number;
}

export interface ProductRecommendation {
  productName: string;
  sku: string;
  category: string;
  originalPrice: number;
  discountedPrice: number;
  discountPct: number;
  discountCode: string;
  affinityScorePct: number; // 0 to 100
  recommendationReason: string;
  bundleSavings: number;
  pitchSnippetEn: string;
  pitchSnippetBn: string;
  /** Shop-data suggestions only: why it was chosen, and the customer's product it comes from. */
  suggestionKind?: SuggestionKind;
  basisProduct?: string;
}

export interface CustomerRecommendationProfile {
  customerKey: string;
  customerName: string;
  phone?: string;
  persona: PersonaType;
  topHistoricalCategory: string;
  totalPastSpend: number;
  pastItemCount: number;
  pastPurchasedItems: string[];
  primaryRecommendation: ProductRecommendation;
  alternativeRecommendations: ProductRecommendation[];
  crossSellUrgency: 'High' | 'Medium' | 'VIP Standard';
}

/**
 * Standardized catalog of bestselling products covering Bangladeshi boutique & universal retail
 */
export const BANGLADESHI_CATALOG: ProductCatalogItem[] = [
  {
    sku: 'JAM-DHK-01',
    name: 'Handloom Dhakai Jamdani Saree (Royal Navy)',
    category: "Women's Ethnic",
    price: 6500,
    complementaryCategories: ['Accessories', 'Home & Living'],
  },
  {
    sku: 'TAN-COT-03',
    name: 'Tangail Taant Cotton Saree (Pastel Mint)',
    category: "Women's Ethnic",
    price: 2800,
    complementaryCategories: ['Accessories', 'Gourmet & Pantry'],
  },
  {
    sku: 'PAN-SLK-08',
    name: 'Executive Silk Festive Panjabi (Royal Blue)',
    category: "Men's Ethnic",
    price: 3800,
    complementaryCategories: ["Men's Accessories", 'Leather Goods', 'Accessories'],
  },
  {
    sku: 'PAN-COT-12',
    name: 'Hand-Embroidered Cotton Panjabi (Charcoal)',
    category: "Men's Ethnic",
    price: 2450,
    complementaryCategories: ["Men's Accessories", 'Leather Goods'],
  },
  {
    sku: 'DUP-RJH-05',
    name: 'Silk Katan Dupatta & Jamdani Clutch Set',
    category: 'Accessories',
    price: 1850,
    complementaryCategories: ["Women's Ethnic", 'Home & Living'],
  },
  {
    sku: 'LTH-WLT-04',
    name: 'Top-Grain Full Cowhide Bifold Wallet',
    category: 'Leather Goods',
    price: 1650,
    complementaryCategories: ["Men's Ethnic", "Men's Accessories"],
  },
  {
    sku: 'NKH-QNT-02',
    name: 'Handcrafted Nakshi Kantha Quilt (Queen Size)',
    category: 'Home & Living',
    price: 4500,
    complementaryCategories: ['Gourmet & Pantry', "Women's Ethnic"],
  },
  {
    sku: 'TER-CUP-06',
    name: 'Handmade Terracotta Tea Cup & Saucer Set (6 Pcs)',
    category: 'Home & Living',
    price: 950,
    complementaryCategories: ['Gourmet & Pantry', 'Home & Living'],
  },
  {
    sku: 'HNY-SND-500',
    name: 'Sundarban Raw Wild Forest Honey (500g Jar)',
    category: 'Gourmet & Pantry',
    price: 780,
    complementaryCategories: ['Gourmet & Pantry', 'Home & Living'],
  },
  {
    sku: 'OIL-MST-1000',
    name: 'Cold-Pressed Ghani Mustard Oil (1 Litre)',
    category: 'Gourmet & Pantry',
    price: 420,
    complementaryCategories: ['Gourmet & Pantry', 'Home & Living'],
  },
  {
    sku: 'RCE-KAL-5KG',
    name: 'Traditional Dinajpur Kalojeera Polao Rice (5kg)',
    category: 'Gourmet & Pantry',
    price: 890,
    complementaryCategories: ['Gourmet & Pantry'],
  },
];

export const UNIVERSAL_CATALOG: ProductCatalogItem[] = [
  {
    sku: '85123A',
    name: 'WHITE HANGING HEART T-LIGHT HOLDER',
    category: 'Home Accents',
    price: 2.55,
    complementaryCategories: ['Lighting', 'Giftware'],
  },
  {
    sku: '71053',
    name: 'WHITE METAL LANTERN',
    category: 'Lighting',
    price: 3.39,
    complementaryCategories: ['Home Accents', 'Outdoor'],
  },
  {
    sku: '22423',
    name: 'REGENCY CAKESTAND 3 TIER',
    category: 'Kitchen & Dining',
    price: 12.75,
    complementaryCategories: ['Party', 'Giftware'],
  },
  {
    sku: '47566',
    name: 'PARTY BUNTING',
    category: 'Party',
    price: 4.95,
    complementaryCategories: ['Kitchen & Dining', 'Home Accents'],
  },
  {
    sku: '85099B',
    name: 'JUMBO BAG RED RETROSPOT',
    category: 'Storage & Travel',
    price: 1.95,
    complementaryCategories: ['Storage & Travel', 'Accessories'],
  },
  {
    sku: '20725',
    name: 'LUNCH BAG RED RETROSPOT',
    category: 'Storage & Travel',
    price: 1.65,
    complementaryCategories: ['Storage & Travel', 'Kitchen & Dining'],
  },
  {
    sku: '84029G',
    name: 'KNITTED UNION FLAG HOT WATER BOTTLE',
    category: 'Winter Warmers',
    price: 3.39,
    complementaryCategories: ['Winter Warmers', 'Giftware'],
  },
  {
    sku: '22632',
    name: 'HAND WARMER RED RETROSPOT',
    category: 'Winter Warmers',
    price: 1.85,
    complementaryCategories: ['Winter Warmers', 'Giftware'],
  },
];

/**
 * Returns persona-specific discount policy
 */
export function getPersonaDiscountConfig(persona: PersonaType): {
  discountPct: number;
  discountCode: string;
  urgency: 'High' | 'Medium' | 'VIP Standard';
  headline: string;
} {
  switch (persona) {
    case 'Champions (VIP Loyalists)':
      return {
        discountPct: 20,
        discountCode: 'VIP-CURATED20',
        urgency: 'VIP Standard',
        headline: 'Exclusive 20% VIP Early-Access',
      };
    case 'Loyal & Promising Regulars':
      return {
        discountPct: 15,
        discountCode: 'PAIR-IT15',
        urgency: 'Medium',
        headline: 'Complete Your Set - 15% Off',
      };
    case 'High-Potential / At-Risk Guests':
      return {
        discountPct: 15,
        discountCode: 'REVIVE-GIFT15',
        urgency: 'High',
        headline: 'Special 15% Comeback Treat',
      };
    case 'Hibernating / Lost Guests':
    default:
      return {
        discountPct: 25,
        discountCode: 'WINBACK25',
        urgency: 'High',
        headline: 'Exclusive 25% Win-Back Flash',
      };
  }
}

/**
 * Formats tailored pitch scripts in English and Bangla
 */
export function buildPersonalizedPitchScripts(
  customerName: string,
  product: ProductCatalogItem,
  discountedPrice: number,
  discountPct: number,
  discountCode: string,
  reason: string,
  currencySymbol: string
): { pitchEn: string; pitchBn: string } {
  const safeName = customerName || 'Valued Friend';
  const priceFormatted = `${currencySymbol}${discountedPrice.toLocaleString()}`;
  const originalFormatted = `${currencySymbol}${product.price.toLocaleString()}`;

  const pitchEn = `Assalamu Alaikum ${safeName}! Based on your recent choice, our stylists recommended the "${product.name}". Because it pairs perfectly with your collection (${reason}), we have reserved an exclusive ${discountPct}% privilege for you at only ${priceFormatted} (regular ${originalFormatted}) with code *${discountCode}*. Would you like us to bundle this in your parcel?`;

  const pitchBn = `আসসালামু আলাইকুম ${safeName}! আপনার পূর্বের পছন্দের সাথে মানানসই সেরা আইটেম হিসেবে আমাদের ডিজাইনাররা "${product.name}" নির্বাচন করেছেন (${reason})। আপনার জন্য বিশেষ ${discountPct}% ছাড়ে এটি মাত্র ${priceFormatted}-এ (মূল দাম ${originalFormatted}) কোড *${discountCode}* দিয়ে আজই বুক করতে পারেন।`;

  return { pitchEn, pitchBn };
}

/** Whole units for normal prices; cents for small ones, so a 2.95 item never costs 3 "after the discount". */
const roundPrice = (x: number) => (x >= 100 ? Math.round(x) : Math.round(x * 100) / 100);

/**
 * Derives a recommended product for a customer given their purchase history and persona
 */
export function generateCustomerRecommendation(
  customer: CustomerRFMTD,
  pastPurchasedItems: string[] = [],
  catalog: ProductCatalogItem[] = BANGLADESHI_CATALOG,
  currencySymbol = '৳',
  related: RelatedPick | null = null
): CustomerRecommendationProfile {
  const persona = customer.persona || 'Loyal & Promising Regulars';
  const discountConfig = getPersonaDiscountConfig(persona);

  // Identify past categories & normalized item names
  const normalizedPast = pastPurchasedItems.map((item) => item.toLowerCase());
  const pastCategoriesCount: Record<string, number> = {};

  pastPurchasedItems.forEach((itemName) => {
    const matched = catalog.find(
      (c) =>
        c.name.toLowerCase().includes(itemName.toLowerCase()) ||
        itemName.toLowerCase().includes(c.name.toLowerCase()) ||
        itemName.toLowerCase().includes(c.sku.toLowerCase())
    );
    if (matched) {
      pastCategoriesCount[matched.category] =
        (pastCategoriesCount[matched.category] || 0) + 1;
    }
  });

  // Top past category
  const sortedCategories = Object.entries(pastCategoriesCount).sort(
    (a, b) => b[1] - a[1]
  );
  const topHistoricalCategory =
    sortedCategories.length > 0 ? sortedCategories[0][0] : "Women's Ethnic";

  // Determine complementary target categories
  const targetCategories = new Set<string>();
  catalog.forEach((item) => {
    if (item.category === topHistoricalCategory) {
      item.complementaryCategories.forEach((cat) => targetCategories.add(cat));
    }
  });

  // Fallback if target categories empty
  if (targetCategories.size === 0) {
    targetCategories.add('Accessories');
    targetCategories.add('Home & Living');
  }

  // Score candidate items in catalog:
  // - Candidates customer has NOT bought yet
  // - Bonus if candidate belongs to a complementary category
  // - Bonus if candidate price is proportional to customer's AOV (0.3x - 1.2x)
  const candidateScores: {
    item: ProductCatalogItem;
    score: number;
    reason: string;
  }[] = [];

  const aov = customer.avgOrderValue || customer.monetary / Math.max(1, customer.frequency);

  catalog.forEach((item) => {
    const alreadyBought = normalizedPast.some(
      (past) =>
        past.includes(item.name.toLowerCase()) ||
        item.name.toLowerCase().includes(past) ||
        past.includes(item.sku.toLowerCase())
    );

    let score = 50; // base score
    let reason = 'Trending customer favorite';
    if (item.popularity !== undefined) {
      score += Math.round(20 * item.popularity);
      reason = 'Popular with your other customers';
    }

    if (targetCategories.has(item.category)) {
      score += 30;
      reason = `Frequent companion with ${topHistoricalCategory}`;
    }

    if (alreadyBought) {
      // If consumable (Gourmet, Tea, Pantry), repeat purchase is acceptable, else penalize
      if (item.category === 'Gourmet & Pantry' || item.category === 'Consumable') {
        score += 10;
        reason = `Popular seasonal restock for ${item.name}`;
      } else {
        score -= 40; // Avoid duplicate durable goods
      }
    }

    // Price affinity: does it fit well as a cross-sell?
    if (item.price <= aov * 1.3 && item.price >= aov * 0.2) {
      score += 15;
    }

    // Persona preference tuning
    if (persona === 'Champions (VIP Loyalists)' && item.price > 2500) {
      score += 10;
    }
    if (persona === 'Hibernating / Lost Guests' && item.price < 2000) {
      score += 10; // lower barrier to re-activate
    }

    candidateScores.push({ item, score, reason });
  });

  // Sort candidates by score descending
  candidateScores.sort((a, b) => b.score - a.score);

  // Top recommendation: from the shop's own baskets when there are any (pickRelated), else the catalog score
  const relatedCandidate = related && candidateScores.find((c) => c.item.sku === related.sku);
  const topCandidate = relatedCandidate
    ? { ...relatedCandidate, reason: relatedReason(related!) }
    : candidateScores[0] || {
        item: catalog[0],
        score: 85,
        reason: 'Storewide bestseller pairing',
      };

  const discountedPrice = roundPrice(topCandidate.item.price * (1 - discountConfig.discountPct / 100));
  const bundleSavings = roundPrice(topCandidate.item.price - discountedPrice);

  const rawKey = customer.customerKey.startsWith('cust_')
    ? customer.customerKey.slice(5)
    : customer.customerKey;

  const displayName = rawKey.startsWith('m.me/')
    ? `@${rawKey.replace('m.me/', '')}`
    : /^[A-Za-z\s.'-]+$/.test(rawKey) && !/^\d+$/.test(rawKey)
    ? rawKey
    : customer.phone || 'Valued Shopper';

  const { pitchEn, pitchBn } = buildPersonalizedPitchScripts(
    displayName,
    topCandidate.item,
    discountedPrice,
    discountConfig.discountPct,
    discountConfig.discountCode,
    topCandidate.reason,
    currencySymbol
  );

  const primaryRecommendation: ProductRecommendation = {
    productName: topCandidate.item.name,
    sku: topCandidate.item.sku,
    category: topCandidate.item.category,
    originalPrice: topCandidate.item.price,
    discountedPrice,
    discountPct: discountConfig.discountPct,
    discountCode: discountConfig.discountCode,
    affinityScorePct: Math.min(99, Math.max(70, Math.round(topCandidate.score))),
    recommendationReason: topCandidate.reason,
    bundleSavings,
    pitchSnippetEn: pitchEn,
    pitchSnippetBn: pitchBn,
    ...(relatedCandidate ? { suggestionKind: related!.kind, basisProduct: related!.basis } : {}),
  };

  // Alternative recommendations (ranks 2 & 3)
  const alternativeRecommendations: ProductRecommendation[] = candidateScores
    .filter((cand) => cand.item.sku !== topCandidate.item.sku)
    .slice(0, 2)
    .map((cand) => {
      const altDiscounted = roundPrice(cand.item.price * (1 - discountConfig.discountPct / 100));
      const scripts = buildPersonalizedPitchScripts(
        customer.phone || 'Friend',
        cand.item,
        altDiscounted,
        discountConfig.discountPct,
        discountConfig.discountCode,
        cand.reason,
        currencySymbol
      );
      return {
        productName: cand.item.name,
        sku: cand.item.sku,
        category: cand.item.category,
        originalPrice: cand.item.price,
        discountedPrice: altDiscounted,
        discountPct: discountConfig.discountPct,
        discountCode: discountConfig.discountCode,
        affinityScorePct: Math.min(95, Math.max(65, Math.round(cand.score))),
        recommendationReason: cand.reason,
        bundleSavings: roundPrice(cand.item.price - altDiscounted),
        pitchSnippetEn: scripts.pitchEn,
        pitchSnippetBn: scripts.pitchBn,
      };
    });

  const customerName = customer.customerKey.startsWith('cust_')
    ? `Customer #${customer.customerKey.replace('cust_', '')}`
    : customer.phone || 'Customer';

  return {
    customerKey: customer.customerKey,
    customerName,
    phone: customer.phone,
    persona,
    topHistoricalCategory,
    totalPastSpend: customer.monetary,
    pastItemCount: pastPurchasedItems.length,
    pastPurchasedItems,
    primaryRecommendation,
    alternativeRecommendations,
    crossSellUrgency: discountConfig.urgency,
  };
}

/**
 * The shop's own best sellers (most distinct buyers) as a catalog, so suggestions name products the shop sells.
 * shortcut: a file without a product column falls back to the built-in demo catalog; show no suggestion instead if such files become common.
 */
export function buildShopCatalog(rows: CleanedTransaction[], limit = 40): ProductCatalogItem[] {
  const bySku = new Map<string, { buyers: Set<string>; prices: number[]; names: Map<string, number> }>();
  for (const r of rows) {
    if (!r.sku || /^(order|sku)_/.test(r.sku)) continue; // placeholders the stitcher uses when there is no product column
    const e = bySku.get(r.sku) ?? { buyers: new Set<string>(), prices: [], names: new Map<string, number>() };
    e.buyers.add(r.unifiedKey);
    e.prices.push(r.unitPrice);
    if (r.productName) e.names.set(r.productName, (e.names.get(r.productName) ?? 0) + 1);
    bySku.set(r.sku, e);
  }
  const top = [...bySku].sort((a, b) => b[1].buyers.size - a[1].buyers.size).slice(0, limit);
  if (top.length === 0) return BANGLADESHI_CATALOG;
  const most = top[0][1].buyers.size;
  return top.map(([sku, e]) => {
    const prices = [...e.prices].sort((a, b) => a - b);
    return {
      sku,
      name: [...e.names].sort((a, b) => b[1] - a[1])[0]?.[0] ?? sku,
      category: 'Best sellers',
      price: Math.round(prices[Math.floor(prices.length / 2)] * 100) / 100,
      complementaryCategories: [],
      popularity: e.buyers.size / most,
    };
  });
}

/** Who bought what in the shop's own data, for pickRelated. */
export interface ShopBaskets {
  bought: Map<string, Map<string, number>>; // customer -> sku -> time of their last purchase of it
  buyers: Map<string, number>; // sku -> customers who bought it
  co: Map<string, Map<string, number>>; // sku -> catalog sku -> customers who bought both
  names: Map<string, string>;
  types: Map<string, ProductType>;
  end: number; // time of the shop's last order
}

export interface RelatedPick {
  sku: string;
  kind: SuggestionKind;
  basis?: string; // the customer's product the suggestion comes from
}

const DAY_MS = 86_400_000;
/** Every fourth customer is offered a best seller of another product type, so offers do not stay in one lane. */
export const EXPLORE_EVERY = 4;

/** True for the customers (about one in four, fixed per customer) who are offered another type of product. */
export function exploresOtherTypes(customerKey: string): boolean {
  let h = 0x811c9dc5; // FNV-1a: the same customer always gets the same answer
  for (let i = 0; i < customerKey.length; i++) h = Math.imul(h ^ customerKey.charCodeAt(i), 0x01000193);
  return (h >>> 0) % EXPLORE_EVERY === 0;
}

/** Null for the built-in demo catalog: only a catalog made from the shop's own file (buildShopCatalog) has baskets. */
export function buildBaskets(rows: CleanedTransaction[], catalog: ProductCatalogItem[]): ShopBaskets | null {
  if (!catalog.some((c) => c.popularity !== undefined)) return null;
  const bought = new Map<string, Map<string, number>>();
  const names = new Map<string, string>(catalog.map((c) => [c.sku, c.name]));
  let end = 0;
  for (const r of rows) {
    if (!r.sku || /^(order|sku)_/.test(r.sku)) continue; // placeholders when the file has no product column
    const t = r.timestamp.getTime();
    const mine = bought.get(r.unifiedKey) ?? new Map<string, number>();
    mine.set(r.sku, Math.max(mine.get(r.sku) ?? 0, t));
    bought.set(r.unifiedKey, mine);
    if (r.productName && !names.has(r.sku)) names.set(r.sku, r.productName);
    end = Math.max(end, t);
  }
  const inCatalog = new Set(catalog.map((c) => c.sku));
  const buyers = new Map<string, number>();
  const co = new Map<string, Map<string, number>>();
  for (const items of bought.values()) {
    const mineInCatalog = [...items.keys()].filter((s) => inCatalog.has(s));
    for (const a of items.keys()) {
      buyers.set(a, (buyers.get(a) ?? 0) + 1);
      const row = co.get(a) ?? new Map<string, number>();
      for (const b of mineInCatalog) if (b !== a) row.set(b, (row.get(b) ?? 0) + 1);
      co.set(a, row);
    }
  }
  const types = new Map<string, ProductType>([...names].map(([sku, n]) => [sku, productType(n)]));
  return { bought, buyers, co, names, types, end };
}

/**
 * The next product for one customer, from the shop's own data (item-based co-purchase):
 * 1. every fourth customer: the catalog product of another type that customers like them bought most;
 * 2. otherwise the product most bought by customers who bought the same products (at least two of them),
 *    with the customer's recent purchases counting most (weight halves every 90 days) and their usual type preferred;
 * 3. else a best seller of their usual type; 4. else the best seller they lack.
 * The catalog must list best sellers first (buildShopCatalog does).
 */
export function pickRelated(customerKey: string, catalog: ProductCatalogItem[], b: ShopBaskets): RelatedPick | null {
  const mine = b.bought.get(customerKey);
  if (!mine?.size) return null;
  const open = catalog.filter((c) => !mine.has(c.sku));
  if (!open.length) return null;
  const typeOf = (sku: string) => b.types.get(sku) ?? 'other';
  const weight = new Map([...mine].map(([sku, t]) => [sku, 0.5 ** ((b.end - t) / (90 * DAY_MS))]));
  const typeWeight = new Map<ProductType, number>();
  for (const [sku, w] of weight) typeWeight.set(typeOf(sku), (typeWeight.get(typeOf(sku)) ?? 0) + w);
  const usual = [...typeWeight].sort((x, y) => y[1] - x[1] || y[0].localeCompare(x[0]))[0][0];

  const score = new Map<string, number>();
  const anchor = new Map<string, [number, string]>();
  for (const [a, w] of weight) {
    const na = b.buyers.get(a) ?? 1;
    for (const [s, n] of b.co.get(a) ?? []) {
      if (mine.has(s)) continue;
      const v = (w * n) / Math.sqrt(na * (b.buyers.get(s) ?? 1)); // cosine similarity of the two products' buyers
      score.set(s, (score.get(s) ?? 0) + v);
      if (n >= 2 && v > (anchor.get(s)?.[0] ?? 0)) anchor.set(s, [v, a]);
    }
  }
  const best = (list: ProductCatalogItem[], value: (c: ProductCatalogItem) => number) =>
    list.reduce((x, y) => (value(y) > value(x) ? y : x)); // ties keep the better seller
  const name = (sku: string) => b.names.get(sku) ?? sku;

  if (exploresOtherTypes(customerKey) && usual !== 'other') {
    const others = open.filter((c) => typeOf(c.sku) !== usual);
    if (others.length) return { sku: best(others, (c) => score.get(c.sku) ?? 0).sku, kind: 'something new' };
  }
  const together = open.filter((c) => anchor.has(c.sku));
  if (together.length) {
    const pick = best(together, (c) => (score.get(c.sku) ?? 0) * (typeOf(c.sku) === usual ? 1.5 : 1));
    return { sku: pick.sku, kind: 'bought together', basis: name(anchor.get(pick.sku)![1]) };
  }
  const same = usual === 'other' ? undefined : open.find((c) => typeOf(c.sku) === usual);
  if (same) {
    const recent = [...mine].filter(([s]) => typeOf(s) === usual).sort((x, y) => y[1] - x[1])[0][0];
    return { sku: same.sku, kind: 'same kind', basis: name(recent) };
  }
  return { sku: open[0].sku, kind: 'best seller' };
}

function relatedReason(p: RelatedPick): string {
  switch (p.kind) {
    case 'bought together': return `Customers who bought ${p.basis} also bought it`;
    case 'same kind': return `Same type as ${p.basis}, which they bought recently`;
    case 'something new': return 'A best seller of another type, to widen their basket';
    default: return 'One of your best sellers they have not bought yet';
  }
}

/**
 * Generates recommendation profiles for all customers in RFM list
 */
export function generateBulkRecommendations(
  customers: CustomerRFMTD[],
  cleanedTransactions: CleanedTransaction[] = [],
  catalog: ProductCatalogItem[] = BANGLADESHI_CATALOG,
  currencySymbol = '৳'
): Map<string, CustomerRecommendationProfile> {
  const baskets = buildBaskets(cleanedTransactions, catalog);
  // Map customerKey to their past purchased items
  const itemsByCustomer = new Map<string, string[]>();
  cleanedTransactions.forEach((tx) => {
    if (!tx.sku) return;
    const list = itemsByCustomer.get(tx.unifiedKey) || [];
    list.push(tx.sku);
    itemsByCustomer.set(tx.unifiedKey, list);
  });

  const profileMap = new Map<string, CustomerRecommendationProfile>();
  customers.forEach((c) => {
    const pastItems = [...new Set(itemsByCustomer.get(c.customerKey) || [])];
    const profile = generateCustomerRecommendation(
      c,
      pastItems,
      catalog,
      currencySymbol,
      baskets && pickRelated(c.customerKey, catalog, baskets)
    );
    profileMap.set(c.customerKey, profile);
  });

  return profileMap;
}
