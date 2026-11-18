// Evaluates the offline message writer on customers it never saw in training, with the app's own fact check.
// 1. The app must describe a customer exactly as the training data did (same fact string as make_data.py).
// 2. For each test customer: one greedy draft and two sampled drafts; "app" = what Send messages does
//    (sampled, sampled, greedy: the first draft that passes the check and is personal, else the first that passes).
// 3. Optional baseline: the general SmolLM2-360M-Instruct, prompted with the same facts (needs npm run get-model).
// Usage (after scripts/writer/export.py): npx tsx scripts/evalAiWriter.ts [customers per test set, default 200] [baseline customers, default 0] [en|bn]
// With bn: the Bangla writer (make_data_bn.py data, public/models/kroypulse-writer-bn), the Bangla fact check, the Bangla templates; no baseline.
import { env, pipeline } from '@huggingface/transformers';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { checkMessage, type MessageCheck } from '../src/ai/aiWording';
import { factsToInput, priced, type WriterFacts, type WriterLang, type WriterTone } from '../src/ai/messageFacts';
import { BANGLA_TEMPLATES, DEFAULT_CAMPAIGN_CONFIGS, EARLY_MESSAGES_BN } from '../src/rfm/campaignDefaults';
import { EARLY_SEGMENT_METAS } from '../src/rfm/mlClustering';
import { productType } from '../src/rfm/productType';

const N = Number(process.argv[2] ?? 200);
const LANG: WriterLang = process.argv[4] === 'bn' ? 'bn' : 'en';
const BASELINE = LANG === 'bn' ? 0 : Number(process.argv[3] ?? 0);
const SUFFIX = LANG === 'bn' ? '_bn' : '';
const root = path.resolve(import.meta.dirname, '..');
env.allowRemoteModels = false; // offline: only files on this computer
env.localModelPath = path.join(root, 'public', 'models') + path.sep;

type Rec = { input: string; target: string; facts: Record<string, string> };
const load = (name: string): Rec[] =>
  readFileSync(path.join(root, 'scripts', 'writer', 'out', LANG === 'bn' ? 'data_bn' : 'data', `${name}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const toFacts = (p: Record<string, string>): WriterFacts => ({
  segment: p.segment, tone: p.tone as WriterTone, name: p.name, shop: p.shop, buys: p.buys === '-' ? [] : p.buys.split('; '),
  orders: Number(p.orders), lastOrder: p['last order'], usualGap: p['usual gap'], suggest: p.suggest, type: p.type, because: p.because,
  reason: p.reason, price: p.price, was: p.was, offer: p.offer, code: p.code,
});

const sets = { 'Synthetic shops (unseen names, shops, products)': load('test_synth'), 'UCI real customers (held out)': load('test_uci') };
for (const [set, recs] of Object.entries(sets)) {
  const bad = recs.filter((r) => factsToInput(toFacts(r.facts), LANG) !== r.input);
  if (bad.length) throw new Error(`${set}: ${bad.length} fact strings differ from training, e.g.\n${factsToInput(toFacts(bad[0].facts), LANG)}\n${bad[0].input}`);
  for (const { facts: p } of recs) {
    if (p.suggest !== '-' && productType(p.suggest) !== p.type) throw new Error(`${set}: product type of "${p.suggest}": app ${productType(p.suggest)}, training ${p.type}`);
    if (p.was === '-') continue;
    const cur = p.was.match(/^(Tk |Rs |[£€$])/)![1];
    const [price, was] = priced(cur, Number(p.was.slice(cur.length).replace(/,/g, '')), p.offer);
    if (price !== p.price || was !== p.was) throw new Error(`${set}: price rule: app ${price} / ${was}, training ${p.price} / ${p.was}`);
  }
}
console.log('fact strings, product types and discounted prices: app and training data agree on all test customers');

const t0 = Date.now();
const gen = (await pipeline('text2text-generation', LANG === 'bn' ? 'kroypulse-writer-bn' : 'kroypulse-writer', { dtype: 'q8' })) as unknown as
  (input: string, o: Record<string, unknown>) => Promise<{ generated_text: string }[]>;
console.log(`writer loaded in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const draft = async (input: string, sample: boolean) => {
  const t = performance.now();
  const [o] = await gen(input, sample ? { max_new_tokens: LANG === 'bn' ? 260 : 200, do_sample: true, top_k: 40, temperature: 0.8 } : { max_new_tokens: LANG === 'bn' ? 260 : 200 });
  return { text: o.generated_text.trim(), ms: performance.now() - t };
};

type Row = { set: string; writer: string; f: WriterFacts; text: string; check: MessageCheck; ms: number; drafts: number; input: string };
const rows: Row[] = [];
const SEG_TEMPLATE: Record<string, string> = {
  best: DEFAULT_CAMPAIGN_CONFIGS['Champions (VIP Loyalists)'].messageTemplate,
  regular: DEFAULT_CAMPAIGN_CONFIGS['Loyal & Promising Regulars'].messageTemplate,
  slipping: DEFAULT_CAMPAIGN_CONFIGS['High-Potential / At-Risk Guests'].messageTemplate,
  inactive: DEFAULT_CAMPAIGN_CONFIGS['Hibernating / Lost Guests'].messageTemplate,
  promising: EARLY_SEGMENT_METAS['Promising Newcomers'].message,
  new: EARLY_SEGMENT_METAS['Developing Newcomers'].message,
  once: EARLY_SEGMENT_METAS['One-and-Done Risk'].message,
};
if (LANG === 'bn') {
  Object.assign(SEG_TEMPLATE, {
    best: BANGLA_TEMPLATES['Champions (VIP Loyalists)'], regular: BANGLA_TEMPLATES['Loyal & Promising Regulars'],
    slipping: BANGLA_TEMPLATES['High-Potential / At-Risk Guests'], inactive: BANGLA_TEMPLATES['Hibernating / Lost Guests'],
    promising: EARLY_MESSAGES_BN['Promising Newcomers'], new: EARLY_MESSAGES_BN['Developing Newcomers'], once: EARLY_MESSAGES_BN['One-and-Done Risk'],
  });
}

for (const [set, recs] of Object.entries(sets)) {
  for (const [i, r] of recs.slice(0, N).entries()) {
    const f = toFacts(r.facts);
    const template = SEG_TEMPLATE[f.segment].replace(/{name}/g, f.name === '-' ? (LANG === 'bn' ? 'গ্রাহক' : 'there') : f.name).replace(/{shop_name}/g, f.shop)
      .replace(/{discount_code}/g, f.code).replace(/{suggested_product}/g, f.suggest).replace(/{suggested_price}/g, f.price)
      .replace(/{recency}/g, (f.lastOrder.match(/\d+/) ?? ['30'])[0]);
    rows.push({ set, writer: 'Template (app default)', f, text: template, check: checkMessage(f, template, LANG), ms: 0, drafts: 0, input: r.input });
    const g = await draft(r.input, false);
    const s1 = await draft(r.input, true);
    const s2 = await draft(r.input, true);
    const checks = [s1, s2, g].map((d) => ({ ...d, check: checkMessage(f, d.text, LANG) }));
    rows.push({ set, writer: 'Writer, one greedy draft', f, ...g, check: checks[2].check, drafts: 1, input: r.input });
    rows.push({ set, writer: 'Writer, one sampled draft', f, ...s1, check: checks[0].check, drafts: 1, input: r.input });
    const pick = checks.findIndex((c) => c.check.ok && c.check.personal);
    const k = pick >= 0 ? pick : checks.findIndex((c) => c.check.ok);
    const chosen = k >= 0 ? checks[k] : checks[2];
    rows.push({ set, writer: 'Writer as used in the app (best of 3)', f, text: chosen.text, check: chosen.check,
      ms: checks.slice(0, (k >= 0 ? k : 2) + 1).reduce((a, c) => a + c.ms, 0), drafts: (k >= 0 ? k : 2) + 1, input: r.input });
    if (i % 20 === 19) process.stdout.write(`${set.slice(0, 9)} ${i + 1}/${Math.min(N, recs.length)}\n`);
  }
}

if (BASELINE > 0) {
  env.localModelPath = path.join(root, 'scripts', 'writer', 'out', 'models') + path.sep; // where npm run get-model puts it
  const lm = (await pipeline('text-generation', 'HuggingFaceTB/SmolLM2-360M-Instruct', { dtype: 'q4' })) as unknown as
    (m: unknown, o: Record<string, unknown>) => Promise<{ generated_text: { content: string }[] }[]>;
  const set = 'Synthetic shops (unseen names, shops, products)';
  for (const r of sets[set].slice(0, BASELINE)) {
    const f = toFacts(r.facts);
    const t = performance.now();
    const [o] = await lm([
      { role: 'system', content: 'You write short WhatsApp messages for a small online shop. Use only the facts given. Copy the name, product, price and code exactly. Do not invent prices, numbers, discounts or codes. Reply with the message only.' },
      { role: 'user', content: `Facts: ${r.input}\nWrite a ${f.tone} promotional message for this customer.` },
    ], { max_new_tokens: 120, do_sample: true, temperature: 0.7, top_p: 0.9 });
    const text = o.generated_text.at(-1)!.content.trim();
    rows.push({ set, writer: 'SmolLM2-360M-Instruct, prompted (baseline)', f, text, check: checkMessage(f, text), ms: performance.now() - t, drafts: 1, input: r.input });
  }
}

const PROOF_EN = /who (?:bought|purchased|picked up)|buyers also|also (?:bought|got|picked|chose)|often add|bought together/i;
const PROOF_BN = /যারা|যাঁরা|যে গ্রাহক|কেনা গ্রাহক|ক্রয়কারী গ্রাহক|ক্রেতারা|একসাথে কেনা/;
const distinct2 = (texts: string[]) => {
  const all = texts.flatMap((t) => { const w = t.toLowerCase().split(/\s+/); return w.slice(1).map((x, j) => `${w[j]} ${x}`); });
  return all.length ? new Set(all).size / all.length : 0;
};
const pct = (a: number, b: number) => (b ? (100 * a / b).toFixed(1) : '');
const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
const groups = new Map<string, Row[]>();
for (const r of rows) groups.set(`${r.set}\u0000${r.writer}`, [...(groups.get(`${r.set}\u0000${r.writer}`) ?? []), r]);
const summary = [...groups].map(([key, rs]) => {
  const [set, writer] = key.split('\u0000');
  const ok = rs.filter((r) => r.check.ok);
  const withBuys = ok.filter((r) => r.f.buys.length || r.f.because !== '-');
  const named = ok.filter((r) => r.f.name !== '-');
  const together = ok.filter((r) => r.f.reason === 'bought together');
  const discounted = ok.filter((r) => r.f.was !== '-');
  return {
    set, writer, n: rs.length,
    passed: pct(ok.length, rs.length),
    personal: pct(ok.filter((r) => r.check.personal).length, rs.length),
    bought: pct(withBuys.filter((r) => [...r.f.buys, r.f.because].some((b) => b !== '-' && r.text.toLowerCase().includes(b.toLowerCase()))).length, withBuys.length),
    name: pct(named.filter((r) => r.text.includes(r.f.name)).length, named.length),
    // persuasion that the facts back: what other buyers chose, and the old price next to the new one
    proof: pct(together.filter((r) => (LANG === 'bn' ? PROOF_BN : PROOF_EN).test(r.text) && r.text.includes(r.f.because)).length, together.length),
    anchor: pct(discounted.filter((r) => r.text.includes(r.f.was)).length, discounted.length),
    distinct2: distinct2(rs.map((r) => r.text)).toFixed(3),
    words: (rs.reduce((a, r) => a + r.text.split(/\s+/).length, 0) / rs.length).toFixed(1),
    seconds: rs[0].drafts ? (rs.reduce((a, r) => a + r.ms, 0) / rs.length / 1000).toFixed(2) : '',
    drafts: rs[0].drafts ? (rs.reduce((a, r) => a + r.drafts, 0) / rs.length).toFixed(2) : '',
  };
});
const tables = path.join(root, 'thesis', 'outputs', 'tables');
writeFileSync(path.join(tables, `t_ai_writer${SUFFIX}.csv`), [
  'Test set,Writer,Messages,Passed fact check (%),Personal (%),Names a bought product (%),Uses the name (%),Says what buyers of their product chose (%),Shows the old price (%),Distinct bigrams,Words,Seconds per message,Drafts per message',
  ...summary.map((s) => [q(s.set), q(s.writer), s.n, s.passed, s.personal, s.bought, s.name, s.proof, s.anchor, s.distinct2, s.words, s.seconds, s.drafts].join(',')),
].join('\n') + '\n');
const appRows = rows.filter((r) => r.writer.startsWith('Writer as used') || r.writer.includes('baseline'));
writeFileSync(path.join(tables, `t_ai_writer${SUFFIX}_samples.csv`), [
  'Test set,Writer,Segment,Tone,Passed,Personal,Problems,Facts,Message',
  ...appRows.filter((_, i) => i % 4 === 0 || appRows[i].writer.includes('baseline')).slice(0, 120)
    .map((r) => [q(r.set), q(r.writer), r.f.segment, r.f.tone, r.check.ok, r.check.personal, q(r.check.problems.join('; ')), q(r.input), q(r.text)].join(',')),
].join('\n') + '\n');

console.table(summary);
const why: Record<string, number> = {};
for (const r of rows.filter((x) => !x.check.ok && !x.writer.startsWith('Template'))) {
  for (const p of r.check.problems) { const k = `${r.writer.slice(0, 22)}: ${p.replace(/".*"/, '"…"')}`; why[k] = (why[k] ?? 0) + 1; }
}
console.log('why drafts failed:', why);
for (const r of rows.filter((x) => x.writer.startsWith('Writer as used')).slice(0, 6)) console.log(`\n[${r.f.segment}/${r.f.tone}] ${r.text}`);
