import React, { useMemo, useRef, useState } from 'react';
import { CustomerRFMTD, PersonaType, CampaignConfig } from '../rfm/types';
import { generateWhatsAppBulkExport } from '../rfm/whatsappBulkExporter';
import { CustomerRecommendationProfile } from '../rfm/recommendationEngine';
import { CloudApiConfig, SendResult, configProblem, sendAll } from '../rfm/whatsappCloudApi';
import { GROUPS } from './WhatsAppBulkExportModal';
import { CheckCircle2, MessageCircle, Send, SkipForward, Square, X, XCircle, Zap } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customers: CustomerRFMTD[];
  shopName: string;
  currencySymbol: string;
  campaignConfigs: Record<PersonaType, CampaignConfig>;
  recommendationsMap?: Map<string, CustomerRecommendationProfile>;
}

const CFG_KEY = 'kroypulse.waapi.v1';
const loadCfg = (): CloudApiConfig => {
  try {
    return { phoneNumberId: '', accessToken: '', templateName: '', languageCode: 'en', includeCode: false, ...JSON.parse(sessionStorage.getItem(CFG_KEY) || '{}') };
  } catch {
    return { phoneNumberId: '', accessToken: '', templateName: '', languageCode: 'en', includeCode: false };
  }
};

export const BulkSendModal: React.FC<Props> = ({ isOpen, onClose, customers, shopName, currencySymbol, campaignConfigs, recommendationsMap }) => {
  const [segment, setSegment] = useState<PersonaType | 'All'>('All');
  const [mode, setMode] = useState<'queue' | 'auto'>('queue');
  const [index, setIndex] = useState(0);
  const [opened, setOpened] = useState(0);
  const [cfg, setCfg] = useState<CloudApiConfig>(loadCfg);
  const [consent, setConsent] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SendResult[]>([]);
  const stopRef = useRef(false);

  // The unified list gives one row per customer with the WhatsApp link, or a Messenger link when there is no phone.
  const rows = useMemo(
    () =>
      generateWhatsAppBulkExport(customers, {
        toolFormat: 'fcommerce_multichannel',
        segmentFilter: segment,
        onlyValidPhones: false,
        shopName,
        currencySymbol,
        campaignConfigs,
        recommendationsMap,
      }).rows,
    [customers, segment, shopName, currencySymbol, campaignConfigs, recommendationsMap]
  );
  const waRows = rows.filter((r) => r.channel === 'WhatsApp' && r.whatsapp_phone);

  if (!isOpen) return null;

  const current = rows[index];
  const openNext = () => {
    if (!current) return;
    window.open(current.dispatch_url, '_blank', 'noopener,noreferrer');
    setOpened((n) => n + 1);
    setIndex((i) => i + 1);
  };

  const updateCfg = (patch: Partial<CloudApiConfig>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    try { sessionStorage.setItem(CFG_KEY, JSON.stringify(next)); } catch { /* private mode: keep in memory only */ }
  };
  const problem = configProblem(cfg);
  const startAuto = async () => {
    stopRef.current = false;
    setResults([]);
    setRunning(true);
    await sendAll(
      cfg,
      waRows.map((r) => ({ phone: r.whatsapp_phone, name: r.customer_name, code: r.discount_code })),
      (r) => setResults((prev) => [...prev, r]),
      () => stopRef.current
    );
    setRunning(false);
  };
  const sent = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" role="dialog" aria-modal="true" aria-labelledby="bulk-send-title">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <h2 id="bulk-send-title" className="text-lg font-extrabold text-slate-900">Send to everyone</h2>
            <p className="text-sm text-slate-600 mt-1">Each customer gets their own message with their name and offer.</p>
          </div>
          <button onClick={onClose} disabled={running} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          <section>
            <h3 className="text-sm font-extrabold text-slate-900 mb-2">1. Who should get the message?</h3>
            <div className="flex flex-wrap gap-2">
              {GROUPS.map(([value, label]) => (
                <button
                  key={value}
                  disabled={running}
                  onClick={() => { setSegment(value); setIndex(0); setOpened(0); setResults([]); }}
                  aria-pressed={segment === value}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold border cursor-pointer ${segment === value ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-extrabold text-slate-900 mb-2">2. How do you want to send?</h3>
            <div className="grid sm:grid-cols-2 gap-2" role="radiogroup">
              {([
                ['queue', 'One by one (free)', 'WhatsApp or Messenger opens with the message ready; you press send. No setup.', MessageCircle],
                ['auto', 'Automatic (WhatsApp Business API)', 'Sends to everyone by itself through Meta’s official API. Needs a Meta Business account.', Zap],
              ] as const).map(([value, title, hint, Icon]) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={mode === value}
                  disabled={running}
                  onClick={() => setMode(value)}
                  className={`text-left p-3 rounded-xl border cursor-pointer ${mode === value ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-900"><Icon className="w-4 h-4 text-emerald-600" />{title}</span>
                  <span className="block text-xs text-slate-500 mt-0.5">{hint}</span>
                </button>
              ))}
            </div>
          </section>

          {mode === 'queue' && (
            <section className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-900">{Math.min(index, rows.length)} of {rows.length} done</span>
                <span className="text-slate-500">{opened} chats opened</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600" style={{ width: `${rows.length ? (100 * Math.min(index, rows.length)) / rows.length : 0}%` }} />
              </div>
              {current ? (
                <>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-sm font-bold text-slate-900">{current.customer_name} <span className="font-normal text-slate-500">· {current.channel}</span></p>
                    <p className="text-sm text-slate-700 mt-1">“{current.message_text}”</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={openNext} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer">
                      <Send className="w-4 h-4" /> Open {current.channel === 'WhatsApp' ? 'WhatsApp' : 'Messenger'} and go to next
                    </button>
                    <button onClick={() => setIndex((i) => i + 1)} className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold hover:bg-slate-50 cursor-pointer">
                      <SkipForward className="w-4 h-4" /> Skip
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">Tip: after pressing send in WhatsApp, come back to this tab and press the green button again.</p>
                </>
              ) : (
                <p className="text-sm font-semibold text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Finished — everyone in this group has been handled.</p>
              )}
            </section>
          )}

          {mode === 'auto' && (
            <section className="rounded-xl border border-slate-200 p-4 space-y-3">
              <details className="text-xs text-slate-600">
                <summary className="cursor-pointer font-semibold text-emerald-700">What do I need? (one-time setup in Meta)</summary>
                <ol className="list-decimal pl-5 mt-2 space-y-1">
                  <li>A Meta Business account with the WhatsApp Business Platform (Cloud API) and a verified business phone number.</li>
                  <li>A <strong>marketing message template approved by Meta</strong>. Its text must use <code>{'{{1}}'}</code> for the customer name (and optionally <code>{'{{2}}'}</code> for the discount code).</li>
                  <li>The <strong>Phone number ID</strong> and an <strong>access token</strong> from WhatsApp → API setup.</li>
                </ol>
                <p className="mt-2">Meta charges per message. Free-text messages are not allowed here; only approved templates.</p>
              </details>
              <div className="grid sm:grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-slate-700">Phone number ID<input className={input + ' mt-1'} value={cfg.phoneNumberId} onChange={(e) => updateCfg({ phoneNumberId: e.target.value })} inputMode="numeric" /></label>
                <label className="text-xs font-semibold text-slate-700">Access token<input className={input + ' mt-1'} type="password" autoComplete="off" value={cfg.accessToken} onChange={(e) => updateCfg({ accessToken: e.target.value })} /></label>
                <label className="text-xs font-semibold text-slate-700">Approved template name<input className={input + ' mt-1'} value={cfg.templateName} onChange={(e) => updateCfg({ templateName: e.target.value })} placeholder="eid_offer" /></label>
                <label className="text-xs font-semibold text-slate-700">Template language<input className={input + ' mt-1'} value={cfg.languageCode} onChange={(e) => updateCfg({ languageCode: e.target.value })} placeholder="en or bn" /></label>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={cfg.includeCode} onChange={(e) => updateCfg({ includeCode: e.target.checked })} className="accent-emerald-600" />
                My template also uses {'{{2}}'} for the discount code
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-800 cursor-pointer bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-emerald-600" />
                These customers agreed to receive WhatsApp messages from my shop, and my template lets them stop messages.
              </label>
              <p className="text-xs text-slate-500">
                {waRows.length} customers have a WhatsApp number{rows.length > waRows.length ? `; ${rows.length - waRows.length} without one can only be reached one by one on Messenger` : ''}.
                The token stays in this browser tab and is forgotten when you close it. Phone numbers and messages go to Meta only when you press Send.
              </p>
              {problem && cfg.phoneNumberId && <p className="text-xs text-rose-700">{problem}</p>}
              <div className="flex flex-wrap items-center gap-2">
                {!running ? (
                  <button onClick={startAuto} disabled={Boolean(problem) || !consent || waRows.length === 0} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer disabled:opacity-50">
                    <Zap className="w-4 h-4" /> Send to {waRows.length} customers
                  </button>
                ) : (
                  <button onClick={() => { stopRef.current = true; }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold cursor-pointer">
                    <Square className="w-4 h-4" /> Stop
                  </button>
                )}
                {results.length > 0 && (
                  <span className="text-sm text-slate-700" aria-live="polite">
                    <CheckCircle2 className="w-4 h-4 inline text-emerald-600" /> {sent} sent · <XCircle className="w-4 h-4 inline text-rose-600" /> {failed.length} failed · {waRows.length - results.length} left
                  </span>
                )}
              </div>
              {failed.length > 0 && (
                <ul className="text-xs text-rose-700 space-y-0.5 max-h-28 overflow-y-auto">
                  {failed.slice(0, 20).map((f) => <li key={f.phone}>{f.name} ({f.phone}): {f.error}</li>)}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
