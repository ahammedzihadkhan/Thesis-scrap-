import React from 'react';
import {
  ArrowRight, BrainCircuit, CheckCircle2, FileSpreadsheet, Github, Laptop, Lock, MessageSquareShare, PhoneCall, ShieldCheck, Sparkles, Users, Wand2, WifiOff,
} from 'lucide-react';

interface Props {
  onStart: () => void;
}

const features = [
  { icon: Wand2, title: 'Automatic data cleaner', text: 'Drop a messy CSV or Excel export. Dates, prices, Bangla digits, phone numbers and duplicates are fixed for you, with a log of every change.' },
  { icon: PhoneCall, title: 'Guest buyers recognised', text: 'Repeat buyers without an account are linked by their delivery phone number, so WhatsApp and Messenger shops get real customer histories.' },
  { icon: BrainCircuit, title: 'Five-feature segmentation', text: 'Recency, Frequency, Monetary value, buying rhythm and basket breadth, clustered with K-Means into Champions, Loyal, At-Risk and Hibernating.' },
  { icon: Users, title: 'Early-stage customers', text: 'New and low-history buyers get their own three groups and a welcome-style message, because our research shows a normal segment is not yet reliable in the first 60–90 days.' },
  { icon: MessageSquareShare, title: 'Send to everyone', text: 'One offer per group in English or Bangla. Go through customers one by one with WhatsApp or Messenger opening ready to send, or send automatically through the official WhatsApp Business API.' },
  { icon: ShieldCheck, title: 'Validated, not guessed', text: 'Live silhouette, Davies–Bouldin, bootstrap stability and a true out-of-sample repurchase test on your own data.' },
];

const steps = [
  ['Export', 'Download your orders from Daraz, Shopify, WooCommerce, a POS or your WhatsApp ledger sheet.'],
  ['Clean', 'The data cleaner formats everything and removes broken rows.'],
  ['Segment', 'KroyPulse builds customer profiles and groups them in seconds.'],
  ['Act', 'Send each group the right message from the campaign studio.'],
];

export const Landing: React.FC<Props> = ({ onStart }) => (
  <div className="min-h-screen bg-white text-slate-900">
    <header className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
      <div className="flex items-center gap-2 font-extrabold text-lg">
        <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center"><Sparkles className="w-4 h-4" /></span>
        KroyPulse
      </div>
      <button onClick={onStart} className="text-sm font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer">Sign in</button>
    </header>

    <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-16 grid lg:grid-cols-2 gap-10 items-center">
      <div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full">
          <Lock className="w-3.5 h-3.5" /> Runs 100% on your own computer
        </span>
        <h1 className="mt-4 text-4xl sm:text-5xl font-black leading-tight tracking-tight">
          Know your customers.<br />
          <span className="text-emerald-700">Keep your data.</span>
        </h1>
        <p className="mt-4 text-base text-slate-600 max-w-xl">
          KroyPulse turns the order file of any online or F-commerce shop into clear customer groups and ready-to-send
          WhatsApp and e-mail campaigns. Everything is computed in your browser. No upload, no server, no data leak.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={onStart} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3 rounded-xl cursor-pointer shadow-sm">
            Get started <ArrowRight className="w-4 h-4" />
          </button>
          <a href="https://github.com/ahammedzihadkhan/Thesis-scrap-" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border border-slate-300 hover:bg-slate-50 font-bold px-5 py-3 rounded-xl">
            <Github className="w-4 h-4" /> Open source
          </a>
        </div>
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5"><WifiOff className="w-3.5 h-3.5 text-emerald-600" /> Works offline</span>
          <span className="inline-flex items-center gap-1.5"><Laptop className="w-3.5 h-3.5 text-emerald-600" /> Local accounts only</span>
          <span className="inline-flex items-center gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> CSV &amp; Excel</span>
        </div>
      </div>

      <div className="bg-gradient-to-br from-emerald-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">From our thesis research</p>
        <div className="grid grid-cols-2 gap-4 mt-4">
          {[
            ['4,338', 'customers studied (UCI Online Retail)'],
            ['0.71', 'out-of-sample repurchase AUC with 4 segments'],
            ['0.95', 'bootstrap stability (Adjusted Rand Index)'],
            ['59.5%', 'of future revenue came from the Champions group'],
          ].map(([v, l]) => (
            <div key={l} className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="text-3xl font-black text-emerald-300">{v}</div>
              <div className="text-xs text-emerald-100/80 mt-1">{l}</div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-emerald-100/70 mt-4">
          City University, Bangladesh — Department of CSE, Batch 62. Every number is reproducible from the open notebook.
        </p>
      </div>
    </section>

    <section className="bg-slate-50 border-y border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <h2 className="text-2xl font-extrabold">Everything a small shop needs</h2>
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-white rounded-2xl border border-slate-200 p-5">
              <Icon className="w-6 h-6 text-emerald-600" />
              <h3 className="font-bold mt-3">{title}</h3>
              <p className="text-sm text-slate-600 mt-1">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
      <h2 className="text-2xl font-extrabold">How it works</h2>
      <ol className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map(([t, d], i) => (
          <li key={t} className="rounded-2xl border border-slate-200 p-5">
            <span className="w-8 h-8 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-sm">{i + 1}</span>
            <h3 className="font-bold mt-3">{t}</h3>
            <p className="text-sm text-slate-600 mt-1">{d}</p>
          </li>
        ))}
      </ol>
    </section>

    <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8 grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-2xl font-extrabold text-emerald-950">Your customers' data never leaves this computer</h2>
          <p className="text-sm text-emerald-900/80 mt-2">
            Shops handle phone numbers and addresses. KroyPulse is built so that this data has nowhere to go.
          </p>
        </div>
        <ul className="space-y-2 text-sm text-emerald-950">
          {[
            'All processing happens in your browser; there is no backend server.',
            'A strict Content-Security-Policy blocks the page from sending data to any other site — the only exception is Meta’s official WhatsApp API, used only if you turn on automatic sending and press Send.',
            'The local server listens only on 127.0.0.1, so other devices on your Wi-Fi cannot open it.',
            'Uploaded files stay in memory and are forgotten when you close the tab.',
            'Exports are protected against spreadsheet formula injection.',
            'Messages are only prepared; you decide what to send. Get your customers’ consent first.',
          ].map((t) => (
            <li key={t} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />{t}</li>
          ))}
        </ul>
      </div>
    </section>

    <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 px-4">
      KroyPulse — open-source research prototype by Ahammed Zihad Khan, Shaheda Akter, Aurnob Saha and Md. Nazmul Hasan · City University, Savar, Dhaka
    </footer>
  </div>
);
