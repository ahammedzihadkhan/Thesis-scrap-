/**
 * Fact check for messages written by the offline model. A message may only use facts it was given:
 * the suggested product, its price, the offer and the code must appear exactly, and no other number, price,
 * percentage, code, link or e-mail may appear. It may only make the claims the facts support. A message that
 * fails is never used; the shop's template is.
 */
import { bnOffer, factsToInput, type WriterFacts, type WriterLang } from './messageFacts';

// Links, e-mails, codes such as SECOND10 or VIP-CURATED20, and numbers (1,250 / 2.95 / 15%).
const FACTS = /https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w-]+\.\w+|\b[A-Z][A-Z0-9-]*\d[A-Z0-9-]*\b|\d+(?:[.,]\d+)*\s*%?/g;
const factSet = (s: string) => new Set((s.match(FACTS) ?? []).map((f) => f.replace(/\s+/g, '').toLowerCase()));
// What other customers bought, and best-seller status, may be claimed only when the suggestion's reason says so
// (the same patterns as self_check in scripts/writer/make_data.py).
const SOCIAL = /who (?:bought|purchased|picked up)|buyers also|also (?:bought|purchased|got|picked|chose|choose)|often add|bought together|frequently chosen/i;
const BEST = /best[- ]sell|most popular|customer favourite/i;
// The shop sets no deadline and no stock level, so a message may not invent either.
const URGENT = /limited|last chance|hurry|few left|selling fast|ends (?:soon|today|tonight)|today only|while stocks? last|expir/i;
// The training messages contain no negation; one can reverse the offer, as in "Do not use code WINBACK25".
const NEGATION = /\b(?:not|never|no longer|cannot|can't|don't|doesn't|won't|isn't|aren't)\b/i;
// "Your second order gets 10% off" is true only for a customer with one order (v2 sometimes wrote it for regulars).
const FIRST_ORDER = /\b(?:first|second) (?:order|purchase)\b|round two/i;

// The same checks for the Bangla writer (the patterns of self_check_bn in scripts/writer/make_data_bn.py). Bangla digits never
// appear in the facts, so any is rejected; a Bangla word counts as a whole word only when no Bangla letter touches it.
const SOCIAL_BN = /(?:যারা|যাঁরা|যে গ্রাহক|যেসব গ্রাহক|যে ক্রেতা)[^।!?]{0,80}?(?:কিন|কেন|ক্রয়|নিয়েছ|বেছে)|(?:কেনা|ক্রয়কারী) (?:গ্রাহক|ক্রেতা)|অন্য(?:ান্য)? (?:গ্রাহক|ক্রেতা|কাস্টমার)|ক্রেতারা|(?:একসাথে|একসঙ্গে) কেনা/;
const BEST_BN = /বেস্ট ?সেলার|সবচেয়ে (?:বেশি )?(?:বিক্রি|জনপ্রিয়)|সর্বাধিক (?:বিক্রি|বিক্রী)|জনপ্রিয়|অনেক গ্রাহক|গ্রাহকদের (?:প্রিয়|পছন্দ)/;
const URGENT_BN = /সীমিত|শেষ সুযোগ|তাড়াতাড়ি|তাড়া|দ্রুত|স্টক|আজই|আজকের|শুধু আজ|মেয়াদ|শেষ হয়ে|ঘণ্টা|ঘন্টা/;
const NEGATION_BN = /(?<![ঀ-৿])(?:না|নেই|নয়|নাই|নহে|কখনো|কখনও)(?![ঀ-৿])/;
const FIRST_ORDER_BN = /(?:প্রথম|দ্বিতীয়)\s*(?:অর্ডার|কেনাকাটা|ক্রয়)|দ্বিতীয়বার/;

export interface MessageCheck {
  ok: boolean; // nothing invented, nothing of the offer missing: safe to send
  personal: boolean; // uses the customer's name and names a product they bought
  problems: string[];
}

export function checkMessage(f: WriterFacts, text: string, lang: WriterLang = 'en'): MessageCheck {
  const bn = lang === 'bn';
  const problems: string[] = [];
  const lower = text.toLowerCase();
  for (const [what, v] of [['product', f.suggest], ['price', f.price], ['offer', bn ? bnOffer(f.offer) : f.offer]]) {
    if (v !== '-' && !lower.includes(v.toLowerCase())) problems.push(`missing ${what} "${v}"`);
  }
  if (f.code !== '-' && !text.includes(f.code)) problems.push(`missing code "${f.code}"`);
  const allowed = factSet(factsToInput(f, lang));
  for (const x of factSet(text)) if (!allowed.has(x)) problems.push(`new fact "${x}"`);
  if (bn && /[০-৯]/.test(text)) problems.push('Bangla digits');
  if (/<unk>|[{}]|https?:/i.test(text)) problems.push('unreadable text');
  if (text.length < 30 || text.length > (bn ? 700 : 600)) problems.push('length');
  const names = [...new Set([f.suggest, f.because, f.shop, ...f.buys])].filter((v) => v !== '-');
  let masked = text; // a Bangla message masks product and shop names first: "Toner No. 5" is not two sentences
  if (bn) for (const v of [...names].sort((a, b) => b.length - a.length)) masked = masked.split(v).join('§');
  const sentences = (bn ? masked : text).split(/(?<=[.!?।])\s+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (new Set(sentences).size < sentences.length) problems.push('repeats itself');
  let rest = text; // product and shop names may contain any word
  for (const v of names) rest = rest.split(v).join(' ');
  if (f.reason !== 'bought together' && (bn ? SOCIAL_BN : SOCIAL).test(rest)) problems.push('claims what other customers bought');
  if (f.reason !== 'best seller' && (bn ? BEST_BN : BEST).test(rest)) problems.push('claims a best seller');
  if ((bn ? URGENT_BN : URGENT).test(rest)) problems.push('invents urgency');
  if ((bn ? NEGATION_BN : NEGATION).test(rest)) problems.push('unexpected negation');
  if (f.orders !== 1 && (bn ? FIRST_ORDER_BN : FIRST_ORDER).test(rest)) problems.push('claims a first or second order');
  const named = f.name === '-' || text.includes(f.name);
  const bought = [...f.buys, f.because].filter((b) => b !== '-');
  const boughtNamed = bought.length === 0 || bought.some((b) => lower.includes(b.toLowerCase()));
  return { ok: problems.length === 0, personal: named && boughtNamed, problems };
}

/** WhatsApp shows line breaks but the model writes none: break after "Hi Rahim!" or "Dear Rahim," and before the sign-off. */
export function layoutMessage(text: string, lang: WriterLang = 'en'): string {
  if (lang === 'bn') {
    return text
      .replace(/^((?:প্রিয়|হ্যালো|হাই|সম্মানিত)[^,!।.?]{0,40}[,!])\s+/, '$1\n')
      .replace(/^([^!।\n]{1,60} (?:থেকে|পক্ষ থেকে আন্তরিক) শুভেচ্ছা[!।])\s+/, '$1\n')
      .replace(/\s+((?:শুভেচ্ছান্তে|ভালোবাসায়|ধন্যবাদান্তে|আন্তরিক শুভেচ্ছায়|বিনীত|ধন্যবাদ),)(?=[^।!?]*$)/, '\n$1')
      .replace(/\s+(-\s+[^।!?\n]{1,50})$/, '\n$1');
  }
  return text
    .replace(/^((?:Dear|Hi|Hello|Hey)\b[^,!.?]{0,40}[,!])\s+(?=[A-Z])/, '$1\n')
    .replace(/\s+((?:Kind|Best|Warm) regards,|With (?:thanks|love),|Sincerely,|Warmly,|Thanks, the|Cheers,)(?=[^.!?]*$)/, '\n$1')
    .replace(/\s+(-\s+[^.!?\n]{1,40})$/, '\n$1');
}
