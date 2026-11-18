import { CampaignConfig, EarlySegment, PersonaType } from './types';

/** Default message template per established segment (editable in Send messages); also used by the AI evaluation. */
export const DEFAULT_CAMPAIGN_CONFIGS: Record<PersonaType, CampaignConfig> = {
  'Champions (VIP Loyalists)': {
    persona: 'Champions (VIP Loyalists)',
    discountCode: 'VIP-CURATED20',
    discountValue: '20% VIP Early Access',
    headline: 'Private VIP Early Access',
    messageTemplate:
      'Hi {name}! 🌟 As our top VIP buyer at {shop_name}, we curated "{suggested_product}" at 20% privilege ({suggested_price}) with code {discount_code}. Reserve yours today!',
  },
  'Loyal & Promising Regulars': {
    persona: 'Loyal & Promising Regulars',
    discountCode: 'PAIR-IT15',
    discountValue: '15% Off Next Purchase',
    headline: 'Loyalty Reward Voucher',
    messageTemplate:
      'Hello {name}! Complete your set at {shop_name} with "{suggested_product}" for only {suggested_price} with code {discount_code}.',
  },
  'High-Potential / At-Risk Guests': {
    persona: 'High-Potential / At-Risk Guests',
    discountCode: 'REVIVE-GIFT15',
    discountValue: '15% Comeback Treat',
    headline: 'We Miss You!',
    messageTemplate:
      'Hi {name}, we miss you at {shop_name}! It’s been {recency} days since your last order. Here is 15% off "{suggested_product}" ({suggested_price}) with code {discount_code}!',
  },
  'Hibernating / Lost Guests': {
    persona: 'Hibernating / Lost Guests',
    discountCode: 'WINBACK25',
    discountValue: '25% Win-Back Flash',
    headline: '25% Exclusive Re-Activation',
    messageTemplate:
      'Hey {name}, we noticed you haven’t shopped at {shop_name} recently. Take 25% off "{suggested_product}" (now {suggested_price}) with code {discount_code} and see what’s new!',
  },
};

/** Three discount levels the owner can pick per segment; `suggested` is the one the segment's behaviour calls for. */
export const OFFER_OPTIONS: Record<PersonaType, { options: number[]; suggested: number; why: string }> = {
  'Champions (VIP Loyalists)': { options: [5, 10, 20], suggested: 5, why: 'They already buy often, so a small thank-you is enough. A big discount only gives away profit.' },
  'Loyal & Promising Regulars': { options: [5, 10, 15], suggested: 10, why: 'A moderate reward is usually enough to bring the next order sooner.' },
  'High-Potential / At-Risk Guests': { options: [10, 15, 20], suggested: 15, why: 'They are slipping away, so they need a clear reason to come back.' },
  'Hibernating / Lost Guests': { options: [15, 20, 25], suggested: 20, why: 'They stopped buying. Only a strong offer works, and it is worth sending once.' },
};

/** The discount percentage written in the offer text (0 when it names none). */
export const offerPct = (cfg: CampaignConfig): number => Number(cfg.discountValue.match(/(\d+(?:\.\d+)?)\s*%/)?.[1] ?? 0);

/** The same campaign with another percentage: the offer text, headline, message and the number ending the code all follow. */
export function withOfferPct(cfg: CampaignConfig, pct: number): CampaignConfig {
  const swap = (t: string) => t.replace(/\d+(?:\.\d+)?\s*%/g, `${pct}%`);
  return {
    ...cfg,
    discountValue: /\d\s*%/.test(cfg.discountValue) ? swap(cfg.discountValue) : `${pct}% Off ${cfg.discountValue}`.trim(),
    headline: swap(cfg.headline),
    messageTemplate: swap(cfg.messageTemplate),
    discountCode: /\d+$/.test(cfg.discountCode) ? cfg.discountCode.replace(/\d+$/, String(pct)) : cfg.discountCode,
  };
}

/** Price of the suggested product after the campaign's own percentage (falls back to the recommendation's price). */
export const offerPrice = (originalPrice: number | undefined, fallback: number, cfg: CampaignConfig): number =>
  originalPrice && offerPct(cfg) ? Math.round(originalPrice * (1 - offerPct(cfg) / 100)) : fallback;

/** Everyday name of each segment, as on the Home page. */
export const PLAIN_GROUP_NAME: Record<PersonaType, string> = {
  'Champions (VIP Loyalists)': 'Best customers',
  'Loyal & Promising Regulars': 'Regular customers',
  'High-Potential / At-Risk Guests': 'Slipping away',
  'Hibernating / Lost Guests': 'Inactive / one-time',
};

/** Bangla message per segment; the percentages match DEFAULT_CAMPAIGN_CONFIGS so withOfferPct can change them. */
export const BANGLA_TEMPLATES: Record<PersonaType, string> = {
  'Champions (VIP Loyalists)':
    'প্রিয় {name}! 🌟 {shop_name}-এর সেরা কাস্টমার হিসেবে আপনার জন্য আমরা বেছে রেখেছি "{suggested_product}"। {discount_code} কোড ব্যবহার করলে 20% ছাড়ে পাবেন মাত্র {suggested_price}-এ। আজই অর্ডার করুন!',
  'Loyal & Promising Regulars':
    'প্রিয় {name}! আপনার আগের কেনাকাটার সাথে মানানসই "{suggested_product}" এখন {shop_name}-এ মাত্র {suggested_price}। {discount_code} কোড দিয়ে 15% ছাড় নিন।',
  'High-Potential / At-Risk Guests':
    'প্রিয় {name}, {shop_name} আপনাকে মিস করছে! আপনার শেষ অর্ডারের পর {recency} দিন হয়ে গেছে। "{suggested_product}"-এ 15% ছাড় ({suggested_price}) পেতে {discount_code} কোড ব্যবহার করুন।',
  'Hibernating / Lost Guests':
    'প্রিয় {name}, অনেক দিন {shop_name}-এ আপনাকে পাইনি। ফিরে আসুন: "{suggested_product}"-এ 25% ছাড়, এখন মাত্র {suggested_price}। কোড: {discount_code}',
};

/** Bangla lifecycle message per early-stage segment (same content as EARLY_SEGMENT_METAS[...].message). */
export const EARLY_MESSAGES_BN: Record<EarlySegment, string> = {
  'Promising Newcomers':
    'প্রিয় {name}, {shop_name} থেকে আবার কেনাকাটা করার জন্য ধন্যবাদ! আপনার পছন্দ হতে পারে এমন কিছু নতুন পণ্য আমরা বেছে রেখেছি। এখানে রিপ্লাই দিন, ছবি পাঠিয়ে দেব।',
  'Developing Newcomers':
    '{shop_name}-এ স্বাগতম, {name}! প্রথম অর্ডারের জন্য ধন্যবাদ। আপনার দ্বিতীয় অর্ডারে ডেলিভারি ফ্রি। অর্ডার করতে এই মেসেজে রিপ্লাই দিন।',
  'One-and-Done Risk':
    'প্রিয় {name}, {shop_name}-এ আপনাকে আবার দেখতে চাই! দ্বিতীয় অর্ডারে 10% ছাড় পেতে SECOND10 কোড ব্যবহার করুন।',
};
