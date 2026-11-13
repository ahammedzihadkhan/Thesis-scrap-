/**
 * Customer behaviour prediction without labels: who is still an active customer, how many orders each customer will
 * place in the coming weeks, and what they will spend.
 *
 * - BG/NBD (Fader, Hardie & Lee, 2005, Marketing Science 24(2)): while active, a customer buys at their own rate;
 *   after each purchase they may become inactive. Fitted to every customer's purchase history by maximum likelihood.
 * - Gamma-Gamma (Fader, Hardie & Lee, 2005, J. Marketing Research 42(4)): a customer's average order value,
 *   shrunk towards the shop's average when they have few orders.
 *
 * Purchases are counted per day (several orders on one day are one purchase), and time is in weeks.
 */
import type { CleanedTransaction } from './types';

const DAY = 86_400_000;

export interface PurchaseSummary {
  customerKey: string;
  x: number; // repeat purchases (purchase days - 1)
  tx: number; // weeks from first to last purchase
  T: number; // weeks from first purchase to the end of the data
  purchases: number; // purchase days
  avgValue: number; // average spend per purchase day
}

export interface BgNbdParams { r: number; alpha: number; a: number; b: number }
export interface GammaGammaParams { p: number; q: number; gamma: number }

export interface CustomerPrediction {
  customerKey: string;
  pActive: number; // probability the customer is still an active customer (0..1)
  expectedOrders: number; // expected purchase days in the horizon
  expectedValue: number; // expected spend per purchase
  predictedSpend: number; // expectedOrders x expectedValue
}

export interface BehaviourModel {
  horizonDays: number;
  end: Date;
  bgnbd: BgNbdParams;
  gammaGamma: GammaGammaParams | null; // null when too few repeat customers to fit it
  customers: CustomerPrediction[];
}

/** Log-gamma (Lanczos, g = 7): accurate to about 15 digits for x > 0. */
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
export function lnGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
  x -= 1;
  let s = LANCZOS[0];
  for (let i = 1; i < 9; i++) s += LANCZOS[i] / (x + i);
  const t = x + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(s);
}

/** Gauss hypergeometric 2F1(a, b; c; z) for 0 <= z < 1, by its power series. */
function hyp2f1(a: number, b: number, c: number, z: number): number {
  let term = 1, sum = 1;
  for (let n = 0; n < 20_000; n++) {
    term *= ((a + n) * (b + n)) / ((c + n) * (n + 1)) * z;
    sum += term;
    if (Math.abs(term) < 1e-12 * Math.abs(sum)) break;
  }
  return sum;
}

/** Nelder-Mead minimiser (no derivatives needed). */
function nelderMead(f: (v: number[]) => number, start: number[], iters = 3000): number[] {
  const n = start.length;
  let simplex = [start, ...start.map((_, i) => start.map((v, j) => (i === j ? v + 0.5 : v)))].map((v) => ({ v, y: f(v) }));
  for (let it = 0; it < iters; it++) {
    simplex.sort((p, q) => p.y - q.y);
    if (Math.abs(simplex[n].y - simplex[0].y) < 1e-10 * (1 + Math.abs(simplex[0].y))) break;
    const centre = start.map((_, j) => simplex.slice(0, n).reduce((s, p) => s + p.v[j], 0) / n);
    const at = (t: number) => centre.map((c, j) => c + t * (simplex[n].v[j] - c));
    const r = { v: at(-1), y: 0 }; r.y = f(r.v);
    if (r.y < simplex[0].y) {
      const e = { v: at(-2), y: 0 }; e.y = f(e.v);
      simplex[n] = e.y < r.y ? e : r;
    } else if (r.y < simplex[n - 1].y) {
      simplex[n] = r;
    } else {
      const c = { v: at(r.y < simplex[n].y ? -0.5 : 0.5), y: 0 }; c.y = f(c.v);
      if (c.y < Math.min(r.y, simplex[n].y)) simplex[n] = c;
      else {
        const best = simplex[0].v; // shrink towards the best point
        simplex = simplex.map((p, i) => {
          if (i === 0) return p;
          const v = p.v.map((x, j) => best[j] + 0.5 * (x - best[j]));
          return { v, y: f(v) };
        });
      }
    }
  }
  return simplex.sort((p, q) => p.y - q.y)[0].v;
}

/** One summary per customer whose first purchase is before `end` (default: the last date in the data). */
export function summarisePurchases(rows: CleanedTransaction[], end?: Date): PurchaseSummary[] {
  const endMs = end ? end.getTime() : rows.reduce((m, r) => Math.max(m, r.timestamp.getTime()), -Infinity);
  const days = new Map<string, Map<number, number>>(); // customer -> day -> spend
  for (const r of rows) {
    const t = r.timestamp.getTime();
    if (t > endMs) continue;
    const d = Math.floor(t / DAY);
    const m = days.get(r.unifiedKey) ?? new Map<number, number>();
    m.set(d, (m.get(d) ?? 0) + r.totalAmount);
    days.set(r.unifiedKey, m);
  }
  const endDay = Math.floor(endMs / DAY);
  const out: PurchaseSummary[] = [];
  for (const [customerKey, m] of days) {
    const ds = [...m.keys()].sort((a, b) => a - b);
    const spend = [...m.values()].reduce((s, v) => s + v, 0);
    out.push({ customerKey, x: ds.length - 1, tx: (ds[ds.length - 1] - ds[0]) / 7, T: (endDay - ds[0] + 1) / 7,
      purchases: ds.length, avgValue: spend / ds.length });
  }
  return out;
}

function bgnbdLogLik({ r, alpha, a, b }: BgNbdParams, c: PurchaseSummary): number {
  const { x, tx, T } = c;
  const a1 = lnGamma(r + x) - lnGamma(r) + r * Math.log(alpha);
  const a2 = lnGamma(a + b) + lnGamma(b + x) - lnGamma(b) - lnGamma(a + b + x);
  const a3 = -(r + x) * Math.log(alpha + T);
  if (x === 0) return a1 + a2 + a3;
  const a4 = Math.log(a) - Math.log(b + x - 1) - (r + x) * Math.log(alpha + tx);
  const m = Math.max(a3, a4);
  return a1 + a2 + m + Math.log(Math.exp(a3 - m) + Math.exp(a4 - m));
}

export function fitBgNbd(data: PurchaseSummary[]): BgNbdParams {
  const meanT = data.reduce((s, c) => s + c.T, 0) / Math.max(1, data.length);
  const unpack = (v: number[]) => ({ r: Math.exp(v[0]), alpha: Math.exp(v[1]), a: Math.exp(v[2]), b: Math.exp(v[3]) });
  const negLL = (v: number[]) => {
    if (v.some((x) => Math.abs(x) > 12)) return Infinity; // keeps the search inside sensible values
    const p = unpack(v);
    let s = 0;
    for (const c of data) s += bgnbdLogLik(p, c);
    return Number.isFinite(s) ? -s : Infinity;
  };
  return unpack(nelderMead(negLL, [0, Math.log(Math.max(1, meanT / 4)), 0, 0]));
}

/** Probability that the customer is still active at the end of their history. */
export function pActive({ r, alpha, a, b }: BgNbdParams, c: PurchaseSummary): number {
  if (c.x === 0) return 1;
  return 1 / (1 + (a / (b + c.x - 1)) * Math.pow((alpha + c.T) / (alpha + c.tx), r + c.x));
}

/** Expected purchases in the next t weeks (Fader, Hardie & Lee 2005, eq. 10). */
export function expectedPurchases(p: BgNbdParams, c: PurchaseSummary, t: number): number {
  const { r, alpha, a, b } = p;
  const { x, T } = c;
  const z = t / (alpha + T + t);
  const head = (a + b + x - 1) / (a - 1);
  const body = 1 - Math.pow((alpha + T) / (alpha + T + t), r + x) * hyp2f1(r + x, b + x, a + b + x - 1, z);
  const v = head * body * pActive(p, c);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function fitGammaGamma(data: PurchaseSummary[]): GammaGammaParams | null {
  const repeat = data.filter((c) => c.purchases >= 2 && c.avgValue > 0);
  if (repeat.length < 20) return null;
  const negLL = (v: number[]) => {
    if (v.some((x) => Math.abs(x) > 15)) return Infinity;
    const [p, q, g] = v.map(Math.exp);
    let s = 0;
    for (const c of repeat) {
      const n = c.purchases, m = c.avgValue;
      s += lnGamma(p * n + q) - lnGamma(p * n) - lnGamma(q) + q * Math.log(g) + (p * n - 1) * Math.log(m)
        + p * n * Math.log(n) - (p * n + q) * Math.log(g + n * m);
    }
    return Number.isFinite(s) ? -s : Infinity;
  };
  const meanValue = repeat.reduce((s, c) => s + c.avgValue, 0) / repeat.length;
  const [p, q, gamma] = nelderMead(negLL, [0, Math.log(3), Math.log(meanValue)]).map(Math.exp);
  return q > 1 ? { p, q, gamma } : null; // q <= 1: the shop's average order value is not defined under the model
}

/** Expected spend per purchase: the customer's own average, shrunk towards the shop average when they have few orders. */
export function expectedOrderValue(g: GammaGammaParams | null, c: PurchaseSummary, shopMean: number): number {
  if (!g) return c.purchases >= 2 ? c.avgValue : shopMean;
  const n = c.purchases;
  return (g.p * (g.gamma + n * c.avgValue)) / (g.p * n + g.q - 1);
}

interface Fitted { data: PurchaseSummary[]; bgnbd: BgNbdParams; gammaGamma: GammaGammaParams | null; shopMean: number }
// The fit does not depend on the horizon: keep it per order list and end date, so changing the period
// (or opening another screen on the same data) does not fit again.
const fits = new WeakMap<CleanedTransaction[], Map<number, Fitted | null>>();

function fitted(rows: CleanedTransaction[], end: Date): Fitted | null {
  const byEnd = fits.get(rows) ?? new Map<number, Fitted | null>();
  fits.set(rows, byEnd);
  if (byEnd.has(end.getTime())) return byEnd.get(end.getTime())!;
  const data = summarisePurchases(rows, end);
  const f = data.length < 20 || !data.some((c) => c.x > 0) ? null : {
    data, bgnbd: fitBgNbd(data), gammaGamma: fitGammaGamma(data),
    shopMean: data.reduce((s, c) => s + c.avgValue, 0) / data.length,
  };
  byEnd.set(end.getTime(), f);
  return f;
}

/** Fit both models on the history up to `end` (default: the last order) and predict the next `horizonDays` days for every customer. */
export function predictBehaviour(rows: CleanedTransaction[], horizonDays = 90, end?: Date): BehaviourModel | null {
  if (rows.length === 0) return null;
  const endDate = end ?? new Date(rows.reduce((m, r) => Math.max(m, r.timestamp.getTime()), -Infinity));
  const f = fitted(rows, endDate);
  if (!f) return null;
  const { data, bgnbd, gammaGamma, shopMean } = f;
  const t = horizonDays / 7;
  const customers = data.map((c) => {
    const expectedOrders = expectedPurchases(bgnbd, c, t);
    const expectedValue = expectedOrderValue(gammaGamma, c, shopMean);
    return { customerKey: c.customerKey, pActive: pActive(bgnbd, c), expectedOrders, expectedValue,
      predictedSpend: expectedOrders * expectedValue };
  });
  return { horizonDays, end: endDate, bgnbd, gammaGamma, customers };
}

/** Area under the ROC curve (ties count half): how well `score` ranks positives above negatives. */
export function rocAuc(score: number[], label: boolean[]): number {
  const idx = score.map((s, i) => [s, i] as const).sort((p, q) => p[0] - q[0]);
  let rankSum = 0, pos = 0;
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j < idx.length && idx[j][0] === idx[i][0]) j++;
    const avgRank = (i + j + 1) / 2; // ranks are 1-based
    for (let k = i; k < j; k++) if (label[idx[k][1]]) { rankSum += avgRank; pos++; }
    i = j;
  }
  const neg = label.length - pos;
  return pos === 0 || neg === 0 ? NaN : (rankSum - (pos * (pos + 1)) / 2) / (pos * neg);
}

export interface BehaviourCheck {
  cutoff: string;
  horizonDays: number;
  customers: number; // customers who bought before the cutoff
  boughtAgainPct: number; // share who bought again within the horizon
  auc: number; // model: does a higher expected-orders score pick the customers who bought again?
  baselineAuc: number; // the customer's past purchases per week, for comparison
  predictedOrders: number; // total purchases the model expected in the horizon
  actualOrders: number; // total purchases that happened
  predictedSpend: number;
  actualSpend: number;
}

/**
 * Test on the shop's own data: fit on everything up to a cutoff, predict the following horizon, and compare
 * with what those customers actually did.
 */
export function checkBehaviourModel(rows: CleanedTransaction[], horizonDays = 90): BehaviourCheck | null {
  if (rows.length === 0) return null;
  let first = Infinity, last = -Infinity;
  for (const r of rows) { const t = r.timestamp.getTime(); first = Math.min(first, t); last = Math.max(last, t); }
  const horizon = Math.min(horizonDays, Math.floor((last - first) / DAY / 4)); // at least 3/4 of the history to fit on
  if (horizon < 14) return null;
  const cutoffMs = last - horizon * DAY;
  const before = rows.filter((r) => r.timestamp.getTime() <= cutoffMs);
  const model = predictBehaviour(before, horizon, new Date(cutoffMs));
  if (!model) return null;
  const actual = new Map(summarisePurchases(rows.filter((r) => r.timestamp.getTime() > cutoffMs)).map((c) => [c.customerKey, c]));
  const past = new Map(summarisePurchases(before, new Date(cutoffMs)).map((c) => [c.customerKey, c]));
  const label = model.customers.map((c) => actual.has(c.customerKey));
  const rate = model.customers.map((c) => { const p = past.get(c.customerKey)!; return p.purchases / p.T; });
  const sum = (v: number[]) => v.reduce((s, x) => s + x, 0);
  return {
    cutoff: new Date(cutoffMs).toISOString().slice(0, 10),
    horizonDays: horizon,
    customers: model.customers.length,
    boughtAgainPct: (100 * label.filter(Boolean).length) / model.customers.length,
    auc: rocAuc(model.customers.map((c) => c.expectedOrders), label),
    baselineAuc: rocAuc(rate, label),
    predictedOrders: sum(model.customers.map((c) => c.expectedOrders)),
    actualOrders: sum(model.customers.map((c) => actual.get(c.customerKey)?.purchases ?? 0)),
    predictedSpend: sum(model.customers.map((c) => c.predictedSpend)),
    actualSpend: sum(model.customers.map((c) => { const a = actual.get(c.customerKey); return a ? a.purchases * a.avgValue : 0; })),
  };
}
