/**
 * Customer facts for the offline message writer, in the exact text form it was trained on.
 * The same rules are in scripts/writer/make_data.py (ago, every, tidy_product, money, priced, to_input): change both together.
 */
import type { SuggestionKind } from '../rfm/recommendationEngine';
import { productType } from '../rfm/productType';
import type { CampaignConfig, CleanedTransaction, CustomerRFMTD, EarlySegment, PersonaType } from '../rfm/types';

export const WRITER_TONES = ['friendly', 'short', 'formal'] as const;
export type WriterTone = (typeof WRITER_TONES)[number];

export interface WriterFacts {
  segment: string;
  tone: WriterTone;
  name: string; // '-' when unknown
  shop: string;
  buys: string[]; // most bought products, at most three
  orders: number;
  lastOrder: string;
  usualGap: string;
  suggest: string;
  type: string; // product type of the suggestion
  because: string; // the customer's product the suggestion comes from
  reason: string; // a SuggestionKind: what the message may claim about the suggestion
  price: string; // after a percentage offer
  was: string; // before a percentage offer
  offer: string;
  code: string;
}

const PERSONA_SEGMENT: Record<PersonaType, string> = {
  'Champions (VIP Loyalists)': 'best',
  'Loyal & Promising Regulars': 'regular',
  'High-Potential / At-Risk Guests': 'slipping',
  'Hibernating / Lost Guests': 'inactive',
};
const EARLY_SEGMENT: Record<EarlySegment, string> = {
  'Promising Newcomers': 'promising',
  'Developing Newcomers': 'new',
  'One-and-Done Risk': 'once',
};
/** The offers of the early-stage lifecycle messages in EARLY_SEGMENT_METAS: [offer, code]. */
const EARLY_OFFER: Record<EarlySegment, [string, string]> = {
  'Promising Newcomers': ['-', '-'],
  'Developing Newcomers': ['free delivery', '-'],
  'One-and-Done Risk': ['10% off', 'SECOND10'],
};
const JUNK = /postage|carriage|manual|discount|bank charges|amazon|samples|adjust|\?|dotcom|cruk|fee/i;

/** Days since the last order as words (at least one day). */
export function ago(days: number): string {
  const d = Math.max(1, Math.round(days));
  if (d === 1) return '1 day ago';
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.floor(d / 7 + 0.5)} weeks ago`;
  if (d < 365) return `${Math.floor(d / 30 + 0.5)} months ago`;
  return d < 730 ? 'over a year ago' : `${Math.floor(d / 365)} years ago`;
}

/** Usual time between orders as words. */
export function every(days: number): string {
  if (days < 1.5) return 'every day';
  if (days < 11) return `every ${Math.floor(days + 0.5)} days`;
  if (days < 60) {
    const w = Math.floor(days / 7 + 0.5);
    return w === 1 ? 'every week' : `every ${w} weeks`;
  }
  if (days < 365) {
    const m = Math.floor(days / 30 + 0.5);
    return m === 1 ? 'every month' : `every ${m} months`;
  }
  return 'about once a year';
}

/** Drops stray quotes and turns ALL-CAPS catalogue names into Title Case. */
export function tidyProduct(name: string): string {
  const s = name.replace(/["*]/g, '').replace(/\s+/g, ' ').trim();
  const letters = s.match(/\p{L}/gu) ?? [];
  const upper = letters.filter((ch) => ch !== ch.toLowerCase()).length;
  if (letters.length && upper / letters.length > 0.7) {
    return s.toLowerCase().replace(/(^|[\s\-(/])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
  }
  return s;
}

/** Long marketplace titles become a readable name of at most 60 characters, cut at " for ", " with ", " - " or a word. */
export function shortTitle(name: string, max = 60): string {
  if (name.length <= max) return name;
  const cut = name.search(/\s(?:for|with)\s|\s[-|]\s|,\s/i);
  let s = cut >= 20 ? name.slice(0, cut) : name;
  if (s.length > max) {
    const i = s.lastIndexOf(' ', max);
    s = i >= 20 ? s.slice(0, i) : s.slice(0, max);
  }
  return s.replace(/\s*\([^)]*$/, '').replace(/[\s,(-]+$/, '');
}

/** The model's vocabulary covers Latin letters, digits, punctuation, £ and € but not Bangla script or emoji. */
export const writable = (s: string) => /^[ -ÿ€]*$/.test(s);

/** The Bangla writer (scripts/writer/make_data_bn.py) adds Bangla script and the zero-width joiners to the same Latin range. */
export type WriterLang = 'en' | 'bn';
export const writableBn = (s: string) => /^[ -ÿ€ঀ-৿‌‍–—‘’“”…]*$/.test(s);
export const writableFor = (lang: WriterLang) => (lang === 'bn' ? writableBn : writable);

const BN_UNIT: Record<string, string> = { day: 'দিন', days: 'দিন', weeks: 'সপ্তাহ', months: 'মাস', years: 'বছর' };
const BN_EVERY: Record<string, string> = { days: 'দিনে', weeks: 'সপ্তাহে', months: 'মাসে' };
const BN_GAP: Record<string, string> = { 'every day': 'প্রতিদিন', 'every week': 'প্রতি সপ্তাহে', 'every month': 'প্রতি মাসে', 'about once a year': 'বছরে প্রায় একবার' };
const BN_OFFER: Record<string, string> = { 'free delivery': 'ফ্রি ডেলিভারি', 'a free gift': 'ফ্রি উপহার', 'a special discount': 'বিশেষ ছাড়' };

/** The Bangla writer gets "last order", "usual gap" and "offer" already in Bangla, so it copies them: when_bn, gap_bn and offer_bn in make_data_bn.py. */
export function bnWhen(s: string): string {
  if (s === 'over a year ago') return 'এক বছরেরও বেশি আগে';
  const m = s.match(/^(\d+) (day|days|weeks|months|years) ago$/);
  return m ? `${m[1]} ${BN_UNIT[m[2]]} আগে` : s;
}
export function bnGap(s: string): string {
  if (BN_GAP[s]) return BN_GAP[s];
  const m = s.match(/^every (\d+) (days|weeks|months)$/);
  return m ? `প্রতি ${m[1]} ${BN_EVERY[m[2]]}` : s;
}
export function bnOffer(s: string): string {
  if (BN_OFFER[s]) return BN_OFFER[s];
  const m = s.match(/^(\d+(?:\.\d+)?)% off$/);
  return m ? `${m[1]}% ছাড়` : s;
}

/** The model cannot write ৳ or ₹. */
const modelCurrency = (symbol: string) => (/৳/.test(symbol) ? 'Tk ' : /₹/.test(symbol) ? 'Rs ' : symbol);

/** 'Tk 1,250' / '£2.95' / '£3', rounding half up: the same rule as money() in make_data.py. */
export function money(cur: string, amount: number): string {
  if (cur === 'Tk ' || cur === 'Rs ') return `${cur}${Math.floor(amount + 0.5).toLocaleString('en-US')}`;
  const cents = Math.floor(amount * 100 + 0.5) / 100;
  return `${cur}${cents.toLocaleString('en-US', Number.isInteger(cents) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** [price, was]: a percentage offer lowers the suggested product's price and keeps the old one for the message. */
export function priced(cur: string, amount: number, offer: string): [string, string] {
  const pct = offer.match(/^(\d+(?:\.\d+)?)% off$/);
  if (!pct) return [money(cur, amount), '-'];
  const now = money(cur, amount * (1 - Number(pct[1]) / 100));
  const was = money(cur, amount);
  return [now, now === was ? '-' : was];
}

/** '15% Comeback Treat' -> '15% off'; free delivery and gifts are kept; anything else is a generic discount. */
export function offerText(discountValue: string): string {
  const pct = discountValue.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) return `${pct[1]}% off`;
  if (/free\s+deliver/i.test(discountValue)) return 'free delivery';
  if (/gift/i.test(discountValue)) return 'a free gift';
  return discountValue.trim() ? 'a special discount' : '-';
}

/** First name for the greeting, or '-' when the data has none (IDs, phone numbers, e-mails; Bangla script only for the Bangla writer). */
export function firstName(raw?: string, lang: WriterLang = 'en'): string {
  const honorific = /^(md|mohammad|muhammad|mohammed|mst|mrs?|ms|dr|sk|sheikh)\.?$|^(?:মো|মোঃ|মোহাম্মদ|মুহাম্মদ|মোছাঃ|মোসাম্মৎ|মিসেস|মিস্টার|ডাঃ|ডা|শেখ)\.?$/i;
  const words = (raw ?? '').trim().split(/\s+/).filter((w) => w && !honorific.test(w));
  const w = words[0] ?? '';
  const bangla = lang === 'bn' && /^[ঀ-৿]+$/.test(w);
  if (!w || /^customer$/i.test(w) || !(bangla || /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'.-]*$/.test(w))) return '-';
  if ((w.match(/\p{L}/gu) ?? []).length < 2) return '-'; // an initial such as "A." is not a name to greet
  return bangla ? w : w[0].toUpperCase() + w.slice(1).toLowerCase();
}

/** Each customer's most bought products (by order lines), at most three, in the model's form. */
export function topProducts(rows: CleanedTransaction[], max = 3, lang: WriterLang = 'en'): Map<string, string[]> {
  const ok = writableFor(lang);
  const counts = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const name = r.productName?.trim();
    if (!name || JUNK.test(name)) continue;
    const m = counts.get(r.unifiedKey) ?? new Map<string, number>();
    m.set(name, (m.get(name) ?? 0) + 1);
    counts.set(r.unifiedKey, m);
  }
  const out = new Map<string, string[]>();
  for (const [key, m] of counts) {
    const names = [...m].sort((a, b) => b[1] - a[1]).map(([n]) => shortTitle(tidyProduct(n))).filter(ok);
    out.set(key, names.slice(0, max));
  }
  return out;
}

export function customerFacts(
  c: CustomerRFMTD,
  o: {
    tone: WriterTone; shop: string; buys: string[]; config: CampaignConfig;
    // the recommendation: product, its regular price in the shop's currency, and why it was chosen
    suggest?: string; originalPrice?: number; currency?: string; reason?: SuggestionKind; basis?: string;
    lang?: WriterLang; // the Bangla writer can also write Bangla-script names, shops and products
  },
): WriterFacts {
  const lang = o.lang ?? 'en';
  const ok = writableFor(lang);
  const [offer, code] = c.earlySegment ? EARLY_OFFER[c.earlySegment] : [offerText(o.config.discountValue), o.config.discountCode || '-'];
  const suggest = o.suggest ? shortTitle(tidyProduct(o.suggest)) : '';
  const cur = modelCurrency(o.currency ?? '');
  const hasSuggestion = Boolean(suggest && (o.originalPrice ?? 0) > 0 && ok(suggest) && writable(cur));
  const [price, was] = hasSuggestion ? priced(cur, o.originalPrice!, offer) : ['-', '-'];
  const basis = o.basis ? shortTitle(tidyProduct(o.basis)) : '';
  const anchored = o.reason === 'bought together' || o.reason === 'same kind';
  // "Customers who bought X ..." needs a product X the model can write; without one, no claim at all
  const because = hasSuggestion && anchored && basis && ok(basis) ? basis : '-';
  const reason = !hasSuggestion || !o.reason || (anchored && because === '-') ? '-' : o.reason;
  return {
    segment: c.earlySegment ? EARLY_SEGMENT[c.earlySegment] : PERSONA_SEGMENT[c.persona ?? 'High-Potential / At-Risk Guests'],
    tone: o.tone,
    name: firstName(c.customerName, lang),
    shop: ok(o.shop) && o.shop.trim() ? o.shop.trim() : lang === 'bn' ? 'আমাদের দোকান' : 'our shop',
    buys: o.buys.slice(0, 3),
    orders: Math.max(1, c.frequency),
    lastOrder: ago(c.recency),
    usualGap: c.frequency >= 2 && c.interPurchaseTime > 0 ? every(c.interPurchaseTime) : '-',
    suggest: hasSuggestion ? suggest : '-',
    type: hasSuggestion ? productType(suggest) : '-',
    because,
    reason,
    price,
    was,
    offer,
    code: writable(code) ? code : '-',
  };
}

/** The text the model was trained on; for the Bangla writer the three word-facts are in Bangla (to_input_bn in make_data_bn.py). */
export function factsToInput(f: WriterFacts, lang: WriterLang = 'en'): string {
  const bn = lang === 'bn';
  const fields: [string, string][] = [
    ['segment', f.segment], ['tone', f.tone], ['name', f.name], ['shop', f.shop],
    ['buys', f.buys.length ? f.buys.join('; ') : '-'], ['orders', String(f.orders)], ['last order', bn ? bnWhen(f.lastOrder) : f.lastOrder],
    ['usual gap', bn ? bnGap(f.usualGap) : f.usualGap], ['suggest', f.suggest], ['type', f.type], ['because', f.because], ['reason', f.reason],
    ['price', f.price], ['was', f.was], ['offer', bn ? bnOffer(f.offer) : f.offer], ['code', f.code],
  ];
  return fields.map(([k, v]) => `${k}: ${v}`).join(' | ');
}
