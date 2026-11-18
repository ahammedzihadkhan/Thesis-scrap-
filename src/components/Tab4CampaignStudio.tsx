import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CustomerRFMTD, PersonaType, CampaignConfig } from '../rfm/types';
import { PERSONA_METAS, EARLY_SEGMENT_METAS } from '../rfm/mlClustering';
import { BANGLA_TEMPLATES, DEFAULT_CAMPAIGN_CONFIGS, EARLY_MESSAGES_BN, OFFER_OPTIONS, PLAIN_GROUP_NAME, offerPct, offerPrice, withOfferPct } from '../rfm/campaignDefaults';
import {
  MessageSquare,
  Mail,
  Download,
  Copy,
  Check,
  Search,
  Filter,
  Send,
  ExternalLink,
  Tag,
  Settings,
  Smartphone,
  Share2,
  Crown,
  UserCheck,
  AlertTriangle,
  Moon,
  Sparkles,
  Store,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { WhatsAppBulkExportModal } from './WhatsAppBulkExportModal';
import { BulkSendModal } from './BulkSendModal';
import { CampaignForecaster } from './CampaignForecaster';

import { CleanedTransaction } from '../rfm/types';
import {
  generateBulkRecommendations,
  CustomerRecommendationProfile,
  BANGLADESHI_CATALOG,
  ProductCatalogItem,
} from '../rfm/recommendationEngine';
import { downloadCsv } from '../rfm/dataCleaner';
import { customerFacts, factsToInput, topProducts, WRITER_TONES, type WriterLang, type WriterTone } from '../ai/messageFacts';
import { writeMessage, writerInstalled, type Written } from '../ai/localWriter';

// AI messages by the exact facts they were written from: they survive tab switches until the page reloads, and a
// message written for an older code, price, shop name or tone can never be shown (its facts no longer match).
const aiWritten = new Map<string, Written>();

interface Tab4CampaignStudioProps {
  customers: CustomerRFMTD[];
  currencySymbol: string;
  cleanedRows?: CleanedTransaction[];
  catalog?: ProductCatalogItem[];
}

export const Tab4CampaignStudio: React.FC<Tab4CampaignStudioProps> = ({
  customers,
  currencySymbol,
  cleanedRows = [],
  catalog = BANGLADESHI_CATALOG,
}) => {
  const [shopName, setShopName] = useState('Artisan Retail & F-Commerce Hub');
  const [activePersonaTab, setActivePersonaTab] = useState<PersonaType>('Champions (VIP Loyalists)');
  const [selectedPersonaFilter, setSelectedPersonaFilter] = useState<PersonaType | 'All'>('All');
  const [selectedBuyerType, setSelectedBuyerType] = useState<'All' | 'guest' | 'regular'>('All');
  const [selectedChannelFilter, setSelectedChannelFilter] = useState<'All' | 'whatsapp' | 'messenger'>('All');
  const [previewChannel, setPreviewChannel] = useState<'whatsapp' | 'messenger'>('whatsapp');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isBulkExportOpen, setIsBulkExportOpen] = useState(false);
  const [isBulkSendOpen, setIsBulkSendOpen] = useState(false);
  const [selectedRecCustomer, setSelectedRecCustomer] = useState<CustomerRFMTD | null>(null);

  // Compute personalized recommendations for all customers
  const recommendationsMap = useMemo(() => {
    return generateBulkRecommendations(
      customers,
      cleanedRows,
      catalog,
      currencySymbol
    );
  }, [customers, cleanedRows, catalog, currencySymbol]);

  // Editable Campaign configs per persona with personalized product merge tags
  const [campaignConfigs, setCampaignConfigs] = useState<Record<PersonaType, CampaignConfig>>(DEFAULT_CAMPAIGN_CONFIGS);

  // Message language: Bangla uses the Bangla templates, or the Bangla AI writer (its own model) for the customers it writes for.
  const [lang, setLang] = useState<'en' | 'bn'>('en');
  const switchLang = (next: 'en' | 'bn') => {
    setLang(next);
    setCampaignConfigs((prev) => {
      const out = { ...prev };
      for (const p of Object.keys(prev) as PersonaType[]) {
        const messageTemplate = next === 'bn' ? BANGLA_TEMPLATES[p] : DEFAULT_CAMPAIGN_CONFIGS[p].messageTemplate;
        // keep the code and offer the owner chose; only the message text changes, with the chosen percentage
        out[p] = { ...prev[p], messageTemplate: offerPct(prev[p]) ? withOfferPct({ ...prev[p], messageTemplate }, offerPct(prev[p])).messageTemplate : messageTemplate };
      }
      return out;
    });
  };

  const handleConfigChange = (
    persona: PersonaType,
    field: keyof CampaignConfig,
    value: string
  ) => {
    setCampaignConfigs((prev) => ({
      ...prev,
      [persona]: {
        ...prev[persona],
        [field]: value,
      },
    }));
  };

  // Offline AI writer (scripts/writer): a message per customer from their own buying facts, fact-checked before use.
  const [aiInstalled, setAiInstalled] = useState<Record<WriterLang, boolean | null>>({ en: null, bn: null }); // one model per language
  const [aiTone, setAiTone] = useState<WriterTone>('friendly');
  const [aiVersion, setAiVersion] = useState(0);
  const [aiRun, setAiRun] = useState<{ done: number; total: number; kept: number; running: boolean; started: number; error?: string } | null>(null);
  const aiStop = useRef(false);
  const boughtMap = useMemo(() => topProducts(cleanedRows, 3, lang), [cleanedRows, lang]);
  useEffect(() => {
    for (const l of ['en', 'bn'] as const) writerInstalled(l).then((ok) => setAiInstalled((prev) => ({ ...prev, [l]: ok })));
    return () => { aiStop.current = true; };
  }, []);
  // Stop writing when the facts change (codes, prices, shop name, tone, data); finished messages stay in aiWritten.
  useEffect(() => {
    aiStop.current = true;
    setAiRun(null);
  }, [customers, campaignConfigs, shopName, currencySymbol, recommendationsMap, aiTone, lang]);

  const writerInput = (c: CustomerRFMTD) => {
    const rec = recommendationsMap.get(c.customerKey)?.primaryRecommendation;
    const facts = customerFacts(c, {
      tone: aiTone,
      shop: shopName,
      buys: boughtMap.get(c.customerKey) ?? [],
      config: campaignConfigs[c.persona || 'High-Potential / At-Risk Guests'],
      suggest: rec?.productName,
      originalPrice: rec?.originalPrice,
      currency: currencySymbol,
      reason: rec?.suggestionKind,
      basis: rec?.basisProduct,
      lang,
    });
    return { facts, key: `${lang}|${factsToInput(facts, lang)}` }; // English and Bangla messages are kept apart
  };

  const writeWithAi = async () => {
    aiStop.current = false;
    const list = filteredQueue;
    const started = Date.now();
    let kept = 0;
    setAiRun({ done: 0, total: list.length, kept, running: true, started });
    for (const [i, c] of list.entries()) {
      const { facts, key } = writerInput(c);
      try {
        const written = aiWritten.get(key) ?? (await writeMessage(facts, 3, lang)); // already written: keep it
        if (aiStop.current) break;
        if (written) {
          kept++;
          aiWritten.set(key, written);
          setAiVersion((v) => v + 1);
        }
      } catch (err) {
        setAiRun({ done: i, total: list.length, kept, running: false, started, error: err instanceof Error ? err.message : String(err) });
        return;
      }
      setAiRun({ done: i + 1, total: list.length, kept, running: true, started });
    }
    setAiRun((r) => r && { ...r, running: false });
  };

  // customerKey -> AI message, for the customers whose current facts have one.
  const aiOverrides = useMemo(() => {
    const out = new Map<string, string>();
    if (aiWritten.size) for (const c of customers) {
      const w = aiWritten.get(writerInput(c).key);
      if (w) out.set(c.customerKey, w.text);
    }
    return out;
  }, [aiVersion, customers, campaignConfigs, shopName, currencySymbol, recommendationsMap, aiTone, boughtMap, lang]);

  const formatMessage = (c: CustomerRFMTD) => aiOverrides.get(c.customerKey) ?? templateMessage(c);
  // What the send and export windows use: in Bangla every customer gets the AI message or else the Bangla template (the windows only know English templates).
  const sendOverrides = lang === 'bn' ? new Map(customers.map((c) => [c.customerKey, formatMessage(c)] as [string, string])) : aiOverrides;

  // Build personalized message for a customer with dynamic suggestion tags
  const templateMessage = (c: CustomerRFMTD) => {
    const persona = c.persona || 'High-Potential / At-Risk Guests';
    const cfg = campaignConfigs[persona];
    const name = c.customerName
      ? c.customerName
      : c.customerKey.startsWith('cust_')
      ? `Customer #${c.customerKey.replace('cust_', '')}`
      : c.phone
      ? c.phone
      : 'Friend';

    const recProfile = recommendationsMap.get(c.customerKey);
    const suggestedProduct = recProfile?.primaryRecommendation.productName || 'Handcrafted Featured Piece';
    const suggestedPrice = recProfile?.primaryRecommendation.discountedPrice
      ? `${currencySymbol}${offerPrice(recProfile.primaryRecommendation.originalPrice, recProfile.primaryRecommendation.discountedPrice, cfg).toLocaleString()}`
      : `${currencySymbol}${Math.round(c.avgOrderValue * (1 - (offerPct(cfg) || 15) / 100)).toLocaleString()}`;
    const personalizedOffer = recProfile?.primaryRecommendation.recommendationReason
      ? `${recProfile.primaryRecommendation.discountPct}% Off (${recProfile.primaryRecommendation.recommendationReason})`
      : cfg.discountValue;

    // Early-stage customers get a lifecycle message instead of a segment offer (two-track strategy).
    return (c.earlySegment ? (lang === 'bn' ? EARLY_MESSAGES_BN[c.earlySegment] : EARLY_SEGMENT_METAS[c.earlySegment].message) : cfg.messageTemplate)
      .replace(/{name}/g, name)
      .replace(/{shop_name}/g, shopName)
      .replace(/{discount_code}/g, cfg.discountCode)
      .replace(/{monetary}/g, `${currencySymbol}${c.monetary.toLocaleString()}`)
      .replace(/{recency}/g, String(c.recency))
      .replace(/{suggested_product}/g, suggestedProduct)
      .replace(/{suggested_price}/g, suggestedPrice)
      .replace(/{personalized_offer}/g, personalizedOffer);
  };


  // Filtered customer list
  const filteredQueue = useMemo(() => {
    return customers.filter((c) => {
      if (selectedPersonaFilter !== 'All' && c.persona !== selectedPersonaFilter) {
        return false;
      }
      if (selectedBuyerType === 'guest' && !c.isGuest) return false;
      if (selectedBuyerType === 'regular' && c.isGuest) return false;

      // Channel filter
      if (selectedChannelFilter === 'whatsapp' && !c.phone) return false;
      if (selectedChannelFilter === 'messenger' && Boolean(c.phone)) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesKey = c.customerKey.toLowerCase().includes(term);
        const matchesPhone = Boolean(c.phone && c.phone.includes(term));
        const matchesEmail = Boolean(c.email && c.email.toLowerCase().includes(term));
        const matchesMessenger = Boolean(c.messengerId && c.messengerId.toLowerCase().includes(term));
        if (!matchesKey && !matchesPhone && !matchesEmail && !matchesMessenger) return false;
      }

      return true;
    });
  }, [customers, selectedPersonaFilter, selectedBuyerType, selectedChannelFilter, searchTerm]);

  // Copy message to clipboard
  const copyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 1-Click Export Campaign Queue as CSV
  const exportCampaignCSV = () => {
    const headers = [
      'Customer_Key',
      'Segment_Persona',
      'Buyer_Type',
      'Channel',
      'Target_Identifier',
      'Phone_WhatsApp',
      'Messenger_ID',
      'Email',
      'Recency_Days',
      'Frequency_Orders',
      'Monetary_Spend',
      'Discount_Code',
      'Dispatch_URL',
      'Personalized_Message',
    ];

    const rows = filteredQueue.map((c) => {
      const msg = formatMessage(c);
      const persona = c.persona || 'High-Potential / At-Risk Guests';
      const code = campaignConfigs[persona].discountCode;
      const cleanPhone = c.phone ? c.phone.replace(/[^\d]/g, '') : '';
      const intlPhone = cleanPhone.length === 11 && cleanPhone.startsWith('01') ? `88${cleanPhone}` : cleanPhone;
      const waUrl = intlPhone ? `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}` : '';
      // Only a Messenger ID that is in the data; a guessed m.me handle can belong to a stranger.
      const cleanHandle = (c.messengerId || '').replace(/^https?:\/\/m\.me\//, '').replace(/^m\.me\//, '');
      const messengerUrl = cleanHandle ? `https://m.me/${cleanHandle}?text=${encodeURIComponent(msg)}` : '';
      const targetChannel = intlPhone ? 'WhatsApp' : cleanHandle ? 'Facebook Messenger' : c.email ? 'Email' : 'No contact details';

      return [
        c.customerKey,
        persona,
        c.isGuest ? 'Guest' : 'Account',
        targetChannel,
        intlPhone || (cleanHandle && `m.me/${cleanHandle}`) || c.email || '',
        c.phone || '',
        cleanHandle && `m.me/${cleanHandle}`,
        c.email || '',
        c.recency,
        c.frequency,
        c.monetary,
        code,
        waUrl || messengerUrl,
        msg,
      ];
    });

    downloadCsv(`FCommerce_Campaign_Queue_${new Date().toISOString().slice(0, 10)}.csv`, [headers, ...rows]);

    confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
  };

  // Helper icons for personas
  const personaIcons: Record<PersonaType, React.ReactNode> = {
    'Champions (VIP Loyalists)': <Crown className="w-4 h-4 text-emerald-600" />,
    'Loyal & Promising Regulars': <UserCheck className="w-4 h-4 text-blue-600" />,
    'High-Potential / At-Risk Guests': <AlertTriangle className="w-4 h-4 text-amber-600" />,
    'Hibernating / Lost Guests': <Moon className="w-4 h-4 text-rose-600" />,
  };

  // Active configuration for template tab
  const activeCfg = campaignConfigs[activePersonaTab];
  const activeGroup = customers.filter((c) => c.persona === activePersonaTab);
  const activeAvgOrder = activeGroup.length ? activeGroup.reduce((sum, c) => sum + c.avgOrderValue, 0) / activeGroup.length : 0;
  const activeMeta = PERSONA_METAS[activePersonaTab];

  // Sample customer for live preview
  const previewCustomer = useMemo(() => {
    return (
      customers.find((c) => c.persona === activePersonaTab) ||
      customers[0] || {
        customerKey: 'cust_sample',
        phone: '+8801711234567',
        email: 'customer@example.com',
        recency: 14,
        frequency: 4,
        monetary: 4500,
        isGuest: false,
        interPurchaseTime: 21,
        basketDepth: 3,
        lastDateStr: '2024-10-15',
        persona: activePersonaTab,
      }
    );
  }, [customers, activePersonaTab]);

  return (
    <div className="space-y-6">
      {/* Top Bar: Store Name & Action CTAs */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Send messages
              </h2>
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                Three steps: choose the offer, check the message, send
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Each customer group gets its own offer and message. Customers without a WhatsApp number can be reached on Messenger instead.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Store Name Input */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
              <Store className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400 font-normal">Shop:</span>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="bg-transparent font-medium text-slate-800 focus:outline-hidden min-w-[140px]"
                placeholder="Shop Name"
              />
            </div>

            <button
              onClick={() => setIsBulkSendOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Send to everyone</span>
            </button>

            {/* F-Commerce Bulk Messaging Exporter */}
            <button
              onClick={() => setIsBulkExportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-white border border-emerald-300 hover:bg-emerald-50 rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Only needed if you use a bulk-messaging app such as WATI or AiSensy"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Download list for bulk messaging</span>
            </button>

            {/* Standard CSV */}
            <button
              onClick={exportCampaignCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
              title="Export unified F-Commerce customer campaign ledger (WhatsApp + Messenger)"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export Unified CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Campaign Copy & Promo Editor with Live WhatsApp Chat Preview */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Segmented Persona Tabs */}
        <div className="border-b border-slate-200/80 bg-slate-50/60 px-4 sm:px-5 pt-3">
          <div className="flex items-center justify-between pb-3 flex-wrap gap-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Step 1 · Choose the offer for each group
              </span>
              <p className="text-[11px] text-slate-400">
                Pick a group, choose a discount, then check the message on the right.
              </p>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-px">
            {(Object.keys(campaignConfigs) as PersonaType[]).map((pType) => {
              const meta = PERSONA_METAS[pType];
              const count = customers.filter((c) => c.persona === pType).length;
              const isActive = activePersonaTab === pType;

              return (
                <button
                  key={pType}
                  onClick={() => setActivePersonaTab(pType)}
                  className={`flex items-center gap-2 py-2 px-3.5 rounded-t-lg border-t-2 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white border-emerald-600 text-slate-900 shadow-2xs'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                  }`}
                >
                  {personaIcons[pType]}
                  <span>{PLAIN_GROUP_NAME[pType]}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-slate-100 text-slate-700' : 'text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Editor Body: 2 Columns (Form on left, WhatsApp Bubble Preview on right) */}
        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Form: Code, Headline, Template (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Promo Code */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Discount code
                </label>
                <div className="relative">
                  <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={activeCfg.discountCode}
                    onChange={(e) =>
                      handleConfigChange(activePersonaTab, 'discountCode', e.target.value.toUpperCase())
                    }
                    className="w-full bg-slate-50/80 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-bold text-slate-800 tracking-wider focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. VIP20"
                  />
                </div>
              </div>

              {/* Offer Headline / Benefit */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Offer (what the customer gets)
                </label>
                <input
                  type="text"
                  value={activeCfg.discountValue}
                  onChange={(e) =>
                    handleConfigChange(activePersonaTab, 'discountValue', e.target.value)
                  }
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. 20% VIP Early Access"
                />
              </div>
            </div>

            {/* Suggested discount levels for this group */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="text-xs font-semibold text-slate-800">How big should the discount be?</p>
              <p className="text-[11px] text-slate-600 mt-0.5">{OFFER_OPTIONS[activePersonaTab].why}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {OFFER_OPTIONS[activePersonaTab].options.map((pct) => {
                  const picked = offerPct(activeCfg) === pct;
                  return (
                    <button
                      key={pct}
                      type="button"
                      aria-pressed={picked}
                      onClick={() => setCampaignConfigs((prev) => ({ ...prev, [activePersonaTab]: withOfferPct(prev[activePersonaTab], pct) }))}
                      className={`text-left rounded-lg border px-3 py-1.5 cursor-pointer transition-colors ${
                        picked ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-400'
                      }`}
                    >
                      <span className="block text-sm font-bold">
                        {pct}% off{pct === OFFER_OPTIONS[activePersonaTab].suggested ? ' · suggested' : ''}
                      </span>
                      <span className={`block text-[11px] ${picked ? 'text-emerald-50' : 'text-slate-500'}`}>
                        costs about {currencySymbol}{Math.round((activeAvgOrder * pct) / 100).toLocaleString()} per order
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Based on this group's average order of {currencySymbol}{Math.round(activeAvgOrder).toLocaleString()}. Picking one updates the code, the offer and the message below.
              </p>
            </div>

            {/* Message language */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-800">Message language:</span>
              {([['en', 'English'], ['bn', 'বাংলা (Bangla)']] as const).map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={lang === code}
                  onClick={() => switchLang(code)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border cursor-pointer ${
                    lang === code ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-400'
                  }`}
                >
                  {label}
                </button>
              ))}
              {lang === 'bn' && (
                <span className="text-[11px] text-slate-500">Bangla messages: the ready-made text below, or the Bangla AI writer further down.</span>
              )}
            </div>

            {/* Template Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                  Step 2 · Check the message
                </label>
                <span className="text-[11px] text-slate-400">
                  Words like {"{name}"} are filled in for each customer
                </span>
              </div>
              <textarea
                rows={6}
                value={activeCfg.messageTemplate}
                onChange={(e) =>
                  handleConfigChange(activePersonaTab, 'messageTemplate', e.target.value)
                }
                className="w-full bg-slate-50/80 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-emerald-500 resize-y font-mono"
              />

              {/* Quick Token Pills */}
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                <span className="text-[10px] text-slate-400 font-medium">Add:</span>
                {[
                  { tag: '{name}', label: 'Customer Name / Phone' },
                  { tag: '{shop_name}', label: 'Store Name' },
                  { tag: '{suggested_product}', label: 'AI Suggested Next-Best Product' },
                  { tag: '{suggested_price}', label: 'Personalized Discounted Price' },
                  { tag: '{personalized_offer}', label: 'Tailored Offer Headline' },
                  { tag: '{discount_code}', label: 'Promo Code' },
                  { tag: '{monetary}', label: 'Total Spend' },
                  { tag: '{recency}', label: 'Days Since Purchase' },
                ].map(({ tag, label }) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (!activeCfg.messageTemplate.includes(tag)) {
                        handleConfigChange(
                          activePersonaTab,
                          'messageTemplate',
                          `${activeCfg.messageTemplate} ${tag}`
                        );
                      }
                    }}
                    title={label}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                      tag.startsWith('{suggested') || tag === '{personalized_offer}'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 font-bold'
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Multi-Channel Chat Bubble Preview (WhatsApp vs Facebook Messenger) (5 cols) */}
          <div className="lg:col-span-5 bg-slate-100/70 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 mb-3 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                  {previewChannel === 'whatsapp' ? (
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-blue-600" />
                  )}
                  <span>Live {previewChannel === 'whatsapp' ? 'WhatsApp' : 'Messenger'} Preview</span>
                </div>
                {/* Channel toggle */}
                <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-[10px]">
                  <button
                    type="button"
                    onClick={() => setPreviewChannel('whatsapp')}
                    className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                      previewChannel === 'whatsapp'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewChannel('messenger')}
                    className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                      previewChannel === 'messenger'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Messenger
                  </button>
                </div>
              </div>

              {/* Chat Bubble Container (WhatsApp vs Facebook Messenger styling) */}
              {previewChannel === 'whatsapp' ? (
                <div className="bg-[#e7fedb] border border-emerald-200/60 rounded-2xl rounded-tr-xs p-3 text-xs text-slate-800 shadow-2xs relative space-y-2">
                  <p className="whitespace-pre-wrap leading-relaxed text-slate-800">
                    {formatMessage(previewCustomer)}
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-medium">
                    <span>10:42 AM</span>
                    <span className="text-emerald-700 font-bold">✓✓</span>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white border border-blue-500 rounded-2xl rounded-tr-xs p-3 text-xs shadow-2xs relative space-y-2">
                  <div className="text-[10px] font-semibold text-blue-100 flex items-center justify-between pb-1 border-b border-white/20">
                    <span>Direct Messenger Inbox</span>
                    <span className="bg-white/20 px-1.5 py-0.2 rounded text-[9px]">m.me target</span>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed text-white">
                    {formatMessage(previewCustomer)}
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-blue-200 font-medium">
                    <span>Sent via Messenger</span>
                    <span>● Seen</span>
                  </div>
                </div>
              )}

              {/* Dynamic suggestion pill in preview */}
              {recommendationsMap.get(previewCustomer.customerKey) && (
                <div className="mt-2.5 p-2 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-700 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-1.5 truncate">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="truncate">
                      <strong>AI Suggestion:</strong> {recommendationsMap.get(previewCustomer.customerKey)?.primaryRecommendation.productName}
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-sm shrink-0 ml-2">
                    {currencySymbol}{recommendationsMap.get(previewCustomer.customerKey)?.primaryRecommendation.discountedPrice.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-3 pt-2 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Target: <strong className="text-slate-700">{previewCustomer.phone || previewCustomer.messengerId || previewCustomer.email || 'no phone or Messenger ID'}</strong></span>
              <button
                onClick={() => copyMessage(formatMessage(previewCustomer), 'preview')}
                className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 cursor-pointer font-medium"
              >
                {copiedId === 'preview' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>Copy Preview</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Module: WhatsApp Campaign Revenue Impact Forecaster */}
      <details className="bg-white rounded-xl border border-slate-200/90 shadow-xs">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-800">
          Optional: estimate how much a campaign could earn
        </summary>
        <div className="p-3 pt-0">
          <CampaignForecaster
            customers={customers}
            currencySymbol={currencySymbol}
            selectedSegmentFilter={selectedPersonaFilter}
            onApplySegmentFilter={(seg) => setSelectedPersonaFilter(seg)}
          />
        </div>
      </details>

      {/* Offline AI writer: one message per customer from their buying habits, checked against the data */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" /> Offline AI writer
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
              Writes a different message for each customer from what they buy, how often they order and when they last
              ordered, in English or Bangla (the language you chose above). It runs on this computer's CPU and sends nothing anywhere. Every message is checked: the product,
              price, offer and code must match your data and nothing may be invented, otherwise the normal template is used.
            </p>
          </div>
          {aiInstalled[lang] === false ? (
            <p className="text-xs text-slate-500 max-w-xs">
              {lang === 'bn' ? 'The Bangla writer is' : 'The English writer is'} not installed on this computer. See “Offline AI writer” in the README to build it.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                value={aiTone}
                onChange={(e) => setAiTone(e.target.value as WriterTone)}
                disabled={Boolean(aiRun?.running)}
                aria-label="Message tone"
                className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
              >
                {WRITER_TONES.map((t) => (
                  <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)} tone</option>
                ))}
              </select>
              {aiRun?.running ? (
                <button onClick={() => { aiStop.current = true; }} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer">
                  Stop
                </button>
              ) : (
                <button
                  onClick={writeWithAi}
                  disabled={!aiInstalled[lang] || filteredQueue.length === 0}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer disabled:opacity-50"
                >
                  Write {filteredQueue.length.toLocaleString()} messages with AI
                </button>
              )}
              {aiOverrides.size > 0 && !aiRun?.running && (
                <button
                  onClick={() => { aiWritten.clear(); setAiVersion((v) => v + 1); setAiRun(null); }}
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Use templates again
                </button>
              )}
            </div>
          )}
        </div>
        {aiRun && (
          <div className="mt-3 text-xs text-slate-600" aria-live="polite">
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(100 * aiRun.done) / Math.max(1, aiRun.total)}%` }} />
            </div>
            <p className="mt-1.5">
              {aiRun.running ? `Writing ${aiRun.done} of ${aiRun.total}…` : `Finished ${aiRun.done} of ${aiRun.total}.`}{' '}
              {aiRun.kept} written by AI
              {aiRun.done > aiRun.kept && `, ${aiRun.done - aiRun.kept} kept the template (no draft passed the check)`}.
              {aiRun.running && aiRun.done > 0 &&
                ` About ${Math.max(1, Math.round(((Date.now() - aiRun.started) / aiRun.done) * (aiRun.total - aiRun.done) / 60000))} min left; the first 25 in the list are written first.`}
            </p>
            {aiRun.error && <p className="text-rose-600 mt-1">The AI writer stopped: {aiRun.error}</p>}
          </div>
        )}
      </div>

      {/* Step 3 · Send to each customer & Customer Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-200/80 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Step 3 · Send to each customer
            </h3>
            <p className="text-xs text-slate-500">
              Showing {filteredQueue.length} of {customers.length} target customers
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Persona filter */}
            <select
              value={selectedPersonaFilter}
              onChange={(e) => setSelectedPersonaFilter(e.target.value as any)}
              className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-hidden"
              aria-label="Filter by Persona"
            >
              <option value="All">All Customer Segments</option>
              {Object.keys(PERSONA_METAS).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>

            {/* Buyer Type filter */}
            <select
              value={selectedBuyerType}
              onChange={(e) => setSelectedBuyerType(e.target.value as any)}
              className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-hidden"
              aria-label="Filter by Buyer Type"
            >
              <option value="All">All Buyer Types</option>
              <option value="regular">Repeat Regulars</option>
              <option value="guest">Guest Checkouts</option>
            </select>

            {/* F-Commerce Channel Filter */}
            <select
              value={selectedChannelFilter}
              onChange={(e) => setSelectedChannelFilter(e.target.value as any)}
              className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-bold text-slate-700 focus:outline-hidden"
              aria-label="Filter by Channel"
            >
              <option value="All">All Channels (WA + Messenger)</option>
              <option value="whatsapp">🟢 WhatsApp Phone Ready</option>
              <option value="messenger">🔵 Messenger Fallback (No WA Phone)</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search phone, ID or Messenger..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 w-44"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Customer Queue Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-4">Customer & Channel</th>
                <th className="py-2.5 px-3">Segment</th>
                <th className="py-2.5 px-3">Buyer Type</th>
                <th className="py-2.5 px-3">✨ Suggested Next Product</th>
                <th className="py-2.5 px-3 text-right">R · F · Spend</th>
                <th className="py-2.5 px-4">Personalized Preview</th>
                <th className="py-2.5 px-4 text-center">Multi-Channel Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No customers match current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredQueue.slice(0, 25).map((c) => {
                  const meta = c.persona ? PERSONA_METAS[c.persona] : PERSONA_METAS['Champions (VIP Loyalists)'];
                  const message = formatMessage(c);
                  const cleanPhone = c.phone ? c.phone.replace(/[^\d]/g, '') : '';
                  const intlPhone = cleanPhone.length === 11 && cleanPhone.startsWith('01') ? `88${cleanPhone}` : cleanPhone;
                  const waUrl = intlPhone ? `https://wa.me/${intlPhone}?text=${encodeURIComponent(message)}` : '';
                  
                  // Only a Messenger ID that is in the data; a guessed m.me handle can belong to a stranger.
                  const cleanMessengerHandle = (c.messengerId || '').replace(/^https?:\/\/m\.me\//, '').replace(/^m\.me\//, '').replace(/^https?:\/\/www\.facebook\.com\//, '');
                  const messengerUrl = cleanMessengerHandle ? `https://m.me/${cleanMessengerHandle}?text=${encodeURIComponent(message)}` : '';

                  const isMessengerOnly = !intlPhone && Boolean(messengerUrl);

                  const mailtoUrl = c.email
                    ? `mailto:${c.email}?subject=${encodeURIComponent(
                        c.earlySegment ? `Thank you from ${shopName}` : campaignConfigs[c.persona || 'Champions (VIP Loyalists)'].headline
                      )}&body=${encodeURIComponent(message)}`
                    : '';

                  const rec = recommendationsMap.get(c.customerKey)?.primaryRecommendation;

                  return (
                    <tr key={c.customerKey} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        <div className="font-mono text-[11px] text-slate-800">{c.customerKey}</div>
                        {intlPhone ? (
                          <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>{c.phone}</span>
                            <span className="text-[9px] bg-emerald-50 text-emerald-800 px-1 rounded font-bold border border-emerald-200">WA</span>
                          </div>
                        ) : !cleanMessengerHandle ? (
                          <div className="text-[10px] text-slate-500 mt-0.5">{c.email ? 'E-mail only' : 'No phone or Messenger ID'}</div>
                        ) : (
                          <div className="mt-0.5">
                            <div className="text-[11px] text-blue-700 font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                              <span>m.me/{cleanMessengerHandle}</span>
                              <span className="text-[9px] bg-blue-50 text-blue-800 px-1 rounded font-bold border border-blue-200">FB</span>
                            </div>
                            <span className="text-[9px] text-amber-700 font-medium bg-amber-50 px-1 rounded-sm mt-0.5 inline-block">
                              No WhatsApp · Target Messenger
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        {c.earlySegment ? (
                          <>
                            <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200" style={{ color: EARLY_SEGMENT_METAS[c.earlySegment].color }}>
                              New · {EARLY_SEGMENT_METAS[c.earlySegment].name}
                            </span>
                            {/* A new customer's group becomes reliable after about 90 days of history (thesis RQ4). */}
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {(c.tenureDays ?? 0) <= 90 ? `history ${c.tenureDays ?? 0}/90 days` : 'only 1–2 orders so far'}
                            </div>
                          </>
                        ) : (
                          <span
                            className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md"
                            style={{
                              backgroundColor: meta.bgColor,
                              color: meta.color,
                              border: `1px solid ${meta.borderColor}`,
                            }}
                          >
                            {meta.title}
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        {c.isGuest ? (
                          <span className="text-amber-700 font-medium">Guest Checkout</span>
                        ) : (
                          <span className="text-slate-600">Registered</span>
                        )}
                      </td>

                      {/* Suggested Next Product Column */}
                      <td className="py-2.5 px-3 max-w-[210px]">
                        {rec ? (
                          <button
                            onClick={() => setSelectedRecCustomer(c)}
                            className="text-left w-full group cursor-pointer"
                            title="Click to view full recommendation details & offer pitch"
                          >
                            <div className="font-semibold text-slate-800 group-hover:text-emerald-700 line-clamp-1 transition-colors flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="truncate">{rec.productName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                                {currencySymbol}{rec.discountedPrice.toLocaleString()} ({rec.discountPct}% off)
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {rec.affinityScorePct}% match
                              </span>
                            </div>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">General Catalog</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono text-[11px] text-slate-600">
                        <div>{c.recency}d recency</div>
                        <div className="text-slate-400 text-[10px]">
                          {c.frequency} ord · {currencySymbol}{c.monetary.toFixed(0)}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 max-w-[240px]">
                        {aiOverrides.has(c.customerKey) && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1 rounded mb-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> AI · facts checked
                          </span>
                        )}
                        <p className="text-[11px] text-slate-700 max-h-32 overflow-y-auto leading-relaxed bg-slate-50 p-1.5 rounded border border-slate-200/80 whitespace-pre-line">
                          {message}
                        </p>
                      </td>

                      {/* Multi-Channel Action: WhatsApp when phone exists, Facebook Messenger when phone is missing! */}
                      <td className="py-2.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          {waUrl ? (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors shadow-2xs"
                              title="Send WhatsApp message with personalized offer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </a>
                          ) : messengerUrl && (
                            /* No WhatsApp number: use the customer's Messenger ID from the data */
                            <a
                              href={messengerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-2xs"
                              title={`Send offer to Facebook Messenger: m.me/${cleanMessengerHandle}`}
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Messenger</span>
                            </a>
                          )}

                          {/* Secondary Messenger button if WhatsApp also present */}
                          {waUrl && cleanMessengerHandle && (
                            <a
                              href={messengerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
                              title={`Also available on Messenger: m.me/${cleanMessengerHandle}`}
                            >
                              <Send className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {mailtoUrl && (
                            <a
                              href={mailtoUrl}
                              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
                              title="Send Email"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}

                          <button
                            onClick={() => copyMessage(isMessengerOnly ? messengerUrl : message, c.customerKey)}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer"
                            title={isMessengerOnly ? 'Copy Messenger dispatch link' : 'Copy message text'}
                          >
                            {copiedId === c.customerKey ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* WhatsApp Bulk Messaging Tool Export Modal */}
      <BulkSendModal
        isOpen={isBulkSendOpen}
        onClose={() => setIsBulkSendOpen(false)}
        customers={customers}
        shopName={shopName}
        currencySymbol={currencySymbol}
        campaignConfigs={campaignConfigs}
        recommendationsMap={recommendationsMap}
        messageOverrides={sendOverrides}
      />

      <WhatsAppBulkExportModal
        isOpen={isBulkExportOpen}
        onClose={() => setIsBulkExportOpen(false)}
        customers={customers}
        shopName={shopName}
        currencySymbol={currencySymbol}
        campaignConfigs={campaignConfigs}
        recommendationsMap={recommendationsMap}
        messageOverrides={sendOverrides}
      />

      {/* Detailed Customer Personalized Recommendation & Offer Modal */}
      {selectedRecCustomer && recommendationsMap.get(selectedRecCustomer.customerKey) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/10 rounded-lg">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Personalized Product Suggestion & Offer
                  </h3>
                  <p className="text-[11px] text-emerald-200">
                    For {selectedRecCustomer.phone || selectedRecCustomer.customerKey} ({selectedRecCustomer.persona})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecCustomer(null)}
                className="p-1 text-emerald-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            {(() => {
              const profile = recommendationsMap.get(selectedRecCustomer.customerKey)!;
              const rec = profile.primaryRecommendation;

              return (
                <div className="p-5 space-y-4">
                  {/* Recommended Product Box */}
                  <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                          {rec.category} · {rec.affinityScorePct}% Affinity Match
                        </span>
                        <h4 className="text-base font-bold text-slate-900 mt-1">
                          {rec.productName}
                        </h4>
                        <p className="text-xs text-slate-600 mt-0.5">
                          💡 <strong>Why chosen:</strong> {rec.recommendationReason}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-extrabold text-emerald-800">
                          {currencySymbol}{rec.discountedPrice.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-400 line-through">
                          {currencySymbol}{rec.originalPrice.toLocaleString()}
                        </div>
                        <span className="text-[10px] font-bold text-rose-700">
                          Save {currencySymbol}{rec.bundleSavings.toLocaleString()} ({rec.discountPct}%)
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs text-slate-700">
                      <span>Promo Code: <strong className="font-mono text-emerald-800">{rec.discountCode}</strong></span>
                      <span>Target AOV: <strong>{currencySymbol}{selectedRecCustomer.avgOrderValue ? Math.round(selectedRecCustomer.avgOrderValue).toLocaleString() : Math.round(selectedRecCustomer.monetary).toLocaleString()}</strong></span>
                    </div>
                  </div>

                  {/* Ready Pitch Snippets */}
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <label className="font-bold text-slate-700">English WhatsApp Pitch Script</label>
                        <button
                          onClick={() => copyMessage(rec.pitchSnippetEn, 'pitch_en')}
                          className="text-[11px] text-emerald-700 hover:text-emerald-900 font-medium cursor-pointer"
                        >
                          {copiedId === 'pitch_en' ? 'Copied! ✓' : 'Copy Text'}
                        </button>
                      </div>
                      <p className="text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2.5 leading-relaxed font-sans">
                        {rec.pitchSnippetEn}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <label className="font-bold text-slate-700">Bangla WhatsApp Pitch Script (বাংলা)</label>
                        <button
                          onClick={() => copyMessage(rec.pitchSnippetBn, 'pitch_bn')}
                          className="text-[11px] text-emerald-700 hover:text-emerald-900 font-medium cursor-pointer"
                        >
                          {copiedId === 'pitch_bn' ? 'Copied! ✓' : 'Copy Bangla'}
                        </button>
                      </div>
                      <p className="text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2.5 leading-relaxed font-sans">
                        {rec.pitchSnippetBn}
                      </p>
                    </div>
                  </div>

                  {/* Modal Footer Actions */}
                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setSelectedRecCustomer(null)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Close
                    </button>
                    {selectedRecCustomer.phone && (
                      <a
                        href={`https://wa.me/${selectedRecCustomer.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(rec.pitchSnippetBn)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Send Bangla Pitch on WhatsApp</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
