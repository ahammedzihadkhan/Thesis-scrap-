import rules from './productTypes.json';

export type ProductType = 'kids' | 'beauty' | 'electronics' | 'home' | 'grocery' | 'fashion' | 'gifts' | 'other';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TESTS = rules.order.map((type) => ({
  type: type as ProductType,
  re: new RegExp(`\\b(?:${(rules.words as Record<string, string[]>)[type].map(escape).join('|')})(?:s|es)?\\b`, 'i'),
}));

/** Rough product type from its name, the same rule as scripts/writer/make_data.py (both read productTypes.json). */
export function productType(name: string): ProductType {
  return TESTS.find((t) => t.re.test(name))?.type ?? 'other';
}
