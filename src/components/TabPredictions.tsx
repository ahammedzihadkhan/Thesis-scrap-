import React, { useMemo, useState } from 'react';
import { Download, LineChart, ShieldCheck, TrendingUp, TriangleAlert, Users } from 'lucide-react';
import type { CleanedTransaction, CustomerRFMTD } from '../rfm/types';
import { checkBehaviourModel, predictBehaviour, type CustomerPrediction } from '../rfm/behaviourModel';
import { EARLY_SEGMENT_METAS } from '../rfm/mlClustering';
import { downloadCsv } from '../rfm/dataCleaner';
import { GROUPS } from './WhatsAppBulkExportModal';

interface Props {
  customers: CustomerRFMTD[];
  cleanedRows: CleanedTransaction[];
  currencySymbol: string;
}

const HORIZONS = [30, 90, 180] as const;
type View = 'value' | 'likely' | 'risk';
const VIEWS: [View, string, string][] = [
  ['value', 'Most value ahead', 'Customers expected to spend the most in the period.'],
  ['likely', 'Most likely to order', 'Customers expected to place the most orders.'],
  ['risk', 'Valuable, slipping away', 'Spent a lot before, but are unlikely to still be active: contact them first.'],
];

const groupName = (c?: CustomerRFMTD) =>
  !c ? '-' : c.earlySegment ? EARLY_SEGMENT_METAS[c.earlySegment].name : GROUPS.find(([p]) => p === c.persona)?.[1] ?? '-';

export const TabPredictions: React.FC<Props> = ({ customers, cleanedRows, currencySymbol }) => {
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(90);
  const [view, setView] = useState<View>('value');
  const model = useMemo(() => predictBehaviour(cleanedRows, horizon), [cleanedRows, horizon]);
  const check = useMemo(() => checkBehaviourModel(cleanedRows, horizon), [cleanedRows, horizon]);
  const byKey = useMemo(() => new Map(customers.map((c) => [c.customerKey, c])), [customers]);
  const money = (v: number) => `${currencySymbol}${Math.round(v).toLocaleString()}`;

  if (!model) {
    return (
      <section className="bg-white rounded-2xl border p-6 text-sm text-slate-600">
        Predictions need at least 20 customers and some repeat orders. Add more order history to see who will buy next.
      </section>
    );
  }

  const preds = model.customers;
  const totalOrders = preds.reduce((s, p) => s + p.expectedOrders, 0);
  const totalSpend = preds.reduce((s, p) => s + p.predictedSpend, 0);
  const active = preds.filter((p) => p.pActive >= 0.5).length;
  // "Valuable": top quarter of past spend; "slipping": less than an even chance of still being active.
  const spendCut = customers.map((c) => c.monetary).sort((a, b) => b - a)[Math.floor(customers.length / 4)] ?? 0;
  const isRisk = (p: CustomerPrediction) => p.pActive < 0.5 && (byKey.get(p.customerKey)?.monetary ?? 0) >= spendCut;
  const risk = preds.filter(isRisk);
  const list = (view === 'risk' ? risk : preds)
    .slice()
    .sort((a, b) => view === 'likely' ? b.expectedOrders - a.expectedOrders
      : view === 'risk' ? (byKey.get(b.customerKey)?.monetary ?? 0) - (byKey.get(a.customerKey)?.monetary ?? 0)
      : b.predictedSpend - a.predictedSpend);

  const exportCsv = () => downloadCsv(`kroypulse-predictions-${horizon}d.csv`, [
    ['Customer', 'Phone', 'Group', 'Chance still active (%)', `Expected orders, next ${horizon} days`, 'Expected spend per order',
      `Expected spend, next ${horizon} days`, 'Spent so far', 'Last order'],
    ...list.map((p) => {
      const c = byKey.get(p.customerKey);
      return [c?.customerName ?? p.customerKey, c?.phone ?? '', groupName(c), (100 * p.pActive).toFixed(0), p.expectedOrders.toFixed(2),
        p.expectedValue.toFixed(2), p.predictedSpend.toFixed(2), c ? c.monetary.toFixed(2) : '', c ? c.lastPurchaseDate.toISOString().slice(0, 10) : ''];
    }),
  ]);

  // Expected revenue by customer group
  const groups = new Map<string, { n: number; spend: number; orders: number }>();
  for (const p of preds) {
    const g = groupName(byKey.get(p.customerKey));
    const v = groups.get(g) ?? { n: 0, spend: 0, orders: 0 };
    v.n++; v.spend += p.predictedSpend; v.orders += p.expectedOrders;
    groups.set(g, v);
  }
  const groupRows = [...groups].sort((a, b) => b[1].spend - a[1].spend);
  const cards: [React.ReactNode, string, string, string][] = [
    [<TrendingUp className="w-4 h-4" />, 'Expected orders', Math.round(totalOrders).toLocaleString(), `next ${horizon} days`],
    [<TrendingUp className="w-4 h-4" />, 'Expected revenue', money(totalSpend), "from today's customers"],
    [<Users className="w-4 h-4" />, 'Likely still active', active.toLocaleString(), `of ${preds.length.toLocaleString()} customers`],
    [<TriangleAlert className="w-4 h-4" />, 'Valuable, slipping away', risk.length.toLocaleString(), 'top-spending, unlikely to return'],
  ];

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-2xl border p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2"><LineChart className="w-5 h-5 text-emerald-600" /> Who will buy next</h2>
            <p className="text-sm text-slate-600 max-w-2xl">
              Learned from every customer's order history, with no labels needed: how likely each customer is to still be a customer,
              how many orders they will place, and what they will spend. (BG/NBD and Gamma-Gamma models.)
            </p>
          </div>
          <div role="group" aria-label="Period" className="inline-flex rounded-xl border overflow-hidden text-sm font-bold">
            {HORIZONS.map((h) => (
              <button key={h} onClick={() => setHorizon(h)} aria-pressed={horizon === h}
                className={`px-3 py-1.5 cursor-pointer ${horizon === h ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                Next {h} days
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map(([icon, label, value, sub]) => (
            <div key={label} className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">{icon} {label}</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
              <p className="text-xs text-slate-500">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-950">
        <h3 className="font-extrabold flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Tested on your own orders</h3>
        {check ? (
          <p className="mt-1">
            The models were fitted only on orders up to <strong>{check.cutoff}</strong> and then asked about the next {check.horizonDays} days.{' '}
            {Number.isFinite(check.auc) ? (
              <>They ranked the customers who really came back with an accuracy (AUC) of <strong>{check.auc.toFixed(2)}</strong>
                {' '}(0.5 = guessing, 1 = perfect; a simple orders-per-week rule scores {check.baselineAuc.toFixed(2)}).{' '}</>
            ) : (
              <>{check.boughtAgainPct >= 50 ? 'Every' : 'No'} customer bought again in that period, so ranking accuracy cannot be measured here.{' '}</>
            )}
            They expected <strong>{Math.round(check.predictedOrders).toLocaleString()}</strong> orders; <strong>{check.actualOrders.toLocaleString()}</strong> happened.
            {check.customers < 100 && ` With only ${check.customers} customers in the test, treat this as a rough check.`}
            {check.actualOrders > check.predictedOrders * 1.15 &&' Busy seasons (such as Eid or Christmas) bring more orders than a typical period, so treat the totals as a minimum.'}
          </p>
        ) : (
          <p className="mt-1">Not enough history yet to test the predictions on your own orders (about two months of orders are needed).</p>
        )}
      </section>

      <section className="bg-white rounded-2xl border p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div role="group" aria-label="Customer list" className="flex flex-wrap gap-1.5">
            {VIEWS.map(([v, label, hint]) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v} title={hint}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border ${view === v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <Download className="w-3.5 h-3.5" /> Download this list (CSV)
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">{VIEWS.find(([v]) => v === view)![2]} Showing {Math.min(50, list.length)} of {list.length.toLocaleString()}; the download has all of them.</p>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b">
                <th className="py-2 pr-3">Customer</th><th className="py-2 pr-3">Group</th>
                <th className="py-2 pr-3 text-right">Chance still active</th><th className="py-2 pr-3 text-right">Expected orders</th>
                <th className="py-2 pr-3 text-right">Expected spend</th><th className="py-2 pr-3 text-right">Spent so far</th><th className="py-2">Last order</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 50).map((p) => {
                const c = byKey.get(p.customerKey);
                return (
                  <tr key={p.customerKey} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3 font-semibold text-slate-900">{c?.customerName ?? p.customerKey}</td>
                    <td className="py-1.5 pr-3 text-slate-600">{groupName(c)}</td>
                    <td className="py-1.5 pr-3 text-right">
                      <span className={`font-bold ${p.pActive >= 0.7 ? 'text-emerald-700' : p.pActive >= 0.4 ? 'text-amber-700' : 'text-rose-700'}`}>{Math.round(100 * p.pActive)}%</span>
                    </td>
                    <td className="py-1.5 pr-3 text-right">{p.expectedOrders.toFixed(1)}</td>
                    <td className="py-1.5 pr-3 text-right">{money(p.predictedSpend)}</td>
                    <td className="py-1.5 pr-3 text-right">{c ? money(c.monetary) : '-'}</td>
                    <td className="py-1.5 text-slate-600">{c ? c.lastPurchaseDate.toISOString().slice(0, 10) : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-2xl border p-4 shadow-xs">
        <h3 className="font-extrabold text-slate-900">Expected revenue by customer group, next {horizon} days</h3>
        <div className="mt-2 space-y-1.5">
          {groupRows.map(([g, v]) => (
            <div key={g} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="w-44 shrink-0 text-slate-700">{g} <span className="text-xs text-slate-400">({v.n})</span></span>
              <span className="flex-1 min-w-24 h-3 bg-slate-100 rounded-full overflow-hidden">
                <span className="block h-full bg-emerald-500" style={{ width: `${totalSpend > 0 ? (100 * v.spend) / totalSpend : 0}%` }} />
              </span>
              <span className="sm:w-44 text-right font-semibold text-slate-900">{money(v.spend)} · {Math.round(v.orders)} orders</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
