import React from 'react';
import { CustomerRFMTD, PersonaType } from '../rfm/types';
import { PERSONA_METAS } from '../rfm/mlClustering';
import { ArrowRight, Crown, Heart, MessageCircle, Moon, Sparkles, TriangleAlert, Upload, UserPlus, Wand2 } from 'lucide-react';

type Tab = 'home' | 'cleaner' | 2 | 4;

interface Props {
  customers: CustomerRFMTD[];
  datasetName: string;
  validOrders: number;
  revenue: number;
  currencySymbol: string;
  onUpload: () => void;
  onLoadSample: () => void;
  onNavigate: (tab: Tab) => void;
}

// Plain-language names so a shop owner does not need to know what "RFM" or "clusters" are.
const GROUPS: { persona: PersonaType; name: string; bn: string; meaning: string; action: string; icon: React.ReactNode }[] = [
  { persona: 'Champions (VIP Loyalists)', name: 'Best customers', bn: 'সেরা কাস্টমার', meaning: 'Buy often, spend the most, bought recently.', action: 'Thank them and give early access. They return anyway — no big discount needed.', icon: <Crown className="w-5 h-5" /> },
  { persona: 'Loyal & Promising Regulars', name: 'Regular customers', bn: 'নিয়মিত কাস্টমার', meaning: 'Come back steadily with moderate spending.', action: 'Show new arrivals or a bundle offer to grow their orders.', icon: <Heart className="w-5 h-5" /> },
  { persona: 'High-Potential / At-Risk Guests', name: 'Slipping away', bn: 'হারিয়ে যাচ্ছেন', meaning: 'Used to buy, but have been quiet for a while.', action: 'Send a comeback offer now, before they forget you.', icon: <TriangleAlert className="w-5 h-5" /> },
  { persona: 'Hibernating / Lost Guests', name: 'Inactive / one-time', bn: 'নিষ্ক্রিয় কাস্টমার', meaning: 'Bought once or long ago.', action: 'A low-cost reminder or clearance offer is enough.', icon: <Moon className="w-5 h-5" /> },
];

export const HomeTab: React.FC<Props> = ({ customers, datasetName, validOrders, revenue, currencySymbol, onUpload, onLoadSample, onNavigate }) => {
  const total = customers.length || 1;
  const early = customers.filter((c) => c.lifecycleStage === 'Early-Stage').length;
  const steps = [
    { n: 1, title: 'Add your orders', text: 'Upload a CSV or Excel file of your orders, or try a sample.', done: validOrders > 0 },
    { n: 2, title: 'Clean automatically', text: 'Dates, prices, phone numbers and duplicates are fixed for you.', done: validOrders > 0 },
    { n: 3, title: 'See your customer groups', text: 'Every customer is placed in a simple group below.', done: customers.length > 0 },
    { n: 4, title: 'Send the right message', text: 'Open WhatsApp or e-mail with the message ready. You press send.', done: false },
  ];

  return (
    <div className="space-y-5">
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Welcome! Here is your shop at a glance.</h2>
            <p className="text-sm text-slate-600 mt-1">
              Data: <strong>{datasetName}</strong> · {validOrders.toLocaleString()} orders · {customers.length.toLocaleString()} customers · {currencySymbol} {revenue.toLocaleString()} sales
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onUpload} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl cursor-pointer">
              <Upload className="w-4 h-4" /> Upload my orders
            </button>
            <button onClick={onLoadSample} className="inline-flex items-center gap-2 border border-slate-300 hover:bg-slate-50 font-bold text-sm px-4 py-2.5 rounded-xl cursor-pointer">
              <Sparkles className="w-4 h-4 text-emerald-600" /> Try a sample shop
            </button>
          </div>
        </div>
        <ol className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {steps.map((s) => (
            <li key={s.n} className={`rounded-xl border p-4 ${s.done ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200'}`}>
              <span className={`w-7 h-7 rounded-full text-sm font-black flex items-center justify-center ${s.done ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>{s.done ? '✓' : s.n}</span>
              <h3 className="font-bold text-sm mt-2 text-slate-900">{s.title}</h3>
              <p className="text-xs text-slate-600 mt-0.5">{s.text}</p>
            </li>
          ))}
        </ol>
        <button onClick={() => onNavigate('cleaner')} className="mt-3 text-xs font-semibold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1 cursor-pointer">
          <Wand2 className="w-3.5 h-3.5" /> See exactly what was cleaned in your file
        </button>
      </section>

      <section>
        <h2 className="text-base font-extrabold text-slate-900 mb-2">Your customer groups</h2>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {GROUPS.map((g) => {
            const meta = PERSONA_METAS[g.persona];
            const count = customers.filter((c) => c.persona === g.persona).length;
            return (
              <article key={g.persona} className="bg-white rounded-2xl border p-4 shadow-xs flex flex-col" style={{ borderTop: `4px solid ${meta.color}` }}>
                <div className="flex items-center gap-2" style={{ color: meta.color }}>
                  {g.icon}
                  <h3 className="font-extrabold text-slate-900">{g.name}</h3>
                </div>
                <p className="text-xs text-slate-500">{g.bn}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900">{count.toLocaleString()}</span>
                  <span className="text-xs text-slate-500">customers · {Math.round((100 * count) / total)}%</span>
                </div>
                <p className="text-sm text-slate-600 mt-2">{g.meaning}</p>
                <p className="text-sm text-slate-800 mt-2 bg-slate-50 rounded-lg p-2"><strong>What to do:</strong> {g.action}</p>
                <button onClick={() => onNavigate(4)} className="mt-auto pt-3 text-sm font-bold inline-flex items-center gap-1 cursor-pointer" style={{ color: meta.color }}>
                  <MessageCircle className="w-4 h-4" /> Prepare messages <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bg-sky-50 border border-sky-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <UserPlus className="w-6 h-6 text-sky-700 shrink-0" />
        <div className="flex-1">
          <h3 className="font-extrabold text-sky-950">{early.toLocaleString()} new customers <span className="font-normal text-sm text-sky-800">(নতুন কাস্টমার)</span></h3>
          <p className="text-sm text-sky-900">
            First order in the last 90 days, or only 1–2 orders. It is too early to judge them — our research found their group is not reliable yet.
            Send them a welcome and a second-order reminder instead.
          </p>
        </div>
        <button onClick={() => onNavigate(2)} className="text-sm font-bold text-sky-800 hover:text-sky-950 inline-flex items-center gap-1 cursor-pointer shrink-0">
          See all customers <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </section>
    </div>
  );
};
