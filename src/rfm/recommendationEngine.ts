import {
  CustomerRFMTD,
  PersonaType,
  CleanedTransaction,
} from './types';

export interface ProductCatalogItem {
  sku: string;
  name: string;
  category: string;
  price: number;
  description?: string;
  complementaryCategories: string[];
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

/**
 * Derives a recommended product for a customer given their purchase history and persona
 */
export function generateCustomerRecommendation(
  customer: CustomerRFMTD,
  pastPurchasedItems: string[] = [],
  catalog: ProductCatalogItem[] = BANGLADESHI_CATALOG,
  currencySymbol = '৳'
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

  // Top recommendation
  const topCandidate = candidateScores[0] || {
    item: catalog[0],
    score: 85,
    reason: 'Storewide bestseller pairing',
  };

  const discountedPrice = Math.round(
    topCandidate.item.price * (1 - discountConfig.discountPct / 100)
  );
  const bundleSavings = topCandidate.item.price - discountedPrice;

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
  };

  // Alternative recommendations (ranks 2 & 3)
  const alternativeRecommendations: ProductRecommendation[] = candidateScores
    .slice(1, 3)
    .map((cand) => {
      const altDiscounted = Math.round(
        cand.item.price * (1 - discountConfig.discountPct / 100)
      );
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
        bundleSavings: cand.item.price - altDiscounted,
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
 * Generates recommendation profiles for all customers in RFM list
 */
export function generateBulkRecommendations(
  customers: CustomerRFMTD[],
  cleanedTransactions: CleanedTransaction[] = [],
  catalog: ProductCatalogItem[] = BANGLADESHI_CATALOG,
  currencySymbol = '৳'
): Map<string, CustomerRecommendationProfile> {
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
    const pastItems = itemsByCustomer.get(c.customerKey) || [];
    const profile = generateCustomerRecommendation(
      c,
      pastItems,
      catalog,
      currencySymbol
    );
    profileMap.set(c.customerKey, profile);
  });

  return profileMap;
}
