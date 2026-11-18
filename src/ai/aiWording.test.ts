import test from 'node:test';
import assert from 'node:assert/strict';
import { checkMessage, layoutMessage } from './aiWording';
import { ago, bnGap, bnOffer, bnWhen, customerFacts, every, factsToInput, firstName, money, offerText, priced, shortTitle, tidyProduct, topProducts, type WriterFacts } from './messageFacts';
import { DEFAULT_CAMPAIGN_CONFIGS } from '../rfm/campaignDefaults';
import { productType } from '../rfm/productType';
import type { CleanedTransaction, CustomerRFMTD } from '../rfm/types';

test('writer facts use the exact text form of the training data (scripts/writer/make_data.py)', () => {
  assert.deepEqual([1, 13, 20, 59, 60, 330, 400, 800].map(ago),
    ['1 day ago', '13 days ago', '3 weeks ago', '8 weeks ago', '2 months ago', '11 months ago', 'over a year ago', '2 years ago']);
  assert.deepEqual([1, 6.4, 7, 21, 45, 90, 400].map(every),
    ['every day', 'every 6 days', 'every 7 days', 'every 3 weeks', 'every 6 weeks', 'every 3 months', 'about once a year']);
  assert.equal(tidyProduct('WHITE HANGING HEART T-LIGHT HOLDER'), 'White Hanging Heart T-Light Holder');
  assert.equal(tidyProduct("PAPER CHAIN KIT 50'S CHRISTMAS "), "Paper Chain Kit 50's Christmas");
  assert.equal(tidyProduct('Jamdani Saree (Royal Navy)'), 'Jamdani Saree (Royal Navy)');
  assert.equal(shortTitle('Mini i8 2.4GHz 3 Colors Backlit Wireless Keyboard Touchpad for PC TV Box Android'),
    'Mini i8 2.4GHz 3 Colors Backlit Wireless Keyboard Touchpad');
  assert.equal(shortTitle('Laptop Keyboard For Lenovo IdeaPad 110-15 110-15ISK V110-15 keyboard'), 'Laptop Keyboard For Lenovo IdeaPad 110-15 110-15ISK V110-15');
  assert.equal(shortTitle('Cotton Panjabi'), 'Cotton Panjabi');
  // Prices round half up as in make_data.py; a percentage offer keeps the old price for the message.
  assert.deepEqual(priced('Tk ', 1600, '15% off'), ['Tk 1,360', 'Tk 1,600']);
  assert.deepEqual(priced('£', 2.95, '15% off'), ['£2.51', '£2.95']);
  assert.deepEqual(priced('£', 12.75, '20% off'), ['£10.20', '£12.75']);
  assert.deepEqual(priced('Tk ', 1250, '15% off'), ['Tk 1,063', 'Tk 1,250']);
  assert.deepEqual(priced('Tk ', 1600, 'free delivery'), ['Tk 1,600', '-']);
  assert.equal(money('£', 3), '£3');
  assert.deepEqual(['Wireless Earbuds', 'Mustard Oil (1 Litre)', 'Tv Dinner Tray Air Hostess', 'Assorted Colours Silk Fan'].map(productType),
    ['electronics', 'grocery', 'home', 'other']);
  const f: WriterFacts = { segment: 'once', tone: 'formal', name: 'Polash', shop: 'Nodi Glow', buys: ['Beard Oil'], orders: 1,
    lastOrder: '11 months ago', usualGap: '-', suggest: 'Sunscreen SPF 50', type: 'beauty', because: 'Beard Oil', reason: 'bought together',
    price: 'Tk 903', was: 'Tk 1,290', offer: '30% off', code: 'FRIEND-30' };
  assert.equal(factsToInput(f), 'segment: once | tone: formal | name: Polash | shop: Nodi Glow | buys: Beard Oil | orders: 1 | ' +
    'last order: 11 months ago | usual gap: - | suggest: Sunscreen SPF 50 | type: beauty | because: Beard Oil | reason: bought together | ' +
    'price: Tk 903 | was: Tk 1,290 | offer: 30% off | code: FRIEND-30');
});

test('writer facts come from the customer, the campaign settings and the recommendation', () => {
  const regular = { customerKey: 'k1', customerName: 'MD. RAHIM UDDIN', persona: 'Loyal & Promising Regulars', frequency: 6, recency: 15,
    interPurchaseTime: 21 } as CustomerRFMTD;
  const f = customerFacts(regular, { tone: 'friendly', shop: 'Dhaka Threads', buys: ['Silk Lungi'],
    config: DEFAULT_CAMPAIGN_CONFIGS['Loyal & Promising Regulars'], suggest: 'COTTON PANJABI', originalPrice: 1250, currency: '৳',
    reason: 'bought together', basis: 'SILK LUNGI' });
  assert.deepEqual(f, { segment: 'regular', tone: 'friendly', name: 'Rahim', shop: 'Dhaka Threads', buys: ['Silk Lungi'], orders: 6,
    lastOrder: '2 weeks ago', usualGap: 'every 3 weeks', suggest: 'Cotton Panjabi', type: 'fashion', because: 'Silk Lungi',
    reason: 'bought together', price: 'Tk 1,063', was: 'Tk 1,250', offer: '15% off', code: 'PAIR-IT15' });
  const fresh = { customerKey: 'k3', customerName: 'Nadia', earlySegment: 'Developing Newcomers', frequency: 1, recency: 10,
    interPurchaseTime: 0 } as CustomerRFMTD;
  const h = customerFacts(fresh, { tone: 'friendly', shop: 'Gizmo', buys: ['Smart Watch'], config: DEFAULT_CAMPAIGN_CONFIGS['Loyal & Promising Regulars'],
    suggest: 'Fast Charger (25W)', originalPrice: 450, currency: 'Tk ', reason: 'bought together', basis: 'স্মার্ট ওয়াচ' });
  assert.deepEqual([h.offer, h.price, h.was, h.type, h.because, h.reason], ['free delivery', 'Tk 450', '-', 'electronics', '-', '-'],
    'free delivery keeps the regular price; an anchor product the model cannot write means no claim');
  const once = { customerKey: 'k2', customerName: 'Customer 17850', earlySegment: 'One-and-Done Risk', frequency: 1, recency: 200,
    interPurchaseTime: 0 } as CustomerRFMTD;
  const g = customerFacts(once, { tone: 'short', shop: 'রঙধনু', buys: [], config: DEFAULT_CAMPAIGN_CONFIGS['Hibernating / Lost Guests'] });
  assert.deepEqual([g.segment, g.name, g.shop, g.usualGap, g.suggest, g.offer, g.code], ['once', '-', 'our shop', '-', '-', '10% off', 'SECOND10']);
  assert.equal(firstName('রহিম'), '-', 'the model cannot write Bangla script');
  assert.deepEqual([firstName('Md A.'), firstName('Abdullah A.')], ['-', 'Abdullah'], 'masked names: greet only a real first name');
  assert.equal(offerText('Free delivery this week'), 'free delivery');
  const rows = [['k1', 'SILK LUNGI'], ['k1', 'SILK LUNGI'], ['k1', 'POSTAGE'], ['k1', 'Attar'], ['k1', 'জামদানি']]
    .map(([unifiedKey, productName]) => ({ unifiedKey, productName })) as CleanedTransaction[];
  assert.deepEqual(topProducts(rows).get('k1'), ['Silk Lungi', 'Attar'], 'most bought first; postage and unwritable names left out');
});

test('fact check: only messages that keep every fact, invent none and claim only what the facts support are used', () => {
  const f: WriterFacts = { segment: 'regular', tone: 'friendly', name: 'Rahim', shop: 'Dhaka Threads', buys: ['Silk Lungi'], orders: 6,
    lastOrder: '2 weeks ago', usualGap: 'every 3 weeks', suggest: 'Cotton Panjabi', type: 'fashion', because: 'Silk Lungi',
    reason: 'bought together', price: 'Tk 1,063', was: 'Tk 1,250', offer: '15% off', code: 'PAIR-IT15' };
  const proof = 'Customers who bought Silk Lungi also bought Cotton Panjabi.';
  const good = `Hi Rahim! You usually order every 3 weeks, so we thought of you first! ${proof} ` +
    "With code PAIR-IT15, that's 15% off: just Tk 1,063 instead of Tk 1,250. - Dhaka Threads";
  assert.deepEqual(checkMessage(f, good), { ok: true, personal: true, problems: [] });
  const price = checkMessage(f, good.replace('Tk 1,063', 'Tk 1,150'));
  assert.ok(!price.ok && price.problems.some((p) => p.includes('1,150')), 'a changed price is caught');
  assert.ok(!checkMessage(f, good + ' Only 7 left!').ok, 'an invented number is caught');
  assert.ok(!checkMessage(f, good.replace('PAIR-IT15', 'PAIR-IT20')).ok, 'a changed code is caught');
  assert.ok(!checkMessage(f, good + ' Order at https://x.co').ok, 'a link is caught');
  assert.ok(!checkMessage(f, good.replace('Silk Lungi', '<unk>')).ok, 'unreadable text is caught');
  assert.ok(!checkMessage(f, good.replace('With code', `${proof} With code`)).ok, 'a repeated sentence is caught');
  assert.ok(!checkMessage(f, good.replace('With code', 'Do not use code')).ok, 'a negated offer is caught');
  assert.ok(!checkMessage({ ...f, reason: 'same kind' }, good).ok, 'what other customers bought, only with the "bought together" reason');
  const bestSeller = good.replace(proof, 'Cotton Panjabi is one of our best sellers.');
  assert.ok(!checkMessage(f, bestSeller).ok, 'a best seller, only with the "best seller" reason');
  assert.ok(checkMessage({ ...f, reason: 'best seller', because: '-' }, bestSeller).ok);
  assert.ok(!checkMessage(f, good.replace('- Dhaka', 'Hurry, stocks are limited! - Dhaka')).ok, 'invented urgency is caught');
  const second = good.replace("With code", "Your second order gets 15% off. With code");
  assert.ok(!checkMessage(f, second).ok, '"your second order" is caught for a customer with 6 orders');
  assert.ok(checkMessage({ ...f, orders: 1 }, second).ok, '...and allowed for a customer with one order');
  const plain = checkMessage(f, "Hello! Cotton Panjabi is yours for Tk 1,063 instead of Tk 1,250: that's 15% off with code PAIR-IT15.");
  assert.deepEqual([plain.ok, plain.personal], [true, false], 'correct but not personal: used only when no personal draft passes');
});

test('AI messages get WhatsApp line breaks after the greeting and before the sign-off', () => {
  assert.equal(layoutMessage('Dear Rahim, We hope you are well. Kind regards, Dhaka Threads'),
    'Dear Rahim,\nWe hope you are well.\nKind regards, Dhaka Threads');
  assert.equal(layoutMessage('Hi Rahim! Try Panjabi - just Tk 950. - Dhaka Threads'), 'Hi Rahim!\nTry Panjabi - just Tk 950.\n- Dhaka Threads');
  assert.equal(layoutMessage('Hello! Reply YES to grab yours. Warmly, Dhaka Threads'), 'Hello!\nReply YES to grab yours.\nWarmly, Dhaka Threads');
});

// ---- the Bangla writer (scripts/writer/make_data_bn.py)
const bnFacts: WriterFacts = { segment: 'regular', tone: 'friendly', name: 'Rahim', shop: 'Dhaka Threads', buys: ['Silk Lungi'], orders: 6,
  lastOrder: '2 weeks ago', usualGap: 'every 3 weeks', suggest: 'Cotton Panjabi', type: 'fashion', because: 'Silk Lungi',
  reason: 'bought together', price: 'Tk 1,063', was: 'Tk 1,250', offer: '15% off', code: 'PAIR-IT15' };

test('Bangla writer input: last order, usual gap and offer are given in Bangla, the rest as for English', () => {
  assert.equal(factsToInput(bnFacts, 'bn'), 'segment: regular | tone: friendly | name: Rahim | shop: Dhaka Threads | buys: Silk Lungi | orders: 6 | ' +
    'last order: 2 সপ্তাহ আগে | usual gap: প্রতি 3 সপ্তাহে | suggest: Cotton Panjabi | type: fashion | because: Silk Lungi | reason: bought together | ' +
    'price: Tk 1,063 | was: Tk 1,250 | offer: 15% ছাড় | code: PAIR-IT15');
  assert.equal(factsToInput(bnFacts), factsToInput(bnFacts, 'en'), 'English input is unchanged');
  assert.deepEqual(['1 day ago', '13 days ago', '11 months ago', 'over a year ago', '2 years ago', '-'].map(bnWhen),
    ['1 দিন আগে', '13 দিন আগে', '11 মাস আগে', 'এক বছরেরও বেশি আগে', '2 বছর আগে', '-']);
  assert.deepEqual(['every day', 'every 6 days', 'every week', 'every 3 weeks', 'every month', 'every 2 months', 'about once a year', '-'].map(bnGap),
    ['প্রতিদিন', 'প্রতি 6 দিনে', 'প্রতি সপ্তাহে', 'প্রতি 3 সপ্তাহে', 'প্রতি মাসে', 'প্রতি 2 মাসে', 'বছরে প্রায় একবার', '-']);
  assert.deepEqual(['15% off', '12.5% off', 'free delivery', 'a free gift', 'a special discount', '-'].map(bnOffer),
    ['15% ছাড়', '12.5% ছাড়', 'ফ্রি ডেলিভারি', 'ফ্রি উপহার', 'বিশেষ ছাড়', '-']);
});

test('Bangla writer: Bangla-script names, shops and products are allowed only for it', () => {
  assert.equal(firstName('মোঃ রহিম উদ্দিন', 'bn'), 'রহিম');
  assert.equal(firstName('মোঃ রহিম উদ্দিন'), '-', 'the English writer cannot write Bangla script');
  assert.equal(firstName('Customer 17850', 'bn'), '-');
  const c = { customerKey: 'k9', customerName: 'মোছাঃ ফারজানা', persona: 'Loyal & Promising Regulars', frequency: 4, recency: 20, interPurchaseTime: 30 } as CustomerRFMTD;
  const o = { tone: 'friendly' as const, shop: 'রংধনু ফ্যাশন', buys: ['হিজাব'], config: DEFAULT_CAMPAIGN_CONFIGS['Loyal & Promising Regulars'],
    suggest: 'জামদানি শাড়ি', originalPrice: 2000, currency: '৳', reason: 'same kind' as const, basis: 'হিজাব' };
  const f = customerFacts(c, { ...o, lang: 'bn' });
  assert.deepEqual([f.name, f.shop, f.suggest, f.because, f.price, f.was, f.type], ['ফারজানা', 'রংধনু ফ্যাশন', 'জামদানি শাড়ি', 'হিজাব', 'Tk 1,700', 'Tk 2,000', 'other']);
  const e = customerFacts(c, o);
  assert.deepEqual([e.name, e.shop, e.suggest, e.price], ['-', 'our shop', '-', '-'], 'English writer: no Bangla script');
  assert.equal(customerFacts(c, { ...o, shop: '', lang: 'bn' }).shop, 'আমাদের দোকান');
  const rows = [['k1', 'SILK LUNGI'], ['k1', 'জামদানি শাড়ি']].map(([unifiedKey, productName]) => ({ unifiedKey, productName })) as CleanedTransaction[];
  assert.deepEqual(topProducts(rows, 3, 'bn').get('k1'), ['Silk Lungi', 'জামদানি শাড়ি']);
  assert.deepEqual(topProducts(rows).get('k1'), ['Silk Lungi']);
});

test('Bangla fact check: same rules as English, applied to Bangla wording', () => {
  const f = bnFacts;
  const good = 'প্রিয় Rahim! আপনি সাধারণত প্রতি 3 সপ্তাহে অর্ডার করেন, তাই সবার আগে আপনার কথাই মনে পড়ল! ' +
    'যারা "Silk Lungi" কিনেছেন, তারা "Cotton Panjabi"-ও কিনেছেন। কোড PAIR-IT15 ব্যবহার করলে 15% ছাড়: Tk 1,250-এর বদলে মাত্র Tk 1,063। ' +
    'রিপ্লাই করুন, বাকি সব আমরা সামলে নেব। - Dhaka Threads';
  assert.deepEqual(checkMessage(f, good, 'bn'), { ok: true, personal: true, problems: [] });
  assert.ok(!checkMessage(f, good).ok, 'the offer must be in the language of the model (15% off is not in a Bangla message)');
  assert.ok(checkMessage(f, good.replace('Tk 1,063', 'Tk 1,150'), 'bn').problems.some((p) => p.includes('1,150')), 'a changed price is caught');
  assert.ok(!checkMessage(f, good.replace('15% ছাড়', '15% মূল্যছাড়'), 'bn').ok, 'the offer in its Bangla form is required');
  assert.ok(!checkMessage(f, good.replace('PAIR-IT15', 'PAIR-IT20'), 'bn').ok, 'a changed code is caught');
  assert.ok(!checkMessage(f, good.replace('প্রতি 3', 'প্রতি ৩'), 'bn').ok, 'Bangla digits are never in the facts');
  assert.ok(!checkMessage(f, good.replace('বাকি সব আমরা সামলে নেব', 'আমাদের কাছে বাকি নেই'), 'bn').ok, 'a negation is caught');
  assert.ok(!checkMessage(f, good + ' আজই অর্ডার করুন!', 'bn').ok, 'invented urgency is caught');
  assert.ok(!checkMessage(f, good.replace('বাকি সব আমরা সামলে নেব', 'শুধু 7টি বাকি আছে'), 'bn').ok, 'an invented number is caught');
  assert.ok(!checkMessage({ ...f, reason: 'same kind' }, good, 'bn').ok, 'what other customers bought, only with the "bought together" reason');
  const best = good.replace('যারা "Silk Lungi" কিনেছেন, তারা "Cotton Panjabi"-ও কিনেছেন।', '"Cotton Panjabi" আমাদের একটি বেস্ট সেলার।');
  assert.ok(!checkMessage(f, best, 'bn').ok, 'a best seller, only with the "best seller" reason');
  assert.ok(checkMessage({ ...f, reason: 'best seller', because: '-' }, best, 'bn').ok);
  const second = good.replace('রিপ্লাই করুন', 'আপনার দ্বিতীয় অর্ডারে স্বাগতম। রিপ্লাই করুন');
  assert.ok(!checkMessage(f, second, 'bn').ok, '"second order" is caught for a customer with 6 orders');
  assert.ok(checkMessage({ ...f, orders: 1 }, second, 'bn').problems.every((p) => !p.includes('first or second')), '...and allowed for a customer with one order');
  assert.ok(!checkMessage(f, good.replace('রিপ্লাই করুন', 'কোড PAIR-IT15 ব্যবহার করলে 15% ছাড়: Tk 1,250-এর বদলে মাত্র Tk 1,063। রিপ্লাই করুন'), 'bn').ok, 'a repeated sentence is caught');
  // a full stop inside a product name is not a sentence end
  const g: WriterFacts = { ...f, suggest: 'Organic No. 5 Toner', because: 'Organic No. 5 Cream', buys: ['Organic No. 5 Cream'] };
  const withDots = 'প্রিয় Rahim! যারা "Organic No. 5 Cream" কিনেছেন, তারা "Organic No. 5 Toner"-ও কিনেছেন। ' +
    'কোড PAIR-IT15 ব্যবহার করলে 15% ছাড়: Tk 1,250-এর বদলে মাত্র Tk 1,063। - Dhaka Threads';
  assert.deepEqual(checkMessage(g, withDots, 'bn').problems, []);
});

test('Bangla messages get WhatsApp line breaks after the greeting and before the sign-off', () => {
  assert.equal(layoutMessage('প্রিয় Rahim! আপনাকে মিস করছি। শুভেচ্ছান্তে, Dhaka Threads', 'bn'), 'প্রিয় Rahim!\nআপনাকে মিস করছি।\nশুভেচ্ছান্তে, Dhaka Threads');
  assert.equal(layoutMessage('হ্যালো! নিতে চান? শুধু রিপ্লাই করুন! - Dhaka Threads', 'bn'), 'হ্যালো!\nনিতে চান? শুধু রিপ্লাই করুন!\n- Dhaka Threads');
  assert.equal(layoutMessage('Dhaka Threads থেকে শুভেচ্ছা! আবার আসুন। - Dhaka Threads', 'bn'), 'Dhaka Threads থেকে শুভেচ্ছা!\nআবার আসুন।\n- Dhaka Threads');
});
